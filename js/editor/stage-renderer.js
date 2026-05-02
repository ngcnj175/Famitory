/**
 * PixelGameKit - ステージエディタ 描画エンジン
 */

class StageRenderer {
    constructor() {
        this._offscreenCanvas = null;
    }

    /**
     * メイン描画エントリポイント
     * @param {object} vc ViewContext — StageEditor が毎フレーム組み立てて渡すスナップショット
     */
    render(vc) {
        const { ctx, canvas } = vc;

        // 背景色
        ctx.fillStyle = vc.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // FGレイヤー描画
        this._renderLayer(vc, 'fg', 1);

        // エンティティ描画
        this._renderEntities(vc);

        this._renderGrid(vc);
        this._renderSelection(vc);
    }

    // ─────────────────────────────────────────
    //  レイヤー / エンティティ
    // ─────────────────────────────────────────

    _renderEntities(vc) {
        const { ctx, stage, sprites, templates, palette, tileSize, scrollX, scrollY } = vc;
        if (!stage.entities) return;

        const basePlayerIdx = templates.findIndex(t => t.type === 'player');

        stage.entities.forEach(entity => {
            const template = templates[entity.templateId];
            if (!template) return;

            let spriteIdx;
            if (template.type === 'player' && basePlayerIdx >= 0 && entity.templateId !== basePlayerIdx) {
                spriteIdx = template.sprites?.transformItem?.frames?.[0]
                    ?? template.sprites?.idle?.frames?.[0]
                    ?? template.sprites?.main?.frames?.[0];
            } else {
                spriteIdx = template.sprites?.idle?.frames?.[0] ?? template.sprites?.main?.frames?.[0];
            }
            const sprite = sprites[spriteIdx];
            if (sprite) {
                const flipX = template.type === 'enemy';
                this._renderSprite(ctx, sprite, entity.x, entity.y, tileSize, scrollX, scrollY, palette, flipX);
            }
        });
    }

    _renderLayer(vc, layerName, alpha) {
        const { ctx, stage, sprites, templates, palette, tileSize, scrollX, scrollY } = vc;
        const layer = stage.layers[layerName];
        const basePlayerIdx = templates.findIndex(t => t.type === 'player');

        ctx.globalAlpha = alpha;

        for (let y = 0; y < stage.height; y++) {
            for (let x = 0; x < stage.width; x++) {
                const tileId = layer[y][x];
                if (tileId <= -1000) continue;

                let sprite;
                if (tileId >= 100) {
                    const template = templates[tileId - 100];
                    const templateIdx = tileId - 100;
                    let spriteIdx;
                    if (template?.type === 'player' && basePlayerIdx >= 0 && templateIdx !== basePlayerIdx) {
                        spriteIdx = template?.sprites?.transformItem?.frames?.[0]
                            ?? template?.sprites?.idle?.frames?.[0]
                            ?? template?.sprites?.main?.frames?.[0];
                    } else {
                        spriteIdx = template?.sprites?.idle?.frames?.[0] ?? template?.sprites?.main?.frames?.[0];
                    }
                    sprite = sprites[spriteIdx];
                } else if (tileId >= 0 && tileId < sprites.length) {
                    sprite = sprites[tileId];
                }
                if (sprite) {
                    this._renderSprite(ctx, sprite, x, y, tileSize, scrollX, scrollY, palette);
                }
            }
        }

        ctx.globalAlpha = 1;
    }

    // ─────────────────────────────────────────
    //  スプライト描画（内部共通）
    // ─────────────────────────────────────────

    _renderSprite(ctx, sprite, tileX, tileY, tileSize, scrollX, scrollY, palette, flipX = false) {
        const spriteSize = sprite.size || 1;
        const tileCount  = spriteSize === 2 ? 2 : 1;
        const pixelSize  = (tileSize * tileCount) / (spriteSize === 2 ? 32 : 16);
        const screenX    = tileX * tileSize + scrollX;
        const screenY    = tileY * tileSize + scrollY;
        SpriteUtils.drawPixels(ctx, sprite, screenX, screenY, pixelSize, palette, flipX);
    }

    /**
     * ミニキャンバスへのスプライト描画（テンプレートリスト等から公開呼び出し可）
     */
    renderSpriteToMiniCanvas(sprite, canvas, bgColor = '#3CBCFC') {
        const ctx       = canvas.getContext('2d');
        const palette   = App.nesPalette;
        const spriteSize = sprite.size || 1;
        const dimension  = spriteSize === 2 ? 32 : 16;

        canvas.width  = dimension;
        canvas.height = dimension;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, dimension, dimension);

