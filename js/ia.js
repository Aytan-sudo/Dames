// L'adversaire.
//
// Un alpha-beta avec approfondissement progressif, arrete par le temps plutot
// que par la profondeur : une position ou tout est force se calcule tres loin,
// une position ouverte beaucoup moins, et fixer une profondeur unique donnerait
// une machine tantot instantanee tantot interminable.
//
// Deux precautions qui comptent plus que la profondeur :
//
//   — on ne s'arrete jamais d'evaluer sur une prise en suspens. Aux dames une
//     prise est obligatoire ; couper la recherche juste avant, c'est croire
//     qu'on vient de gagner un pion quand on vient d'en perdre trois.
//   — le niveau facile ne joue pas moins profond seulement, il juge de travers
//     — un bruit ajoute a l'evaluation. Une machine qui voit tout a deux coups
//     et rien au troisieme est desagreable a jouer : elle ne rate que ce qui
//     est loin, donc elle ne rate jamais rien de ce que le debutant tente.
//
// Les tables d'evaluation dependent du damier : elles sont calculees une fois
// par variante, a la premiere partie qui en a besoin.

import { geometrieDe, varianteDe } from './variantes.js';
import { BLANC, NOIR, PION, DAME, coupsLegaux, appliquer, campDe, estDame } from './regles.js';

export const NIVEAUX = [
    { id: 'facile', libelle: 'Facile', profondeur: 2, budget: 120, bruit: 55 },
    { id: 'normal', libelle: 'Normal', profondeur: 6, budget: 450, bruit: 12 },
    { id: 'difficile', libelle: 'Difficile', profondeur: 14, budget: 1600, bruit: 0 }
];

export const niveauDe = id => NIVEAUX.find(niveau => niveau.id === id) ?? NIVEAUX[1];

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

    if (profondeur <= 0) {
        const enSuspens = coups[0].prises.length > 0;
        if (!enSuspens || ply >= contexte.plyMax) {
            return evaluer(position) * position.trait + contexte.bruit();
        }
    }

    let meilleur = -Infinity;
    for (const coup of ordonner(coups, ply === 0 ? contexte.prefere : null)) {
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
    const bruit = niveau.bruit
        ? () => Math.trunc((hasard() * 2 - 1) * niveau.bruit)
        : () => 0;

    const contexte = {
        noeuds: 0,
        echeance: performance.now() + (options.budget ?? niveau.budget),
        plyMax: (options.profondeur ?? niveau.profondeur) + 8,
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
    for (let profondeur = 1; profondeur <= (options.profondeur ?? niveau.profondeur); profondeur++) {
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

    return {
        coup: choisi,
        score,
        profondeur: atteinte,
        noeuds: contexte.noeuds,
        duree: Math.round(performance.now() - depart)
    };
}

export { BLANC, NOIR, PION, DAME };
