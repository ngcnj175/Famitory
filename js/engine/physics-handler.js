/**
 * PixelGameKit - 物理演算・衝突判定ハンドラクラス
 * Player と Enemy の衝突判定ロジック統合
 */

class PhysicsHandler {
    /**
     * 水平衝突判定（左右の壁）
     * @param {Player|Enemy} entity プレイヤーまたは敵
     * @param {GameEngine} engine ゲームエンジン
     * @param {boolean} isDying 死亡状態（敵のみ使用）
     * @param {Object} callbacks {
     *   onFacingRightUpdate?: (shouldFaceRight) => void  // 敵の向き更新用
     * }
     */
    static handleHorizontalCollision(entity, engine, isDying = false, callbacks = {}) {
        if (isDying) return;

        const left = Math.floor(entity.x);
        const right = Math.floor(entity.x + entity.width);
        const top = Math.floor(entity.y);
        const bottom = Math.floor(entity.y + entity.height - 0.01);

        for (let ty = top; ty <= bottom; ty++) {
            if (engine.getCollision(left, ty) === 1) {
                entity.x = left + 1;
                entity.vx = 0;
                // 敵の場合のみ向きを反転
                if (callbacks.onFacingRightUpdate) {
                    callbacks.onFacingRightUpdate(true);
                }
            }
            if (engine.getCollision(right, ty) === 1) {
                entity.x = right - entity.width;
                entity.vx = 0;
                // 敵の場合のみ向きを反転
                if (callbacks.onFacingRightUpdate) {
                    callbacks.onFacingRightUpdate(false);
                }
            }
        }
    }

    /**
     * 垂直衝突判定（床・天井、スプリング、ギミックブロック）
     * @param {Player|Enemy} entity プレイヤーまたは敵
     * @param {GameEngine} engine ゲームエンジン
     * @param {Object} callbacks {
     *   onDamageTile?: (tx, ty) => void,      // プレイヤーが頭突きでブロック破壊
     *   onSpringHit?: (springData) => void,   // スプリング踏み
     *   onJumpReset?: () => void,             // プレイヤー用: ダブルジャンプリセット
     *   onKnockbackEnd?: () => void,          // プレイヤー用: ノックバック終了
     * }
     */
    static handleVerticalCollision(entity, engine, callbacks = {}) {
        entity.onGround = false;
        entity.ridingGimmickBlock = null;

        const left = Math.floor(entity.x);
        const right = Math.floor(entity.x + entity.width - 0.01);
        const top = Math.floor(entity.y);
        const bottom = Math.floor(entity.y + entity.height);

        for (let tx = left; tx <= right; tx++) {
            // 天井衝突（上向き移動）
            if (entity.vy < 0 && engine.getCollision(tx, top) === 1) {
                // プレイヤーは頭突きでブロック破壊
                if (callbacks.onDamageTile) {
                    callbacks.onDamageTile(tx, top);
                }
                entity.y = top + 1;
                entity.vy = 0;
            }

            // 床衝突（下向き移動）
            if (entity.vy >= 0 && engine.getCollision(tx, bottom) === 1) {
                // スプリング判定
                const posKey = `${tx},${bottom}`;
                if (engine.springTiles && engine.springTiles.has(posKey)) {
                    const springData = engine.springTiles.get(posKey);
                    // power: 1~5 -> vy: -0.5 ~ -0.9
                    entity.vy = -0.4 - (springData.power * 0.1);
                    entity.y = bottom - entity.height;
                    entity.onGround = false;

                    // プレイヤー用: ジャンプ能力リセット
                    if (callbacks.onJumpReset) {
                        callbacks.onJumpReset();
                    }

                    // SE再生・スプリングアニメーション
                    if (typeof engine.activateSpring === 'function') {
                        engine.activateSpring(tx, bottom);
                    }

                    // ノックバック終了（プレイヤーのみ）
                    if (callbacks.onKnockbackEnd) {
                        callbacks.onKnockbackEnd();
                    }

                    break; // スプリング処理したので終了
                }

                // 通常の床
                entity.y = bottom - entity.height;
                entity.vy = 0;
                entity.onGround = true;

                // ノックバック終了（プレイヤーのみ）
                if (callbacks.onKnockbackEnd) {
                    callbacks.onKnockbackEnd();
                }
            }
        }

        // ギミックブロックとの衝突チェック（落下中のみ）
        if (entity.vy >= 0 && engine.gimmickBlocks) {
            for (const block of engine.gimmickBlocks) {
                // 落下中のブロックはすり抜ける
                if (block.state === 'falling') continue;

                // ブロックの上に乗っているか判定
                const entityBottom = entity.y + entity.height;
                const entityLeft = entity.x;
                const entityRight = entity.x + entity.width;
                const blockTop = block.y;
                const blockLeft = block.x;
                const blockRight = block.x + 1;

                // 横方向に重なっていて、足元がブロック上面付近
                if (entityRight > blockLeft && entityLeft < blockRight &&
                    entityBottom >= blockTop && entityBottom < blockTop + 1.0 &&
                    entity.vy >= 0) {
                    entity.y = blockTop - entity.height;
                    entity.vy = 0;
                    entity.onGround = true;
                    entity.ridingGimmickBlock = block;

                    // ノックバック終了（プレイヤーのみ）
                    if (callbacks.onKnockbackEnd) {
                        callbacks.onKnockbackEnd();
                    }

                    break;
                }
            }
        }
    }
}
