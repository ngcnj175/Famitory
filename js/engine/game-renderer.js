/**
 * PixelGameKit - ゲーム描画エンジン
 * GameEngine の renderGameScreen, renderLayer, renderLayerFiltered, renderSprite を担当
 */

const _ANIM_SLOT_NAMES = ['idle', 'main', 'walk', 'jump', 'attack', 'shot', 'life'];

class GameRenderer {
    constructor(owner) {
        this.owner = owner; // GameEngine reference
    }

    // ========== アニメーションヘルパー ==========

    // spriteSlots から最初の有効スロットの { frames, speed } を返す
    // preferredSlot が指定されていれば優先して使用する
    _resolveAnimSlot(spriteSlots, preferredSlot = null) {
        if (preferredSlot) {
            const slot = spriteSlots[preferredSlot];
            if (slot?.frames?.length > 0) return { frames: slot.frames, speed: slot.speed ?? 5 };
        }
        for (const name of _ANIM_SLOT_NAMES) {
            const slot = spriteSlots[name];
            if (slot?.frames?.length > 0) return { frames: slot.frames, speed: slot.speed ?? 5 };
        }
        return { frames: [], speed: 5 };
    }

    // frames・speed・tick からスプライトインデックスを返す
    // clamp=true の場合はループしない（melee用）
    _getAnimSpriteIdx(frames, speed, tick, clamp = false) {
        if (frames.length === 0) return -1;
        if (frames.length === 1) return frames[0];
        const interval = Math.max(1, Math.floor(60 / speed));
        if (clamp) return frames[Math.min(Math.floor(tick / interval), frames.length - 1)];
        return frames[Math.floor(tick / interval) % frames.length];
    }

