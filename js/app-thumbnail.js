/**
 * PixelGameKit - サムネイル生成
 * ゲーム画面の自動キャプチャキャッシュと、画像アップロード時のトリミング処理を提供。
 * 出力は 128x128 PNG の dataURL。
 */

const AppThumbnail = {

    // アップロード画像クロップ時の出力目標サイズ（論理ピクセル基準）
    SIZE: 160,

    // プレイ中のゲームキャンバスから取得した最新フレーム（dataURL）
    _lastFrame: null,

    // GameEngine 側から呼ばれる。ゲームキャンバスは論理ピクセルの 2倍描画（TILE_SIZE=32,
    // 論理=16）なので、canvas 全体を 2:1 の整数比で縮小して論理解像度の PNG dataURL 化する。
    // 保存サイズは端末（viewTiles）に応じ可変（160〜200 前後）。見切れなしで完全ドット絵。
    captureFromCanvas(canvas) {
        if (!canvas) return;
        try {
            const size = Math.min(canvas.width, canvas.height);
            const outSize = Math.max(2, Math.floor(size / 2));
            const srcSize = outSize * 2;
            const off = document.createElement('canvas');
            off.width = outSize;
            off.height = outSize;
            const ctx = off.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            // canvas が正方なら crop=0、非正方でも中央正方領域を採用
            const sx = Math.floor((canvas.width - srcSize) / 2);
            const sy = Math.floor((canvas.height - srcSize) / 2);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, outSize, outSize);
            ctx.drawImage(canvas, sx, sy, srcSize, srcSize, 0, 0, outSize, outSize);
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
