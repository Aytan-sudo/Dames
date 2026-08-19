// Les regles des dames internationales.
//
// Trois choses distinguent ce jeu du damier anglais, et les trois sont ici :
//   — le pion prend aussi en arriere, sans jamais reculer autrement ;
//   — la dame est volante : elle glisse sur toute la diagonale, prend de loin
//     et se pose ou elle veut derriere la piece mangee ;
//   — la prise est obligatoire et majoritaire : parmi toutes les rafles
//     possibles, seules celles qui prennent le plus de pieces sont legales.
//
// La derniere regle est celle qui fait le jeu. Elle transforme chaque coup
// adverse en question — « et si je lui donne un pion ici, que se passe-t-il
// ensuite ? » — parce que l'adversaire n'a plus le choix de refuser.
//
// Le coup turc, aussi : les pieces mangees restent sur le damier jusqu'a la
// fin de la rafle. Elles bloquent le passage, et on ne repasse jamais dessus.
//
// Rien dans ce fichier ne connait le DOM. Tout se teste en Node.

import { CASES, DIRECTIONS, VOISIN, DIAGONALE, AVANT_BLANC, AVANT_NOIR, PROMOTION_BLANC, PROMOTION_NOIR } from './damier.js';

export const BLANC = 1;
export const NOIR = -1;

export const PION = 1;
export const DAME = 2;

export const campDe = piece => (piece > 0 ? BLANC : piece < 0 ? NOIR : 0);
export const estDame = piece => piece === DAME || piece === -DAME;
export const adverse = camp => -camp;

export const nomCamp = camp => (camp === BLANC ? 'blancs' : 'noirs');

// La position : 50 cases numerotees a partir de 1, plus le camp au trait.
// L'index 0 ne sert pas — le numero de case sert d'index, sans decalage a
// retenir dans chaque boucle.
export function positionInitiale() {
    const cases = new Int8Array(CASES + 1);
    for (let numero = 1; numero <= 20; numero++) cases[numero] = -PION;
    for (let numero = 31; numero <= 50; numero++) cases[numero] = PION;
    return { cases, trait: BLANC };
}

export const copier = position => ({ cases: Int8Array.from(position.cases), trait: position.trait });

export function compter(position) {
    const bilan = { pionsBlancs: 0, damesBlanches: 0, pionsNoirs: 0, damesNoires: 0 };
    for (let numero = 1; numero <= CASES; numero++) {
        const piece = position.cases[numero];
        if (piece === PION) bilan.pionsBlancs++;
        else if (piece === DAME) bilan.damesBlanches++;
        else if (piece === -PION) bilan.pionsNoirs++;
        else if (piece === -DAME) bilan.damesNoires++;
    }
    bilan.blancs = bilan.pionsBlancs + bilan.damesBlanches;
    bilan.noirs = bilan.pionsNoirs + bilan.damesNoires;
    return bilan;
}

// Un coup : d'ou, vers ou, ce qu'il mange, et par ou il passe. Le chemin sert
// a l'animation et a la saisie pas a pas — sans lui, deux rafles differentes
// qui partent et arrivent aux memes cases seraient impossibles a departager.
const creerCoup = (de, chemin, prises) => ({
    de,
    vers: chemin[chemin.length - 1],
    chemin: [...chemin],
    prises: [...prises]
});

// --- Rafles ---------------------------------------------------------------
//
// L'exploration travaille sur une copie ou la piece mobile a deja quitte sa
// case : une dame doit pouvoir repasser par son point de depart, et c'est le
// genre de coup qu'on ne voit qu'en tournoi, jamais dans un moteur ecrit vite.

function explorerPion(cases, camp, depart, courante, prises, chemin, sortie) {
    let poursuivie = false;

    for (const direction of DIRECTIONS) {
        const mangee = VOISIN[courante][direction];
        if (!mangee) continue;
        const cible = cases[mangee];
        if (cible === 0 || campDe(cible) === camp || prises.includes(mangee)) continue;

        const arrivee = VOISIN[mangee][direction];
        if (!arrivee || cases[arrivee] !== 0) continue;

        poursuivie = true;
        prises.push(mangee);
        chemin.push(arrivee);
        explorerPion(cases, camp, depart, arrivee, prises, chemin, sortie);
        chemin.pop();
        prises.pop();
    }

    if (!poursuivie && prises.length) sortie.push(creerCoup(depart, chemin, prises));
}

