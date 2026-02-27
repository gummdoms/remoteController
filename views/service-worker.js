const CACHE_NAME = 'remotecontrollers-v1';
const CORE_ASSETS = [
    '/',
    '/manifest.webmanifest',
    '/static/css/index.view.css',
    '/static/js/const.js',
    '/static/js/fx.js',
    '/static/js/fx-teclado.js',
    '/static/js/fx-mouse.js',
    '/static/js/teclado.js',
    '/static/js/index.js',
    '/static/js/controller_app.js',
    '/static/js/transfer.js',
    '/static/js/voice-dictation.js',
    '/static/js/cert-manager.js',
    '/static/js/powerOff.js',
    '/static/js/mouse.config.js',
    '/static/img/pwa-192.png',
    '/static/img/pwa-512.png',
    '/node_modules/bootstrap-icons/font/bootstrap-icons.min.css',
    '/node_modules/normalize.css/normalize.css',
    '/node_modules/sweetalert2/dist/sweetalert2.min.css',
    '/node_modules/jquery/dist/jquery.min.js',
    '/node_modules/sweetalert2/dist/sweetalert2.all.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);
    if (requestUrl.pathname.startsWith('/mouse/') || requestUrl.pathname.startsWith('/teclear') || requestUrl.pathname.startsWith('/transferirArchivo')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                return cached;
            }

            return fetch(event.request)
                .then((response) => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                    return response;
                })
                .catch(() => caches.match('/'));
        })
    );
});
