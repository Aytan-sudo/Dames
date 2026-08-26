// Le damier a l'ecran.
//
// Les cases sont posees une fois par variante ; seules les sombres portent un
// numero et recoivent les appuis. Les pieces vivent dans une couche au-dessus,
// chacune placee par `transform` : deplacer une piece, c'est changer deux
// variables CSS, et la transition fait le reste. Aucun element n'est recree
// pendant une partie, ce qui evite le clignotement et permet a une rafle de
// s'animer d'un saut a l'autre.
//
// Le rendu ne connait aucune regle. Il recoit une geometrie, une position et
// un coup deja valides, et se contente de les montrer.

import { estDame, campDe } from './regles.js';

const DUREE_SAUT = 200;

export function creerRendu({ plateau, damier, couche }) {
    const cases = new Map();      // numero -> element de case sombre
    const pieces = new Map();     // numero -> element de piece
    let geo = null;

    // Change de damier : huit cases de cote ou dix. La variable --cote porte la
    // taille jusqu'a la feuille de style, qui dimensionne la grille et les
    // pieces a partir d'elle.
    function poser(geometrie) {
        geo = geometrie;
        plateau.style.setProperty('--cote', String(geo.cote));

        const fragment = document.createDocumentFragment();
        cases.clear();
        for (let rangee = 0; rangee < geo.cote; rangee++) {
            for (let colonne = 0; colonne < geo.cote; colonne++) {
                const numero = geo.caseEn(rangee, colonne);
                const element = document.createElement('div');
                element.className = numero ? 'case sombre' : 'case claire';
                if (numero) {
                    element.dataset.numero = String(numero);
                    element.append(Object.assign(document.createElement('span'), {
                        className: 'numero',
                        textContent: String(numero)
                    }));
                    cases.set(numero, element);
                }
                fragment.append(element);
            }
        }
        damier.replaceChildren(fragment);
        pieces.clear();
        couche.replaceChildren();
    }

    const placer = (element, numero) => {
        element.style.setProperty('--colonne', geo.colonneDe(numero));
        element.style.setProperty('--rangee', geo.rangeeDe(numero));
    };

    function creerPiece(piece, numero) {
        const element = document.createElement('div');
        element.className = `piece ${campDe(piece) > 0 ? 'blanche' : 'noire'}${estDame(piece) ? ' dame' : ''}`;
        element.innerHTML = '<svg viewBox="0 0 24 24" class="couronne" aria-hidden="true">'
            + '<path d="M5 16h14l1.6-8-4.6 3-4-5.4-4 5.4-4.6-3Z"/></svg>';
        placer(element, numero);
        return element;
    }

    // Repose tout le damier sans animation : ouverture de page, annulation,
    // changement de partie.
    function dessiner(position) {
        const fragment = document.createDocumentFragment();
        pieces.clear();
        for (let numero = 1; numero <= geo.CASES; numero++) {
            const piece = position.cases[numero];
            if (!piece) continue;
            const element = creerPiece(piece, numero);
            pieces.set(numero, element);
            fragment.append(element);
        }
        couche.replaceChildren(fragment);
    }

    const attendre = duree => new Promise(resolve => setTimeout(resolve, duree));

    const animationsCoupees = () =>
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // La duree reellement passee sur chaque saut : zero quand le joueur a
    // demande moins d'animations. Le son s'y cale, pour que les notes d'une
    // rafle suivent les pieces au lieu de trainer derriere elles.
    const dureeSaut = () => (animationsCoupees() ? 0 : DUREE_SAUT);

    // Anime un coup deja joue dans le modele. Chaque saut deplace la piece,
    // marque la victime au passage, et ce n'est qu'a la fin que les pieces
    // mangees quittent le damier — c'est la regle, et c'est aussi le seul
    // moyen de suivre une rafle de quatre a l'oeil nu.
    async function jouer(position, coup) {
        const mobile = pieces.get(coup.de);
        if (!mobile) { dessiner(position); return; }

        const rapide = animationsCoupees();
        pieces.delete(coup.de);
        mobile.classList.add('mobile');

        for (const [index, etape] of coup.chemin.entries()) {
            placer(mobile, etape);
            const mangee = coup.prises[index];
            if (mangee !== undefined) pieces.get(mangee)?.classList.add('mangee');
            if (!rapide) await attendre(DUREE_SAUT);
        }

        for (const prise of coup.prises) {
            const victime = pieces.get(prise);
            if (!victime) continue;
            pieces.delete(prise);
            victime.classList.add('partie');
            setTimeout(() => victime.remove(), rapide ? 0 : DUREE_SAUT);
        }

        mobile.classList.remove('mobile');
        pieces.set(coup.vers, mobile);

        // La promotion se voit a l'arrivee, pas avant : aux internationales, un
        // pion qui traverse la rangee adverse en cours de rafle reste un pion.
        if (estDame(position.cases[coup.vers])) mobile.classList.add('dame');
    }

    // Les surlignages : cases jouables, case tenue, dernier coup. Tout passe
    // par des classes, jamais par du style en ligne — la feuille de style doit
    // pouvoir tout redefinir pour une palette donnee.
    function marquer({ departs = [], cibles = [], tenue = 0, dernier = null, prises = [] } = {}) {
        for (const [numero, element] of cases) {
            element.classList.toggle('depart', departs.includes(numero));
            element.classList.toggle('cible', cibles.includes(numero));
            element.classList.toggle('tenue', numero === tenue);
            element.classList.toggle('trace', Boolean(dernier) && (dernier.de === numero || dernier.vers === numero));
        }
        for (const [numero, element] of pieces) {
            element.classList.toggle('condamnee', prises.includes(numero));
        }
    }

    // Une piece qui refuse de bouger doit le dire, sinon le joueur croit que
    // l'appui n'a pas ete pris en compte et recommence de plus belle.
    function refuser(numero) {
        const element = pieces.get(numero) ?? cases.get(numero);
        if (!element) return;
        element.classList.remove('refus');
        void element.offsetWidth;
        element.classList.add('refus');
        setTimeout(() => element.classList.remove('refus'), 320);
    }

    return { poser, dessiner, jouer, marquer, refuser, dureeSaut, DUREE_SAUT };
}
