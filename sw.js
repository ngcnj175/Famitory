const CACHE_NAME = 'pixel-game-kit-v2.9.0';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
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

// フェッチ
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
