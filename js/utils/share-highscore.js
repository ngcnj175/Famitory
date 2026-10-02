/**
 * PixelGameKit - グローバルハイスコア連携
 * Firebase RTDB の games/{id}/highscore ノードから取得・更新する。
 * 公開済み（shareId を持つ）ゲームのみ対象。
 */

const ShareHighScore = {

    MAX_SCORE: 999999,
    SUBMIT_COOLDOWN_MS: 10000,
    _lastSubmitAt: 0,
    _cache: new Map(), // gameId -> { score, name }

    // 不適切語ブラックリスト（3文字正規化後に完全一致でチェック）
    BLOCKLIST: [
        // 英語
        'FUK', 'FUC', 'FCK', 'FUX',
        'SEX', 'CUM', 'TIT', 'ASS',
        'DIK', 'DIC', 'DIX', 'COK',
        'FAG', 'HOE', 'JEW', 'NIG',
        'JAP', 'CHK', 'KKK', 'NAZ',
        'STD', 'GAY',
        // 日本語ローマ字
        'ETI', 'UNC', 'UNK', 'CHN',
        'MNK', 'KSU', 'SIN', 'SNE',
        'BAK', 'AHO', 'KYS'
    ],

    // ハイスコア取得（Firebase から 1 回だけ読む）
    async fetch(id) {
        if (!window.firebaseDB || !id) return null;
        try {
            const snap = await window.firebaseDB.ref('games/' + id + '/highscore').once('value');
            const val = snap.val();
            if (!val || typeof val.score !== 'number') return null;
            const result = {
                score: Math.min(val.score | 0, this.MAX_SCORE),
                name: (val.name || '').toString().slice(0, 3).toUpperCase()
            };
            this._cache.set(id, result);
            return result;
        } catch (e) {
            console.error('[ShareHighScore] fetch failed:', e);
            return null;
        }
    },

    // キャッシュ参照（ゲーム開始時に fetch 済み想定）
    getCached(id) {
        return this._cache.get(id) || null;
    },

    // ハイスコア送信（トランザクションで既存値より大きい時のみ更新）
    async submit(id, score, name) {
        if (!window.firebaseDB || !id) return false;
        if (typeof score !== 'number' || score <= 0) return false;

        // クライアント側の軽い妥協チェック
        const clamped = Math.min(score | 0, this.MAX_SCORE);
        const now = Date.now();
        if (now - this._lastSubmitAt < this.SUBMIT_COOLDOWN_MS) {
            console.warn('[ShareHighScore] submit rate-limited');
            return false;
        }
        this._lastSubmitAt = now;

        const cleanName = this._sanitizeName(name);

        try {
            const result = await window.firebaseDB.ref('games/' + id + '/highscore').transaction((cur) => {
                if (cur && typeof cur.score === 'number' && cur.score >= clamped) {
                    return; // 既存の方が高ければ更新しない
                }
                return { score: clamped, name: cleanName, at: now };
            });
            if (result.committed) {
                this._cache.set(id, { score: clamped, name: cleanName });
                return true;
            }
            // コミットされなかった場合、他ユーザーが上回っている可能性 → 最新を読み直してキャッシュ更新
            const latest = result.snapshot && result.snapshot.val();
            if (latest && typeof latest.score === 'number') {
                this._cache.set(id, {
                    score: Math.min(latest.score | 0, this.MAX_SCORE),
                    name: (latest.name || '').toString().slice(0, 3).toUpperCase()
                });
            }
            return false;
        } catch (e) {
            console.error('[ShareHighScore] submit failed:', e);
            return false;
        }
    },

    // 3文字 A-Z0-9 に正規化（不適切語はデフォルト値に置換）
    _sanitizeName(name) {
        const s = (name || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const padded = (s + '---').slice(0, 3);
        if (this.BLOCKLIST.includes(padded)) return '---';
        return padded;
    },

    // ブラックリストチェック（送信前UI警告用）
    isBlocked(name) {
        const s = (name || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const padded = (s + '---').slice(0, 3);
        return this.BLOCKLIST.includes(padded);
    },

    // 直近の投稿者名を localStorage に保存／取得（入力の既定値用）
    rememberName(name) {
        try { localStorage.setItem('pgk_player_name', this._sanitizeName(name)); } catch (e) {}
    },
    recallName() {
        try { return (localStorage.getItem('pgk_player_name') || '').toString().toUpperCase(); }
        catch (e) { return ''; }
    }
};
