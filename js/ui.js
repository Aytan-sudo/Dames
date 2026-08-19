// L'interface autour du damier : pendules, dialogues, reglages.
//
// Tout ce qui lit ou ecrit dans la page passe par ici — app.js orchestre la
// partie et ne touche jamais un element a la main.

import { NIVEAUX, niveauDe } from './ia.js';
import { VARIANTES, varianteDe, REGLES_OPTIONNELLES, maisonDe, valeurRegle } from './variantes.js';
import { MODES, PALETTES, modeEffectif } from './themes.js';
import { statsDe, cleStats } from './storage.js';
import { BLANC, NOIR } from './regles.js';

// Le numero de version, montre dans les reglages. Il doit s'accorder avec
// package.json et avec le cache du service worker — sans quoi une correction
// publiee n'atteint jamais ceux qui ont installe le jeu, et personne ne peut
// dire quelle version il a sous les yeux. Un test verifie les trois.
export const VERSION = '1.2.0';

const $ = id => document.getElementById(id);

export const elements = {
    plateau: $('plateau'),
    damier: $('damier'),
    pieces: $('pieces'),
    annonce: $('annonce'),
    campBlancs: $('camp-blancs'),
    campNoirs: $('camp-noirs'),
    nomBlancs: $('nom-blancs'),
    nomNoirs: $('nom-noirs'),
    resteBlancs: $('reste-blancs'),
    resteNoirs: $('reste-noirs'),
    boutonAnnuler: $('bouton-annuler'),
    boutonNouvelle: $('bouton-nouvelle'),
    boutonMode: $('bouton-mode'),
    boutonReglages: $('bouton-reglages'),
    boutonAide: $('bouton-aide'),
    dialogueFin: $('dialogue-fin'),
    finTitre: $('fin-titre'),
    finDetail: $('fin-detail'),
    finAnnuler: $('fin-annuler'),
    finFermer: $('fin-fermer'),
    finRejouer: $('fin-rejouer'),
    dialogueReglages: $('dialogue-reglages'),
    segmentsVariante: $('segments-variante'),
    explicationVariante: $('explication-variante'),
    reglesMaison: $('regles-maison'),
    avisRegles: $('avis-regles'),
    reglesOfficielles: $('regles-officielles'),
    blocOrdinateur: $('bloc-ordinateur'),
    segmentsAdversaire: $('segments-adversaire'),
    segmentsNiveau: $('segments-niveau'),
    explicationNiveau: $('explication-niveau'),
    segmentsCamp: $('segments-camp'),
    explicationCamp: $('explication-camp'),
    segmentsMode: $('segments-mode'),
    pastillesPalette: $('pastilles-palette'),
    optionIndices: $('option-indices'),
    optionNumeros: $('option-numeros'),
    optionVibration: $('option-vibration'),
    stats: $('stats'),
    version: $('version'),
    effacerStats: $('effacer-stats'),
    dialogueAide: $('dialogue-aide'),
    aideTitre: $('aide-titre')
};

const ADVERSAIRES = [
    { id: 'ordinateur', libelle: 'Ordinateur' },
    { id: 'humain', libelle: 'Deux joueurs' }
];

const CAMPS = [
    { id: 'blancs', libelle: 'Blancs' },
    { id: 'noirs', libelle: 'Noirs' }
];

// Les segments sont construits en JavaScript : niveaux, modes et palettes
// vivent deja dans les modules, les recopier dans le HTML serait la premiere
// chose a se desynchroniser.
function remplirSegments(groupe, entrees, cle, surChoix, decorer) {
    groupe.replaceChildren(...entrees.map(entree => {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'segment';
        bouton.dataset[cle] = entree.id;
        bouton.textContent = entree.libelle;
        decorer?.(bouton, entree);
        bouton.addEventListener('click', () => surChoix(entree.id));
        return bouton;
    }));
}

