/**
 * PixelGameKit - スプライト描画ユーティリティ（共有）
 * StageRenderer / GameRenderer 共通のピクセル描画コア
 */
const SpriteUtils = {
    /**
     * スプライトをスクリーン座標に描画
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} sprite
     * @param {number} screenX - スクリーン座標 X（ピクセル）
     * @param {number} screenY - スクリーン座標 Y（ピクセル）
     * @param {number} pixelSize - 1ドットのサイズ（px）
     * @param {Array} palette - カラーパレット配列
     * @param {boolean} [flipX=false] - 左右反転
     */
    drawPixels(ctx, sprite, screenX, screenY, pixelSize, palette, flipX = false) {
        if (!sprite) return;
        const spriteSize = sprite.size || 1;
        const dimension = spriteSize === 2 ? 32 : 16;
        // 非整数スケール時のみ隙間埋めパディングを付与（整数倍時は薄い縁が出るため付けない）
        const pad = Number.isInteger(pixelSize) ? 0 : 0.5;

        for (let py = 0; py < dimension; py++) {
            for (let px = 0; px < dimension; px++) {
                const colorIndex = sprite.data[py]?.[px];
                if (colorIndex >= 0) {
                    ctx.fillStyle = palette[colorIndex];
                    const drawX = flipX
                        ? screenX + (dimension - 1 - px) * pixelSize
                        : screenX + px * pixelSize;
                    ctx.fillRect(drawX, screenY + py * pixelSize, pixelSize + pad, pixelSize + pad);
                }
            }
        }
    },

    /**
     * アニメーション1フレームの表示時間(ms)を返す。
     * ゲームプレイ時の 60fps 計算と一致させるための共通ヘルパー。
     * ゲーム: Math.max(1, Math.floor(60/speed)) フレーム × (1000/60)ms
     * この1箇所を変えれば全体の基本速度を調整可能。
     * @param {number} speed - 1〜20
     * @returns {number} ミリ秒
     */
    getFrameIntervalMs(speed) {
        const s = Math.max(1, speed ?? 5);
        return Math.max(1, Math.floor(60 / s)) * (1000 / 60);
    },

    /**
     * UIの5段階ゲージ(1-5) → sprite の speed 値(1-20) に変換。
     * stage-editor.js:914 の計算式 round((index-1)/4 * (max-min) + min) と一致。
     * @param {number} level - 1〜5
     * @returns {number} speed 1〜20
     */
    gaugeLevelToSpeed(level) {
        const lv = Math.max(1, Math.min(5, level));
        return Math.round(((lv - 1) / 4) * 19 + 1);
    }
};
