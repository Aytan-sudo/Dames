// La geometrie du damier, et rien d'autre.
//
// Les dames internationales se jouent sur les 50 cases sombres d'un damier
// 10x10, numerotees de 1 a 50 depuis le coin superieur gauche. C'est la
// notation officielle, celle qui s'ecrit « 32-28 » : le moteur travaille
// directement dedans plutot que sur un tableau de 100 cases a moitie vide.
//
// Tout ce qui suit se calcule une fois au chargement. Aucune fonction du
// moteur ne refait de division pendant une recherche.

export const CASES = 50;
export const COTE = 10;          // le damier reste 10x10 pour l'affichage
export const RANGEES = 10;

// Haut-gauche, haut-droite, bas-gauche, bas-droite. L'ordre compte : les deux
// premieres sont les directions d'avancee des blancs, les deux dernieres
// celles des noirs.
export const DIRECTIONS = [0, 1, 2, 3];
const PAS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export const AVANT_BLANC = [0, 1];
export const AVANT_NOIR = [2, 3];

// Case (1..50) vers position a l'ecran. Une rangee sur deux est decalee : les
// cases sombres tombent en colonne impaire sur les rangees paires.
export const rangeeDe = numero => Math.floor((numero - 1) / 5);
export const colonneDe = numero => {
    const rangee = rangeeDe(numero);
    return 2 * ((numero - 1) % 5) + (rangee % 2 === 0 ? 1 : 0);
};

// Position a l'ecran vers case, ou 0 si la case est claire — donc jamais
// jouable.
export function caseEn(rangee, colonne) {
    if (rangee < 0 || rangee >= RANGEES || colonne < 0 || colonne >= COTE) return 0;
    if ((rangee + colonne) % 2 === 0) return 0;
    return rangee * 5 + ((colonne - (rangee % 2 === 0 ? 1 : 0)) >> 1) + 1;
}

// VOISIN[numero][direction] : la case adjacente, ou 0 au bord. Indexe a partir
// de 1 pour que le numero de case serve d'index sans decalage.
export const VOISIN = (() => {
    const table = Array.from({ length: CASES + 1 }, () => [0, 0, 0, 0]);
    for (let numero = 1; numero <= CASES; numero++) {
        const rangee = rangeeDe(numero);
        const colonne = colonneDe(numero);
        for (const direction of DIRECTIONS) {
            const [dr, dc] = PAS[direction];
            table[numero][direction] = caseEn(rangee + dr, colonne + dc);
        }
    }
    return table;
})();

// DIAGONALE[numero][direction] : toutes les cases alignees dans cette
// direction, de la plus proche a la plus lointaine. C'est le chemin que suit
// une dame ; le moteur n'a plus qu'a s'arreter sur la premiere piece.
export const DIAGONALE = (() => {
    const table = Array.from({ length: CASES + 1 }, () => [[], [], [], []]);
    for (let numero = 1; numero <= CASES; numero++) {
        for (const direction of DIRECTIONS) {
            const ligne = [];
            let courante = VOISIN[numero][direction];
            while (courante) {
                ligne.push(courante);
                courante = VOISIN[courante][direction];
            }
            table[numero][direction] = ligne;
        }
    }
    return table;
})();

// Les rangees de promotion : la premiere pour les blancs, qui montent, la
// derniere pour les noirs.
export const PROMOTION_BLANC = new Set([1, 2, 3, 4, 5]);
export const PROMOTION_NOIR = new Set([46, 47, 48, 49, 50]);

// La distance a la promotion, en rangees. Sert a l'evaluation : un pion pres
// de la rangee adverse vaut plus cher qu'un pion reste au fond.
export const rangeeAvance = (numero, camp) =>
    camp > 0 ? RANGEES - 1 - rangeeDe(numero) : rangeeDe(numero);

// Le bord ne peut jamais etre pris — une piece qui s'y tient est a l'abri,
// mais elle n'a plus que deux directions.
export const AU_BORD = new Set(
    Array.from({ length: CASES }, (_, i) => i + 1)
        .filter(numero => VOISIN[numero].filter(Boolean).length < 4)
);
