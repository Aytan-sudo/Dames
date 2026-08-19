// La geometrie. Tout le reste en depend : une table de voisins fausse donne un
// jeu qui a l'air de marcher et qui interdit un coup sur dix.

import { counter } from './harness.mjs';
import { geometrieDe } from '../js/variantes.js';

const {
    CASES, VOISIN, DIAGONALE, caseEn, rangeeDe, colonneDe,
    PROMOTION_BLANC, PROMOTION_NOIR, AU_BORD, rangeeAvance
} = geometrieDe('international');

const { check, report } = counter();
console.log('\nDamier\n');

const toutes = Array.from({ length: CASES }, (_, index) => index + 1);

check('cinquante cases jouables', CASES === 50);
check('chaque case revient sur elle-meme',
    toutes.every(numero => caseEn(rangeeDe(numero), colonneDe(numero)) === numero));
check('les cases claires n en sont pas',
    caseEn(0, 0) === 0 && caseEn(1, 1) === 0 && caseEn(9, 9) === 0);
check('la case 1 est en haut a gauche', rangeeDe(1) === 0 && colonneDe(1) === 1);
check('la case 46 est en bas a gauche', rangeeDe(46) === 9 && colonneDe(46) === 0);
check('la case 50 est en bas a droite', rangeeDe(50) === 9 && colonneDe(50) === 8);

// La case 28 est au milieu du damier : ses quatre voisins sont connus de tout
// joueur, et c'est le meilleur controle possible de la table.
check('la case 28 a les quatre voisins attendus',
    VOISIN[28].join(',') === '22,23,32,33', VOISIN[28].join(','));

check('le voisinage est reciproque', toutes.every(numero =>
    VOISIN[numero].every((voisin, direction) => {
        if (!voisin) return true;
        const retour = direction === 0 ? 3 : direction === 1 ? 2 : direction === 2 ? 1 : 0;
        return VOISIN[voisin][retour] === numero;
    })));

check('la grande diagonale 46-5 fait neuf cases',
    DIAGONALE[46][1].join(',') === '41,37,32,28,23,19,14,10,5', DIAGONALE[46][1].join(','));
check('une case du bord n a rien derriere elle',
    DIAGONALE[5][1].length === 0 && DIAGONALE[46][2].length === 0);
check('les diagonales partent bien du voisin',
    toutes.every(numero => [0, 1, 2, 3].every(direction =>
        DIAGONALE[numero][direction][0] === (VOISIN[numero][direction] || undefined))));

check('les rangees de promotion sont les bonnes',
    [...PROMOTION_BLANC].join(',') === '1,2,3,4,5' && [...PROMOTION_NOIR].join(',') === '46,47,48,49,50');
check('l avance se compte depuis son propre camp',
    rangeeAvance(48, 1) === 0 && rangeeAvance(3, 1) === 9
    && rangeeAvance(3, -1) === 0 && rangeeAvance(48, -1) === 9);

check('dix-huit cases touchent le bord', AU_BORD.size === 18, String(AU_BORD.size));
check('les cases du bord ont moins de quatre voisins',
    [...AU_BORD].every(numero => VOISIN[numero].filter(Boolean).length < 4));
check('la case 28 n est pas au bord', !AU_BORD.has(28));

report();
