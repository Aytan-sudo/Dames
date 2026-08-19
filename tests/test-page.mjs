// Verifications structurelles de la page. Rien de ce qui est attrape ici ne
// provoque d'exception : ca laisse un bouton muet, une couleur qui ne suit pas,
// un fichier absent du cache hors ligne, ou une version publiee que personne ne
// recoit. Autant de pannes silencieuses.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counter } from './harness.mjs';
import { PALETTES, MODES } from '../js/themes.js';
import { NIVEAUX } from '../js/ia.js';

const { check, report } = counter();
console.log('\nPage\n');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');

const page = lire('index.html');
const worker = lire('sw.js');
const style = lire('css/style.css');
const manifeste = JSON.parse(lire('manifest.webmanifest'));
const paquet = JSON.parse(lire('package.json'));

// Ce que la page charge vraiment : on suit les imports depuis app.js plutot
// que de se fier a une liste tenue a la main.
function modulesCharges(depart) {
    const vus = new Set();
    const aVoir = [depart];
    while (aVoir.length) {
        const nom = aVoir.pop();
        if (vus.has(nom)) continue;
        vus.add(nom);
        for (const [, cible] of lire(`js/${nom}`).matchAll(/from\s+'\.\/([\w-]+\.js)'/g)) aVoir.push(cible);
    }
    return vus;
}

const charges = modulesCharges('app.js');
const tous = readdirSync(join(racine, 'js')).filter(nom => nom.endsWith('.js'));

check('la page charge le moteur, la saisie et l adversaire',
    ['regles.js', 'damier.js', 'partie.js', 'selection.js', 'ia.js', 'rendu.js', 'entree.js']
        .every(nom => charges.has(nom)));
check('aucun module du dossier n est orphelin',
    tous.every(nom => charges.has(nom)), tous.filter(nom => !charges.has(nom)).join(' '));

// --- Cache hors ligne -----------------------------------------------------

const coquille = [...worker.matchAll(/^\s+'([^']+)',?$/gm)].map(([, chemin]) => chemin);
const absents = [...charges].filter(nom => !coquille.includes(`js/${nom}`));
check('le service worker connait tous les modules charges', absents.length === 0, absents.join(' '));
check('il met en cache la feuille de style et le manifeste',
    coquille.includes('css/style.css') && coquille.includes('manifest.webmanifest'));
const manquants = coquille.filter(chemin => chemin !== './' && !existsSync(join(racine, chemin)));
check('tous les fichiers de la coquille existent', manquants.length === 0, manquants.join(' '));

// Le numero de version vit a trois endroits, et les trois doivent s'accorder.
// Celui du cache surtout : un cache qui garde son nom garde son contenu, donc
// une version publiee sans le renommer ne parvient jamais aux joueurs qui ont
// installe le jeu — ils continuent de jouer l'ancienne, sans le savoir.
check('le numero de version est un numero', /^\d+\.\d+\.\d+$/.test(paquet.version), paquet.version);
// ui.js pose ses elements des le chargement : il ne s'importe pas hors du
// navigateur, on lit donc son texte.
check('les reglages affichent la version de package.json',
    lire('js/ui.js').includes(`export const VERSION = '${paquet.version}'`), paquet.version);
check('le cache du service worker porte la version',
    worker.includes(`const VERSION = 'dames-${paquet.version}'`), paquet.version);
check('les reglages ont bien un endroit ou l afficher', page.includes('id="version"'));

// --- Identifiants ---------------------------------------------------------

// Une faute de frappe ici ne fait rien planter : elle rend un bouton inerte.
const cherches = new Set();
for (const nom of ['ui.js', 'app.js', 'rendu.js']) {
    // ui.js passe par un raccourci `$('id')` ; rendu.js appelle la methode en
    // clair. Les deux formes designent la meme chose.
    for (const [, id] of lire(`js/${nom}`).matchAll(/(?:getElementById|\$)\('([\w-]+)'\)/g)) cherches.add(id);
}
const inconnus = [...cherches].filter(id => !page.includes(`id="${id}"`));
check(`les ${cherches.size} identifiants cherches existent dans la page`,
    inconnus.length === 0, inconnus.join(' '));

