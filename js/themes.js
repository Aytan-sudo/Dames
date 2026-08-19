// Le theme, en deux reglages independants.
//
// La palette dit de quoi est fait le damier — bois, ardoise, tapis vert. Le
// mode clair ou sombre ne touche pas au damier lui-meme : il change ce qu'il y
// a autour, la page, les panneaux, et adoucit un peu les cases claires pour
// qu'un damier ne brule pas les yeux a minuit.
//
// Les deux se combinent, ce qui evite d'ecrire dix palettes pour en proposer
// cinq.

export const MODES = [
    { id: 'auto', libelle: 'Système' },
    { id: 'clair', libelle: 'Clair' },
    { id: 'sombre', libelle: 'Sombre' }
];

export const PALETTES = [
    {
        id: 'bois', libelle: 'Bois',
        claire: '#e8d3ac', sombre: '#8f5c33',
        pionClair: '#f6ead6', pionFonce: '#2f2622', accent: '#b5793f'
    },
    {
        id: 'foret', libelle: 'Forêt',
        claire: '#e6e6cf', sombre: '#3f6b4a',
        pionClair: '#f7f4e6', pionFonce: '#20302a', accent: '#4f8a5e'
    },
    {
        id: 'ardoise', libelle: 'Ardoise',
        claire: '#d6dae0', sombre: '#4d5762',
        pionClair: '#f2f5f8', pionFonce: '#23282f', accent: '#7d8b9c'
    },
    {
        id: 'encre', libelle: 'Encre',
        claire: '#ced8e8', sombre: '#31456b',
        pionClair: '#eef3fb', pionFonce: '#1b2233', accent: '#5b7bb5'
    },
    {
        id: 'brique', libelle: 'Brique',
        claire: '#efd9c9', sombre: '#8c4634',
        pionClair: '#fbeee3', pionFonce: '#33211c', accent: '#c05f45'
    },
    {
        id: 'nuit', libelle: 'Nuit',
        claire: '#8d93a3', sombre: '#2b2f3b',
        pionClair: '#e9ecf3', pionFonce: '#12151c', accent: '#8f7ad6'
    }
];

export const paletteDe = id => PALETTES.find(palette => palette.id === id) ?? PALETTES[0];

export const systemeEnSombre = () =>
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export const modeEffectif = mode => (mode === 'auto' ? (systemeEnSombre() ? 'sombre' : 'clair') : mode);

export function appliquer({ mode, palette }) {
    const racine = document.documentElement;

    // 'auto' ne pose rien : c'est l'absence d'attribut qui laisse la main a
    // prefers-color-scheme, et donc au systeme qui change tout seul le soir.
    if (mode === 'auto') delete racine.dataset.mode;
    else racine.dataset.mode = mode;

    // Les couleurs de chaque palette sont ecrites dans la feuille de style,
    // pas posees ici : le petit script en tete de page peut alors retablir la
    // palette du joueur avant le premier rendu, sans attendre les modules. Les
    // memes valeurs vivent dans PALETTES pour les pastilles des reglages, et
    // un test s'assure que les deux listes ne divergent pas.
    const choisie = paletteDe(palette);
    racine.dataset.palette = choisie.id;

    // La barre du telephone prend la couleur du bandeau, qui depend des deux
    // reglages a la fois : c'est le navigateur qui la peint, il faut la lui
    // donner calculee.
    const meta = document.getElementById('couleur-barre');
    if (meta) {
        meta.content = modeEffectif(mode) === 'sombre' ? '#141821' : choisie.sombre;
    }
}

// Le bouton du bandeau bascule entre clair et sombre a partir de ce qui est
// affiche : deux etats visibles valent mieux qu'un cycle a trois temps ou l'on
// ne sait jamais ou l'on va tomber. Le mode systeme reste dans les reglages.
export const modeSuivant = mode => (modeEffectif(mode) === 'sombre' ? 'clair' : 'sombre');
