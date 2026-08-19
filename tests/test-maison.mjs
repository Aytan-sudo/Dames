// Les regles maison : lever une regle officielle, et verifier que le moteur la
// lit vraiment dans l'autre sens.
//
// Chaque entorse est testee sur la variante ou elle est une entorse — rendre la
// dame volante ne prouve rien aux internationales, ou elle l'est deja.

import { counter, position, notations, detail } from './harness.mjs';
import { REGLES_OPTIONNELLES, maisonDe, valeurRegle, reglesAvec, VARIANTES } from '../js/variantes.js';
import { coupsLegaux, prisesObligatoires, positionInitiale, appliquer, copier } from '../js/regles.js';
import { creerPartie, jouer, estOfficielle, serialiser, relire } from '../js/partie.js';

const { check, report } = counter();
console.log('\nRegles maison\n');

// Une position posee a la main, plus les entorses choisies.
const avec = (maison, options) => ({ ...position(options), maison });

// --- La liste ------------------------------------------------------------

check('les quatre regles levables sont bien des drapeaux du moteur',
    REGLES_OPTIONNELLES.every(regle => VARIANTES.every(variante => typeof variante[regle.id] === 'boolean')),
    REGLES_OPTIONNELLES.map(regle => regle.id).join(' '));
check('chacune s explique en une phrase',
    REGLES_OPTIONNELLES.every(regle => regle.libelle && regle.detail?.length > 40));

// --- Ce qui compte comme entorse ------------------------------------------

check('sans rien de choisi, la partie est officielle',
    maisonDe('international', {}) === null && maisonDe('anglaise', undefined) === null);

// La meme case cochee est officielle d'un cote et maison de l'autre : la prise
// majoritaire est la regle aux internationales, elle ne l'est pas aux anglaises.
check('un choix qui tombe deja juste n est pas une entorse',
    maisonDe('international', { rafleMaximale: true }) === null);
check('le meme choix ailleurs en est une',
    JSON.stringify(maisonDe('anglaise', { rafleMaximale: true })) === '{"rafleMaximale":true}');

check('l interrupteur montre la regle du jeu tant qu on n a rien choisi',
    valeurRegle('international', {}, 'dameVolante') === true
    && valeurRegle('anglaise', {}, 'dameVolante') === false
    && valeurRegle('anglaise', { dameVolante: true }, 'dameVolante') === true);

check('les regles appliquees sont celles de la variante, corrigees',
    reglesAvec('anglaise', { dameVolante: true }).dameVolante === true
    && reglesAvec('anglaise', { dameVolante: true }).cote === 8
    && reglesAvec('anglaise', null).dameVolante === false);

// --- Prise obligatoire ----------------------------------------------------

// Le blanc de 33 peut manger le noir de 28. Officiellement, c'est son seul coup.
const aPrendre = { blancs: [33, 45], noirs: [28] };

check('officiellement, la prise chasse tous les autres coups',
    notations(position(aPrendre)).join(' ') === '33x22');

const facultative = avec({ priseObligatoire: false }, aPrendre);
check('prise facultative : les deplacements simples reviennent',
    notations(facultative).join(' ') === '33-29 33x22 45-40', notations(facultative).join(' '));
check('la prise reste proposee, elle n est plus imposee',
    prisesObligatoires(facultative) === 0 && prisesObligatoires(position(aPrendre)) === 1);

// --- Prise majoritaire ----------------------------------------------------

// Deux rafles possibles : le pion de 33 en mange deux, celui de 48 une seule.
// La regle officielle des internationales ne laisse que la premiere.
const deuxRafles = { blancs: [33, 48], noirs: [29, 20, 42] };

const majoritaire = notations(position(deuxRafles));
const libre = notations(avec({ rafleMaximale: false }, deuxRafles));
check('officiellement, seule la plus longue rafle est jouable',
    majoritaire.join(' ') === '33x15', majoritaire.join(' '));
check('prise libre : la rafle courte redevient jouable',
    libre.join(' ') === '33x15 48x37', libre.join(' '));
check('mais la prise reste obligatoire : aucun deplacement simple',
    libre.every(texte => texte.includes('x')));

// --- Le pion qui ne prend plus en arriere ---------------------------------

// Le noir de 33 est derriere le blanc de 28 : seule une prise en arriere le
// mange, et le blanc avance toujours vers les petits numeros.
const enArriere = { blancs: [28], noirs: [33] };
check('officiellement, le pion international mange en arriere',
    notations(position(enArriere)).join(' ') === '28x39');
check('sans la prise en arriere, la piece derriere lui est intouchable',
    notations(avec({ prendEnArriere: false }, enArriere)).join(' ') === '28-22 28-23',
    notations(avec({ prendEnArriere: false }, enArriere)).join(' '));

// --- La dame privee de vol ------------------------------------------------

const dameSeule = { damesBlanches: [46] };
check('officiellement, la dame internationale glisse loin',
    notations(position(dameSeule)).length > 4);
check('privee de vol, elle ne fait qu un pas',
    notations(avec({ dameVolante: false }, dameSeule)).join(' ') === '46-41', 
    notations(avec({ dameVolante: false }, dameSeule)).join(' '));

// Une dame anglaise a qui on rend le vol prend de loin et se pose ou elle veut.
const volAnglais = { damesBlanches: [22], noirs: [18], variante: 'anglaise' };
check('la dame anglaise se pose juste derriere sa prise',
    notations(position(volAnglais)).join(' ') === '22x15');
check('rendue volante, elle choisit ou se poser sur toute la diagonale',
    notations(avec({ dameVolante: true }, volAnglais)).join(' ') === '22x11 22x15 22x4 22x8',
    notations(avec({ dameVolante: true }, volAnglais)).join(' '));

// --- Les entorses suivent la position -------------------------------------

const partieMaison = creerPartie('international', { priseObligatoire: false });
check('une partie porte ses regles', partieMaison.position.maison !== null);
check('elle n est pas officielle', !estOfficielle(partieMaison));
check('une partie ordinaire l est', estOfficielle(creerPartie('international')));

// Le refus de la prise, joue pour de vrai : impossible aux regles officielles.
const refus = jouer(creerPartie('international', { priseObligatoire: false }),
    { de: 33, vers: 29, chemin: [29], prises: [] });
check('la partie maison accepte un coup que les regles officielles refuseraient', refus !== null);

const depart = positionInitiale('international', { priseObligatoire: false });
check('les entorses survivent a un coup joue',
    appliquer(depart, coupsLegaux(depart)[0]).maison === depart.maison);
check('et a une copie', copier(depart).maison === depart.maison);

// --- Sauvegarde -----------------------------------------------------------

const sauvee = relire(serialiser(partieMaison));
check('une partie maison se relit avec ses regles',
    sauvee !== null && JSON.stringify(sauvee.position.maison) === '{"priseObligatoire":false}');
check('une sauvegarde d avant les regles maison se relit en officielle',
    relire({ version: 1, variante: 'international', coups: [] })?.position.maison === null);

// La sauvegarde d'une partie maison rejouee aux regles officielles doit se
// refuser plutot que de poser un damier impossible.
const partieRefus = creerPartie('international', { priseObligatoire: false });
jouer(partieRefus, { de: 32, vers: 28, chemin: [28], prises: [] });
jouer(partieRefus, { de: 19, vers: 23, chemin: [23], prises: [] });
jouer(partieRefus, { de: 37, vers: 32, chemin: [32], prises: [] });   // refuse la prise
const officielle = { ...serialiser(partieRefus), maison: null };
check('rejouee aux regles officielles, elle est refusee au coup devenu illegal',
    relire(officielle) === null);

report();