// --- Themes ---------------------------------------------------------------

// Les couleurs sont ecrites deux fois : dans la feuille de style, pour que le
// script en tete de page retablisse la palette avant le premier rendu, et dans
// themes.js pour les pastilles des reglages. Deux listes, une seule verite.
const variables = { claire: '--case-claire', sombre: '--case-sombre', pionClair: '--pion-clair', pionFonce: '--pion-fonce', accent: '--accent' };

const bloc = id => {
    const debut = style.indexOf(`:root[data-palette="${id}"]`);
    return debut === -1 ? null : style.slice(debut, style.indexOf('}', debut));
};

const defaut = style.slice(style.indexOf(':root {'), style.indexOf('}', style.indexOf(':root {')));
check('la palette par defaut du style est la premiere de la liste',
    Object.entries(variables).every(([champ, variable]) => defaut.includes(`${variable}: ${PALETTES[0][champ]};`)),
    PALETTES[0].id);

const divergentes = PALETTES.slice(1).filter(palette => {
    const regles = bloc(palette.id);
    return !regles || !Object.entries(variables).every(([champ, variable]) => regles.includes(`${variable}: ${palette[champ]};`));
});
check(`les ${PALETTES.length} palettes ont les memes couleurs des deux cotes`,
    divergentes.length === 0, divergentes.map(palette => palette.id).join(' '));

check('le script en tete de page accepte la longueur des identifiants de palette',
    PALETTES.every(palette => /^[a-z]{4,8}$/.test(palette.id)),
    PALETTES.map(palette => palette.id).filter(id => !/^[a-z]{4,8}$/.test(id)).join(' '));

check('le mode sombre est prevu deux fois : choisi, et suivi du systeme',
    style.includes(':root[data-mode="sombre"]') && style.includes('prefers-color-scheme: dark'));
check('un theme clair choisi resiste a un systeme sombre',
    style.includes(':root:not([data-mode="clair"])'));
check('le script en tete de page lit la meme cle que le stockage',
    page.includes("localStorage.getItem('dames.preferences')"));
check('les trois modes et les trois niveaux sont proposes',
    MODES.length === 3 && NIVEAUX.length === 3);

// --- Geste ----------------------------------------------------------------

// La couche des pieces couvre le damier entier. Si elle recevait les appuis,
// toucher un pion ne designerait plus la case dessous — et un damier ou l'on
// vise entre les pieces n'est pas jouable au doigt.
check('la couche des pieces laisse passer les appuis',
    /\.pieces \{[^}]*pointer-events: none/s.test(style));
check('le double-tap ne zoome pas', style.includes('touch-action: manipulation'));
check('le damier ne se selectionne pas',
    /\.plateau \{[^}]*user-select: none/s.test(style));
check('les pieces sont placees par transform, pas par la mise en page',
    /\.piece \{[^}]*transform: translate/s.test(style));

// --- Manifeste et entetes -------------------------------------------------

check('la page declare le manifeste et la feuille de style',
    page.includes('rel="manifest"') && page.includes('css/style.css'));
check('la page charge app.js en module',
    page.includes('type="module"') && page.includes('js/app.js'));
check('la page fixe la langue', page.includes('lang="fr"'));
check('la page tient compte des encoches', page.includes('viewport-fit=cover'));
check('la couleur de barre de depart est celle de la palette par defaut',
    page.includes(`content="${PALETTES[0].sombre}" id="couleur-barre"`), PALETTES[0].sombre);
check('toutes les icones du manifeste existent',
    manifeste.icons.every(icone => existsSync(join(racine, icone.src))),
    manifeste.icons.map(icone => icone.src).join(' '));
check('le manifeste demarre a la racine relative',
    manifeste.start_url === './' && manifeste.scope === './');
check('le manifeste et package.json racontent la meme chose',
    manifeste.name === 'Dames' && paquet.name === 'dames');

report();
