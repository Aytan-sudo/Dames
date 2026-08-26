// Le son — tout ce qui se verifie sans oreille.
//
// Le piege que cette suite existe pour attraper ne leve aucune erreur et ne se
// voit pas depuis un ordinateur : une note ecrite sous 300 Hz part bien, elle
// n'arrive simplement jamais. Un haut-parleur de telephone ne restitue a peu
// pres rien en dessous, et l'oreille y est de surcroit bien moins sensible a
// faible volume. Compter les notes emises ne dit donc rien de ce qui parvient a
// l'oreille : c'est leur hauteur qu'il faut relever.
//
// La methode est celle de Mosaicomino : un contexte audio factice fait tourner
// le vrai module et note ce qui en sort, rampes comprises. Le releve a la
// source reste en second rideau, pour attraper un timbre qu'on aurait ajoute
// sans l'appeler ici.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nSon\n');

// Un haut-parleur de telephone ne descend pas plus bas. C'est la cible du
// projet : sous ce seuil, la note n'existe pas.
const PLANCHER = 300;

// Le banc d'essai : juste assez d'API WebAudio pour que `js/son.js` tourne, et
// un carnet ou chaque oscillateur laisse ses hauteurs et son enveloppe.
function bancDEssai() {
    const emises = [];
    class Parametre {
        constructor(carnet) { this.carnet = carnet; }
        setValueAtTime(valeur) { this.carnet.push(valeur); return this; }
        exponentialRampToValueAtTime(valeur) { this.carnet.push(valeur); return this; }
    }
    class Contexte {
        constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        // `note()` cree toujours l'oscillateur puis son gain : la derniere note
        // ouverte est donc bien celle que ce gain habille.
        createOscillator() {
            const note = { forme: null, hauteurs: [], gains: [], debut: null, fin: null };
            emises.push(note);
            return {
                set type(valeur) { note.forme = valeur; },
                get type() { return note.forme; },
                frequency: new Parametre(note.hauteurs),
                connect: cible => cible,
                start: temps => { note.debut = temps; },
                stop: temps => { note.fin = temps; }
            };
        }
        createGain() {
            return { gain: new Parametre(emises.at(-1).gains), connect: cible => cible };
        }
        resume() { this.state = 'running'; }
        suspend() { this.state = 'suspended'; }
    }
    globalThis.AudioContext = Contexte;
    return emises;
}

const emises = bancDEssai();
const { sonPose, sonPrise, sonCouronnement, sonRefus, sonVictoire, sonDefaite, sonNulle } =
    await import('../js/son.js');

const jouer = son => {
    const debut = emises.length;
    son();
    return emises.slice(debut);
};

const pose = jouer(sonPose);
const prise = jouer(() => sonPrise(1));
const rafle = jouer(() => sonPrise(4));
const longue = jouer(() => sonPrise(9));
const couronnement = jouer(() => sonCouronnement());
const refus = jouer(sonRefus);
const victoire = jouer(sonVictoire);
const defaite = jouer(sonDefaite);
const nulle = jouer(sonNulle);

check('les six timbres sonnent',
    [pose, prise, couronnement, refus, victoire, defaite, nulle].every(notes => notes.length > 0));

// --- Le plancher ----------------------------------------------------------

// Le coeur de la suite : plus rien, pas meme une cible de rampe, ne descend
// sous le plancher.
const sous = emises.flatMap(note => note.hauteurs).filter(hauteur => hauteur < PLANCHER);
check('aucune note ne passe sous le plancher du haut-parleur',
    sous.length === 0, sous.map(hauteur => `${Math.round(hauteur)} Hz`).join(' '));

// --- Ce que chaque timbre doit dire ---------------------------------------

const volume = note => Math.max(...note.gains);
const duree = note => note.fin - note.debut;

// La pose est le son le plus frequent d'une partie : c'est celui qui doit le
// moins se remarquer. S'il devenait le plus long ou le plus fort, deux cents
// coups deviendraient deux cents coups de marteau.
check('la pose reste le timbre le plus discret',
    volume(pose[0]) <= volume(prise[0]) && duree(pose[0]) <= duree(couronnement[0]));

// La prise part au-dessus de la pose et retombe : quelque chose vient de
// quitter le damier, et c'est le mouvement qui le dit.
check('la prise part au-dessus de la pose', prise[0].hauteurs[0] > pose[0].hauteurs[0]);
check('la prise retombe au lieu de tenir',
    prise[0].hauteurs.length === 2 && prise[0].hauteurs[1] < prise[0].hauteurs[0]);

// La rafle n'a pas de timbre a elle : manger quatre pieces, ce sont quatre
// notes, et elles montent. C'est la saveur du jeu international, autant qu'elle
// s'entende.
check('une rafle de quatre emet quatre notes', rafle.length === 4, `${rafle.length} notes`);
const departs = rafle.map(note => note.hauteurs[0]);
check('la rafle monte a chaque piece mangee',
    departs.every((hauteur, rang) => rang === 0 || hauteur > departs[rang - 1]), departs.join(' '));
