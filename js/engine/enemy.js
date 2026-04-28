/**
 * PixelGameKit - 敵（動きの種類拡張版）
 */

class Enemy {
    constructor(tileX, tileY, template = null, behavior = 'idle', templateIdx = undefined) {
        this.x = tileX;
        this.y = tileY;
        this.originX = tileX; // 元の位置（追いかけて戻る用）
        this.originY = tileY;
        this.vx = 0;
        this.vy = 0;

        // 当たり判定サイズ（スプライト描画サイズと一致させる）
        // 32x32スプライトは2.0x2.0、16x16は1.0x1.0
        const idleSpriteIdx = template?.sprites?.idle?.frames?.[0];
        const sprite = App.projectData?.sprites?.[idleSpriteIdx];
        const spriteSize = sprite?.size || 1;
        this.width = spriteSize === 2 ? 2.0 : 1.0;
        this.height = spriteSize === 2 ? 2.0 : 1.0;

        this.behavior = behavior;
        this.facingRight = false; // 敵はデフォルトで左向き（プレイヤーと向き合う）
        this.onGround = false;
        this.onLadder = false;

        this.template = template;
        this.templateIdx = templateIdx;
        this.animFrame = 0;
        this.animTimer = 0;

        // 物理パラメータ（config値を反映）
        const speedConfig = template?.config?.speed ?? 5;
        const jumpConfig = template?.config?.jumpPower ?? 10;
        this.moveSpeed = 0.03 + (speedConfig / 10) * 0.05; // 敵は少し遅め
        this.jumpPower = -(0.2 + (jumpConfig / 20) * 0.3); // 1=-0.215, 10=-0.35, 20=-0.5
        this.gravity = 0.02;
        this.maxFallSpeed = 0.4;

        this.lives = template?.config?.life || 1;
        this.isDying = false;
        this.deathTimer = 0;
        this.damageFlashTimer = 0; // ダメージ時の白点滅

        // 空中モード
        this.isAerial = template?.config?.isAerial || false;

        // はりつき状態
        this.clingFace = 'floor';  // 'floor' | 'ceiling' | 'wallL' | 'wallR'
        this.clingDir = -1;        // 床/天井: +1=右, -1=左 / 壁: +1=下, -1=上
        this.clingAngle = 0;       // 描画回転角（ラジアン）: 0=床, π/2=右壁, π=天井, -π/2=左壁
        this.clingLanding = true;  // 着地待ちフェーズ

        // 状態
        this.state = 'idle';
        this.isAttacking = false;
        this.attackTimer = 0;

        // 追いかけ状態
        this.isChasing = false;
        this.detectionRange = 6; // 検知距離（6タイル）
        this.chasePauseTimer = 0; // 追いかけ中の休憩タイマー
        this.chasePaused = false; // 休憩中フラグ

        // 空中上下移動用
        this.floatDirection = 1; // 1=下, -1=上
        this.diveTimer = 0;
        this.isDiving = false;
        this.isReturning = false;

        // とっしん用状態
        this.rushPhase = 'idle'; // 'idle', 'back', 'rush', 'return'
        this.rushStartX = tileX;

        // SHOT設定
        this.shotMaxRange = (template?.config?.shotMaxRange || 0) * 2;
        this.shotCooldown = 0;
        // 連射設定: shotRate 1（200フレーム）～5（60フレーム）
        const shotRateConfig = template?.config?.shotRate ?? 3;
        this.shotInterval = Math.round(200 - (shotRateConfig - 1) * 35); // 1=200, 3=130, 5=60
    }

    update(engine) {
        if (this.frozen) {
            return false;
        }

        if (this.isDying) {
            // 死亡点滅フェーズ
            if (this.deathFlashPhase) {
                if (this.damageFlashTimer > 0) {
                    this.damageFlashTimer--;
                    return false; // まだ点滅中
                }
                // 点滅終了→落下開始
                this.deathFlashPhase = false;
                this.vy = -0.3;
                this.vx = this.deathFromRight ? -0.1 : 0.1;
                this.onGround = false;
            }
            // 落下演出
            this.vy += this.gravity;
            this.y += this.vy;
            this.deathTimer++;
            return this.deathTimer > 120;
        }

        if (this.shotCooldown > 0) {
            this.shotCooldown--;
        }

        if (this.isAttacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
            }
        }