// Un interrupteur par regle levable. Ils sont construits, pas ecrits dans la
// page : la liste vit dans variantes.js, et une regle ajoutee la-bas doit
// apparaitre ici sans qu'on y pense.
function construireRegles(surRegle) {
    elements.reglesMaison.replaceChildren(...REGLES_OPTIONNELLES.map(regle => {
        const etiquette = document.createElement('label');
        etiquette.className = 'option';

        const boite = document.createElement('input');
        boite.type = 'checkbox';
        boite.dataset.regle = regle.id;
        boite.addEventListener('change', () => surRegle(regle.id, boite.checked));

        const texte = document.createElement('span');
        const titre = document.createElement('strong');
        titre.textContent = regle.libelle;
        const detail = document.createElement('small');
        detail.textContent = regle.detail;
        texte.append(titre, detail);

        etiquette.append(boite, texte);
        return etiquette;
    }));
}

export function construireReglages(actions) {
    remplirSegments(elements.segmentsVariante, VARIANTES, 'variante', actions.surVariante,
        (bouton, variante) => { bouton.innerHTML = `${variante.libelle}<small>${variante.court}</small>`; });
    construireRegles(actions.surRegle);
    remplirSegments(elements.segmentsAdversaire, ADVERSAIRES, 'adversaire', actions.surAdversaire);
    remplirSegments(elements.segmentsNiveau, NIVEAUX, 'niveau', actions.surNiveau);
    remplirSegments(elements.segmentsCamp, CAMPS, 'camp', actions.surCamp);
    remplirSegments(elements.segmentsMode, MODES, 'mode', actions.surMode);

    // Les palettes se choisissent a l'oeil : une pastille de la couleur du
    // damier dit tout ce qu'une liste de noms ne dirait pas.
    elements.pastillesPalette.replaceChildren(...PALETTES.map(palette => {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'pastille';
        bouton.dataset.palette = palette.id;
        bouton.title = palette.libelle;
        bouton.setAttribute('aria-label', `Couleurs ${palette.libelle}`);
        bouton.style.setProperty('--apercu-clair', palette.claire);
        bouton.style.setProperty('--apercu-sombre', palette.sombre);
        bouton.addEventListener('click', () => actions.surPalette(palette.id));
        return bouton;
    }));

    elements.version.textContent = `Dames ${VERSION}`;
}

const marquer = (groupe, cle, valeur) => {
    for (const bouton of groupe.children) bouton.classList.toggle('actif', bouton.dataset[cle] === valeur);
};

export function majReglages(preferences) {
    const variante = varianteDe(preferences.variante);
    marquer(elements.segmentsVariante, 'variante', variante.id);
    elements.explicationVariante.textContent = variante.resume;

    // L'aide raconte le jeu qu'on joue, pas les deux : deux pages de regles
    // dont une ne s'applique pas, c'est une page de trop.
    elements.aideTitre.textContent = `Les dames ${variante.libelle.toLowerCase()}`;
    for (const bloc of elements.dialogueAide.querySelectorAll('[data-variante]')) {
        bloc.hidden = bloc.dataset.variante !== variante.id;
    }

    // Chaque interrupteur part de la regle officielle du jeu choisi : la prise
    // majoritaire est cochee aux internationales et decochee aux anglaises, et
    // c'est dans les deux cas la regle du livre.
    for (const boite of elements.reglesMaison.querySelectorAll('input[data-regle]')) {
        boite.checked = valeurRegle(variante.id, preferences.regles, boite.dataset.regle);
    }
    elements.avisRegles.hidden = !maisonDe(variante.id, preferences.regles);

    marquer(elements.segmentsAdversaire, 'adversaire', preferences.adversaire);
    marquer(elements.segmentsNiveau, 'niveau', preferences.niveau);
    elements.explicationNiveau.textContent = niveauDe(preferences.niveau).resume;
    marquer(elements.segmentsCamp, 'camp', preferences.camp);
    marquer(elements.segmentsMode, 'mode', preferences.mode);
    marquer(elements.pastillesPalette, 'palette', preferences.palette);

    // Qui ouvre depend du jeu : les blancs aux internationales, les noirs aux
    // anglaises. Choisir son camp, c'est donc aussi choisir de jouer en premier
    // ou en second, et il vaut mieux le dire.
    elements.explicationCamp.textContent =
        `Les ${variante.premier === BLANC ? 'blancs' : 'noirs'} ouvrent la partie. `
        + 'Changer de camp, de niveau, de jeu ou de règles relance une partie.';

    elements.blocOrdinateur.hidden = preferences.adversaire !== 'ordinateur';
    elements.optionIndices.checked = preferences.indices;
    elements.optionNumeros.checked = preferences.numeros;
    elements.optionVibration.checked = preferences.vibration;

    document.body.classList.toggle('avec-numeros', preferences.numeros);
    elements.boutonMode.setAttribute('aria-label',
        modeEffectif(preferences.mode) === 'sombre' ? 'Passer au thème clair' : 'Passer au thème sombre');
}