    _fillTextWithShadow(ctx, text, x, y, color = '#ffffff') {
        ctx.fillStyle = '#000000';
        ctx.fillText(text, x + 1, y + 1);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    // ========== メイン描画処理 ==========
    renderGameScreen() {
        if (!this.owner.player) return;

        // 背景色
        const bgColor = App.projectData.stage.bgColor || App.projectData.stage.backgroundColor || '#3CBCFC';
        this.owner.ctx.fillStyle = bgColor;
        this.owner.ctx.fillRect(0, 0, this.owner.canvas.width, this.owner.canvas.height);

        // ステージ情報を取得（共通で使用）
        const stage = this.owner.stageData || App.projectData.stage;

        // カメラ更新（線形補間なしでシンプルに追従）
        // ただし、クリア演出中('clear')は更新しない（プレイヤーがジャンプしても画面を揺らさないため）
        if (this.owner.titleState !== 'clear') {
            const centerX = this.owner.canvas.width / 2 / this.owner.TILE_SIZE;
            const centerY = this.owner.canvas.height / 2 / this.owner.TILE_SIZE;
            // プレイヤー中心
            let targetX = this.owner.player.x + this.owner.player.width / 2 - centerX;
            let targetY = this.owner.player.y + this.owner.player.height / 2 - centerY;

            // ステージ端制限
            const viewWidth = this.owner.canvas.width / this.owner.TILE_SIZE;
            const viewHeight = this.owner.canvas.height / this.owner.TILE_SIZE;

            targetX = Math.max(0, Math.min(targetX, stage.width - viewWidth));
            targetY = Math.max(0, Math.min(targetY, stage.height - viewHeight));

            this.owner.camera.x = targetX;
            this.owner.camera.y = targetY;
        }

        // ワイプ中は更新しない（見た目を固定）
        if (this.owner.titleState === 'wipe' || this.owner.titleState === 'gameover' || this.owner.titleState === 'clear') {
            // そのまま描画
        }

        const camX = this.owner.camera.x;
        const camY = this.owner.camera.y;
        const viewTilesX = Math.ceil(this.owner.canvas.width / this.owner.TILE_SIZE) + 1;
        const viewTilesY = Math.ceil(this.owner.canvas.height / this.owner.TILE_SIZE) + 1;
        const startX = Math.floor(camX);
        const startY = Math.floor(camY);
        const endX = startX + viewTilesX;
        const endY = startY + viewTilesY;
        const palette = App.nesPalette;

        // 1. 背景レイヤー (BG)
        if (stage.layers.bg) {
            this.renderLayer(stage.layers.bg, startX, startY, endX, endY);
        }

        // ギミックブロック位置セット（renderLayerFiltered で2回使うため1度だけ構築）
        const gimmickPositions = new Set();
        if (this.owner.gimmickBlocks) {
            this.owner.gimmickBlocks.forEach(b => gimmickPositions.add(`${b.tileX},${b.tileY}`));
        }

        // 2. FGレイヤー (装飾用・当たり判定なしのブロック)
        // 当たり判定ありのブロックは後で描画
        if (stage.layers.fg) {
            this.renderLayerFiltered(stage.layers.fg, startX, startY, endX, endY, false, gimmickPositions); // collision=false のみ
        }

        // 2.5 ギミックブロック（動くブロック）をプレイヤーやアイテムの奥（背景寄り）で描画
        if (this.owner.gimmickBlocks) {
            this.owner.gimmickBlocks.forEach(block => {
                if (block.template) {
                    const spriteIdx = block.template.sprites?.main?.frames?.[0];
                    if (spriteIdx !== undefined) {
                        const obj = {
                            x: block.x, y: block.y,
                            spriteIdx: spriteIdx,
                            facingRight: true,
                            templateIdx: block.templateIdx
                        };
                        this.renderProjectileOrItem(obj);
                    }
                }
            });
        }

        // 3. アイテム (blocksの後ろにある場合は隠す)
        this.owner.items.forEach(item => {
            if (item.collected) return;

            // ブロックで隠れているかチェック
            const itemTileX = Math.floor(item.x);
            const itemTileY = Math.floor(item.y);
            let isHidden = false;

            if (stage.layers.bg) {
                // 壁（衝突判定あり）がある場合のみ隠す
                if (this.owner.getCollision(itemTileX, itemTileY) === 1) {
                    isHidden = true;
                }
            }

            if (!isHidden) {
                this.renderProjectileOrItem(item);
            }
        });

        // 3.5. プロジェクタイル (武器をプレイヤー/敵の奥に描画) - 近接と回転以外
        this.owner.projectiles.forEach(proj => {
            if (proj.shotType !== 'melee' && proj.shotType !== 'orbit') {
                this.renderProjectileOrItem(proj);
            }
        });

        // 4. エネミー（chase・空中zigzag・死亡中を除く）
        this.owner.enemies.forEach(enemy => {
            if (!enemy.isDying && enemy.behavior !== 'chase' && !(enemy.behavior === 'zigzag' && enemy.isAerial)) this._renderEnemyIfVisible(enemy);
        });

        // 5. プレイヤー（クリア演出中はFGレイヤー後に描画するためスキップ、死亡落下中もスキップ）
        if (this.owner.player && !(this.owner.player.isDead && this.owner.player.isDying) && this.owner.titleState !== 'clear') {
            this.owner.player.render(this.owner.ctx, this.owner.TILE_SIZE, this.owner.camera);
        }

        // 6. FGレイヤー (当たり判定ありのブロック - プレイヤー/敵より手前)
        if (stage.layers.fg) {
            this.renderLayerFiltered(stage.layers.fg, startX, startY, endX, endY, true, gimmickPositions); // collision=true のみ
        }

        // 6.5. chase敵・空中zigzag敵（FGブロックより前面）
        this.owner.enemies.forEach(enemy => {
            if (!enemy.isDying && (enemy.behavior === 'chase' || (enemy.behavior === 'zigzag' && enemy.isAerial))) this._renderEnemyIfVisible(enemy);
        });

        // 6.6. クリア演出中のプレイヤー（喜びジャンプを前景に表示）
        if (this.owner.titleState === 'clear' && this.owner.player && !this.owner.player.isDead) {
            this.owner.player.render(this.owner.ctx, this.owner.TILE_SIZE, this.owner.camera);
        }

        // 7. 特殊プロジェクタイル (近接と回転は一番手前、FGブロックよりも前面)
        this.owner.projectiles.forEach(proj => {
            if (proj.shotType === 'melee' || proj.shotType === 'orbit') {
                this.renderProjectileOrItem(proj);
            }
        });

        // 8. 死亡中の敵（FGレイヤーより手前に表示）
        this.owner.enemies.forEach(enemy => {
            if (enemy.isDying) {
                enemy.render(this.owner.ctx, this.owner.TILE_SIZE, this.owner.camera);
            }
        });

        // 8.5. 死亡中のプレイヤー（FGレイヤーより手前に表示）
        if (this.owner.player && this.owner.player.isDead && this.owner.player.isDying) {
            this.owner.player.render(this.owner.ctx, this.owner.TILE_SIZE, this.owner.camera);
        }

        // 10. パーティクル
        this.renderParticles();

        // 10.5. とびら白点滅エフェクト
        this.renderDoorFlash();

        // 11. UI
        this.renderUI();

        // 12. イースターエッグメッセージウィンドウ
        if (this.owner.easterMessageActive) {
            this.renderEasterWindow();
        }
    }

    // ========== レイヤー描画 ==========
    renderLayer(layer, startX, startY, endX, endY) {
        if (!layer) return;
        const templates = App.projectData.templates || [];
        const stage = App.projectData.stage;
        const sprites = App.projectData.sprites;

        for (let y = startY; y < endY; y++) {
            if (y < 0 || y >= stage.height) continue;
            for (let x = startX; x < endX; x++) {
                if (x < 0 || x >= stage.width) continue;

                // 破壊済みタイルはスキップ
                if (this.owner.destroyedTiles.has(`${x},${y}`)) continue;

                const tileId = layer[y][x];
                if (tileId >= 0) {
                    let spriteIdx = -1;
                    if (tileId >= 100) {
                        const template = templates[tileId - 100];
                        // アイテム、敵、プレイヤーは個別のループで描画するためここではスキップ
                        if (template && (template.type === 'item' || template.type === 'enemy' || template.type === 'player')) continue;

                        // マテリアル（ブロック）などはここで描画
                        const { frames, speed } = this._resolveAnimSlot(template?.sprites || {});
                        spriteIdx = this._getAnimSpriteIdx(frames, speed, this.owner.tileAnimationFrame);
                    } else {
                        // 旧形式または単純タイル
                        spriteIdx = tileId;
                    }

                    if (spriteIdx !== undefined && spriteIdx >= 0) {
                        const screenX = (x - this.owner.camera.x) * this.owner.TILE_SIZE;
                        const screenY = (y - this.owner.camera.y) * this.owner.TILE_SIZE;
                        this.renderSprite(sprites[spriteIdx], screenX, screenY, App.nesPalette);
                    }
                }
            }
        }
    }

    // ========== フィルタリング付きレイヤー描画 ==========
    renderLayerFiltered(layer, startX, startY, endX, endY, collisionOnly, gimmickPositions) {
        if (!layer) return;
        const templates = App.projectData.templates || [];
        const stage = App.projectData.stage;
        const sprites = App.projectData.sprites;

        for (let y = startY; y < endY; y++) {
            if (y < 0 || y >= stage.height) continue;
            for (let x = startX; x < endX; x++) {
                if (x < 0 || x >= stage.width) continue;

                // 破壊済みタイルはスキップ
                if (this.owner.destroyedTiles.has(`${x},${y}`)) continue;

                // ギミックブロックは別途描画するのでスキップ
                if (gimmickPositions.has(`${x},${y}`)) {
                    continue;
                }

                const tileId = layer[y][x];
                if (tileId >= 0) {
                    let template = null;
                    let spriteIdx = -1;
                    let hasCollision = false;

                    if (tileId >= 100) {
                        template = templates[tileId - 100];
                        // アイテム、敵、プレイヤーは個別のループで描画するためここではスキップ
                        if (template && (template.type === 'item' || template.type === 'enemy' || template.type === 'player')) continue;

                        // 当たり判定の確認（materialタイプでcollisionがfalseでない場合は当たり判定あり）
                        if (template && template.type === 'material') {
                            hasCollision = template.config?.collision !== false && template.config?.gimmick !== 'ladder';
                        }

                        // アニメーション対応
                        const { frames, speed } = this._resolveAnimSlot(template?.sprites || {});
                        spriteIdx = this._getAnimSpriteIdx(frames, speed, this.owner.tileAnimationFrame);
                    } else {
                        // 旧形式または単純タイル（当たり判定なしとみなす）
                        spriteIdx = tileId;
                        hasCollision = false;
                    }

                    // フィルタリング: collisionOnlyがtrueなら当たり判定ありのみ、falseなら当たり判定なしのみ
                    if (collisionOnly !== hasCollision) continue;

                    if (spriteIdx !== undefined && spriteIdx >= 0) {
                        const screenX = (x - this.owner.camera.x) * this.owner.TILE_SIZE;
                        const screenY = (y - this.owner.camera.y) * this.owner.TILE_SIZE;
                        this.renderSprite(sprites[spriteIdx], screenX, screenY, App.nesPalette);
                    }
                }
            }
        }
    }

    // ========== 敵描画ヘルパー ==========
    // frozen敵がFG衝突ブロック内にいる場合は非表示、それ以外は描画
    _renderEnemyIfVisible(enemy) {
        if (enemy.frozen) {
            const ex = Math.floor(enemy.x);
            const ey = Math.floor(enemy.y);
            if (this.owner.getCollision(ex, ey) === 1) return;
        }
        enemy.render(this.owner.ctx, this.owner.TILE_SIZE, this.owner.camera);
    }

    // ========== スプライト描画 ==========
    renderSprite(sprite, x, y, palette, flipX = false) {
        if (!sprite) return;
        const spriteSize = sprite.size || 1;
        const tileCount  = spriteSize === 2 ? 2 : 1;
        const pixelSize  = (this.owner.TILE_SIZE * tileCount) / (spriteSize === 2 ? 32 : 16);
        SpriteUtils.drawPixels(this.owner.ctx, sprite, x, y, pixelSize, palette, flipX);
    }

    // ========== メイン描画ラッパー ==========
    render() {
        this.renderGameScreen();
    }

    // ========== ローディング画面 ==========
    renderLoading() {
        const ctx = this.owner.ctx;
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, this.owner.canvas.width, this.owner.canvas.height);
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Loading...', this.owner.canvas.width / 2, this.owner.canvas.height / 2);
    }