        // ダメージ点滅タイマー
        if (this.damageFlashTimer > 0) {
            this.damageFlashTimer--;
        }

        // 空中か地上かで分岐
        if (this.isAerial) {
            this.updateAerial(engine);
        } else if (this.behavior === 'clinging') {
            this.updateClinging(engine);
        } else {
            this.updateGround(engine);
        }

        // SHOT攻撃
        if (this.shotMaxRange > 0 && this.shotCooldown <= 0) {
            this.shoot(engine);
        }

        // 状態更新
        this.updateState();

        // アニメーション
        this.animTimer++;
        const spriteSlot = this.getSpriteSlot();
        const speed = this.template?.sprites?.[spriteSlot]?.speed || 5;
        const interval = Math.floor(60 / speed);
        if (this.animTimer >= interval) {
            this.animTimer = 0;
            const frames = this.template?.sprites?.[spriteSlot]?.frames || [];
            if (frames.length > 0) {
                this.animFrame = (this.animFrame + 1) % frames.length;
            }
        }

        return false;
    }

    // ========== 地上モード ==========
    updateGround(engine) {
        switch (this.behavior) {
            case 'idle':
                this.vx = 0;
                break;
            case 'patrol':
                this.patrol(engine);
                break;
            case 'jump':
                // その場ジャンプ
                this.vx = 0;
                if (this.onGround && Math.random() < 0.02) {
                    this.vy = this.jumpPower;
                    this.onGround = false;
                }
                break;
            case 'jumpPatrol':
                // ジャンプで移動（歩かない、4タイル範囲）
                const jpMaxRange = 4;
                const jpDistX = this.x - this.originX;

                // 範囲制限
                if (this.facingRight && jpDistX >= jpMaxRange) {
                    this.facingRight = false;
                } else if (!this.facingRight && jpDistX <= -jpMaxRange) {
                    this.facingRight = true;
                }

                // ジャンプ中のみ移動、接地時は静止
                if (this.onGround) {
                    this.vx = 0;
                    if (Math.random() < 0.02) {
                        this.vy = this.jumpPower;
                        this.vx = this.facingRight ? this.moveSpeed * 2 : -this.moveSpeed * 2;
                        this.onGround = false;
                    }
                }
                break;
            case 'chase':
                // 追いかけてくる（定期的にジャンプ）
                this.chaseWithReturn(engine);
                if (this.isChasing && !this.chasePaused && this.onGround && Math.random() < 0.02) {
                    this.vy = this.jumpPower;
                    this.onGround = false;
                }
                break;
            case 'rush':
                // とっしん（地上）
                this.rushGround(engine);
                break;
            default:
                this.vx = 0;
        }

        // はしご判定
        this.onLadder = engine.isOnLadder(this.x, this.y, this.width, this.height);

        // 重力（はしご上では無効）
        if (!this.onLadder) {
            this.vy += this.gravity;
            if (this.vy > this.maxFallSpeed) {
                this.vy = this.maxFallSpeed;
            }
        } else {
            this.vy = 0; // はしご上では縦方向の速度をリセット
        }

        this.x += this.vx;
        this.handleHorizontalCollision(engine);
        this.y += this.vy;
        this.handleVerticalCollision(engine);

        // ギミックブロックに乗っている場合、ブロックと一緒に移動
        if (this.ridingGimmickBlock) {
            this.x += this.ridingGimmickBlock.vx;
            this.y = this.ridingGimmickBlock.y - this.height;
        }
    }

    // ========== 空中モード ==========
    updateAerial(engine) {
        switch (this.behavior) {
            case 'idle':
                // 空中で動かない
                this.vx = 0;
                this.vy = 0;
                break;
            case 'patrol':
                // 空中で左右移動
                this.patrol(engine);
                this.vy = 0; // 重力なし
                break;
            case 'jump':
                // 空中で上下移動（8タイル範囲制限、床/天井の衝突）
                this.vx = 0;
                const vertMaxRange = 8;
                const distY = this.y - this.originY;

                if (this.floatDirection > 0 && distY >= vertMaxRange) {
                    this.floatDirection = -1;
                } else if (this.floatDirection < 0 && distY <= -vertMaxRange) {
                    this.floatDirection = 1;
                }

                // 床/天井判定
                const checkYJump = this.floatDirection > 0
                    ? Math.floor(this.y + this.height + 0.1)
                    : Math.floor(this.y - 0.1);
                if (this.checkTileCollision(engine, Math.floor(this.x + this.width / 2), checkYJump) === 1) {
                    this.floatDirection *= -1;
                }

                this.vy = this.floatDirection * this.moveSpeed;
                break;
            case 'jumpPatrol':
                // 空中で左右移動（4タイル） + 定期落下（6タイル、4倍速） + 元に戻る（通常速度）
                const horzMaxRange = 4;
                const diveMaxRange = 6;
                const normalSpeed = this.moveSpeed;
                const diveSpeed = this.moveSpeed * 4;

                if (!this.isDiving && !this.isReturning) {
                    // 通常時は左右移動
                    const distX = this.x - this.originX;
                    if (this.facingRight && distX >= horzMaxRange) {
                        this.facingRight = false;
                    } else if (!this.facingRight && distX <= -horzMaxRange) {
                        this.facingRight = true;
                    }

                    // 壁判定
                    const checkXJP = this.facingRight ? Math.floor(this.x + this.width + 0.1) : Math.floor(this.x - 0.1);
                    if (this.checkTileCollision(engine, checkXJP, Math.floor(this.y + this.height / 2)) === 1) {
                        this.facingRight = !this.facingRight;
                    }

                    this.vx = this.facingRight ? normalSpeed : -normalSpeed;
                    this.vy = 0;
                    this.diveTimer++;

                    // 2秒ごとに落下開始
                    if (this.diveTimer >= 120) {
                        this.isDiving = true;
                        this.diveTimer = 0;
                    }
                } else if (this.isDiving) {
                    // 落下フェーズ（6タイルまで or 床、4倍速）
                    this.vx = 0;
                    const diveDistY = this.y - this.originY;
                    const floorCheck = Math.floor(this.y + this.height + 0.1);
                    if (diveDistY < diveMaxRange && this.checkTileCollision(engine, Math.floor(this.x + this.width / 2), floorCheck) !== 1) {
                        this.vy = diveSpeed;
                    } else {
                        this.isDiving = false;
                        this.isReturning = true;
                    }
                } else if (this.isReturning) {
                    // 元に戻るフェーズ（通常速度）
                    this.vx = 0;
                    const dyReturn = this.originY - this.y;
                    if (Math.abs(dyReturn) > 0.2) {
                        this.vy = dyReturn > 0 ? normalSpeed : -normalSpeed;
                    } else {
                        this.y = this.originY;
                        this.vy = 0;
                        this.isReturning = false;
                    }
                }
                break;
            case 'chase':
                // 空中で追いかける
                this.aerialChaseWithReturn(engine);
                break;
            case 'rush':
                // とっしん（空中）
                this.rushAerial(engine);
                break;
            default:
                this.vx = 0;
                this.vy = 0;
        }

        // 空中モードは重力なし、移動のみ
        this.x += this.vx;
        this.y += this.vy;
    }

    // ========== はりつきモード ==========
    // clingAngle: 0=床, π/2=右壁(右90度CW), π=天井, -π/2=左壁
    // facingRight の対応:
    //   floor/wallL → clingDir > 0  /  ceiling/wallR → clingDir < 0
    updateClinging(engine) {
        const spd = this.moveSpeed;

        // 初期着地フェーズ：重力落下して床に着くまで待つ
        if (this.clingLanding) {
            this.vx = 0;
            this.vy += this.gravity;
            if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;
            this.x += this.vx;
            this.y += this.vy;
            const shrink = this.width * 0.05;
            const botY = Math.floor(this.y + this.height);
            for (let tx = Math.floor(this.x + shrink); tx <= Math.floor(this.x + this.width - shrink); tx++) {
                if (this.vy >= 0 && this.checkTileCollision(engine, tx, botY) === 1) {
                    this.y = botY - this.height;
                    this.vy = 0;
                    this.onGround = true;
                    this.clingLanding = false;
                    this.clingFace = 'floor';
                    this.clingAngle = 0;
                    this.clingDir = this.facingRight ? 1 : -1;
                    break;
                }
            }
            return;
        }

        this.vx = 0;
        this.vy = 0;

        switch (this.clingFace) {
            case 'floor': {
                this.onGround = true;
                this.clingAngle = 0;
                this.facingRight = this.clingDir > 0;

                // 内コーナー：前方に壁 → 壁へ移行
                const wallX = this.clingDir > 0
                    ? Math.floor(this.x + this.width + 0.01)
                    : Math.floor(this.x - 0.01);
                if (this.checkTileCollision(engine, wallX, Math.floor(this.y + this.height * 0.5)) === 1) {
                    if (this.clingDir > 0) {
                        this.x = wallX - this.width;
                        this.clingFace = 'wallR';
                        this.clingAngle = -Math.PI / 2;
                    } else {
                        this.x = wallX + 1;
                        this.clingFace = 'wallL';
                        this.clingAngle = Math.PI / 2;
                    }
                    this.clingDir = -1;
                    return;
                }

                // 外コーナー：足元が空 → 外壁へ移行
                const outerX = this.clingDir > 0
                    ? Math.floor(this.x + this.width)
                    : Math.floor(this.x - 0.01);
                if (this.checkTileCollision(engine, outerX, Math.floor(this.y + this.height + 0.1)) === 0) {
                    if (this.clingDir > 0) {
                        this.x = outerX;
                        this.clingFace = 'wallL';
                        this.clingAngle = Math.PI / 2;
                    } else {
                        this.x = outerX + 1 - this.width;
                        this.clingFace = 'wallR';
                        this.clingAngle = -Math.PI / 2;
                    }
                    this.clingDir = 1;
                    return;
                }

                this.vx = this.clingDir * spd;
                break;
            }

            case 'ceiling': {
                this.onGround = false;
                this.clingAngle = Math.PI;
                this.facingRight = this.clingDir < 0;      // 180°回転後、left=右向きに見える

                // 前方に障害物 → 右90度転換（壁を下向きに移行）
                const wallX = this.clingDir > 0
                    ? Math.floor(this.x + this.width + 0.01)
                    : Math.floor(this.x - 0.01);
                if (this.checkTileCollision(engine, wallX, Math.floor(this.y + this.height * 0.5)) === 1) {
                    if (this.clingDir > 0) {
                        this.x = wallX - this.width;
                        this.clingFace = 'wallR';
                        this.clingAngle = -Math.PI / 2;
                    } else {
                        this.x = wallX + 1;
                        this.clingFace = 'wallL';
                        this.clingAngle = Math.PI / 2;
                    }
                    this.clingDir = 1;
                    return;
                }

                // 外コーナー：前方の頭上が空 → 外壁を上向きに移行
                const outerX = this.clingDir > 0
                    ? Math.floor(this.x + this.width)
                    : Math.floor(this.x - 0.01);
                if (this.checkTileCollision(engine, outerX, Math.floor(this.y + 0.1) - 1) === 0) {
                    if (this.clingDir > 0) {
                        // 右移動 → 最後の天井タイル右端の外面を上向きに（wallL）
                        this.x = outerX;
                        this.clingFace = 'wallL';
                        this.clingAngle = Math.PI / 2;
                    } else {
                        // 左移動 → 最後の天井タイル左端の外面を上向きに（wallR）
                        this.x = outerX + 1 - this.width;
                        this.clingFace = 'wallR';
                        this.clingAngle = -Math.PI / 2;
                    }
                    this.clingDir = -1;
                    return;
                }

                this.vx = this.clingDir * spd;
                break;
            }

            case 'wallL': {
                this.onGround = false;
                this.clingAngle = Math.PI / 2;
                this.facingRight = this.clingDir > 0;

                // 内コーナー：前方に床/天井 → 移行
                const frontY = this.clingDir > 0
                    ? Math.floor(this.y + this.height + 0.01)
                    : Math.floor(this.y - 0.01);
                if (this.checkTileCollision(engine, Math.floor(this.x + this.width * 0.5), frontY) === 1) {
                    if (this.clingDir > 0) {
                        this.y = frontY - this.height;
                        this.clingFace = 'floor';
                        this.clingAngle = 0;
                    } else {
                        this.y = frontY + 1;
                        this.clingFace = 'ceiling';
                        this.clingAngle = Math.PI;
                    }
                    this.clingDir = 1;
                    return;
                }

                // 外コーナー：壁が終わる → 床/天井に移行
                const wallCol = Math.floor(this.x - 0.01);
                if (this.checkTileCollision(engine, wallCol, frontY) === 0) {
                    if (this.clingDir > 0) {
                        // 下向き → 天井へ
                        this.y = frontY;
                        this.clingFace = 'ceiling';
                        this.clingAngle = Math.PI;
                        this.clingDir = -1;
                    } else {
                        // 上向き → 床へ
                        this.y = frontY + 1 - this.height;
                        this.clingFace = 'floor';
                        this.clingAngle = 0;
                        this.clingDir = -1;
                    }
                    return;
                }

                this.vy = this.clingDir * spd;
                break;
            }

            case 'wallR': {
                this.onGround = false;
                this.clingAngle = -Math.PI / 2;
                this.facingRight = this.clingDir < 0;

                // 内コーナー：前方に床/天井 → 移行
                const frontY = this.clingDir > 0
                    ? Math.floor(this.y + this.height + 0.01)
                    : Math.floor(this.y - 0.01);
                if (this.checkTileCollision(engine, Math.floor(this.x + this.width * 0.5), frontY) === 1) {
                    if (this.clingDir > 0) {
                        this.y = frontY - this.height;
                        this.clingFace = 'floor';
                        this.clingAngle = 0;
                    } else {
                        this.y = frontY + 1;
                        this.clingFace = 'ceiling';
                        this.clingAngle = Math.PI;
                    }
                    this.clingDir = -1;
                    return;
                }

                // 外コーナー：壁が終わる → 床/天井に移行
                const wallRCol = Math.floor(this.x + this.width + 0.01);
                if (this.checkTileCollision(engine, wallRCol, frontY) === 0) {
                    if (this.clingDir > 0) {
                        // 下向き → 天井へ
                        this.y = frontY;
                        this.clingFace = 'ceiling';
                        this.clingAngle = Math.PI;
                        this.clingDir = 1;
                    } else {
                        // 上向き → 床へ
                        this.y = frontY + 1 - this.height;
                        this.clingFace = 'floor';
                        this.clingAngle = 0;
                        this.clingDir = 1;
                    }
                    return;
                }

                this.vy = this.clingDir * spd;
                break;
            }
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    patrol(engine) {
        const maxRange = 8; // 移動範囲制限（タイル）

        // 範囲チェック（originから8タイル以上離れたら折り返す）
        const distFromOrigin = this.x - this.originX;
        if (this.facingRight && distFromOrigin >= maxRange) {
            this.facingRight = false;
        } else if (!this.facingRight && distFromOrigin <= -maxRange) {
            this.facingRight = true;
        }

        const checkX = this.facingRight ? Math.floor(this.x + this.width + 0.1) : Math.floor(this.x - 0.1);
        const footY = Math.floor(this.y + this.height + 0.1);

        // 空中モードでない場合のみ崖判定
        if (!this.isAerial && this.onGround) {
            if (this.checkTileCollision(engine, checkX, footY) === 0) {
                this.facingRight = !this.facingRight;
            }
        }

        // 壁判定
        const wallY = Math.floor(this.y + this.height / 2);
        if (this.checkTileCollision(engine, checkX, wallY) === 1) {
            this.facingRight = !this.facingRight;
        }

        this.vx = this.facingRight ? this.moveSpeed : -this.moveSpeed;
    }

    chaseWithReturn(engine) {
        if (!engine.player) {
            this.returnToOrigin();
            return;
        }

        const dx = engine.player.x - this.x;
        const dy = engine.player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.detectionRange) {
            // プレイヤー発見
            this.isChasing = true;

            // 休憩タイマー管理（約2秒追跡 → 約1秒停止を繰り返す）
            this.chasePauseTimer++;
            if (this.chasePaused) {
                // 休憩中（約60フレーム = 1秒）
                this.vx = 0;
                if (this.chasePauseTimer >= 60) {
                    this.chasePaused = false;
                    this.chasePauseTimer = 0;
                }
                return;
            } else {
                // 追跡中（約120フレーム = 2秒）
                if (this.chasePauseTimer >= 120) {
                    this.chasePaused = true;
                    this.chasePauseTimer = 0;
                    this.vx = 0;
                    return;
                }
            }

            if (Math.abs(dx) > 0.5) {
                this.vx = dx > 0 ? this.moveSpeed : -this.moveSpeed;
                this.facingRight = dx > 0;
            } else {
                this.vx = 0;
            }
        } else if (this.isChasing) {
            // 見失った → 元の位置へ戻る
            this.chasePauseTimer = 0;
            this.chasePaused = false;
            this.returnToOrigin();
        } else {
            this.vx = 0;
        }
    }

    aerialChaseWithReturn(engine) {
        if (!engine.player) {
            this.returnToOriginAerial();
            return;
        }

        const dx = engine.player.x - this.x;
        const dy = engine.player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.detectionRange) {
            this.isChasing = true;
            // 重力なしで接近
            if (Math.abs(dx) > 0.3) {
                this.vx = dx > 0 ? this.moveSpeed : -this.moveSpeed;
                this.facingRight = dx > 0;
            } else {
                this.vx = 0;
            }
            if (Math.abs(dy) > 0.3) {
                this.vy = dy > 0 ? this.moveSpeed : -this.moveSpeed;
            } else {
                this.vy = 0;
            }
        } else if (this.isChasing) {
            this.returnToOriginAerial();
        } else {
            this.vx = 0;
            this.vy = 0;
        }
    }

    returnToOrigin() {
        const dx = this.originX - this.x;
        if (Math.abs(dx) > 0.2) {
            this.vx = dx > 0 ? this.moveSpeed : -this.moveSpeed;
            this.facingRight = dx > 0;
        } else {
            this.vx = 0;
            this.x = this.originX;
            this.isChasing = false;
        }
    }

    returnToOriginAerial() {
        const dx = this.originX - this.x;
        const dy = this.originY - this.y;
        if (Math.abs(dx) > 0.2) {
            this.vx = dx > 0 ? this.moveSpeed : -this.moveSpeed;
            this.facingRight = dx > 0;
        } else {
            this.vx = 0;
        }
        if (Math.abs(dy) > 0.2) {
            this.vy = dy > 0 ? this.moveSpeed : -this.moveSpeed;
        } else {
            this.vy = 0;
        }
        if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
            this.x = this.originX;
            this.y = this.originY;
            this.isChasing = false;
        }
    }

    // とっしん（地上）
    rushGround(engine) {
        const backSpeed = this.moveSpeed * 0.5; // ゆっくり後退
        const rushSpeed = this.moveSpeed * 4;   // 4倍の速さ
        const rushMaxDist = 4;                  // 4タイル

        // プレイヤー方向を見る
        if (engine.player && this.rushPhase === 'idle') {
            this.facingRight = engine.player.x > this.x;
        }

        switch (this.rushPhase) {
            case 'idle':
                // 開始：後退フェーズへ
                this.rushStartX = this.x;
                this.rushPhase = 'back';
                break;
            case 'back':
                // 1タイル分ゆっくり後退
                const backDir = this.facingRight ? -1 : 1;
                const backDist = Math.abs(this.x - this.rushStartX);
                if (backDist < 1) {
                    this.vx = backDir * backSpeed;
                } else {
                    this.vx = 0;
                    this.rushStartX = this.x;
                    this.rushPhase = 'rush';
                }
                break;
            case 'rush':
                // 前方へ突進
                const rushDir = this.facingRight ? 1 : -1;
                const rushDist = Math.abs(this.x - this.rushStartX);
                const wallCheck = this.facingRight ? Math.floor(this.x + this.width + 0.1) : Math.floor(this.x - 0.1);
                if (rushDist < rushMaxDist && this.checkTileCollision(engine, wallCheck, Math.floor(this.y + this.height / 2)) !== 1) {
                    this.vx = rushDir * rushSpeed;
                } else {
                    this.vx = 0;
                    this.rushPhase = 'return';
                }
                break;
            case 'return':
                // 元の位置へ戻る（後ずさり：向きは変えない）
                const dxReturn = this.originX - this.x;
                if (Math.abs(dxReturn) > 0.2) {
                    // 向きを変えずに戻る（後ずさり）
                    this.vx = dxReturn > 0 ? this.moveSpeed : -this.moveSpeed;
                } else {
                    this.x = this.originX;
                    this.vx = 0;
                    this.rushPhase = 'idle';
                }
                break;
        }
    }

    // とっしん（空中）
    rushAerial(engine) {
        const backSpeed = this.moveSpeed * 0.5;
        const rushSpeed = this.moveSpeed * 4;
        const rushMaxDist = 4;

        // プレイヤー方向を見る
        if (engine.player && this.rushPhase === 'idle') {
            this.facingRight = engine.player.x > this.x;
        }

        switch (this.rushPhase) {
            case 'idle':
                this.rushStartX = this.x;
                this.rushPhase = 'back';
                this.vy = 0;
                break;
            case 'back':
                const backDir = this.facingRight ? -1 : 1;
                const backDist = Math.abs(this.x - this.rushStartX);
                if (backDist < 1) {
                    this.vx = backDir * backSpeed;
                    this.vy = 0;
                } else {
                    this.vx = 0;
                    this.rushStartX = this.x;
                    this.rushPhase = 'rush';
                }
                break;
            case 'rush':
                const rushDir = this.facingRight ? 1 : -1;
                const rushDist = Math.abs(this.x - this.rushStartX);
                const wallCheck = this.facingRight ? Math.floor(this.x + this.width + 0.1) : Math.floor(this.x - 0.1);
                if (rushDist < rushMaxDist && this.checkTileCollision(engine, wallCheck, Math.floor(this.y + this.height / 2)) !== 1) {
                    this.vx = rushDir * rushSpeed;
                    this.vy = 0;
                } else {
                    this.vx = 0;
                    this.rushPhase = 'return';
                }
                break;
            case 'return':
                // 元の位置へ戻る（後ずさり：向きは変えない）
                const dxReturn = this.originX - this.x;
                const dyReturn = this.originY - this.y;
                if (Math.abs(dxReturn) > 0.2) {
                    // 向きを変えずに戻る（後ずさり）
                    this.vx = dxReturn > 0 ? this.moveSpeed : -this.moveSpeed;
                } else {
                    this.vx = 0;
                }
                if (Math.abs(dyReturn) > 0.2) {
                    this.vy = dyReturn > 0 ? this.moveSpeed : -this.moveSpeed;
                } else {
                    this.vy = 0;
                }
                if (Math.abs(dxReturn) < 0.2 && Math.abs(dyReturn) < 0.2) {
                    this.x = this.originX;
                    this.y = this.originY;
                    this.rushPhase = 'idle';
                }
                break;
        }
    }

    updateState() {
        if (this.isAttacking) {
            this.state = 'attack';
        } else if (this.onLadder) {
            this.state = 'climb';
        } else if (!this.onGround && !this.isAerial && this.behavior !== 'clinging') {
            this.state = 'jump';
        } else if (this.vx !== 0 || this.vy !== 0) {
            this.state = 'walk';
        } else {
            this.state = 'idle';
        }
    }

    getSpriteSlot() {
        let slot = this.state;

        // attack スプライトがない場合は、他の状態にフォールバック
        if (slot === 'attack' && !(this.template?.sprites?.attack?.frames?.length > 0)) {
            if (this.onLadder) slot = 'climb';
            else if (!this.onGround && !this.isAerial && this.behavior !== 'clinging') slot = 'jump';
            else if (this.vx !== 0) slot = 'walk';
            else slot = 'idle';
        }

        switch (slot) {
            case 'attack': return 'attack';
            case 'climb': return this.template?.sprites?.climb?.frames?.length > 0 ? 'climb' : 'idle';
            case 'jump': return this.template?.sprites?.jump?.frames?.length > 0 ? 'jump' : 'idle';
            case 'walk': return this.template?.sprites?.walk?.frames?.length > 0 ? 'walk' : 'idle';
            default: return 'idle';
        }
    }

    shoot(engine) {
        const shotSprite = this.template?.sprites?.shot?.frames?.[0];
        if (shotSprite === undefined) return;

        this.isAttacking = true;
        this.attackTimer = 15;
        this.shotCooldown = this.shotInterval;
        this.animFrame = 0;

        const shotType = this.template?.config?.shotType || 'straight';
        const direction = this.facingRight ? 1 : -1;
        // 速度設定: shotSpeed 1（0.06）～5（0.2）
        const shotSpeedConfig = this.template?.config?.shotSpeed ?? 3;
        const baseSpeed = 0.06 + (shotSpeedConfig - 1) * 0.035; // 1=0.06, 3=0.13, 5=0.2

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
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
            owner: 'enemy',
            ownerEntity: this,
            startX: startX,
            startY: startY,
            facingRight: this.facingRight,
            baseSpeed: baseSpeed,
            shotMaxRange: this.shotMaxRange,
            templateIdx: this.templateIdx,
            shotSprite: shotSprite,
            ownerEnemy: this  // melee, orbit 用
        });
    }

    takeDamage(fromRight) {
        this.lives--;
        this.damageFlashTimer = 10; // 白点滅（10フレーム）
        if (this.lives <= 0) {
            this.die(fromRight);
        }
    }

    die(fromRight) {
        this.isDying = true;
        this.frozen = false; // 死亡時は休眠解除（描画されるように）
        this.damageFlashTimer = 10; // 死亡時も白点滅
        this.deathFlashPhase = true; // 点滅中は落下しない
        this.deathFromRight = fromRight;
        // ドロップアイテム用に死亡時の位置を記録
        this.deathX = this.x;
        this.deathY = this.y;
        this.vy = 0;
        this.vx = 0;
    }

    handleHorizontalCollision(engine) {
        PhysicsHandler.handleHorizontalCollision(this, engine, this.isDying, {
            onFacingRightUpdate: (shouldFaceRight) => {
                this.facingRight = shouldFaceRight;
            }
        });
    }

    handleVerticalCollision(engine) {
        if (this.isDying) return;

        PhysicsHandler.handleVerticalCollision(this, engine, {
            // 敵は player 固有の callback（onDamageTile, onJumpReset）は不要
        });
    }

    // 静的マップおよびギミックブロックを考慮して壁・床判定を行うヘルパー
    checkTileCollision(engine, tx, ty) {
        // 通常の地形判定
        const normalCol = engine.getCollision(tx, ty);
        if (normalCol === 1) return 1;

        // ギミックブロックの判定
        if (engine.gimmickBlocks) {
            for (const block of engine.gimmickBlocks) {
                if (block.state === 'falling') continue;
                // ブロックの当たり判定（移動中は小数が含まれる可能性があるためfloorでタイル座標を取る）
                if (Math.floor(block.x) === tx && Math.floor(block.y) === ty) {
                    return 1;
                }
            }
        }
        return 0; // 衝突なし
    }

    render(ctx, tileSize, camera) {
        if (!this.template) return;

        // 当たり判定の中心座標（下端基準）- Playerと同じ方式
        const hitboxCenterX = this.x + this.width / 2;
        const hitboxBottom = this.y + this.height;

        const spriteSlot = this.getSpriteSlot();
        const frames = this.template?.sprites?.[spriteSlot]?.frames || this.template?.sprites?.idle?.frames || [];
        const spriteIdx = frames[this.animFrame] ?? frames[0];
        const sprite = App.projectData.sprites[spriteIdx];

        if (sprite) {
            const palette = App.nesPalette;
            const spriteSize = sprite.size || 1;
            const dimension = spriteSize === 2 ? 32 : 16;
            const tileCount = spriteSize === 2 ? 2 : 1;
            const renderSize = tileSize * tileCount;
            const pixelSize = renderSize / dimension;

            // スプライトを当たり判定に対して下端寄せ＆横軸中央寄せで描画
            const spriteDrawX = (hitboxCenterX - tileCount / 2 - camera.x) * tileSize;
            const spriteDrawY = (hitboxBottom - tileCount - camera.y) * tileSize;

            const centerX = spriteDrawX + renderSize / 2;
            const centerY = spriteDrawY + renderSize / 2;

            ctx.save();
            ctx.translate(centerX, centerY);

            if (this.isDying) {
                // 死亡時は上下反転
                ctx.scale(1, -1);
            } else if (this.behavior === 'clinging' && !this.clingLanding) {
                // はりつき時は面に応じて回転
                ctx.rotate(this.clingAngle);
            }

            // 左右反転（facingRight に基づく）
            if (!this.facingRight) ctx.scale(-1, 1);

            ctx.translate(-renderSize / 2, -renderSize / 2);

            for (let y = 0; y < dimension; y++) {
                for (let x = 0; x < dimension; x++) {
                    const colorIndex = sprite.data[y]?.[x];
                    if (colorIndex >= 0) {
                        // ダメージ点滅中は白色
                        if (this.damageFlashTimer > 0 && this.damageFlashTimer % 2 === 0) {
                            ctx.fillStyle = '#FFFFFF';
                        } else {
                            ctx.fillStyle = palette[colorIndex];
                        }
                        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize + 0.5, pixelSize + 0.5);
                    }
                }
            }

            ctx.restore();
        }
    }
}
