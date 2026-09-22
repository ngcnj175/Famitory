/**
 * PixelGameKit - サムネイル生成
 * ゲーム画面の自動キャプチャキャッシュと、画像アップロード時のトリミング処理を提供。
 * 出力は 128x128 PNG の dataURL。
 */

const AppThumbnail = {

    // ゲーム論理ピクセル基準（10タイル × 16px）でドット絵完全保持
    SIZE: 160,

    // プレイ中のゲームキャンバスから取得した最新フレーム（dataURL）
    _lastFrame: null,

    // GameEngine 側から定期的に呼ぶ想定。canvas 中央を 2:1 の整数比でダウンサンプルし
    // 160x160（=10タイル×16px 論理ピクセル）で PNG dataURL 化する。
    captureFromCanvas(canvas) {
        if (!canvas) return;
        try {
            const off = document.createElement('canvas');
            off.width = this.SIZE;
            off.height = this.SIZE;
            const ctx = off.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            // ゲームキャンバスは論理ピクセルの 2倍描画（TILE_SIZE=32, 論理=16）。
            // 中央の SIZE*2 (=320) 領域を取り、2:1 の整数比で SIZE に落とす。
            // 万一キャンバスが小さい場合は入りうる最大の偶数正方領域を採用する。
            const srcMax = Math.min(canvas.width, canvas.height);
            const desiredSrc = this.SIZE * 2;
            const srcSize = srcMax >= desiredSrc
                ? desiredSrc
                : Math.max(2, Math.floor(srcMax / 2) * 2);
            const sx = Math.floor((canvas.width - srcSize) / 2);
            const sy = Math.floor((canvas.height - srcSize) / 2);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, this.SIZE, this.SIZE);
            ctx.drawImage(canvas, sx, sy, srcSize, srcSize, 0, 0, this.SIZE, this.SIZE);
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