check('les notes d une rafle s egrenent au lieu de se superposer',
    rafle.every((note, rang) => rang === 0 || note.debut > rafle[rang - 1].debut));
check('seule la derniere note de la rafle retombe',
    rafle.slice(0, -1).every(note => note.hauteurs.length === 1) && rafle.at(-1).hauteurs.length === 2);

// Une rafle de neuf existe. Neuf degres d'affilee tourneraient a la sirene :
// l'echelle plafonne, et c'est le nombre de notes qui continue de compter.
check('une rafle de neuf emet neuf notes sans partir en sirene',
    longue.length === 9 && Math.max(...longue.flatMap(note => note.hauteurs)) <= 1000,
    `${longue.length} notes, jusqu'a ${Math.round(Math.max(...longue.flatMap(note => note.hauteurs)))} Hz`);

// Le couronnement est le seul evenement rare de la partie : il monte, et il
// tient plus longtemps que tout le reste.
check('le couronnement monte',
    couronnement.length === 2 && couronnement[1].hauteurs[0] > couronnement[0].hauteurs[0]);
check('le couronnement tient plus longtemps que la pose',
    duree(couronnement.at(-1)) > duree(pose[0]));

// Le refus dit non par la chute, jamais par la profondeur — une note grave ne
// sort pas du haut-parleur d'un telephone, et le refus resterait muet la ou il
// sert le plus.
check('le refus descend au lieu de s enfoncer',
    refus.length === 1 && refus[0].hauteurs.length === 2
    && refus[0].hauteurs[0] > refus[0].hauteurs[1]
    && refus[0].hauteurs[1] >= PLANCHER,
    refus[0]?.hauteurs.join(' → '));
check('le refus reste plus discret que la pose', volume(refus[0]) < volume(pose[0]));

// Les trois fins doivent s'entendre comme trois fins differentes, sans qu'on
// ait a lire le dialogue.
const montee = victoire.map(note => note.hauteurs[0]);
check('la victoire monte de bout en bout',
    montee.every((hauteur, rang) => rang === 0 || hauteur > montee[rang - 1]), montee.join(' '));
const descente = defaite.map(note => note.hauteurs[0]);
check('la defaite descend de bout en bout',
    descente.every((hauteur, rang) => rang === 0 || hauteur < descente[rang - 1]), descente.join(' '));
check('la nulle ne resout rien : deux fois la meme note',
    nulle.length === 2 && nulle[0].hauteurs[0] === nulle[1].hauteurs[0], nulle.map(n => n.hauteurs[0]).join(' '));
check('les trois fins s egrenent au lieu de plaquer un accord',
    [victoire, defaite, nulle].every(fin => fin.every((note, rang) => rang === 0 || note.debut > fin[rang - 1].debut)));

// --- Second rideau --------------------------------------------------------

// Un timbre ajoute demain sans passer par cette suite serait invisible au banc
// d'essai. On relit donc aussi le module au lexique.
const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');
const source = lire('js/son.js');
const ecrites = [
    ...[...source.matchAll(/note\((\d+)/g)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/vers:\s*(\d+)/g)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/^const [A-Z_]+ = (\d+);/gm)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/\[([\d,\s]+)\]\.forEach/g)]
        .flatMap(([, liste]) => liste.split(',').map(Number)),
    ...[...source.matchAll(/DEGRES = \[([\d,\s]+)\]/g)]
        .flatMap(([, liste]) => liste.split(',').map(Number))
];
const basses = ecrites.filter(hauteur => hauteur < PLANCHER);
check('aucune frequence ecrite dans le module ne passe sous le plancher',
    basses.length === 0, basses.join(' '));
check('les frequences ecrites ont bien ete relevees', ecrites.length >= 15, String(ecrites.length));

// Le second piege du son sur telephone : iOS ne demarre un contexte audio que
// depuis un evenement d'activation. Le damier de Dames se joue sur
// `pointerdown`, qui en est un — mais l'ordinateur ouvre la partie depuis un
// `setTimeout` quand le joueur prend les noirs. D'ou le filet pose au premier
// geste, quel qu'il soit.
const app = lire('js/app.js');
check('le contexte se prepare des le premier geste',
    source.includes("'pointerdown'") && app.includes('preparerSon(document'));
check('le son se tait quand l onglet passe a l arriere-plan',
    app.includes('surveillerVisibilite(document)'));

// Le son est un reglage, pas une fatalite : il se coupe, et le choix se garde.
check('le son se coupe et se retient',
    app.includes('changer({ sons:') && lire('js/storage.js').includes('sons: true'));

report();
