// Synthese WebAudio : pas un octet d'audio dans le depot, six timbres et c'est
// tout. Le son accompagne la partie, il ne la commente pas — d'ou des durees
// tres courtes et un volume bas par principe. Une partie de dames, c'est deux
// cents poses : le timbre le plus frequent est celui qui doit le moins se
// remarquer.
//
// Tout vit au-dessus de 300 Hz. Un haut-parleur de telephone ne restitue a peu
// pres rien en dessous, et l'oreille y est de surcroit bien moins sensible a
// faible volume : une note ecrite plus bas ne leve aucune erreur, elle part
// simplement sans arriver. Le jeu se voulant mobile d'abord, c'est un defaut et
// pas un reglage — `tests/test-son.mjs` garde le plancher.

let contexte;

function audio() {
    if (contexte) return contexte;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) contexte = new AudioContext();
    return contexte;
}

function note(frequence, { duree = 0.08, volume = 0.028, delai = 0, vers = null, forme = 'triangle' } = {}) {
    const moteur = audio();
    if (!moteur) return;
    if (moteur.state === 'suspended') moteur.resume?.();

    const debut = moteur.currentTime + delai;
    const oscillateur = moteur.createOscillator();
    const gain = moteur.createGain();

    oscillateur.type = forme;
    oscillateur.frequency.setValueAtTime(frequence, debut);
    if (vers) oscillateur.frequency.exponentialRampToValueAtTime(vers, debut + duree);

    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

    oscillateur.connect(gain).connect(moteur.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
}

// La piece qui se pose : le repere du jeu, et de loin le son le plus frequent.
// Sec, court, neutre — il doit pouvoir se repeter deux cents fois sans lasser.
export const sonPose = () => note(392);

// La prise part au-dessus de la pose et retombe : quelque chose vient de
// quitter le damier. C'est le mouvement qui le dit, pas le volume.
const PRISE = 587;
const CHUTE = 440;

// La rafle n'a pas de timbre a elle : c'est la note de prise repetee, une par
// piece mangee, montant d'un degre a chaque fois. Manger trois pieces doit
// s'entendre comme trois pieces — la prise majoritaire fait tout le jeu
// international, autant qu'elle s'entende.
//
// L'echelle est plafonnee : une rafle de neuf existe, et neuf degres d'affilee
// tourneraient a la sirene. Passe le sommet, les dernieres notes se posent
// toutes sur la meme hauteur, et c'est leur nombre qui continue de compter.
const DEGRES = [587, 659, 740, 831, 932];
const ecarter = rang => DEGRES[Math.min(rang, DEGRES.length - 1)];

// `espacement` est la duree d'un saut a l'ecran : les notes suivent l'animation
// plutot que de partir toutes ensemble.
export function sonPrise(nombre = 1, espacement = 0.2) {
    for (let rang = 0; rang < nombre; rang++) {
        const depart = ecarter(rang);
        note(depart, {
            duree: 0.09,
            volume: 0.032,
            delai: rang * espacement,
            vers: rang === nombre - 1 ? CHUTE : null
        });
    }
}

// Le couronnement : deux notes qui montent et tiennent. C'est le seul evenement
// rare de la partie, il a droit a sa quinte.
export function sonCouronnement(delai = 0) {
    note(523, { duree: 0.16, volume: 0.03, delai });
    note(784, { duree: 0.2, volume: 0.03, delai: delai + 0.1 });
}

// Le refus — une piece clouee par la prise obligatoire ailleurs. Il dit non par
// la chute, jamais par la profondeur : une note grave ne sort pas du
// haut-parleur d'un telephone, et le refus resterait muet la ou il sert.
export const sonRefus = () => note(400, { duree: 0.09, volume: 0.022, vers: 310, forme: 'sine' });

// Les trois fins. La victoire monte, la defaite descend sans percer le
// plancher, et la nulle repete la meme note : rien ne s'y resout.
export function sonVictoire() {
    [392, 523, 659, 784].forEach((frequence, rang) => note(frequence, { duree: 0.18, delai: rang * 0.09 }));
}

export function sonDefaite() {
    [587, 466, 349].forEach((frequence, rang) => note(frequence, { duree: 0.22, volume: 0.026, delai: rang * 0.12 }));
}

export function sonNulle() {
    [440, 440].forEach((frequence, rang) => note(frequence, { duree: 0.2, volume: 0.024, delai: rang * 0.16 }));
}

// Le deblocage au geste.
//
// iOS ne laisse demarrer un contexte audio que depuis un evenement
// d'activation : `pointerdown`, `touchstart`, `pointerup`, `touchend`,
// `keydown`, `click`. Le damier de Dames se joue justement sur `pointerdown`,
// il est donc sain de ce cote — mais qui prend les noirs voit l'ordinateur
// ouvrir la partie, et ce tout premier son nait d'un `setTimeout`, pas d'un
// geste. Le contexte se prepare donc des le premier appui sur la page, avant
// que le jeu n'ait une note a demander.
// `autorise` evite d'ouvrir un contexte audio chez qui a coupe le son.
const ACTIVATIONS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click'];

export function preparerSon(cible, autorise = () => true) {
    const reveiller = () => {
        if (!autorise()) return;
        const moteur = audio();
        if (moteur && moteur.state !== 'running') moteur.resume?.();
    };
    for (const activation of ACTIVATIONS) {
        cible.addEventListener(activation, reveiller, { capture: true, passive: true });
    }
}

// Un jeu ne chante pas dans le dos de qui est parti lire ailleurs.
export function surveillerVisibilite(document) {
    document.addEventListener('visibilitychange', () => {
        if (!contexte) return;
        if (document.hidden) contexte.suspend?.();
        else contexte.resume?.();
    });
}
