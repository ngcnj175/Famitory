/**
 * PixelGameKit - サムネイル生成
 * ゲーム画面の自動キャプチャキャッシュと、画像アップロード時のトリミング処理を提供。
 * 出力は 128x128 PNG の dataURL。
 */

const AppThumbnail = {

    SIZE: 128,

    // プレイ中のゲームキャンバスから取得した最新フレーム（dataURL）
    _lastFrame: null,

    // GameEngine 側から定期的に呼ぶ想定。canvas を 128x128 に縮小して PNG dataURL 化。
    captureFromCanvas(canvas) {
        if (!canvas) return;
        try {
            const off = document.createElement('canvas');
            off.width = this.SIZE;
            off.height = this.SIZE;
            const ctx = off.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            // アスペクト維持で中央にフィット
            const scale = Math.min(this.SIZE / canvas.width, this.SIZE / canvas.height);
            const dw = canvas.width * scale;
            const dh = canvas.height * scale;
            const dx = (this.SIZE - dw) / 2;
            const dy = (this.SIZE - dh) / 2;
            // 背景を黒で塗る（レターボックス）
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, this.SIZE, this.SIZE);
            ctx.drawImage(canvas, dx, dy, dw, dh);
            this._lastFrame = off.toDataURL('image/png');
        } catch (e) {
            console.warn('[AppThumbnail] captureFromCanvas failed:', e);
        }
    },

    // 最後にキャプチャしたフレームを返す（なければ null）
    getLastFrame() {
        return this._lastFrame;
    },

    hasLastFrame() {
        return !!this._lastFrame;
    },

    clearLastFrame() {
        this._lastFrame = null;
    },

    // ファイル(File)からトリミング用の Image を読み込み
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // 画像を正方形中央トリミングして 128x128 PNG dataURL 化
    cropCenterSquare(img) {
        try {
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            const off = document.createElement('canvas');
            off.width = this.SIZE;
            off.height = this.SIZE;
            const ctx = off.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, this.SIZE, this.SIZE);
            return off.toDataURL('image/png');
        } catch (e) {
            console.warn('[AppThumbnail] cropCenterSquare failed:', e);
            return null;
        }
    }
};
