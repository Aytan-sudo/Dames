// Les dames anglaises. Meme moteur, autre jeu : c'est le fichier qui verifie
// que les drapeaux de js/variantes.js sont bien tous lus, et qu'aucune regle
// internationale ne deborde sur le damier de huit.

import { counter, position, notations, trouver, coupsLegaux, appliquer, noterCoup } from './harness.mjs';
import { positionInitiale, compter, gagnant, estBloque, PION, DAME, BLANC, NOIR } from '../js/regles.js';
import { geometrieDe, varianteDe } from '../js/variantes.js';

const { check, report } = counter();
console.log('\nDames anglaises\n');

const anglaise = coups => notations({ ...coups, variante: 'anglaise' });
const posA = donnees => position({ ...donnees, variante: 'anglaise' });

// --- Ouverture ------------------------------------------------------------

const debut = positionInitiale('anglaise');
const geo = geometrieDe('anglaise');

check('trente-deux cases jouables', geo.CASES === 32);
check('douze pions de chaque camp',
    compter(debut).blancs === 12 && compter(debut).noirs === 12);
check('les noirs occupent 1 a 12 et les blancs 21 a 32',
    debut.cases[1] === -PION && debut.cases[12] === -PION
    && debut.cases[13] === 0 && debut.cases[20] === 0
    && debut.cases[21] === PION && debut.cases[32] === PION);

// Aux anglaises, ce sont les noirs qui ouvrent. C'est le detail qui se perd le
// plus facilement en ajoutant une variante, et il change toute la partie.
check('les noirs ouvrent', debut.trait === NOIR && varianteDe('anglaise').premier === NOIR);
check('sept coups d ouverture',
    notations(debut).join(' ') === '10-14 10-15 11-15 11-16 12-16 9-13 9-14',
    notations(debut).join(' '));

// Les nombres de reference du jeu anglais. Ils ne dependent d'aucun choix
// d'implementation : si l'un tombe, une regle est fausse.
const perft = (pos, profondeur) => {
    const coups = coupsLegaux(pos);
    if (profondeur === 1) return coups.length;
    let total = 0;
    for (const coup of coups) total += perft(appliquer(pos, coup), profondeur - 1);
    return total;
};

for (const [profondeur, attendu] of [[1, 7], [2, 49], [3, 302], [4, 1469], [5, 7361], [6, 36768]]) {
    const obtenu = perft(debut, profondeur);
    check(`perft ${profondeur} vaut ${attendu}`, obtenu === attendu, String(obtenu));
}

// --- Ce qui change du jeu international -----------------------------------

// Le pion anglais ne prend qu'en avant. Le pion noir de 26 est derriere le
// blanc de 22 : aux internationales il serait mange, ici les deux s'ignorent.
const enArriere = posA({ blancs: [22], noirs: [26], trait: BLANC });
check('le pion ne prend pas en arriere',
    notations(enArriere).join(' ') === '22-17 22-18', notations(enArriere).join(' '));

const enAvant = posA({ blancs: [22], noirs: [18], trait: BLANC });
check('mais il prend bien en avant, et alors il le doit',
    notations(enAvant).join(' ') === '22x15', notations(enAvant).join(' '));

// La prise est obligatoire — mais libre : on n'est pas force de prendre le plus
// de pieces. Deux prises inegales, deux coups legaux.
const libre = posA({ blancs: [21, 30], noirs: [17, 26, 19], trait: BLANC });
const choix = coupsLegaux(libre);
check('la prise reste obligatoire',
    choix.every(coup => coup.prises.length > 0), notations(libre).join(' '));
check('mais la plus courte reste permise',
    new Set(choix.map(coup => coup.prises.length)).size > 1,
    choix.map(coup => `${noterCoup(coup)}(${coup.prises.length})`).join(' '));

// La dame anglaise ne fait qu'un pas — dans les quatre directions.
const dameCourte = posA({ damesBlanches: [15], noirs: [1] });
check('la dame ne se deplace que d une case, dans les quatre sens',
    notations(dameCourte).join(' ') === '15-10 15-11 15-18 15-19',
    notations(dameCourte).join(' '));

const dameLointaine = posA({ damesBlanches: [15], noirs: [11] });
check('elle prend d une case, elle aussi',
    notations(dameLointaine).join(' ') === '15x8', notations(dameLointaine).join(' '));

// Couronne au fond : le coup s'arrete la. Le pion de 11 mange celui de 7 et se
// pose en 2 ; le pion noir de 8, qu'une dame aurait pu prendre dans la foulee,
// attendra le tour suivant.
const couronne = posA({ blancs: [11], noirs: [7, 8] });
const monte = trouver(couronne, '11x2');
check('le pion couronne ne continue pas la rafle',
    Boolean(monte) && monte.prises.join(',') === '7' && monte.chemin.join(',') === '2',
    notations(couronne).join(' '));
check('et il est bien couronne', appliquer(couronne, monte).cases[2] === DAME);

// --- Ce qui ne change pas -------------------------------------------------

const rafle = posA({ blancs: [30], noirs: [26, 19] });
check('la rafle enchaine tant qu il y a a prendre',
    notations(rafle).join(' ') === '30x16', notations(rafle).join(' '));
check('elle passe par la case intermediaire et mange les deux',
    trouver(rafle, '30x16').chemin.join(',') === '23,16'
    && trouver(rafle, '30x16').prises.join(',') === '26,19');

check('on ne mange jamais deux fois la meme piece',
    posA({ blancs: [30], noirs: [26] }) && notations(posA({ blancs: [30], noirs: [26] })).join(' ') === '30x23');

const etouffe = posA({ blancs: [32], noirs: [23, 27, 28], trait: BLANC });
check('un camp sans coup a perdu', estBloque(etouffe) && gagnant(etouffe) === NOIR);

// --- Etancheite entre les deux jeux ---------------------------------------

check('une position anglaise garde sa variante',
    appliquer(debut, coupsLegaux(debut)[0]).variante === 'anglaise');
check('les deux jeux n ont ni le meme damier ni le meme premier trait',
    geometrieDe('international').CASES === 50 && geo.CASES === 32
    && varianteDe('international').premier === BLANC);
check('une variante inconnue retombe sur les internationales',
    varianteDe('polonaise').id === 'international');

report();
