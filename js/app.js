/**
 * PixelGameKit - メインアプリケーション
 */

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

    // 初期化
    init() {
        console.log('FAMITORY initializing...');

        // デフォルトパレットをファミトリーに設定
        if (!this.nesPalette) {
            this.nesPalette = this.PALETTE_PRESETS.famitory.colors.slice();
        }

        this.registerServiceWorker();
        AppProject.loadOrCreateProject();
        this.initMenu();
        AppProject.checkUrlData();

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
                if (GameEngine.gameBgmPlayer?.audioCtx?.state === 'suspended') {
                    GameEngine.gameBgmPlayer.audioCtx.resume();
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
        app.style.transformOrigin = 'center center';

        // bodyをセンタリング用に設定
        document.body.style.overflow = 'hidden';
        document.body.style.display = 'flex';
        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'center';
        document.body.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#000000' : '#ffffff';
        document.body.style.height = '100dvh';
        document.body.style.margin = '0';

        // マージンや位置の個別調整はFlexboxに任せるためクリア
        app.style.marginTop = '0';

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
        this.showToast(AppI18N.I18N['U354']?.[AppI18N.currentLang] || '編集モードに切り替わりました');
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
            AppProject.showNewGameModal();
        });

        // 開く（OPEN） -> プロジェクトリスト
        document.getElementById('load-icon-btn')?.addEventListener('click', () => {
            AppProject.showSimpleProjectList();
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
                    AppProject.showSaveAsModal();
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
                    AppProject.saveProject(); // 通常保存
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
        AppProject.initSaveAsModal();

        // 共有ボタン
        const shareBtn = document.getElementById('share-icon-btn');
        // 共有イベントは一度だけバインド
        AppShare.bindShareSimpleEvents();
        shareBtn?.addEventListener('click', () => {
            this.projectData.palette = this.nesPalette.slice();
            AppShare._shareLoading = false;

            // 既存の公開IDがあればURLをセット（ただし Firebase保存は行わない）
            const existingId = this.projectData?.meta?.shareId;
            App._shareUrl = existingId ? Share.createShortUrl(existingId) : null;

            // Remix OKのチェック状態復元
            const remixOkCheckbox = document.getElementById('share-remix-ok');
            if (remixOkCheckbox) {
                remixOkCheckbox.checked = !!this.projectData?.meta?.remixOK;
            }

            document.getElementById('share-dialog').classList.remove('hidden');
            AppShare.updateShareStatus();
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
        AppI18N.initLangBtn();
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

};

// AppI18N / AppDialogs への後方互換プロキシ
Object.defineProperty(App, 'I18N', { get: () => AppI18N.I18N });
Object.defineProperty(App, 'currentLang', {
    get: () => AppI18N.currentLang,
    set: (v) => { AppI18N.currentLang = v; }
});
App.applyLang       = ()                   => AppI18N.applyLang();
App.showAlert       = (msg, sub, ok)       => AppDialogs.showAlert(msg, sub, ok);
App.showConfirm     = (msg, sub, ok, ng)   => AppDialogs.showConfirm(msg, sub, ok, ng);
App.showActionMenu  = (title, actions)     => AppDialogs.showActionMenu(title, actions);

// AppProject への後方互換プロキシ
App.generateEditKey   = ()         => AppProject.generateEditKey();
App.create2DArray     = (w, h, v)  => AppProject.create2DArray(w, h, v);
App.hasUnsavedChanges = ()         => AppProject.hasUnsavedChanges();
App.saveProject       = ()         => AppProject.saveProject();
App.loadProject       = (name)     => AppProject.loadProject(name);
App.exportProject     = (f)        => AppProject.exportProject(f);
App.importProject     = (file)     => AppProject.importProject(file);

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
