const CACHE_NAME = 'wojaknet-v7-persistent';
const FILES = [
    './', './index.html', './style.css', './app.js', './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://unpkg.com/peerjs@1.5.1/dist/peerjs.min.js',
    'https://unpkg.com/html5-qrcode'
];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.map(n => n!==CACHE_NAME?caches.delete(n):null)))));
