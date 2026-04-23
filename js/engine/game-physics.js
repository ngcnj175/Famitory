/**
 * PixelGameKit - ゲーム物理演算・衝突判定エンジン
 * GameEngine の衝突クエリ・タイルダメージ・エンティティ衝突処理を担当
 */

class GamePhysics {
    constructor(owner) {
        this.owner = owner; // GameEngine reference
    }

    // ========== タイル衝突クエリ ==========

    getCollision(x, y) {
        const stage = this.owner.stageData || App.projectData.stage;
        const templates = App.projectData.templates || [];
        const tileX = Math.floor(x);
        const tileY = Math.floor(y);

        if (this.owner.destroyedTiles && this.owner.destroyedTiles.has(`${tileX},${tileY}`)) {
            return 0;
        }

        if (tileX < 0 || tileX >= stage.width) return 1; // 左右は壁
        if (tileY < 0) return 1;                          // 上は壁
        if (tileY >= stage.height) return 0;              // 下は落下可能

        const tileId = stage.layers.fg?.[tileY]?.[tileX];
        if (tileId === undefined || tileId < 0) return 0;

        let template;
        if (tileId >= 100) {
            template = templates[tileId - 100];
        } else {
            template = templates.find(t => {
                const idx = t?.sprites?.idle?.frames?.[0] ?? t?.sprites?.main?.frames?.[0];
                return idx === tileId;
            });
        }

        if (!template) return 0;
        if (template.type === 'material' && template.config?.gimmick === 'ladder') return 0;
        if (template.type === 'material' && template.config?.gimmick === 'door') return 1;
        if (template.type === 'material' && template.config?.collision !== false) return 1;
        return 0;
    }

    // はしごタイル上にいるか判定
    isOnLadder(x, y, width, height) {
        if (!this.owner.ladderTiles || this.owner.ladderTiles.size === 0) return false;
        const centerX = Math.floor(x + width / 2);
        const topY    = Math.floor(y);
        const bottomY = Math.floor(y + height - 0.01);
        return this.owner.ladderTiles.has(`${centerX},${topY}`) ||
               this.owner.ladderTiles.has(`${centerX},${bottomY}`);
    }

    // はしごの最上部にいるか判定
    isAtLadderTop(x, y, width, height) {
        if (!this.owner.ladderTiles || this.owner.ladderTiles.size === 0) return false;
        const centerX = Math.floor(x + width / 2);
        const topY    = Math.floor(y);
        const bottomY = Math.floor(y + height - 0.01);
        return !this.owner.ladderTiles.has(`${centerX},${topY}`) &&
                this.owner.ladderTiles.has(`${centerX},${bottomY}`);
    }

    // ========== プロジェクタイル衝突クエリ ==========

    projectileHits(proj, target) {
        return proj.x < target.x + target.width  &&
               proj.x + proj.width  > target.x   &&
               proj.y < target.y + target.height &&
               proj.y + proj.height > target.y;
    }

    // ========== エリアダメージ ==========

    // 画面上の全敵にダメージ（ボム用）
    damageAllEnemiesOnScreen(damage) {
        const viewWidth  = this.owner.canvas.width  / this.owner.TILE_SIZE;
        const viewHeight = this.owner.canvas.height / this.owner.TILE_SIZE;
        const left   = this.owner.camera.x;
        const right  = this.owner.camera.x + viewWidth;
        const top    = this.owner.camera.y;
        const bottom = this.owner.camera.y + viewHeight;

        this.owner.enemies.forEach(enemy => {
            if (enemy.isDying || enemy.frozen) return;
            const inView = enemy.x >= left && enemy.x < right &&
                           enemy.y >= top  && enemy.y < bottom;
            if (inView) {
                for (let i = 0; i < damage; i++) {
                    const fromRight = this.owner.player && this.owner.player.x > enemy.x;
                    enemy.takeDamage(fromRight);
                }
            }
        });
    }

    // ========== プレイヤー×エネミー衝突 ==========

