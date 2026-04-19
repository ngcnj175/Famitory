/**
 * PixelGameKit - メインアプリケーション
 */

// デフォルトSEリスト（createDefaultProject と migrateProjectData で共用）
const DEFAULT_SOUNDS = [
    { id: 0, name: 'ジャンプ_01', type: 'jump_01' },
    { id: 1, name: 'ジャンプ_02', type: 'jump_02' },
    { id: 2, name: 'ジャンプ_03', type: 'jump_03' },
    { id: 3, name: 'ジャンプ_04', type: 'jump_04' },
    { id: 4, name: 'ジャンプ_05', type: 'jump_05' },
    { id: 5, name: '攻撃_01', type: 'attack_01' },
    { id: 6, name: '攻撃_02', type: 'attack_02' },
    { id: 7, name: '攻撃_03', type: 'attack_03' },
    { id: 8, name: '攻撃_04', type: 'attack_04' },
    { id: 9, name: '攻撃_05', type: 'attack_05' },
    { id: 10, name: 'ダメージ_01', type: 'damage_01' },
    { id: 11, name: 'ダメージ_02', type: 'damage_02' },
    { id: 12, name: 'ダメージ_03', type: 'damage_03' },
    { id: 13, name: 'ダメージ_04', type: 'damage_04' },
    { id: 14, name: 'ダメージ_05', type: 'damage_05' },
    { id: 15, name: 'ゲット_01', type: 'itemGet_01' },
    { id: 16, name: 'ゲット_02', type: 'itemGet_02' },
    { id: 17, name: 'ゲット_03', type: 'itemGet_03' },
    { id: 18, name: 'ゲット_04', type: 'itemGet_04' },
    { id: 19, name: 'ゲット_05', type: 'itemGet_05' },
    { id: 20, name: 'その他_01(決定)', type: 'other_01' },
    { id: 21, name: 'その他_02(キャンセル)', type: 'other_02' },
    { id: 22, name: 'その他_03(カーソル)', type: 'other_03' },
    { id: 23, name: 'その他_04(ポーズ)', type: 'other_04' },
    { id: 24, name: 'その他_05(爆発)', type: 'other_05' }
];

