// L'adversaire.
//
// Un alpha-beta avec approfondissement progressif, arrete par le temps plutot
// que par la profondeur : une position ou tout est force se calcule tres loin,
// une position ouverte beaucoup moins, et fixer une profondeur unique donnerait
// une machine tantot instantanee tantot interminable.
//
// Une precaution qui compte plus que la profondeur : on ne s'arrete jamais
// d'evaluer sur une prise en suspens. Aux dames une prise est obligatoire ;
// couper la recherche juste avant, c'est croire qu'on vient de gagner un pion
// quand on vient d'en perdre trois.
//
// C'est justement ce filet qui rendait les trois niveaux indiscernables. Aux
// dames, presque toute la tactique tient dans des suites forcees : une machine
// qui les resout toutes, meme en ne cherchant qu'a deux demi-coups, ne rate
// rien de ce qu'un debutant peut lui tendre. Baisser la profondeur ne la
// rendait donc pas plus facile a battre — seulement moins bonne a preparer un
// gain lointain, ce qui ne se voit pas quand on perd en vingt coups.
//
// D'ou quatre reglages par niveau plutot qu'un, et une regle simple : ce qui
// distingue les niveaux faciles, c'est ce qu'ils ne voient pas.
//
//   — profondeur : jusqu'ou la recherche va, en demi-coups. Un « coup » au sens
//     du joueur en vaut deux : le sien et la reponse.
//   — riposte : de combien de demi-coups la resolution des prises depasse cette
//     profondeur. A zero, la machine s'arrete juste apres son propre coup et ne
//     voit pas la reprise — elle donne des pieces, comme un debutant.
//   — bruit : de combien elle se trompe en jugeant une position.
//   — etourderie : la part des coups ou elle joue autre chose que son meilleur.
//     C'est le seul reglage qui se remarque tout de suite, et le seul qui rende
//     une partie gagnable a un joueur qui debute.
//
// Les tables d'evaluation dependent du damier : elles sont calculees une fois
// par variante, a la premiere partie qui en a besoin.

import { geometrieDe, varianteDe } from './variantes.js';
import { BLANC, NOIR, PION, DAME, coupsLegaux, appliquer, campDe, estDame, reglesDe } from './regles.js';

export const NIVEAUX = [
    {
        id: 'debutant', libelle: 'Très facile',
        profondeur: 1, budget: 60, riposte: 0, bruit: 70, etourderie: 0.35,
        resume: 'Ne regarde pas plus loin que son propre coup : il prend ce qui passe sans voir la reprise, et laisse des pièces en chemin.'
    },
    {
        id: 'facile', libelle: 'Facile',
        profondeur: 2, budget: 120, riposte: 2, bruit: 40, etourderie: 0.12,
        resume: 'Voit un coup à l\'avance : il ne se laisse plus manger bêtement, mais ne prépare rien et se distrait encore.'
    },
    {
        id: 'normal', libelle: 'Normal',
        profondeur: 4, budget: 400, riposte: 6, bruit: 10, etourderie: 0,
        resume: 'Voit deux coups à l\'avance et déroule les rafles jusqu\'au bout. Il ne se trompe plus de lui-même.'
    },
    {
        id: 'difficile', libelle: 'Difficile',
        profondeur: 16, budget: 1600, riposte: 10, bruit: 0, etourderie: 0,
        resume: 'Cherche aussi loin que la seconde et demie qu\'on lui laisse le permet — souvent huit coups, davantage en finale.'
    }
];

// Le repli est le niveau normal, nomme : le prendre par son rang dans la liste
// designerait un autre niveau des qu'on en ajoute un.
export const niveauDe = id => NIVEAUX.find(niveau => niveau.id === id)
    ?? NIVEAUX.find(niveau => niveau.id === 'normal');

const VALEUR_PION = 100;
const VALEUR_DAME = 310;
const MAT = 100000;

const tablesParVariante = new Map();

