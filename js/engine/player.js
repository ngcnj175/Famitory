/**
 * PixelGameKit - プレイヤー（完全版）
 */

class Player {
    constructor(tileX, tileY, template = null, templateIdx = undefined) {
        this.startX = tileX;
        this.startY = tileY;
        this.x = tileX;
        this.y = tileY;
        this.vx = 0;
        this.vy = 0;

        // 当たり判定サイズ（スプライト描画サイズと一致させる）
        // 32x32スプライトは2.0x2.0、16x16は1.0x1.0
        const idleSpriteIdx = template?.sprites?.idle?.frames?.[0];
        const sprite = App.projectData?.sprites?.[idleSpriteIdx];
        const spriteSize = sprite?.size || 1;
        this.width = spriteSize === 2 ? 2.0 : 1.0;
        this.height = spriteSize === 2 ? 2.0 : 1.0;

        this.onGround = false;
        this.onLadder = false;
        this.facingRight = true;

        // テンプレート情報
        this.template = template;
        this.templateIdx = templateIdx; // アニメーション用
        this.animFrame = 0;
        this.animTimer = 0;

        // 物理パラメータ（config値を反映: 1-20のスケールを実際の値に変換）
        const speedConfig = template?.config?.speed ?? 5;
        const jumpConfig = template?.config?.jumpPower ?? 10;
        this.moveSpeed = 0.05 + (speedConfig / 10) * 0.1; // 1=0.06, 5=0.1, 10=0.15
        this.jumpPower = -0.2 - (jumpConfig / 20) * 0.3;  // 1=-0.215, 10=-0.35, 20=-0.5
        this.gravity = 0.02;
        this.maxFallSpeed = 0.4;

        // ダメージシステム
        const templateLives = template?.config?.life || 3;
        this.lives = templateLives;
        this.maxLives = templateLives;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.invincibleDuration = 120;
        this.isKnockback = false; // ノックバック中フラグ
        this.isDead = false;
        this.deathParticles = [];

        // 状態
        this.state = 'idle';
        this.isAttacking = false;
        this.attackTimer = 0;

        // スター無敵
        this.starPower = false;
        this.starTimer = 0;
        this.starDuration = 300; // 5秒

        // SHOT設定
        this.shotMaxRange = (template?.config?.shotMaxRange || 0) * 2;
        this.attackCooldown = 0;

        // W JUMP（2段ジャンプ）
        this.wJumpEnabled = template?.config?.wJump || false;
        this.canDoubleJump = false;
        this.hasDoubleJumped = false;

        // 武器使用可能フラグ（weaponFromStart設定に基づく）
        this.hasWeapon = template?.config?.weaponFromStart ?? true;

        // カギ所持フラグ
        this.hasKey = false;

        // SE設定（-1はOFF）
        this.seJump = template?.config?.seJump ?? 0;
        this.seAttack = template?.config?.seAttack ?? 5;
        this.seDamage = template?.config?.seDamage ?? 10;
        this.seItemGet = template?.config?.seItemGet ?? 15;
        this.seEnemyDefeat = template?.config?.seEnemyDefeat ?? 24;

        // 喜びジャンプ（クリア演出用）
        this.joyJumpActive = false;
        this.joyJumpStartY = 0;
    }

    // SE再生ヘルパー（設定がOFFの場合は鳴らさない）
    playSE(seKey) {
        if (typeof NesAudio === 'undefined') return;

        // enemyDefeatは常にv2.0.1オリジナルの「ポン」音を再生
        if (seKey === 'enemyDefeat') {
            NesAudio.playSE('enemyDefeat');
            return;
        }

        const sounds = App.projectData?.sounds || [];
        let seIndex = -1;

        switch (seKey) {
            case 'jump': seIndex = this.seJump; break;
            case 'attack': seIndex = this.seAttack; break;
            case 'damage': seIndex = this.seDamage; break;
            case 'itemGet': seIndex = this.seItemGet; break;
        }

        if (seIndex >= 0 && seIndex < sounds.length) {
            const se = sounds[seIndex];
            NesAudio.playSE(se.type);
        }
    }