    // ========== タイトル・ワイプ演出 ==========
    renderTitleScreen() {
        const ctx = this.owner.ctx;
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, this.owner.canvas.width, this.owner.canvas.height);

        this.owner.titleBlinkTimer++;
        if (Math.floor(this.owner.titleBlinkTimer / 30) % 2 === 0) {
            const pushStartText = AppI18N.I18N['U449'][AppI18N.currentLang] || 'PUSH START';
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(pushStartText, this.owner.canvas.width / 2, this.owner.canvas.height - 120);
        }

        if (this.owner.titleState === 'title') {
            document.getElementById('push-start-ui')?.classList.remove('hidden');
            this.owner.animationId = requestAnimationFrame(() => this.renderTitleScreen());
        }
    }

    renderWipe() {
        const ctx = this.owner.ctx;
        const progress = this.owner.wipeTimer / 30;

        if (this.owner.wipeTimer === 0) {
            document.getElementById('push-start-ui')?.classList.add('hidden');
        }

        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, this.owner.canvas.width, this.owner.canvas.height);

        const maxSize = Math.max(this.owner.canvas.width, this.owner.canvas.height);
        const size = maxSize * progress;
        const x = (this.owner.canvas.width - size) / 2;
        const y = (this.owner.canvas.height - size) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, size, size);
        ctx.clip();
        this.renderGameScreen();
        ctx.restore();
    }

    renderCloseWipe() {
        const ctx = this.owner.ctx;
        const progress = this.owner.gameOverTimer / 30;

        this.renderGameScreen();

        const maxSize = Math.max(this.owner.canvas.width, this.owner.canvas.height);
        const size = Math.floor(maxSize * (1 - progress));
        const x = Math.floor((this.owner.canvas.width - size) / 2);
        const y = Math.floor((this.owner.canvas.height - size) / 2);

        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, this.owner.canvas.width, y + 1);
        ctx.fillRect(0, y + size - 1, this.owner.canvas.width, this.owner.canvas.height - y - size + 2);
        ctx.fillRect(0, y, x + 1, size);
        ctx.fillRect(x + size - 1, y, this.owner.canvas.width - x - size + 2, size);
    }

    // ========== ゲームオーバー・クリア演出 ==========
    renderGameOverText() {
        const ctx = this.owner.ctx;
        const gameOverText = AppI18N.I18N['U398'][AppI18N.currentLang] || 'GAME OVER';
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, this.owner.canvas.width, this.owner.canvas.height);
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        this._fillTextWithShadow(ctx, gameOverText, this.owner.canvas.width / 2, this.owner.canvas.height / 2);
    }

    renderGameOver() {
        // 互換性のため残す
        this.renderGameOverText();
    }

    renderClearEffect() {
        const ctx = this.owner.ctx;
        const w = this.owner.canvas.width;
        const h = this.owner.canvas.height;
        const stageClearText = AppI18N.I18N['U397'][AppI18N.currentLang] || 'STAGE CLEAR!';

        if (this.owner.clearTimer > 120) {
            const wipeProgress = Math.min((this.owner.clearTimer - 120) / 30, 1);
            const darkWidth = (w / 2) * wipeProgress;
            ctx.fillStyle = '#333333';
            ctx.fillRect(0, 0, darkWidth, h);
            ctx.fillRect(w - darkWidth, 0, darkWidth, h);
        }

        if (Math.floor(this.owner.clearTimer / 10) % 2 === 0) {
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            this._fillTextWithShadow(ctx, stageClearText, w / 2, h / 2);
        }

        if (this.owner.clearTimer > 210) {
            this.owner.titleState = 'result';
            this.renderResultScreen();
        }
    }

    // ========== イースターエッグ ==========
    renderEasterWindow() {
        const ctx = this.owner.ctx;
        const w = this.owner.canvas.width;
        const h = this.owner.canvas.height;
        const message = this.owner.easterMessage || '';

        const maxCharsPerLine = 10;
        const lines = [];
        for (let i = 0; i < message.length; i += maxCharsPerLine) {
            lines.push(message.slice(i, i + maxCharsPerLine));
        }

        const padding = 24;
        const lineHeight = 22;
        const buttonHeight = 24;
        const charWidth = 16;

        const textWidth = maxCharsPerLine * charWidth + padding * 2;
        const windowWidth = Math.max(textWidth, 180);
        const windowHeight = (lines.length * lineHeight) + buttonHeight + padding * 3;
        const windowX = (w - windowWidth) / 2;
        const windowY = (h - windowHeight) / 2;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(windowX - 4, windowY - 4, windowWidth + 8, windowHeight + 8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(windowX, windowY, windowWidth, windowHeight);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        lines.forEach((line, idx) => {
            ctx.fillText(line, w / 2, windowY + padding + lineHeight * idx + lineHeight / 2);
        });

        const buttonWidth = 80;
        const buttonX = (w - buttonWidth) / 2;
        const buttonY = windowY + windowHeight - buttonHeight - padding;

        ctx.fillStyle = '#333333';
        ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '14px monospace';
        ctx.fillText('とじる', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

        this.owner.easterCloseButton = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };
    }

    // ========== プロジェクタイル・アイテム描画 ==========
    renderProjectileOrItem(obj) {
        let spriteIdx = obj.spriteIdx;
        if (obj.templateIdx !== undefined) {
            const template = App.projectData.templates[obj.templateIdx];
            if (template) {
                const preferredSlot = obj.animationSlot ||
                    (obj.itemType === 'transform' ? 'transformItem' : null);
                const { frames, speed } = this._resolveAnimSlot(template.sprites || {}, preferredSlot);
                const tick = obj.shotType === 'melee' ? (obj.age || 0) : this.owner.tileAnimationFrame;
                const animIdx = this._getAnimSpriteIdx(frames, speed, tick, obj.shotType === 'melee');
                if (animIdx >= 0) spriteIdx = animIdx;
            }
        }

        const sprite = App.projectData.sprites[spriteIdx];
        if (!sprite) return;

        const screenX = (obj.x - this.owner.camera.x) * this.owner.TILE_SIZE;
        const screenY = (obj.y - this.owner.camera.y) * this.owner.TILE_SIZE;
        const flipX = obj.facingRight === false;
        this.renderSprite(sprite, screenX, screenY, App.nesPalette, flipX);
    }

    // ========== ドア点滅エフェクト ==========
    renderDoorFlash() {
        if (!this.owner.doorFlashTiles || this.owner.doorFlashTiles.length === 0) return;

        const ctx = this.owner.ctx;
        const tileSize = this.owner.TILE_SIZE;
        const camX = this.owner.camera.x;
        const camY = this.owner.camera.y;

        this.owner.doorFlashTiles = this.owner.doorFlashTiles.filter(flash => {
            if (flash.phase === 'wait') {
                flash.waitTimer--;
                if (flash.waitTimer <= 0) flash.phase = 'flash';

                if (flash.spriteData) {
                    const screenX = (flash.x - camX) * tileSize;
                    const screenY = (flash.y - camY) * tileSize;
                    this.renderSprite(flash.spriteData, screenX, screenY, App.nesPalette);
                }
                return true;
            }

            flash.flashTimer--;
            const alpha = flash.flashTimer / 20;

            if (flash.flashTimer <= 0) {
                if (flash.tileKey) {
                    if (!this.owner.destroyedTiles) this.owner.destroyedTiles = new Set();
                    this.owner.destroyedTiles.add(flash.tileKey);
                }
                return false;
            }

            const screenX = (flash.x - camX) * tileSize;
            const screenY = (flash.y - camY) * tileSize;

            if (flash.spriteData) {
                const sprite = flash.spriteData;
                const spriteSize = sprite.size || 1;
                const dimension = spriteSize === 2 ? 32 : 16;
                const pixelSize = tileSize / 16;

                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#FFFFFF';
                for (let y = 0; y < dimension; y++) {
                    for (let x = 0; x < dimension; x++) {
                        if ((sprite.data[y]?.[x] ?? -1) >= 0) {
                            ctx.fillRect(screenX + x * pixelSize, screenY + y * pixelSize, pixelSize + 0.5, pixelSize + 0.5);
                        }
                    }
                }
                ctx.globalAlpha = 1.0;
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(screenX, screenY, tileSize, tileSize);
                ctx.globalAlpha = 1.0;
            }

            return true;
        });

        if (this.owner.doorAnimating && this.owner.doorFlashTiles.length === 0) {
            this.owner.doorAnimating = false;
        }
    }

    // ========== パーティクル ==========
    updateParticles() {
        this.owner.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.015;
            p.life--;
        });
        this.owner.particles = this.owner.particles.filter(p => p.life > 0);
    }

    renderParticles() {
        const ctx = this.owner.ctx;
        const camX = this.owner.camera.x;
        const camY = this.owner.camera.y;
        const tileSize = this.owner.TILE_SIZE;
        const pixelScale = tileSize / 16;

        this.owner.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(
                (p.x - camX) * tileSize,
                (p.y - camY) * tileSize,
                p.size * pixelScale,
                p.size * pixelScale
            );
        });
    }

    // ========== UI描画 ==========
    renderUI() {
        const ctx = this.owner.ctx;

        // ライフ表示
        if (this.owner.player && !this.owner.player.isDead) {
            const lifeSprites = this.owner.player.template?.sprites?.life;
            const frames = lifeSprites?.frames || [];
            const speed = lifeSprites?.speed || 5;
            const spriteIdx = this._getAnimSpriteIdx(frames, speed, this.owner.tileAnimationFrame);
            const sprite = spriteIdx >= 0 ? App.projectData.sprites[spriteIdx] : null;
            if (sprite) {
                const heartSize = 20;
                const pixelSize = heartSize / 16;
                for (let i = 0; i < this.owner.player.lives; i++) {
                    const posX = 10 + i * (heartSize + 2);
                    SpriteUtils.drawPixels(ctx, sprite, posX, 10, pixelSize, App.nesPalette);
                }
            }
        }

        // PAUSE / RE:START
        if (this.owner.isPaused && !this.owner.restartBlink) {
            const pauseText = AppI18N.I18N['U450'][AppI18N.currentLang] || 'PAUSE';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            this._fillTextWithShadow(ctx, pauseText, this.owner.canvas.width / 2, this.owner.canvas.height / 2);
        }

        if (this.owner.restartBlink) {
            const centerX = this.owner.canvas.width / 2;
            const centerY = this.owner.canvas.height / 2;
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('RE:START', centerX, centerY);

            if (this.owner.restartProgress > 0) {
                const barWidth = 80;
                const barX = centerX - barWidth / 2;
                const barY = centerY + 14;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.fillRect(barX, barY, barWidth, 4);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(barX, barY, barWidth * this.owner.restartProgress, 4);
            }
        }

        // タイマー表示（右上）
        if (this.owner.hasTimeLimit && this.owner.titleState === 'playing') {
            const min = Math.floor(this.owner.remainingTime / 60);
            const sec = this.owner.remainingTime % 60;
            const timeText = `${min}:${sec.toString().padStart(2, '0')}`;
            const isLow = this.owner.remainingTime <= 10;
            const color = isLow ? '#ff4444' : '#ffffff';

            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            this._fillTextWithShadow(ctx, timeText, this.owner.canvas.width - 10, 10, color);
        }

        // スコア表示（中央上）
        if (App.projectData.stage.showScore) {
            const scoreText = this.owner.score.toString().padStart(6, '0');
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#000000';
            ctx.fillText(scoreText, this.owner.canvas.width / 2 + 1, 11);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(scoreText, this.owner.canvas.width / 2, 10);
        }
    }

    // ========== リザルト画面 ==========
    renderResultScreen() {
        const app = (typeof window !== 'undefined' && window.App) || (typeof App !== 'undefined' && App);
        const isCreatorMode = app && !app.isPlayOnlyMode;

        if (isCreatorMode) {
            const overlay = document.getElementById('result-overlay');
            if (overlay) overlay.classList.add('hidden');
            this.owner.stop();
            this.owner.hasStarted = false;
            this.owner.titleState = 'title';
            this.owner.clearTimer = 0;
            this.owner.gameOverTimer = 0;
            this.owner.gameOverPending = false;
            app.switchScreen('play');
            if (typeof GameEngine !== 'undefined') GameEngine.showPreview();
            document.querySelectorAll('#toolbar-nav .toolbar-icon').forEach(b => b.classList.remove('active-nav'));
            const navPlayBtn = document.getElementById('nav-play-btn');
            if (navPlayBtn) navPlayBtn.classList.add('active-nav');
            return;
        }

        const overlay = document.getElementById('result-overlay');
        if (!overlay) return;

        const scoreContainer = document.getElementById('result-score-container');
        const scoreVal = document.getElementById('result-score-value');
        const highVal = document.getElementById('result-highscore-value');
        const shareBtn = document.getElementById('result-share-btn');
        const title = document.getElementById('result-title');

        if (this.owner.isCleared) {
            title.textContent = 'STAGE CLEAR!';
            title.style.color = '#ffd700';
        } else {
            title.textContent = 'GAME OVER';
            title.style.color = '#ff4444';
        }

        const showScore = App.projectData.stage.showScore !== false;
        if (showScore && scoreContainer) {
            scoreContainer.classList.remove('hidden');
            if (scoreVal) scoreVal.textContent = this.owner.score.toString().padStart(6, '0');
            if (highVal) highVal.textContent = this.owner.highScore.toString().padStart(6, '0');
            if (shareBtn) shareBtn.classList.remove('hidden');
        } else {
            if (scoreContainer) scoreContainer.classList.add('hidden');
            if (shareBtn) shareBtn.classList.add('hidden');
        }

        const likeArea = document.getElementById('result-like-area');
        const gameId = App._sharedGameId || App.projectData?.meta?.shareId;

        if (likeArea) {
            if (gameId) {
                likeArea.classList.remove('hidden');
                const likeBtn = document.getElementById('result-like-btn');
                if (likeBtn) {
                    likeBtn.classList.toggle('liked', !!App._hasLikedThisSession);
                    likeBtn.disabled = !!App._hasLikedThisSession;
                }
                const countEl = document.getElementById('result-like-count');
                if (countEl) countEl.textContent = App._likesCount || 0;
            } else {
                likeArea.classList.add('hidden');
            }
        }

        const remixBtn = document.getElementById('result-remix-btn');
        if (remixBtn) {
            remixBtn.classList.toggle('hidden', !(App.isPlayOnlyMode && App.projectData?.meta?.remixOK));
        }

        const editBtn = document.getElementById('result-edit-btn');
        if (editBtn) editBtn.classList.toggle('hidden', App.isPlayOnlyMode);

        this._updateResultGameInfo(app);
        overlay.classList.remove('hidden');
    }

    _updateResultGameInfo(app) {
        const pd = app?.projectData;
        const titleEl = document.getElementById('result-game-title');
        const authorEl = document.getElementById('result-game-author');
        const remixEl = document.getElementById('result-remix-info');
        const origTitleEl = document.getElementById('result-original-title');
        const origAuthorEl = document.getElementById('result-original-author');
        const origLinkWrap = document.getElementById('result-remix-link-wrap');

        if (titleEl) titleEl.textContent = pd?.meta?.name || '';
        if (authorEl) authorEl.textContent = pd?.meta?.author || '';

        // Remixデータがある場合のみ行全体を表示
        const hasRemix = !!(pd?.meta?.originalAuthor);
        if (remixEl) {
            if (hasRemix) {
                if (origTitleEl) origTitleEl.textContent = pd.meta.originalTitle || 'Unknown';
                if (origAuthorEl) origAuthorEl.textContent = pd.meta.originalAuthor;
                remixEl.classList.remove('hidden');
                const origShareId = pd.meta.originalShareId;
                if (origLinkWrap) {
                    origLinkWrap.onclick = origShareId
                        ? () => window.open(Share.createShortUrl(origShareId), '_blank')
                        : null;
                }
            } else {
                remixEl.classList.add('hidden');
                if (origLinkWrap) origLinkWrap.onclick = null;
            }
        }
    }
}
