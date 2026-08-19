// Les regles des dames — internationales et anglaises.
//
// Le moteur est le meme pour les deux jeux ; ce qui les separe est lu dans
// js/variantes.js, jamais ecrit en dur ici. Quatre differences suffisent a en
// faire deux jeux distincts :
//
//   — le pion international prend aussi en arriere, sans jamais reculer
//     autrement ; le pion anglais ne prend qu'en avant ;
//   — la dame internationale est volante : elle glisse sur toute la diagonale,
//     prend de loin et se pose ou elle veut derriere la piece mangee. La dame
//     anglaise ne fait qu'un pas, dans les quatre sens ;
//   — la prise est obligatoire des deux cotes, mais seule l'internationale
//     impose la plus longue. C'est cette regle-la qui fait le jeu : elle
//     transforme chaque coup en question — « et si je lui donne un pion ici ? »
//     — parce que l'adversaire n'a plus le choix de refuser ;
//   — aux anglaises, le pion qui atteint le fond est couronne et le coup
//     s'arrete la, meme s'il pouvait continuer a manger.
//
// Le coup turc vaut pour les deux : les pieces mangees restent sur le damier
// jusqu'a la fin de la rafle. Elles bloquent le passage, et on ne repasse
// jamais dessus.
//
// Ces quatre differences sont des drapeaux, pas des embranchements ecrits ici :
// le meme mecanisme sert donc aux regles maison, ou le joueur retourne l'un
// d'eux a la main. Une partie dont la prise n'est plus obligatoire n'emprunte
// aucun chemin special — elle lit juste un drapeau dans l'autre sens.
//
// Rien dans ce fichier ne connait le DOM. Tout se teste en Node.

import { DIRECTIONS, AVANT_BLANC, AVANT_NOIR } from './damier.js';
import { geometrieDe, reglesAvec } from './variantes.js';

export const BLANC = 1;
export const NOIR = -1;

export const PION = 1;
export const DAME = 2;

export const campDe = piece => (piece > 0 ? BLANC : piece < 0 ? NOIR : 0);
export const estDame = piece => piece === DAME || piece === -DAME;
export const adverse = camp => -camp;

export const nomCamp = camp => (camp === BLANC ? 'blancs' : 'noirs');

// Une position porte sa variante : sans elle, une position isolee ne saurait
// pas de quel jeu elle vient, et le moteur non plus. Elle porte aussi, s'il y
// en a, les entorses aux regles officielles — la prise rendue facultative, la
// dame privee de vol. Les mettre dans la position plutot que dans un reglage
// global garde le moteur pur : deux parties aux regles differentes peuvent
// tourner cote a cote, et un test n'a rien a remettre en place apres coup.
export const reglesDe = position => reglesAvec(position.variante, position.maison);
export const geometrie = position => geometrieDe(position.variante);

export function positionInitiale(idVariante = 'international', maison = null) {
    const variante = reglesAvec(idVariante, maison);
    const geo = geometrieDe(variante.id);
    const parCamp = (geo.cote / 2) * variante.rangeesDePieces;

    const cases = new Int8Array(geo.CASES + 1);
    for (let numero = 1; numero <= parCamp; numero++) cases[numero] = -PION;
    for (let numero = geo.CASES - parCamp + 1; numero <= geo.CASES; numero++) cases[numero] = PION;

    return { cases, trait: variante.premier, variante: variante.id, maison };
}

export const copier = position => ({
    cases: Int8Array.from(position.cases),
    trait: position.trait,
    variante: position.variante,
    maison: position.maison
});