function tablesDe(idVariante) {
    const connue = tablesParVariante.get(idVariante);
    if (connue) return connue;

    const variante = varianteDe(idVariante);
    const geo = geometrieDe(idVariante);

    // Ce que vaut une rangee gagnee, en progression : les premiers pas ne
    // changent rien a la partie, le dernier vaut presque une dame.
    const avance = Array.from({ length: geo.cote }, (_, rangee) =>
        Math.round(34 * Math.min(1, rangee / (geo.cote - 2)) ** 2));

    // Le centre vaut mieux que le bord pour un pion — plus de cases
    // atteignables, plus de menaces. Le bord, lui, est imprenable : c'est un
    // autre genre de valeur, comptee a part.
    const centre = new Int8Array(geo.CASES + 1);
    const milieu = (geo.cote - 1) / 2;
    for (let numero = 1; numero <= geo.CASES; numero++) {
        centre[numero] = Math.trunc(milieu - Math.abs(geo.colonneDe(numero) - milieu)) / 2 | 0;
    }

    const tables = {
        geo,
        avance,
        centre,
        // Les cases du fond. Les garder empeche l'adversaire d'y faire dame, et
        // c'est la seule raison de ne pas les avancer.
        fondBlanc: geo.PROMOTION_NOIR,
        fondNoir: geo.PROMOTION_BLANC,
        piecesAuDepart: geo.cote * variante.rangeesDePieces
    };

    tablesParVariante.set(idVariante, tables);
    return tables;
}

// Positif : les blancs sont mieux.
export function evaluer(position) {
    const { geo, avance, centre, fondBlanc, fondNoir, piecesAuDepart } = tablesDe(position.variante);
    let score = 0;
    let pieces = 0;
    let materiel = 0;

    for (let numero = 1; numero <= geo.CASES; numero++) {
        const piece = position.cases[numero];
        if (!piece) continue;
        pieces++;

        const camp = campDe(piece);
        if (estDame(piece)) {
            materiel += camp * VALEUR_DAME;
            score += camp * (VALEUR_DAME + centre[numero]);
            continue;
        }

        materiel += camp * VALEUR_PION;
        let valeur = VALEUR_PION + avance[geo.rangeeAvance(numero, camp)] + centre[numero];
        if (geo.AU_BORD.has(numero)) valeur += 4;
        if (camp === BLANC ? fondBlanc.has(numero) : fondNoir.has(numero)) valeur += 6;
        score += camp * valeur;
    }

    // Qui mene a interet aux echanges : a materiel egal en proportion, moins il
    // reste de pieces, plus l'avance est decisive. Sans ce terme la machine
    // gagne un pion puis refuse tous les echanges qui le concretiseraient.
    if (materiel !== 0) score += Math.trunc((materiel * (piecesAuDepart - pieces)) / 60);

    return score;
}

const ARRET = Symbol('temps ecoule');

// Les prises d'abord, les plus grosses en tete : quand une rafle a quatre
// pieces existe, l'examiner en premier coupe presque tout le reste.
function ordonner(coups, prefere) {
    const notes = new Map();
    for (const coup of coups) {
        let note = coup.prises.length * 10;
        if (prefere && coup.de === prefere.de && coup.vers === prefere.vers) note += 1000;
        notes.set(coup, note);
    }
    return [...coups].sort((a, b) => notes.get(b) - notes.get(a));
}

