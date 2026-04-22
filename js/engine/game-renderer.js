/**
 * PixelGameKit - ゲーム描画エンジン
 * GameEngine の renderGameScreen, renderLayer, renderLayerFiltered, renderSprite を担当
 */

class GameRenderer {
    constructor(owner) {
        this.owner = owner; // GameEngine reference
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

        // 2. FGレイヤー (装飾用・当たり判定なしのブロック)
        // 当たり判定ありのブロックは後で描画
        if (stage.layers.fg) {
            this.renderLayerFiltered(stage.layers.fg, startX, startY, endX, endY, false); // collision=false のみ
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
                        this.owner.renderProjectileOrItem(obj);
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
                this.owner.renderProjectileOrItem(item);
            }
        });

        // 3.5. プロジェクタイル (武器をプレイヤー/敵の奥に描画) - 近接と回転以外
        this.owner.projectiles.forEach(proj => {
            if (proj.shotType !== 'melee' && proj.shotType !== 'orbit') {
                this.owner.renderProjectileOrItem(proj);
            }
        });

        // 4. エネミー（生存中のみ、死亡中はFGの後で描画）
        this.owner.enemies.forEach(enemy => {
            // 死亡中の敵は後で描画（FGレイヤーの手前に表示するため）
            if (enemy.isDying) return;

            // 隠れているエネミー（frozenかつ当たり判定ありブロックがある）は描画しない
            if (enemy.frozen) {
                const ex = Math.floor(enemy.x);
                const ey = Math.floor(enemy.y);
                // 当たり判定ありブロックがあるか確認
                if (this.owner.getCollision(ex, ey) === 1) {
                    return; // 隠す
                }
            }
            enemy.render(this.owner.ctx, this.owner.TILE_SIZE, this.owner.camera);
        });

        // 5. プレイヤー（クリア演出中はFGレイヤー後に描画するためスキップ、死亡落下中もスキップ）
        if (this.owner.player && !(this.owner.player.isDead && this.owner.player.isDying) && this.owner.titleState !== 'clear') {
            this.owner.player.render(this.owner.ctx, this.owner.TILE_SIZE, this.owner.camera);
        }

        // 6. FGレイヤー (当たり判定ありのブロック - プレイヤー/敵より手前)
        if (stage.layers.fg) {
            this.renderLayerFiltered(stage.layers.fg, startX, startY, endX, endY, true); // collision=true のみ
        }

        // 6.5. クリア演出中のプレイヤー（喜びジャンプを前景に表示）
        if (this.owner.titleState === 'clear' && this.owner.player && !this.owner.player.isDead) {
            this.owner.player.render(this.owner.ctx, this.owner.TILE_SIZE, this.owner.camera);
        }

        // 7. 特殊プロジェクタイル (近接と回転は一番手前、FGブロックよりも前面)
        this.owner.projectiles.forEach(proj => {
            if (proj.shotType === 'melee' || proj.shotType === 'orbit') {
                this.owner.renderProjectileOrItem(proj);
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
        this.owner.renderParticles();

        // 10.5. とびら白点滅エフェクト
        this.owner.renderDoorFlash();

        // 11. UI
        this.owner.renderUI();

        // 12. イースターエッグメッセージウィンドウ
        if (this.owner.easterMessageActive) {
            this.owner.renderEasterWindow();
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
                        const spriteSlots = template?.sprites || {};
                        const slotNames = ['idle', 'main', 'walk', 'jump', 'attack', 'shot', 'life'];
                        let frames = [];
                        let speed = 5;
                        for (const slotName of slotNames) {
                            if (spriteSlots[slotName]?.frames?.length > 0) {
                                frames = spriteSlots[slotName].frames;
                                if (spriteSlots[slotName]?.speed !== undefined) {
                                    speed = spriteSlots[slotName].speed;
                                }
                                break;
                            }
                        }
                        if (frames.length > 1) {
                            // 複数フレームがある場合はアニメーション
                            const interval = speed > 0 ? Math.floor(60 / speed) : Infinity;
                            if (interval !== Infinity) {
                                const frameIndex = Math.floor(this.owner.tileAnimationFrame / interval) % frames.length;
                                spriteIdx = frames[frameIndex];
                            } else {
                                spriteIdx = frames[0];
                            }
                        } else if (frames.length === 1) {
                            spriteIdx = frames[0];
                        }
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
    renderLayerFiltered(layer, startX, startY, endX, endY, collisionOnly) {
        if (!layer) return;
        const templates = App.projectData.templates || [];
        const stage = App.projectData.stage;
        const sprites = App.projectData.sprites;

        // ギミックブロック位置をセットに登録
        const gimmickPositions = new Set();
        if (this.owner.gimmickBlocks) {
            this.owner.gimmickBlocks.forEach(block => {
                gimmickPositions.add(`${block.tileX},${block.tileY}`);
            });
        }

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
                        const spriteSlots = template?.sprites || {};
                        const slotNames = ['idle', 'main', 'walk', 'jump', 'attack', 'shot', 'life'];
                        let frames = [];
                        let speed = 5;
                        for (const slotName of slotNames) {
                            if (spriteSlots[slotName]?.frames?.length > 0) {
                                frames = spriteSlots[slotName].frames;
                                if (spriteSlots[slotName]?.speed !== undefined) {
                                    speed = spriteSlots[slotName].speed;
                                }
                                break;
                            }
                        }
                        if (frames.length > 1) {
                            const interval = speed > 0 ? Math.floor(60 / speed) : Infinity;
                            if (interval !== Infinity) {
                                const frameIndex = Math.floor(this.owner.tileAnimationFrame / interval) % frames.length;
                                spriteIdx = frames[frameIndex];
                            } else {
                                spriteIdx = frames[0];
                            }
                        } else if (frames.length === 1) {
                            spriteIdx = frames[0];
                        }
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

    // ========== スプライト描画 ==========
    renderSprite(sprite, x, y, palette) {
        if (!sprite) return;
        const pixelSize = this.owner.TILE_SIZE / 16;

        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {
                const colorIndex = sprite.data[py][px];
                if (colorIndex >= 0) {
                    this.owner.ctx.fillStyle = palette[colorIndex];
                    this.owner.ctx.fillRect(
                        x + px * pixelSize,
                        y + py * pixelSize,
                        pixelSize + 0.5,
                        pixelSize + 0.5
                    );
                }
            }
        }
    }
}
