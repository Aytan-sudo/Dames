// La saisie d'un coup, case apres case.
//
// Une rafle de dame peut manger les memes pieces par des chemins differents,
// et deux chemins differents ne laissent pas la dame au meme endroit. Un
// glisser-deposer du depart vers l'arrivee ne suffit donc pas a designer un
// coup : il faut parfois passer par les cases intermediaires.
//
// D'ou cette saisie pas a pas — on touche son pion, on touche la case
// suivante, et ainsi de suite. Quand une seule rafle reste compatible, elle
// part d'un coup : personne n'a envie de taper cinq fois pour un coup force.

// Les cases d'ou un coup peut partir. L'interface les allume : avec la prise
// majoritaire, ce sont souvent une ou deux pieces seulement, et les montrer
// evite de chercher pourquoi les autres ne repondent pas.
export const departs = coups => new Set(coups.map(coup => coup.de));

export const compatibles = (coups, depart, etapes) =>
    coups.filter(coup =>
        coup.de === depart
        && etapes.length < coup.chemin.length
        && etapes.every((etape, index) => coup.chemin[index] === etape));

// Les cases jouables a l'etape suivante.
export const suites = (coups, depart, etapes) =>
    new Set(compatibles(coups, depart, etapes).map(coup => coup.chemin[etapes.length]));

// Les pieces que la saisie a deja mangees : le damier les efface au fur et a
// mesure, sinon le joueur perd le fil au milieu d'une rafle de quatre.
//
// Une etape franchie vaut exactement une prise, dame comprise — un saut, une
// piece — et toutes les rafles encore compatibles ont mange les memes.
export function prisesEnCours(coups, depart, etapes) {
    const restants = compatibles(coups, depart, etapes);
    return restants.length ? restants[0].prises.slice(0, etapes.length) : [];
}

// Fait avancer la saisie. Rend soit une saisie prolongee, soit un coup a
// jouer, soit rien du tout si la case touchee ne mene nulle part.
export function avancer(coups, depart, etapes, cible) {
    const restants = compatibles(coups, depart, etapes);
    if (!restants.length) return { rien: true };

    const suivants = restants.filter(coup => coup.chemin[etapes.length] === cible);
    if (suivants.length) {
        const etendu = [...etapes, cible];
        const acheve = suivants.find(coup => coup.chemin.length === etendu.length);
        // Un chemin acheve ne peut pas etre prolonge : toutes les rafles
        // legales prennent le meme nombre de pieces, donc aucune ne continue
        // apres une autre qui s'arrete.
        if (acheve) return { coup: acheve };
        return { etapes: etendu };
    }

    // Raccourci : une seule rafle possible, le joueur touche son arrivee.
    if (restants.length === 1 && restants[0].vers === cible) return { coup: restants[0] };

    return { rien: true };
}