    checkCollisions() {
        if (!this.owner.player || this.owner.player.isDead) return;

        this.owner.enemies.forEach(enemy => {
            if (enemy.isDying || enemy.frozen) return;

            if (this.owner.player.collidesWith(enemy)) {
                if (this.owner.player.starPower) {
                    const fromRight = this.owner.player.x > enemy.x;
                    enemy.takeDamage(fromRight);
                    enemy.lives = 0;
                    enemy.die(fromRight);
                    enemy.die(fromRight);
                    this.owner.player.playSE('enemyDefeat');
                    this.owner.addScore(100);
                    return;
                }

                if (this.owner.player.invincible && !this.owner.player.starPower) return;

                // 上から踏みつけ判定
                if (this.owner.player.vy > 0 &&
                    this.owner.player.y + this.owner.player.height < enemy.y + enemy.height * 0.5) {
                    const fromRight = this.owner.player.x > enemy.x;
                    enemy.takeDamage(fromRight);
                    this.owner.player.vy = -0.25;
                    this.owner.player.playSE('enemyDefeat');
                    if (enemy.lives <= 0) this.owner.addScore(100);
                } else if (!this.owner.player.invincible) {
                    const fromRight = enemy.x > this.owner.player.x;
                    this.owner.player.takeDamage(fromRight);
                }
            }
        });

        // 消滅した敵を削除
        this.owner.enemies = this.owner.enemies.filter(e => {
            if (e.template?.config?.isBoss && e.y > App.projectData.stage.height + 5) {
                if (this.owner.bossEnemy === e) {
                    const remainingBosses = this.owner.enemies.filter(other =>
                        other !== e && other.template?.config?.isBoss &&
                        !other.isDying && other.y <= App.projectData.stage.height + 5
                    );
                    if (remainingBosses.length > 0) {
                        console.log('Intermediate boss fell off stage.');
                        this.owner.bossEnemy  = null;
                        this.owner.bossSpawned = false;
                        this.owner.playBgm('stage');
                    } else {
                        const clearCondition = App.projectData.stage.clearCondition || 'none';
                        if (clearCondition === 'boss' && !this.owner.bossDefeatPhase && !this.owner.isCleared) {
                            console.log('Final boss fell off stage. Triggering clear.');
                            this.owner.bossEnemy = null;
                            this.owner.triggerClear();
                        } else {
                            console.log('Final boss fell off stage. (clear condition not boss)');
                            this.owner.bossEnemy = null;
                        }
                    }
                }
                this.spawnDropItem(e);
                return false;
            }
            if (e.isDying && e.deathTimer > 120) {
                this.spawnDropItem(e);
                return false;
            }
            if (e.y > App.projectData.stage.height + 5) {
                if (e.isDying) this.spawnDropItem(e);
                return false;
            }
            return true;
        });
    }

    // ========== ドロップアイテム生成 ==========

    // 敵がドロップするアイテムを出現させる
    spawnDropItem(enemy) {
        const dropItem = enemy.template?.config?.dropItem;
        console.log('spawnDropItem called for enemy:', enemy.template?.name, 'dropItem:', dropItem);
        if (!dropItem || dropItem === 'none') {
            console.log('No drop item configured');
            return;
        }

        const templates = App.projectData.templates || [];
        console.log('Searching for item template with itemType:', dropItem);

        const searchTypes = [dropItem];
        if (dropItem === 'muteki') searchTypes.push('star');
        if (dropItem === 'star')   searchTypes.push('muteki');

        let itemTemplate = templates.find(t =>
            t.type === 'item' && searchTypes.includes(t.config?.itemType)
        );
        if (!itemTemplate) {
            itemTemplate = templates.find(t =>
                t.type === 'item' && t.name?.toLowerCase().includes(dropItem.toLowerCase())
            );
        }
        if (!itemTemplate) {
            itemTemplate = templates.find(t => t.type === 'item');
        }

        let templateIdx = -1;
        let spriteIdx   = 0;

        if (itemTemplate) {
            templateIdx = templates.indexOf(itemTemplate);
            spriteIdx   = itemTemplate.sprites?.idle?.frames?.[0] ??
                          itemTemplate.sprites?.main?.frames?.[0] ?? 0;
        } else {
            console.log('No item template found, using fallback sprite for:', dropItem);
        }

        const spawnX = enemy.deathX !== undefined ? enemy.deathX : enemy.x;
        const spawnY = enemy.deathY !== undefined ? enemy.deathY : enemy.y;

        this.owner.items.push({
            x: spawnX, y: spawnY,
            width: 1, height: 1,
            template: itemTemplate,
            templateIdx,
            spriteIdx,
            itemType: dropItem,
            collected: false,
            isDropped: true,
            vy: -0.15
        });
        console.log('Spawned drop item:', dropItem, 'at', spawnX, spawnY, 'spriteIdx:', spriteIdx);

        if (dropItem === 'clear') this.owner.totalClearItems++;
    }

    // ========== ブロック破壊 ==========

