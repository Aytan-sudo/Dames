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
import { VARIANTES, REGLES_OPTIONNELLES } from '../js/variantes.js';

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
    ['regles.js', 'damier.js', 'variantes.js', 'partie.js', 'selection.js', 'ia.js', 'rendu.js', 'entree.js']
        .every(nom => charges.has(nom)));
check('aucun module du dossier n est orphelin',
    tous.every(nom => charges.has(nom)), tous.filter(nom => !charges.has(nom)).join(' '));

// --- Outillage ------------------------------------------------------------

// Un module qu'aucun script ne controle, une suite que personne ne lance : ni
// l'un ni l'autre ne fait de bruit, et les deux laissent passer la faute qu'ils
// existaient pour attraper.
const nonControles = tous.filter(nom => !paquet.scripts.check.includes(`js/${nom}`));
check('npm run check couvre chaque module', nonControles.length === 0, nonControles.join(' '));
check('les scripts npm attendus existent',
    ['test', 'check', 'serve'].every(nom => typeof paquet.scripts[nom] === 'string'));

const suites = readdirSync(join(racine, 'tests')).filter(nom => nom.startsWith('test-'));
const nonLancees = suites.filter(nom => !paquet.scripts.test.includes(`tests/${nom}`));
check('npm test lance chaque suite', nonLancees.length === 0, nonLancees.join(' '));

const ci = lire('.github/workflows/tests.yml');
check('la CI lance les tests et le controle de syntaxe',
    ci.includes('npm test') && ci.includes('npm run check') && ci.includes('node-version: 22'));
check('la CI se declenche sur push et sur pull request',
    ci.includes('push:') && ci.includes('pull_request:'));

// --- Cache hors ligne -----------------------------------------------------

const coquille = [...worker.matchAll(/^\s+'([^']+)',?$/gm)].map(([, chemin]) => chemin);
const absents = [...charges].filter(nom => !coquille.includes(`js/${nom}`));
check('le service worker connait tous les modules charges', absents.length === 0, absents.join(' '));
check('il met en cache la feuille de style et le manifeste',
    coquille.includes('css/style.css') && coquille.includes('manifest.webmanifest'));
const manquants = coquille.filter(chemin => chemin !== './' && !existsSync(join(racine, chemin)));
check('tous les fichiers de la coquille existent', manquants.length === 0, manquants.join(' '));
// iOS n'accepte pas le SVG comme icone d'ecran d'accueil : sans le PNG dans la
// coquille, un jeu installe puis ouvert hors ligne perd son icone.
const icones = readdirSync(join(racine, 'assets')).filter(nom => !coquille.includes(`assets/${nom}`));
check('la coquille emporte toutes les icones', icones.length === 0, icones.join(' '));

