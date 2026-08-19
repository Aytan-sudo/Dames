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
        prendEnArriere: false,
        dameVolante: false,        // la dame ne fait qu'un pas, dans les quatre sens
        rafleMaximale: false,      // la prise est obligatoire, mais libre
        resume: 'Damier 8×8, douze pions, les noirs ouvrent. Le pion ne prend qu\'en avant, la dame ne fait qu\'un pas, et la prise est obligatoire mais libre : on choisit laquelle.'
    }
];

const GEOMETRIES = new Map(VARIANTES.map(variante => [variante.id, creerGeometrie(variante.cote)]));

export const varianteDe = id => VARIANTES.find(variante => variante.id === id) ?? VARIANTES[0];
export const geometrieDe = id => GEOMETRIES.get(varianteDe(id).id);
