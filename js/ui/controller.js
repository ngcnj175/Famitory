/**
 * PixelGameKit - ゲームコントローラー（Start/Select対応）
 */

const GameController = {
    buttons: {
        up: false,
        down: false,
        left: false,
        right: false,
        a: false,
        b: false
    },

    // Startボタン長押し検出
    startPressTimer: null,
    startLongPressThreshold: 1200, // ミリ秒

    init() {
        this.initDpad();
        this.initActionButtons();
        this.initSystemButtons();
        this.initKeyboard();
        this.restoreDarkMode();
    },

    // 8方向マッピングテーブル（22.5度刻み、右・左はデフォルト/ラップアラウンドで処理）
    _DPAD_DIRECTIONS: [
        { min: -67.5,  max: -22.5,  dirs: ['up', 'right'],  cls: 'press-up-right'   },
        { min: -112.5, max: -67.5,  dirs: ['up'],            cls: 'press-up'         },
        { min: -157.5, max: -112.5, dirs: ['up', 'left'],   cls: 'press-up-left'    },
        { min: 112.5,  max: 157.5,  dirs: ['down', 'left'], cls: 'press-down-left'  },
        { min: 67.5,   max: 112.5,  dirs: ['down'],          cls: 'press-down'       },
        { min: 22.5,   max: 67.5,   dirs: ['down', 'right'], cls: 'press-down-right' },
    ],

    // 入力座標をD-Pad方向に変換して適用
    processDpadInput(clientX, clientY) {
        const container = document.getElementById('dpad-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const x = clientX - rect.left - rect.width / 2;
        const y = clientY - rect.top - rect.height / 2;

        // デッドゾーン判定（中心から10px以内は入力なし）
        if (Math.hypot(x, y) < 10) {
            this.releaseAllDpad();
            return;
        }

        const deg = Math.atan2(y, x) * (180 / Math.PI);
        this.releaseAllDpad();

        // テーブルから方向を検索
        const dir = this._DPAD_DIRECTIONS.find(d => deg > d.min && deg <= d.max);
        if (dir) {
            dir.dirs.forEach(d => this.press(d));
            this.setDpadFeedback(dir.cls);
        } else if (deg > 157.5 || deg <= -157.5) { // 左（±180付近のラップアラウンド）
            this.press('left');
            this.setDpadFeedback('press-left');
        } else { // 右（デフォルト: -22.5 ~ 22.5）
            this.press('right');
            this.setDpadFeedback('press-right');
        }
    },

    initDpad() {
        const container = document.getElementById('dpad-container');
        if (!container) return;

        // タッチ操作（仮想D-Pad）
        const handleTouch = (e) => {
            e.preventDefault();
            const touch = e.targetTouches[0];
            if (!touch) return;
            this.processDpadInput(touch.clientX, touch.clientY);
        };

        container.addEventListener('touchstart', handleTouch, { passive: false });
        container.addEventListener('touchmove', handleTouch, { passive: false });

        const stopTouch = (e) => {
            e.preventDefault();
            this.releaseAllDpad();
        };

        container.addEventListener('touchend', stopTouch, { passive: false });
        container.addEventListener('touchcancel', stopTouch, { passive: false });
        container.addEventListener('mouseleave', stopTouch);

        // PCデバッグ用マウス操作
        let isMouseDown = false;
        container.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            this.processDpadInput(e.clientX, e.clientY);
        });
        container.addEventListener('mousemove', (e) => {
            if (isMouseDown) this.processDpadInput(e.clientX, e.clientY);
        });
        container.addEventListener('mouseup', () => {
            isMouseDown = false;
            this.releaseAllDpad();
        });
    },

    releaseAllDpad() {
        this.release('up');
        this.release('down');
        this.release('left');
        this.release('right');
        this.clearDpadFeedback();
    },

    // D-padフィードバック用クラス管理
    dpadFeedbackClasses: ['press-up', 'press-down', 'press-left', 'press-right', 'press-up-right', 'press-up-left', 'press-down-right', 'press-down-left'],

    setDpadFeedback(className) {
        const dpad = document.getElementById('dpad');
        if (!dpad) return;
        this.dpadFeedbackClasses.forEach(c => dpad.classList.remove(c));
        dpad.classList.add(className);
    },

    clearDpadFeedback() {
        const dpad = document.getElementById('dpad');
        if (!dpad) return;
        this.dpadFeedbackClasses.forEach(c => dpad.classList.remove(c));
    },

    initActionButtons() {
        ['a', 'b'].forEach(btn => {
            const el = document.getElementById('btn-' + btn);
            if (!el) return;

            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.press(btn);
            });
            el.addEventListener('mouseup', () => this.release(btn));
            el.addEventListener('mouseleave', () => this.release(btn));

            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.press(btn);
            }, { passive: false });

            el.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.release(btn);
            }, { passive: false });

            el.addEventListener('touchcancel', () => this.release(btn));
        });
    },

    initSystemButtons() {
        const startBtn = document.getElementById('btn-start');

        if (startBtn) {
            // マウス操作
            startBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.onStartPress();
            });
            startBtn.addEventListener('mouseup', () => this.onStartRelease());
            startBtn.addEventListener('mouseleave', () => this.onStartRelease());

            // タッチ操作
            startBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.onStartPress();
            }, { passive: false });
            startBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.onStartRelease();
            }, { passive: false });
            startBtn.addEventListener('touchcancel', () => this.onStartRelease());
        }
    },

    onStartPress() {
        this.startPressTime = performance.now();
        this.startHolding = true;

        // フレームごとに進捗を更新
        const updateHold = () => {
            if (!this.startHolding) return;

            const elapsed = performance.now() - this.startPressTime;
            const threshold = this.startLongPressThreshold;

            if (typeof GameEngine !== 'undefined') {
                if (elapsed >= 200) {
                    // 0.2秒後: RE:START 点滅開始
                    GameEngine.restartBlink = true;
                }
                if (elapsed >= 500) {
                    // 0.5秒後: バー進捗（500ms~800msを0~1に正規化）
                    GameEngine.restartProgress = Math.min((elapsed - 500) / (threshold - 500), 1.0);
                } else {
                    GameEngine.restartProgress = 0;
                }
            }

            if (elapsed >= threshold) {
                // 長押し完了: リスタート
                this.startHolding = false;
                if (typeof GameEngine !== 'undefined') {
                    GameEngine.restartBlink = false;
                    GameEngine.restartProgress = 0;
                    GameEngine.restart();
                }
                return;
            }

            requestAnimationFrame(updateHold);
        };

        requestAnimationFrame(updateHold);
    },

    onStartRelease() {
        if (!this.startHolding && !this.startPressTime) return;

        const elapsed = this.startPressTime ? performance.now() - this.startPressTime : 0;
        this.startHolding = false;
        this.startPressTime = null;

        // UI状態をリセット
        if (typeof GameEngine !== 'undefined') {
            GameEngine.restartBlink = false;
            GameEngine.restartProgress = 0;
        }

        // 0.2秒未満 = 短押し: トグル動作
        if (elapsed < 200) {
            if (typeof GameEngine !== 'undefined') {
                GameEngine.togglePause();
            }
        }
    },

    initKeyboard() {
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right',
            'KeyW': 'up',
            'KeyS': 'down',
            'KeyA': 'left',
            'KeyD': 'right',
            'KeyZ': 'a',
            'KeyJ': 'a',
            'KeyX': 'b',
            'KeyK': 'b',
            'Space': 'a'
        };

        const isTyping = () => {
            const tag = document.activeElement?.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
        };

        document.addEventListener('keydown', (e) => {
            if (isTyping()) return;

            const btn = keyMap[e.code];
            if (btn && App.currentScreen === 'play') {
                e.preventDefault();
                this.press(btn);
            }

            if (e.code === 'Enter' && App.currentScreen === 'play') {
                e.preventDefault();
                if (typeof GameEngine !== 'undefined') {
                    GameEngine.togglePause();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (isTyping()) return;

            const btn = keyMap[e.code];
            if (btn) {
                e.preventDefault();
                this.release(btn);
            }
        });
    },

    // コナミコマンドシーケンス: ↑↑↓↓←→←→BA
    konamiSequence: ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'],
    konamiIndex: 0,
    konamiTimer: null,

    press(button) {
        this.buttons[button] = true;

        // コナミコマンド検出（PLAY画面のみ）
        if (App.currentScreen === 'play') {
            this.checkKonamiCode(button);
        }
    },

    checkKonamiCode(button) {
        // タイムアウトリセット
        if (this.konamiTimer) {
            clearTimeout(this.konamiTimer);
        }

        if (button === this.konamiSequence[this.konamiIndex]) {
            this.konamiIndex++;

            if (this.konamiIndex >= this.konamiSequence.length) {
                // コナミコマンド成立！
                this.konamiIndex = 0;
                this.toggleDarkMode();
                return;
            }

            // 3秒以内に次の入力がなければリセット
            this.konamiTimer = setTimeout(() => {
                this.konamiIndex = 0;
            }, 3000);
        } else {
            // 間違えたらリセット（ただし最初の入力として再チェック）
            this.konamiIndex = 0;
            if (button === this.konamiSequence[0]) {
                this.konamiIndex = 1;
                this.konamiTimer = setTimeout(() => {
                    this.konamiIndex = 0;
                }, 3000);
            }
        }
    },

    toggleDarkMode() {
        const app = document.getElementById('app');
        if (!app) return;

        const isDark = app.classList.toggle('dark-mode');
        // bodyにも付与（#app外のモーダル用）
        document.body.classList.toggle('dark-mode', isDark);

        // localStorage に保存（再起動時も維持）
        localStorage.setItem('pgk_darkMode', isDark ? '1' : '0');

        // SE再生（隠しコマンド発動感）
        if (typeof NesAudio !== 'undefined' && NesAudio.playSE) {
            NesAudio.playSE('other_01');
        }
    },

    // 起動時にダークモード復元
    restoreDarkMode() {
        if (localStorage.getItem('pgk_darkMode') === '1') {
            const app = document.getElementById('app');
            if (app) {
                app.classList.add('dark-mode');
            }
            document.body.classList.add('dark-mode');
        }
    },

    release(button) {
        this.buttons[button] = false;
    },

    isPressed(button) {
        return this.buttons[button];
    },

    releaseAll() {
        Object.keys(this.buttons).forEach(key => {
            this.buttons[key] = false;
        });
    }
};
