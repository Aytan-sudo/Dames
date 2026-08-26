// L'assemblage : une partie, un damier, un adversaire.
//
// Le fil est toujours le meme — le joueur designe un coup, le modele le
// valide, le rendu le montre, l'ordinateur repond. Aucune regle du jeu ne vit
// ici ; app.js ne fait que decider quand chaque module parle.

import { BLANC, NOIR, campDe, estDame, nomCamp, prisesObligatoires } from './regles.js';
import * as P from './partie.js';
import { departs, suites, prisesEnCours, avancer } from './selection.js';
import { creerRendu } from './rendu.js';
import { geometrieDe, maisonDe } from './variantes.js';
import { ecouterDamier, ecouterClavier } from './entree.js';
import { choisirCoup } from './ia.js';
import { appliquer as appliquerTheme, modeSuivant } from './themes.js';
import {
    preparerSon, surveillerVisibilite,
    sonPose, sonPrise, sonCouronnement, sonRefus, sonVictoire, sonDefaite, sonNulle
} from './son.js';
import {
    chargerPreferences, enregistrerPreferences,
    chargerStats, cleStats, enregistrerFin, effacerStats,
    chargerPartie, enregistrerPartie, oublierPartie
} from './storage.js';
import * as ui from './ui.js';

let preferences = chargerPreferences();
let stats = chargerStats();
let partie = P.creerPartie();
let selection = { depart: 0, etapes: [] };
let occupe = false;            // une animation ou l'ordinateur est en cours

const rendu = creerRendu({
    plateau: ui.elements.plateau,
    damier: ui.elements.damier,
    couche: ui.elements.pieces
});

const soloEnCours = () => preferences.adversaire === 'ordinateur';

// Les entorses aux regles officielles, telles que les reglages les demandent.
// Elles sont posees sur la position au moment ou la partie commence : une
// partie garde ainsi ses regles jusqu'au bout, meme si on touche aux reglages
// pendant qu'elle dure.
const reglesMaison = () => maisonDe(preferences.variante, preferences.regles);
const campDuJoueur = () => (preferences.camp === 'blancs' ? BLANC : NOIR);
const auJoueur = () => !soloEnCours() || P.trait(partie) === campDuJoueur();

const vibrer = motif => {
    if (preferences.vibration && navigator.vibrate) navigator.vibrate(motif);
};

const sonner = son => { if (preferences.sons) son(); };

// Un refus se voit et s'entend : la piece tressaille, une note retombe. Sans
// l'un ou l'autre, le joueur croit que l'appui n'a pas ete pris et recommence.
const refuser = numero => { rendu.refuser(numero); sonner(sonRefus); };

const ranger = () => enregistrerPartie({
    ...P.serialiser(partie),
    adversaire: preferences.adversaire,
    niveau: preferences.niveau,
    camp: preferences.camp
});

// --- Affichage ------------------------------------------------------------

function rafraichir() {
    const coups = P.coupsLegaux(partie);
    const jouables = auJoueur() && !partie.resultat && !occupe;

    rendu.marquer({
        departs: jouables && preferences.indices && !selection.depart ? [...departs(coups)] : [],
        cibles: jouables && selection.depart ? [...suites(coups, selection.depart, selection.etapes)] : [],
        tenue: selection.depart,
        dernier: P.dernierCoup(partie),
        prises: selection.depart ? prisesEnCours(coups, selection.depart, selection.etapes) : []
    });

    ui.majPendules(P.bilan(partie), P.trait(partie), preferences, occupe && !auJoueur());
    ui.elements.boutonAnnuler.disabled = occupe || partie.historique.length === 0;
}

function raconterLeTour() {
    if (partie.resultat) return;
    if (occupe && !auJoueur()) { ui.annoncer('L\'ordinateur réfléchit…'); return; }

    const prises = prisesObligatoires(partie.position);
    const camp = nomCamp(P.trait(partie));

    if (prises > 1) ui.annoncer(`Aux ${camp} — rafle obligatoire de ${prises} pièces.`);
    else if (prises === 1) ui.annoncer(`Aux ${camp} — prise obligatoire.`);
    else ui.annoncer(`Aux ${camp} de jouer.`);
}

// --- Deroulement ----------------------------------------------------------

function nouvellePartie() {
    partie = P.creerPartie(preferences.variante, reglesMaison());
    selection = { depart: 0, etapes: [] };
    occupe = false;
    rendu.poser(geometrieDe(preferences.variante));
    rendu.dessiner(partie.position);
    rafraichir();
    raconterLeTour();
    ui.fermer(ui.elements.dialogueFin);
    ranger();
    if (!auJoueur()) tourOrdinateur();
}

