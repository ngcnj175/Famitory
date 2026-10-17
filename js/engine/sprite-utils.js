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
        const s = Math.max(1, speed ?? 4);
        return Math.max(1, Math.floor(60 / s)) * (1000 / 60);
    },

    // 5段階ゲージ → sprite speed値 の非線形マッピング。
    // 低速側（花揺れ等）と高速側の両方をカバーするため等比に近い配列を採用。
    //   lv1=1000ms, lv2=500ms, lv3=250ms, lv4=111ms, lv5=50ms
    GAUGE_TO_SPEED: [1, 2, 4, 9, 20],

    /**
     * UIの5段階ゲージ(1-5) → sprite の speed 値 に変換。
     */
    gaugeLevelToSpeed(level) {
        const lv = Math.max(1, Math.min(5, level));
        return this.GAUGE_TO_SPEED[lv - 1];
    },

    /**
     * sprite の speed 値 → 最も近い5段階ゲージレベル(1-5) を返す。
     * 既存プロジェクトで保存済みの speed 値をゲージ表示するときに使う。
     */
    speedToGaugeLevel(speed) {
        const s = Math.max(1, speed ?? 4);
        let nearest = 1, minDiff = Infinity;
        for (let i = 0; i < this.GAUGE_TO_SPEED.length; i++) {
            const diff = Math.abs(this.GAUGE_TO_SPEED[i] - s);
            if (diff < minDiff) { minDiff = diff; nearest = i + 1; }
        }
        return nearest;
    },

    // 5段階ゲージ → jumpPower config値 の非線形マッピング。
    // 公式 vy = -0.2 - (c/20)*0.3 と重力 0.02 の離散物理で、
    // 各段が「ちょうど N+1 タイルをギリギリ超える」ように調整。
    //   lv1→c=7 (h≈2.18), lv2→c=11 (h≈3.15), lv3→c=15 (h≈4.31),
    //   lv4→c=18 (h≈5.29), lv5→c=20 (h=6.00)
    GAUGE_TO_JUMP: [7, 11, 15, 18, 20],

    gaugeLevelToJump(level) {
        const lv = Math.max(1, Math.min(5, level));
        return this.GAUGE_TO_JUMP[lv - 1];
    },

    jumpToGaugeLevel(jump) {
        const j = Math.max(1, jump ?? 10);
        let nearest = 1, minDiff = Infinity;
        for (let i = 0; i < this.GAUGE_TO_JUMP.length; i++) {
            const diff = Math.abs(this.GAUGE_TO_JUMP[i] - j);
            if (diff < minDiff) { minDiff = diff; nearest = i + 1; }
        }
        return nearest;
    }
};
