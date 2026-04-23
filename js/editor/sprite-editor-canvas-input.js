/**
 * SpriteCanvasInput
 * キャンバスイベント・描画・選択・ガイド画像を管理
 * 固有状態: isDrawing, drawMode, lastPixel, isPanning 等
 * 共有状態: editor.xxx 経由でアクセス
 */
const SpriteCanvasInput = {
    editor: null,

    // 固有状態（SpriteEditor に持たない）
    isDrawing: false,
    drawMode: 'draw',
    lastPixel: { x: -1, y: -1 },
    hasMoved: false,
    autoScrollTimer: null,
    autoScrollDelayTimer: null,
    autoScrollX: 0,
    autoScrollY: 0,
    lastPointerEvent: null,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    pendingTouch: null,
    touchStartTimer: null,
    isMovingSelection: false,
    selectionMoveStart: null,

    init(parentEditor) {
        this.editor = parentEditor;
        this.initCanvasEvents();
    },

    initCanvasEvents() {
        if (!this.editor.canvas) return;

        const newCanvas = this.editor.canvas.cloneNode(true);
        if (this.editor.canvas.parentNode) this.editor.canvas.parentNode.replaceChild(newCanvas, this.editor.canvas);
        this.editor.canvas = newCanvas;
        this.editor.ctx = this.editor.canvas.getContext('2d');

        // PC用キーボードショートカット: Shift + 矢印キーでビューポートをパン
        document.addEventListener('keydown', (e) => {
            if (App.currentScreen !== 'paint') return;
            if (this.editor.getCurrentSpriteSize() !== 2) return;  // 32x32のみ
            if (!e.shiftKey) return;

            const step = this.editor.pixelSize;  // 1タイル分 = 20px
            const maxScroll = 16 * this.editor.pixelSize;  // 最大320px

            switch (e.key) {
                case 'ArrowRight':
                    this.editor.viewportOffsetX = Math.min(maxScroll, this.editor.viewportOffsetX + step);
                    e.preventDefault();
                    this.editor.render();
                    break;
                case 'ArrowLeft':
                    this.editor.viewportOffsetX = Math.max(0, this.editor.viewportOffsetX - step);
                    e.preventDefault();
                    this.editor.render();
                    break;
                case 'ArrowDown':
                    this.editor.viewportOffsetY = Math.min(maxScroll, this.editor.viewportOffsetY + step);
                    e.preventDefault();
                    this.editor.render();
                    break;
                case 'ArrowUp':
                    this.editor.viewportOffsetY = Math.max(0, this.editor.viewportOffsetY - step);
                    e.preventDefault();
                    this.editor.render();
                    break;
            }
        });

        // --- PC: マウスホイールスクロール（32x32時のみ） ---
        this.editor.canvas.addEventListener('wheel', (e) => {
            if (App.currentScreen !== 'paint') return;
            if (this.editor.getCurrentSpriteSize() !== 2) return;
            e.preventDefault();
            const maxScroll = 16 * this.editor.pixelSize;
            const speed = 0.3;
            const dx = (e.shiftKey ? e.deltaY : 0) * speed;
            const dy = (e.shiftKey ? 0 : e.deltaY) * speed;
            if (!Number.isFinite(this.editor.viewportOffsetX)) this.editor.viewportOffsetX = 0;
            if (!Number.isFinite(this.editor.viewportOffsetY)) this.editor.viewportOffsetY = 0;
            this.editor.viewportOffsetX = Math.max(0, Math.min(maxScroll, this.editor.viewportOffsetX + dx));
            this.editor.viewportOffsetY = Math.max(0, Math.min(maxScroll, this.editor.viewportOffsetY + dy));
            this.editor.render();
        }, { passive: false });

        // --- PC: 中ボタンドラッグパン（32x32時のみ） ---
        let isSpriteMiddlePan = false;
        let spriteMidPanX = 0, spriteMidPanY = 0;
        this.editor.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                if (App.currentScreen !== 'paint') return;
                if (this.editor.getCurrentSpriteSize() !== 2) return;
                e.preventDefault();
                isSpriteMiddlePan = true;
                spriteMidPanX = e.clientX;
                spriteMidPanY = e.clientY;
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (!isSpriteMiddlePan) return;
            const maxScroll = 16 * this.editor.pixelSize;
            const dx = spriteMidPanX - e.clientX;
            const dy = spriteMidPanY - e.clientY;
            spriteMidPanX = e.clientX;
            spriteMidPanY = e.clientY;
            if (!Number.isFinite(this.editor.viewportOffsetX)) this.editor.viewportOffsetX = 0;
            if (!Number.isFinite(this.editor.viewportOffsetY)) this.editor.viewportOffsetY = 0;
            this.editor.viewportOffsetX = Math.max(0, Math.min(maxScroll, this.editor.viewportOffsetX + dx));
            this.editor.viewportOffsetY = Math.max(0, Math.min(maxScroll, this.editor.viewportOffsetY + dy));
            this.editor.render();
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 1) isSpriteMiddlePan = false;
        });

        this.editor.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        this.editor.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
        document.addEventListener('mouseup', () => this.onPointerUp());


        // 2本指パン誤入力防止用の変数
        this.pendingTouch = null;
        this.touchStartTimer = null;

        this.editor.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();

            // 既存のタイマーをクリア
            if (this.touchStartTimer) {
                clearTimeout(this.touchStartTimer);
                this.touchStartTimer = null;
            }

            // 2本指の場合
            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const centerX = (touch1.clientX + touch2.clientX) / 2;
                const centerY = (touch1.clientY + touch2.clientY) / 2;
                const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

                // おてほん調整モードの場合
                if (this.editor.guideAdjustMode && this.editor.guideImage) {
                    this.pendingTouch = null;
                    const angle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
                    this.editor.guideAdjustData = {
                        startCenterX: centerX,
                        startCenterY: centerY,
                        startDist: dist,
                        startAngle: angle,
                        startScale: this.editor.guideScale,
                        startRotation: this.editor.guideRotation,
                        startOffsetX: this.editor.guideOffsetX,
                        startOffsetY: this.editor.guideOffsetY
                    };
                } else if (this.editor.getCurrentSpriteSize() === 2) {
                    // 通常の32x32パン
                    this.isPanning = true;
                    this.pendingTouch = null;
                    this.panStartX = centerX;
                    this.panStartY = centerY;
                }
            } else if (e.touches.length === 1) {
                // 1本指の場合、少し待ってから描画開始（2本指検出のため）
                this.pendingTouch = e.touches[0];
                this.touchStartTimer = setTimeout(() => {
                    if (this.pendingTouch && !this.isPanning) {
                        this.onPointerDown(this.pendingTouch);
                    }
                    this.pendingTouch = null;
                    this.touchStartTimer = null;
                }, 50);
            }
        }, { passive: false });

        this.editor.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const centerX = (touch1.clientX + touch2.clientX) / 2;
                const centerY = (touch1.clientY + touch2.clientY) / 2;
                const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

                // おてほん調整モードの場合
                if (this.editor.guideAdjustData) {
                    const pixelSize = this.editor.pixelSize;

                    // 位置移動（ピクセル単位に変換）
                    const deltaX = (centerX - this.editor.guideAdjustData.startCenterX) / pixelSize;
                    const deltaY = (centerY - this.editor.guideAdjustData.startCenterY) / pixelSize;
                    this.editor.guideOffsetX = this.editor.guideAdjustData.startOffsetX + deltaX;
                    this.editor.guideOffsetY = this.editor.guideAdjustData.startOffsetY + deltaY;

                    // スケール変更（ピンチズーム）
                    const scaleRatio = dist / this.editor.guideAdjustData.startDist;
                    this.editor.guideScale = Math.max(0.1, Math.min(5, this.editor.guideAdjustData.startScale * scaleRatio));

                    // 回転（ローテートジェスチャー）
                    const currentAngle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
                    const angleDelta = currentAngle - this.editor.guideAdjustData.startAngle;
                    this.editor.guideRotation = this.editor.guideAdjustData.startRotation + angleDelta;

                    this.editor.render();
                } else if (this.isPanning && this.editor.getCurrentSpriteSize() === 2) {
                    // 通常の32x32パン処理
                    if (!Number.isFinite(this.panStartX) || !Number.isFinite(this.panStartY)) {
                        this.panStartX = centerX;
                        this.panStartY = centerY;
                        return;
                    }

                    const deltaX = this.panStartX - centerX;
                    const deltaY = this.panStartY - centerY;
                    const maxScroll = 16 * this.editor.pixelSize;

                    if (!Number.isFinite(this.editor.viewportOffsetX)) this.editor.viewportOffsetX = 0;
                    if (!Number.isFinite(this.editor.viewportOffsetY)) this.editor.viewportOffsetY = 0;

                    this.editor.viewportOffsetX = Math.max(0, Math.min(maxScroll, this.editor.viewportOffsetX + deltaX));
                    this.editor.viewportOffsetY = Math.max(0, Math.min(maxScroll, this.editor.viewportOffsetY + deltaY));

                    this.panStartX = centerX;
                    this.panStartY = centerY;
                    this.editor.render();
                }
            } else if (e.touches.length === 1 && !this.isPanning) {
                // 2本指パン/調整中でなければ、描画を続行
                if (this.isDrawing) {
                    this.onPointerMove(e.touches[0]);
                }
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            // タイマーをクリア
            if (this.touchStartTimer) {
                clearTimeout(this.touchStartTimer);
                this.touchStartTimer = null;
            }
            this.pendingTouch = null;
            this.isPanning = false;
            this.editor.guideAdjustData = null; // おてほん調整データをリセット
            this.onPointerUp();
            this.editor.guideAdjustData = null; // おてほん調整データをリセット
            this.stopAutoScroll();
            this.onPointerUp();
        });
    },

    // オートスクロール開始
    startAutoScroll(dx, dy) {
        this.autoScrollX = dx;
        this.autoScrollY = dy;
        if (this.autoScrollTimer || this.autoScrollDelayTimer) return;

        // 300ms待ってからスクロール開始
        this.autoScrollDelayTimer = setTimeout(() => {
            this.autoScrollDelayTimer = null;
            this.autoScrollTimer = setInterval(() => {
                const dimension = this.editor.getCurrentSpriteDimension();
                // 32x32以外や描画停止時は終了
                if (dimension !== 32 || (!this.editor.isSelecting && !this.isMovingSelection && !this.editor.pasteMode)) {
                    this.stopAutoScroll();
                    return;
                }

                // スクロール実行
                const oldX = this.editor.viewportOffsetX;
                const oldY = this.editor.viewportOffsetY;
                const maxScroll = Math.max(0, dimension * this.editor.pixelSize - this.editor.canvas.width);

                this.editor.viewportOffsetX = Math.max(0, Math.min(maxScroll, this.editor.viewportOffsetX + this.autoScrollX));
                this.editor.viewportOffsetY = Math.max(0, Math.min(maxScroll, this.editor.viewportOffsetY + this.autoScrollY));

                if (this.editor.viewportOffsetX === oldX && this.editor.viewportOffsetY === oldY) return;

                // 座標更新のために直前のイベントで再処理
                if (this.lastPointerEvent) {
                    this.onPointerMove(this.lastPointerEvent);
                }
                this.editor.render();
            }, 30);
        }, 300);
    },

    stopAutoScroll() {
        if (this.autoScrollDelayTimer) {
            clearTimeout(this.autoScrollDelayTimer);
            this.autoScrollDelayTimer = null;
        }
        if (this.autoScrollTimer) {
            clearInterval(this.autoScrollTimer);
            this.autoScrollTimer = null;
        }
    },

    getPixelFromEvent(e) {
        const rect = this.editor.canvas.getBoundingClientRect();

        // CSSによる拡大縮小を考慮してスケールを計算
        const scaleX = this.editor.canvas.width / rect.width;
        const scaleY = this.editor.canvas.height / rect.height;

        // オフセットをピクセル単位からタイル単位に変換
        const offsetX = Math.floor(this.editor.viewportOffsetX / this.editor.pixelSize);
        const offsetY = Math.floor(this.editor.viewportOffsetY / this.editor.pixelSize);

        // クライアント座標 → 内部キャンバス座標に変換してタイル計算
        const x = Math.floor((e.clientX - rect.left) * scaleX / this.editor.pixelSize) + offsetX;
        const y = Math.floor((e.clientY - rect.top) * scaleY / this.editor.pixelSize) + offsetY;
        return { x, y };
    },

    onPointerDown(e) {
        if (App.currentScreen !== 'paint') return;
        // 中ボタン（パン用）は描画に使わない
        if (e.button !== undefined && e.button !== 0) return;
        this.hasMoved = false;

        const pixel = this.getPixelFromEvent(e);
        const dimension = this.editor.getCurrentSpriteDimension();

        if (pixel.x < 0 || pixel.x >= dimension || pixel.y < 0 || pixel.y >= dimension) {
            return;
        }

        // 範囲選択モード
        if (this.editor.selectionMode) {
            this.isDrawing = true;

            // 既存の選択範囲内をクリックした場合は移動モード
            if (this.editor.selectionStart && this.editor.selectionEnd && this.isPointInSelection(pixel.x, pixel.y)) {

                // まだ浮動化していないなら、ここで浮動化（Cut）
                if (!this.editor.isFloating) {
                    this.editor.saveHistory(); // 移動開始前の状態を保存
                    this.floatSelection();
                }

                this.selectionMoveStart = { x: pixel.x, y: pixel.y };
                this.isMovingSelection = true;
            } else {
                // 新規選択
                if (this.editor.isFloating) {
                    this.commitFloatingData(); // 以前の選択を確定
                }
                this.editor.isSelecting = true; // 新規選択フラグ（色制御用）
                this.editor.selectionStart = { x: pixel.x, y: pixel.y };
                this.editor.selectionEnd = { x: pixel.x, y: pixel.y };
                this.isMovingSelection = false;
            }
            this.editor.render();
            return;
        }

        // ペーストモード（どこでもドラッグ開始、指を離すと確定）
        if (this.editor.pasteMode && this.editor.pasteData) {
            this.isDrawing = true;
            this.editor.pasteDragStart = { x: pixel.x, y: pixel.y };
            return;
        }

        this.isDrawing = true;

        // 描画開始時に履歴を保存
        this.editor.saveHistory();

        const sprite = App.projectData.sprites[this.editor.currentSprite];

        // 配列の存在を確認（32x32への拡張が正しく行われていない場合のフォールバック）
        if (!sprite.data[pixel.y] || typeof sprite.data[pixel.y][pixel.x] === 'undefined') {
            console.warn('Sprite data access out of bounds:', pixel.x, pixel.y, 'data size:', sprite.data.length);
            // データ配列を自動拡張
            const dimension = this.editor.getCurrentSpriteDimension();
            while (sprite.data.length < dimension) {
                sprite.data.push(Array(dimension).fill(-1));
            }
            for (let row of sprite.data) {
                while (row.length < dimension) {
                    row.push(-1);
                }
            }
        }

        const currentVal = sprite.data[pixel.y][pixel.x];

        if (this.editor.currentTool === 'pen') {
            if (currentVal === this.editor.selectedColor) {
                this.drawMode = 'erase';
            } else {
                this.drawMode = 'draw';
            }
        } else {
            this.drawMode = 'draw';
        }

        this.processPixel(pixel.x, pixel.y);
    },

    onPointerMove(e) {
        if (!this.isDrawing || App.currentScreen !== 'paint') return;
        this.hasMoved = true;

        this.lastPointerEvent = e;

        // オートスクロール判定
        const dimension = this.editor.getCurrentSpriteDimension();
        if (dimension === 32 && (this.editor.isSelecting || this.isMovingSelection || this.editor.pasteMode)) {
            const rect = this.editor.canvas.getBoundingClientRect();
            const clientX = e.clientX ?? e.touches?.[0]?.clientX;
            const clientY = e.clientY ?? e.touches?.[0]?.clientY;

            if (clientX !== undefined && clientY !== undefined) {
                const edgeSize = 30;
                const scrollSpeed = 15;
                let dx = 0;
                let dy = 0;

                if (clientX < rect.left + edgeSize) dx = -scrollSpeed;
                else if (clientX > rect.right - edgeSize) dx = scrollSpeed;

                if (clientY < rect.top + edgeSize) dy = -scrollSpeed;
                else if (clientY > rect.bottom - edgeSize) dy = scrollSpeed;

                if (dx !== 0 || dy !== 0) {
                    this.startAutoScroll(dx, dy);
                } else {
                    this.stopAutoScroll();
                }
            }
        }

        const pixel = this.getPixelFromEvent(e);

        // 範囲選択モード
        if (this.editor.selectionMode) {
            const dimension = this.editor.getCurrentSpriteDimension();

            if (this.isMovingSelection && this.selectionMoveStart) {
                // 選択範囲の移動
                const dx = pixel.x - this.selectionMoveStart.x;
                const dy = pixel.y - this.selectionMoveStart.y;

                if (dx !== 0 || dy !== 0) {
                    this.editor.selectionStart.x += dx;
                    this.editor.selectionStart.y += dy;
                    this.editor.selectionEnd.x += dx;
                    this.editor.selectionEnd.y += dy;

                    if (this.editor.isFloating) {
                        this.editor.floatingPos.x += dx;
                        this.editor.floatingPos.y += dy;
                    }

                    this.selectionMoveStart = { x: pixel.x, y: pixel.y };
                }
            } else {
                // 範囲選択中
                this.editor.selectionEnd = {
                    x: Math.max(0, Math.min(dimension - 1, pixel.x)),
                    y: Math.max(0, Math.min(dimension - 1, pixel.y))
                };
            }
            this.editor.render();
            return;
        }

        // ペーストモード（ドラッグ移動）
        if (this.editor.pasteMode && this.editor.pasteDragStart) {
            const dx = pixel.x - this.editor.pasteDragStart.x;
            const dy = pixel.y - this.editor.pasteDragStart.y;
            this.editor.pasteOffset.x += dx;
            this.editor.pasteOffset.y += dy;
            this.editor.pasteDragStart = { x: pixel.x, y: pixel.y };
            this.editor.render();
            return;
        }

        if (pixel.x !== this.lastPixel.x || pixel.y !== this.lastPixel.y) {
            // ペンツールの消去モード時はドラッグで連続消去しない（タップのみ）
            if (this.editor.currentTool === 'pen' && this.drawMode === 'erase') {
                // 何もしない（タップ時の1回のみ消去）
            } else {
                this.processPixel(pixel.x, pixel.y);
            }
        }
    },

    onPointerUp() {
        this.stopAutoScroll();
        this.lastPointerEvent = null;
        if (!this.isDrawing) return;

        this.isDrawing = false;
        this.lastPixel = { x: -1, y: -1 };

        // 範囲選択モード（ドラッグ終了のみ、確定はボタンで行う→指を離すとライトグリーンになる）
        if (this.editor.selectionMode) {
            this.editor.isSelecting = false; // 新規選択完了（色はライトグリーンへ）

            if (!this.hasMoved && !this.isMovingSelection) {
                this.cancelSelectionMode();
            }
            this.isMovingSelection = false;
            this.selectionMoveStart = null;
            this.editor.render(); // 色更新のため再描画
            return;
        }

        // ペーストモード：指を離すと確定
        if (this.editor.pasteMode && this.editor.pasteData) {
            this.confirmPaste();
            this.editor.pasteDragStart = null;
            return;
        }

        this.editor.initSpriteGallery();
    },

    processPixel(x, y) {
        const dimension = this.editor.getCurrentSpriteDimension();
        if (x < 0 || x >= dimension || y < 0 || y >= dimension) return;

        const sprite = App.projectData.sprites[this.editor.currentSprite];
        if (!sprite) return;

        // 配列の存在を確認
        if (!sprite.data[y] || typeof sprite.data[y][x] === 'undefined') {
            console.warn('processPixel: data access out of bounds');
            return;
        }

        this.lastPixel = { x, y };

        switch (this.editor.currentTool) {
            case 'pen':
                if (this.drawMode === 'erase') {
                    sprite.data[y][x] = -1;
                } else {
                    sprite.data[y][x] = this.editor.selectedColor;
                }
                break;
            case 'eraser':
                // 選択範囲がある場合はその範囲内のみ消去
                if (this.editor.selectionStart && this.editor.selectionEnd) {
                    if (this.isPointInSelection(x, y)) {
                        sprite.data[y][x] = -1;
                    }
                } else {
                    sprite.data[y][x] = -1;
                }
                break;
            case 'fill':
                this.floodFill(x, y, sprite.data[y][x], this.editor.selectedColor);
                break;
            case 'eyedropper':
                const pickedColor = sprite.data[y][x];
                if (pickedColor >= 0) {
                    SpriteEditorPalette.selectColor(pickedColor);
                }
                break;
        }

        this.editor.render();
    },

    floodFill(x, y, targetColor, newColor) {
        if (targetColor === newColor) return;

        const sprite = App.projectData.sprites[this.editor.currentSprite];
        const dimension = this.editor.getCurrentSpriteDimension();
        const q = [[x, y]];
        let iterations = 0;

        while (q.length && iterations < 1000) {
            iterations++;
            const [cx, cy] = q.pop();

            if (cx >= 0 && cx < dimension && cy >= 0 && cy < dimension) {
                if (sprite.data[cy][cx] === targetColor) {
                    sprite.data[cy][cx] = newColor;
                    q.push([cx + 1, cy]);
                    q.push([cx - 1, cy]);
                    q.push([cx, cy + 1]);
                    q.push([cx, cy - 1]);
                }
            }
        }
    },

    clearSprite() {
        const msg = App.I18N['U188']?.[App.currentLang] || 'スプライトをクリアしますか？';
        App.showConfirm(msg, '', () => {
            this.editor.saveHistory();
            const sprite = App.projectData.sprites[this.editor.currentSprite];
            const dimension = this.editor.getCurrentSpriteDimension();
            for (let y = 0; y < dimension; y++) {
                for (let x = 0; x < dimension; x++) {
                    sprite.data[y][x] = -1;
                }
            }
            this.editor.render();
            this.editor.initSpriteGallery();
        });
    },

    clearSelectionArea() {
        if (!this.editor.selectionStart || !this.editor.selectionEnd) return;

        this.editor.saveHistory();
        const sprite = App.projectData.sprites[this.editor.currentSprite];
        const x1 = Math.min(this.editor.selectionStart.x, this.editor.selectionEnd.x);
        const y1 = Math.min(this.editor.selectionStart.y, this.editor.selectionEnd.y);
        const x2 = Math.max(this.editor.selectionStart.x, this.editor.selectionEnd.x);
        const y2 = Math.max(this.editor.selectionStart.y, this.editor.selectionEnd.y);

        for (let y = y1; y <= y2; y++) {
            if (!sprite.data[y]) continue;
            for (let x = x1; x <= x2; x++) {
                if (typeof sprite.data[y][x] !== 'undefined') {
                    sprite.data[y][x] = -1;
                }
            }
        }
        this.editor.render();
        this.editor.initSpriteGallery();
    },

    isPointInSelection(x, y) {
        if (!this.editor.selectionStart || !this.editor.selectionEnd) return false;
        const x1 = Math.min(this.editor.selectionStart.x, this.editor.selectionEnd.x);
        const y1 = Math.min(this.editor.selectionStart.y, this.editor.selectionEnd.y);
        const x2 = Math.max(this.editor.selectionStart.x, this.editor.selectionEnd.x);
        const y2 = Math.max(this.editor.selectionStart.y, this.editor.selectionEnd.y);
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    },

    // 範囲選択モード開始
    startSelectionMode() {
        this.editor.selectionMode = true;
        this.editor.pasteMode = false;
        // 既存の選択がない場合は初期化（維持することでツール切り替えに対応）
        if (!this.editor.selectionStart) {
            this.editor.selectionStart = null;
            this.editor.selectionEnd = null;
        }
        this.editor.currentTool = 'select';
        this.editor.isSelecting = false;

        // 以前の浮動データがあれば確定
        if (this.editor.isFloating) {
            this.commitFloatingData();
        }
        this.editor.isFloating = false;
        this.editor.floatingData = null;

        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'select');
        });
        this.editor.render();
    },

    cancelSelectionMode() {
        if (!this.editor.selectionMode) return;

        if (this.editor.isFloating) {
            this.commitFloatingData();
        }

        this.editor.selectionMode = false;
        this.editor.selectionStart = null;
        this.editor.selectionEnd = null;

        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'select' && this.editor.selectionMode);
        });

        this.editor.render();
    },

    // ペーストモード開始
    pasteSprite() {
        if (!this.editor.rangeClipboard || this.editor.rangeClipboard.length === 0) {
            return;
        }
        this.editor.pasteMode = true;
        this.editor.selectionMode = false;
        this.editor.pasteData = JSON.parse(JSON.stringify(this.editor.rangeClipboard));
        // スクロール位置に応じて配置（例：画面左上から+2ずらした位置）
        const offsetX = Math.floor((this.editor.viewportOffsetX || 0) / this.editor.pixelSize);
        const offsetY = Math.floor((this.editor.viewportOffsetY || 0) / this.editor.pixelSize);
        this.editor.pasteOffset = {
            x: Math.max(0, offsetX + 2),
            y: Math.max(0, offsetY + 2)
        };
        this.editor.currentTool = 'paste';
        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'paste');
        });
        this.editor.render();
    },

    // 選択範囲をコピー
    copySelection() {
        if (!this.editor.selectionStart || !this.editor.selectionEnd) {
            return;
        }

        const sprite = App.projectData.sprites[this.editor.currentSprite];
        const x1 = Math.min(this.editor.selectionStart.x, this.editor.selectionEnd.x);
        const y1 = Math.min(this.editor.selectionStart.y, this.editor.selectionEnd.y);
        const x2 = Math.max(this.editor.selectionStart.x, this.editor.selectionEnd.x);
        const y2 = Math.max(this.editor.selectionStart.y, this.editor.selectionEnd.y);

        // 範囲内のデータをコピー
        const data = [];
        for (let y = y1; y <= y2; y++) {
            const row = [];
            for (let x = x1; x <= x2; x++) {
                row.push(sprite.data[y][x]);
            }
            data.push(row);
        }
        this.editor.rangeClipboard = data;

        // コピー後、選択を解除する
        this.editor.isSelecting = false;
        this.editor.selectionStart = null;
        this.editor.selectionEnd = null;

        this.editor.render();
    },

    // ペースト確定
    confirmPaste() {
        if (!this.editor.pasteData) return;

        this.editor.saveHistory();
        const sprite = App.projectData.sprites[this.editor.currentSprite];
        const dataH = this.editor.pasteData.length;
        const dataW = this.editor.pasteData[0].length;

        for (let dy = 0; dy < dataH; dy++) {
            for (let dx = 0; dx < dataW; dx++) {
                const tx = this.editor.pasteOffset.x + dx;
                const ty = this.editor.pasteOffset.y + dy;
                const dimension = this.editor.getCurrentSpriteDimension();
                if (tx >= 0 && tx < dimension && ty >= 0 && ty < dimension) {
                    const val = this.editor.pasteData[dy][dx];
                    if (val >= 0) { // 透明以外を上書き
                        sprite.data[ty][tx] = val;
                    }
                }
            }
        }

        // ペーストモード終了
        this.editor.pasteMode = false;
        this.editor.pasteData = null;
        this.editor.currentTool = 'pen';
        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'pen');
        });
        this.editor.render();
        this.editor.initSpriteGallery();
    },

    flipVertical() {
        // ペーストモード時はペーストデータを反転
        if (this.editor.pasteMode && this.editor.pasteData) {
            this.editor.pasteData.reverse();
            this.editor.render();
            return;
        }

        // 浮動選択範囲（移動中）を優先して反転
        if (this.editor.isFloating && this.editor.floatingData) {
            this.editor.floatingData.reverse();
            this.editor.render();
            return;
        }

        // 静的な選択範囲があればその範囲内のみ反転
        if (this.editor.selectionStart && this.editor.selectionEnd) {
            const x1 = Math.min(this.editor.selectionStart.x, this.editor.selectionEnd.x);
            const y1 = Math.min(this.editor.selectionStart.y, this.editor.selectionEnd.y);
            const x2 = Math.max(this.editor.selectionStart.x, this.editor.selectionEnd.x);
            const y2 = Math.max(this.editor.selectionStart.y, this.editor.selectionEnd.y);
            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            const sprite = App.projectData.sprites[this.editor.currentSprite];
            const temp = [];
            for (let y = 0; y < h; y++) {
                temp.push([...sprite.data[y1 + y].slice(x1, x1 + w)]);
            }
            temp.reverse();
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    sprite.data[y1 + y][x1 + x] = temp[y][x];
                }
            }
            this.editor.render();
            this.editor.initSpriteGallery();
            return;
        }

        // 選択範囲がない場合は全体を反転
        const sprite = App.projectData.sprites[this.editor.currentSprite];
        sprite.data.reverse();
        this.editor.render();
        this.editor.initSpriteGallery();
    },

    flipHorizontal() {
        // ペーストモード時はペーストデータを反転
        if (this.editor.pasteMode && this.editor.pasteData) {
            this.editor.pasteData.forEach(row => row.reverse());
            this.editor.render();
            return;
        }

        // 浮動選択範囲（移動中）を優先して反転
        if (this.editor.isFloating && this.editor.floatingData) {
            this.editor.floatingData.forEach(row => row.reverse());
            this.editor.render();
            return;
        }

        // 静的な選択範囲があればその範囲内のみ反転
        if (this.editor.selectionStart && this.editor.selectionEnd) {
            const x1 = Math.min(this.editor.selectionStart.x, this.editor.selectionEnd.x);
            const y1 = Math.min(this.editor.selectionStart.y, this.editor.selectionEnd.y);
            const x2 = Math.max(this.editor.selectionStart.x, this.editor.selectionEnd.x);
            const y2 = Math.max(this.editor.selectionStart.y, this.editor.selectionEnd.y);
            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            const sprite = App.projectData.sprites[this.editor.currentSprite];
            for (let y = 0; y < h; y++) {
                const row = sprite.data[y1 + y].slice(x1, x1 + w);
                row.reverse();
                for (let x = 0; x < w; x++) {
                    sprite.data[y1 + y][x1 + x] = row[x];
                }
            }
            this.editor.render();
            this.editor.initSpriteGallery();
            return;
        }

        // 選択範囲がない場合は全体を反転
        const sprite = App.projectData.sprites[this.editor.currentSprite];
        sprite.data.forEach(row => row.reverse());
        this.editor.render();
        this.editor.initSpriteGallery();
    },

    // ========== おてほん（下絵ガイド） ==========
    handleGuideButtonClick() {
        if (!this.editor.guideImage) {
            // 画像未読込み → 読み込みダイアログ
            this.loadGuideImage();
        } else {
            // 読込み済み → 表示ON/OFF切り替え
            this.toggleGuideImage();
        }
    },

    loadGuideImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        // DOMに追加して参照を維持（iOS等でのガベージコレクション対策）
        document.body.appendChild(input);

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                document.body.removeChild(input);
                return;
            }

            const img = new Image();
            img.onload = () => {
                // 高解像度で保存（256pxにフィット、アスペクト比保持）
                const maxSize = 256;
                let width = img.width;
                let height = img.height;

                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round(height * maxSize / width);
                        width = maxSize;
                    } else {
                        width = Math.round(width * maxSize / height);
                        height = maxSize;
                    }
                }

                // オフスクリーンキャンバスに描画
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                this.editor.guideImage = canvas;
                this.editor.guideImageVisible = true;
                // 初期位置・スケールをリセット
                this.editor.guideScale = 1;
                this.editor.guideOffsetX = 0;
                this.editor.guideOffsetY = 0;
                // 調整モードON（初回読込み時のみ）
                this.editor.guideAdjustMode = true;
                this.updateGuideButtonState();
                this.editor.render();

                // ObjectURLを解放
                URL.revokeObjectURL(img.src);
                // input要素を削除
                document.body.removeChild(input);
            };
            img.onerror = () => {
                console.error('Guide image load failed');
                document.body.removeChild(input);
            };
            img.src = URL.createObjectURL(file);
        };
        input.click();
    },

    toggleGuideImage() {
        this.editor.guideImageVisible = !this.editor.guideImageVisible;
        this.updateGuideButtonState();
        this.editor.render();
    },

    resetGuideImage() {
        this.editor.guideImage = null;
        this.editor.guideImageVisible = false;
        this.editor.guideScale = 1;
        this.editor.guideOffsetX = 0;
        this.editor.guideOffsetY = 0;
        this.editor.guideRotation = 0;
        this.editor.guideAdjustMode = false;
        this.editor.guideAdjustData = null;
        this.updateGuideButtonState();
        this.editor.render();
    },

    updateGuideButtonState() {
        const btn = document.querySelector('#paint-tools .paint-tool-btn[data-tool="guide"]');
        if (btn) {
            btn.classList.toggle('guide-active', this.editor.guideImage && this.editor.guideImageVisible);
            btn.classList.toggle('guide-loaded', this.editor.guideImage !== null);
        }
    },

    floatSelection() {
        if (!this.editor.selectionStart || !this.editor.selectionEnd) return;
        const x1 = Math.min(this.editor.selectionStart.x, this.editor.selectionEnd.x);
        const y1 = Math.min(this.editor.selectionStart.y, this.editor.selectionEnd.y);
        const x2 = Math.max(this.editor.selectionStart.x, this.editor.selectionEnd.x);
        const y2 = Math.max(this.editor.selectionStart.y, this.editor.selectionEnd.y);
        const w = x2 - x1 + 1;
        const h = y2 - y1 + 1;

        const floatingData = [];
        const sprite = App.projectData.sprites[this.editor.currentSprite];

        // データを抽出して元データを消去
        for (let y = 0; y < h; y++) {
            const row = [];
            for (let x = 0; x < w; x++) {
                // 配列境界チェック
                if (sprite.data[y + y1] && typeof sprite.data[y + y1][x + x1] !== 'undefined') {
                    const val = sprite.data[y + y1][x + x1];
                    row.push(val);
                    sprite.data[y + y1][x + x1] = -1;
                } else {
                    row.push(-1);
                }
            }
            floatingData.push(row);
        }

        this.editor.floatingData = floatingData;
        this.editor.floatingPos = { x: x1, y: y1 };
        this.editor.isFloating = true;
    },

    commitFloatingData() {
        if (!this.editor.isFloating || !this.editor.floatingData) return;

        const sprite = App.projectData.sprites[this.editor.currentSprite];
        const dim = this.editor.getCurrentSpriteDimension();

        // 浮動データをキャンバスに書き戻す
        for (let y = 0; y < this.editor.floatingData.length; y++) {
            for (let x = 0; x < this.editor.floatingData[0].length; x++) {
                const val = this.editor.floatingData[y][x];

                const tx = this.editor.floatingPos.x + x;
                const ty = this.editor.floatingPos.y + y;

                if (tx >= 0 && tx < dim && ty >= 0 && ty < dim) {
                    if (sprite.data[ty]) {
                        sprite.data[ty][tx] = val;
                    }
                }
            }
        }

        this.editor.isFloating = false;
        this.editor.floatingData = null;
        this.editor.render();
    }
};
