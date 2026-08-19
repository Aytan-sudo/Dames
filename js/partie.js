// Ce qui dure d'un coup a l'autre : la position, l'historique, le resultat.
//
// La partie garde toutes les positions traversees. Cent copies de cinquante
// octets ne coutent rien, et c'est ce qui permet d'annuler sans jamais rejouer
// la partie depuis le debut — ni de se tromper en la rejouant.
//
// Les nulles des dames sont ecrites ici parce qu'elles sont une regle du jeu,
// pas un reglage : sans elles, deux dames se poursuivent indefiniment et la
// partie ne finit jamais.

import {
    BLANC, NOIR, DAME, positionInitiale, copier, coupsLegaux as coupsDeLaPosition,
    appliquer, campDe, estDame, clef, noterCoup, memeCoup, compter, adverse
} from './regles.js';

// Vingt-cinq coups de chaque camp sans qu'un pion bouge ni qu'une piece tombe.
// La regle officielle : au-dela, plus personne ne progresse.
export const DEMI_COUPS_STERILES = 50;

// Finales bloquees : contre une dame seule, trois pieces ont seize coups pour
// conclure, deux en ont cinq. Au-dela, la defense a tenu et c'est nul.
export const FINALE_LONGUE = 32;
export const FINALE_COURTE = 10;

export const MOTIFS = {
    blocage: 'blocage',
    repetition: 'repetition',
    steriles: 'steriles',
    finale: 'finale',
    abandon: 'abandon'
};

export function creerPartie() {
    const position = positionInitiale();
    return {
        position,
        debut: copier(position),
        historique: [],          // { position, coup, steriles, finale }
        resultat: null,
        enregistree: false,      // la fin a-t-elle deja ete comptee dans les statistiques
        steriles: 0,
        finale: 0,
        vues: new Map([[clef(position), 1]])
    };
}

export const coupsLegaux = partie => (partie.resultat ? [] : coupsDeLaPosition(partie.position));

export const trait = partie => partie.position.trait;

// Une finale qui ne peut plus rien produire : une dame seule contre deux ou
// trois pieces. C'est au camp en surnombre de conclure, et c'est donc son
// compteur qui tourne — la dame seule, elle, n'a qu'a tenir.
function pendule(position) {
    const bilan = compter(position);
    const enBlanc = bilan.blancs <= bilan.noirs;
    const seul = enBlanc
        ? { total: bilan.blancs, dames: bilan.damesBlanches }
        : { total: bilan.noirs, dames: bilan.damesNoires };
    const nombreux = enBlanc ? bilan.noirs : bilan.blancs;

    if (seul.total !== 1 || seul.dames !== 1) return 0;
    if (nombreux <= 2) return FINALE_COURTE;
    if (nombreux <= 3) return FINALE_LONGUE;
    return 0;
}

function conclure(partie) {
    if (coupsDeLaPosition(partie.position).length === 0) {
        return { gagnant: adverse(partie.position.trait), motif: MOTIFS.blocage };
    }
    if ((partie.vues.get(clef(partie.position)) ?? 0) >= 3) {
        return { gagnant: 0, motif: MOTIFS.repetition };
    }
    if (partie.steriles >= DEMI_COUPS_STERILES) {
        return { gagnant: 0, motif: MOTIFS.steriles };
    }
    const limite = pendule(partie.position);
    if (limite && partie.finale >= limite) {
        return { gagnant: 0, motif: MOTIFS.finale };
    }
    return null;
}

// Joue un coup et rend la partie modifiee, ou null si le coup n'est pas legal.
// Le refus n'est pas une erreur : l'interface propose parfois un coup que la
// prise obligatoire interdit, et c'est a elle de le dire au joueur.
export function jouer(partie, coup) {
    if (partie.resultat) return null;

    const legaux = coupsDeLaPosition(partie.position);
    const choisi = legaux.find(candidat => memeCoup(candidat, coup));
    if (!choisi) return null;

    partie.historique.push({
        position: copier(partie.position),
        coup: choisi,
        steriles: partie.steriles,
        finale: partie.finale
    });

    const piece = partie.position.cases[choisi.de];
    const sterile = estDame(piece) && choisi.prises.length === 0;
    partie.steriles = sterile ? partie.steriles + 1 : 0;
    partie.finale = pendule(partie.position) ? partie.finale + 1 : 0;

    partie.position = appliquer(partie.position, choisi);

    const empreinte = clef(partie.position);
    partie.vues.set(empreinte, (partie.vues.get(empreinte) ?? 0) + 1);

    partie.resultat = conclure(partie);
    return partie;
}

// Annule un demi-coup. Contre l'ordinateur, l'appelant en annule deux : rendre
// la main au joueur sans annuler la reponse adverse ne servirait a rien.
export function annuler(partie) {
    const dernier = partie.historique.pop();
    if (!dernier) return false;

    const empreinte = clef(partie.position);
    const vues = partie.vues.get(empreinte) ?? 0;
    if (vues <= 1) partie.vues.delete(empreinte);
    else partie.vues.set(empreinte, vues - 1);

    partie.position = dernier.position;
    partie.steriles = dernier.steriles;
    partie.finale = dernier.finale;
    partie.resultat = null;
    return true;
}

export const dernierCoup = partie =>
    partie.historique.length ? partie.historique[partie.historique.length - 1].coup : null;

export const notation = partie => partie.historique.map(entree => noterCoup(entree.coup));

export function abandonner(partie) {
    if (partie.resultat) return partie;
    partie.resultat = { gagnant: adverse(partie.position.trait), motif: MOTIFS.abandon };
    return partie;
}

export const bilan = partie => compter(partie.position);

// --- Sauvegarde -----------------------------------------------------------
//
// On enregistre les coups, pas les positions. Une partie relue est donc
// rejouee coup par coup et validee par les regles : une sauvegarde abimee ou
// venue d'une version aux regles differentes s'arrete au premier coup illegal
// au lieu de poser un damier impossible.

export const serialiser = partie => ({
    version: 1,
    coups: partie.historique.map(({ coup }) => [coup.de, coup.chemin, coup.prises]),
    resultat: partie.resultat
});

export function relire(donnees) {
    if (!donnees || donnees.version !== 1 || !Array.isArray(donnees.coups)) return null;

    const partie = creerPartie();
    for (const [de, chemin, prises] of donnees.coups) {
        const rejoue = jouer(partie, { de, vers: chemin[chemin.length - 1], chemin, prises });
        if (!rejoue) return null;
    }
    if (donnees.resultat?.motif === MOTIFS.abandon && !partie.resultat) {
        partie.resultat = donnees.resultat;
    }
    return partie;
}

export { BLANC, NOIR, DAME, campDe, estDame };