    // タイルにダメージを与える（プレイヤー頭突き等から呼ばれる）
    damageTile(tileX, tileY) {
        const stage     = App.projectData.stage;
        const templates = App.projectData.templates || [];

        if (tileX < 0 || tileX >= stage.width || tileY < 0 || tileY >= stage.height) return;

        const tileId = stage.layers.fg?.[tileY]?.[tileX];
        if (tileId === undefined || tileId < 0) return;

        let template;
        if (tileId >= 100) {
            template = templates[tileId - 100];
        } else {
            template = templates.find(t => {
                const idx = t?.sprites?.idle?.frames?.[0] ?? t?.sprites?.main?.frames?.[0];
                return idx === tileId;
            });
        }
        if (!template) return;

        const maxLife = template.config?.life;
        if (maxLife === undefined || maxLife === -1) return;

        const key = `${tileX},${tileY}`;
        let currentLife = this.owner.breakableTiles.get(key);
        if (currentLife === undefined) currentLife = maxLife;

        currentLife--;
        this.owner.breakableTiles.set(key, currentLife);

        if (currentLife <= 0) this.destroyTile(tileX, tileY, tileId);
    }

    destroyTile(tileX, tileY, tileId) {
        const key = `${tileX},${tileY}`;
        this.owner.destroyedTiles.add(key);
        this.owner.breakableTiles.delete(key);

        this.createTileParticles(tileX, tileY, tileId);

        if (this.owner.player) this.owner.player.playSE('enemyDefeat');
        this.owner.addScore(10);
        this.wakeEnemiesAt(tileX, tileY);
    }

    createTileParticles(tileX, tileY, tileId) {
        const templates = App.projectData.templates || [];
        const sprites   = App.projectData.sprites   || [];

        let spriteIdx;
        if (tileId >= 100) {
            const template = templates[tileId - 100];
            spriteIdx = template?.sprites?.idle?.frames?.[0] ?? template?.sprites?.main?.frames?.[0];
        } else {
            spriteIdx = tileId;
        }

        const sprite = sprites[spriteIdx];
        if (!sprite) return;

        const palette = App.nesPalette;

        // 4x4ピクセルごとにパーティクル化
        for (let py = 0; py < 16; py += 4) {
            for (let px = 0; px < 16; px += 4) {
                let color = null;
                for (let dy = 0; dy < 4 && !color; dy++) {
                    for (let dx = 0; dx < 4 && !color; dx++) {
                        const ci = sprite.data[py + dy]?.[px + dx];
                        if (ci !== undefined && ci >= 0) color = palette[ci];
                    }
                }
                if (color) {
                    this.owner.particles.push({
                        x:     tileX + px / 16 + 0.125,
                        y:     tileY + py / 16 + 0.125,
                        vx:    (Math.random() - 0.5) * 0.15,
                        vy:    -Math.random() * 0.2 - 0.1,
                        color,
                        size:  4,
                        life:  60 + Math.random() * 30
                    });
                }
            }
        }
    }

    // ========== ブロック周辺エンティティ ==========

    // 指定位置の休眠敵を起こす（ブロック破壊時に呼ばれる）
    wakeEnemiesAt(tileX, tileY) {
        this.owner.enemies.forEach(e => {
            if (e.frozen && Math.floor(e.x) === tileX && Math.floor(e.y) === tileY) {
                e.frozen = false;
                console.log('Enemy woke up at', tileX, tileY);
            }
        });
    }

    // ========== とびらインタラクション ==========

    checkDoorInteraction() {
        const o = this.owner;
        if (!o.player || o.player.isDead) return;
        if (!o.player.hasKey) return;
        if (!o.doorTiles || o.doorTiles.size === 0) return;
        if (o.doorAnimating) return;

        const margin = 0.15;
        const px1 = Math.floor(o.player.x - margin);
        const py1 = Math.floor(o.player.y - margin);
        const px2 = Math.floor(o.player.x + o.player.width  - 0.01 + margin);
        const py2 = Math.floor(o.player.y + o.player.height - 0.01 + margin);

        const checkTiles = new Set();
        for (let ty = py1; ty <= py2; ty++)
            for (let tx = px1; tx <= px2; tx++)
                checkTiles.add(`${tx},${ty}`);

        let doorOpened = false;
        for (const key of checkTiles) {
            if (o.doorTiles.has(key)) {
                const [dx, dy] = key.split(',').map(Number);
                const doorInfo = o.doorTiles.get(key);
                o.doorTiles.delete(key);

                o.doorFlashTiles.push({
                    x: dx, y: dy,
                    tileKey:   key,
                    phase:     'wait',
                    waitTimer: 60,
                    flashTimer: 20,
                    spriteData: doorInfo.spriteData
                });
                doorOpened = true;
            }
        }

        if (doorOpened) {
            o.player.hasKey = false;
            o.player.playSE('itemGet');
            o.doorAnimating = true;
        }
    }
}