export function compter(position) {
    const geo = geometrie(position);
    const bilan = { pionsBlancs: 0, damesBlanches: 0, pionsNoirs: 0, damesNoires: 0 };
    for (let numero = 1; numero <= geo.CASES; numero++) {
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

// Rafle d'une piece qui saute par-dessus sa voisine : tous les pions, et les
// dames anglaises.
//
// Le pion couronne en cours de rafle s'arrete de lui-meme : il reste pion
// jusqu'au bout du coup, et un pion anglais qui touche le fond n'a plus de
// direction ou manger. Rien a ecrire pour ca.
function explorerCourt(contexte, courante, prises, chemin, sortie, directions) {
    const { geo, cases, camp, depart } = contexte;
    let poursuivie = false;

    for (const direction of directions) {
        const mangee = geo.VOISIN[courante][direction];
        if (!mangee) continue;
        const cible = cases[mangee];
        if (cible === 0 || campDe(cible) === camp || prises.includes(mangee)) continue;

        const arrivee = geo.VOISIN[mangee][direction];
        if (!arrivee || cases[arrivee] !== 0) continue;

        poursuivie = true;
        prises.push(mangee);
        chemin.push(arrivee);
        explorerCourt(contexte, arrivee, prises, chemin, sortie, directions);
        chemin.pop();
        prises.pop();
    }

    if (!poursuivie && prises.length) sortie.push(creerCoup(depart, chemin, prises));
}

// Rafle d'une dame volante : elle voit de loin, et se pose ou elle veut.
function explorerLong(contexte, courante, prises, chemin, sortie) {
    const { geo, cases, camp, depart } = contexte;
    let poursuivie = false;

    for (const direction of DIRECTIONS) {
        const ligne = geo.DIAGONALE[courante][direction];

        let index = 0;
        while (index < ligne.length && cases[ligne[index]] === 0) index++;
        if (index >= ligne.length) continue;

        const mangee = ligne[index];
        // Piece a soi, ou piece deja mangee dans cette rafle : la diagonale est
        // fermee. C'est tout le coup turc — la prise n'est retiree du damier
        // qu'une fois la rafle finie, et elle barre la route en attendant.
        if (campDe(cases[mangee]) === camp || prises.includes(mangee)) continue;

        for (let suivant = index + 1; suivant < ligne.length && cases[ligne[suivant]] === 0; suivant++) {
            const arrivee = ligne[suivant];
            poursuivie = true;
            prises.push(mangee);
            chemin.push(arrivee);
            explorerLong(contexte, arrivee, prises, chemin, sortie);
            chemin.pop();
            prises.pop();
        }
    }

    if (!poursuivie && prises.length) sortie.push(creerCoup(depart, chemin, prises));
}

function raflesDepuis(position, depart, variante, geo) {
    const piece = position.cases[depart];
    if (!piece) return [];

    const camp = campDe(piece);

    const cases = Int8Array.from(position.cases);
    cases[depart] = 0;                       // la case de depart se libere aussitot

    const contexte = { geo, cases, camp, depart };
    const sortie = [];

    if (estDame(piece)) {
        if (variante.dameVolante) explorerLong(contexte, depart, [], [], sortie);
        else explorerCourt(contexte, depart, [], [], sortie, DIRECTIONS);
        return sortie;
    }

    const directions = variante.prendEnArriere
        ? DIRECTIONS
        : (camp === BLANC ? AVANT_BLANC : AVANT_NOIR);
    explorerCourt(contexte, depart, [], [], sortie, directions);
    return sortie;
}

function deplacementsDepuis(position, depart, variante, geo) {
    const piece = position.cases[depart];
    if (!piece) return [];

    const camp = campDe(piece);
    const coups = [];

    if (estDame(piece) && variante.dameVolante) {
        for (const direction of DIRECTIONS) {
            for (const arrivee of geo.DIAGONALE[depart][direction]) {
                if (position.cases[arrivee] !== 0) break;
                coups.push(creerCoup(depart, [arrivee], []));
            }
        }
        return coups;
    }

    const directions = estDame(piece)
        ? DIRECTIONS
        : (camp === BLANC ? AVANT_BLANC : AVANT_NOIR);

    for (const direction of directions) {
        const arrivee = geo.VOISIN[depart][direction];
        if (arrivee && position.cases[arrivee] === 0) coups.push(creerCoup(depart, [arrivee], []));
    }
    return coups;
}

// Les coups legaux du camp au trait. S'il existe une prise, elle est
// obligatoire — et, aux internationales seulement, il faut prendre la plus
// longue.
//
// La prise obligatoire peut etre levee en regle maison. Les rafles restent
// alors proposees a cote des deplacements simples : on peut toujours manger,
// on n'y est plus tenu.
export function coupsLegaux(position) {
    const geo = geometrieDe(position.variante);
    const variante = reglesDe(position);
    const camp = position.trait;

    const rafles = [];
    let maximum = 0;

    for (let numero = 1; numero <= geo.CASES; numero++) {
        if (campDe(position.cases[numero]) !== camp) continue;
        for (const coup of raflesDepuis(position, numero, variante, geo)) {
            if (!variante.rafleMaximale) { rafles.push(coup); continue; }
            if (coup.prises.length > maximum) {
                maximum = coup.prises.length;
                rafles.length = 0;
            }
            if (coup.prises.length === maximum) rafles.push(coup);
        }
    }

    // Le cas courant : la prise chasse tout le reste, et les deplacements
    // simples n'ont meme pas ete calcules.
    if (rafles.length && variante.priseObligatoire) return rafles;

    const simples = [];
    for (let numero = 1; numero <= geo.CASES; numero++) {
        if (campDe(position.cases[numero]) !== camp) continue;
        simples.push(...deplacementsDepuis(position, numero, variante, geo));
    }
    return rafles.length ? [...rafles, ...simples] : simples;
}

// Le nombre de prises impose. L'interface s'en sert pour expliquer pourquoi
// un coup pourtant valide est refuse — et, quand la prise est facultative,
// pour ne rien expliquer du tout.
export const prisesObligatoires = position => {
    if (!reglesDe(position).priseObligatoire) return 0;
    const coups = coupsLegaux(position);
    if (!coups.length) return 0;
    return Math.min(...coups.map(coup => coup.prises.length));
};

export const promeut = (position, piece, arrivee) => {
    const geo = geometrieDe(position.variante);
    if (piece === PION) return geo.PROMOTION_BLANC.has(arrivee);
    if (piece === -PION) return geo.PROMOTION_NOIR.has(arrivee);
    return false;
};

export function appliquer(position, coup) {
    const cases = Int8Array.from(position.cases);
    const piece = cases[coup.de];

    cases[coup.de] = 0;
    for (const prise of coup.prises) cases[prise] = 0;

    // La promotion ne se declenche qu'a l'arrivee. Aux internationales, un pion
    // qui ne fait que traverser la rangee adverse au milieu d'une rafle reste
    // un pion — sinon il finirait la rafle en dame, avec des prises qu'il
    // n'avait pas le droit de faire.
    cases[coup.vers] = promeut(position, piece, coup.vers) ? piece * DAME : piece;

    return { cases, trait: adverse(position.trait), variante: position.variante, maison: position.maison };
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
    const geo = geometrieDe(position.variante);
    let texte = position.trait === BLANC ? 'b' : 'n';
    for (let numero = 1; numero <= geo.CASES; numero++) texte += position.cases[numero] + 2;
    return texte;
}

export const memeCoup = (a, b) =>
    a.de === b.de && a.vers === b.vers
    && a.chemin.length === b.chemin.length
    && a.chemin.every((etape, index) => etape === b.chemin[index]);
