// La geometrie du damier, et rien d'autre.
//
// Les dames se jouent sur les cases sombres, numerotees a partir du coin
// superieur gauche : 1 a 50 sur un damier 10x10, 1 a 32 sur un 8x8. C'est la
// notation officielle, celle qui s'ecrit « 32-28 » — le moteur travaille
// directement dedans plutot que sur un tableau a moitie vide.
//
// Deux tailles de damier, donc deux geometries, chacune calculee une fois au
// chargement. Aucune fonction du moteur ne refait de division pendant une
// recherche.

// Haut-gauche, haut-droite, bas-gauche, bas-droite. L'ordre compte : les deux
// premieres sont les directions d'avancee des blancs, les deux dernieres
// celles des noirs.
export const DIRECTIONS = [0, 1, 2, 3];
const PAS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export const AVANT_BLANC = [0, 1];
export const AVANT_NOIR = [2, 3];

export function creerGeometrie(cote) {
    const parRangee = cote / 2;
    const CASES = (cote * cote) / 2;

    // Une rangee sur deux est decalee : les cases sombres tombent en colonne
    // impaire sur les rangees paires.
    const rangeeDe = numero => Math.floor((numero - 1) / parRangee);
    const colonneDe = numero => {
        const rangee = rangeeDe(numero);
        return 2 * ((numero - 1) % parRangee) + (rangee % 2 === 0 ? 1 : 0);
    };

    // Position a l'ecran vers case, ou 0 si la case est claire — donc jamais
    // jouable.
    const caseEn = (rangee, colonne) => {
        if (rangee < 0 || rangee >= cote || colonne < 0 || colonne >= cote) return 0;
        if ((rangee + colonne) % 2 === 0) return 0;
        return rangee * parRangee + ((colonne - (rangee % 2 === 0 ? 1 : 0)) >> 1) + 1;
    };

    // VOISIN[numero][direction] : la case adjacente, ou 0 au bord. Indexe a
    // partir de 1 pour que le numero de case serve d'index sans decalage.
    const VOISIN = Array.from({ length: CASES + 1 }, () => [0, 0, 0, 0]);
    for (let numero = 1; numero <= CASES; numero++) {
        const rangee = rangeeDe(numero);
        const colonne = colonneDe(numero);
        for (const direction of DIRECTIONS) {
            const [dr, dc] = PAS[direction];
            VOISIN[numero][direction] = caseEn(rangee + dr, colonne + dc);
        }
    }

    // DIAGONALE[numero][direction] : toutes les cases alignees dans cette
    // direction, de la plus proche a la plus lointaine. C'est le chemin que
    // suit une dame volante ; le moteur n'a plus qu'a s'arreter sur la
    // premiere piece.
    const DIAGONALE = Array.from({ length: CASES + 1 }, () => [[], [], [], []]);
    for (let numero = 1; numero <= CASES; numero++) {
        for (const direction of DIRECTIONS) {
            let courante = VOISIN[numero][direction];
            while (courante) {
                DIAGONALE[numero][direction].push(courante);
                courante = VOISIN[courante][direction];
            }
        }
    }

    const premiereRangee = new Set(Array.from({ length: parRangee }, (_, index) => index + 1));
    const derniereRangee = new Set(Array.from({ length: parRangee }, (_, index) => CASES - parRangee + 1 + index));

    return {
        cote,
        CASES,
        rangeeDe,
        colonneDe,
        caseEn,
        VOISIN,
        DIAGONALE,
        // Les blancs montent : leur rangee de promotion est celle du haut.
        PROMOTION_BLANC: premiereRangee,
        PROMOTION_NOIR: derniereRangee,
        // La distance parcourue depuis son propre camp, en rangees. Sert a
        // l'evaluation : un pion pres de la rangee adverse vaut plus cher.
        rangeeAvance: (numero, camp) => (camp > 0 ? cote - 1 - rangeeDe(numero) : rangeeDe(numero)),
        // Le bord ne peut jamais etre pris — une piece qui s'y tient est a
        // l'abri, mais elle n'a plus que deux directions.
        AU_BORD: new Set(
            Array.from({ length: CASES }, (_, index) => index + 1)
                .filter(numero => VOISIN[numero].filter(Boolean).length < 4)
        )
    };
}