async function jouerCoup(coup) {
    selection = { depart: 0, etapes: [] };
    occupe = true;
    rafraichir();

    // Releve avant de jouer : c'est la seule facon de savoir si la piece
    // *devient* dame, plutot que d'en etre deja une.
    const etaitDame = estDame(partie.position.cases[coup.de]);

    if (!P.jouer(partie, coup)) { occupe = false; rafraichir(); return; }
    if (coup.prises.length) vibrer(coup.prises.length > 1 ? [12, 40, 12] : 12);

    // Les notes se calent sur l'animation : une par saut, comme les pieces
    // qu'on voit partir. Le couronnement attend la derniere case — aux
    // internationales, un pion qui traverse la rangee adverse au milieu d'une
    // rafle reste pion, et l'entendre sacrer trop tot serait un mensonge.
    const saut = rendu.dureeSaut() / 1000;
    if (coup.prises.length) sonner(() => sonPrise(coup.prises.length, saut));
    else sonner(sonPose);
    if (!etaitDame && estDame(partie.position.cases[coup.vers])) {
        sonner(() => sonCouronnement(coup.chemin.length * saut));
    }

    await rendu.jouer(partie.position, coup);

    occupe = false;
    rafraichir();
    ranger();

    if (partie.resultat) { conclure(); return; }
    raconterLeTour();
    if (!auJoueur()) tourOrdinateur();
}

// Laisse le navigateur peindre avant qu'on lui prenne le fil. Deux images
// suffisent — mais un onglet passe en arriere-plan n'en peint aucune, et la
// partie resterait figee sur « réfléchit… » : d'ou le delai de secours, qui
// resout la meme promesse si les images ne viennent pas.
const laisserPeindre = () => new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    }
    setTimeout(resolve, 150);
});

// L'ordinateur reflechit sur le fil principal. Un worker serait plus propre,
// mais il faudrait le charger, le mettre en cache hors ligne et le tenir a
// jour — beaucoup de machinerie pour une seconde et demie au pire.
async function tourOrdinateur() {
    if (partie.resultat) return;
    occupe = true;
    rafraichir();
    raconterLeTour();

    await laisserPeindre();

    const reflexion = choisirCoup(partie.position, preferences.niveau);
    occupe = false;
    if (!reflexion || partie.resultat) { rafraichir(); return; }
    jouerCoup(reflexion.coup);
}

// La partie n'est comptee qu'une fois : annuler le coup fatal puis reperdre
// ne doit pas ajouter deux defaites au tableau.
function conclure() {
    const { gagnant } = partie.resultat;

    // Les regles maison ne se comptent pas : un tableau ou toutes les victoires
    // n'ont pas ete gagnees aux memes regles ne veut plus rien dire.
    if (!partie.enregistree && P.estOfficielle(partie)) {
        partie.enregistree = true;
        // A deux sur le meme ecran, « victoire » se lit du cote des blancs :
        // c'est la seule convention qui garde un tableau lisible.
        const vainqueur = soloEnCours() ? campDuJoueur() : BLANC;
        const issue = gagnant === 0 ? 'nulle' : gagnant === vainqueur ? 'victoire' : 'defaite';
        enregistrerFin(cleStats(preferences), issue);
        stats = chargerStats();
    }

    vibrer(gagnant === 0 ? [18, 60, 18] : [24, 60, 24, 60, 24]);
    // A deux sur le meme ecran, personne n'a « perdu » du point de vue de la
    // page : les deux joueurs sont devant. La fanfare y salue donc les deux
    // camps, et seul le solo connait la defaite.
    if (gagnant === 0) sonner(sonNulle);
    else if (soloEnCours() && gagnant !== campDuJoueur()) sonner(sonDefaite);
    else sonner(sonVictoire);
    afficherFin();
    ranger();
}

const RAISONS = {
    [P.MOTIFS.blocage]: 'plus un seul coup possible',
    [P.MOTIFS.repetition]: 'trois fois la même position',
    [P.MOTIFS.steriles]: 'vingt-cinq coups de dames sans prise',
    [P.MOTIFS.finale]: 'une finale qui ne mène plus nulle part',
    [P.MOTIFS.abandon]: 'abandon'
};

