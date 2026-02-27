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

    initDpad() {
        const container = document.getElementById('dpad-container');
        if (!container) return;

        // タッチ操作（仮想D-Pad）
        const handleTouch = (e) => {
            e.preventDefault();
            // targetTouchesを使用して、この要素上のタッチのみを取得（マルチタッチ対策）
            const touch = e.targetTouches[0];
            if (!touch) return;

            const rect = container.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const x = touch.clientX - rect.left - centerX;
            const y = touch.clientY - rect.top - centerY;

            // デッドゾーン判定（中心から10px以内は入力なし）
            const distance = Math.sqrt(x * x + y * y);
            if (distance < 10) {
                this.releaseAllDpad();
                return;
            }

            // 角度計算 (-PI ~ PI)
            const angle = Math.atan2(y, x);
            // 度数法に変換 (-180 ~ 180)
            const deg = angle * (180 / Math.PI);

            // 全方向リセット
            this.releaseAllDpad();

            // 8方向判定 (22.5度ずつずらして45度刻み)
            // 右: -22.5 ~ 22.5
            // 右下: 22.5 ~ 67.5
            // 下: 67.5 ~ 112.5
            // 左下: 112.5 ~ 157.5
            // 左: 157.5 ~ 180, -180 ~ -157.5
            // 左上: -157.5 ~ -112.5
            // 上: -112.5 ~ -67.5
            // 右上: -67.5 ~ -22.5

            if (deg > -67.5 && deg <= -22.5) { // 右上
                this.press('up');
                this.press('right');
            } else if (deg > -112.5 && deg <= -67.5) { // 上
                this.press('up');
            } else if (deg > -157.5 && deg <= -112.5) { // 左上
                this.press('up');
                this.press('left');
            } else if (deg > 157.5 || deg <= -157.5) { // 左
                this.press('left');
            } else if (deg > 112.5 && deg <= 157.5) { // 左下
                this.press('down');
                this.press('left');
            } else if (deg > 67.5 && deg <= 112.5) { // 下
                this.press('down');
            } else if (deg > 22.5 && deg <= 67.5) { // 右下
                this.press('down');
                this.press('right');
            } else { // 右
                this.press('right');
            }
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

        // PCでのデバッグ用（マウス操作）: マウスダウン中のみ追従
        let isMouseDown = false;
        container.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            handleTouch({ padding: true, preventDefault: () => { }, touches: [{ clientX: e.clientX, clientY: e.clientY }] });
        });
        container.addEventListener('mousemove', (e) => {
            if (isMouseDown) {
                handleTouch({ padding: true, preventDefault: () => { }, touches: [{ clientX: e.clientX, clientY: e.clientY }] });
            }
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
            const threshold = this.startLongPressThreshold; // 800ms

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

        document.addEventListener('keydown', (e) => {
            const btn = keyMap[e.code];
            if (btn && App.currentScreen === 'play') {
                e.preventDefault();
                this.press(btn);
            }

            // Enterキー = Startボタン
            if (e.code === 'Enter' && App.currentScreen === 'play') {
                e.preventDefault();
                if (typeof GameEngine !== 'undefined') {
                    GameEngine.togglePause();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
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
