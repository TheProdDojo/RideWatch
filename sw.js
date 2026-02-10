// RideWatch - Service Worker
// Handles offline coordinate caching and burst-upload on reconnect

const CACHE_NAME = 'ridetrack-v1';
const DB_NAME = 'ridetrack-offline';
const STORE_NAME = 'coordinates';

// IndexedDB Helper
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
            }
        };
    });
}

async function saveCoordinate(coord) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.add(coord);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllCoordinates() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function clearCoordinates() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    if (type === 'CACHE_COORDINATE') {
        try {
            await saveCoordinate(payload);
            event.ports[0].postMessage({ success: true, cached: true });
        } catch (err) {
            event.ports[0].postMessage({ success: false, error: err.message });
        }
    }

    if (type === 'GET_CACHED_COORDINATES') {
        try {
            const coords = await getAllCoordinates();
            event.ports[0].postMessage({ success: true, coordinates: coords });
        } catch (err) {
            event.ports[0].postMessage({ success: false, error: err.message });
        }
    }

    if (type === 'CLEAR_CACHE') {
        try {
            await clearCoordinates();
            event.ports[0].postMessage({ success: true });
        } catch (err) {
            event.ports[0].postMessage({ success: false, error: err.message });
        }
    }
});

// Basic fetch handler (pass-through for now)
const ASSETS_TO_CACHE = [
    '/',
    '/rider.html',
    '/track.html',
    '/index.html',
    '/favicon.svg',
    '/firebase-config.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Ignore cross-origin requests (CDNs, Firebase, etc.)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Ignore non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // For HTML pages, Network First (fresh content), fallback to Cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // For other assets, Stale-While-Revalidate or Cache First
    // Here we use Stale-While-Revalidate for simplicity
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                const responseToCache = networkResponse.clone(); // Clone immediately
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});
