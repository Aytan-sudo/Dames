// Les deux jeux de dames que connait ce moteur.
//
// Ce sont vraiment deux jeux, pas un jeu et son option : l'anglaise se joue a
// douze pions sur un damier plus petit, le pion n'y prend qu'en avant, la dame
// n'avance que d'une case, et surtout la prise obligatoire y est libre — on
// prend, mais on prend ce qu'on veut. Le sacrifice qui force une rafle, coeur
// du jeu international, n'existe pas la-bas ; a la place, on tend des pieges
// que l'adversaire peut choisir de ne pas mordre.
//
// Tout ce qui les separe tient dans ce fichier. Le reste du moteur lit ces
// drapeaux et ne sait rien d'autre.

import { creerGeometrie } from './damier.js';

const BLANC = 1;
const NOIR = -1;

export const VARIANTES = [
    {
        id: 'international',
        libelle: 'Internationales',
        court: '10×10',
        cote: 10,
        rangeesDePieces: 4,        // quatre rangees par camp, soit vingt pions
        premier: BLANC,
        priseObligatoire: true,    // quand une prise existe, il faut la jouer
        prendEnArriere: true,      // le pion mange dans les quatre directions
        dameVolante: true,         // la dame glisse sur toute la diagonale
        rafleMaximale: true,       // on doit prendre le plus de pieces possible
        resume: 'Damier 10×10, vingt pions, les blancs ouvrent. Le pion prend aussi en arrière, la dame glisse sur toute la diagonale, et il faut toujours prendre le plus de pièces possible.'
    },
    {
        id: 'anglaise',
        libelle: 'Anglaises',
        court: '8×8',
        cote: 8,
        rangeesDePieces: 3,        // douze pions par camp
        premier: NOIR,             // aux dames anglaises, les noirs ouvrent
        priseObligatoire: true,
        prendEnArriere: false,
        dameVolante: false,        // la dame ne fait qu'un pas, dans les quatre sens
        rafleMaximale: false,      // la prise est obligatoire, mais libre
        resume: 'Damier 8×8, douze pions, les noirs ouvrent. Le pion ne prend qu\'en avant, la dame ne fait qu\'un pas, et la prise est obligatoire mais libre : on choisit laquelle.'
    }
];

const GEOMETRIES = new Map(VARIANTES.map(variante => [variante.id, creerGeometrie(variante.cote)]));

export const varianteDe = id => VARIANTES.find(variante => variante.id === id) ?? VARIANTES[0];
export const geometrieDe = id => GEOMETRIES.get(varianteDe(id).id);

// --- Regles maison --------------------------------------------------------
//
// Les quatre regles qu'on peut lever. Ce sont exactement les drapeaux que le
// moteur lit : deroger, ici, ce n'est pas ajouter un cas particulier au code,
// c'est retourner un interrupteur que les regles officielles avaient mis dans
// un sens.
//
// Chaque interrupteur part de la valeur de la variante choisie — la prise
// majoritaire est officielle aux internationales, elle ne l'est pas aux
// anglaises — et une partie ou l'un d'eux differe n'est plus une partie
// officielle. Elle se joue tres bien ; elle ne se compte pas.

export const REGLES_OPTIONNELLES = [
    {
        id: 'priseObligatoire',
        libelle: 'Prise obligatoire',
        detail: 'Quand une prise existe, il faut la jouer. Sans elle, manger devient un choix — et plus aucun sacrifice ne force la main de l\'adversaire.'
    },
    {
        id: 'rafleMaximale',
        libelle: 'Prise majoritaire',
        detail: 'Parmi les prises possibles, il faut jouer celle qui mange le plus de pièces. Sans elle, on prend ce qu\'on veut.'
    },
    {
        id: 'prendEnArriere',
        libelle: 'Le pion prend en arrière',
        detail: 'Le pion saute dans les quatre directions. Il n\'avance toujours que vers l\'avant : c\'est la prise qui recule, pas le pion.'
    },
    {
        id: 'dameVolante',
        libelle: 'Dame volante',
        detail: 'La dame glisse sur toute la diagonale, prend de loin et se pose où elle veut derrière la pièce mangée. Sinon elle ne fait qu\'un pas.'
    }
];

// Ce que les reglages changent aux regles officielles, et rien d'autre : un
// choix qui tombe deja juste n'est pas une entorse. Rend `null` quand la
// partie est officielle — c'est ce `null` qui autorise le tableau des parties.
export function maisonDe(idVariante, choix) {
    const variante = varianteDe(idVariante);
    const entorses = {};
    for (const regle of REGLES_OPTIONNELLES) {
        const voulu = choix?.[regle.id];
        if (typeof voulu === 'boolean' && voulu !== variante[regle.id]) entorses[regle.id] = voulu;
    }
    return Object.keys(entorses).length ? entorses : null;
}

// La valeur que montre un interrupteur : celle qu'on a choisie, ou celle de la
// variante tant qu'on n'a rien choisi.
export function valeurRegle(idVariante, choix, id) {
    const voulu = choix?.[id];
    return typeof voulu === 'boolean' ? voulu : varianteDe(idVariante)[id];
}

// Les regles effectivement appliquees. Le resultat est garde en cache : le
// moteur les redemande a chaque position visitee, et une recherche en visite
// des dizaines de milliers.
const melanges = new WeakMap();

export function reglesAvec(idVariante, maison) {
    const variante = varianteDe(idVariante);
    if (!maison) return variante;

    let parVariante = melanges.get(maison);
    if (!parVariante) { parVariante = new Map(); melanges.set(maison, parVariante); }

    const connues = parVariante.get(variante.id);
    if (connues) return connues;

    const regles = { ...variante, ...maison };
    parVariante.set(variante.id, regles);
    return regles;
}
