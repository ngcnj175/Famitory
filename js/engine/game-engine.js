/**
 * PixelGameKit - ゲームエンジン（Start/Pause対応）
 */

const GameEngine = {
    canvas: null,
    ctx: null,
    animationId: null,
    isRunning: false,
    isPaused: false,
    hasStarted: false,

    player: null,
    enemies: [],
    projectiles: [],
    items: [],
    gimmickBlocks: [],
    ladderTiles: null, // はしごタイルの座標Set
    doorTiles: null, // とびらタイルの座標Map（key: "x,y", value: spriteData）
    doorFlashTiles: [], // とびら白点滅エフェクト
    doorAnimating: false, // とびら演出中フラグ

    GRAVITY: 0.5,
    TILE_SIZE: 16,

    // カメラ
    camera: { x: 0, y: 0 },

    // タイトル画面
    titleState: 'title', // 'title', 'wipe', 'playing', 'clear', 'gameover'
    wipeTimer: 0,
    titleBlinkTimer: 0,
    gameOverTimer: 0,
    clearTimer: 0,

    // タイルアニメーション用フレームカウンター
    tileAnimationFrame: 0,

    // BGM再生
    gameBgmPlayer: null,   // ゲームBGM再生用BgmPlayerインスタンス
    currentBgmType: null,  // 'stage', 'invincible', 'clear', 'gameover', 'boss'

    // ボス演出
    bossSpawned: false,        // ボスが画面に出現したか
    bossSequencePhase: null,   // 'fadeout', 'silence', null (出現演出)
    bossSequenceTimer: 0,      // 演出タイマー
    bossEnemy: null,           // ボスエネミー参照
    bossDefeatPhase: null,     // 'silence', 'clear', null (撃破演出)
    bossDefeatTimer: 0,        // 撃破演出タイマー

    // リスタート長押しUI
    restartBlink: false,
    restartProgress: 0,

    init() {
        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // 描画エンジン初期化
        this.renderer = new GameRenderer(this);

        // 物理演算エンジン初期化
        this.physics = new GamePhysics(this);

        // イースターエッグウィンドウ用クリックハンドラ
        this.canvas.addEventListener('click', (e) => {
            if (this.easterMessageActive && this.easterCloseButton) {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;

                const btn = this.easterCloseButton;
                if (x >= btn.x && x <= btn.x + btn.width &&
                    y >= btn.y && y <= btn.y + btn.height) {
                    this.closeEasterMessage();
                }
            }
        });
    },

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.hasStarted = true;
        this.startMessageTimer = 90; // START!表示時間（1.5秒）
        this.resize();
        this.initGame();

        // 既存のループがあればキャンセル（重複防止）
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.gameLoop();
    },

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.stopBgm();
    },

    // 一時停止トグル（Startボタン用）
    togglePause() {
        if (this.titleState === 'title') {
            // タイトル画面から開始
            this.startFromTitle();
            return;
        }

        if (!this.hasStarted) {
            this.start();
            return;
        }

        if (this.isPaused) {
            this.isPaused = false;
            if (!this.isRunning) {
                this.isRunning = true;
                // 既存のループがあればキャンセル（重複防止）
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }
                this.gameLoop();
            }
        } else if (this.isRunning) {
            this.isPaused = true;
            this.renderer.render(); // PAUSE表示のため再描画
        }
    },

    startFromTitle() {
        // ゲーム状態を完全リセット
        this.initGame();

        // カメラをプレイヤー初期位置に設定
        if (this.player) {
            const stage = App.projectData.stage;
            const viewWidth = this.canvas.width / this.TILE_SIZE;
            const viewHeight = this.canvas.height / this.TILE_SIZE;
            this.camera.x = this.player.x - viewWidth / 2 + 0.5;
            this.camera.y = this.player.y - viewHeight / 2 + 0.5;
            this.camera.x = Math.max(0, Math.min(this.camera.x, stage.width - viewWidth));
            this.camera.y = Math.max(0, Math.min(this.camera.y, stage.height - viewHeight));
        }

        // ワイプ開始
        this.titleState = 'wipe';
        this.wipeTimer = 0;
        this.isRunning = true;
        this.hasStarted = true;
        this.gameLoop();
    },

    // リスタート（Startボタン長押し用）
    restart() {
        this.stop();
        this.hasStarted = false;
        this.isPaused = false;
        this.titleState = 'title';
        this.wipeTimer = 0;
        this.initGame();
        this.resize();
        this.renderer.renderTitleScreen();
        console.log('Game restarted');
    },

    // プレビュー表示（ゲーム開始前）
    showPreview() {
        // 既存のループがあれば停止
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.titleState = 'title';
        this.resize();
        this.initGame();

        // カメラをプレイヤー位置に設定（残像防止）
        if (this.player) {
            const stage = App.projectData.stage;
            const viewWidth = this.canvas.width / this.TILE_SIZE;
            const viewHeight = this.canvas.height / this.TILE_SIZE;
            this.camera.x = this.player.x - viewWidth / 2 + 0.5;
            this.camera.y = this.player.y - viewHeight / 2 + 0.5;
            this.camera.x = Math.max(0, Math.min(this.camera.x, stage.width - viewWidth));
            this.camera.y = Math.max(0, Math.min(this.camera.y, stage.height - viewHeight));
        }

        // ゲーム画面を一度レンダリングしてキャッシュ（残像防止）
        this.renderer.renderGameScreen();

        // タイトル画面表示
        this.renderer.renderTitleScreen();
    },

    resize() {
        const container = document.getElementById('game-viewport');
        if (!container) return;

        const stage = App.projectData.stage;
        const maxWidth = container.clientWidth - 16;
        const maxHeight = container.clientHeight - 16;

        // 2倍表示でフィット
        const scale = 2;
        const viewTilesX = Math.floor(maxWidth / (this.TILE_SIZE * scale));
        const viewTilesY = Math.floor(maxHeight / (this.TILE_SIZE * scale));

        this.canvas.width = viewTilesX * this.TILE_SIZE * scale;
        this.canvas.height = viewTilesY * this.TILE_SIZE * scale;

        this.TILE_SIZE = 16 * scale; // 2倍スケール
    },

    initGame() {
        // ステージデータのディープコピーを作成（実行中の変更が元データに影響しないように）
        this.stageData = JSON.parse(JSON.stringify(App.projectData.stage));
        const stage = this.stageData;
        const templates = App.projectData.templates || [];

        console.log('=== initGame Debug ===');
        console.log('Templates count:', templates.length);

        // プレイヤーとエネミーの位置をテンプレートとステージから検索
        let playerPos = null;
        const enemyPositions = [];

        // 基本プレイヤー: テンプレート配列内の最初の player
        const basePlayerIdx = templates.findIndex(t => t.type === 'player');

        // スプライトIDからテンプレートを検索するマップ（旧形式互換）
        const spriteToTemplate = {};
        templates.forEach((template, index) => {
            const spriteIdx = template?.sprites?.idle?.frames?.[0] ?? template?.sprites?.main?.frames?.[0];
            if (spriteIdx !== undefined) {
                spriteToTemplate[spriteIdx] = template;
            }
        });

        // ヘルパー: tileIdからテンプレートを取得
        const getTemplateFromTileId = (tileId) => {
            if (tileId >= 100) {
                // テンプレートIDベース（新形式）
                const idx = tileId - 100;
                return { template: templates[idx], templateIdx: idx };
            } else if (tileId >= 0) {
                // スプライトIDベース（旧形式）
                const template = spriteToTemplate[tileId];
                const idx = templates.indexOf(template);
                return { template, templateIdx: idx >= 0 ? idx : undefined };
            }
            return { template: null, templateIdx: undefined };
        };

        // ステージ上のタイルからプレイヤー・エネミーを検索
        // 変身アイテム用（プレイヤーentityのうち基本以外）
        const transformItemPositions = [];

        // 1. Entities配列から検索（推奨）
        if (stage.entities) {
            stage.entities.forEach(ent => {
                const template = templates[ent.templateId];
                if (template) {
                    if (template.type === 'player') {
                        if (basePlayerIdx >= 0 && ent.templateId === basePlayerIdx && !playerPos) {
                            playerPos = { x: ent.x, y: ent.y, template, templateIdx: ent.templateId };
                        } else if (basePlayerIdx >= 0 && ent.templateId !== basePlayerIdx) {
                            transformItemPositions.push({ x: ent.x, y: ent.y, template, templateIdx: ent.templateId });
                        }
                    } else if (template.type === 'enemy') {
                        enemyPositions.push({ x: ent.x, y: ent.y, template, templateIdx: ent.templateId, behavior: template.config?.move || 'idle' });
                    }
                }
            });
        }

        if (stage && stage.layers && stage.layers.fg) {
            for (let y = 0; y < stage.height; y++) {
                for (let x = 0; x < stage.width; x++) {
                    const tileId = stage.layers.fg[y][x];
                    if (tileId >= 0) {
                        const { template, templateIdx } = getTemplateFromTileId(tileId);
                        if (template) {
                            if (template.type === 'player') {
                                if (basePlayerIdx >= 0 && templateIdx === basePlayerIdx && !playerPos) {
                                    playerPos = { x, y, template, templateIdx };
                                } else if (basePlayerIdx >= 0 && templateIdx !== basePlayerIdx) {
                                    transformItemPositions.push({ x, y, template, templateIdx });
                                }
                            } else if (template.type === 'enemy') {
                                enemyPositions.push({ x, y, template, templateIdx, behavior: template.config?.move || 'idle' });
                            }
                        }
                    }
                }
            }
        }

        // プレイヤー初期化（ステージ上に配置されている場合のみ）
        if (playerPos) {
            this.player = new Player(playerPos.x, playerPos.y, playerPos.template, playerPos.templateIdx);
            console.log('Player created at', playerPos.x, playerPos.y, 'templateIdx:', playerPos.templateIdx);
        } else {
            // プレイヤーがステージ上にいない場合は生成しない
            this.player = null;
            console.log('No player found on stage');
        }

        // エネミー初期化（templateIdxを渡す）
        this.enemies = enemyPositions.map(pos =>
            new Enemy(pos.x, pos.y, pos.template, pos.behavior, pos.templateIdx)
        );

        // ボス状態リセット＆ボス敵をfrozen状態に
        this.bossSpawned = false;
        this.bossSequencePhase = null;
        this.bossSequenceTimer = 0;
        this.bossDefeatPhase = null;
        this.bossDefeatTimer = 0;
        this.bossEnemy = null;
        this.enemies.forEach(enemy => {
            // ボスは初期状態frozen（出現演出で解除）
            if (enemy.template?.config?.isBoss) {
                enemy.frozen = true;
            } else {
                // 通常敵：BGまたはFGレイヤーにブロック（material）がある場合はfrozen
                const ex = Math.floor(enemy.x);
                const ey = Math.floor(enemy.y);
                const stage = this.stageData;
                let isCovered = false;

                // Helper to check if a tile is a blocking material (with collision)
                const isBlock = (tileId) => {
                    if (tileId === undefined || tileId < 0) return false;
                    const { template } = getTemplateFromTileId(tileId);
                    // materialタイプで当たり判定ありの場合のみブロックとみなす
                    if (template && template.type === 'material') {
                        // collision が false でない場合は当たり判定あり
                        return template.config?.collision !== false;
                    }
                    // テンプレートがない場合（ただのタイル）は当たり判定なしとみなす
                    return false;
                };

                // Check BG
                if (stage.layers.bg && isBlock(stage.layers.bg[ey]?.[ex])) {
                    isCovered = true;
                }

                // Check FG (only if material, do not freeze if covered by item)
                if (!isCovered && stage.layers.fg && isBlock(stage.layers.fg[ey]?.[ex])) {
                    isCovered = true;
                }

                if (isCovered) {
                    enemy.frozen = true;
                }
            }
        });

        // プロジェクタイルとアイテムをリセット
        this.projectiles = [];
        this.items = [];
        this.particles = []; // パーティクルシステム
        this.breakableTiles = new Map(); // 耐久度管理 (key: "x,y", value: life)
        this.destroyedTiles = new Set(); // 破壊されたタイルの一時管理 (key: "x,y")

        // スコア初期化
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('pgk_highscore') || '0', 10);
        this.newHighScore = false; // 今回のプレイで更新したか

        // ゲームオーバー待機状態をリセット
        this.gameOverPending = false;
        this.gameOverWaitTimer = 0;

        // クリア条件関連
        this.isCleared = false;
        this.allEnemiesSpawned = true; // 初期状態では全敵がスポーン済みとみなす
        this.totalClearItems = 0; // クリアアイテム総数
        this.collectedClearItems = 0; // 取得済みクリアアイテム数

        // タイマー関連
        const timeLimit = stage.timeLimit || 0;
        this.remainingTime = timeLimit; // 残り時間（秒）
        this.frameCounter = 0; // フレームカウンター（60FPSで1秒）
        this.hasTimeLimit = timeLimit > 0;

        // ステージ上のアイテムを検索
        // 重複防止用のSet（座標をキーとして使用）
        const processedItemPositions = new Set();

        // 0. 変身アイテム（変身プレイヤーentity）を追加
        const processedTransformPositions = new Set();
        transformItemPositions.forEach(pos => {
            const posKey = `${Math.floor(pos.x)},${Math.floor(pos.y)}`;
            if (processedTransformPositions.has(posKey)) return;
            processedTransformPositions.add(posKey);
            processedItemPositions.add(posKey);
            const spriteIdx = pos.template.sprites?.transformItem?.frames?.[0]
                ?? pos.template.sprites?.idle?.frames?.[0]
                ?? pos.template.sprites?.main?.frames?.[0];
            this.items.push({
                x: pos.x,
                y: pos.y,
                width: 1,
                height: 1,
                template: pos.template,
                templateIdx: pos.templateIdx,
                spriteIdx: spriteIdx,
                itemType: 'transform',
                transformTarget: pos.templateIdx,
                collected: false
            });
        });

        // 1. Entities配列から（優先）
        if (stage.entities) {
            stage.entities.forEach(ent => {
                const template = templates[ent.templateId];
                if (template && template.type === 'item') {
                    const spriteIdx = template.sprites?.idle?.frames?.[0] ?? template.sprites?.main?.frames?.[0];
                    const itemType = template.config?.itemType || 'coin';

                    // 座標をキーとして記録
                    const posKey = `${Math.floor(ent.x)},${Math.floor(ent.y)}`;
                    processedItemPositions.add(posKey);

                    this.items.push({
                        x: ent.x,
                        y: ent.y,
                        width: 1,
                        height: 1,
                        template: template,
                        templateIdx: ent.templateId,
                        spriteIdx: spriteIdx,
                        itemType: itemType,
                        collected: false
                    });
                    // クリア条件アイテムカウント
                    if (itemType === 'clear') {
                        this.totalClearItems++;
                    }
                }
            });
        }

        // 2. layers.fgから（エンティティで未処理の位置のみ）
        if (stage && stage.layers && stage.layers.fg) {
            for (let y = 0; y < stage.height; y++) {
                for (let x = 0; x < stage.width; x++) {
                    const posKey = `${x},${y}`;
                    // 既にentitiesで処理済みならスキップ
                    if (processedItemPositions.has(posKey)) {
                        continue;
                    }

                    const tileId = stage.layers.fg[y][x];
                    if (tileId >= 0) {
                        const { template, templateIdx } = getTemplateFromTileId(tileId);
                        if (template && template.type === 'item') {
                            const spriteIdx = template.sprites?.idle?.frames?.[0] ?? template.sprites?.main?.frames?.[0];
                            const itemType = template.config?.itemType || 'coin';
                            this.items.push({
                                x: x,
                                y: y,
                                width: 1,
                                height: 1,
                                template: template,
                                templateIdx: templateIdx,
                                spriteIdx: spriteIdx,
                                itemType: itemType,
                                collected: false
                            });
                            // クリアアイテムをカウント
                            if (itemType === 'clear') {
                                this.totalClearItems++;
                            }
                        }
                    }
                }
            }
        }
        // はしごタイル初期化（ギミックブロック初期化より前に実行）
        this.ladderTiles = new Set();
        if (stage && stage.layers && stage.layers.fg) {
            for (let y = 0; y < stage.height; y++) {
                for (let x = 0; x < stage.width; x++) {
                    const tileId = stage.layers.fg[y][x];
                    if (tileId >= 0) {
                        const { template: tmpl } = getTemplateFromTileId(tileId);
                        if (tmpl && tmpl.type === 'material' && tmpl.config?.gimmick === 'ladder') {
                            this.ladderTiles.add(`${x},${y}`);
                        }
                    }
                }
            }
        }
        console.log('ladderTiles:', this.ladderTiles.size);

        // とびらタイル初期化（スプライトデータも保存）
        this.doorTiles = new Map();
        this.doorFlashTiles = [];
        if (stage && stage.layers && stage.layers.fg) {
            for (let y = 0; y < stage.height; y++) {
                for (let x = 0; x < stage.width; x++) {
                    const tileId = stage.layers.fg[y][x];
                    if (tileId >= 0) {
                        const { template: tmpl } = getTemplateFromTileId(tileId);
                        if (tmpl && tmpl.type === 'material' && tmpl.config?.gimmick === 'door') {
                            // スプライトデータを取得して保存
                            const spriteIdx = tmpl.sprites?.main?.frames?.[0] ?? tmpl.sprites?.idle?.frames?.[0];
                            const spriteData = spriteIdx !== undefined ? App.projectData.sprites[spriteIdx] : null;
                            this.doorTiles.set(`${x},${y}`, { spriteData });
                        }
                    }
                }
            }
        }
        console.log('doorTiles:', this.doorTiles.size);

        // スプリングタイル初期化
        this.springTiles = new Map();
        if (stage && stage.layers && stage.layers.fg) {
            for (let y = 0; y < stage.height; y++) {
                for (let x = 0; x < stage.width; x++) {
                    const tileId = stage.layers.fg[y][x];
                    if (tileId >= 0) {
                        const { template: tmpl } = getTemplateFromTileId(tileId);
                        if (tmpl && tmpl.type === 'material' && tmpl.config?.gimmick === 'spring') {
                            const power = tmpl.config.springPower ?? 3;
                            this.springTiles.set(`${x},${y}`, { power: power });
                        }
                    }
                }
            }
        }
        console.log('springTiles:', this.springTiles.size);

        // ギミックブロック初期化（はしご、とびら、スプリングは除外）
        this.gimmickBlocks = [];
        if (stage && stage.layers && stage.layers.fg) {
            for (let y = 0; y < stage.height; y++) {
                for (let x = 0; x < stage.width; x++) {
                    const tileId = stage.layers.fg[y][x];
                    if (tileId >= 0) {
                        const { template, templateIdx } = getTemplateFromTileId(tileId);
                        if (template && template.type === 'material' && template.config?.gimmick && template.config.gimmick !== 'none' && template.config.gimmick !== 'ladder' && template.config.gimmick !== 'door' && template.config.gimmick !== 'spring') {
                            this.gimmickBlocks.push({
                                tileX: x,
                                tileY: y,
                                x: x,
                                y: y,
                                tileId: tileId,
                                template: template,
                                templateIdx: templateIdx,
                                gimmick: template.config.gimmick,
                                vx: template.config.gimmick === 'moveH' ? 0.02 : 0,
                                vy: template.config.gimmick === 'moveV' ? 0.02 : 0,
                                state: 'normal',
                                timer: 0
                            });
                            // 実行用ステージデータから元タイルを削除（二重当たり判定防止）
                            stage.layers.fg[y][x] = -1;
                            console.log(`Gimmick block initialized at ${x},${y}. Original tile cleared.`);
                        }
                    }
                }
            }
        }

        // デバッグログ
        console.log('=== Game Initialized ===');
        console.log('totalClearItems:', this.totalClearItems);
        console.log('items array length:', this.items.length);
        console.log('gimmickBlocks:', this.gimmickBlocks.length);
        console.log('All items detail:');
        this.items.forEach((item, idx) => {
            console.log(`  [${idx}] x=${item.x}, y=${item.y}, type=${item.itemType}, template=${item.template?.name}, easterMessage=${item.template?.config?.easterMessage}`);
        });
        console.log('processedItemPositions:', [...processedItemPositions]);
    },

    gameLoop() {
        if (!this.isRunning) return;

        // ワイプ演出中
        if (this.titleState === 'wipe') {
            this.wipeTimer++;
            if (this.wipeTimer >= 30) {
                this.titleState = 'playing';
                this.playBgm('stage'); // ステージBGM開始
            }
            this.renderer.renderWipe();
            this.animationId = requestAnimationFrame(() => this.gameLoop());
            return;
        }

        // STAGE CLEAR演出中
        if (this.titleState === 'clear') {
            this.clearTimer++;

            // プレイヤーの喜びジャンプ（最初の30フレームで発動）
            if (this.player && this.clearTimer === 1) {
                this.player.startJoyJump();
            }

            // プレイヤーのジャンプ更新（重力と位置のみ）
            if (this.player) {
                this.player.updateJoyJump();
            }

            // ゲーム画面を描画（敵やアイテムは静止）
            this.renderer.render();

            // STAGE CLEARテキストと暗転エフェクト
            this.renderer.renderClearEffect();

            // フェーズ終了: 210フレーム後にリザルトへ（クリエイターモードはSTAGE CLEAR表示後、リザルトをスキップしてPUSH STARTへ）
            if (this.clearTimer >= 210) {
                const app = (typeof window !== 'undefined' && window.App) || (typeof App !== 'undefined' && App);
                if (app && !app.isPlayOnlyMode) {
                    this.stop();
                    this.hasStarted = false;
                    this.titleState = 'title';
                    this.clearTimer = 0;
                    const overlay = document.getElementById('result-overlay');
                    if (overlay) overlay.classList.add('hidden');
                    app.switchScreen('play');
                    if (typeof GameEngine !== 'undefined') GameEngine.showPreview();
                    document.querySelectorAll('#toolbar-nav .toolbar-icon').forEach(b => b.classList.remove('active-nav'));
                    const navPlayBtn = document.getElementById('nav-play-btn');
                    if (navPlayBtn) navPlayBtn.classList.add('active-nav');
                    return;
                }
                this.titleState = 'result';
                this.renderer.renderResultScreen();
                return;
            }

            this.animationId = requestAnimationFrame(() => this.gameLoop());
            return;
        }

        // GAME OVER演出中（ワイプ閉じ→GAME OVER→PUSH START）
        if (this.titleState === 'gameover') {
            this.gameOverTimer++;

            // フェーズ1: 閉じるワイプ（0-30フレーム）
            if (this.gameOverTimer <= 30) {
                this.renderer.renderCloseWipe();
            }
            // フェーズ2: GAME OVER表示（30-150フレーム）
            else if (this.gameOverTimer <= 150) {
                this.renderer.renderGameOverText();
            }
            // フェーズ3: リザルトへ（クリエイターモードはGAME OVER表示後、リザルトをスキップしてPUSH STARTへ）
            else {
                const app = (typeof window !== 'undefined' && window.App) || (typeof App !== 'undefined' && App);
                if (app && !app.isPlayOnlyMode) {
                    this.stop();
                    this.hasStarted = false;
                    this.titleState = 'title';
                    this.gameOverTimer = 0;
                    this.gameOverPending = false;
                    const overlay = document.getElementById('result-overlay');
                    if (overlay) overlay.classList.add('hidden');
                    app.switchScreen('play');
                    if (typeof GameEngine !== 'undefined') GameEngine.showPreview();
                    document.querySelectorAll('#toolbar-nav .toolbar-icon').forEach(b => b.classList.remove('active-nav'));
                    const navPlayBtn = document.getElementById('nav-play-btn');
                    if (navPlayBtn) navPlayBtn.classList.add('active-nav');
                    return;
                }
                this.titleState = 'result';
                this.renderer.renderResultScreen(); // DOM表示
                // リザルト中はループ停止（またはresultステートでループ継続して描画のみ？）
                // ここではループを継続させて、resultステート処理に任せる
                this.animationId = requestAnimationFrame(() => this.gameLoop());
                return;
            }

            this.animationId = requestAnimationFrame(() => this.gameLoop());
            return;
        }

        // リザルト画面
        if (this.titleState === 'result') {
            // ゲーム画面は静止画として描画し続ける（背景）
            this.renderer.render();
            // 特に更新処理はなし（DOMオーバーレイ操作待ち）
            this.animationId = requestAnimationFrame(() => this.gameLoop());
            return;
        }

        // 一時停止中はupdateをスキップ（描画は続行）
        if (!this.isPaused && !this.doorAnimating) {
            this.update();
            // タイルアニメーションフレームカウンターを更新
            this.tileAnimationFrame++;

            // タイマー更新（playingの時のみ）
            if (this.titleState === 'playing' && this.hasTimeLimit && !this.isCleared) {
                this.frameCounter++;
                if (this.frameCounter >= 60) { // 60FPSで1秒
                    this.frameCounter = 0;
                    this.remainingTime--;

                    // タイムアウト処理
                    if (this.remainingTime <= 0) {
                        this.remainingTime = 0;
                        const clearCondition = App.projectData.stage.clearCondition || 'none';
                        if (clearCondition === 'survival') {
                            // サバイバルモード: 時間経過でクリア
                            // サバイバルモード: 時間経過でクリア
                            this.triggerClear();
                        } else {
                            // 通常モード: 時間切れでゲームオーバー
                            this.gameOverPending = true;
                            this.gameOverWaitTimer = 30;
                        }
                    }
                }
            }
        }
        this.renderer.render();

        // プレイヤー落下チェック（画面外に出たらゲームオーバーへ）
        if (this.titleState === 'playing' && this.player) {
            const stage = App.projectData.stage;
            const viewHeight = this.canvas.height / this.TILE_SIZE;
            const stageBottom = stage?.height ?? 16;
            const viewBottom = this.camera.y + viewHeight;
            const playerBottom = this.player.y + (this.player.height || 1);

            // ステージ下端より下、または画面下端より下に落ちたらGAME OVER（どちらか早い方で検出）
            const fellBelowStage = playerBottom > stageBottom + 2;
            const fellBelowView = playerBottom > viewBottom + 2;
            if (fellBelowStage || fellBelowView) {
                if (!this.gameOverPending) {
                    console.log('GAME OVER pending (Fell)! playerBottom:', playerBottom, 'stageBottom:', stageBottom, 'viewBottom:', viewBottom);
                    this.gameOverPending = true;
                    this.gameOverWaitTimer = 30; // 0.5秒間、画面外に完全に消えた状態を保ってからワイプ開始
                }
            }

            // 敵にやられて死亡し、その飛び上がり・落下演出が完了した場合のGAME OVER処理
            if (this.player && this.player.isDying && this.player.deathTimer > 120) {
                if (!this.gameOverPending) {
                    console.log('GAME OVER pending (Died)! timer:', this.player.deathTimer);
                    this.gameOverPending = true;
                    this.gameOverWaitTimer = 0; // ただちにワイプ開始
                }
            }
        }

        // ゲームオーバー待機タイマー処理
        if (this.gameOverPending && this.titleState === 'playing') {
            this.gameOverWaitTimer--;
            if (this.gameOverWaitTimer <= 0) {
                console.log('GAME OVER triggered!');
                this.titleState = 'gameover';
                this.gameOverTimer = 0;
                this.gameOverPending = false;
                this.playBgm('gameover', false); // ゲームオーバーBGM（ループなし）
            }
        }

        this.animationId = requestAnimationFrame(() => this.gameLoop());
    },

    // イースターエッグメッセージを表示
    showEasterMessage(message) {
        this.easterMessage = message;
        this.easterMessageActive = true;
        this.isPaused = true; // ゲームを一時停止
    },

    // イースターエッグメッセージを閉じる
    closeEasterMessage() {
        this.easterMessageActive = false;
        this.easterMessage = null;
        this.isPaused = false; // ゲームを再開
    },

    update() {
        // ボス演出シーケンス処理（BGM演出のみ、ゲームは止めない）
        if (this.bossSequencePhase) {
            this.bossSequenceTimer++;
            if (this.bossSequencePhase === 'fadeout') {
                // フェードアウト（約1秒=60フレーム）
                if (this.bossSequenceTimer >= 60) {
                    this.stopBgm();
                    this.bossSequencePhase = 'silence';
                    this.bossSequenceTimer = 0;
                }
            } else if (this.bossSequencePhase === 'silence') {
                // 無音（1秒=60フレーム）
                if (this.bossSequenceTimer >= 60) {
                    this.playBgm('boss');
                    this.bossSequencePhase = null;
                    this.bossSequenceTimer = 0;
                    // ボスの動きを解禁
                    if (this.bossEnemy) {
                        this.bossEnemy.frozen = false;
                    }
                }
            }
            // ゲーム更新はreturnせず継続する
        }

        // ボス撃破シーケンス処理
        if (this.bossDefeatPhase) {
            this.bossDefeatTimer++;
            if (this.bossDefeatPhase === 'silence') {
                // 無音（1秒=60フレーム）
                if (this.bossDefeatTimer >= 60) {
                    this.bossDefeatPhase = 'waitfall';
                    this.bossDefeatTimer = 0;
                }
            } else if (this.bossDefeatPhase === 'waitfall') {
                // ボスが落ちるのを待つ（deathTimer > 120 または画面外に落下）
                const bossFallen = !this.bossEnemy ||
                    this.bossEnemy.deathTimer > 120 ||
                    this.bossEnemy.y > App.projectData.stage.height + 5;
                if (bossFallen) {
                    this.bossDefeatPhase = null;
                    this.bossDefeatTimer = 0;
                    this.triggerClear(); // クリアシーケンス開始（内部でクリアBGM再生）
                }
            }
            // プレイヤーと敵を更新（落下演出のため）
            if (this.player) {
                this.player.update(this);
                const viewWidth = this.canvas.width / this.TILE_SIZE;
                const viewHeight = this.canvas.height / this.TILE_SIZE;
                this.camera.x = this.player.x - viewWidth / 2 + 0.5;
                this.camera.y = this.player.y - viewHeight / 2 + 0.5;
                const stage = App.projectData.stage;
                this.camera.x = Math.max(0, Math.min(this.camera.x, stage.width - viewWidth));
                this.camera.y = Math.max(0, Math.min(this.camera.y, stage.height - viewHeight));
            }
            // ボスの落下アニメーション更新
            this.enemies.forEach(enemy => enemy.update(this));
            this.updateItems();
            return;
        }

        if (this.isPaused) return;

        // メイン更新ループ
        this.tileAnimationFrame++;

        // ボス出現・撃破管理
        // 1. 中ボス撃破判定（ボス撃破シーケンス中でない時）
        if (this.bossEnemy && this.bossEnemy.isDying && !this.bossDefeatPhase) {
            // 他にボスが残っているか？
            const remainingBosses = this.enemies.filter(e =>
                e.template?.config?.isBoss && !e.isDying && e !== this.bossEnemy
            );

            if (remainingBosses.length > 0) {
                // 中ボス撃破：BGMをステージ曲に戻す
                console.log('Intermediate boss defeated.');
                this.bossEnemy = null; // ボス戦状態解除
                this.bossSpawned = false; // 次のボス用に出現フラグリセット
                this.playBgm('stage');
            } else {
                // 最後のボスは checkClearCondition で処理されるためここでは何もしない
            }
        }

        // 2. ボス出現検知（まだスポーンしていない場合のみ）
        if (!this.bossSpawned && !this.bossEnemy) {
            // 画面内にいて、まだ死んでいないfrozen状態のボスを探す
            const viewWidth = this.canvas.width / this.TILE_SIZE;
            const viewHeight = this.canvas.height / this.TILE_SIZE;

            const nextBoss = this.enemies.find(e =>
                e.template?.config?.isBoss &&
                e.frozen &&
                !e.isDying &&
                e.x >= this.camera.x && e.x < this.camera.x + viewWidth &&
                e.y >= this.camera.y && e.y < this.camera.y + viewHeight
            );

            if (nextBoss) {
                // ボス出現！BGMシーケンス開始
                console.log('Boss encountered!');
                this.bossEnemy = nextBoss;
                this.bossSpawned = true;
                this.bossSequencePhase = 'fadeout';
                this.bossSequenceTimer = 0;
            }
        }

        if (this.player) {
            this.player.update(this);

            // カメラをプレイヤー中心に
            // ビューのタイル数を計算（スケール適用済みTILE_SIZEを使用）
            const viewWidth = this.canvas.width / this.TILE_SIZE;
            const viewHeight = this.canvas.height / this.TILE_SIZE;

            this.camera.x = this.player.x - viewWidth / 2 + 0.5;
            this.camera.y = this.player.y - viewHeight / 2 + 0.5;

            // カメラ範囲制限
            const stage = this.stageData || App.projectData.stage;
            this.camera.x = Math.max(0, Math.min(this.camera.x, stage.width - viewWidth));
            this.camera.y = Math.max(0, Math.min(this.camera.y, stage.height - viewHeight));
        }

        this.enemies.forEach(enemy => enemy.update(this));

        // プロジェクタイル更新
        this.updateProjectiles();

        // パーティクル更新
        this.renderer.updateParticles();

        // アイテム更新（衝突判定含む）
        this.updateItems();

        // ギミックブロック更新
        this.updateGimmickBlocks();

        this.physics.checkCollisions();
        this.checkClearCondition();
    },

    updateItems() {
        this.items.forEach(item => {
            if (item.collected) return;

            // ドロップアイテムには重力を適用
            if (item.isDropped) {
                item.vy = (item.vy || 0) + 0.02; // 重力
                if (item.vy > 0.4) item.vy = 0.4; // 最大落下速度

                item.y += item.vy;

                // 着地判定
                const footY = Math.floor(item.y + item.height);
                const tileX = Math.floor(item.x + item.width / 2);
                if (this.physics.getCollision(tileX, footY) === 1) {
                    item.y = footY - item.height;
                    item.vy = 0;
                }
            }

            // プレイヤーとの当たり判定
            if (this.player && !this.player.isDead && !item.collected) {
                // イースターエッグウィンドウが表示中は収集しない
                if (this.easterMessageActive) return;

                if (this.physics.projectileHits(item, this.player)) {
                    console.log(`>>> Collecting item: type=${item.itemType}, easterMessage=${item.template?.config?.easterMessage}`);
                    item.collected = true;

                    // イースターエッグの場合はメッセージウィンドウを表示
                    if (item.itemType === 'easter') {
                        console.log('>>> Easter egg detected! Showing message window');
                        const message = item.template?.config?.easterMessage || 'ひみつのメッセージ';
                        console.log('>>> Easter message:', message);
                        this.showEasterMessage(message);
                        // アイテムゲット音を鳴らす
                        this.player.playSE('itemGet');
                        return;
                    }

                    // ボム: 画面上の全敵に1ダメージ＋爆発音
                    if (item.itemType === 'bomb') {
                        this.physics.damageAllEnemiesOnScreen(1);
                        if (typeof NesAudio !== 'undefined') NesAudio.playSE('explosion');
                    }
                    // 変身: プレイヤー設定を切り替え
                    if (item.itemType === 'transform') {
                        this.player.transform(item.transformTarget);
                    } else {
                        this.player.collectItem(item.itemType);
                    }
                    // クリアアイテムカウント
                    if (item.itemType === 'clear') {
                        this.collectedClearItems = (this.collectedClearItems || 0) + 1;
                    }

                    // スコア加算
                    let pts = 100;
                    if (item.itemType === 'coin') pts = 50;
                    if (item.itemType === 'star' || item.itemType === 'muteki') pts = 500;
                    if (item.itemType === 'weapon') pts = 200;
                    if (item.itemType === 'bomb') pts = 100;
                    if (item.itemType === 'transform') pts = 200;
                    if (item.itemType === 'key') pts = 50;
                    if (item.itemType === 'clear') pts = 1000;
                    this.addScore(pts);
                }
            }
        });

        // とびらチェック（カギ所持時）
        this.physics.checkDoorInteraction();
    },

    updateProjectiles() {
        this.projectiles = this.projectiles.filter(proj => {
            if (proj.age === undefined) proj.age = 0;
            proj.age++;
            const shotType = proj.shotType || 'straight';

            // 寿命(duration)があれば減少
            if (proj.duration !== undefined) {
                proj.duration--;
                if (proj.duration <= 0) return false;
            }

            // タイプ別の移動処理
            switch (shotType) {
                case 'arc':
                    // やまなり: 重力影響
                    proj.x += proj.vx;
                    proj.vy += 0.01; // 重力
                    proj.y += proj.vy;
                    break;
                case 'drop':
                    // 鳥のフン: 真下に落下
                    proj.y += proj.vy;
                    break;
                case 'boomerang':
                    // ブーメラン: 3タイルで戻る
                    proj.x += proj.vx;
                    proj.y += proj.vy;
                    const boomerangDist = Math.abs(proj.x - proj.startX);
                    if (!proj.returning && boomerangDist >= 3) {
                        proj.returning = true;
                        proj.vx = -proj.vx;
                    }
                    // 戻ってきたら消える
                    if (proj.returning && boomerangDist < 0.5) {
                        return false;
                    }
                    break;
                case 'pinball':
                    // ピンポン: 壁で反射
                    proj.x += proj.vx;
                    proj.y += proj.vy;
                    break;
                case 'melee':
                    // 近接: オーナー（プレイヤー/敵）に追従
                    if (proj.owner === 'player' && this.player) {
                        proj.x = this.player.x + (this.player.facingRight ? this.player.width : -1);
                        proj.y = this.player.y + this.player.height / 2 - 0.5;
                        proj.facingRight = this.player.facingRight;
                    } else if (proj.owner === 'enemy' && proj.ownerEnemy) {
                        proj.x = proj.ownerEnemy.x + (proj.ownerEnemy.facingRight ? proj.ownerEnemy.width : -1);
                        proj.y = proj.ownerEnemy.y + proj.ownerEnemy.height / 2 - 0.5;
                        proj.facingRight = proj.ownerEnemy.facingRight;
                    }
                    break;
                case 'orbit':
                    // 回転: オーナーの周りを半径2タイルで時計回りに周回
                    {
                        let ownerX, ownerY;
                        if (proj.owner === 'player' && this.player) {
                            ownerX = this.player.x + this.player.width / 2;
                            ownerY = this.player.y + this.player.height / 2;
                        } else if (proj.owner === 'enemy' && proj.ownerEnemy) {
                            ownerX = proj.ownerEnemy.x + proj.ownerEnemy.width / 2;
                            ownerY = proj.ownerEnemy.y + proj.ownerEnemy.height / 2;
                        } else {
                            ownerX = proj.startX + 0.5;
                            ownerY = proj.startY + 0.5;
                        }
                        const orbitRadius = 2.0;
                        const orbitSpeed = 0.05; // ラジアン/フレーム
                        if (proj.orbitAngle === undefined) proj.orbitAngle = 0;
                        proj.orbitAngle += orbitSpeed;
                        proj.x = ownerX + Math.cos(proj.orbitAngle) * orbitRadius - 0.5;
                        proj.y = ownerY + Math.sin(proj.orbitAngle) * orbitRadius - 0.5;
                    }
                    break;
                default:
                    // straight, spread: 通常移動
                    proj.x += proj.vx;
                    proj.y += proj.vy;
            }

            // 飛距離チェック（ブーメラン・近接・回転以外）
            if (shotType !== 'boomerang' && shotType !== 'melee' && shotType !== 'orbit') {
                const dx = proj.x - proj.startX;
                const dy = proj.y - (proj.startY ?? proj.startX);
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance >= proj.maxRange) {
                    return false;
                }
            }

            const cx = 0.5;
            const cy = 0.5;

            // 壁との衝突（近接・回転はブロックを貫通）
            if (shotType !== 'melee' && shotType !== 'orbit' && this.physics.getCollision(Math.floor(proj.x + cx), Math.floor(proj.y + cy))) {
                if (shotType === 'pinball' && proj.bounceCount < 4) {
                    // ピンポン: 反射
                    const tileX = Math.floor(proj.x + cx);
                    const tileY = Math.floor(proj.y + cy);
                    const prevX = proj.x - proj.vx;
                    const prevY = proj.y - proj.vy;

                    if (this.physics.getCollision(tileX, Math.floor(prevY + cy)) === 1) {
                        proj.vx = -proj.vx;
                    }
                    if (this.physics.getCollision(Math.floor(prevX + cx), tileY) === 1) {
                        proj.vy = -proj.vy;
                    }
                    proj.bounceCount++;
                    proj.x += proj.vx;
                    proj.y += proj.vy;
                } else if (shotType === 'boomerang') {
                    // ブーメラン: 壁で反転
                    if (!proj.returning) {
                        proj.returning = true;
                        proj.vx = -proj.vx;
                    } else {
                        return false;
                    }
                } else {
                    // 通常: 壁に当たったら消滅
                    return false;
                }
            }

            // プレイヤーのSHOT → 敵との衝突
            if (proj.owner === 'player') {
                if (this.player && this.player.invincible && !this.player.starPower) {
                    // ダメージ無敵中はスキップ
                } else {
                    for (const enemy of this.enemies) {
                        if (enemy.frozen) continue; // フリーズ中（ボス出現等）は無敵
                        if (!enemy.isDying && this.physics.projectileHits(proj, enemy)) {
                            const fromRight = proj.vx > 0;
                            enemy.takeDamage(fromRight);
                            if (enemy.lives <= 0) {
                                this.addScore(100);
                            }
                            if (shotType !== 'pinball' && shotType !== 'boomerang' && shotType !== 'melee') {
                                return false;
                            }
                            // ピンポン・ブーメラン・近接は貫通（消えない）
                        }
                    }
                }
            }

            // 敵のSHOT → プレイヤーとの衝突
            if (proj.owner === 'enemy' && this.player && !this.player.isDead) {
                if (this.physics.projectileHits(proj, this.player)) {
                    const fromRight = proj.vx > 0;
                    this.player.takeDamage(fromRight);
                    if (shotType !== 'melee') {
                        return false;
                    }
                    // 近接は消えない（durationで消滅）
                }
            }

            // 画面外チェック（全プロジェクタイル共通。ステージサイズに基づく）
            const stageWidth = this.stageData ? this.stageData.width : App.projectData.stage.width;
            const stageHeight = this.stageData ? this.stageData.height : App.projectData.stage.height;
            if (proj.y > stageHeight + 5 || proj.y < -5 || proj.x < -5 || proj.x > stageWidth + 5) {
                return false;
            }

            return true;
        });
    },

    projectileHits(proj, target) {
        return proj.x < target.x + target.width &&
            proj.x + proj.width > target.x &&
            proj.y < target.y + target.height &&
            proj.y + proj.height > target.y;
    },

    updateGimmickBlocks() {
        const stage = this.stageData || App.projectData.stage;
        if (!stage) return;

        this.gimmickBlocks = this.gimmickBlocks.filter(block => {
            const gimmick = block.gimmick;

            // 横移動
            if (gimmick === 'moveH') {
                block.x += block.vx;
                // 障害物チェック
                const nextTileX = block.vx > 0 ? Math.floor(block.x + 1) : Math.floor(block.x);
                if (nextTileX < 0 || nextTileX >= stage.width || this.physics.getCollision(nextTileX, Math.floor(block.y)) === 1) {
                    block.vx = -block.vx;
                    block.x += block.vx * 2;
                }
            }

            // 縦移動
            if (gimmick === 'moveV') {
                block.y += block.vy;
                // 障害物チェック
                const nextTileY = block.vy > 0 ? Math.floor(block.y + 1) : Math.floor(block.y);
                if (nextTileY < 0 || nextTileY >= stage.height || this.physics.getCollision(Math.floor(block.x), nextTileY) === 1) {
                    block.vy = -block.vy;
                    block.y += block.vy * 2;
                }
            }

            // 落下ブロック
            if (gimmick === 'fall') {
                // プレイヤーが上に乗っているかチェック
                if (block.state === 'normal' && this.player) {
                    const playerOnTop =
                        this.player.x + this.player.width > block.x &&
                        this.player.x < block.x + 1 &&
                        Math.abs((this.player.y + this.player.height) - block.y) < 0.15 &&
                        this.player.vy >= 0;
                    if (playerOnTop) {
                        block.state = 'triggered';
                        block.timer = 60; // 1秒待機
                    }
                }

                if (block.state === 'triggered') {
                    block.timer--;
                    if (block.timer <= 0) {
                        block.state = 'shaking';
                        block.timer = 30; // 0.5秒震える
                    }
                }

                if (block.state === 'shaking') {
                    block.timer--;
                    if (block.timer <= 0) {
                        block.state = 'falling';
                        block.vy = 0;
                    }
                }

                if (block.state === 'falling') {
                    block.vy += 0.02; // 重力
                    block.y += block.vy;
                    // 画面外で削除
                    if (block.y > stage.height + 5) {
                        return false;
                    }
                }
            }

            return true;
        });
    },

    // ========== GamePhysics への外部呼び出しラッパー ==========
    // player.js / enemy.js から engine.xxx() として呼ばれるため薄いラッパーを残す

    getCollision(x, y)                        { return this.physics.getCollision(x, y); },
    isOnLadder(x, y, width, height)           { return this.physics.isOnLadder(x, y, width, height); },
    isAtLadderTop(x, y, width, height)        { return this.physics.isAtLadderTop(x, y, width, height); },
    damageTile(tileX, tileY)                  { return this.physics.damageTile(tileX, tileY); },

    checkClearCondition() {
        if (this.isCleared) return;
        if (!this.player) return;

        const stage = App.projectData.stage;
        const clearCondition = stage.clearCondition || 'none';

        switch (clearCondition) {
            case 'item':
                // CLEARアイテムを全て取得したらクリア
                if (this.collectedClearItems >= this.totalClearItems && this.totalClearItems > 0) {
                    this.triggerClear();
                }
                break;

            case 'enemies':
                // すべての敵を倒したらクリア
                if (this.enemies.length === 0 && this.allEnemiesSpawned) {
                    this.triggerClear();
                }
                break;

            case 'boss':
                // 全てのボスを倒したらクリア（複数ボス対応）
                // 生存中のボス（isDyingでない）をカウント
                const aliveBosses = this.enemies.filter(e =>
                    e.template?.config?.isBoss && !e.isDying
                );
                const dyingBosses = this.enemies.filter(e =>
                    e.template?.config?.isBoss && e.isDying
                );

                // ボスが全て倒された（生存ボスがいない、かつ死亡演出中のボスがいる）
                if (aliveBosses.length === 0 && dyingBosses.length > 0 && !this.bossDefeatPhase) {
                    console.log('Last boss defeated! Starting defeat sequence.');
                    // 最後のボスを撃破演出用に記録
                    this.bossEnemy = dyingBosses[0];
                    // ボス撃破演出開始：BGM停止→1秒無音→ボス落下→クリアBGM
                    this.stopBgm();
                    this.bossDefeatPhase = 'silence';
                    this.bossDefeatTimer = 0;
                }
                break;

            case 'survival':
                // サバイバル時間経過でクリア（updateTimerで処理）
                break;

            case 'none':
            default:
                // 従来のゴールタイル方式（存在する場合）
                const objects = App.projectData.objects;
                const goal = objects.find(o => o.type === 'goal');
                if (goal && this.player) {
                    const tileX = Math.floor(this.player.x);
                    const tileY = Math.floor(this.player.y);
                    if (tileX === goal.x && tileY === goal.y) {
                        this.triggerClear();
                    }
                }
                break;
        }
    },

    triggerClear() {
        if (this.isCleared) return;
        this.isCleared = true;
        this.clearTimer = 0;
        this.titleState = 'clear';
        this.playBgm('clear', false); // クリアBGM開始（ループなし）

        // タイムボーナス
        const timeBonus = Math.floor(this.remainingTime) * 10;
        if (timeBonus > 0) {
            this.addScore(timeBonus);
        }
    },


    // ========== BGM再生（BgmPlayerに委譲） ==========
    playBgm(type, loop = true) {
        // 同じBGMが再生中なら何もしない
        if (this.currentBgmType === type && this.gameBgmPlayer && this.gameBgmPlayer.isPlaying) return;

        this.stopBgm();

        const stage = App.projectData.stage;
        const bgm = stage?.bgm || {};
        const songIdx = parseInt(bgm[type], 10);

        if (isNaN(songIdx) || songIdx < 0) return;

        const songs = App.projectData.songs || [];
        const song = songs[songIdx];
        if (!song) return;

        // BgmPlayerインスタンスを初期化
        if (!this.gameBgmPlayer) {
            this.gameBgmPlayer = new BgmPlayer();
        }
        this.gameBgmPlayer.init();
        this.gameBgmPlayer.resume();

        // ゲームBGM用マスターゲイン（SE対比で音量を下げる）
        if (!this.gameBgmPlayer.outputNode) {
            const ctx = this.gameBgmPlayer.audioCtx;
            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.65;
            masterGain.connect(ctx.destination);
            this.gameBgmPlayer.outputNode = masterGain;
        }

        const trackTypes = ['square', 'square', 'triangle', 'noise'];
        this.currentBgmType = type;

        // isPausedFnでゲームの一時停止と同期
        this.gameBgmPlayer.play(song, trackTypes, 0, null, loop, () => this.isPaused);
    },

    stopBgm() {
        if (this.gameBgmPlayer) {
            this.gameBgmPlayer.stop();
        }
        this.currentBgmType = null;
    },

    // ========== スコア管理 ==========
    addScore(points) {
        this.score += points;

        // ハイスコア更新
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.newHighScore = true;
            localStorage.setItem('pgk_highscore', this.highScore);
        }
    },

    // リザルト画面のイベント初期化（一度だけ呼ぶ）
    initResultEvents() {
        const shareBtn = document.getElementById('result-share-btn');
        const retryBtn = document.getElementById('result-retry-btn');
        const editBtn = document.getElementById('result-edit-btn');
        const overlay = document.getElementById('result-overlay');

        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                if (App.projectData) {
                    Share.openScoreDialog({
                        score: this.score,
                        title: App.projectData.meta?.name || App.currentProjectName || 'Game',
                        isNewRecord: this.newHighScore,
                        isClear: this.isCleared
                    });
                }
            });
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (overlay) overlay.classList.add('hidden');
                this.restart();
            });
        }

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                if (overlay) overlay.classList.add('hidden');
                this.stop();
                App.switchScreen('stage');
            });
        }

        const remixBtn = document.getElementById('result-remix-btn');
        if (remixBtn) {
            remixBtn.addEventListener('click', () => {
                if (overlay) overlay.classList.add('hidden');
                this.stop();

                // リミックス処理の実行
                if (App.projectData) {
                    App.isPlayOnlyMode = false;

                    // 原作者情報の待避（すでにoriginalAuthorがある場合は上書きしない）
                    if (!App.projectData.meta.originalAuthor) {
                        App.projectData.meta.originalAuthor = App.projectData.meta.author || 'Unknown';
                        App.projectData.meta.originalTitle = App.projectData.meta.name || 'Unknown';
                        App.projectData.meta.originalShareId = App.projectData.meta.shareId || App._sharedGameId || '';
                    }

                    // 現在の作者・IDリセット
                    App.projectData.meta.author = 'You';
                    App.projectData.meta.shareId = null;
                    App._sharedGameId = null;
                    App._likesCount = 0;
                    App._hasLikedThisSession = false;

                    // 新しいエディットキーを発行
                    App.projectData.meta.editKey = App.generateEditKey();

                    // UIロック解除と画面更新
                    App.unlockCreatorMode();
                    App.switchScreen('stage');

                    // ストレージに保存（タイトルはそのまま）
                    const name = App.projectData.meta.name || 'Game';
                    App.currentProjectName = name;

                    if (typeof Storage !== 'undefined') {
                        Storage.saveProject(name, App.projectData);
                        Storage.save('currentProject', App.projectData);
                    }
                    App.updateGameInfo();
                }
            });
        }

        const likeBtn = document.getElementById('result-like-btn');
        if (likeBtn) {
            likeBtn.addEventListener('click', async () => {
                const gameId = App._sharedGameId || App.projectData?.meta?.shareId;
                if (!gameId || likeBtn.classList.contains('liked') || App._hasLikedThisSession) return;

                likeBtn.classList.add('liked');
                likeBtn.disabled = true;
                App._hasLikedThisSession = true;
                const newCount = await Share.addLike(gameId);
                App._likesCount = newCount;
                App.updateLikesDisplay(newCount);
            });
        }
    },

};
