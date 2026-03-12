/**
 * PixelGameKit - URL共有ユーティリティ（Firebase対応）
 */

const Share = {
    // 短縮ID生成（8文字）
    generateShortId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        for (let i = 0; i < 8; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    },

    // Firebaseにゲームデータを保存（新規作成）
    async saveGame(data) {
        const id = this.generateShortId();
        return this.saveOrUpdateGame(id, data, false);
    },

    // Firebaseにゲームデータを保存または上書き
    // id: 保存先のID（呼び出し元で事前に確定させる）
    // isUpdate: true→既存データを上書き(.update)  false→新規作成(.set)
    async saveOrUpdateGame(id, data, isUpdate) {
        if (!window.firebaseDB) {
            console.error('Firebase not initialized');
            return null;
        }

        try {
            const encoded = this.encode(data);

            if (isUpdate) {
                await window.firebaseDB.ref('games/' + id).update({
                    data: encoded,
                    updatedAt: Date.now(),
                    lastAccessed: Date.now()
                });
                console.log('Game updated with ID:', id);
            } else {
                await window.firebaseDB.ref('games/' + id).set({
                    data: encoded,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    lastAccessed: Date.now()
                });
                console.log('Game created with ID:', id);
            }
            return id;
        } catch (e) {
            console.error('Failed to save/update game:', e);
            return null;
        }
    },

    // Firebaseからゲームデータを読み込み
    async loadGame(id) {
        if (!window.firebaseDB) {
            console.error('Firebase not initialized');
            return null;
        }

        try {
            const snapshot = await window.firebaseDB.ref('games/' + id).once('value');
            const record = snapshot.val();

            if (record && record.data) {
                // 最終アクセス日時を更新（削除判断に使用するため）
                window.firebaseDB.ref('games/' + id + '/lastAccessed').set(Date.now())
                    .catch(e => console.warn('[Share] lastAccessed update failed:', e));
                return this.decode(record.data);
            }
            return null;
        } catch (e) {
            console.error('Failed to load game:', e);
            return null;
        }
    },

    // プロジェクトデータをURLエンコード
    encode(data) {
        try {
            const json = JSON.stringify(data);
            const compressed = pako.deflate(json);
            const base64 = btoa(String.fromCharCode.apply(null, compressed));
            // URL safe Base64
            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } catch (e) {
            console.error('Encode failed:', e);
            return null;
        }
    },

    // URLからプロジェクトデータをデコード
    decode(encoded) {
        try {
            // URL safe Base64を戻す
            let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
            // パディング追加
            while (base64.length % 4) {
                base64 += '=';
            }

            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const decompressed = pako.inflate(bytes, { to: 'string' });
            return JSON.parse(decompressed);
        } catch (e) {
            console.error('Decode failed:', e);
            return null;
        }
    },

    // 短縮共有URL生成（Firebase ID使用）
    createShortUrl(id) {
        // 本番環境のURL（GitHub Pages）
        const baseUrl = 'https://ngcnj175.github.io/PixelGameKit/';
        return baseUrl + '?g=' + id;
    },

    // クリップボードにコピー
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // フォールバック
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (e2) {
                document.body.removeChild(textarea);
                return false;
            }
        }
    },

    // X (Twitter) 共有URL生成
    createTwitterUrl(shareUrl, text = 'FAMITORYでゲームを作ったよ！🎮\nプレイしてみてね！') {
        const tweetText = encodeURIComponent(text);
        const encodedUrl = encodeURIComponent(shareUrl);
        return `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodedUrl}`;
    },

    // 共有状態（スコア共有用）
    currentShareData: null,

    // 共有ダイアログを開く（Firebase保存）
    // scoreData: { score: number, title: string, isNewRecord: boolean }
    async openDialog(data, scoreData = null) {
        this.currentShareData = scoreData;

        const dialog = document.getElementById('share-dialog');
        const urlInput = document.getElementById('share-url-input');
        const copySuccess = document.getElementById('copy-success');

        if (!dialog || !urlInput) return;

        // ローディング表示
        urlInput.value = '共有URL生成中...';
        copySuccess.classList.add('hidden');
        dialog.classList.remove('hidden');

        // Firebaseに保存（すでにURLパラメータを持っていればそれを使うのが理想だが、ハイスコア更新などのプレイデータを含めたい場合は新規保存も手）
        // ここでは常に新規保存して最新の状態（スコア等は含まれないがステージデータとして）を共有
        const id = await this.saveGame(data);

        if (!id) {
            urlInput.value = 'エラー：保存に失敗しました';
            return;
        }

        const shareUrl = this.createShortUrl(id);
        urlInput.value = shareUrl;

        if (this.currentShareData) {
            this.currentShareData.url = shareUrl;
        }
    },

    // 共有ダイアログを閉じる
    closeDialog() {
        const dialog = document.getElementById('share-dialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
        this.currentShareData = null;
    },

    // いいね数を取得
    async getLikes(gameId) {
        if (!window.firebaseDB || !gameId) return 0;
        try {
            const snap = await window.firebaseDB.ref('games/' + gameId + '/likes').once('value');
            return snap.val() || 0;
        } catch (e) {
            console.warn('[Share] getLikes failed:', e);
            return 0;
        }
    },

    // いいねを1追加（トランザクションで安全にインクリメント）
    async addLike(gameId) {
        if (!window.firebaseDB || !gameId) return 0;
        try {
            const ref = window.firebaseDB.ref('games/' + gameId + '/likes');
            const result = await ref.transaction(current => (current || 0) + 1);
            return result.snapshot.val() || 0;
        } catch (e) {
            console.warn('[Share] addLike failed:', e);
            return 0;
        }
    }
};