function explorerDame(cases, camp, depart, courante, prises, chemin, sortie) {
    let poursuivie = false;

    for (const direction of DIRECTIONS) {
        const ligne = DIAGONALE[courante][direction];

        let index = 0;
        while (index < ligne.length && cases[ligne[index]] === 0) index++;
        if (index >= ligne.length) continue;

        const mangee = ligne[index];
        const cible = cases[mangee];
        // Piece a soi, ou piece deja mangee dans cette rafle : la diagonale est
        // fermee. C'est tout le coup turc — la prise n'est retiree du damier
        // qu'une fois la rafle finie, et elle barre la route en attendant.
        if (campDe(cible) === camp || prises.includes(mangee)) continue;

        for (let suivant = index + 1; suivant < ligne.length && cases[ligne[suivant]] === 0; suivant++) {
            const arrivee = ligne[suivant];
            poursuivie = true;
            prises.push(mangee);
            chemin.push(arrivee);
            explorerDame(cases, camp, depart, arrivee, prises, chemin, sortie);
            chemin.pop();
            prises.pop();
        }
    }

    if (!poursuivie && prises.length) sortie.push(creerCoup(depart, chemin, prises));
}

function raflesDepuis(position, depart) {
    const piece = position.cases[depart];
    if (!piece) return [];

    const camp = campDe(piece);
    const cases = Int8Array.from(position.cases);
    cases[depart] = 0;                       // la case de depart se libere aussitot

    const sortie = [];
    if (estDame(piece)) explorerDame(cases, camp, depart, depart, [], [], sortie);
    else explorerPion(cases, camp, depart, depart, [], [], sortie);
    return sortie;
}

function deplacementsDepuis(position, depart) {
    const piece = position.cases[depart];
    if (!piece) return [];
    const camp = campDe(piece);
    const coups = [];

    if (estDame(piece)) {
        for (const direction of DIRECTIONS) {
            for (const arrivee of DIAGONALE[depart][direction]) {
                if (position.cases[arrivee] !== 0) break;
                coups.push(creerCoup(depart, [arrivee], []));
            }
        }
        return coups;
    }

    for (const direction of camp === BLANC ? AVANT_BLANC : AVANT_NOIR) {
        const arrivee = VOISIN[depart][direction];
        if (arrivee && position.cases[arrivee] === 0) coups.push(creerCoup(depart, [arrivee], []));
    }
    return coups;
}

// Les coups legaux du camp au trait. S'il existe une prise, elle est
// obligatoire, et seules les plus longues comptent.
export function coupsLegaux(position) {
    const camp = position.trait;
    const rafles = [];
    let maximum = 0;

    for (let numero = 1; numero <= CASES; numero++) {
        if (campDe(position.cases[numero]) !== camp) continue;
        for (const coup of raflesDepuis(position, numero)) {
            if (coup.prises.length > maximum) {
                maximum = coup.prises.length;
                rafles.length = 0;
            }
            if (coup.prises.length === maximum) rafles.push(coup);
        }
    }

    if (maximum > 0) return rafles;

    const simples = [];
    for (let numero = 1; numero <= CASES; numero++) {
        if (campDe(position.cases[numero]) !== camp) continue;
        simples.push(...deplacementsDepuis(position, numero));
    }
    return simples;
}

// Le nombre de prises impose. L'interface s'en sert pour expliquer pourquoi
// un coup pourtant valide est refuse.
export const prisesObligatoires = position => {
    const coups = coupsLegaux(position);
    return coups.length ? coups[0].prises.length : 0;
};

export const promeut = (piece, arrivee) =>
    piece === PION ? PROMOTION_BLANC.has(arrivee)
        : piece === -PION ? PROMOTION_NOIR.has(arrivee)
            : false;

export function appliquer(position, coup) {
    const cases = Int8Array.from(position.cases);
    const piece = cases[coup.de];

    cases[coup.de] = 0;
    for (const prise of coup.prises) cases[prise] = 0;

    // La promotion ne se declenche qu'a l'arrivee. Un pion qui ne fait que
    // traverser la rangee adverse au milieu d'une rafle reste un pion — sinon
    // il finirait la rafle en dame, avec des prises qu'il n'avait pas le droit
    // de faire.
    cases[coup.vers] = promeut(piece, coup.vers) ? piece * DAME : piece;

    return { cases, trait: adverse(position.trait) };
}

// Perdu : plus de pieces, ou plus un seul coup. Les deux se valent aux dames,
// et c'est ce qui rend l'enfermement gagnant.
export const estBloque = position => coupsLegaux(position).length === 0;

export function gagnant(position) {
    return estBloque(position) ? adverse(position.trait) : 0;
}

// Notation officielle : « 32-28 » pour un deplacement, « 32x23 » pour une
// prise. Le chemin complet ne s'ecrit pas — la case d'arrivee suffit a
// retrouver la rafle, et les revues l'ecrivent ainsi.
export const noterCoup = coup => `${coup.de}${coup.prises.length ? 'x' : '-'}${coup.vers}`;

// Deux positions identiques au trait pres ne sont pas la meme position : la
// repetition ne compte que si c'est au meme joueur de jouer.
export function clef(position) {
    let texte = position.trait === BLANC ? 'b' : 'n';
    for (let numero = 1; numero <= CASES; numero++) texte += position.cases[numero] + 2;
    return texte;
}

export const memeCoup = (a, b) =>
    a.de === b.de && a.vers === b.vers
    && a.chemin.length === b.chemin.length
    && a.chemin.every((etape, index) => etape === b.chemin[index]);
