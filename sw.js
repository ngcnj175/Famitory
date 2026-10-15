// network-first戦略のため、このバージョンはオフラインフォールバック用キャッシュの識別子のみ。
// JS/CSS更新時に手動バンプする必要はなくなった（オンライン時は常に最新を取得）。
const CACHE_NAME = 'pixel-game-kit-v3.2.1';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './fonts/k8x12-subset.woff2',
    // ユーティリティ
    './js/utils/storage.js',
    './js/utils/share.js',
    // エンジン
    './js/engine/sprite-utils.js',
    './js/engine/audio.js',
    './js/engine/game-engine.js',
    './js/engine/game-renderer.js',
    './js/engine/game-physics.js',
    './js/engine/projectile-manager.js',
    './js/engine/physics-handler.js',
    './js/engine/player.js',
    './js/engine/enemy.js',
    // スプライトエディタ
    './js/editor/sprite-editor.js',
    './js/editor/sprite-editor-palette.js',
    './js/editor/sprite-editor-canvas-input.js',
    './js/editor/sprite-editor-preview.js',
    // ステージエディタ
    './js/editor/stage-renderer.js',
    './js/editor/stage-template-manager.js',
    './js/editor/stage-settings.js',
    './js/editor/stage-canvas-input.js',
    './js/editor/stage-editor.js',
    // BGMエディタ
    './js/editor/song-manager.js',
    './js/editor/bgm-player.js',
    './js/editor/bgm-renderer.js',
    './js/editor/bgm-note-editor.js',
    './js/editor/bgm-editor.js',
    // UI・アプリ
    './js/ui/controller.js',
    './js/app-i18n.js',
    './js/app-dialogs.js',
    './js/app-project.js',
    './js/app-share.js',
    './js/app.js',
    './manifest.json'
];

// インストール
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// アクティベート
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// フェッチ: network-first（オンライン時は常に最新、オフライン時のみキャッシュ）
// cache-first だと CACHE_NAME を手動バンプしないと更新が iPhone に届かない運用問題があり切替。
// 非GET・他オリジン（Firebase 等）は SW を素通し。
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    let url;
    try { url = new URL(req.url); } catch (_) { return; }
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(req)
            .then(response => {
                if (response && response.ok) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(req, cloned)).catch(() => {});
                }
                return response;
            })
            .catch(() => caches.match(req))
    );
});
