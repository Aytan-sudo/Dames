// Le stockage. Rien n'y est vital, et c'est justement ce qu'il faut verifier :
// un navigateur qui refuse d'ecrire ne doit pas empecher de jouer.

import { counter } from './harness.mjs';

// Faux localStorage, installe avant l'import du module : storage.js lit la
// variable globale a chaque appel, pas au chargement.
const memoire = new Map();
let enPanne = false;
globalThis.localStorage = {
    getItem: cle => {
        if (enPanne) throw new Error('stockage refuse');
        return memoire.has(cle) ? memoire.get(cle) : null;
    },
    setItem: (cle, valeur) => {
        if (enPanne) throw new Error('quota');
        memoire.set(cle, String(valeur));
    },
    removeItem: cle => {
        if (enPanne) throw new Error('quota');
        memoire.delete(cle);
    }
};

const {
    PREFERENCES_PAR_DEFAUT, chargerPreferences, enregistrerPreferences,
    chargerStats, statsDe, cleStats, enregistrerFin, effacerStats,
    chargerPartie, enregistrerPartie, oublierPartie
} = await import('../js/storage.js');

const { check, report } = counter();
console.log('\nStockage\n');

// --- Preferences ----------------------------------------------------------

check('sans rien d enregistre, les preferences sont celles par defaut',
    JSON.stringify(chargerPreferences()) === JSON.stringify(PREFERENCES_PAR_DEFAUT));

check('le jeu demarre contre l ordinateur, en blanc, sur le theme du systeme',
    PREFERENCES_PAR_DEFAUT.adversaire === 'ordinateur'
    && PREFERENCES_PAR_DEFAUT.camp === 'blancs'
    && PREFERENCES_PAR_DEFAUT.mode === 'auto');

enregistrerPreferences({ ...PREFERENCES_PAR_DEFAUT, palette: 'encre', niveau: 'difficile' });
check('ce qui est enregistre se relit',
    chargerPreferences().palette === 'encre' && chargerPreferences().niveau === 'difficile');

// Une preference ajoutee dans une version suivante doit prendre sa valeur par
// defaut chez ceux qui ont deja joue, pas rester indefinie.
memoire.set('dames.preferences', JSON.stringify({ palette: 'foret' }));
const anciennes = chargerPreferences();
check('une preference absente de l enregistrement prend sa valeur par defaut',
    anciennes.palette === 'foret' && anciennes.vibration === PREFERENCES_PAR_DEFAUT.vibration
    && anciennes.adversaire === PREFERENCES_PAR_DEFAUT.adversaire);

// Les regles maison sont un objet, pas un drapeau : la fusion avec les valeurs
// par defaut est de surface, et un joueur qui n'a leve qu'une regle ne doit pas
// retrouver les autres au passage d'une mise a jour.
check('le jeu demarre aux regles officielles',
    JSON.stringify(PREFERENCES_PAR_DEFAUT.regles) === '{}');

enregistrerPreferences({ ...PREFERENCES_PAR_DEFAUT, regles: { priseObligatoire: false } });
check('les regles levees se relisent',
    JSON.stringify(chargerPreferences().regles) === '{"priseObligatoire":false}',
    JSON.stringify(chargerPreferences().regles));

memoire.set('dames.preferences', JSON.stringify({ regles: { dameVolante: false } }));
check('un enregistrement d avant les regles maison ne les invente pas',
    JSON.stringify(chargerPreferences().regles) === '{"dameVolante":false}');
memoire.delete('dames.preferences');

memoire.set('dames.preferences', '{ceci n est pas du json');
check('un enregistrement abime ne fait pas tomber le jeu',
    JSON.stringify(chargerPreferences()) === JSON.stringify(PREFERENCES_PAR_DEFAUT));
memoire.delete('dames.preferences');

// --- Statistiques ---------------------------------------------------------

check('une ligne de statistiques part de zero',
    JSON.stringify(statsDe(chargerStats(), 'ordinateur.normal')) === '{"victoires":0,"defaites":0,"nulles":0}');

// Chaque variante, chaque niveau : une victoire aux anglaises contre le niveau
// facile n'a rien a voir avec une victoire aux internationales en difficile.
check('chaque variante et chaque niveau ont leur ligne',
    cleStats({ variante: 'international', adversaire: 'ordinateur', niveau: 'facile' }) === 'international.ordinateur.facile'
    && cleStats({ variante: 'anglaise', adversaire: 'ordinateur', niveau: 'difficile' }) === 'anglaise.ordinateur.difficile'
    && cleStats({ variante: 'anglaise', adversaire: 'humain', niveau: 'facile' }) === 'anglaise.humain');

check('une preference sans variante retombe sur les internationales',
    cleStats({ adversaire: 'humain' }) === 'international.humain');

check('le jeu demarre sur les internationales', PREFERENCES_PAR_DEFAUT.variante === 'international');

enregistrerFin('ordinateur.normal', 'victoire');
enregistrerFin('ordinateur.normal', 'victoire');
enregistrerFin('ordinateur.normal', 'defaite');
enregistrerFin('ordinateur.normal', 'nulle');
enregistrerFin('ordinateur.facile', 'victoire');

const stats = chargerStats();
check('les parties se comptent par ligne',
    JSON.stringify(statsDe(stats, 'ordinateur.normal')) === '{"victoires":2,"defaites":1,"nulles":1}',
    JSON.stringify(statsDe(stats, 'ordinateur.normal')));
check('les lignes ne se melangent pas',
    statsDe(stats, 'ordinateur.facile').victoires === 1
    && statsDe(stats, 'ordinateur.difficile').victoires === 0);

effacerStats();
check('effacer vide tout le tableau',
    statsDe(chargerStats(), 'ordinateur.normal').victoires === 0);

// --- Partie en cours ------------------------------------------------------

check('sans partie enregistree, on repart de zero', chargerPartie() === null);

enregistrerPartie({ version: 1, coups: [[32, [28], []]], camp: 'noirs' });
check('la partie en cours se relit', chargerPartie().coups.length === 1);
oublierPartie();
check('et s oublie', chargerPartie() === null);

// --- Navigation privee ----------------------------------------------------

enPanne = true;
check('un stockage qui refuse tout laisse des preferences par defaut',
    JSON.stringify(chargerPreferences()) === JSON.stringify(PREFERENCES_PAR_DEFAUT));
check('enregistrer ne leve pas', (() => {
    try { enregistrerPreferences(PREFERENCES_PAR_DEFAUT); enregistrerFin('ordinateur.normal', 'victoire'); return true; }
    catch { return false; }
})());
check('charger la partie ne leve pas', chargerPartie() === null);
check('oublier la partie ne leve pas', (() => {
    try { oublierPartie(); return true; } catch { return false; }
})());
enPanne = false;

report();