function afficherFin() {
    const { gagnant, motif } = partie.resultat;
    const bilan = P.bilan(partie);

    if (gagnant === 0) {
        ui.elements.finTitre.textContent = 'Partie nulle';
    } else if (soloEnCours()) {
        ui.elements.finTitre.textContent = gagnant === campDuJoueur() ? 'Gagné' : 'Perdu';
    } else {
        ui.elements.finTitre.textContent = `Les ${nomCamp(gagnant)} gagnent`;
    }

    ui.elements.finDetail.textContent =
        `${RAISONS[motif]} · ${partie.historique.length} coups · ${bilan.blancs} pièces blanches contre ${bilan.noirs} noires`
        + (P.estOfficielle(partie) ? '' : ' · règles maison, partie non comptée');
    ui.elements.finAnnuler.hidden = partie.historique.length === 0;
    ui.annoncer(`${ui.elements.finTitre.textContent}. ${RAISONS[motif]}.`);
    ui.ouvrir(ui.elements.dialogueFin);
}

// --- Saisie ---------------------------------------------------------------

function surCase(numero) {
    if (occupe || partie.resultat) return;
    if (!auJoueur()) { refuser(numero); return; }

    const coups = P.coupsLegaux(partie);
    const possibles = departs(coups);

    if (selection.depart) {
        const suite = avancer(coups, selection.depart, selection.etapes, numero);
        if (suite.coup) { jouerCoup(suite.coup); return; }
        if (suite.etapes) {
            selection = { depart: selection.depart, etapes: suite.etapes };
            rafraichir();
            return;
        }
        // Touche a cote : on repose la piece plutot que d'ignorer l'appui, sauf
        // si la case designe une autre piece jouable — la, on change d'avis.
        if (numero !== selection.depart && possibles.has(numero) && selection.etapes.length === 0) {
            selection = { depart: numero, etapes: [] };
            rafraichir();
            return;
        }
        if (selection.etapes.length) { refuser(numero); return; }
        selection = { depart: 0, etapes: [] };
        rafraichir();
        return;
    }

    if (possibles.has(numero)) {
        selection = { depart: numero, etapes: [] };
        rafraichir();
        return;
    }

    // Une piece a soi qui ne peut pas jouer : c'est presque toujours la prise
    // obligatoire ailleurs sur le damier. Le dire evite de croire a une panne.
    const piece = partie.position.cases[numero];
    if (piece && campDe(piece) === P.trait(partie)) {
        refuser(numero);
        const prises = prisesObligatoires(partie.position);
        if (prises) ui.annoncer(`La prise est obligatoire : ${prises} pièce${prises > 1 ? 's' : ''} à manger ailleurs.`);
        else ui.annoncer('Cette pièce ne peut pas bouger.');
    }
}

function annulerCoup() {
    if (occupe || !partie.historique.length) return;

    P.annuler(partie);
    // Contre l'ordinateur, rendre la main sans annuler sa reponse ne servirait
    // a rien : on remonte jusqu'au coup du joueur.
    while (soloEnCours() && partie.historique.length && P.trait(partie) !== campDuJoueur()) {
        P.annuler(partie);
    }

    partie.enregistree = false;
    selection = { depart: 0, etapes: [] };
    rendu.dessiner(partie.position);
    rafraichir();
    raconterLeTour();
    ui.fermer(ui.elements.dialogueFin);
    ranger();
}

// --- Reglages -------------------------------------------------------------

function changer(modifications, relancer = false) {
    preferences = { ...preferences, ...modifications };
    enregistrerPreferences(preferences);
    ui.majReglages(preferences);
    ui.majStats(stats, preferences);
    if (relancer) nouvellePartie();
    else { rafraichir(); raconterLeTour(); }
}