function negamax(position, profondeur, alpha, beta, ply, contexte) {
    contexte.noeuds++;
    if ((contexte.noeuds & 511) === 0 && performance.now() > contexte.echeance) throw ARRET;

    const coups = coupsLegaux(position);

    // Plus aucun coup : le camp au trait a perdu. Le ply rend les mats proches
    // preferables aux mats lointains — sans lui la machine gagne « un jour ».
    if (coups.length === 0) return -MAT + ply;

    let meilleur = -Infinity;

    if (profondeur <= 0) {
        // `plyMax` est la borne du niveau : au-dela, on evalue meme au milieu
        // d'une rafle. C'est faux, et c'est voulu — un niveau facile doit se
        // tromper quelque part, et se tromper la ressemble a un debutant qui
        // ne voit pas la reprise.
        const enSuspens = coups[0].prises.length > 0;
        if (!enSuspens || ply >= contexte.plyMax) {
            return evaluer(position) * position.trait + contexte.bruit();
        }
        // Quand la prise n'est plus obligatoire — une regle maison —, ne pas
        // manger est un coup comme un autre : la resolution doit pouvoir
        // s'arreter la, sinon la machine se croit forcee dans ses propres
        // mauvaises prises.
        if (!contexte.priseForcee) {
            meilleur = evaluer(position) * position.trait + contexte.bruit();
            if (meilleur >= beta) return meilleur;
            if (meilleur > alpha) alpha = meilleur;
        }
    }

    // Passe la profondeur, seules les prises se poursuivent. La distinction ne
    // se voit qu'en regle maison : ailleurs, la prise obligatoire a deja fait
    // le tri.
    const explorables = profondeur > 0 || contexte.priseForcee
        ? coups
        : coups.filter(coup => coup.prises.length > 0);

    for (const coup of ordonner(explorables, ply === 0 ? contexte.prefere : null)) {
        const score = -negamax(appliquer(position, coup), profondeur - 1, -beta, -alpha, ply + 1, contexte);
        if (score > meilleur) {
            meilleur = score;
            if (ply === 0) contexte.meilleurCoup = coup;
        }
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
    }
    return meilleur;
}

// Rend le coup choisi, avec de quoi le raconter : profondeur atteinte, noeuds
// visites, temps passe. L'interface n'en montre rien, les tests si.
export function choisirCoup(position, idNiveau = 'normal', options = {}) {
    const niveau = niveauDe(idNiveau);
    const coups = coupsLegaux(position);
    if (!coups.length) return null;
    if (coups.length === 1) {
        return { coup: coups[0], score: 0, profondeur: 0, noeuds: 0, duree: 0, force: true };
    }

    const hasard = options.hasard ?? Math.random;
    const force = niveau.bruit ?? 0;
    const bruit = force ? () => Math.trunc((hasard() * 2 - 1) * force) : () => 0;
    const fond = options.profondeur ?? niveau.profondeur;

    const contexte = {
        noeuds: 0,
        echeance: performance.now() + (options.budget ?? niveau.budget),
        plyMax: fond + (options.riposte ?? niveau.riposte),
        priseForcee: reglesDe(position).priseObligatoire !== false,
        bruit,
        prefere: null,
        meilleurCoup: null
    };

    const depart = performance.now();
    let choisi = coups[0];
    let score = 0;
    let atteinte = 0;

    // Approfondissement progressif : chaque passe reste utilisable seule, et
    // celle qui est interrompue est simplement jetee.
    for (let profondeur = 1; profondeur <= fond; profondeur++) {
        contexte.meilleurCoup = null;
        try {
            score = negamax(position, profondeur, -Infinity, Infinity, 0, contexte);
        } catch (erreur) {
            if (erreur !== ARRET) throw erreur;
            break;
        }
        if (contexte.meilleurCoup) {
            choisi = contexte.meilleurCoup;
            contexte.prefere = choisi;
            atteinte = profondeur;
        }
        if (Math.abs(score) > MAT / 2) break;         // gain force trouve
        if (performance.now() > contexte.echeance) break;
    }

    // L'etourderie, en dernier : la machine a trouve son meilleur coup, et en
    // joue un autre. C'est ce qui separe vraiment les niveaux du point de vue
    // du joueur — une machine qui cherche moins loin reste imbattable pour qui
    // debute, une machine qui laisse passer un coup sur trois ne l'est plus.
    const etourderie = options.etourderie ?? niveau.etourderie ?? 0;
    let etourdi = false;
    if (etourderie > 0 && hasard() < etourderie) {
        const autres = coups.filter(coup => coup !== choisi);
        if (autres.length) {
            choisi = autres[Math.min(autres.length - 1, Math.floor(hasard() * autres.length))];
            etourdi = true;
        }
    }

    return {
        coup: choisi,
        score,
        profondeur: atteinte,
        noeuds: contexte.noeuds,
        duree: Math.round(performance.now() - depart),
        etourdi
    };
}

export { BLANC, NOIR, PION, DAME };
