/**
 * PixelGameKit - プロジェクタイル管理クラス
 * Player と Enemy の射撃ロジック統合
 */

class ProjectileManager {
    /**
     * プロジェクタイル生成の統一インターフェース
     * @param {GameEngine} engine ゲームエンジン
     * @param {Object} config {
     *   shotType: string ('spread' | 'drop' | 'melee' | 'pinball' | 'orbit' | 'straight' | 'arc')
     *   owner: string ('player' | 'enemy')
     *   ownerEntity: Player | Enemy インスタンス
     *   startX, startY: number (発射開始座標)
     *   facingRight: boolean (向き)
     *   baseSpeed: number (基本速度)
     *   shotMaxRange: number (最大距離)
     *   templateIdx: number (テンプレートインデックス)
     *   shotSprite: number (ショット用スプライトID)
     *   ownerEnemy?: Enemy (melee, orbit時のみ - 敵がオーナー)
     * }
     */
    static createAndAddProjectiles(engine, config) {
        const {
            shotType,
            owner,
            ownerEntity,
            startX,
            startY,
            facingRight,
            baseSpeed,
            shotMaxRange,
            templateIdx,
            shotSprite,
            ownerEnemy = null
        } = config;

        if (shotType === 'spread') {
            // 拡散: 4方向発射（交互に＋と✕パターン）
            const counterKey = owner === 'player' ? 'spreadShotCounter' : 'enemySpreadCounter';
            const isPlus = (engine[counterKey] || 0) % 2 === 0;
            engine[counterKey] = (engine[counterKey] || 0) + 1;
            const angles = isPlus ? [0, 90, 180, 270] : [45, 135, 225, 315];

            angles.forEach(angle => {
                const rad = angle * Math.PI / 180;
                engine.projectiles.push({
                    x: startX, y: startY,
                    vx: Math.cos(rad) * baseSpeed,
                    vy: Math.sin(rad) * baseSpeed,
                    width: 0.5, height: 0.5,
                    spriteIdx: shotSprite,
                    templateIdx: templateIdx,
                    animationSlot: 'shot',
                    owner: owner,
                    maxRange: shotMaxRange,
                    startX: startX, startY: startY,
                    facingRight: facingRight,
                    shotType: shotType,
                    bounceCount: 0
                });
            });
        } else if (shotType === 'drop') {
            // 真下に落下
            engine.projectiles.push({
                x: startX, y: startY,
                vx: 0, vy: baseSpeed,
                width: 0.5, height: 0.5,
                spriteIdx: shotSprite,
                templateIdx: templateIdx,
                animationSlot: 'shot',
                owner: owner,
                maxRange: shotMaxRange,
                startX: owner === 'player' ? startX : ownerEntity.x,
                startY: owner === 'player' ? startY : ownerEntity.y,
                facingRight: facingRight,
                shotType: shotType,
                bounceCount: 0
            });
        } else if (shotType === 'melee') {
            // 近接: 目の前に表示（ownerEnemyで追従）
            const projectile = {
                x: ownerEntity.x + (facingRight ? ownerEntity.width : -1),
                y: ownerEntity.y + ownerEntity.height / 2 - 0.5,
                vx: 0, vy: 0,
                width: 1, height: 1,
                spriteIdx: shotSprite,
                templateIdx: templateIdx,
                animationSlot: 'shot',
                owner: owner,
                maxRange: 999,
                startX: ownerEntity.x, startY: ownerEntity.y,
                facingRight: facingRight,
                shotType: shotType,
                duration: 15,
                bounceCount: 0
            };

            if (ownerEnemy) {
                projectile.ownerEnemy = ownerEnemy;
            }

            engine.projectiles.push(projectile);
        } else if (shotType === 'pinball') {
            // ピンポン: 斜め45度発射
            const angle = facingRight ? -45 : -135;
            const rad = angle * Math.PI / 180;
            engine.projectiles.push({
                x: startX, y: startY,
                vx: Math.cos(rad) * baseSpeed,
                vy: Math.sin(rad) * baseSpeed,
                width: 0.5, height: 0.5,
                spriteIdx: shotSprite,
                templateIdx: templateIdx,
                animationSlot: 'shot',
                owner: owner,
                maxRange: shotMaxRange,
                startX: startX, startY: startY,
                facingRight: facingRight,
                shotType: shotType,
                bounceCount: 0
            });
        } else if (shotType === 'orbit') {
            // 回転: オーナーの周りを周回
            const projectile = {
                x: startX, y: startY,
                vx: 0, vy: 0,
                width: 0.5, height: 0.5,
                spriteIdx: shotSprite,
                templateIdx: templateIdx,
                animationSlot: 'shot',
                owner: owner,
                maxRange: 999,
                startX: startX, startY: startY,
                facingRight: facingRight,
                shotType: shotType,
                duration: 200,
                bounceCount: 0,
                orbitAngle: 0
            };

            if (ownerEnemy) {
                projectile.ownerEnemy = ownerEnemy;
            }

            engine.projectiles.push(projectile);
        } else {
            // その他: straight / arc - 通常発射
            engine.projectiles.push({
                x: startX, y: startY,
                vx: baseSpeed * (facingRight ? 1 : -1),
                vy: shotType === 'arc' ? -0.15 : 0,
                width: 0.5, height: 0.5,
                spriteIdx: shotSprite,
                templateIdx: templateIdx,
                animationSlot: 'shot',
                owner: owner,
                maxRange: shotMaxRange,
                startX: startX, startY: startY,
                facingRight: facingRight,
                shotType: shotType,
                returning: false,
                bounceCount: 0
            });
        }
    }
}
