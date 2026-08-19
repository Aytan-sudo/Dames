// Service worker : le jeu doit s'ouvrir dans le metro.
//
// Coquille mise en cache a l'installation, servie en priorite depuis le cache.
// Rien ici n'est dynamique — pas de serveur, pas d'API — alors le cache est la
// verite, et le reseau ne sert qu'a le remplir.
//
// Le nom du cache porte le numero de version : une version publiee sans le
// changer resterait invisible pour ceux qui ont installe le jeu.

const VERSION = 'dames-1.1.0';

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
    'js/storage.js',
    'js/themes.js',
    'js/ui.js',
    'js/variantes.js',
    'assets/icon.svg',
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
        caches.match(evenement.request).then(connu => {
            if (connu) return connu;
            return fetch(evenement.request).then(reponse => {
                // On ne garde que ce qui vient de chez nous et qui a abouti :
                // une erreur mise en cache serait servie indefiniment.
                if (reponse.ok && new URL(evenement.request.url).origin === location.origin) {
                    const copie = reponse.clone();
                    caches.open(VERSION).then(cache => cache.put(evenement.request, copie));
                }
                return reponse;
            });
        }).catch(() => caches.match('index.html'))
    );
});