// Qui joue, et avec combien de pieces. Les noms changent selon l'adversaire :
// « Vous » n'a de sens que face a l'ordinateur.
export function majPendules(bilan, trait, preferences, occupe) {
    elements.resteBlancs.textContent = String(bilan.blancs);
    elements.resteNoirs.textContent = String(bilan.noirs);

    const solo = preferences.adversaire === 'ordinateur';
    const joueurEnBlanc = preferences.camp === 'blancs';
    elements.nomBlancs.textContent = solo ? (joueurEnBlanc ? 'Vous' : 'Ordinateur') : 'Blancs';
    elements.nomNoirs.textContent = solo ? (joueurEnBlanc ? 'Ordinateur' : 'Vous') : 'Noirs';

    elements.campBlancs.classList.toggle('actif', trait === BLANC);
    elements.campNoirs.classList.toggle('actif', trait === NOIR);
    elements.campBlancs.classList.toggle('reflechit', occupe && trait === BLANC);
    elements.campNoirs.classList.toggle('reflechit', occupe && trait === NOIR);
}

// Le tableau ne montre que la variante en cours : huit lignes dont quatre sans
// rapport avec la partie qu'on vient de jouer, personne ne les lirait.
export function majStats(stats, preferences) {
    const variante = preferences.variante ?? 'international';
    const maison = maisonDe(variante, preferences.regles);
    const lignes = [
        ...NIVEAUX.map(niveau => [`Ordinateur · ${niveau.libelle.toLowerCase()}`, `${variante}.ordinateur.${niveau.id}`]),
        ['Deux joueurs', `${variante}.humain`]
    ];

    const contenu = [];
    for (const [libelle, cle] of lignes) {
        const ligne = statsDe(stats, cle);
        const parties = ligne.victoires + ligne.defaites + ligne.nulles;
        const humaine = cle.endsWith('.humain');
        const terme = document.createElement('dt');
        terme.textContent = libelle;
        const valeur = document.createElement('dd');
        valeur.textContent = !parties ? '—'
            : humaine
                ? `${ligne.victoires} blancs · ${ligne.defaites} noirs · ${ligne.nulles} nulles`
                : `${ligne.victoires} V · ${ligne.defaites} D · ${ligne.nulles} N`;
        // La ligne en cours n'est mise en avant que si la partie s'y range :
        // aux regles maison, aucune ne l'attend.
        if (!maison && cle === cleStats(preferences)) {
            terme.classList.add('courante');
            valeur.classList.add('courante');
        }
        contenu.push(terme, valeur);
    }
    elements.stats.replaceChildren(...contenu);
}

export function annoncer(texte) {
    elements.annonce.textContent = texte;
}

// Un dialogue s'ouvre sur son titre : sans ce retour en haut, le navigateur
// met la mise au point sur le premier bouton et fait defiler une aide de deux
// ecrans jusqu'a son pied.
export const ouvrir = dialogue => {
    if (!dialogue.open) dialogue.showModal();
    dialogue.scrollTop = 0;
};
export const fermer = dialogue => { if (dialogue.open) dialogue.close(); };

// Les boutons marques `data-fermer` referment le dialogue qui les contient,
// sans qu'aucun d'eux ait besoin de son propre gestionnaire.
export function brancherFermetures() {
    for (const bouton of document.querySelectorAll('[data-fermer]')) {
        bouton.addEventListener('click', () => fermer(bouton.closest('dialog')));
    }
}