// Reseau d'abord, cache en secours. Le cache d'abord sert une version perimee
// jusqu'a ce que le navigateur renouvelle le worker — et, en developpement ou
// tous les jeux partagent `localhost`, sert ses fichiers a ses voisins.
check('le service worker sert le reseau d\'abord', /respondWith\(\s*fetch\(/.test(worker));
check('il retombe sur le cache quand le reseau manque',
    /\.catch\(\(\) => caches\.match\(/.test(worker));

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
check('les trois modes et les quatre niveaux sont proposes',
    MODES.length === 3 && NIVEAUX.length === 4);

// Quatre segments sur une ligne de dialogue de telephone, ce sont quatre mots
// coupes. La classe qui les met en deux colonnes doit exister des deux cotes.
check('les niveaux sont ranges en deux colonnes',
    page.includes('class="segments paire" id="segments-niveau"') && style.includes('.segments.paire'));
check('le niveau choisi s explique sous les boutons',
    page.includes('id="explication-niveau"') && NIVEAUX.every(niveau => niveau.resume?.length > 40));

// --- Clavier --------------------------------------------------------------

// Un raccourci deplace ne casse rien : il laisse simplement une aide qui ment,
// et le joueur appuie sur une touche qui ne fait plus ce qu'elle annonce. On
// compare donc les touches branchees a celles que l'aide promet.
const app = lire('js/app.js');
// L'appel se referme sur sa propre indentation : un `});` de fin de ligne
// interne — il y en a un dans le raccourci de theme — ne doit pas passer pour
// la fin de la liste.
const debutClavier = app.indexOf('ecouterClavier({');
const blocClavier = app.slice(debutClavier, app.indexOf('\n    });', debutClavier));
const branchees = [...blocClavier.matchAll(/^\s{8}'?([a-z?]+)'?:/gm)].map(([, touche]) => touche);

// Ce que l'aide doit montrer pour chaque touche branchee.
const AFFICHAGE = { annuler: '<kbd>Ctrl</kbd>+<kbd>Z</kbd>', escape: '<kbd>Échap</kbd>' };
const affiche = touche => AFFICHAGE[touche] ?? `<kbd>${touche.toUpperCase()}</kbd>`;

const clavier = page.slice(page.indexOf('<h3>Au clavier</h3>'), page.indexOf('</p>', page.indexOf('<h3>Au clavier</h3>')));
const tues = branchees.filter(touche => !clavier.includes(affiche(touche)));
check(`les ${branchees.length} touches branchees sont toutes dans l aide`,
    branchees.length >= 7 && tues.length === 0, tues.join(' '));

// La convention est ferme la-dessus : `R` relance, il ne signifie jamais
// « reglages ». C'est la seule touche dont le sens est fixe d'avance.
check('R relance la partie et n ouvre pas les options',
    /\br: \(\) => nouvellePartie\(\)/.test(blocClavier) && /\bo: \(\) => ouvrirReglages\(\)/.test(blocClavier));

// --- Son ------------------------------------------------------------------

// Le bouton du bandeau porte les deux dessins et n'en montre qu'un. Sans les
// deux regles de style, il les montre tous les deux : un haut-parleur barre qui
// sonne quand meme, et personne ne saurait dire dans quel etat il est.
check('le bouton du son a ses deux etats dans la feuille de style',
    /id="bouton-son"[^>]*aria-pressed/.test(page)
    && style.includes('.icone[aria-pressed="false"] .ondes')
    && style.includes('.icone[aria-pressed="true"] .croix'));
check('le son se regle aussi depuis les options',
    page.includes('id="option-sons"'));

// --- Regles maison --------------------------------------------------------

// Les interrupteurs sont construits depuis la liste : la page n'a qu'a fournir
// le contenant et l'avertissement. Ce qu'on verifie ici, c'est qu'ils ont ou
// atterrir, et qu'une regle levee se voie.
check('la page reserve la place des interrupteurs de regles',
    page.includes('id="regles-maison"') && REGLES_OPTIONNELLES.length === 4);
check('l avis des regles maison existe, cache au depart',
    /id="avis-regles"[^>]*hidden/.test(page) && style.includes('.avis'));
check('il porte de quoi tout remettre d aplomb',
    page.includes('id="regles-officielles"') && style.includes('.lien'));
check('l aide dit que les parties maison ne se comptent pas',
    /Règles maison[\s\S]{0,600}pas comptée/.test(page));

// --- Variantes ------------------------------------------------------------

check('les deux jeux sont proposes dans les reglages',
    page.includes('id="segments-variante"') && VARIANTES.length === 2);
check('chaque variante a sa section de regles dans l aide',
    VARIANTES.every(variante => page.includes(`data-variante="${variante.id}"`)),
    VARIANTES.map(variante => variante.id).join(' '));
check('chaque variante se resume en une phrase',
    VARIANTES.every(variante => variante.resume?.length > 40));
check('la feuille de style s adapte a la taille du damier',
    style.includes('repeat(var(--cote, 10), 1fr)') && style.includes('calc(100% / var(--cote, 10))'));

// Les rangees du damier doivent etre declarees. Laissees en `auto`, elles se
// dimensionnent sur leur contenu : il a suffi qu'une case affiche un numero et
// une pastille de coup possible pour que toute sa rangee s'allonge, et que les
// cases cessent d'etre carrees.
check('les rangees du damier ne dependent pas de leur contenu',
    style.includes('grid-template-rows: repeat(var(--cote, 10), 1fr)'));
check('rien de ce qu une case affiche ne peut changer sa taille',
    /\.numero, \.case\.cible::after \{[^}]*position: absolute/s.test(style));

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
