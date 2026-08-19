// L'adversaire. On ne teste pas qu'il joue « bien » — on teste qu'il ne fait
// pas d'erreur grossiere : voir un gain force, ne pas se croire meilleur en
// noir qu'en blanc, et rendre la main dans le temps qu'on lui a donne.

import { counter, position, notations, noterCoup } from './harness.mjs';
import { geometrieDe } from '../js/variantes.js';
import { positionInitiale } from '../js/regles.js';
import { evaluer, choisirCoup, NIVEAUX, niveauDe } from '../js/ia.js';
import { creerPartie, jouer, bilan, trait } from '../js/partie.js';

const { check, report } = counter();
console.log('\nOrdinateur\n');

// --- Evaluation -----------------------------------------------------------

check('la position de depart est equilibree', evaluer(positionInitiale()) === 0,
    String(evaluer(positionInitiale())));

check('un pion de plus se voit', evaluer(position({ blancs: [33, 34], noirs: [17] })) > 60);
check('une dame vaut plus qu un pion',
    evaluer(position({ damesBlanches: [28] })) > 2 * evaluer(position({ blancs: [28] })));
check('un pion avance vaut plus qu un pion au fond',
    evaluer(position({ blancs: [8] })) > evaluer(position({ blancs: [48] })));

// Le miroir : meme position, camps echanges et damier retourne. Si les deux
// evaluations ne s'annulent pas, la machine joue mieux d'un cote que de
// l'autre — et personne ne comprendrait pourquoi.
function miroir(pos) {
    const { CASES } = geometrieDe(pos.variante);
    const cases = new Int8Array(CASES + 1);
    for (let numero = 1; numero <= CASES; numero++) cases[CASES + 1 - numero] = -pos.cases[numero];
    return { cases, trait: -pos.trait, variante: pos.variante };
}

const echantillons = [
    position({ blancs: [33, 34, 45], noirs: [12, 17], damesNoires: [3] }),
    position({ blancs: [50], damesBlanches: [28], noirs: [6, 7, 8] }),
    positionInitiale()
];
check('l evaluation est parfaitement symetrique',
    echantillons.every(pos => evaluer(pos) === -evaluer(miroir(pos))),
    echantillons.map(pos => `${evaluer(pos)}/${evaluer(miroir(pos))}`).join(' '));

// --- Choix du coup --------------------------------------------------------

const facile = niveauDe('facile');
check('les trois niveaux existent',
    NIVEAUX.map(niveau => niveau.id).join(',') === 'facile,normal,difficile');
check('un identifiant inconnu retombe sur le niveau normal', niveauDe('expert').id === 'normal');
check('le niveau facile cherche moins loin que le difficile',
    facile.profondeur < niveauDe('difficile').profondeur);

const ouverture = choisirCoup(positionInitiale(), 'normal', { budget: 200 });
check('le coup rendu est legal',
    notations(positionInitiale()).includes(noterCoup(ouverture.coup)), noterCoup(ouverture.coup));
check('la recherche annonce sa profondeur et ses noeuds',
    ouverture.profondeur >= 1 && ouverture.noeuds > 0);

// Un seul coup possible : rien a chercher, et surtout rien a attendre.
const force = position({ blancs: [33], noirs: [28] });
const sansChoix = choisirCoup(force, 'difficile');
check('un coup force part sans reflexion',
    sansChoix.force === true && sansChoix.noeuds === 0 && noterCoup(sansChoix.coup) === '33x22');

// Le noir de 45 n'a qu'une case, 50. La dame qui s'y pose l'etouffe : c'est un
// gain force, la machine doit le voir a la premiere profondeur utile.
const etouffement = position({ damesBlanches: [39], noirs: [45] });
const mat = choisirCoup(etouffement, 'normal', { budget: 300 });
check('la machine voit le coup qui etouffe', noterCoup(mat.coup) === '39-50', noterCoup(mat.coup));
check('elle l annonce comme gagnant', mat.score > 50000, String(mat.score));

// --- Force relative -------------------------------------------------------

// Un generateur reproductible : sans lui, le bruit du niveau facile ferait de
// ce test une loterie qui echoue une fois sur dix sans rien signaler.
function graine(valeur) {
    return () => {
        valeur |= 0;
        valeur = (valeur + 0x6D2B79F5) | 0;
        let melange = Math.imul(valeur ^ (valeur >>> 15), 1 | valeur);
        melange = (melange + Math.imul(melange ^ (melange >>> 7), 61 | melange)) ^ melange;
        return ((melange ^ (melange >>> 14)) >>> 0) / 4294967296;
    };
}

function duel(niveauBlanc, niveauNoir, hasard) {
    const partie = creerPartie();
    for (let coup = 0; coup < 260 && !partie.resultat; coup++) {
        const niveau = trait(partie) === 1 ? niveauBlanc : niveauNoir;
        const choix = choisirCoup(partie.position, niveau, { budget: 60, profondeur: niveau === 'facile' ? 2 : 6, hasard });
        jouer(partie, choix.coup);
    }
    return partie;
}

const duelA = duel('difficile', 'facile', graine(7));
check('le niveau difficile bat le facile en blanc',
    duelA.resultat?.gagnant === 1, JSON.stringify({ ...duelA.resultat, ...bilan(duelA) }));

const duelB = duel('facile', 'difficile', graine(11));
check('et le bat aussi en noir',
    duelB.resultat?.gagnant === -1, JSON.stringify({ ...duelB.resultat, ...bilan(duelB) }));

check('une partie entre machines se termine toujours',
    duelA.resultat !== null && duelB.resultat !== null);

// --- Temps ----------------------------------------------------------------

const chronometre = choisirCoup(positionInitiale(), 'difficile', { budget: 150 });
check('la reflexion tient dans le budget donne', chronometre.duree < 900, `${chronometre.duree}ms`);
check('le budget plus large cherche plus loin',
    choisirCoup(positionInitiale(), 'difficile', { budget: 600 }).profondeur >= chronometre.profondeur);

report();
