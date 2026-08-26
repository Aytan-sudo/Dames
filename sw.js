// Service worker : le jeu doit s'ouvrir dans le metro.
//
// Reseau d'abord, cache en secours. La coquille est mise en cache a
// l'installation, mais elle n'est servie que si le reseau ne repond pas : une
// version publiee arrive ainsi sans manoeuvre du joueur, et le hors-ligne
// continue de marcher. L'inverse — le cache d'abord — servait une version
// perimee jusqu'a ce que le navigateur veuille bien renouveler le worker.
//
// Il y a une seconde raison, qu'on ne voit qu'en developpant : tous les jeux du
// dossier servent sur `localhost`, et un worker cache-first y sert ses propres
// fichiers a ses voisins — un damier apparaissant au milieu d'un autre jeu.
//
// Le nom du cache porte le numero de version : une version publiee sans le
// changer resterait invisible pour ceux qui ont installe le jeu.

const VERSION = 'dames-1.3.0';

const COQUILLE = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/style.css',
    'js/app.js',
    'js/damier.js',
    'js/entree.js',
    'js/ia.js',
    'js/partie.js',
    'js/regles.js',
    'js/rendu.js',
    'js/selection.js',
    'js/son.js',
    'js/storage.js',
    'js/themes.js',
    'js/ui.js',
    'js/variantes.js',
    'assets/icon.svg',
    'assets/icon-180.png',
    'assets/icon-192.png',
    'assets/icon-512.png'
];

self.addEventListener('install', evenement => {
    evenement.waitUntil(
        caches.open(VERSION)
            .then(cache => cache.addAll(COQUILLE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', evenement => {
    evenement.waitUntil(
        caches.keys()
            .then(noms => Promise.all(noms.filter(nom => nom !== VERSION).map(nom => caches.delete(nom))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', evenement => {
    if (evenement.request.method !== 'GET') return;

    evenement.respondWith(
        fetch(evenement.request)
            .then(reponse => {
                // On ne garde que ce qui vient de chez nous et qui a abouti :
                // une erreur mise en cache serait servie indefiniment.
                if (reponse.ok && new URL(evenement.request.url).origin === location.origin) {
                    const copie = reponse.clone();
                    caches.open(VERSION).then(cache => cache.put(evenement.request, copie));
                }
                return reponse;
            })
            // Plus de reseau : la coquille prend le relais. Une navigation qui
            // n'a pas sa reponse retombe sur la racine, faute de quoi rouvrir
            // le jeu depuis une URL inconnue donnerait une page blanche.
            .catch(() => caches.match(evenement.request).then(connu => connu || caches.match('./')))
    );
});