function brancher() {
    ui.construireReglages({
        surVariante: variante => changer({ variante }, true),
        surAdversaire: adversaire => changer({ adversaire }, true),
        surNiveau: niveau => changer({ niveau }, true),
        surRegle: (id, valeur) => changer({ regles: { ...preferences.regles, [id]: valeur } }, true),
        surCamp: camp => changer({ camp }, true),
        surMode: mode => { changer({ mode }); appliquerTheme(preferences); },
        surPalette: palette => { changer({ palette }); appliquerTheme(preferences); }
    });
    ui.brancherFermetures();

    ecouterDamier(ui.elements.damier, surCase);
    ecouterClavier({
        n: () => nouvellePartie(),
        u: annulerCoup,
        annuler: annulerCoup,
        t: () => { changer({ mode: modeSuivant(preferences.mode) }); appliquerTheme(preferences); },
        // `R` relance la partie, comme partout ailleurs dans la collection.
        // Il ouvrait les reglages jusqu'ici : la lettre est trop attendue en
        // « relancer » pour qu'on la laisse ailleurs, et les options prennent
        // leur propre initiale.
        r: () => nouvellePartie(),
        o: () => ouvrirReglages(),
        s: () => basculerSon(),
        '?': () => ui.ouvrir(ui.elements.dialogueAide),
        escape: () => { selection = { depart: 0, etapes: [] }; rafraichir(); }
    });

    ui.elements.boutonNouvelle.addEventListener('click', () => nouvellePartie());
    ui.elements.boutonAnnuler.addEventListener('click', annulerCoup);
    ui.elements.boutonAide.addEventListener('click', () => ui.ouvrir(ui.elements.dialogueAide));
    ui.elements.boutonReglages.addEventListener('click', ouvrirReglages);
    ui.elements.boutonSon.addEventListener('click', basculerSon);
    ui.elements.boutonMode.addEventListener('click', () => {
        changer({ mode: modeSuivant(preferences.mode) });
        appliquerTheme(preferences);
    });

    ui.elements.finRejouer.addEventListener('click', () => nouvellePartie());
    ui.elements.finAnnuler.addEventListener('click', annulerCoup);
    ui.elements.finFermer.addEventListener('click', () => ui.fermer(ui.elements.dialogueFin));

    ui.elements.optionIndices.addEventListener('change', evenement =>
        changer({ indices: evenement.target.checked }));
    ui.elements.optionNumeros.addEventListener('change', evenement =>
        changer({ numeros: evenement.target.checked }));
    ui.elements.optionSons.addEventListener('change', evenement =>
        changer({ sons: evenement.target.checked }));
    ui.elements.optionVibration.addEventListener('change', evenement =>
        changer({ vibration: evenement.target.checked }));

    ui.elements.reglesOfficielles.addEventListener('click', () => changer({ regles: {} }, true));

    ui.elements.effacerStats.addEventListener('click', () => {
        effacerStats();
        stats = chargerStats();
        ui.majStats(stats, preferences);
    });

    // Le systeme peut basculer en sombre pendant la partie ; tant que le
    // joueur n'a rien choisi, la page suit.
    if (typeof matchMedia === 'function') {
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (preferences.mode === 'auto') { appliquerTheme(preferences); ui.majReglages(preferences); }
        });
    }
}

// Le bouton du bandeau et la case des Options touchent au meme reglage :
// `changer` repasse par `majReglages`, qui remet les deux d'accord.
function basculerSon() {
    changer({ sons: !preferences.sons });
    if (preferences.sons) sonner(sonPose);   // pour entendre ce qu'on vient de rallumer
}

function ouvrirReglages() {
    ui.majStats(stats, preferences);
    ui.ouvrir(ui.elements.dialogueReglages);
}

function reprendre() {
    const sauvegarde = chargerPartie();
    if (!sauvegarde) return false;

    // Une partie commencee contre l'ordinateur en blancs n'a plus de sens si
    // les reglages ont change depuis : on la laisse tomber plutot que de la
    // reprendre avec un adversaire qui n'est pas le sien. Les regles surtout —
    // une partie reprise avec d'autres regles que celles ou elle a commence
    // serait rejouee coup par coup et refusee au premier coup devenu illegal.
    if (sauvegarde.variante !== preferences.variante
        || sauvegarde.adversaire !== preferences.adversaire
        || JSON.stringify(sauvegarde.maison ?? null) !== JSON.stringify(reglesMaison())
        || (sauvegarde.adversaire === 'ordinateur'
            && (sauvegarde.niveau !== preferences.niveau || sauvegarde.camp !== preferences.camp))) {
        return false;
    }

    const reprise = P.relire(sauvegarde);
    if (!reprise) return false;

    partie = reprise;
    rendu.poser(geometrieDe(partie.position.variante));
    rendu.dessiner(partie.position);
    rafraichir();
    if (partie.resultat) { partie.enregistree = true; afficherFin(); }
    else { raconterLeTour(); if (!auJoueur()) tourOrdinateur(); }
    return true;
}

function demarrer() {
    appliquerTheme(preferences);
    brancher();

    // Le damier se joue sur `pointerdown`, qui est une activation : de ce
    // cote, Dames est sain. Mais qui prend les noirs voit l'ordinateur ouvrir
    // la partie, et ce tout premier son nait d'un `setTimeout`, pas d'un
    // geste — iOS refuserait de demarrer le contexte. On le prepare donc au
    // premier appui sur la page, quel qu'il soit.
    preparerSon(document, () => preferences.sons);
    surveillerVisibilite(document);
    ui.majReglages(preferences);
    ui.majStats(stats, preferences);

    if (!reprendre()) {
        oublierPartie();
        nouvellePartie();
    }

    if ('serviceWorker' in navigator) {
        addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ }));
    }
}

demarrer();