        for (let py = 0; py < dimension; py++) {
            for (let px = 0; px < dimension; px++) {
                const colorIndex = sprite.data[py]?.[px];
                if (colorIndex >= 0) {
                    ctx.fillStyle = palette[colorIndex];
                    ctx.fillRect(px, py, 1, 1);
                }
            }
        }
    }

    // ─────────────────────────────────────────
    //  グリッド
    // ─────────────────────────────────────────

    _renderGrid(vc) {
        const { ctx, canvas, stage, tileSize, scrollX, scrollY } = vc;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 0.5;

        for (let x = 0; x <= stage.width; x++) {
            const px = x * tileSize + scrollX;
            if (px >= 0 && px <= canvas.width) {
                ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height); ctx.stroke();
            }
        }
        for (let y = 0; y <= stage.height; y++) {
            const py = y * tileSize + scrollY;
            if (py >= 0 && py <= canvas.height) {
                ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvas.width, py); ctx.stroke();
            }
        }

        // 16タイル区切りの強調線
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        for (let x = 16; x < stage.width; x += 16) {
            const px = x * tileSize + scrollX;
            if (px >= 0 && px <= canvas.width) {
                ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height); ctx.stroke();
            }
        }
        for (let y = 16; y < stage.height; y += 16) {
            const py = y * tileSize + scrollY;
            if (py >= 0 && py <= canvas.height) {
                ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvas.width, py); ctx.stroke();
            }
        }
    }

    // ─────────────────────────────────────────
    //  選択 / ペースト / 浮動レイヤー
    // ─────────────────────────────────────────

    _renderSelection(vc) {
        const { ctx, canvas, tileSize, scrollX, scrollY, sprites, templates, palette } = vc;

        // オフスクリーンキャンバス（重なりによるドット格子防止）
        if (!this._offscreenCanvas) this._offscreenCanvas = document.createElement('canvas');
        const off = this._offscreenCanvas;
        if (off.width !== canvas.width || off.height !== canvas.height) {
            off.width  = canvas.width;
            off.height = canvas.height;
        }
        const offCtx = off.getContext('2d');

        const renderAt = (tileId, tx, ty, isEntity = false) => {
            if (tileId <= -1000 || tileId === -1) return;
            let sprite, flipX = false;
            if (isEntity) {
                const tmpl = templates[tileId];
                if (tmpl) {
                    sprite = sprites[tmpl.sprites?.idle?.frames?.[0] ?? tmpl.sprites?.main?.frames?.[0]];
                    flipX  = tmpl.type === 'enemy';
                }
            } else if (tileId >= 100) {
                const tmpl = templates[tileId - 100];
                sprite = sprites[tmpl?.sprites?.idle?.frames?.[0] ?? tmpl?.sprites?.main?.frames?.[0]];
            } else if (tileId >= 0 && tileId < sprites.length) {
                sprite = sprites[tileId];
            }
            if (sprite) this._renderSprite(offCtx, sprite, tx, ty, tileSize, scrollX, scrollY, palette, flipX);
        };

        // ── ペーストプレビュー ──
        if (vc.pasteMode && vc.pasteData?.tiles) {
            const { tiles, entities } = vc.pasteData;
            const h = tiles.length, w = tiles[0].length;
            offCtx.clearRect(0, 0, off.width, off.height);
            for (let dy = 0; dy < h; dy++)
                for (let dx = 0; dx < w; dx++)
                    renderAt(tiles[dy][dx], vc.pasteOffset.x + dx, vc.pasteOffset.y + dy);
            if (entities)
                entities.forEach(e => renderAt(e.templateId, vc.pasteOffset.x + e.relX, vc.pasteOffset.y + e.relY, true));

            ctx.globalAlpha = 0.7;
            ctx.drawImage(off, 0, 0);
            ctx.globalAlpha = 1.0;

            const rx = vc.pasteOffset.x * tileSize + scrollX;
            const ry = vc.pasteOffset.y * tileSize + scrollY;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(rx, ry, w * tileSize, h * tileSize);
            ctx.setLineDash([]);
        }

        if (!vc.selectionStart || !vc.selectionEnd) return;

        // ── 浮動レイヤー ──
        if (vc.isFloating && vc.floatingData) {
            offCtx.clearRect(0, 0, off.width, off.height);
            for (let y = 0; y < vc.floatingData.length; y++)
                for (let x = 0; x < vc.floatingData[0].length; x++)
                    renderAt(vc.floatingData[y][x], vc.floatingPos.x + x, vc.floatingPos.y + y);
            if (vc.floatingEntities)
                vc.floatingEntities.forEach(e => renderAt(e.templateId, vc.floatingPos.x + e.relX, vc.floatingPos.y + e.relY, true));

            ctx.globalAlpha = 0.5;
            ctx.drawImage(off, 0, 0);
            ctx.globalAlpha = 1.0;
        }

        // ── 選択枠 ──
        const x1 = Math.min(vc.selectionStart.x, vc.selectionEnd.x);
        const y1 = Math.min(vc.selectionStart.y, vc.selectionEnd.y);
        const x2 = Math.max(vc.selectionStart.x, vc.selectionEnd.x);
        const y2 = Math.max(vc.selectionStart.y, vc.selectionEnd.y);

        ctx.strokeStyle = vc.isSelecting ? '#ffffff' : '#90EE90';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
            x1 * tileSize + scrollX,
            y1 * tileSize + scrollY,
            (x2 - x1 + 1) * tileSize,
            (y2 - y1 + 1) * tileSize
        );
        ctx.setLineDash([]);
    }
}
