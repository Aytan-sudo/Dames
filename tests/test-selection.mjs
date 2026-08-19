// La saisie d'un coup, case apres case. C'est le seul module que le joueur
// « voit » sans le savoir : quand il rate un coup qu'il croyait avoir designe,
// c'est ici que ca s'est joue.

import { counter, position, coupsLegaux } from './harness.mjs';
import { departs, suites, compatibles, prisesEnCours, avancer } from '../js/selection.js';

const { check, report } = counter();
console.log('\nSaisie\n');

// Une dame en 44 mange le pion de 33, se pose en 28 ou en 22, puis mange celui
// de 17 et finit en 11 ou en 6. Quatre rafles de deux pieces, dont deux
// finissent au meme endroit par des chemins differents : un depart-arrivee ne
// suffirait pas a dire laquelle on joue.
const ambigue = position({ damesBlanches: [44], noirs: [17, 33, 47] });
const coups = coupsLegaux(ambigue);

check('les quatre rafles sont trouvees', coups.length === 4, String(coups.length));
check('elles prennent toutes les deux memes pieces',
    coups.every(coup => coup.prises.join(',') === '33,17'));
check('deux d entre elles finissent en 11 par des chemins differents',
    coups.filter(coup => coup.vers === 11).length === 2);

check('une seule piece peut partir', [...departs(coups)].join(',') === '44');
check('deux cases s offrent au premier saut',
    [...suites(coups, 44, [])].sort().join(',') === '22,28');

const premierSaut = avancer(coups, 44, [], 28);
check('toucher 28 ne joue pas encore le coup',
    !premierSaut.coup && premierSaut.etapes?.join(',') === '28');
check('la piece deja mangee est signalee des le premier saut',
    prisesEnCours(coups, 44, [28]).join(',') === '33');
check('deux arrivees restent apres 28',
    [...suites(coups, 44, [28])].sort((a, b) => a - b).join(',') === '6,11');

const acheve = avancer(coups, 44, [28], 11);
check('toucher 11 apres 28 joue la rafle qui passe par 28',
    acheve.coup?.chemin.join(',') === '28,11', JSON.stringify(acheve));

check('le chemin par 22 mene a la meme case, sans etre le meme coup',
    avancer(coups, 44, [22], 11).coup?.chemin.join(',') === '22,11');

check('toucher l arrivee directement ne suffit pas quand deux chemins y menent',
    avancer(coups, 44, [], 11).rien === true);
check('toucher une case sans rapport ne fait rien',
    avancer(coups, 44, [], 30).rien === true);
check('le suivi ne garde que les rafles compatibles',
    compatibles(coups, 44, [22]).length === 2);

// Quand une seule rafle reste possible, toucher son arrivee suffit : personne
// n'a envie de taper quatre cases pour un coup force.
const forcee = position({ blancs: [33], noirs: [28, 17] });
const uniques = coupsLegaux(forcee);
check('une rafle unique part en touchant son arrivee',
    avancer(uniques, 33, [], 11).coup?.prises.join(',') === '28,17');
check('elle part aussi en passant par les etapes',
    avancer(uniques, 33, [], 22).etapes?.join(',') === '22'
    && avancer(uniques, 33, [22], 11).coup?.vers === 11);

// Un deplacement simple n'a qu'une etape : il se joue d'un seul appui.
const simple = coupsLegaux(position({ blancs: [33], noirs: [1] }));
check('un deplacement simple se joue en une fois',
    avancer(simple, 33, [], 28).coup?.vers === 28);
check('aucune piece mangee a signaler', prisesEnCours(simple, 33, []).length === 0);

report();
