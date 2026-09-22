/**
 * PixelGameKit - ARCADE データベース連携
 * Firebase RTDB の games/{id} に published:true と meta ノードを追加/削除し、
 * ARCADE 一覧画面向けの取得APIを提供する。
 */

const ShareArcade = {

    CACHE_KEY: 'arcade_list_cache_v1',
    CACHE_TTL_MS: 5 * 60 * 1000,

    // ARCADE に登録（既存の games/{id} レコードに published と meta を追記）
    // meta = { title, creator, comment, thumbnail, remixOK, originalTitle, originalAuthor, originalShareId }
    async publish(id, meta) {
        if (!window.firebaseDB || !id) return false;
        try {
            await window.firebaseDB.ref('games/' + id).update({
                published: true,
                meta: {
                    title: meta.title || '',
                    creator: meta.creator || '',
                    comment: meta.comment || '',
                    thumbnail: meta.thumbnail || '',
                    remixOK: !!meta.remixOK,
                    originalTitle: meta.originalTitle || '',
                    originalAuthor: meta.originalAuthor || '',
                    originalShareId: meta.originalShareId || '',
                    updatedAt: Date.now()
                }
            });
            this.invalidateCache();
            return true;
        } catch (e) {
            console.error('[ShareArcade] publish failed:', e);
            return false;
        }
    },

    // ARCADE から削除（データ本体は残す）
    async unpublish(id) {
        if (!window.firebaseDB || !id) return false;
        try {
            await window.firebaseDB.ref('games/' + id).update({
                published: null,
                meta: null
            });
            this.invalidateCache();
            return true;
        } catch (e) {
            console.error('[ShareArcade] unpublish failed:', e);
            return false;
        }
    },

    // ARCADE 登録済み一覧を取得（Firebase 直アクセス）
    async fetchList() {
        if (!window.firebaseDB) return [];
        try {
            const snap = await window.firebaseDB.ref('games')
                .orderByChild('published').equalTo(true).once('value');
            const val = snap.val() || {};
            const list = [];
            for (const id in val) {
                const rec = val[id];
                if (!rec.meta) continue;
                list.push({
                    id,
                    title: rec.meta.title || '',
                    creator: rec.meta.creator || '',
                    comment: rec.meta.comment || '',
                    thumbnail: rec.meta.thumbnail || '',
                    remixOK: !!rec.meta.remixOK,
                    originalTitle: rec.meta.originalTitle || '',
                    originalAuthor: rec.meta.originalAuthor || '',
                    originalShareId: rec.meta.originalShareId || '',
                    likes: rec.likes || 0,
                    createdAt: rec.createdAt || 0,
                    updatedAt: rec.updatedAt || 0
                });
            }
            return list;
        } catch (e) {
            console.error('[ShareArcade] fetchList failed:', e);
            return [];
        }
    },

    // キャッシュ経由取得（5分TTL、force=true で強制再取得）
    async fetchListCached(force = false) {
        if (!force) {
            try {
                const raw = localStorage.getItem(this.CACHE_KEY);
                if (raw) {
                    const cached = JSON.parse(raw);
                    if (cached && (Date.now() - cached.t) < this.CACHE_TTL_MS) {
                        return cached.data;
                    }
                }
            } catch (e) {
                // キャッシュ破損時は無視して再取得
            }
        }
        const data = await this.fetchList();
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
        } catch (e) {
            console.warn('[ShareArcade] cache write failed:', e);
        }
        return data;
    },

    // キャッシュ破棄（publish/unpublish時に呼ぶ）
    invalidateCache() {
        try {
            localStorage.removeItem(this.CACHE_KEY);
        } catch (e) {
            // 無視
        }
    }
};
