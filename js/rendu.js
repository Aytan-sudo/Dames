// Le damier a l'ecran.
//
// Les cent cases sont posees une fois pour toutes ; seules les cinquante
// sombres portent un numero et recoivent les appuis. Les pieces vivent dans
// une couche au-dessus, chacune placee par `transform` : deplacer une piece,
// c'est changer deux variables CSS, et la transition fait le reste. Aucun
// element n'est recree pendant une partie, ce qui evite le clignotement et
// permet a une rafle de s'animer d'un saut a l'autre.
//
// Le rendu ne connait aucune regle. Il recoit une position et un coup deja
// valides, et se contente de les montrer.

import { CASES, COTE, RANGEES, rangeeDe, colonneDe, caseEn } from './damier.js';
import { campDe, estDame } from './regles.js';

const DUREE_SAUT = 200;

export function creerRendu({ damier, couche }) {
    const cases = new Map();      // numero -> element de case sombre
    const pieces = new Map();     // numero -> element de piece

    function construire() {
        const fragment = document.createDocumentFragment();
        for (let rangee = 0; rangee < RANGEES; rangee++) {
            for (let colonne = 0; colonne < COTE; colonne++) {
                const numero = caseEn(rangee, colonne);
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
    }

    const poser = (element, numero) => {
        element.style.setProperty('--colonne', colonneDe(numero));
        element.style.setProperty('--rangee', rangeeDe(numero));
    };

    function creerPiece(piece, numero) {
        const element = document.createElement('div');
        element.className = `piece ${campDe(piece) > 0 ? 'blanche' : 'noire'}${estDame(piece) ? ' dame' : ''}`;
        element.innerHTML = '<svg viewBox="0 0 24 24" class="couronne" aria-hidden="true">'
            + '<path d="M5 16h14l1.6-8-4.6 3-4-5.4-4 5.4-4.6-3Z"/></svg>';
        poser(element, numero);
        return element;
    }

    // Repose tout le damier sans animation : ouverture de page, annulation,
    // changement de partie.
    function dessiner(position) {
        const fragment = document.createDocumentFragment();
        pieces.clear();
        for (let numero = 1; numero <= CASES; numero++) {
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
            poser(mobile, etape);
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

        // La promotion se voit a l'arrivee, pas avant : un pion qui traverse
        // la rangee adverse en cours de rafle reste un pion.
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

    const elementDe = numero => pieces.get(numero) ?? null;

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

    construire();
    return { construire, dessiner, jouer, marquer, refuser, elementDe, DUREE_SAUT };
}
