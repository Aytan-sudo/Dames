// Les regles. C'est le fichier qui compte : une faute ici ne fait rien planter,
// elle donne un jeu qui ressemble aux dames sans en etre.

import { counter, position, notations, trouver, suite, coupsLegaux, appliquer, noterCoup } from './harness.mjs';
import { positionInitiale, compter, gagnant, estBloque, PION, DAME, BLANC, NOIR, prisesObligatoires } from '../js/regles.js';

const { check, report } = counter();
console.log('\nRegles\n');

// --- Ouverture ------------------------------------------------------------

const debut = positionInitiale();
const depart = compter(debut);

check('vingt pions de chaque camp', depart.blancs === 20 && depart.noirs === 20);
check('les noirs occupent 1 a 20 et les blancs 31 a 50',
    debut.cases[1] === -PION && debut.cases[20] === -PION
    && debut.cases[21] === 0 && debut.cases[30] === 0
    && debut.cases[31] === PION && debut.cases[50] === PION);
check('les blancs ouvrent', debut.trait === BLANC);
check('neuf coups d ouverture',
    notations(debut).join(' ') === '31-26 31-27 32-27 32-28 33-28 33-29 34-29 34-30 35-30',
    notations(debut).join(' '));

// Les nombres de reference du jeu international. Ils ne dependent d'aucun
// choix d'implementation : si l'un tombe, une regle est fausse, et le reste des
// tests n'aurait plus grand sens.
const perft = (pos, profondeur) => {
    const coups = coupsLegaux(pos);
    if (profondeur === 1) return coups.length;
    let total = 0;
    for (const coup of coups) total += perft(appliquer(pos, coup), profondeur - 1);
    return total;
};

for (const [profondeur, attendu] of [[1, 9], [2, 81], [3, 658], [4, 4265], [5, 27117]]) {
    const obtenu = perft(debut, profondeur);
    check(`perft ${profondeur} vaut ${attendu}`, obtenu === attendu, String(obtenu));
}

// --- Pions ----------------------------------------------------------------

check('un pion avance en diagonale, jamais en arriere',
    notations(position({ blancs: [28], noirs: [1] })).join(' ') === '28-22 28-23',
    notations(position({ blancs: [28], noirs: [1] })).join(' '));

check('la prise est obligatoire : plus rien d autre n est permis',
    notations(position({ blancs: [33], noirs: [28] })).join(' ') === '33x22',
    notations(position({ blancs: [33], noirs: [28] })).join(' '));

check('un pion prend aussi en arriere',
    notations(position({ blancs: [28], noirs: [33] })).join(' ') === '28x39',
    notations(position({ blancs: [28], noirs: [33] })).join(' '));

// Deux prises possibles, l'une de deux pieces, l'autre d'une seule : la
// majoritaire elimine la petite. C'est la regle qui donne au jeu ses sacrifices.
const majoritaire = position({ blancs: [33, 50], noirs: [28, 17, 44] });
check('seule la rafle la plus longue est jouable',
    notations(majoritaire).join(' ') === '33x11', notations(majoritaire).join(' '));
check('la rafle passe bien par 22 et mange les deux pions',
    trouver(majoritaire, '33x11').chemin.join(',') === '22,11'
    && trouver(majoritaire, '33x11').prises.join(',') === '28,17');
check('le nombre de prises imposees est annonce', prisesObligatoires(majoritaire) === 2);

// Sans la memoire des pieces deja mangees, ce pion tournerait indefiniment
// entre 35 et 24 en repassant sur le meme pion noir.
const rondeInfinie = position({ blancs: [35], noirs: [30] });
check('on ne mange jamais deux fois la meme piece',
    notations(rondeInfinie).join(' ') === '35x24', notations(rondeInfinie).join(' '));

// --- Promotion ------------------------------------------------------------

const arret = position({ blancs: [7], noirs: [50] });
check('un pion qui s arrete au fond devient dame',
    appliquer(arret, trouver(arret, '7-1')).cases[1] === DAME);