    update(engine) {
        if (this.isDead) {
            // 敵と同じ落下演出
            if (this.isDying) {
                this.deathTimer++;
                this.vy += 0.02; // 敵と同じ重力
                this.y += this.vy;
                this.x += this.vx; // 横方向の動きも
            }
            return;
        }

        // 無敵時間更新
        if (this.invincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
                // 無敵終了時にvxをリセット（ノックバック停止）
                if (!this.starPower) {
                    this.vx = 0;
                }
            }
        }

        // スター無敵更新
        if (this.starPower) {
            this.starTimer--;
            if (this.starTimer <= 0) {
                this.starPower = false;
                // ステージBGMに戻す
                if (typeof GameEngine !== 'undefined') {
                    GameEngine.playBgm('stage');
                }
            }
        }

        // 攻撃クールダウン
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }

        // 攻撃中タイマー
        if (this.isAttacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
            }
        }

        // はしご判定
        this.onLadder = engine.isOnLadder(this.x, this.y, this.width, this.height);

        this.handleInput(engine);

        // 重力（はしご上では無効）
        if (!this.onLadder) {
            this.vy += this.gravity;
            if (this.vy > this.maxFallSpeed) {
                this.vy = this.maxFallSpeed;
            }
        }

        // 移動と衝突
        this.x += this.vx;
        this.handleHorizontalCollision(engine);
        this.y += this.vy;
        this.handleVerticalCollision(engine);

        // ギミックブロックに乗っている場合、ブロックと一緒に移動
        if (this.ridingGimmickBlock) {
            this.x += this.ridingGimmickBlock.vx;
            this.y = this.ridingGimmickBlock.y - this.height;
        }

        // 画面外落下で即死（パーティクルなし）
        const stageHeight = App.projectData.stage?.height || 16;
        if (this.y > stageHeight + 1) {
            this.isDead = true;
            this.deathParticles = []; // パーティクルなし
            return;
        }

        // 状態決定
        this.updateState();

        // アニメーション
        this.updateAnimation();
    }

    updateState() {
        if (this.isAttacking) {
            this.state = 'attack';
        } else if (this.onLadder && (this.vx !== 0 || this.vy !== 0)) {
            this.state = 'climb';
        } else if (this.onLadder) {
            this.state = 'climb';
        } else if (!this.onGround) {
            this.state = 'jump';
        } else if (this.vx !== 0) {
            this.state = 'walk';
        } else {
            this.state = 'idle';
        }
    }

    updateAnimation() {
        this.animTimer++;
        const spriteSlot = this.getSpriteSlot();
        const speed = this.template?.sprites?.[spriteSlot]?.speed || 5;
        // スプライトエディターと同等のタイミング（speed = 秒間フレーム数）
        const interval = Math.floor(60 / speed);
        if (this.animTimer >= interval) {
            this.animTimer = 0;
            const frames = this.template?.sprites?.[spriteSlot]?.frames || [];
            if (frames.length > 0) {
                this.animFrame = (this.animFrame + 1) % frames.length;
            }
        }
    }

    getSpriteSlot() {
        switch (this.state) {
            case 'attack':
                return this.template?.sprites?.attack?.frames?.length > 0 ? 'attack' : 'idle';
            case 'climb':
                return this.template?.sprites?.climb?.frames?.length > 0 ? 'climb' : 'idle';
            case 'jump':
                return this.template?.sprites?.jump?.frames?.length > 0 ? 'jump' : 'idle';
            case 'walk':
                return this.template?.sprites?.walk?.frames?.length > 0 ? 'walk' : 'idle';
            default:
                return 'idle';
        }
    }

    handleInput(engine) {
        // ノックバック中のみ操作をスキップ（着地後は即操作可能）
        if (this.isKnockback) {
            return;
        }

        this.vx = 0;

        if (GameController.isPressed('left')) {
            this.vx = -this.moveSpeed;
            this.facingRight = false;
        }
        if (GameController.isPressed('right')) {
            this.vx = this.moveSpeed;
            this.facingRight = true;
        }

        // はしご上では上下移動（十字キー）、ジャンプ無効（最上部のみジャンプ可）
        if (this.onLadder) {
            if (GameController.isPressed('up')) {
                this.vy = -this.moveSpeed;
            } else if (GameController.isPressed('down')) {
                this.vy = this.moveSpeed;
            } else {
                this.vy = 0; // 上下キー離すと停止
            }

            // はしご最上部でのジャンプ許可
            const atLadderTop = engine.isAtLadderTop(this.x, this.y, this.width, this.height);
            if (atLadderTop && GameController.isPressed('a') && !this._jumpKeyWasPressed) {
                this.vy = this.jumpPower;
                this.onGround = false;
                this.onLadder = false;
                this.hasDoubleJumped = false;
                this.canDoubleJump = this.wJumpEnabled;
                this.playSE('jump');
                this._jumpKeyWasPressed = GameController.isPressed('a');
                return;
            }

            this._jumpKeyWasPressed = GameController.isPressed('a');

            // はしご上でのBキー攻撃（最上部に限らず全体で許可するか、今回は「一番上」の仕様に沿って判定）
            if (atLadderTop && GameController.isPressed('b') && this.shotMaxRange > 0 && this.attackCooldown <= 0) {
                this.attack(engine);
            }

            return; // はしご上での基本処理終了
        }

        // ジャンプ処理
        if (GameController.isPressed('a')) {
            if (this.onGround) {
                // 通常ジャンプ（キーを新たに押した時のみSE再生＝頭上ブロックで連打防止）
                this.vy = this.jumpPower;
                this.onGround = false;
                this.hasDoubleJumped = false;
                this.canDoubleJump = this.wJumpEnabled;
                if (!this._jumpKeyWasPressed) this.playSE('jump');
            } else if (this.wJumpEnabled && this.canDoubleJump && !this.hasDoubleJumped && !this._jumpKeyWasPressed) {
                // 2段ジャンプ
                this.vy = this.jumpPower;
                this.hasDoubleJumped = true;
                this.canDoubleJump = false;
                // SE再生
                this.playSE('jump');
            }
        }
        this._jumpKeyWasPressed = GameController.isPressed('a');

        // Bキー攻撃
        if (GameController.isPressed('b') && this.shotMaxRange > 0 && this.attackCooldown <= 0) {
            this.attack(engine);
        }
    }

    attack(engine) {
        // 武器を持っていない場合は攻撃不可
        if (!this.hasWeapon) return;

        // ダメージによる無敵中（starPower以外）は攻撃不可
        if (this.invincible && !this.starPower) return;

        this.isAttacking = true;
        this.attackTimer = 15;
        // 連射設定: shotRate 1（50フレーム）～5（10フレーム）
        const shotRateConfig = this.template?.config?.shotRate ?? 3;
        this.attackCooldown = Math.round(50 - (shotRateConfig - 1) * 10); // 1=50, 3=30, 5=10
        this.animFrame = 0;

        // SE再生
        this.playSE('attack');

        // SHOTプロジェクタイル発射
        const shotSprite = this.template?.sprites?.shot?.frames?.[0];
        if (shotSprite !== undefined) {
            const shotType = this.template?.config?.shotType || 'straight';
            const direction = this.facingRight ? 1 : -1;
            // 速度設定: shotSpeed 1（0.1）～5（0.35）
            const shotSpeedConfig = this.template?.config?.shotSpeed ?? 3;
            const baseSpeed = 0.1 + (shotSpeedConfig - 1) * 0.0625; // 1=0.1, 3=0.225, 5=0.35
            // プロジェクタイルの論理サイズは 0.5x0.5、描画されるスプライトサイズは 1.0x1.0（通常）であるため、
            // 描画時にスプライトの中心がキャラクターの中心と一致するように補正する。
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;

            // 描画の中心に合わせるため、1x1サイズのスプライトの左上座標を(cx - 0.5, cy - 0.5)とする
            let startX = cx - 0.5;
            let startY = cy - 0.5;

            // 武器タイプによって発射位置をずらす
            if (['straight', 'arc', 'boomerang', 'pinball'].includes(shotType)) {
                startX += (this.facingRight ? 1 : -1);
            } else if (shotType === 'drop') {
                startY += 1;
            }

            // ProjectileManager で統一管理
            ProjectileManager.createAndAddProjectiles(engine, {
                shotType: shotType,
                owner: 'player',
                ownerEntity: this,
                startX: startX,
                startY: startY,
                facingRight: this.facingRight,
                baseSpeed: baseSpeed,
                shotMaxRange: this.shotMaxRange,
                templateIdx: this.templateIdx,
                shotSprite: shotSprite
            });
        }
    }

    takeDamage(fromRight) {
        if (this.invincible || this.isDead || this.starPower) return;

        this.lives--;

        // SE再生
        this.playSE('damage');

        if (this.lives <= 0) {
            this.die();
        } else {
            this.invincible = true;
            this.invincibleTimer = this.invincibleDuration;
            this.isKnockback = true; // ノックバック開始
            this.vy = -0.25; // 強く
            // 向いている方向の逆に飛ばされる
            this.vx = this.facingRight ? -0.12 : 0.12; // 強く
            this.onGround = false;
        }
    }

    collectItem(itemType) {
        switch (itemType) {
            case 'muteki': // 'star' is legacy
            case 'star':
                this.starPower = true;
                this.starTimer = this.starDuration;
                this.invincible = true;
                this.invincibleTimer = this.starDuration;
                // 無敵BGM再生
                if (typeof GameEngine !== 'undefined') {
                    GameEngine.playBgm('invincible');
                }
                // SE再生
                this.playSE('itemGet');
                break;
            case 'coin':
                // コイン取得（スコアはgame-engine.js側で加算）
                this.playSE('itemGet');
                break;
            case 'lifeup':
                if (this.lives < this.maxLives) {
                    this.lives++;
                }
                // SE再生
                this.playSE('itemGet');
                break;
            case 'clear':
                // クリアアイテム取得（カウントはgame-engine.js側で行う）
                this.playSE('itemGet');
                break;
            case 'weapon':
                // 武器アイテム取得 → 武器使用可能に
                this.hasWeapon = true;
                this.playSE('itemGet');
                break;
            case 'bomb':
                // ボム: 画面上の全敵に1ダメージ＋爆発音はgame-engineで処理
                break;
            case 'key':
                // カギ取得
                this.hasKey = true;
                this.playSE('itemGet');
                break;
        }
    }

    // 変身: 指定テンプレートに切り替え
    transform(newTemplateIdx) {
        const templates = App.projectData?.templates || [];
        const newTemplate = templates[newTemplateIdx];
        if (!newTemplate || newTemplate.type !== 'player') return;

        this.template = newTemplate;
        this.templateIdx = newTemplateIdx;

        // サイズ再計算
        const idleSpriteIdx = newTemplate.sprites?.idle?.frames?.[0];
        const sprite = App.projectData?.sprites?.[idleSpriteIdx];
        const spriteSize = sprite?.size || 1;
        this.width = spriteSize === 2 ? 2.0 : 1.0;
        this.height = spriteSize === 2 ? 2.0 : 1.0;

        // 物理パラメータ
        const speedConfig = newTemplate.config?.speed ?? 5;
        const jumpConfig = newTemplate.config?.jumpPower ?? 10;
        this.moveSpeed = 0.05 + (speedConfig / 10) * 0.1;
        this.jumpPower = -0.2 - (jumpConfig / 20) * 0.3;

        // ライフ（現在値を維持、最大値は新テンプレートに合わせる）
        const newMaxLives = newTemplate.config?.life ?? 3;
        this.maxLives = newMaxLives;
        this.lives = Math.min(this.lives, newMaxLives);

        // 武器（持っていれば維持、新フォームが武器持ちなら付与）
        this.hasWeapon = this.hasWeapon || (newTemplate.config?.weaponFromStart ?? true);

        // その他
        this.shotMaxRange = (newTemplate.config?.shotMaxRange || 0) * 2;
        this.wJumpEnabled = newTemplate.config?.wJump || false;

        // SE
        this.seJump = newTemplate.config?.seJump ?? 0;
        this.seAttack = newTemplate.config?.seAttack ?? 5;
        this.seDamage = newTemplate.config?.seDamage ?? 10;
        this.seItemGet = newTemplate.config?.seItemGet ?? 15;
        this.seEnemyDefeat = newTemplate.config?.seEnemyDefeat ?? 24;

        // アニメーションリセット
        this.animFrame = 0;
        this.animTimer = 0;
        this.state = 'idle';

        this.playSE('itemGet');
    }

    die() {
        this.isDead = true;
        this.isDying = true;
        this.deathTimer = 0;
        // 敵と同じ落下死亡演出
        this.vy = -0.3; // 敵と同じ
        this.vx = this.facingRight ? -0.1 : 0.1; // 向きの逆方向
        this.deathParticles = []; // パーティクルは使わない

        // ゲームオーバー待機開始（gameLoopで処理される）
        if (typeof GameEngine !== 'undefined' && !GameEngine.gameOverPending) {
            GameEngine.gameOverPending = true;
            GameEngine.gameOverWaitTimer = 60; // 約1秒待機
        }
    }

    handleHorizontalCollision(engine) {
        PhysicsHandler.handleHorizontalCollision(this, engine, false);
    }

    handleVerticalCollision(engine) {
        PhysicsHandler.handleVerticalCollision(this, engine, {
            onDamageTile: (tx, ty) => {
                if (typeof engine.damageTile === 'function') {
                    engine.damageTile(tx, ty);
                }
            },
            onJumpReset: () => {
                this.hasDoubleJumped = false;
                this.canDoubleJump = this.wJumpEnabled;
                this.playSE('jump');
            },
            onKnockbackEnd: () => {
                if (this.isKnockback) {
                    this.isKnockback = false;
                    this.vx = 0;
                }
            }
        });
    }

    collidesWith(other) {
        return this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y;
    }

    render(ctx, tileSize, camera) {
        // 死亡中も落下するスプライトを表示
        if (this.isDead && this.isDying) {
            // 落下演出中はスプライトを表示
            // 当たり判定の中心座標（下端基準）
            const hitboxCenterX = this.x + this.width / 2;
            const hitboxBottom = this.y + this.height;
            const frames = this.template?.sprites?.idle?.frames || [];
            const spriteIdx = frames[0];
            const sprite = App.projectData.sprites[spriteIdx];
            if (sprite) {
                const palette = App.nesPalette;
                // スプライトサイズを判定
                const spriteSize = sprite.size || 1;
                const dimension = spriteSize === 2 ? 32 : 16;
                const tileCount = spriteSize === 2 ? 2 : 1;
                const renderSize = tileSize * tileCount;
                const pixelSize = renderSize / dimension;
                const flipX = !this.facingRight;

                // スプライトを当たり判定に対して下端寄せ＆横軸中央寄せで描画
                const spriteDrawX = (hitboxCenterX - tileCount / 2 - camera.x) * tileSize;
                const spriteDrawY = (hitboxBottom - tileCount - camera.y) * tileSize;

                for (let y = 0; y < dimension; y++) {
                    for (let x = 0; x < dimension; x++) {
                        const colorIndex = sprite.data[y]?.[x];
                        if (colorIndex >= 0) {
                            ctx.fillStyle = palette[colorIndex];
                            const drawX = flipX ? spriteDrawX + (dimension - 1 - x) * pixelSize : spriteDrawX + x * pixelSize;
                            ctx.fillRect(drawX, spriteDrawY + y * pixelSize, pixelSize + 0.5, pixelSize + 0.5);
                        }
                    }
                }
            }
            return;
        } else if (this.isDead) {
            this.renderDeathParticles(ctx, tileSize, camera);
            return;
        }

        if (!this.template) return;

        // 無敵中は点滅
        if (this.invincible && !this.starPower && Math.floor(this.invincibleTimer / 4) % 2 === 0) {
            return;
        }

        // 当たり判定の中心座標（下端基準）
        const hitboxCenterX = this.x + this.width / 2;
        const hitboxBottom = this.y + this.height;

        const spriteSlot = this.getSpriteSlot();
        const frames = this.template?.sprites?.[spriteSlot]?.frames || this.template?.sprites?.idle?.frames || [];
        const spriteIdx = frames[this.animFrame] ?? frames[0];
        const sprite = App.projectData.sprites[spriteIdx];

        if (sprite) {
            ctx.save();
            const palette = App.nesPalette;
            // スプライトサイズを判定
            const spriteSize = sprite.size || 1;
            const dimension = spriteSize === 2 ? 32 : 16;
            const tileCount = spriteSize === 2 ? 2 : 1;
            const renderSize = tileSize * tileCount;
            const pixelSize = renderSize / dimension;

            // スプライトを当たり判定に対して下端寄せ＆横軸中央寄せで描画
            const spriteDrawX = (hitboxCenterX - tileCount / 2 - camera.x) * tileSize;
            const spriteDrawY = (hitboxBottom - tileCount - camera.y) * tileSize;

            // 左向きの場合は反転描画
            const flipX = !this.facingRight;

            // スターパワー中: 4色サイクル＋1フレームだけ通常スプライトを挿入
            const starColors = ['#FF6B6B', '#FFFF6B', '#6BFF6B', '#6BFFFF'];
            const starPhase = this.starPower ? Math.floor(this.starTimer) % 5 : -1;

            for (let y = 0; y < dimension; y++) {
                for (let x = 0; x < dimension; x++) {
                    const colorIndex = sprite.data[y]?.[x];
                    if (colorIndex >= 0) {
                        // starPhase 4 のときだけ元スプライト色、それ以外は単色サイクル
                        const color = (starPhase >= 0 && starPhase < 4)
                            ? starColors[starPhase]
                            : palette[colorIndex];
                        ctx.fillStyle = color;
                        const drawX = flipX ? spriteDrawX + (dimension - 1 - x) * pixelSize : spriteDrawX + x * pixelSize;
                        ctx.fillRect(drawX, spriteDrawY + y * pixelSize, pixelSize + 0.5, pixelSize + 0.5);
                    }
                }
            }

            ctx.restore();
        }
    }

    renderDeathParticles(ctx, tileSize, camera) {
        const pixelSize = tileSize / 16;
        this.deathParticles.forEach(p => {
            const screenX = (p.x - camera.x) * tileSize;
            const screenY = (p.y - camera.y) * tileSize;
            const size = (p.size || 1) * pixelSize;
            ctx.fillStyle = p.color;
            ctx.fillRect(screenX, screenY, size, size);
        });
    }

    // 喜びジャンプ開始（クリア演出用）
    startJoyJump() {
        this.joyJumpActive = true;
        this.joyJumpStartY = this.y;
        this.vy = this.jumpPower * 0.6; // 低めのジャンプ
        this.facingRight = true; // 正面向き（右向き）
        this.vx = 0; // 移動停止
        this.state = 'jump';
    }

    // 喜びジャンプ更新（重力のみ、衝突なし）
    updateJoyJump() {
        if (!this.joyJumpActive) return;

        // 重力
        this.vy += this.gravity;
        if (this.vy > this.maxFallSpeed) {
            this.vy = this.maxFallSpeed;
        }

        this.y += this.vy;

        // 開始位置まで落ちたら再ジャンプ（ループ）
        if (this.y >= this.joyJumpStartY && this.vy > 0) {
            this.y = this.joyJumpStartY;
            this.vy = this.jumpPower * 0.6;
        }

        // アニメーション
        this.animTimer++;
        const interval = 6;
        if (this.animTimer >= interval) {
            this.animTimer = 0;
            const frames = this.template?.sprites?.jump?.frames || this.template?.sprites?.idle?.frames || [];
            if (frames.length > 0) {
                this.animFrame = (this.animFrame + 1) % frames.length;
            }
        }
    }
}
