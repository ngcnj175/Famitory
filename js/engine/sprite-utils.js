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

        for (let py = 0; py < dimension; py++) {
            for (let px = 0; px < dimension; px++) {
                const colorIndex = sprite.data[py]?.[px];
                if (colorIndex >= 0) {
                    ctx.fillStyle = palette[colorIndex];
                    const drawX = flipX
                        ? screenX + (dimension - 1 - px) * pixelSize
                        : screenX + px * pixelSize;
                    ctx.fillRect(drawX, screenY + py * pixelSize, pixelSize + 0.5, pixelSize + 0.5);
                }
            }
        }
    }
};