// Le pion traverse la rangee de promotion en 4 et repart : il reste pion. Une
// promotion en cours de rafle lui donnerait les prises d'une dame, qu'il n'a
// pas le droit de faire.
const traversee = position({ blancs: [13], noirs: [9, 10] });
const rafleTraversante = trouver(traversee, '13x15');
check('la rafle traverse le fond sans s y arreter',
    Boolean(rafleTraversante) && rafleTraversante.chemin.join(',') === '4,15',
    rafleTraversante && rafleTraversante.chemin.join(','));
check('un pion qui ne fait que traverser le fond reste pion',
    appliquer(traversee, rafleTraversante).cases[15] === PION);

const arretAuFond = position({ blancs: [13], noirs: [9] });
check('le meme pion, sans suite, devient dame en 4',
    appliquer(arretAuFond, trouver(arretAuFond, '13x4')).cases[4] === DAME);

// --- Dames ----------------------------------------------------------------

check('la dame glisse sur toute la diagonale',
    notations(position({ damesBlanches: [46], noirs: [1] })).join(' ')
        === '46-10 46-14 46-19 46-23 46-28 46-32 46-37 46-41 46-5',
    notations(position({ damesBlanches: [46], noirs: [1] })).join(' '));

check('la dame prend de loin et choisit ou se poser',
    notations(position({ damesBlanches: [46], noirs: [23] })).join(' ') === '46x10 46x14 46x19 46x5',
    notations(position({ damesBlanches: [46], noirs: [23] })).join(' '));

check('une dame ne saute pas deux pieces collees',
    notations(position({ damesBlanches: [46], noirs: [37, 32] })).join(' ') === '46-41',
    notations(position({ damesBlanches: [46], noirs: [37, 32] })).join(' '));

// Le coup turc : la piece mangee reste sur le damier jusqu'a la fin de la
// rafle. Ici le pion de 7, deja mange, barre la diagonale 1-45 ; sans lui, la
// dame poursuivrait jusqu'a 45 et prendrait deux pieces au lieu d'une.
const turc = position({ damesBlanches: [23], noirs: [7, 8, 38, 40, 46] });
check('une piece mangee bloque encore le passage',
    notations(turc).join(' ') === '23x1 23x45', notations(turc).join(' '));
check('la rafle bloquee ne prend qu une piece',
    coupsLegaux(turc).every(coup => coup.prises.length === 1));

// --- Fin de partie --------------------------------------------------------

const etouffe = position({ blancs: [50], noirs: [39, 44, 45] });
check('un camp sans coup a perdu', estBloque(etouffe) && gagnant(etouffe) === NOIR);
check('un camp qui peut jouer n a pas perdu', gagnant(positionInitiale()) === 0);

const balaye = position({ noirs: [28] });
check('un camp sans piece a perdu aussi', estBloque(balaye) && gagnant(balaye) === NOIR);

// --- Application ----------------------------------------------------------

const avant = position({ blancs: [33], noirs: [28, 17] });
const apres = appliquer(avant, trouver(avant, '33x11'));
check('la piece arrive, les mangees disparaissent',
    apres.cases[11] === PION && apres.cases[33] === 0 && apres.cases[28] === 0 && apres.cases[17] === 0);
check('le trait passe a l adversaire', apres.trait === NOIR);
check('la position de depart n a pas bouge', avant.cases[33] === PION && avant.cases[28] === -PION);

// Une partie jouee coup par coup, comme on la lirait dans une revue.
const ouverture = suite(positionInitiale(), ['32-28', '19-23', '28x19', '14x23']);
check('une ouverture avec prises se rejoue',
    compter(ouverture).blancs === 19 && compter(ouverture).noirs === 19
    && ouverture.cases[23] === -PION, JSON.stringify(compter(ouverture)));

check('la notation distingue prise et deplacement',
    noterCoup(trouver(positionInitiale(), '32-28')) === '32-28'
    && noterCoup(trouver(position({ blancs: [33], noirs: [28] }), '33x22')) === '33x22');

report();
