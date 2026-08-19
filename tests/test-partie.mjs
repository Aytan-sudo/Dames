// La partie : ce qui dure d'un coup a l'autre. Annulation, nulles, sauvegarde.

import { counter, position } from './harness.mjs';
import {
    creerPartie, coupsLegaux, jouer, annuler, trait, dernierCoup, notation,
    serialiser, relire, abandonner, bilan, MOTIFS, BLANC, NOIR,
    DEMI_COUPS_STERILES, FINALE_LONGUE
} from '../js/partie.js';
import { noterCoup, clef } from '../js/regles.js';

const { check, report } = counter();
console.log('\nPartie\n');

const coupNomme = (partie, texte) => coupsLegaux(partie).find(coup => noterCoup(coup) === texte);
const jouerNomme = (partie, texte) => jouer(partie, coupNomme(partie, texte));

// --- Enchainement ---------------------------------------------------------

const partie = creerPartie();
check('une partie neuve part de la position initiale',
    bilan(partie).blancs === 20 && bilan(partie).noirs === 20 && trait(partie) === BLANC);
check('elle n a pas encore de resultat', partie.resultat === null);

jouerNomme(partie, '32-28');
check('le coup joue passe la main', trait(partie) === NOIR);
check('le dernier coup est retenu', noterCoup(dernierCoup(partie)) === '32-28');

jouerNomme(partie, '19-23');
jouerNomme(partie, '28x19');
check('la prise obligatoire enleve une piece', bilan(partie).noirs === 19);
check('la notation se relit', notation(partie).join(' ') === '32-28 19-23 28x19');

check('un coup illegal est refuse, sans rien casser',
    jouer(partie, { de: 1, vers: 50, chemin: [50], prises: [] }) === null
    && notation(partie).length === 3);

// --- Annulation -----------------------------------------------------------

const avant = clef(partie.position);
jouerNomme(partie, '14x23');
check('l annulation remet la position d avant',
    annuler(partie) && clef(partie.position) === avant);
check('elle remet aussi l historique', notation(partie).length === 3);

const vide = creerPartie();
check('annuler sans coup joue ne fait rien', annuler(vide) === false);

// --- Nulles ---------------------------------------------------------------

// Deux dames qui vont et viennent sur des diagonales qui ne se croisent pas :
// la position revient, et la troisieme fois vaut nulle. Le trait compte dans
// la comparaison, sinon un simple aller-retour la declencherait.
const rondes = creerPartie();
rondes.position = position({ damesBlanches: [46], damesNoires: [1] });
for (const texte of ['46-41', '1-6', '41-46', '6-1', '46-41', '1-6', '41-46', '6-1', '46-41', '1-6']) {
    if (!rondes.resultat) jouerNomme(rondes, texte);
}
check('trois fois la meme position vaut nulle',
    rondes.resultat?.gagnant === 0 && rondes.resultat?.motif === MOTIFS.repetition,
    JSON.stringify(rondes.resultat));
check('la nulle par repetition arrive au bon moment', notation(rondes).length === 9,
    String(notation(rondes).length));

// Vingt-cinq coups de dames de chaque camp sans qu'un pion bouge ni qu'une
// piece tombe : le compteur est pose a une longueur de la fin, un coup de dame
// suffit alors a conclure.
const steriles = creerPartie();
steriles.position = position({ damesBlanches: [46], damesNoires: [1], blancs: [50], noirs: [5] });
steriles.steriles = DEMI_COUPS_STERILES - 1;
jouerNomme(steriles, '46-41');
check('vingt-cinq coups de dames sans prise valent nulle',
    steriles.resultat?.motif === MOTIFS.steriles, JSON.stringify(steriles.resultat));

const pionRemetACompter = creerPartie();
pionRemetACompter.position = position({ damesBlanches: [46], blancs: [35], damesNoires: [1] });
pionRemetACompter.steriles = DEMI_COUPS_STERILES - 1;
jouerNomme(pionRemetACompter, '35-30');
check('un pion qui bouge remet le compteur a zero',
    pionRemetACompter.resultat === null && pionRemetACompter.steriles === 0);

// Trois pieces contre une dame seule : seize coups pour conclure, sinon nulle.
const finale = creerPartie();
finale.position = position({ blancs: [45], damesBlanches: [46, 41], damesNoires: [5] });
finale.finale = FINALE_LONGUE - 1;
jouerNomme(finale, '41-37');
check('une finale a trois contre une dame finit par etre nulle',
    finale.resultat?.motif === MOTIFS.finale, JSON.stringify(finale.resultat));

const finaleAvecPions = creerPartie();
finaleAvecPions.position = position({ damesBlanches: [46], blancs: [35, 40, 45], noirs: [5] });
finaleAvecPions.finale = FINALE_LONGUE - 1;
jouerNomme(finaleAvecPions, '35-30');
check('la pendule des finales ne tourne pas sans dame seule en face',
    finaleAvecPions.resultat === null && finaleAvecPions.finale === 0);

// --- Blocage --------------------------------------------------------------

const bloquee = creerPartie();
bloquee.position = position({ blancs: [50], noirs: [39, 40, 45], trait: NOIR });
jouerNomme(bloquee, '40-44');
check('un camp etouffe perd la partie',
    bloquee.resultat?.gagnant === NOIR && bloquee.resultat.motif === MOTIFS.blocage,
    JSON.stringify(bloquee.resultat));
check('la partie terminee refuse tout coup',
    jouer(bloquee, { de: 50, vers: 44, chemin: [44], prises: [] }) === null);

const abandonnee = creerPartie();
jouerNomme(abandonnee, '32-28');
abandonner(abandonnee);
check('l abandon donne la partie a l adversaire du trait',
    abandonnee.resultat.gagnant === BLANC && abandonnee.resultat.motif === MOTIFS.abandon);

// --- Sauvegarde -----------------------------------------------------------

const longue = creerPartie();
for (const texte of ['32-28', '19-23', '28x19', '14x23', '31-26', '20-24']) jouerNomme(longue, texte);

const relue = relire(serialiser(longue));
check('une partie enregistree se relit coup pour coup',
    relue && clef(relue.position) === clef(longue.position)
    && notation(relue).join(' ') === notation(longue).join(' '));
check('la partie relue peut etre annulee', annuler(relue) && notation(relue).length === 5);

check('une sauvegarde d une autre version est ignoree',
    relire({ version: 99, coups: [] }) === null);
check('une sauvegarde abimee est ignoree',
    relire({ version: 1, coups: [[1, [50], []]] }) === null);
check('une sauvegarde vide donne une partie neuve',
    relire({ version: 1, coups: [] })?.historique.length === 0);

report();
