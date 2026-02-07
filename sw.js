// RideTrack - Service Worker
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
self.addEventListener('fetch', (event) => {
    // For MVP, just pass through all requests
    // In production, could cache static assets
    event.respondWith(fetch(event.request));
});

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', () => {
    self.clients.claim();
});
