// Les appuis et les touches.
//
// Le damier se joue au doigt comme a la souris, avec le meme geste : on touche
// sa piece, on touche la case ou elle va. Pas de glisser-deposer — une rafle
// de dame passe par des cases intermediaires qu'un simple depart-arrivee ne
// saurait pas designer, et le tir au doigt sur un damier 10x10 est deja assez
// serre comme ca.
//
// Les pieces ne recoivent jamais les appuis : c'est la case dessous qui les
// prend (la feuille de style neutralise la couche des pieces). Sans cela, un
// appui sur un pion tomberait a cote de la case qui l'interesse.

export function ecouterDamier(damier, surCase) {
    // `pointerdown` plutot que `click` : le coup part a l'appui, sans les
    // trois cents millisecondes que certains navigateurs mobiles gardent en
    // reserve pour un eventuel double-tap.
    damier.addEventListener('pointerdown', evenement => {
        if (evenement.button !== undefined && evenement.button !== 0) return;
        const cible = evenement.target.closest('.case.sombre');
        if (!cible) return;
        evenement.preventDefault();
        surCase(Number(cible.dataset.numero));
    });

    // Un damier reste une image : un appui long dessus ne doit pas proposer de
    // l'enregistrer, ni selectionner la numerotation des cases.
    damier.addEventListener('contextmenu', evenement => evenement.preventDefault());
}

export function ecouterClavier(raccourcis) {
    addEventListener('keydown', evenement => {
        if (evenement.metaKey || evenement.altKey) return;
        const cible = evenement.target;
        if (cible instanceof HTMLElement && cible.closest('input, textarea, select')) return;
        // Un dialogue ouvert garde ses touches : Echap doit le refermer, et
        // « nouvelle partie » ne doit pas partir derriere les reglages.
        if (document.querySelector('dialog[open]')) return;

        // Ctrl+Z reste l'annulation attendue partout ailleurs ; autant qu'elle
        // marche ici aussi.
        const touche = evenement.ctrlKey
            ? (evenement.key.toLowerCase() === 'z' ? 'annuler' : null)
            : evenement.key.toLowerCase();

        const action = touche && raccourcis[touche];
        if (!action) return;
        evenement.preventDefault();
        action();
    });
}
