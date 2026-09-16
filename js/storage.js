// Preferences, statistiques et partie en cours, dans le localStorage.
//
// Rien n'est vital : le jeu doit rester jouable en navigation privee, ou le
// stockage refuse tout. Chaque acces est donc protege, et l'echec se traduit
// par une partie qui ne se souvient de rien plutot que par une page blanche.

const CLE_PREFERENCES = 'dames.preferences';
const CLE_PASSEPORT = 'dames.passeport';

// Ouvert depuis le hub avec un passeport, le jeu range tout dans l'espace du
// joueur ; en mode invite, dans le localStorage, exactement comme avant.
const passeport = globalThis.Passeport?.stockageJeu('dames') ?? null;
const magasin = () => passeport ?? localStorage;
const CLE_STATS = 'dames.stats';
const CLE_PARTIE = 'dames.partie';

export const PREFERENCES_PAR_DEFAUT = {
    variante: 'international', // 'international' (10×10) ou 'anglaise' (8×8)
    mode: 'auto',              // theme clair, sombre, ou celui du systeme
    palette: 'bois',
    adversaire: 'ordinateur',  // 'ordinateur' ou 'humain'
    niveau: 'normal',
    camp: 'blancs',            // le camp du joueur, face a l'ordinateur
    // Les regles qu'on a retournees a la main. Ce qui n'est pas la dedans suit
    // la variante ; un objet vide, ce sont les regles officielles. Les valeurs
    // sont absolues et non « inversees », pour qu'un choix garde son sens quand
    // on change de jeu : `dameVolante: false` est une entorse aux
    // internationales et la regle officielle aux anglaises.
    regles: {},
    indices: true,             // allumer les cases jouables
    numeros: false,            // la numerotation officielle sur le damier
    sons: true,
    vibration: true
};

const lire = (cle, secours) => {
    try {
        const brut = magasin().getItem(cle);
        return brut ? { ...secours, ...JSON.parse(brut) } : { ...secours };
    } catch {
        return { ...secours };   // navigation privee, quota plein : on joue quand meme
    }
};

const ecrire = (cle, valeur) => {
    try {
        magasin().setItem(cle, JSON.stringify(valeur));
    } catch { /* sans persistance, le jeu reste jouable */ }
};

const effacer = cle => {
    try { magasin().removeItem(cle); } catch { /* rien a nettoyer */ }
};

export const chargerPreferences = () => lire(CLE_PREFERENCES, PREFERENCES_PAR_DEFAUT);
export const enregistrerPreferences = preferences => ecrire(CLE_PREFERENCES, preferences);

export const chargerStats = () => lire(CLE_STATS, {});

// Une ligne de statistiques par variante et par adversaire : gagner contre le
// niveau facile et gagner contre le difficile ne racontent pas la meme partie,
// et une victoire aux anglaises n'est pas une victoire aux internationales.
// Tout melanger rendrait le tableau muet.
//
// Les parties aux regles maison n'ont pas de ligne du tout : elles ne sont pas
// enregistrees. Leur en donner une, c'est se retrouver avec autant de lignes
// que de combinaisons d'interrupteurs.
export const cleStats = preferences => `${preferences.variante ?? 'international'}.`
    + (preferences.adversaire === 'humain' ? 'humain' : `ordinateur.${preferences.niveau}`);

export const statsDe = (stats, cle) => stats[cle] ?? { victoires: 0, defaites: 0, nulles: 0 };

export function enregistrerFin(cle, issue) {
    const stats = chargerStats();
    const ligne = { ...statsDe(stats, cle) };
    if (issue === 'victoire') ligne.victoires++;
    else if (issue === 'defaite') ligne.defaites++;
    else ligne.nulles++;
    stats[cle] = ligne;
    ecrire(CLE_STATS, stats);
    return ligne;
}

export const effacerStats = () => ecrire(CLE_STATS, {});

export const chargerPartie = () => {
    try {
        const brut = magasin().getItem(CLE_PARTIE);
        return brut ? JSON.parse(brut) : null;
    } catch {
        return null;
    }
};

export const enregistrerPartie = donnees => ecrire(CLE_PARTIE, donnees);
export const oublierPartie = () => effacer(CLE_PARTIE);

// ------------------------------------------------------------- le passeport
//
// Les coups joues dans la journee, pour le tampon a l'effort. Le compte ne vit
// que dans l'espace d'un joueur : en mode invite, rien n'est compte ni ecrit.

export function compterCoupPasseport(jour, espace = passeport) {
    if (!espace) return null;
    let compte = null;
    try { compte = JSON.parse(espace.getItem(CLE_PASSEPORT)); } catch { /* illisible : on repart */ }
    const coups = compte?.jour === jour && Number.isInteger(compte.coups) ? compte.coups + 1 : 1;
    try { espace.setItem(CLE_PASSEPORT, JSON.stringify({ jour, coups })); } catch { /* le passeport signale l'echec */ }
    return coups;
}