// グローバル状態
const App = {
    currentScreen: 'play',
    projectData: null,
    isPlayOnlyMode: false, // 共有URL読み込み時はtrue（編集不可）

    // パレットプリセット
    PALETTE_PRESETS: {
        famitory: {
            name: 'ファミトリー',
            colors: [
                '#ffffff', '#bcbcbc', '#757575', '#000000',
                '#abe7ff', '#3CBCFC', '#0073ef', '#271b8f',
                '#d7cbff', '#a78Bfd', '#8300f3', '#47009f',
                '#FDADCA', '#FF77B7', '#EF217E', '#AB0058',
                '#FDC4AB', '#FD972B', '#E71B08', '#910E02',
                '#FFE7A3', '#FDD745', '#BA7400', '#7F4100',
                '#abf3bf', '#4fdf4B', '#00ab00', '#005100'
            ]
        },
        pastel: {
            name: 'パステル',
            colors: [
                '#FFB6C1', '#FFC0CB', '#FFD1DC', '#FFDAB9', '#FFE4B5', '#FFFACD', '#E0FFE0', '#98FB98',
                '#AFEEEE', '#B0E0E6', '#ADD8E6', '#E6E6FA', '#DDA0DD', '#D8BFD8', '#FFFFFF', '#000000'
            ]
        },
        famicom: {
            name: 'ファミコン',
            colors: [
                '#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000', '#881400',
                '#503000', '#007800', '#006800', '#005800', '#004058', '#000000', '#000000', '#000000',
                '#BCBCBC', '#0078F8', '#0058F8', '#6844FC', '#D800CC', '#E40058', '#F83800', '#E45C10',
                '#AC7C00', '#00B800', '#00A800', '#00A844', '#008888', '#000000', '#000000', '#000000',
                '#F8F8F8', '#3CBCFC', '#6888FC', '#9878F8', '#F878F8', '#F85898', '#F87858', '#FCA044',
                '#F8B800', '#B8F818', '#58D854', '#58F898', '#00E8D8', '#787878', '#000000', '#000000',
                '#FCFCFC', '#A4E4FC', '#B8B8F8', '#D8B8F8', '#F8B8F8', '#F8A4C0', '#F0D0B0', '#FCE0A8',
                '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8', '#00FCFC', '#D8D8D8'
            ]
        },
        gameboy: {
            name: 'ゲームボーイ',
            colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
        },
        mono: {
            name: 'モノクロ',
            colors: ['#000000', '#333333', '#555555', '#777777', '#999999', '#BBBBBB', '#DDDDDD', '#FFFFFF']
        }
    },

    // デフォルトパレット（パステル）
    nesPalette: null, // initで設定

    // エディットキー生成（8文字英数字）
    generateEditKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let key = '';
        for (let i = 0; i < 8; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    },

    // デフォルトプロジェクト
    createDefaultProject() {
        return {
            version: 1,
            meta: {
                name: 'NEW GAME',
                author: '',
                locked: false,
                createdAt: Date.now(),
                editKey: this.generateEditKey()
            },
            palette: this.nesPalette.slice(0, 16),
            sprites: [this.createEmptySprite()],
            stage: {
                name: '',
                width: 16,
                height: 16,
                bgColor: '#3CBCFC',
                transparentIndex: 0,
                bgm: {
                    stage: '',
                    invincible: '',
                    clear: '',
                    gameover: ''
                },
                clearCondition: 'none', // none, item, enemies, survival
                timeLimit: 0,
                showScore: true, // スコア表示（デフォルトON）
                layers: {
                    bg: this.create2DArray(16, 16, -1),
                    fg: this.create2DArray(16, 16, -1),
                    collision: this.create2DArray(16, 16, 0)
                }
            },
            objects: [
                { type: 'player', x: 2, y: 14, sprite: 0 }
            ],
            bgm: {
                bpm: 120,
                steps: 16,
                tracks: {
                    pulse1: [],
                    pulse2: [],
                    triangle: [],
                    noise: []
                }
            },
            sounds: DEFAULT_SOUNDS.map(s => ({ ...s }))
        };
    },

    createEmptySprite(size = 1) {
        const dimension = size === 2 ? 32 : 16;
        return {
            id: 0,
            name: 'sprite_0',
            data: this.create2DArray(dimension, dimension, -1),
            size: size  // 1 = 16x16, 2 = 32x32
        };
    },

    create2DArray(width, height, fillValue) {
        return Array(height).fill(null).map(() => Array(width).fill(fillValue));
    },

    // 初期化
    init() {
        console.log('FAMITORY initializing...');

        // デフォルトパレットをファミトリーに設定
        if (!this.nesPalette) {
            this.nesPalette = this.PALETTE_PRESETS.famitory.colors.slice();
        }

        this.registerServiceWorker();
        this.loadOrCreateProject();
        this.initMenu();
        this.checkUrlData();

        // 各エディタ初期化
        if (typeof SpriteEditor !== 'undefined') SpriteEditor.init();
        if (typeof StageEditor !== 'undefined') StageEditor.init();
        if (typeof SoundEditor !== 'undefined') SoundEditor.init();
        if (typeof GameEngine !== 'undefined') {
            GameEngine.init();
            GameEngine.initResultEvents(); // リザルト画面イベント初期化
        }
        if (typeof GameController !== 'undefined') GameController.init();

        // 初期画面表示
        this.switchScreen('play');

        // iOSドラッグスクロール防止（必要な場所以外）
        this.preventIOSScroll();

        // ビューポートスケーリング（クロスデバイス対応）
        this.adjustViewportScale();
        window.addEventListener('resize', () => this.adjustViewportScale());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.adjustViewportScale(), 100);
        });

        // レイアウト確定後にリサイズ再実行（初回読み込み時のタイミングずれ対策）
        setTimeout(() => this.refreshCurrentScreen(), 100);

        // PC向け：マウスドラッグでのスクロールを有効化
        this.enableDragScroll();

        // iOS/Safari向けのグローバルなAudioContext復帰処理（ユーザーインタラクション時に発火）
        const resumeAudioContexts = () => {
            if (typeof GameEngine !== 'undefined') {
                if (GameEngine.bgmAudioCtx && GameEngine.bgmAudioCtx.state === 'suspended') {
                    GameEngine.bgmAudioCtx.resume();
                }
                if (GameEngine.audioCtx && GameEngine.audioCtx.state === 'suspended') {
                    GameEngine.audioCtx.resume();
                }
            }
            if (typeof SoundEditor !== 'undefined' && SoundEditor.audioCtx && SoundEditor.audioCtx.state === 'suspended') {
                SoundEditor.audioCtx.resume();
            }
        };
        document.addEventListener('touchstart', resumeAudioContexts, { passive: true });
        document.addEventListener('mousedown', resumeAudioContexts);

        console.log('FAMITORY initialized!');
    },

    // ビューポートスケーリング（クロスデバイス対応）
    // 基準UIサイズを保ったまま、画面サイズに合わせて全体を拡大縮小する
    adjustViewportScale() {
        const app = document.getElementById('app');
        if (!app) return;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // 基準サイズ: iPhone 8/SE2 想定の幅と高さ
        const baseWidth = 375;
        const baseHeight = 667;

        // 幅か高さ、画面に収めるためにより小さい方の比率を選択
        const scaleX = screenWidth / baseWidth;
        const scaleY = screenHeight / baseHeight;
        const scale = Math.min(scaleX, scaleY);

        // PC等で大きくなりすぎないよう上限を設定
        const cappedScale = Math.min(scale, 2.5);
        this.viewportScale = cappedScale;

        // アプリコンテナの物理サイズを固定
        app.style.width = baseWidth + 'px';
        app.style.height = baseHeight + 'px';
        app.style.maxWidth = 'none';

        // CSS transformでスケーリング
        app.style.transform = `scale(${cappedScale})`;
        app.style.transformOrigin = 'top center';

        // bodyをセンタリング用に設定
        document.body.style.overflow = 'hidden';
        document.body.style.display = 'flex';
        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'center';
        document.body.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#000000' : '#ffffff';

        // 垂直方向の中央寄せ計算（marginTopを使用）
        const scaledHeight = baseHeight * cappedScale;
        if (scaledHeight < screenHeight) {
            const topMargin = (screenHeight - scaledHeight) / 2;
            app.style.marginTop = topMargin + 'px';
        } else {
            app.style.marginTop = '0';
        }

        console.log(`Viewport scaled to ${cappedScale.toFixed(2)} for ${screenWidth}x${screenHeight}`);
    },

    // iOSでのドラッグによる全画面スクロールを防止
    preventIOSScroll() {
        // 全てのtouchmoveをデフォルトで防止し、必要な要素のみ許可（ホワイトリスト方式）
        document.addEventListener('touchmove', (e) => {
            let target = e.target;

            // 許可する要素をチェック
            while (target && target !== document.body) {
                // 許可するタグ
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    return;
                }

                // 許可するクラス（ドラッグ操作が必要な要素）
                if (target.classList.contains('allow-scroll') ||
                    target.classList.contains('sb-box') ||
                    target.classList.contains('hue-slider') ||
                    target.classList.contains('game-dpad') ||
                    target.classList.contains('dpad-area')) {
                    return;
                }

                // 許可するID（特定の要素）
                const allowedIds = [
                    'sprite-canvas',
                    'stage-canvas',
                    'bgm-canvas',
                    'sprite-list',
                    'tile-list',
                    'paint-canvas', // 追加
                    'tile-config-panel',
                    'stage-settings-content',
                    'paint-tools',
                    'color-scroll-container',
                    'stage-tools'
                ];
                if (target.id && allowedIds.includes(target.id)) {
                    // スクロール可能な要素のみ許可
                    const style = window.getComputedStyle(target);
                    if (style.overflowY === 'auto' || style.overflowY === 'scroll' ||
                        style.overflowX === 'auto' || style.overflowX === 'scroll') {
                        return;
                    }
                    // canvasは許可
                    if (target.tagName === 'CANVAS') {
                        return;
                    }
                }

                // canvas要素は許可
                if (target.tagName === 'CANVAS') {
                    return;
                }

                target = target.parentElement;
            }

            // それ以外は全てスクロール防止
            e.preventDefault();
        }, { passive: false });
    },

    // PC向け：マウスドラッグでのスクロール（.gallery-scroll）
    enableDragScroll() {
        const sliders = document.querySelectorAll('.gallery-scroll');
        sliders.forEach(slider => {
            let isDown = false;
            let startX;
            let scrollLeft;
            let isDragging = false; // ドラッグ中かどうか（クリック誤爆防止用）

            // 初期カーソル
            slider.style.cursor = 'grab';

            slider.addEventListener('mousedown', (e) => {
                isDown = true;
                isDragging = false;
                startX = e.pageX - slider.offsetLeft;
                scrollLeft = slider.scrollLeft;
                slider.style.cursor = 'grabbing';
            });

            slider.addEventListener('mouseleave', () => {
                isDown = false;
                slider.style.cursor = 'grab';
            });

            slider.addEventListener('mouseup', () => {
                isDown = false;
                slider.style.cursor = 'grab';
                // ドラッグしていた場合はフラグを少し遅延させて下ろす（clickイベントで判定するため）
                if (isDragging) {
                    setTimeout(() => { isDragging = false; }, 100);
                }
            });

            slider.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - slider.offsetLeft;
                const scale = this.viewportScale || 1;
                const walk = (x - startX) / scale; // スケールを考慮して1:1に補正

                // 5px以上動いたらドラッグとみなす
                if (Math.abs(x - startX) > 5) {
                    isDragging = true;
                }

                slider.scrollLeft = scrollLeft - walk;
            });

            // ドラッグ中のクリックイベントを無効化（キャプチャフェーズで止める）
            slider.addEventListener('click', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);
        });
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('SW registered'))
                .catch(err => console.warn('SW registration failed:', err));
        }
    },

    loadOrCreateProject() {
        const saved = Storage.load('currentProject');
        if (saved) {
            this.projectData = saved;
            this.migrateProjectData(); // データ移行
            console.log('Project loaded from storage');
            // パレットを復元
            if (this.projectData.palette) {
                this.nesPalette = this.projectData.palette;
            }
        } else {
            this.projectData = this.createDefaultProject();
            console.log('New project created');
        }
    },

    async checkUrlData() {
        // ?g=xxx パラメータをチェック（Firebase短縮URL）
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('g');

        if (gameId) {
            console.log('Loading game from Firebase:', gameId);
            const data = await Share.loadGame(gameId);
            if (data) {
                this.projectData = data;
                this.migrateProjectData();
                this.isPlayOnlyMode = true;
                this._sharedGameId = gameId;
                this._hasLikedThisSession = false;
                console.log('Project loaded from Firebase (play-only mode)');
                if (this.projectData.palette) {
                    this.nesPalette = this.projectData.palette;
                }
                // history.replaceState(null, '', window.location.pathname);
                this.applyPlayOnlyMode();
                this.refreshCurrentScreen();
                this.fetchAndShowLikes(gameId);
            } else {
                console.warn('Failed to load game:', gameId);
            }
            return;
        }

        // 従来のハッシュ形式もサポート（後方互換）
        const hash = window.location.hash.slice(1);
        if (hash) {
            try {
                const data = Share.decode(hash);
                if (data) {
                    this.projectData = data;
                    this.isPlayOnlyMode = true;
                    this._hasLikedThisSession = false;
                    console.log('Project loaded from URL hash (play-only mode)');
                    if (this.projectData.palette) {
                        this.nesPalette = this.projectData.palette;
                    }
                    // history.replaceState(null, '', window.location.pathname);
                    this.applyPlayOnlyMode();
                }
            } catch (e) {
                console.warn('Failed to load from URL hash:', e);
            }
        }
    },

    // データ構造のマイグレーション（エンティティ分離）
    migrateProjectData() {
        // editKey がなければ自動生成（v2.8.8以前のデータ対応）
        if (this.projectData.meta && !this.projectData.meta.editKey) {
            this.projectData.meta.editKey = this.generateEditKey();
        }

        const stage = this.projectData.stage;
        if (!stage) return;

        // entities配列がなければ作成
        if (!stage.entities) {
            stage.entities = [];
        }

        const map = stage.map;
        const width = stage.width;
        const height = stage.height;

        // map配列が存在しない場合はスキップ
        if (!map || !Array.isArray(map)) return;

        // map配列からエンティティを探して移動
        for (let y = 0; y < height; y++) {
            if (!map[y]) continue; // 行が存在しない場合スキップ
            for (let x = 0; x < width; x++) {
                const tileId = map[y][x];
                // テンプレートID (100+)
                if (tileId >= 100) {
                    const tmplIdx = tileId - 100;
                    const tmpl = this.projectData.templates[tmplIdx];
                    if (tmpl && (tmpl.type === 'player' || tmpl.type === 'enemy' || tmpl.type === 'item')) {
                        // entitiesに追加
                        // 重複チェック（念のため）
                        const exists = stage.entities.some(e => e.x === x && e.y === y);
                        if (!exists) {
                            stage.entities.push({
                                x: x,
                                y: y,
                                templateId: tmplIdx
                            });
                        }
                        // mapからは消去（空気=0）
                        map[y][x] = 0;
                    }
                }
            }
        }

        // SEリストの拡張とマイグレーション
        if (this.projectData.sounds && this.projectData.sounds.length <= 5) {
            this.projectData.sounds = DEFAULT_SOUNDS.map(s => ({ ...s }));

            // 2. テンプレート設定のマイグレーション（IDの振り直し）
            if (this.projectData.templates) {
                const seMap = { 0: 0, 1: 5, 2: 10, 3: 15 };
                this.projectData.templates.forEach(tmpl => {
                    if (tmpl.type === 'player' && tmpl.config) {
                        ['seJump', 'seAttack', 'seDamage', 'seItemGet'].forEach(key => {
                            const oldVal = tmpl.config[key];
                            if (oldVal !== undefined && seMap[oldVal] !== undefined) {
                                tmpl.config[key] = seMap[oldVal];
                            }
                        });
                    }
                });
            }
        }
    },

    // プレイ専用モードのUI適用（ヘッダーはクリエイターと同じ配置、許可外はグレーアウト）
    applyPlayOnlyMode() {
        // ファイルツールバー: NEW のみ有効、OPEN / SAVE / SHARE はグレーアウト
        const lockedFileIds = ['load-icon-btn', 'save-icon-btn', 'share-icon-btn'];
        lockedFileIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.add('locked');
        });

        // ナビゲーション: PLAY のみ有効、PIXEL / STAGE / SONG はグレーアウト
        const lockedNavIds = ['nav-paint-btn', 'nav-stage-btn', 'nav-sound-btn'];
        lockedNavIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.add('locked');
        });
    },

    // グレーアウト解除（クリエイターモードへ移行）
    unlockCreatorMode() {
        this.isPlayOnlyMode = false;
        // 全ボタンの locked を解除
        document.querySelectorAll('.toolbar-icon.locked').forEach(btn => {
            btn.classList.remove('locked');
        });
        this.showToast(this.I18N['U354']?.[this.currentLang] || '編集モードに切り替わりました');
        // 現在の画面をリフレッシュ
        this.refreshCurrentScreen();
    },

    // エディットキー入力モーダルを表示
    showEditKeyModal() {
        const modal = document.getElementById('editkey-modal');
        const input = document.getElementById('editkey-input');
        const error = document.getElementById('editkey-error');
        if (!modal || !input) return;

        input.value = '';
        if (error) error.classList.add('hidden');
        modal.classList.remove('hidden');
        setTimeout(() => input.focus(), 100);
    },

    // エディットキー認証イベント初期化
    initEditKeyModal() {
        const modal = document.getElementById('editkey-modal');
        const input = document.getElementById('editkey-input');
        const okBtn = document.getElementById('editkey-ok');
        const cancelBtn = document.getElementById('editkey-cancel');
        const error = document.getElementById('editkey-error');
        if (!modal) return;

        const verify = () => {
            const inputKey = input?.value?.trim();
            const correctKey = this.projectData?.meta?.editKey;

            // editKeyが未設定（旧データ）の場合はそのまま解除
            if (!correctKey) {
                modal.classList.add('hidden');
                this.unlockCreatorMode();
                return;
            }

            if (inputKey === correctKey) {
                modal.classList.add('hidden');
                this.unlockCreatorMode();
            } else {
                if (error) error.classList.remove('hidden');
            }
        };

        okBtn?.addEventListener('click', verify);
        cancelBtn?.addEventListener('click', () => modal.classList.add('hidden'));
        // Enter キーでも認証
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') verify();
        });
        // 入力し直したらエラーメッセージを伏せる
        input?.addEventListener('input', () => {
            if (error) error.classList.add('hidden');
        });
        // 背景クリックで閉じる
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    },

    initMenu() {
        // 現在のプロジェクト名
        this.currentProjectName = null;

        // 新規プロジェクト（NEW）
        document.getElementById('new-icon-btn')?.addEventListener('click', () => {
            this.showNewGameModal();
        });

        // 開く（OPEN） -> プロジェクトリスト
        document.getElementById('load-icon-btn')?.addEventListener('click', () => {
            this.showSimpleProjectList();
        });

        // 保存（SAVE） - 長押し対応（プレイヤーモードではエディットキー入力モーダルを表示）
        const saveBtn = document.getElementById('save-icon-btn');
        if (saveBtn) {
            let pressTimer;
            const startPress = (e) => {
                // 右クリック等は無視
                if (e.type === 'mousedown' && e.button !== 0) return;
                // プレイヤーモード（locked）では長押しタイマーを開始しない
                if (saveBtn.classList.contains('locked')) return;

                pressTimer = setTimeout(() => {
                    pressTimer = null;
                    // 長押しイベント発生
                    this.showSaveAsModal();
                }, 800); // 800ms長押し
            };

            const cancelPress = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            const endPress = (e) => {
                // プレイヤーモードではエディットキー入力モーダルを表示（SAVEは実行しない）
                if (saveBtn.classList.contains('locked')) {
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                    }
                    this.showEditKeyModal();
                    return;
                }
                if (pressTimer) {
                    // タイマーが残っている＝短押し
                    clearTimeout(pressTimer);
                    pressTimer = null;
                    this.saveProject(); // 通常保存
                }
            };

            // マウスイベント
            saveBtn.addEventListener('mousedown', startPress);
            saveBtn.addEventListener('mouseup', endPress);
            saveBtn.addEventListener('mouseleave', cancelPress);

            // タッチイベント
            saveBtn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // クリックイベント重複防止
                startPress(e);
            }, { passive: false });
            saveBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                endPress(e);
            });
            saveBtn.addEventListener('touchcancel', cancelPress);
        }

        // 名前をつけて保存モーダル初期化
        this.initSaveAsModal();

        // 共有ボタン
        const shareBtn = document.getElementById('share-icon-btn');
        // 共有イベントは一度だけバインド
        this.bindShareSimpleEvents();
        shareBtn?.addEventListener('click', () => {
            this.projectData.palette = this.nesPalette.slice();
            this._shareLoading = false;

            // 既存の公開IDがあればURLをセット（ただし Firebase保存は行わない）
            const existingId = this.projectData?.meta?.shareId;
            this._shareUrl = existingId ? Share.createShortUrl(existingId) : null;

            // Remix OKのチェック状態復元
            const remixOkCheckbox = document.getElementById('share-remix-ok');
            if (remixOkCheckbox) {
                remixOkCheckbox.checked = !!this.projectData?.meta?.remixOK;
            }

            document.getElementById('share-dialog').classList.remove('hidden');
            this._updateShareStatus();
        });


        // ナビゲーション切り替え（グレーアウト時はエディットキーモーダルを表示）
        const screens = ['play', 'paint', 'stage', 'sound'];
        screens.forEach(screen => {
            const btn = document.getElementById(`nav-${screen}-btn`);
            btn?.addEventListener('click', () => {
                // グレーアウト中はエディットキーモーダルを表示
                if (btn.classList.contains('locked')) {
                    this.showEditKeyModal();
                    return;
                }
                this.switchScreen(screen);
                // アイコンのアクティブ状態更新
                document.querySelectorAll('#toolbar-nav .toolbar-icon').forEach(b => b.classList.remove('active-nav'));
                btn.classList.add('active-nav');
            });
        });

        // ファイルツールバーのグレーアウトボタンにもエディットキーモーダルを設定
        ['load-icon-btn', 'save-icon-btn', 'share-icon-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            // 既存のイベントの前にキャプチャフェーズで割り込み
            btn.addEventListener('click', (e) => {
                if (btn.classList.contains('locked')) {
                    e.stopImmediatePropagation();
                    this.showEditKeyModal();
                }
            }, true); // captureフェーズ
        });

        // エディットキーモーダル初期化
        this.initEditKeyModal();

        // タイトル・作成者名はPLAY画面では常に読み取り専用
        // （編集はゲーム設定パネルでのみ行う）

        // ローカライズボタン初期化
        this.initLangBtn();
    },

    updateGameInfo() {
        const titleInput = document.getElementById('game-title');
        const authorInput = document.getElementById('game-author');

        if (titleInput && this.projectData) {
            titleInput.value = this.projectData.meta.name || 'My Game';
            titleInput.readOnly = true;
            titleInput.style.cursor = 'default';
            titleInput.onclick = null;
        }
        if (authorInput && this.projectData) {
            authorInput.value = this.projectData.meta.author || 'You';
            authorInput.readOnly = true;
            authorInput.style.cursor = 'default';
            authorInput.onclick = null;
        }

        // shareIdがあればいいね数を取得・表示（モード問わず常に表示）
        const gid = this._sharedGameId || this.projectData?.meta?.shareId;
        if (gid) {
            this.fetchAndShowLikes(gid);
        } else {
            this.updateLikesDisplay(0);
        }

        // リミックス元（原作者）情報の表示（リミックス元がない場合は非表示、原作の行は空欄）
        const remixInfoDisplay = document.getElementById('game-remix-info');
        const origTitle = document.getElementById('game-original-title');
        const origAuthor = document.getElementById('game-original-author');

        const hasRemixSource = !!(this.projectData?.meta?.originalAuthor);
        if (remixInfoDisplay && origTitle && origAuthor && hasRemixSource) {
            origTitle.textContent = this.projectData.meta.originalTitle || 'Unknown';
            origAuthor.textContent = this.projectData.meta.originalAuthor;
            remixInfoDisplay.classList.remove('hidden');

            const origShareId = this.projectData.meta.originalShareId;
            const remixLinkWrap = document.getElementById('remix-link-wrap');
            if (origShareId && remixLinkWrap) {
                remixLinkWrap.onclick = () => {
                    const url = Share.createShortUrl(origShareId);
                    window.open(url, '_blank');
                };
            } else if (remixLinkWrap) {
                remixLinkWrap.onclick = null;
            }
        } else if (remixInfoDisplay) {
            remixInfoDisplay.classList.add('hidden');
        }
    },

    // テキスト編集ポップアップ（タイトル/作成者名共用）
    _textEditField: null,

    openTextEditPopup(field) {
        const popup = document.getElementById('text-edit-popup');
        const input = document.getElementById('text-edit-input');
        const title = document.getElementById('text-edit-popup-title');
        if (!popup || !input || !title) return;

        this._textEditField = field;

        if (field === 'title') {
            title.textContent = 'タイトル変更';
            input.value = this.projectData.meta.name || '';
            input.placeholder = 'ゲームタイトルを入力';
        } else {
            title.textContent = 'なまえ変更';
            input.value = this.projectData.meta.author || '';
            input.placeholder = 'なまえを入力';
        }

        popup.classList.remove('hidden');
        setTimeout(() => input.focus(), 100);

        // イベントバインド（毎回上書きで多重防止）
        document.getElementById('text-edit-save').onclick = () => this.saveTextEdit();
        document.getElementById('text-edit-cancel').onclick = () => this.closeTextEditPopup();
    },

    closeTextEditPopup() {
        const popup = document.getElementById('text-edit-popup');
        if (popup) popup.classList.add('hidden');
        this._textEditField = null;
    },

    saveTextEdit() {
        const input = document.getElementById('text-edit-input');
        if (!input) return;

        const newValue = input.value.trim().substring(0, 20);
        if (!newValue) {
            this.closeTextEditPopup();
            return;
        }

        if (this._textEditField === 'title') {
            this.projectData.meta.name = newValue;
            if (this.projectData.stage) {
                this.projectData.stage.name = newValue;
            }
        } else if (this._textEditField === 'author') {
            this.projectData.meta.author = newValue;
        }

        this.closeTextEditPopup();
        this.updateGameInfo();

        // ゲーム設定パネルの表示も同期
        if (typeof StageEditor !== 'undefined') {
            StageEditor.updateStageSettingsUI?.();
        }
    },

    // いいね数を取得してプレイ画面に表示
    async fetchAndShowLikes(gameId) {
        const count = await Share.getLikes(gameId);
        this._likesCount = count;
        this.updateLikesDisplay(count);
    },

    // いいね数の表示を更新（クリエイター／プレイヤー問わず表示）
    updateLikesDisplay(count) {
        const display = document.getElementById('game-likes-display');
        const countEl = document.getElementById('game-likes-count');
        if (!display || !countEl) return;

        // 常に表示する
        countEl.textContent = count;
        display.classList.remove('hidden');

        const resultCount = document.getElementById('result-like-count');
        if (resultCount) resultCount.textContent = count;
    },

    switchScreen(screenName) {
        // もしSoundEditorが再生中なら停止
        if (this.currentScreen === 'sound' && screenName !== 'sound') {
            if (typeof SoundEditor !== 'undefined' && SoundEditor.isPlaying) {
                SoundEditor.stop();
            }
        }

        this.currentScreen = screenName;

        // 画面切り替え
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.toggle('active', s.id === screenName + '-screen');
        });

        // ナビアイコンのアクティブ状態を同期（play/paint/stage/sound）
        const navBtn = document.getElementById(`nav-${screenName}-btn`);
        if (navBtn) {
            document.querySelectorAll('#toolbar-nav .toolbar-icon').forEach(b => b.classList.remove('active-nav'));
            navBtn.classList.add('active-nav');
        }

        // 各画面の初期化/更新
        this.refreshCurrentScreen();
    },

    refreshCurrentScreen() {
        switch (this.currentScreen) {
            case 'play':
                this.updateGameInfo();
                if (typeof GameEngine !== 'undefined') {
                    if (!GameEngine.isRunning || GameEngine.isPaused) {
                        GameEngine.showPreview();
                    } else {
                        GameEngine.resize();
                    }
                }
                break;
            case 'paint':
                if (typeof SpriteEditor !== 'undefined') {
                    SpriteEditor.refresh();
                }
                break;
            case 'stage':
                if (typeof StageEditor !== 'undefined') {
                    StageEditor.refresh();
                }
                break;
            case 'sound':
                if (typeof SoundEditor !== 'undefined') {
                    SoundEditor.refresh();
                }
                break;
        }
    },

    hasUnsavedChanges() {
        const savedData = Storage.load('currentProject');
        if (!savedData) return true;
        return JSON.stringify(savedData) !== JSON.stringify(this.projectData);
    },

    saveProject() {
        // パレット同期
        this.projectData.palette = this.nesPalette.slice();

        if (!this.currentProjectName) {
            this.currentProjectName = this.projectData.meta.name || 'MyGame';
        }

        // メタデータ更新
        this.projectData.meta.name = this.currentProjectName;
        this.projectData.meta.updatedAt = Date.now();

        // 内部ストレージへ保存
        Storage.saveProject(this.currentProjectName, this.projectData);
        Storage.save('currentProject', this.projectData);

        // 静かに通知
        this.showToast('セーブしました');
    },

    showToast(message) {
        // 特別なセーブトースト
        if (message === 'セーブしました') {
            const saveToast = document.getElementById('save-toast');
            if (saveToast) {
                saveToast.classList.add('visible');
                setTimeout(() => {
                    saveToast.classList.remove('visible');
                }, 1500);
                return;
            }
        }

        let toast = document.getElementById('app-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 16px;border-radius:20px;font-size:12px;opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:9999;';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 2000);
    },

    showThreeChoiceDialog(message, onSave, onNoSave, onCancel) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:white;padding:20px;border-radius:8px;text-align:center;max-width:300px;';

        const msg = document.createElement('p');
        msg.style.cssText = 'margin:0 0 20px 0;white-space:pre-line;font-size:14px;';
        msg.textContent = message;

        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = this.I18N['U005']?.[this.currentLang] || '保存する';
        saveBtn.style.cssText = 'padding:12px;border:none;background:#4a4a4a;color:white;border-radius:4px;cursor:pointer;font-size:14px;';

        const noSaveBtn = document.createElement('button');
        noSaveBtn.textContent = this.I18N['U435']?.[this.currentLang] || '保存しない';
        noSaveBtn.style.cssText = 'padding:12px;border:1px solid #4a4a4a;background:white;border-radius:4px;cursor:pointer;font-size:14px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = this.I18N['U105']?.[this.currentLang] || 'キャンセル';
        cancelBtn.style.cssText = 'padding:12px;border:1px solid #ccc;background:#f5f5f5;border-radius:4px;cursor:pointer;font-size:14px;';

        btnContainer.appendChild(saveBtn);
        btnContainer.appendChild(noSaveBtn);
        btnContainer.appendChild(cancelBtn);
        modal.appendChild(msg);
        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeModal = () => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        };

        saveBtn.addEventListener('click', () => { closeModal(); onSave(); });
        noSaveBtn.addEventListener('click', () => { closeModal(); onNoSave(); });
        cancelBtn.addEventListener('click', () => { closeModal(); onCancel(); });
    },

    // アクションメニュー（iOS風）
    showActionMenu(title, actions) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;z-index:9999;';

        const modal = document.createElement('div');
        modal.className = 'action-sheet';
        modal.style.cssText = 'background:transparent;width:95%;max-width:400px;margin-bottom:20px;display:flex;flex-direction:column;gap:8px;';

        // メニューグループ
        const menuGroup = document.createElement('div');
        menuGroup.style.cssText = 'background:rgba(255,255,255,0.9);backdrop-filter:blur(10px);border-radius:14px;overflow:hidden;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);';

        // タイトル
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.textContent = title;
            titleEl.style.cssText = 'padding:12px;text-align:center;font-size:13px;color:#888;border-bottom:1px solid rgba(0,0,0,0.1);font-weight:600;';
            menuGroup.appendChild(titleEl);
        }

        actions.forEach((action, index) => {
            if (action.style === 'cancel') return; // キャンセルは別枠

            const btn = document.createElement('button');
            btn.textContent = action.text;
            let btnStyle = 'width:100%;padding:16px;border:none;background:transparent;font-size:16px;color:#007aff;cursor:pointer;';

            if (action.style === 'destructive') {
                btnStyle += 'color:#ff3b30;';
            }
            if (index < actions.length - 1 && !(index === actions.length - 2 && actions[actions.length - 1].style === 'cancel')) {
                btnStyle += 'border-bottom:1px solid rgba(0,0,0,0.1);';
            }

            btn.style.cssText = btnStyle;
            btn.addEventListener('click', () => {
                closeModal();
                if (action.action) action.action();
            });
            menuGroup.appendChild(btn);
        });

        modal.appendChild(menuGroup);

        // キャンセルボタン
        const cancelAction = actions.find(a => a.style === 'cancel');
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelAction ? (cancelAction.text || this.I18N['U105']?.[this.currentLang] || 'キャンセル') : (this.I18N['U105']?.[this.currentLang] || 'キャンセル');
        cancelBtn.style.cssText = 'width:100%;padding:16px;border:none;background:rgba(255,255,255,0.9);backdrop-filter:blur(10px);border-radius:14px;font-size:16px;font-weight:600;color:#007aff;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.1);transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);';

        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (cancelAction && cancelAction.action) cancelAction.action();
        });

        modal.appendChild(cancelBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // アニメーション
        requestAnimationFrame(() => {
            menuGroup.style.transform = 'translateY(0)';
            cancelBtn.style.transform = 'translateY(0)';
        });

        const closeModal = () => {
            menuGroup.style.transform = 'translateY(100%)';
            cancelBtn.style.transform = 'translateY(100%)';
            overlay.style.transition = 'opacity 0.2s';
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            }, 300);
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    },

    /**
     * 汎用アラートダイアログ（カスタム版）
     */
    showAlert(message, subMessage, onOk) {
        const modal = document.getElementById('generic-confirm-modal');
        const msgEl = document.getElementById('generic-confirm-msg');
        const subEl = document.getElementById('generic-confirm-body');
        const okBtn = document.getElementById('generic-confirm-ok');
        const cancelBtn = document.getElementById('generic-confirm-cancel');

        if (!modal || !okBtn || !cancelBtn) {
            // フォールバック
            alert(message + (subMessage ? "\n" + subMessage : ""));
            if (onOk) onOk();
            return;
        }

        msgEl.textContent = message;
        subEl.textContent = subMessage || '';
        modal.classList.remove('hidden');

        // OKのみ表示にするためキャンセルを隠す
        cancelBtn.classList.add('hidden');

        const close = () => {
            modal.classList.add('hidden');
            cancelBtn.classList.remove('hidden'); // 次回のために戻す
            okBtn.onclick = null;
            modal.onclick = null;
        };

        okBtn.onclick = () => { close(); if (onOk) onOk(); };
        modal.onclick = (e) => { if (e.target === modal) close(); };

        // ローカライズ強制適用
        this.applyLang();
    },

    /**
     * 汎用確認ダイアログ（カスタム版）
     */
    showConfirm(message, subMessage, onOk, onCancel) {
        const modal = document.getElementById('generic-confirm-modal');
        const msgEl = document.getElementById('generic-confirm-msg');
        const subEl = document.getElementById('generic-confirm-body');
        const okBtn = document.getElementById('generic-confirm-ok');
        const cancelBtn = document.getElementById('generic-confirm-cancel');

        if (!modal || !okBtn || !cancelBtn) {
            // フォールバック
            if (confirm(message + (subMessage ? "\n" + subMessage : ""))) {
                if (onOk) onOk();
            } else {
                if (onCancel) onCancel();
            }
            return;
        }

        msgEl.textContent = message;
        subEl.textContent = subMessage || '';
        modal.classList.remove('hidden');

        const close = () => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            modal.onclick = null;
        };

        okBtn.onclick = () => { close(); if (onOk) onOk(); };
        cancelBtn.onclick = () => { close(); if (onCancel) onCancel(); };
        modal.onclick = (e) => { if (e.target === modal) close(); };

        // ローカライズ強制適用
        this.applyLang();
    },

    // プロジェクトをロードして反映
    loadProject(name) {
        const data = Storage.loadProject(name);
        if (data) {
            this.projectData = data;
            this.currentProjectName = name;

            // ローカルプロジェクトを開いたときも共有状態をリセット
            this._sharedGameId = null;
            this._likesCount = 0;
            this._hasLikedThisSession = false;
            this.isPlayOnlyMode = false;
            
            // パレット復元
            if (this.projectData.palette) {
                this.nesPalette = this.projectData.palette;
            } else {
                this.nesPalette = ['#000000'];
            }

            this.updateGameInfo();
            this.refreshCurrentScreen();
            Storage.save('currentProject', this.projectData);
            const msg = (this.I18N['U363']?.[this.currentLang] || '「${name}」を開きました').replace('${name}', name);
            this.showAlert(msg);
        } else {
            const failMsg = this.I18N['U364']?.[this.currentLang] || 'プロジェクトの読み込みに失敗しました';
            this.showAlert(failMsg);
        }
    },

    // プロジェクト書き出し（旧ダウンロード）
    exportProject(filename) {
        // パレット同期
        this.projectData.palette = this.nesPalette.slice();

        const data = JSON.stringify(this.projectData, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // yyyy-mm-dd形式の日付を取得
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `Famitory_${filename}_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // プロジェクト読み込み（インポート）
    importProject(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                // 名前決定
                let baseName = file.name.replace(/\.(json|pgk)$/i, '');
                let importName = baseName;
                let counter = 1;

                // 重複回避
                while (Storage.projectExists(importName)) {
                    importName = `${baseName} (${counter})`;
                    counter++;
                }

                // 保存（既存のメタデータ名があればそれを優先し、なければファイル名を使用）
                if (!data.meta.name) {
                    data.meta.name = importName;
                }
                data.meta.createdAt = Date.now();
                Storage.saveProject(importName, data);

                const msg = (App.I18N['U365']?.[App.currentLang] || '「${importName}」としてインポートしました。\n今すぐ開きますか？').replace('${importName}', importName);
                this.showConfirm(msg, '', () => {
                    this.loadProject(importName);
                    // モーダル閉じる
                    document.getElementById('share-dialog').classList.add('hidden');
                }, () => {
                    alert(App.I18N['U366']?.[App.currentLang] || 'インポートしました。「開く」メニューから選択できます。');
                });

            } catch (err) {
                console.error(err);
                alert('ファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
    },

    // 新規作成モーダルを表示
    showNewGameModal() {
        const modal = document.getElementById('new-game-modal');
        const input = document.getElementById('new-game-name');
        const createBtn = document.getElementById('new-game-create-btn');
        const cancelBtn = document.getElementById('new-game-cancel-btn');

        if (!modal) return;

        // 初期化
        input.value = "NEW GAME";

        modal.classList.remove('hidden');
        input.focus();
        input.select();

        const close = () => {
            modal.classList.add('hidden');
            input.onkeydown = null;
            createBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        const create = () => {
            const name = input.value.trim();
            if (!name) return;

            if (Storage.projectExists(name)) {
                alert('そのなまえは すでに つかわれています');
                return;
            }

            // デフォルトパレット（ファミトリー）で作成
            this.nesPalette = this.PALETTE_PRESETS.famitory.colors.slice();
            this.projectData = this.createDefaultProject();
            this.projectData.meta.name = name;
            this.projectData.stage.name = name;
            this.currentProjectName = name;

            // リミックス元はクリア（NEWから新規作成した場合は独立した作品として扱う）
            delete this.projectData.meta.originalAuthor;
            delete this.projectData.meta.originalTitle;
            delete this.projectData.meta.originalShareId;

            // 発行済みデータを開いた状態からNEWした場合のリセット処理
            this._sharedGameId = null;
            this._likesCount = 0;
            this._hasLikedThisSession = false;
            this.isPlayOnlyMode = false;
            this.updateLikesDisplay(0);
            
            // クリエイターモードUIへの復帰
            document.querySelectorAll('.toolbar-icon.locked').forEach(btn => {
                btn.classList.remove('locked');
            });

            Storage.saveProject(name, this.projectData);
            Storage.save('currentProject', this.projectData);

            this.updateGameInfo();
            this.refreshCurrentScreen();

            this.showToast(this.I18N['U369']?.[this.currentLang] || 'あたらしいゲームを つくりました');
            close();
        };

        createBtn.onclick = create;
        cancelBtn.onclick = close;

        input.onkeydown = (e) => {
            if (e.key === 'Enter') create();
            if (e.key === 'Escape') close();
        };
    },

    // プロジェクトリストを表示（選択式）
    showSimpleProjectList() {
        const modal = document.getElementById('project-list-modal');
        const listContainer = document.getElementById('project-list');
        const scrollContainer = document.getElementById('project-list-scroll');
        const closeBtn = document.getElementById('project-list-close');

        // iOSスクロール対策
        if (scrollContainer) {
            scrollContainer.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: true });
        }

        // アクションボタン
        const openBtn = document.getElementById('project-open-btn');
        const copyBtn = document.getElementById('project-copy-btn');
        const deleteBtn = document.getElementById('project-delete-btn');

        if (!modal || !listContainer) return;

        let selectedName = null;

        // ボタン状態更新
        const updateButtons = () => {
            const disabled = !selectedName;
            openBtn.disabled = disabled;
            copyBtn.disabled = disabled;
            deleteBtn.disabled = disabled;
        };

        // リスト描画
        const renderList = () => {
            listContainer.innerHTML = '';
            const list = Storage.getProjectList();

            // 更新日時順
            list.sort((a, b) => b.updatedAt - a.updatedAt);

            if (list.length === 0) {
                const msg = this.I18N['U370'][this.currentLang];
                listContainer.innerHTML = `<div style="padding:20px;text-align:center;color:#888;">${msg}</div>`;
                updateButtons();
                return;
            }

            list.forEach(p => {
                const item = document.createElement('div');
                item.className = 'list-item';
                if (p.name === selectedName) {
                    item.classList.add('selected');
                }

                // 日付フォーマット (例: 2/2 21:00)
                const d = new Date(p.updatedAt);
                const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${('0' + d.getMinutes()).slice(-2)}`;

                item.innerHTML = `
                    <div class="list-item-arrow">${p.name === selectedName ? '▶' : ''}</div>
                    <div class="list-item-content">
                        <div class="list-item-name-wrapper">
                            <span class="list-item-name">${p.name.replace(/\u200B/g, '')}</span>
                        </div>
                        <div class="list-item-date">${dateStr}</div>
                    </div>
                `;

                item.onclick = () => {
                    if (selectedName !== p.name) {
                        selectedName = p.name;
                        renderList();
                        updateButtons();
                    }
                };

                item.ondblclick = () => {
                    selectedName = p.name;
                    openBtn.click();
                };

                listContainer.appendChild(item);
            });
            updateButtons();

            // 描画後にスクロール判定を行う
            setTimeout(() => {
                const items = listContainer.querySelectorAll('.list-item');
                items.forEach(item => {
                    const nameEl = item.querySelector('.list-item-name');
                    const wrapper = item.querySelector('.list-item-name-wrapper');

                    if (nameEl && wrapper) {
                        if (nameEl.scrollWidth > wrapper.clientWidth) {
                            nameEl.classList.add('long-text');
                        } else {
                            nameEl.classList.remove('long-text');
                        }

                        if (item.classList.contains('selected') && nameEl.classList.contains('long-text')) {
                            nameEl.classList.add('scrolling');
                        } else {
                            nameEl.classList.remove('scrolling');
                        }
                    }
                });
            }, 50);
        };

        selectedName = null;
        modal.classList.remove('hidden');

        // モーダルが表示されてから描画しないと幅が取れないため、微小遅延させるか直後に呼ぶ
        // ここでは直後に呼びつつ、内部でレイアウト判定を遅延させる
        renderList();

        const close = () => {
            modal.classList.add('hidden');
        };
        closeBtn.onclick = close;

        openBtn.onclick = () => {
            if (!selectedName) return;
            if (this.currentProjectName && this.currentProjectName !== selectedName) {
                // 保存確認なし（シンプル）
            }
            this.loadProject(selectedName);
            close();
        };

        copyBtn.onclick = () => {
            if (!selectedName) return;
            let baseName = selectedName;
            let newName = baseName + '\u200B';
            while (Storage.projectExists(newName)) {
                newName += '\u200B';
            }

            if (Storage.duplicateProject(selectedName, newName)) {
                renderList();
            }
        };

        deleteBtn.onclick = () => {
            if (!selectedName) return;
            Storage.deleteProject(selectedName);
            if (this.currentProjectName === selectedName) {
                this.currentProjectName = null;
            }
            selectedName = null;
            renderList();
        };

        modal.onclick = (e) => {
            if (e.target === modal) close();
        };
    },

    // 共有ダイアログの公開ステータスバッジを更新
    _updateShareStatus() {
        const badge = document.getElementById('share-status');
        if (!badge) return;
        const hasShareId = !!(this.projectData?.meta?.shareId);
        badge.classList.toggle('hidden', !hasShareId);
    },

    // 公開確認ダイアログを表示し、OKされたら onConfirm を呼ぶ
    _showPublishConfirm(isFirstTime, onConfirm) {
        const modal = document.getElementById('publish-confirm-modal');
        const msgEl = document.getElementById('publish-confirm-msg');
        const subEl = document.getElementById('publish-confirm-sub');
        const okBtn = document.getElementById('publish-confirm-ok');
        const cancelBtn = document.getElementById('publish-confirm-cancel');
        if (!modal || !okBtn || !cancelBtn) return;

        msgEl.textContent = isFirstTime
            ? (this.I18N['U373']?.[this.currentLang] || 'この作品を公開しますか？')
            : (this.I18N['U374']?.[this.currentLang] || '公開中の作品を更新しますか？');
        subEl.textContent = isFirstTime
            ? (this.I18N['U375']?.[this.currentLang] || 'URLが発行され、だれでもプレイできるようになります')
            : (this.I18N['U376']?.[this.currentLang] || '現在の内容で上書き保存されます');

        modal.classList.remove('hidden');

        const close = () => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            modal.onclick = null;
        };

        okBtn.onclick = () => { close(); onConfirm(); };
        cancelBtn.onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };
    },

    // 公開確認→actionFn(url)→Firebase保存 の順で実行するヘルパー
    // iOS Safari ではユーザージェスチャー直後でないとクリップボードAPIが使えないため、
    // Firebase保存（ネットワーク通信）より先に actionFn を実行する
    async _publishAndShare(actionFn) {
        if (this._shareLoading) {
            this.showToast('処理中です…少しお待ちください');
            return;
        }

        const isFirstTime = !this.projectData?.meta?.shareId;

        // URLを事前に確定（初回はIDを先に生成、2回目以降は既存IDを使い回す）
        const shareId = this.projectData.meta?.shareId || Share.generateShortId();
        const url = Share.createShortUrl(shareId);

        this._showPublishConfirm(isFirstTime, async () => {
            // --- ユーザージェスチャー直後（「はい」タップ） ---
            // クリップボードコピーや window.open はここで実行しないとiOSで失敗する
            await actionFn(url);

            // --- 以降はバックグラウンドでFirebase保存 ---
            if (!window.firebaseDB || typeof Share === 'undefined') {
                this.showToast('クラウド接続がありません');
                return;
            }

            this._shareLoading = true;

            try {
                // 保存前にリミックスOKフラグを更新
                const remixOkCheckbox = document.getElementById('share-remix-ok');
                if (remixOkCheckbox) {
                    this.projectData.meta.remixOK = remixOkCheckbox.checked;
                }

                const id = await Share.saveOrUpdateGame(shareId, this.projectData, !isFirstTime);

                if (!id) {
                    this.showToast('保存に失敗しました');
                    this._shareLoading = false;
                    return;
                }

                this.projectData.meta.shareId = id;
                if (this.currentProjectName) {
                    Storage.saveProject(this.currentProjectName, this.projectData);
                }

                this._shareUrl = url;
                this._updateShareStatus();
                this.showToast(isFirstTime ? '公開しました' : '更新しました');
            } catch (e) {
                console.error('[Share] _publishAndShare error:', e);
                this.showToast('保存でエラーが発生しました');
            } finally {
                this._shareLoading = false;
            }
        });
    },

    // シェアモーダル簡易版イベント
    bindShareSimpleEvents() {
        const copyUrlBtn = document.getElementById('copy-url-btn');
        const xBtn = document.getElementById('share-x-btn');
        const discordBtn = document.getElementById('share-discord-btn');
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const fileInput = document.getElementById('import-file-input');
        const closeBtn = document.getElementById('share-close-btn');

        const scoreCopyUrlBtn = document.getElementById('score-copy-url-btn');
        const scoreXBtn = document.getElementById('score-share-x-btn');
        const scoreDiscordBtn = document.getElementById('score-share-discord-btn');
        const scoreCloseBtn = document.getElementById('score-share-close-btn');

        // クリップボードコピー（iOS対応強化版）
        const copyToClipboard = async (text) => {
            // 1. Clipboard APIを試す（同期的イベントハンドラ内ならiOSでも動く可能性が高い）
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (e) {
                    console.warn('Clipboard API failed, falling back to legacy:', e);
                }
            }

            // 2. execCommandフォールバック (iOS特有の対応を含む)
            const textarea = document.createElement('textarea');
            textarea.value = text;

            // iOSでの選択を確実にするためのスタイルと属性
            textarea.contentEditable = true;
            textarea.readOnly = false;
            textarea.style.position = 'fixed'; // スクロール防止
            textarea.style.left = '-9999px';
            textarea.style.top = '0';

            document.body.appendChild(textarea);

            // iOS向けの選択ロジック
            const range = document.createRange();
            range.selectNodeContents(textarea);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            textarea.setSelectionRange(0, 999999); // 追加の保険

            let success = false;
            try {
                success = document.execCommand('copy');
            } catch (e) {
                console.error('execCommand copy failed:', e);
            }

            document.body.removeChild(textarea);
            selection.removeAllRanges();
            return success;
        };

        // URLコピー → 公開確認 → コピー実行 (メインシェア用)
        copyUrlBtn.onclick = () => {
            this._publishAndShare(async (url) => {
                const success = await copyToClipboard(url);
                if (success) {
                    this.showToast('URLを コピーしました');
                } else {
                    this.showToast('コピーに失敗しました');
                }
            });
        };

        // スコア共有用: URLのみコピー
        if (scoreCopyUrlBtn) {
            scoreCopyUrlBtn.onclick = async () => {
                const url = document.getElementById('score-share-url-input').value;
                if (!url) return;
                const success = await copyToClipboard(url);
                if (success) {
                    const successMsg = document.getElementById('score-copy-success');
                    if (successMsg) {
                        successMsg.classList.remove('hidden');
                        setTimeout(() => successMsg.classList.add('hidden'), 2000);
                    }
                    this.showToast('URLを コピーしました');
                } else {
                    this.showToast('コピーに失敗しました');
                }
            };
        }

        // X に投稿 → 公開確認 → Twitter URL へ遷移
        xBtn.onclick = () => {
            this._publishAndShare((url) => {
                const gameName = this.projectData.meta.name || 'Game';
                let text;
                if (this.isPlayOnlyMode) {
                    // プレイヤーモード（従来）: テキストとURLを別パラメータで渡す
                    text = `「${gameName}」であそぼう！ #FAMITORY`;
                    const twitterUrl = Share.createTwitterUrl(url, text);
                    window.open(twitterUrl, '_blank');
                } else {
                    // クリエイターモード: テキスト内にURLを含むためtextのみで投稿
                    const hashTag = gameName.replace(/\s/g, '');
                    text = `${gameName} を作りました！\nブラウザですぐ遊べます👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`;
                    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                    window.open(twitterUrl, '_blank');
                }
            });
        };

        // Discord → 公開確認 → テキスト+URLをクリップボードへ
        discordBtn.onclick = () => {
            this._publishAndShare(async (url) => {
                const gameName = this.projectData.meta.name || 'Game';
                let text;
                if (this.isPlayOnlyMode) {
                    // プレイヤーモード（従来）
                    text = `FAMITORYでゲームを作ったよ!\n${url}`;
                } else {
                    // クリエイターモード
                    const hashTag = gameName.replace(/\s/g, '');
                    text = `${gameName} を作りました！\nブラウザですぐ遊べます👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`;
                }
                const success = await copyToClipboard(text);
                if (success) {
                    this.showToast('Discord用に コピーしました');
                } else {
                    this.showToast('コピーに失敗しました');
                }
            });
        };

        // 書き出し
        exportBtn.onclick = () => {
            const name = this.currentProjectName || this.projectData.meta.name || 'MyGame';
            this.exportProject(name);
        };

        // スコア共有用: Xに投稿
        if (scoreXBtn) {
            scoreXBtn.onclick = () => {
                const sdata = Share.currentShareData;
                if (!sdata) return;
                const url = sdata.url || document.getElementById('score-share-url-input').value;
                const gameName = sdata.title || 'Game';
                const hashTag = gameName.replace(/\s/g, '');
                
                const header = sdata.isClear ? `${gameName} クリア！\nScore: ${sdata.score}\nブラウザですぐ遊べます👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`
                                             : `${gameName} GAME OVER\nScore: ${sdata.score}\nくやしい…リベンジして👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`;
                
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(header)}`;
                window.open(twitterUrl, '_blank');
            };
        }

        // スコア共有用: Discordに投稿
        if (scoreDiscordBtn) {
            scoreDiscordBtn.onclick = async () => {
                const sdata = Share.currentShareData;
                if (!sdata) return;
                const url = sdata.url || document.getElementById('score-share-url-input').value;
                const gameName = sdata.title || 'Game';
                const hashTag = gameName.replace(/\s/g, '');
                
                const header = sdata.isClear ? `${gameName} クリア！\nScore: ${sdata.score}\nブラウザですぐ遊べます👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`
                                             : `${gameName} GAME OVER\nScore: ${sdata.score}\nくやしい…リベンジして👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`;
                
                const success = await copyToClipboard(header);
                if (success) {
                    this.showToast('Discord用に コピーしました');
                } else {
                    this.showToast('コピーに失敗しました');
                }
            };
        }

        // スコア共有用: 閉じるボタン
        if (scoreCloseBtn) {
            scoreCloseBtn.onclick = () => {
                Share.closeScoreDialog();
            };
        }

        // リミックスOKチェックボックス変更
        const remixOkCheckbox = document.getElementById('share-remix-ok');
        if (remixOkCheckbox) {
            remixOkCheckbox.addEventListener('change', (e) => {
                if (this.projectData) {
                    this.projectData.meta.remixOK = e.target.checked;
                    if (this.currentProjectName) {
                        Storage.saveProject(this.currentProjectName, this.projectData);
                    }
                }
            });
        }

        // 読み込み
        importBtn.onclick = () => {
            fileInput.click();
        };

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importProject(file);
            }
            e.target.value = '';
        };

        const close = () => {
            document.getElementById('share-dialog').classList.add('hidden');
        };
        closeBtn.onclick = close;

        document.getElementById('share-dialog').onclick = (e) => {
            if (e.target === document.getElementById('share-dialog')) close();
        };
    },

    // 名前をつけて保存モーダル初期化
    initSaveAsModal() {
        const modal = document.getElementById('save-as-modal');
        const okBtn = document.getElementById('save-as-ok-btn');
        const cancelBtn = document.getElementById('save-as-cancel-btn');
        const input = document.getElementById('save-as-name-input');

        if (!modal) return;

        const close = () => modal.classList.add('hidden');

        okBtn.addEventListener('click', () => {
            const newName = input.value.trim();
            if (newName) {
                this.saveProjectAs(newName);
                close();
            } else {
                alert('プロジェクト名を入力してください');
            }
        });

        cancelBtn.addEventListener('click', close);

        // 背景クリックで閉じる
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    },

    showSaveAsModal() {
        const modal = document.getElementById('save-as-modal');
        const input = document.getElementById('save-as-name-input');
        if (modal && input) {
            // 現在のプロジェクト名を初期値に
            let initialName = this.currentProjectName || 'MyGame';
            input.value = initialName.replace(/\u200B/g, '');
            modal.classList.remove('hidden');
            input.focus();
        }
    },

    // 名前をつけて保存（複製保存して切り替え）
    saveProjectAs(newName) {
        // 現在のデータをコピー
        const newData = JSON.parse(JSON.stringify(this.projectData));

        // メタデータ更新（ステージタイトルとプレイ画面タイトルも連動して変更）
        newData.meta.updatedAt = Date.now();
        newData.meta.name = newName;
        if (newData.stage) {
            newData.stage.name = newName;
        }
        // 内部変数更新
        this.projectData = newData;
        this.currentProjectName = newName;

        // UI反映
        this.updateGameInfo();
        if (typeof StageEditor !== 'undefined' && StageEditor.updateStageSettingsUI) {
            StageEditor.updateStageSettingsUI();
        }

        // 保存実行
        Storage.saveProject(newName, newData);
        Storage.save('currentProject', newData);

        this.showToast(`「${newName}」として保存しました`);
        console.log(`Project saved as: ${newName}`);
    },

    // ========================================
    // ローカライズ (i18n) システム
    // ========================================

    // 現在の言語（'JPN' または 'ENG'）
    currentLang: 'JPN',

    // UIテキスト翻訳テーブル（IDキー→{JPN, ENG}）
    I18N: {
        // ---- ヘッダーツールバー ----
        'U001': { JPN: '新規',      ENG: 'New' },
        'U002': { JPN: 'NEW',       ENG: 'NEW' },
        'U003': { JPN: '読み込み',  ENG: 'Open' },
        'U004': { JPN: 'OPEN',      ENG: 'OPEN' },
        'U005': { JPN: '保存',      ENG: 'Save' },
        'U006': { JPN: 'SAVE',      ENG: 'SAVE' },
        'U007': { JPN: '共有',      ENG: 'Share' },
        'U008': { JPN: 'SHARE',     ENG: 'SHARE' },
        'U009': { JPN: 'プレイ',    ENG: 'Play' },
        'U010': { JPN: 'PLAY',      ENG: 'PLAY' },
        'U011': { JPN: 'ピクセル',  ENG: 'Pixel' },
        'U012': { JPN: 'PIXEL',     ENG: 'PIXEL' },
        'U013': { JPN: 'ステージ',  ENG: 'Stage' },
        'U014': { JPN: 'STAGE',     ENG: 'STAGE' },
        'U015': { JPN: 'サウンド',  ENG: 'Sound' },
        'U016': { JPN: 'BGM',       ENG: 'BGM' },
        // ---- ゲーム設定パネル ----
        'U040': { JPN: 'ゲーム設定',    ENG: 'Game Settings' },
        'U041': { JPN: 'ゲームタイトル',  ENG: 'Title' },
        'U043': { JPN: 'クリエイター',    ENG: 'Creator' },
        'U044': { JPN: 'エディットキー',  ENG: 'Edit Key' },
        'U045': { JPN: 'ステージサイズ',  ENG: 'Stage Size' },
        'U046': { JPN: '縦',              ENG: 'H' },
        'U049': { JPN: '横',              ENG: 'W' },
        'U050': { JPN: '背景色',          ENG: 'BG Color' },
        'U051': { JPN: 'なし',           ENG: 'None' },
        'U056': { JPN: 'クリア条件',      ENG: 'Clear Cond.' },
        'U057': { JPN: 'アイテム取得',    ENG: 'Collect Items' },
        'U058': { JPN: '敵ぜんめつ',      ENG: 'Defeat Enemies' },
        'U059': { JPN: 'ボス撃破',        ENG: 'Defeat Boss' },
        'U060': { JPN: 'サバイバル',      ENG: 'Survival' },
        'U061': { JPN: '制限時間',        ENG: 'Time Limit' },
        'U062': { JPN: '分',              ENG: 'min' },
        'U063': { JPN: '秒',              ENG: 'sec' },
        'U064': { JPN: 'スコア表示',      ENG: 'Show Score' },
        'U065': { JPN: '設定を保存',      ENG: 'Save Settings' },
        // ---- リザルト画面 ----
        'U020': { JPN: 'いいね！',             ENG: 'Like!' },
        'U397': { JPN: 'STAGE CLEAR!',        ENG: 'STAGE CLEAR!' },
        'U398': { JPN: 'GAME OVER',           ENG: 'GAME OVER' },
        // ---- 共有ダイアログ ----
        'U140': { JPN: 'ゲームを共有',         ENG: 'Share Game' },
        'U141': { JPN: 'リミックスOK',         ENG: 'Allow Remix' },
        'U142': { JPN: '公開中',              ENG: 'Published' },
        'U143': { JPN: '✓ コピーしました',     ENG: '✓ Copied' },
        'U144': { JPN: 'データを移動',         ENG: 'Transfer Data' },
        'U401': { JPN: 'エクスポート',         ENG: 'Export' },
        'U402': { JPN: 'インポート',           ENG: 'Import' },
        // ---- プロジェクトリストモーダル ----
        'U145': { JPN: 'もどる',              ENG: 'Back' },
        'U146': { JPN: 'データをえらぶ',       ENG: 'Select Data' },
        'U147': { JPN: 'ひらく',              ENG: 'Open' },
        'U148': { JPN: 'けす',               ENG: 'Delete' },
        'U149': { JPN: 'やめる',              ENG: 'Cancel' },
        'U370': { JPN: 'セーブデータなし',     ENG: 'No save data' },
        // ---- 新規作成モーダル ----
        'U150': { JPN: 'あたらしいゲームをつくる', ENG: 'Create New Game' },
        'U403': { JPN: 'ゲームタイトル',       ENG: 'Game Title' },
        'U151': { JPN: 'つくる',              ENG: 'Create' },
        // ---- セーブ/トースト ----
        'U167': { JPN: 'セーブしました',       ENG: 'Saved!' },
        'U172': { JPN: 'セーブ',              ENG: 'Save' },
        'U170': { JPN: 'なまえをつけてセーブ', ENG: 'Save As' },
        // ---- カラープリセット ----
        'U152': { JPN: 'カラープリセット',     ENG: 'Color Preset' },
        'U153': { JPN: 'ファミトリー',         ENG: 'Famitory' },
        'U155': { JPN: 'パステル',            ENG: 'Pastel' },
        'U157': { JPN: 'ファミコン',           ENG: 'Famicom' },
        'U159': { JPN: 'ゲームボーイ',         ENG: 'Game Boy' },
        'U161': { JPN: 'モノクロ',            ENG: 'Mono' },
        'U163': { JPN: 'ついか',              ENG: 'Add' },
        'U164': { JPN: 'おきかえ',            ENG: 'Replace' },
        'U165': { JPN: 'とじる',              ENG: 'Close' },
        // ---- 数値入力モーダル ----
        'U166': { JPN: '値を入力を',          ENG: 'Enter Value' },
        // ---- エディットキーモーダル ----
        'U174': { JPN: 'このゲームを編集するには<br>エディットキーが必要です', ENG: 'An edit key is required<br>to edit this game.' },
        'U175': { JPN: '8桁のキーを入力',       ENG: 'Enter 8-character key' },
        'U176': { JPN: '認証',               ENG: 'Verify' },
        'U179': { JPN: 'キャンセル',          ENG: 'Cancel' },
        'U444': { JPN: 'キーが一致しません',    ENG: 'Key mismatch' },
        // ---- BGMエディタ（ソング制御） ----
        'U078': { JPN: 'BGM名変更',         ENG: 'Rename BGM' },
        'U080': { JPN: 'コピー＆ペースト',     ENG: 'Copy & Paste' },
        'U081': { JPN: 'トラック',            ENG: 'Track' },
        'U082': { JPN: 'コピー範囲',          ENG: 'Copy Range' },
        'U084': { JPN: 'ペースト先',          ENG: 'Paste At' },
        'U085': { JPN: '実行',               ENG: 'Execute' },
        // ---- スプライト選択ポップアップ ----
        'U069': { JPN: 'スプライトを選択',     ENG: 'Select Sprite' },
        'U071': { JPN: '完了',               ENG: 'Done' },
        // ---- 属性選択ポップアップ ----
        'U072': { JPN: 'タイプを選択',         ENG: 'Select Type' },
        'U073': { JPN: 'プレイヤー',          ENG: 'Player' },
        'U074': { JPN: 'てき',               ENG: 'Enemy' },
        'U075': { JPN: 'ブロック・背景',       ENG: 'Block/BG' },
        'U076': { JPN: 'アイテム',            ENG: 'Item' },
        // ---- 公開確認ダイアログ ----
        'U168': { JPN: 'この作品を公開しますか？',    ENG: 'Publish this game?' },
        'U169': { JPN: 'はい',               ENG: 'Yes' },
        // ---- BGM設定 ----
        'U413': { JPN: 'ステージ',            ENG: 'Stage' },
        'U414': { JPN: '無敵',               ENG: 'Invincible' },
        'U415': { JPN: 'クリア',              ENG: 'Win' },
        'U416': { JPN: 'ゲームオーバー',       ENG: 'Game Over' },
        'U417': { JPN: 'ボス',               ENG: 'Boss' },
        'U418': { JPN: 'なし',               ENG: 'None' },
        'U419': { JPN: 'コピー',              ENG: 'Copy' },
        'U420': { JPN: 'URLをコピー',         ENG: 'Copy URL' },
        'U421': { JPN: 'Xにとうこう',         ENG: 'Post on X' },
        'U422': { JPN: 'Discordにとうこう',   ENG: 'Post on Discord' },
        'U423': { JPN: 'はじめから使える',    ENG: 'Available from start' },
        'U424': { JPN: 'てきの動き',          ENG: 'Move Type' },
        'U425': { JPN: 'ドロップ',            ENG: 'Drop Item' },
        'U426': { JPN: 'ギミック',            ENG: 'Gimmick' },
        'U427': { JPN: '種類',               ENG: 'Type' },

        // ---- タイル設定パネル (Stage Editor) ----
        'U193': { JPN: 'プレイヤー',          ENG: 'Player' },
        'U194': { JPN: 'てき',               ENG: 'Enemy' },
        'U195': { JPN: 'ブロック・背景',       ENG: 'Block/BG' },
        'U196': { JPN: 'アイテム',            ENG: 'Item' },
        'U197': { JPN: 'ゴール',              ENG: 'Goal' },
        'U198': { JPN: '基本',               ENG: 'Base' },
        'U199': { JPN: '歩き',               ENG: 'Walk' },
        'U200': { JPN: 'のぼる',             ENG: 'Climb' },
        'U201': { JPN: 'ジャンプ',            ENG: 'Jump' },
        'U202': { JPN: '攻撃',               ENG: 'Attack' },
        'U203': { JPN: '基本',               ENG: 'Base' },
        'U204': { JPN: 'ライフ',             ENG: 'Life' },
        'U205': { JPN: '変身\nアイテム',        ENG: 'Morph Item' },
        'U206': { JPN: '能力',               ENG: 'Abilities' },
        'U207': { JPN: '足の速さ',            ENG: 'Move Speed' },
        'U208': { JPN: 'ジャンプ力',          ENG: 'Jump Power' },
        'U209': { JPN: '2段ジャンプ',         ENG: 'Double Jump' },
        'U210': { JPN: 'ライフ数',            ENG: 'Life Count' },
        'U211': { JPN: '特性',               ENG: 'Traits' },
        'U212': { JPN: 'うろうろ',            ENG: 'Wander' },
        'U213': { JPN: '動かない',            ENG: 'Static' },
        'U214': { JPN: 'ぴょんぴょん',        ENG: 'Hop' },
        'U215': { JPN: 'うろぴょん',          ENG: 'Wander+Hop' },
        'U216': { JPN: '追いかけてくる',      ENG: 'Chase' },
        'U217': { JPN: 'とっしん',            ENG: 'Rush' },
        'U218': { JPN: '空中',               ENG: 'Aerial' },
        'U219': { JPN: 'ボスてき',            ENG: 'Boss Enemy' },
        'U220': { JPN: 'なし',               ENG: 'None' },
        'U221': { JPN: 'コイン',             ENG: 'Coin' },
        'U222': { JPN: 'むてき',             ENG: 'Invincible' },
        'U223': { JPN: 'ライフアップ',        ENG: 'Life Up' },
        'U224': { JPN: 'クリア',             ENG: 'Clear' },
        'U225': { JPN: '武器',               ENG: 'Weapon' },
        'U226': { JPN: 'ボム',               ENG: 'Bomb' },
        'U227': { JPN: 'イースターエッグ',    ENG: 'Easter Egg' },
        'U228': { JPN: '武器',               ENG: 'Weapon' },
        'U229': { JPN: '近接',               ENG: 'Melee' },
        'U230': { JPN: 'ストレート',          ENG: 'Straight' },
        'U231': { JPN: '山なり',             ENG: 'Arc' },
        'U232': { JPN: '真下に落下',          ENG: 'Drop Down' },
        'U233': { JPN: '拡散',               ENG: 'Spread' },
        'U234': { JPN: 'ブーメラン',          ENG: 'Boomerang' },
        'U235': { JPN: 'ピンボール',          ENG: 'Pinball' },
        'U236': { JPN: '回転',               ENG: 'Rotate' },
        'U237': { JPN: '速度',               ENG: 'Speed' },
        'U238': { JPN: '連射',               ENG: 'Rapid Fire' },
        'U239': { JPN: '届く距離',            ENG: 'Range' },
        'U240': { JPN: '効果音',             ENG: 'Sound FX' },
        'U241': { JPN: 'ジャンプ音',          ENG: 'Jump SFX' },
        'U242': { JPN: '攻撃音',             ENG: 'Attack SFX' },
        'U243': { JPN: 'ダメージ音',          ENG: 'Damage SFX' },
        'U244': { JPN: 'ゲット音',            ENG: 'Get SFX' },
        'U245': { JPN: '横移動',             ENG: 'Horizontal' },
        'U246': { JPN: '縦移動',             ENG: 'Vertical' },
        'U247': { JPN: '落下',               ENG: 'Fall' },
        'U248': { JPN: 'はしご',             ENG: 'Ladder' },
        'U249': { JPN: 'スプリング',          ENG: 'Spring' },
        'U250': { JPN: 'とびら',             ENG: 'Door' },
        'U251': { JPN: 'はねる力',            ENG: 'Spring Power' },
        'U252': { JPN: '当たり判定',          ENG: 'Collision' },
        'U253': { JPN: '耐久性',             ENG: 'Durability' },
        'U254': { JPN: 'カギ',               ENG: 'Key' },
        'U255': { JPN: '最大20文字',          ENG: 'Max 20 chars' },
        'U256': { JPN: 'ジャンプ01',          ENG: 'Jump01' },
        'U257': { JPN: 'ジャンプ02',          ENG: 'Jump02' },
        'U258': { JPN: 'ジャンプ03',          ENG: 'Jump03' },
        'U259': { JPN: 'ジャンプ04',          ENG: 'Jump04' },
        'U260': { JPN: 'ジャンプ05',          ENG: 'Jump05' },
        'U261': { JPN: '攻撃01',             ENG: 'Attack01' },
        'U262': { JPN: '攻撃02',             ENG: 'Attack02' },
        'U263': { JPN: '攻撃03',             ENG: 'Attack03' },
        'U264': { JPN: '攻撃04',             ENG: 'Attack04' },
        'U265': { JPN: '攻撃05',             ENG: 'Attack05' },
        'U266': { JPN: 'ダメージ_01',         ENG: 'Damage_01' },
        'U267': { JPN: 'ダメージ_02',         ENG: 'Damage_02' },
        'U268': { JPN: 'ダメージ_03',         ENG: 'Damage_03' },
        'U269': { JPN: 'ダメージ_04',         ENG: 'Damage_04' },
        'U270': { JPN: 'ダメージ_05',         ENG: 'Damage_05' },
        'U271': { JPN: 'ゲット_01',           ENG: 'Get_01' },
        'U272': { JPN: 'ゲット_02',           ENG: 'Get_02' },
        'U273': { JPN: 'ゲット_03',           ENG: 'Get_03' },
        'U274': { JPN: 'ゲット_04',           ENG: 'Get_04' },
        'U275': { JPN: 'ゲット_05',           ENG: 'Get_05' },
        'U276': { JPN: 'その他01(決定)',      ENG: 'Other01(OK)' },
        'U277': { JPN: 'その他02(キャンセル)', ENG: 'Other02(Cancel)' },
        'U278': { JPN: 'その他03(カーソル)',   ENG: 'Other03(Cursor)' },
        'U279': { JPN: 'その他04(ポーズ)',     ENG: 'Other04(Pause)' },
        'U280': { JPN: 'その他05(爆発)',       ENG: 'Other05(Explosion)' },
        'U281': { JPN: 'ダメージ',            ENG: 'Damage' },
        'U282': { JPN: 'ゲット',              ENG: 'Get' },
        'U285': { JPN: 'スプライトを登録してください', ENG: 'Please register a sprite' },
        'U286': { JPN: '複製',               ENG: 'Duplicate' },
        'U287': { JPN: '削除',               ENG: 'Delete' },
        'U288': { JPN: 'キャンセル',          ENG: 'Cancel' },
        'U177': { JPN: '複製',               ENG: 'Duplicate' },
        'U178': { JPN: '削除',               ENG: 'Delete' },
        'U179': { JPN: 'キャンセル',          ENG: 'Cancel' },
        'U180': { JPN: 'プリセットを選択してください', ENG: 'Please select a preset' },
        'U181': { JPN: '現在のパレットをおきかえますか？\nスプライトの色が変わる可能性があります。', ENG: 'Replace the current palette?\nSprite colors may change.' },
        'U183': { JPN: '最低1色は必要です',    ENG: 'At least 1 color is required' },
        'U185': { JPN: '縮小すると細かい情報が失われます。続行しますか？', ENG: 'Shrinking may lose detail. Continue?' },
        'U186': { JPN: 'これ以上削除できません', ENG: 'Cannot delete any more' },
        'U428': { JPN: '軌道',               ENG: 'Trajectory' },
        'U430': { JPN: 'カラー編集',         ENG: 'Color Edit' },
        'U431': { JPN: '現在',               ENG: 'Current' },
        'U432': { JPN: '編集中',             ENG: 'Editing' },
        'U433': { JPN: 'よく使う色',         ENG: 'Recent Colors' },
        'U434': { JPN: 'はい',               ENG: 'Yes' },
        'U435': { JPN: 'いいえ',             ENG: 'No' },
        'U306': { JPN: '閉じる',             ENG: 'Close' },
        'U436': { JPN: 'エディットキーをコピーしました', ENG: 'Edit key copied' },
        'U295': { JPN: '音色を選択',         ENG: 'Select Tone' },
        'U296': { JPN: 'Standard',           ENG: 'Standard' },
        'U297': { JPN: 'Standard (Short)',   ENG: 'Standard (Short)' },
        'U298': { JPN: 'Standard (FadeIn)',  ENG: 'Standard (FadeIn)' },
        'U299': { JPN: 'Sharp',              ENG: 'Sharp' },
        'U300': { JPN: 'Sharp (Short)',      ENG: 'Sharp (Short)' },
        'U301': { JPN: 'Sharp (FadeIn)',     ENG: 'Sharp (FadeIn)' },
        'U302': { JPN: 'Tremolo (高速)',     ENG: 'Tremolo (Fast)' },
        'U303': { JPN: 'Soft (Sine)',        ENG: 'Soft (Sine)' },
        'U304': { JPN: 'Power (Saw)',        ENG: 'Power (Saw)' },
        'U305': { JPN: 'Kick (ピッチ下降)',   ENG: 'Kick (Pitch Down)' },
        'U399': { JPN: 'Noise (ピッチ)',     ENG: 'Noise (Pitch)' },
        'U400': { JPN: 'Drum Kit',           ENG: 'Drum Kit' },
        'U187': { JPN: 'このスプライトを削除しますか？\n（使用されている箇所は削除されます）', ENG: 'Delete this sprite?\n(All usages will be removed.)' },
        'U188': { JPN: 'スプライトをクリアしますか？', ENG: 'Clear this sprite?' },
        'U317': { JPN: 'クリップボードが空です',   ENG: 'Clipboard is empty' },
        'U363': { JPN: '「${name}」を開きました',       ENG: 'Opened "${name}"' },
        'U365': { JPN: '「${importName}」としてインポートしました。\n今すぐ開きますか？', ENG: 'Imported as "${importName}".\nOpen now?' },
        'U366': { JPN: 'インポートしました。「開く」メニューから選択できます。', ENG: 'Imported. You can open it from the "Open" menu.' },
        'U368': { JPN: 'そのなまえは すでに つかわれています', ENG: 'That name is already in use' },
        'U369': { JPN: 'あたらしいゲームを つくりました', ENG: 'New game created!' },
        'U354': { JPN: '編集モードに切り替わりました',     ENG: 'Switched to Edit Mode' },
        'U373': { JPN: 'この作品を公開しますか？',    ENG: 'Publish this game?' },
        'U374': { JPN: '公開中の作品を更新しますか？', ENG: 'Update the published game?' },
        'U375': { JPN: 'URLが発行され、だれでもプレイできるようになります', ENG: 'A URL will be generated so anyone can play' },
        'U376': { JPN: '現在の内容で上書き保存されます', ENG: 'The current content will be overwritten' },
        'U437': { JPN: 'スコアを共有',    ENG: 'Share Score' },
        'U438': { JPN: 'もう一度',        ENG: 'Retry' },
        'U439': { JPN: 'リミックスする',  ENG: 'Remix' },
        'U440': { JPN: '編集に戻る',      ENG: 'Back to Edit' },
        'U441': { JPN: 'スコアを共有',    ENG: 'Share Score' },
        'U442': { JPN: 'もどる',          ENG: 'Back' },
        'U443': { JPN: '✓ コピーしました', ENG: '✓ Copied' },
        'U445': { JPN: 'メッセージ',      ENG: 'Message' },
    },

    /**
     * data-i18n 属性を持つ全要素のテキストを現在の言語に切り替える
     */
    applyLang() {
        const lang = this.currentLang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const id = el.getAttribute('data-i18n');
            const entry = this.I18N[id];
            if (entry && entry[lang] !== undefined) {
                el.textContent = entry[lang];
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const id = el.getAttribute('data-i18n-title');
            const entry = this.I18N[id];
            if (entry && entry[lang] !== undefined) {
                el.title = entry[lang];
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const id = el.getAttribute('data-i18n-placeholder');
            const entry = this.I18N[id];
            if (entry && entry[lang] !== undefined) {
                el.placeholder = entry[lang];
            }
        });
        // lang-labelは特別処理
        const langLabel = document.getElementById('lang-label');
        if (langLabel) langLabel.textContent = lang;

        // html要素のlang属性更新
        document.documentElement.lang = (lang === 'JPN') ? 'ja' : 'en';

        // ステージエディタのBGM選択ボタン（なし/None）および設定パネルを更新
        if (typeof StageEditor !== 'undefined') {
            if (StageEditor.updateBgmSelects) StageEditor.updateBgmSelects();
            if (StageEditor.isConfigOpen && StageEditor.renderConfigContent) {
                StageEditor.renderConfigContent();
            }
        }
    },

    /**
     * ローカライズボタンの初期化
     */
    initLangBtn() {
        // LocalStorageから言語設定を復元
        const savedLang = localStorage.getItem('pgk_lang');
        if (savedLang === 'ENG') {
            this.currentLang = 'ENG';
            const btn = document.getElementById('lang-icon-btn');
            if (btn) btn.classList.add('lang-eng');
        } else {
            this.currentLang = 'JPN';
        }
        this.applyLang();

        // ボタンクリックで切替
        const langBtn = document.getElementById('lang-icon-btn');
        if (!langBtn) return;
        langBtn.addEventListener('click', () => {
            if (this.currentLang === 'JPN') {
                this.currentLang = 'ENG';
                langBtn.classList.add('lang-eng');
            } else {
                this.currentLang = 'JPN';
                langBtn.classList.remove('lang-eng');
            }
            localStorage.setItem('pgk_lang', this.currentLang);
            this.applyLang();
        });
    }
};

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
