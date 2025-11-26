const CACHE_NAME = 'sloth-v3-ac-style';
const FILES = [
    './', './index.html', './style.css', './app.js', './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://unpkg.com/peerjs@1.5.1/dist/peerjs.min.js',
    'https://unpkg.com/html5-qrcode', // 摄像头库
    'https://fonts.googleapis.com/css2?family=Varela+Round&display=swap'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES)));
});

self.addEventListener('fetch', e => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

// 清理旧缓存
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(
        keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
    )));
});
