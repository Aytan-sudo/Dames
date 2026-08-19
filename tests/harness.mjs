// Harnais commun aux tests. Le noyau du jeu — damier, regles, partie, ia — ne
// touche pas au DOM : il se teste en Node, sans navigateur.

import { CASES } from '../js/damier.js';
import { PION, DAME, BLANC, NOIR, coupsLegaux, appliquer, noterCoup, memeCoup } from '../js/regles.js';

export function counter() {
    const etat = { pass: 0, fail: 0 };
    const check = (libelle, condition, detail = '') => {
        if (condition) { etat.pass++; console.log(`  OK    ${libelle}`); }
        else { etat.fail++; console.log(`  ECHEC ${libelle} ${detail}`); }
    };
    const report = () => {
        console.log(`\n${etat.pass} reussis, ${etat.fail} echecs\n`);
        process.exit(etat.fail === 0 ? 0 : 1);
    };
    return { check, report };
}

// Une position posee a la main, en numeros de cases officiels. Un damier ecrit
// en tableau de cinquante entiers ne se relit pas, et un test qu'on ne relit
// pas ne se corrige pas.
export function position({ blancs = [], noirs = [], damesBlanches = [], damesNoires = [], trait = BLANC } = {}) {
    const cases = new Int8Array(CASES + 1);
    for (const numero of blancs) cases[numero] = PION;
    for (const numero of noirs) cases[numero] = -PION;
    for (const numero of damesBlanches) cases[numero] = DAME;
    for (const numero of damesNoires) cases[numero] = -DAME;
    return { cases, trait };
}

// Les coups d'une position, ecrits comme on les lit dans une revue : « 32x23 ».
// Tries, pour que le test ne depende pas de l'ordre de generation.
export const notations = pos => coupsLegaux(pos).map(noterCoup).sort();

// Le detail d'une rafle : par ou elle passe, ce qu'elle mange.
export const detail = coup => `${coup.de}>${coup.chemin.join('>')} x${coup.prises.join(',')}`;

export const trouver = (pos, texte) => coupsLegaux(pos).find(coup => noterCoup(coup) === texte);

// Joue une suite de coups ecrits en notation. Rend la position finale, ou
// leve : un test qui continue apres un coup refuse ne teste plus rien.
export function suite(pos, textes) {
    let courante = pos;
    for (const texte of textes) {
        const coup = trouver(courante, texte);
        if (!coup) throw new Error(`coup impossible : ${texte} (possibles : ${notations(courante).join(' ')})`);
        courante = appliquer(courante, coup);
    }
    return courante;
}

export const contenu = pos => {
    const lignes = [];
    for (let numero = 1; numero <= CASES; numero++) {
        if (pos.cases[numero]) lignes.push(`${numero}:${pos.cases[numero]}`);
    }
    return lignes.join(' ');
};

export { CASES, BLANC, NOIR, PION, DAME, coupsLegaux, appliquer, noterCoup, memeCoup };
