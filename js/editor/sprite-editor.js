/**
 * PixelGameKit - スプライトエディタ（新UI対応）
 */

const SpriteEditor = {
    canvas: null,
    ctx: null,
    currentSprite: 0,
    selectedColor: 0,
    currentTool: 'pen',
    isDrawing: false,
    drawMode: 'draw',
    lastPixel: { x: -1, y: -1 },
    clipboard: null,

    // 履歴管理
    history: [],
    historyIndex: -1,
    maxHistory: 20,

    // オートスクロール
    autoScrollTimer: null,
    autoScrollX: 0,
    autoScrollY: 0,
    lastPointerEvent: null, // オートスクロール用イベントキャッシュ

    SPRITE_SIZE: 16,
    pixelSize: 20,

    // 32x32用の追加プロパティ
    viewportOffsetX: 0,
    viewportOffsetY: 0,
    panStartX: 0,
    panStartY: 0,
    isPanning: false,

    // ダブルクリック検出用
    lastSpriteClickTime: 0,
    lastSpriteClickIndex: -1,

    // 範囲選択・ペーストモード
    selectionMode: false,
    selectionStart: null,
    selectionEnd: null,
    rangeClipboard: null,  // 範囲コピー用クリップボード
    isFloating: false,
    floatingData: null,
    floatingPos: { x: 0, y: 0 },
    isSelecting: false,
    pasteMode: false,
    pasteData: null,
    pasteOffset: { x: 0, y: 0 },
    pasteDragStart: null,

    // おてほん（下絵ガイド）
    guideImage: null,          // 読み込んだ画像（Image object）
    guideImageVisible: false,  // 表示ON/OFF
    guideScale: 1,             // ズーム倍率
    guideOffsetX: 0,           // 位置オフセット（ピクセル単位）
    guideOffsetY: 0,
    guideAdjustMode: false,    // 調整モード（初回読込み時のみtrue）
    guideAdjustData: null,     // 調整中の2本指操作用データ
    guideRotation: 0,          // 回転角度（ラジアン）

    init() {
        this.canvas = document.getElementById('paint-canvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');

        SpriteEditorPalette.init(this);
        this.initTools();
        this.initSpriteGallery();
        this.initCanvasEvents();
        SpriteEditorPreview.init(this);
    },

    refresh() {
        SpriteEditorPalette.initColorPalette();
        this.initSpriteGallery();
        this.resize();
        this.render();
    },

    resize() {
        const dimension = this.getCurrentSpriteDimension();
        this.pixelSize = 320 / 16;  // 常に16x16分の表示サイズを維持
        this.canvas.width = 320;
        this.canvas.height = 320;
        this.render();
    },

    // 現在のスプライトのサイズを取得
    getCurrentSpriteSize() {
        const sprite = App.projectData.sprites[this.currentSprite];
        return sprite?.size || 1;
    },

    // 現在のスプライトの実ピクセル数を取得
    getCurrentSpriteDimension() {
        return this.getCurrentSpriteSize() === 2 ? 32 : 16;
    },

    // ========== Undo機能 ==========
    saveHistory() {
        const sprite = App.projectData.sprites[this.currentSprite];
        if (!sprite) return;

        // 現在の状態をディープコピーしてスタックに追加
        const snapshot = JSON.parse(JSON.stringify(sprite.data));
        this.history.push({
            spriteIndex: this.currentSprite,
            data: snapshot
        });

        // 最大履歴数を超えたら古いものを削除
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    },

    undo() {
        if (this.history.length === 0) {
            return;
        }

        const lastState = this.history.pop();
        const sprite = App.projectData.sprites[lastState.spriteIndex];

        if (sprite) {
            sprite.data = lastState.data;
            this.currentSprite = lastState.spriteIndex;
            this.render();
            this.initSpriteGallery();
        }
    },

    // ========== ツール ==========
    initTools() {
        // PIXEL画面専用のツールボタンのみ選択
        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            if (btn.parentNode) btn.parentNode.replaceChild(newBtn, btn);

            // 消しゴム/ガイド長押し検知用
            let pressTimer;
            const startPress = () => {
                if (newBtn.dataset.tool === 'eraser') {
                    pressTimer = setTimeout(() => this.clearSprite(), 800);
                } else if (newBtn.dataset.tool === 'guide') {
                    pressTimer = setTimeout(() => this.resetGuideImage(), 800);
                }
            };
            const cancelPress = () => {
                clearTimeout(pressTimer);
            };

            newBtn.addEventListener('mousedown', startPress);
            newBtn.addEventListener('mouseup', cancelPress);
            newBtn.addEventListener('mouseleave', cancelPress);
            newBtn.addEventListener('touchstart', startPress, { passive: true });
            newBtn.addEventListener('touchend', cancelPress);

            newBtn.addEventListener('click', () => {
                const tool = newBtn.dataset.tool;

                switch (tool) {
                    case 'undo':
                        this.undo();
                        break;
                    case 'select':
                        this.startSelectionMode();
                        break;
                    case 'copy':
                        this.copySelection();
                        break;
                    case 'paste':
                        this.pasteSprite();
                        break;
                    case 'flip-v':
                        this.saveHistory();
                        this.flipVertical();
                        break;
                    case 'flip-h':
                        this.saveHistory();
                        this.flipHorizontal();
                        break;
                    case 'guide':
                        this.handleGuideButtonClick();
                        break;
                    default:
                        // 範囲選択中なら消しゴムツールで一括削除
                        if (tool === 'eraser' && this.selectionStart && this.selectionEnd) {
                            this.clearSelectionArea();
                        }

                        // 選択モードをキャンセル（消しゴム以外のツール、または選択範囲がない場合）
                        this.cancelSelectionMode();
                        this.currentTool = tool;
                        // PIXEL画面のツールのみアクティブ切替
                        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
                            b.classList.toggle('active', b.dataset.tool === tool);
                        });
                        break;
                }
            });
        });
    },

    // ========== スプライトギャラリー（ドラッグ並替え対応） ==========
    initSpriteGallery() {
        const container = document.getElementById('sprite-list');
        if (!container) return;

        container.innerHTML = '';

        App.projectData.sprites.forEach((sprite, index) => {
            const div = document.createElement('div');
            div.className = 'sprite-item' + (index === this.currentSprite ? ' selected' : '');
            div.draggable = true;
            div.dataset.index = index;

            const miniCanvas = document.createElement('canvas');
            miniCanvas.width = 16;
            miniCanvas.height = 16;
            this.renderSpriteToMiniCanvas(sprite, miniCanvas);
            div.appendChild(miniCanvas);

            // 長押しで削除 & スクロール判定
            let longPressTimer;
            let isLongPress = false;
            let touchStartX = 0;
            let touchStartY = 0;
            let isScrolling = false;

            const startLongPress = (e) => {
                isLongPress = false;
                isScrolling = false;
                if (e.touches && e.touches[0]) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                }

                longPressTimer = setTimeout(() => {
                    if (!isScrolling) {
                        isLongPress = true;
                        // アクションメニュー表示
                        App.showActionMenu(null, [
                            { text: App.I18N['U177']?.[App.currentLang] || '複製', action: () => this.duplicateSprite(index) },
                            { text: App.I18N['U178']?.[App.currentLang] || '削除', style: 'destructive', action: () => this.deleteSprite(index, false) },
                            { text: App.I18N['U179']?.[App.currentLang] || 'キャンセル', style: 'cancel' }
                        ]);
                    }
                }, 800);
            };

            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };

            const handleTouchMove = (e) => {
                cancelLongPress();
                if (isScrolling) return;

                if (e.touches && e.touches[0]) {
                    const dx = e.touches[0].clientX - touchStartX;
                    const dy = e.touches[0].clientY - touchStartY;
                    // 10px以上動いたらスクロールとみなす
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                        isScrolling = true;
                    }
                }
            };

            div.addEventListener('mousedown', startLongPress);
            div.addEventListener('mouseup', cancelLongPress);
            div.addEventListener('mouseleave', cancelLongPress);
            div.addEventListener('touchstart', startLongPress, { passive: true });
            div.addEventListener('touchmove', handleTouchMove, { passive: true });
            div.addEventListener('touchend', (e) => {
                cancelLongPress();
                if (isScrolling) return;

                // タッチ用ダブルタップ検出
                if (!isLongPress) {
                    const now = Date.now();
                    if (now - this.lastSpriteClickTime < 300 && this.lastSpriteClickIndex === index) {
                        // ダブルタップ → サイズ切り替え
                        if (e.cancelable) e.preventDefault();
                        this.toggleSpriteSize(index);
                        this.lastSpriteClickTime = 0;
                        this.lastSpriteClickIndex = -1;
                    } else {
                        // シングルタップ → 選択
                        this.currentSprite = index;
                        this.history = [];
                        this.viewportOffsetX = 0;
                        this.viewportOffsetY = 0;
                        this.lastSpriteClickTime = now;
                        this.lastSpriteClickIndex = index;
                        this.initSpriteGallery();
                        this.render();
                    }
                }
            });

            // PC用クリック（マウス）
            div.addEventListener('click', (e) => {
                // タッチデバイスでは touchend で処理するのでスキップ
                if (e.pointerType === 'touch' || 'ontouchstart' in window) return;

                if (!isLongPress) {
                    const now = Date.now();
                    if (now - this.lastSpriteClickTime < 300 && this.lastSpriteClickIndex === index) {
                        // ダブルクリック → サイズ切り替え
                        this.toggleSpriteSize(index);
                        this.lastSpriteClickTime = 0;
                        this.lastSpriteClickIndex = -1;
                    } else {
                        // シングルクリック → 選択
                        this.currentSprite = index;
                        this.history = [];
                        this.viewportOffsetX = 0;
                        this.viewportOffsetY = 0;
                        this.lastSpriteClickTime = now;
                        this.lastSpriteClickIndex = index;
                        this.initSpriteGallery();
                        this.render();
                    }
                }
            });

            container.appendChild(div);
        });

        // 追加ボタン
        const addBtn = document.getElementById('add-sprite-btn');
        if (addBtn) {
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);
            newAddBtn.addEventListener('click', () => {
                this.addNewSprite();
            });
        }
    },

    reorderSprites(fromIndex, toIndex) {
        const sprites = App.projectData.sprites;
        const [moved] = sprites.splice(fromIndex, 1);
        sprites.splice(toIndex, 0, moved);

        // ID振り直し
        sprites.forEach((s, i) => s.id = i);

        // 選択中のスプライトを追跡
        if (this.currentSprite === fromIndex) {
            this.currentSprite = toIndex;
        } else if (fromIndex < this.currentSprite && toIndex >= this.currentSprite) {
            this.currentSprite--;
        } else if (fromIndex > this.currentSprite && toIndex <= this.currentSprite) {
            this.currentSprite++;
        }

        this.initSpriteGallery();
        this.render();
    },

    // ========== 描画 ==========
    render() {
        if (!this.ctx) return;
        // プレビュー連動
        SpriteEditorPreview.renderPreview();
        const sprite = App.projectData.sprites[this.currentSprite];
        if (!sprite) return;

        const palette = App.nesPalette;
        // 背景色を動的に取得
        const bgColor = App.projectData.stage?.bgColor || App.projectData.stage?.backgroundColor || '#3CBCFC';

        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const dimension = this.getCurrentSpriteDimension();

        // 表示範囲（ビューポート）は常に16x16ピクセル分
        try {
            // オフセットが不正な値の場合はリセット
            if (!Number.isFinite(this.viewportOffsetX)) this.viewportOffsetX = 0;
            if (!Number.isFinite(this.viewportOffsetY)) this.viewportOffsetY = 0;

            // オフセットをピクセル単位からタイル単位に変換
            const offsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
            const offsetY = Math.floor(this.viewportOffsetY / this.pixelSize);

            for (let vy = 0; vy < 16; vy++) {
                for (let vx = 0; vx < 16; vx++) {
                    const sx = vx + offsetX;  // スプライト内の実座標
                    const sy = vy + offsetY;

                    // 範囲チェックと配列の存在チェックを厳密に行う
                    if (sx >= 0 && sx < dimension && sy >= 0 && sy < dimension) {
                        // 行データが存在するか確認
                        if (sprite.data[sy] && typeof sprite.data[sy][sx] !== 'undefined') {
                            const colorIndex = sprite.data[sy][sx];
                            if (colorIndex >= 0) {
                                this.ctx.fillStyle = palette[colorIndex];
                                this.ctx.fillRect(vx * this.pixelSize, vy * this.pixelSize, this.pixelSize, this.pixelSize);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Render error:', e);
        }

        // 浮動レイヤー
        if (this.isFloating && this.floatingData) {
            const dimension = this.getCurrentSpriteDimension();
            const offsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
            const offsetY = Math.floor(this.viewportOffsetY / this.pixelSize);

            this.ctx.globalAlpha = 0.5;
            for (let y = 0; y < this.floatingData.length; y++) {
                for (let x = 0; x < this.floatingData[0].length; x++) {
                    const colorIndex = this.floatingData[y][x];
                    if (colorIndex >= 0) {
                        const tx = this.floatingPos.x + x;
                        const ty = this.floatingPos.y + y;

                        if (tx >= 0 && tx < dimension && ty >= 0 && ty < dimension) {
                            const screenX = tx - offsetX;
                            const screenY = ty - offsetY;
                            if (screenX >= 0 && screenX < 16 && screenY >= 0 && screenY < 16) {
                                this.ctx.fillStyle = palette[colorIndex];
                                this.ctx.fillRect(screenX * this.pixelSize, screenY * this.pixelSize, this.pixelSize, this.pixelSize);
                            }
                        }
                    }
                }
            }
            this.ctx.globalAlpha = 1.0;
        }

        // ペーストプレビュー（確定前）
        if (this.pasteMode && this.pasteData) {
            const dataH = this.pasteData.length;
            const dataW = this.pasteData[0].length;
            const dimension = this.getCurrentSpriteDimension();
            const offsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
            const offsetY = Math.floor(this.viewportOffsetY / this.pixelSize);

            for (let dy = 0; dy < dataH; dy++) {
                for (let dx = 0; dx < dataW; dx++) {
                    const tx = this.pasteOffset.x + dx;
                    const ty = this.pasteOffset.y + dy;
                    if (tx >= 0 && tx < dimension && ty >= 0 && ty < dimension) {
                        // ビューポート内に表示されるか確認
                        const screenX = tx - offsetX;
                        const screenY = ty - offsetY;
                        if (screenX >= 0 && screenX < 16 && screenY >= 0 && screenY < 16) {
                            const val = this.pasteData[dy][dx];
                            if (val >= 0) {
                                this.ctx.fillStyle = palette[val];
                                this.ctx.globalAlpha = 0.7;
                                this.ctx.fillRect(screenX * this.pixelSize, screenY * this.pixelSize, this.pixelSize, this.pixelSize);
                                this.ctx.globalAlpha = 1.0;
                            }
                        }
                    }
                }
            }
        }

        // グリッド線（白 - ピアノロールと同じ設定）
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 0.5;
        for (let i = 1; i < 16; i++) {
            // 縦線
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.pixelSize, 0);
            this.ctx.lineTo(i * this.pixelSize, this.canvas.height);
            this.ctx.stroke();
            // 横線
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.pixelSize);
            this.ctx.lineTo(this.canvas.width, i * this.pixelSize);
            this.ctx.stroke();
        }

        // 8ピクセル毎のガイド線（白、0.75px）- スクロールに追従
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 0.75;
        {
            const offsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
            const offsetY = Math.floor(this.viewportOffsetY / this.pixelSize);
            // 8ピクセル境界線を描画
            for (let i = 8; i < dimension; i += 8) {
                // 16の倍数は別のガイド線で描画するのでスキップ（32x32時のみ）
                if (dimension > 16 && i % 16 === 0) continue;
                // ビューポート内に表示される位置を計算
                const screenX = (i - offsetX) * this.pixelSize;
                const screenY = (i - offsetY) * this.pixelSize;
                if (screenX > 0 && screenX < this.canvas.width) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(screenX, 0);
                    this.ctx.lineTo(screenX, this.canvas.height);
                    this.ctx.stroke();
                }
                if (screenY > 0 && screenY < this.canvas.height) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, screenY);
                    this.ctx.lineTo(this.canvas.width, screenY);
                    this.ctx.stroke();
                }
            }
        }

        // 16ピクセル毎のガイド線（赤 - 32x32編集時の視認性向上）
        if (dimension > 16) {
            const offsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
            const offsetY = Math.floor(this.viewportOffsetY / this.pixelSize);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            // 16ピクセル境界線を描画
            for (let i = 16; i < dimension; i += 16) {
                // ビューポート内に表示される位置を計算
                const screenX = (i - offsetX) * this.pixelSize;
                const screenY = (i - offsetY) * this.pixelSize;
                if (screenX > 0 && screenX < this.canvas.width) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(screenX, 0);
                    this.ctx.lineTo(screenX, this.canvas.height);
                    this.ctx.stroke();
                }
                if (screenY > 0 && screenY < this.canvas.height) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, screenY);
                    this.ctx.lineTo(this.canvas.width, screenY);
                    this.ctx.stroke();
                }
            }
        }

        // 範囲選択表示（点線）
        if (this.selectionStart && this.selectionEnd) {
            const offsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
            const offsetY = Math.floor(this.viewportOffsetY / this.pixelSize);

            const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x) - offsetX;
            const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y) - offsetY;
            const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x) - offsetX;
            const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y) - offsetY;

            // ビューポート内に表示される部分のみ描画
            if (x2 >= 0 && x1 < 16 && y2 >= 0 && y1 < 16) {
                this.ctx.strokeStyle = this.isSelecting ? '#ffffff' : '#90EE90';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([4, 4]);
                this.ctx.strokeRect(
                    x1 * this.pixelSize,
                    y1 * this.pixelSize,
                    (x2 - x1 + 1) * this.pixelSize,
                    (y2 - y1 + 1) * this.pixelSize
                );
                this.ctx.setLineDash([]);
            }
        }

        // ペースト範囲表示（点線）
        if (this.pasteMode && this.pasteData) {
            const offsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
            const offsetY = Math.floor(this.viewportOffsetY / this.pixelSize);

            const dataH = this.pasteData.length;
            const dataW = this.pasteData[0].length;

            // スクリーン座標で描画
            const screenX = this.pasteOffset.x - offsetX;
            const screenY = this.pasteOffset.y - offsetY;

            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(
                screenX * this.pixelSize,
                screenY * this.pixelSize,
                dataW * this.pixelSize,
                dataH * this.pixelSize
            );
            this.ctx.setLineDash([]);
        }

        // おてほん（下絵ガイド）を最上位レイヤーに描画
        if (this.guideImageVisible && this.guideImage) {
            const viewOffsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
            const viewOffsetY = Math.floor(this.viewportOffsetY / this.pixelSize);

            // ガイド画像のサイズ（ピクセル単位）
            const imgW = this.guideImage.width;
            const imgH = this.guideImage.height;

            // 32x32時は2倍に拡大（キャンバスサイズに合わせる）
            const spriteDimension = this.getCurrentSpriteDimension();
            const dimensionMultiplier = spriteDimension / 16;  // 16x16 → 1, 32x32 → 2

            // スケール適用後のガイド画像サイズ（スプライトピクセル単位）
            // guideScale=1 → 画像が16スプライトピクセルに収まる
            // 32x32時は dimensionMultiplier=2 で2倍に拡大
            const baseSize = 16 * dimensionMultiplier;
            const scaledW = baseSize * this.guideScale;
            const scaledH = baseSize * this.guideScale * (imgH / imgW);

            // 描画位置（スプライト座標系、ビューポートオフセット考慮）
            const drawX = (this.guideOffsetX * dimensionMultiplier - viewOffsetX) * this.pixelSize;
            const drawY = (this.guideOffsetY * dimensionMultiplier - viewOffsetY) * this.pixelSize;
            const drawW = scaledW * this.pixelSize;
            const drawH = scaledH * this.pixelSize;

            this.ctx.globalAlpha = 0.5;
            // 回転を適用
            const centerDrawX = drawX + drawW / 2;
            const centerDrawY = drawY + drawH / 2;
            this.ctx.save();
            this.ctx.translate(centerDrawX, centerDrawY);
            this.ctx.rotate(this.guideRotation);
            this.ctx.drawImage(this.guideImage, -drawW / 2, -drawH / 2, drawW, drawH);
            this.ctx.restore();
            this.ctx.globalAlpha = 1.0;
        }

        this.canvas.style.backgroundColor = bgColor;
    },

    renderSpriteToMiniCanvas(sprite, canvas) {
        const spriteSize = sprite.size || 1;
        const dimension = spriteSize === 2 ? 32 : 16;

        // スプライトサイズに合わせてキャンバスサイズを設定（CSSでスケーリング）
        canvas.width = dimension;
        canvas.height = dimension;

        const ctx = canvas.getContext('2d');
        const palette = App.nesPalette;

        // 背景色を動的に取得
        const bgColor = App.projectData.stage?.bgColor || App.projectData.stage?.backgroundColor || '#3CBCFC';
        canvas.style.backgroundColor = bgColor;
        ctx.clearRect(0, 0, dimension, dimension);

        for (let y = 0; y < dimension; y++) {
            for (let x = 0; x < dimension; x++) {
                const colorIndex = sprite.data[y][x];
                if (colorIndex >= 0) {
                    ctx.fillStyle = palette[colorIndex];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    },

    addNewSprite() {
        const id = App.projectData.sprites.length;
        App.projectData.sprites.push({
            id: id,
            name: 'sprite_' + id,
            data: App.create2DArray(16, 16, -1),
            size: 1  // デフォルトは16x16
        });
        this.currentSprite = id;
        this.history = [];
        this.initSpriteGallery();
        this.render();
    },

    // スプライトのサイズを切り替え（16x16 ↔ 32x32）
    toggleSpriteSize(index) {
        const sprite = App.projectData.sprites[index];
        if (!sprite) return;

        const currentSize = sprite.size || 1;

        const executeToggle = () => {
            const newSize = currentSize === 1 ? 2 : 1;
            const currentDim = currentSize === 2 ? 32 : 16;
            const newDim = newSize === 2 ? 32 : 16;

            // 新しいデータ配列を作成
            const newData = App.create2DArray(newDim, newDim, -1);

            // データを変換
            if (currentSize === 1 && newSize === 2) {
                // 16x16 -> 32x32 (200%拡大)
                for (let y = 0; y < currentDim; y++) {
                    for (let x = 0; x < currentDim; x++) {
                        const color = sprite.data[y][x];
                        newData[y * 2][x * 2] = color;
                        newData[y * 2 + 1][x * 2] = color;
                        newData[y * 2][x * 2 + 1] = color;
                        newData[y * 2 + 1][x * 2 + 1] = color;
                    }
                }
            } else if (currentSize === 2 && newSize === 1) {
                // 32x32 -> 16x16 (ダウンサンプリング)
                for (let y = 0; y < newDim; y++) {
                    for (let x = 0; x < newDim; x++) {
                        newData[y][x] = sprite.data[y * 2][x * 2];
                    }
                }
            }

            sprite.data = newData;
            sprite.size = newSize;

            // 現在編集中のスプライトなら、オフセットをリセット
            if (index === this.currentSprite) {
                this.viewportOffsetX = 0;
                this.viewportOffsetY = 0;
            }

            this.initSpriteGallery();
            this.render();
        };

        // 32x32 -> 16x16 の場合、警告
        if (currentSize === 2) {
            const msg = App.I18N['U185']?.[App.currentLang] || '縮小すると細かい情報が失われます。続行しますか？';
            App.showConfirm(msg, '', () => {
                executeToggle();
            });
        } else {
            executeToggle();
        }
    },

    deleteSprite(index, needConfirm = true) {
        if (App.projectData.sprites.length <= 1) {
            alert(App.I18N['U186']?.[App.currentLang] || 'これ以上削除できません');
            return;
        }

        const executeDelete = () => {
            // マップ上の参照を更新（削除）
            this.updateMapSpriteReferences('delete', index);
            // テンプレート内の参照を更新（削除）
            this.updateTemplateSpriteReferences('delete', index);
            // オブジェクト配置の参照を更新（削除）
            this.updateObjectSpriteReferences('delete', index);

            App.projectData.sprites.splice(index, 1);
            App.projectData.sprites.forEach((s, i) => s.id = i);

            this.currentSprite = Math.max(0, index - 1);
            this.history = [];
            this.initSpriteGallery();

            // ステージエディタのサムネイルなども更新
            if (typeof StageEditor !== 'undefined') {
                StageEditor.initTemplateList();
            }
            this.render();
        };

        if (needConfirm) {
            const msg = App.I18N['U187']?.[App.currentLang] || 'このスプライトを削除しますか？\n（使用されている箇所は削除されます）';
            App.showConfirm(msg, '', () => {
                executeDelete();
            });
        } else {
            executeDelete();
        }
    },



    // スプライトを複製
    duplicateSprite(index) {
        const srcSprite = App.projectData.sprites[index];
        // ディープコピー
        const newSprite = JSON.parse(JSON.stringify(srcSprite));

        // IDは一時的にダミー（ID振り直しで更新される）
        newSprite.id = -1;
        newSprite.name = srcSprite.name + '_copy';

        // 該当スプライトの後ろに追加
        // マップ上の参照を更新（挿入によるズレ補正）
        // index+1 の位置に挿入されるので、現在の index+1 以上のものは +1 される必要がある
        this.updateMapSpriteReferences('insert', index + 1);
        // テンプレート内の参照を更新（挿入によるズレ補正）
        this.updateTemplateSpriteReferences('insert', index + 1);
        // オブジェクト配置の参照を更新（挿入によるズレ補正）
        this.updateObjectSpriteReferences('insert', index + 1);

        App.projectData.sprites.splice(index + 1, 0, newSprite);

        // ID振り直し
        App.projectData.sprites.forEach((s, i) => s.id = i);

        // 複製したスプライトを選択
        this.currentSprite = index + 1;
        this.history = [];
        this.initSpriteGallery();

        // ステージエディタのサムネイルなども更新
        if (typeof StageEditor !== 'undefined') {
            StageEditor.initTemplateList();
        }

        this.render();
    },

    // ========== キャンバスイベント ==========
    initCanvasEvents() {
        if (!this.canvas) return;

        const newCanvas = this.canvas.cloneNode(true);
        if (this.canvas.parentNode) this.canvas.parentNode.replaceChild(newCanvas, this.canvas);
        this.canvas = newCanvas;
        this.ctx = this.canvas.getContext('2d');

        // PC用キーボードショートカット: Shift + 矢印キーでビューポートをパン
        document.addEventListener('keydown', (e) => {
            if (App.currentScreen !== 'paint') return;
            if (this.getCurrentSpriteSize() !== 2) return;  // 32x32のみ
            if (!e.shiftKey) return;

            const step = this.pixelSize;  // 1タイル分 = 20px
            const maxScroll = 16 * this.pixelSize;  // 最大320px

            switch (e.key) {
                case 'ArrowRight':
                    this.viewportOffsetX = Math.min(maxScroll, this.viewportOffsetX + step);
                    e.preventDefault();
                    this.render();
                    break;
                case 'ArrowLeft':
                    this.viewportOffsetX = Math.max(0, this.viewportOffsetX - step);
                    e.preventDefault();
                    this.render();
                    break;
                case 'ArrowDown':
                    this.viewportOffsetY = Math.min(maxScroll, this.viewportOffsetY + step);
                    e.preventDefault();
                    this.render();
                    break;
                case 'ArrowUp':
                    this.viewportOffsetY = Math.max(0, this.viewportOffsetY - step);
                    e.preventDefault();
                    this.render();
                    break;
            }
        });

        // --- PC: マウスホイールスクロール（32x32時のみ） ---
        this.canvas.addEventListener('wheel', (e) => {
            if (App.currentScreen !== 'paint') return;
            if (this.getCurrentSpriteSize() !== 2) return;
            e.preventDefault();
            const maxScroll = 16 * this.pixelSize;
            const speed = 0.3;
            const dx = (e.shiftKey ? e.deltaY : 0) * speed;
            const dy = (e.shiftKey ? 0 : e.deltaY) * speed;
            if (!Number.isFinite(this.viewportOffsetX)) this.viewportOffsetX = 0;
            if (!Number.isFinite(this.viewportOffsetY)) this.viewportOffsetY = 0;
            this.viewportOffsetX = Math.max(0, Math.min(maxScroll, this.viewportOffsetX + dx));
            this.viewportOffsetY = Math.max(0, Math.min(maxScroll, this.viewportOffsetY + dy));
            this.render();
        }, { passive: false });

        // --- PC: 中ボタンドラッグパン（32x32時のみ） ---
        let isSpriteMiddlePan = false;
        let spriteMidPanX = 0, spriteMidPanY = 0;
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                if (App.currentScreen !== 'paint') return;
                if (this.getCurrentSpriteSize() !== 2) return;
                e.preventDefault();
                isSpriteMiddlePan = true;
                spriteMidPanX = e.clientX;
                spriteMidPanY = e.clientY;
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (!isSpriteMiddlePan) return;
            const maxScroll = 16 * this.pixelSize;
            const dx = spriteMidPanX - e.clientX;
            const dy = spriteMidPanY - e.clientY;
            spriteMidPanX = e.clientX;
            spriteMidPanY = e.clientY;
            if (!Number.isFinite(this.viewportOffsetX)) this.viewportOffsetX = 0;
            if (!Number.isFinite(this.viewportOffsetY)) this.viewportOffsetY = 0;
            this.viewportOffsetX = Math.max(0, Math.min(maxScroll, this.viewportOffsetX + dx));
            this.viewportOffsetY = Math.max(0, Math.min(maxScroll, this.viewportOffsetY + dy));
            this.render();
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 1) isSpriteMiddlePan = false;
        });

        this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
        document.addEventListener('mouseup', () => this.onPointerUp());


        // 2本指パン誤入力防止用の変数
        this.pendingTouch = null;
        this.touchStartTimer = null;

        this.canvas.addEventListener('touchstart', (e) => {
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
                if (this.guideAdjustMode && this.guideImage) {
                    this.pendingTouch = null;
                    const angle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
                    this.guideAdjustData = {
                        startCenterX: centerX,
                        startCenterY: centerY,
                        startDist: dist,
                        startAngle: angle,
                        startScale: this.guideScale,
                        startRotation: this.guideRotation,
                        startOffsetX: this.guideOffsetX,
                        startOffsetY: this.guideOffsetY
                    };
                } else if (this.getCurrentSpriteSize() === 2) {
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

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const centerX = (touch1.clientX + touch2.clientX) / 2;
                const centerY = (touch1.clientY + touch2.clientY) / 2;
                const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

                // おてほん調整モードの場合
                if (this.guideAdjustData) {
                    const rect = this.canvas.getBoundingClientRect();
                    const pixelSize = this.pixelSize;

                    // 位置移動（ピクセル単位に変換）
                    const deltaX = (centerX - this.guideAdjustData.startCenterX) / pixelSize;
                    const deltaY = (centerY - this.guideAdjustData.startCenterY) / pixelSize;
                    this.guideOffsetX = this.guideAdjustData.startOffsetX + deltaX;
                    this.guideOffsetY = this.guideAdjustData.startOffsetY + deltaY;

                    // スケール変更（ピンチズーム）
                    const scaleRatio = dist / this.guideAdjustData.startDist;
                    this.guideScale = Math.max(0.1, Math.min(5, this.guideAdjustData.startScale * scaleRatio));

                    // 回転（ローテートジェスチャー）
                    const currentAngle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
                    const angleDelta = currentAngle - this.guideAdjustData.startAngle;
                    this.guideRotation = this.guideAdjustData.startRotation + angleDelta;

                    this.render();
                } else if (this.isPanning && this.getCurrentSpriteSize() === 2) {
                    // 通常の32x32パン処理
                    if (!Number.isFinite(this.panStartX) || !Number.isFinite(this.panStartY)) {
                        this.panStartX = centerX;
                        this.panStartY = centerY;
                        return;
                    }

                    const deltaX = this.panStartX - centerX;
                    const deltaY = this.panStartY - centerY;
                    const maxScroll = 16 * this.pixelSize;

                    if (!Number.isFinite(this.viewportOffsetX)) this.viewportOffsetX = 0;
                    if (!Number.isFinite(this.viewportOffsetY)) this.viewportOffsetY = 0;

                    this.viewportOffsetX = Math.max(0, Math.min(maxScroll, this.viewportOffsetX + deltaX));
                    this.viewportOffsetY = Math.max(0, Math.min(maxScroll, this.viewportOffsetY + deltaY));

                    this.panStartX = centerX;
                    this.panStartY = centerY;
                    this.render();
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
            this.guideAdjustData = null; // おてほん調整データをリセット
            this.onPointerUp();
            this.guideAdjustData = null; // おてほん調整データをリセット
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
                const dimension = this.getCurrentSpriteDimension();
                // 32x32以外や描画停止時は終了
                if (dimension !== 32 || (!this.isSelecting && !this.isMovingSelection && !this.pasteMode)) {
                    this.stopAutoScroll();
                    return;
                }

                // スクロール実行
                const oldX = this.viewportOffsetX;
                const oldY = this.viewportOffsetY;
                const maxScroll = Math.max(0, dimension * this.pixelSize - this.canvas.width);

                this.viewportOffsetX = Math.max(0, Math.min(maxScroll, this.viewportOffsetX + this.autoScrollX));
                this.viewportOffsetY = Math.max(0, Math.min(maxScroll, this.viewportOffsetY + this.autoScrollY));

                if (this.viewportOffsetX === oldX && this.viewportOffsetY === oldY) return;

                // 座標更新のために直前のイベントで再処理
                if (this.lastPointerEvent) {
                    // onPointerMoveを再呼び出し（再帰ガードが必要かもだが、autoScrollTimerからの呼び出しは非同期なのでOK）
                    // ただし onPointerMove 内でまた startAutoScroll が呼ばれるが、Timerがあれば無視されるのでOK
                    this.onPointerMove(this.lastPointerEvent);
                }
                this.render();
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
        const rect = this.canvas.getBoundingClientRect();

        // CSSによる拡大縮小を考慮してスケールを計算
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // オフセットをピクセル単位からタイル単位に変換
        const offsetX = Math.floor(this.viewportOffsetX / this.pixelSize);
        const offsetY = Math.floor(this.viewportOffsetY / this.pixelSize);

        // クライアント座標 → 内部キャンバス座標に変換してタイル計算
        const x = Math.floor((e.clientX - rect.left) * scaleX / this.pixelSize) + offsetX;
        const y = Math.floor((e.clientY - rect.top) * scaleY / this.pixelSize) + offsetY;
        return { x, y };
    },

    onPointerDown(e) {
        if (App.currentScreen !== 'paint') return;
        // 中ボタン（パン用）は描画に使わない
        if (e.button !== undefined && e.button !== 0) return;
        this.hasMoved = false;

        const pixel = this.getPixelFromEvent(e);
        const dimension = this.getCurrentSpriteDimension();

        if (pixel.x < 0 || pixel.x >= dimension || pixel.y < 0 || pixel.y >= dimension) {
            return;
        }

        // 範囲選択モード
        if (this.selectionMode) {
            this.isDrawing = true;

            // 既存の選択範囲内をクリックした場合は移動モード
            if (this.selectionStart && this.selectionEnd && this.isPointInSelection(pixel.x, pixel.y)) {

                // まだ浮動化していないなら、ここで浮動化（Cut）
                if (!this.isFloating) {
                    this.saveHistory(); // 移動開始前の状態を保存
                    this.floatSelection();
                }

                this.selectionMoveStart = { x: pixel.x, y: pixel.y };
                this.isMovingSelection = true;
            } else {
                // 新規選択
                if (this.isFloating) {
                    this.commitFloatingData(); // 以前の選択を確定
                }
                this.isSelecting = true; // 新規選択フラグ（色制御用）
                this.selectionStart = { x: pixel.x, y: pixel.y };
                this.selectionEnd = { x: pixel.x, y: pixel.y };
                this.isMovingSelection = false;
            }
            this.render();
            return;
        }

        // ペーストモード（どこでもドラッグ開始、指を離すと確定）
        if (this.pasteMode && this.pasteData) {
            this.isDrawing = true;
            this.pasteDragStart = { x: pixel.x, y: pixel.y };
            return;
        }

        this.isDrawing = true;

        // 描画開始時に履歴を保存
        this.saveHistory();

        const sprite = App.projectData.sprites[this.currentSprite];

        // 配列の存在を確認（32x32への拡張が正しく行われていない場合のフォールバック）
        if (!sprite.data[pixel.y] || typeof sprite.data[pixel.y][pixel.x] === 'undefined') {
            console.warn('Sprite data access out of bounds:', pixel.x, pixel.y, 'data size:', sprite.data.length);
            // データ配列を自動拡張
            const dimension = this.getCurrentSpriteDimension();
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

        if (this.currentTool === 'pen') {
            if (currentVal === this.selectedColor) {
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

        // イベントをキャッシュ（オートスクロール用）
        // Touchオブジェクトの場合はそのまま保持できない（変更される可能性がある）ため、必要な情報だけ持つか、
        // あるいは毎回更新されるので参照でいいか… eはイベントハンドラ内で有効。
        // ここでは単純に e を保持する（TouchListの参照問題があるかもしれないが、clientXなどはプリミティブ）
        // 正確には e が TouchEvent か MouseEvent かで異なる。
        // 簡易的に e をそのまま使う。
        this.lastPointerEvent = e;

        // オートスクロール判定
        const dimension = this.getCurrentSpriteDimension();
        if (dimension === 32 && (this.isSelecting || this.isMovingSelection || this.pasteMode)) {
            const rect = this.canvas.getBoundingClientRect();
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
        if (this.selectionMode) {
            const dimension = this.getCurrentSpriteDimension();

            if (this.isMovingSelection && this.selectionMoveStart) {
                // 選択範囲の移動
                const dx = pixel.x - this.selectionMoveStart.x;
                const dy = pixel.y - this.selectionMoveStart.y;

                if (dx !== 0 || dy !== 0) {
                    this.selectionStart.x += dx;
                    this.selectionStart.y += dy;
                    this.selectionEnd.x += dx;
                    this.selectionEnd.y += dy;

                    if (this.isFloating) {
                        this.floatingPos.x += dx;
                        this.floatingPos.y += dy;
                    }

                    this.selectionMoveStart = { x: pixel.x, y: pixel.y };
                }
            } else {
                // 範囲選択中
                this.selectionEnd = {
                    x: Math.max(0, Math.min(dimension - 1, pixel.x)),
                    y: Math.max(0, Math.min(dimension - 1, pixel.y))
                };
            }
            this.render();
            return;
        }

        // ペーストモード（ドラッグ移動）
        if (this.pasteMode && this.pasteDragStart) {
            const dx = pixel.x - this.pasteDragStart.x;
            const dy = pixel.y - this.pasteDragStart.y;
            this.pasteOffset.x += dx;
            this.pasteOffset.y += dy;
            this.pasteDragStart = { x: pixel.x, y: pixel.y };
            this.render();
            return;
        }

        if (pixel.x !== this.lastPixel.x || pixel.y !== this.lastPixel.y) {
            // ペンツールの消去モード時はドラッグで連続消去しない（タップのみ）
            if (this.currentTool === 'pen' && this.drawMode === 'erase') {
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
        if (this.selectionMode) {
            this.isSelecting = false; // 新規選択完了（色はライトグリーンへ）

            if (!this.hasMoved && !this.isMovingSelection) {
                this.cancelSelectionMode();
            }
            this.isMovingSelection = false;
            this.selectionMoveStart = null;
            this.render(); // 色更新のため再描画
            return;
        }

        // ペーストモード：指を離すと確定
        if (this.pasteMode && this.pasteData) {
            this.confirmPaste();
            this.pasteDragStart = null;
            return;
        }

        this.initSpriteGallery();
    },

    processPixel(x, y) {
        const dimension = this.getCurrentSpriteDimension();
        if (x < 0 || x >= dimension || y < 0 || y >= dimension) return;

        const sprite = App.projectData.sprites[this.currentSprite];
        if (!sprite) return;

        // 配列の存在を確認
        if (!sprite.data[y] || typeof sprite.data[y][x] === 'undefined') {
            console.warn('processPixel: data access out of bounds');
            return;
        }

        this.lastPixel = { x, y };

        switch (this.currentTool) {
            case 'pen':
                if (this.drawMode === 'erase') {
                    sprite.data[y][x] = -1;
                } else {
                    sprite.data[y][x] = this.selectedColor;
                }
                break;
            case 'eraser':
                // 選択範囲がある場合はその範囲内のみ消去
                if (this.selectionStart && this.selectionEnd) {
                    if (this.isPointInSelection(x, y)) {
                        sprite.data[y][x] = -1;
                    }
                } else {
                    sprite.data[y][x] = -1;
                }
                break;
            case 'fill':
                this.floodFill(x, y, sprite.data[y][x], this.selectedColor);
                break;
            case 'eyedropper':
                const pickedColor = sprite.data[y][x];
                if (pickedColor >= 0) {
                    SpriteEditorPalette.selectColor(pickedColor);
                }
                break;
        }

        this.render();
    },

    floodFill(x, y, targetColor, newColor) {
        if (targetColor === newColor) return;

        const sprite = App.projectData.sprites[this.currentSprite];
        const dimension = this.getCurrentSpriteDimension();
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
            this.saveHistory();
            const sprite = App.projectData.sprites[this.currentSprite];
            const dimension = this.getCurrentSpriteDimension();
            for (let y = 0; y < dimension; y++) {
                for (let x = 0; x < dimension; x++) {
                    sprite.data[y][x] = -1;
                }
            }
            this.render();
            this.initSpriteGallery();
        });
    },

    clearSelectionArea() {
        if (!this.selectionStart || !this.selectionEnd) return;

        this.saveHistory();
        const sprite = App.projectData.sprites[this.currentSprite];
        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);

        for (let y = y1; y <= y2; y++) {
            if (!sprite.data[y]) continue;
            for (let x = x1; x <= x2; x++) {
                if (typeof sprite.data[y][x] !== 'undefined') {
                    sprite.data[y][x] = -1;
                }
            }
        }
        this.render();
        this.initSpriteGallery();
    },

    isPointInSelection(x, y) {
        if (!this.selectionStart || !this.selectionEnd) return false;
        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    },

    // 範囲選択モード開始
    startSelectionMode() {
        this.selectionMode = true;
        this.pasteMode = false;
        // 既存の選択がない場合は初期化（維持することでツール切り替えに対応）
        if (!this.selectionStart) {
            this.selectionStart = null;
            this.selectionEnd = null;
        }
        this.currentTool = 'select';
        this.isSelecting = false;

        // 以前の浮動データがあれば確定
        if (this.isFloating) {
            this.commitFloatingData();
        }
        this.isFloating = false;
        this.floatingData = null;

        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'select');
        });
        this.render();
    },

    // 選択モードキャンセル
    cancelSelectionMode() {
        if (!this.selectionMode) return;

        this.selectionMode = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        // 選択ツールが選択されている場合は、ボタンのアクティブ状態を維持する
        if (this.currentTool === 'select') {
            const selectBtn = document.querySelector('#paint-tools button[data-tool="select"]');
            if (selectBtn) selectBtn.classList.add('active');
        }
        this.isMovingSelection = false;
        this.selectionMoveStart = null;
        this.render();
    },



    cancelSelectionMode() {
        if (!this.selectionMode) return;

        if (this.isFloating) {
            this.commitFloatingData();
        }

        this.selectionMode = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        // this.rangeClipboard = null; // Don't clear clipboard on cancel? Usually keep it.

        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'select' && this.selectionMode);
        });

        this.render();
    },

    // ペーストモード開始
    pasteSprite() {
        if (!this.rangeClipboard || this.rangeClipboard.length === 0) {
            return;
        }
        this.pasteMode = true;
        this.selectionMode = false;
        this.pasteData = JSON.parse(JSON.stringify(this.rangeClipboard));
        // スクロール位置に応じて配置（例：画面左上から+2ずらした位置）
        const offsetX = Math.floor((this.viewportOffsetX || 0) / this.pixelSize);
        const offsetY = Math.floor((this.viewportOffsetY || 0) / this.pixelSize);
        this.pasteOffset = {
            x: Math.max(0, offsetX + 2),
            y: Math.max(0, offsetY + 2)
        };
        this.currentTool = 'paste';
        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'paste');
        });
        this.render();
    },

    floatSelection() { // Implement floating selection
        if (!this.selectionStart || !this.selectionEnd) return;
        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
        const w = x2 - x1 + 1;
        const h = y2 - y1 + 1;

        const sprite = App.projectData.sprites[this.currentSprite];
        const floatingData = [];

        for (let y = 0; y < h; y++) {
            const row = [];
            for (let x = 0; x < w; x++) {
                const ty = y + y1;
                const tx = x + x1;
                // Sprite data array extension check
                if (!sprite.data[ty]) sprite.data[ty] = [];

                if (typeof sprite.data[ty][tx] !== 'undefined') {
                    row.push(sprite.data[ty][tx]);
                    sprite.data[ty][tx] = -1; // Clear source
                } else {
                    row.push(-1);
                }
            }
            floatingData.push(row);
        }

        this.floatingData = floatingData;
        this.floatingPos = { x: x1, y: y1 };
        this.isFloating = true;
    },

    commitFloatingData() { // Commit floating selection
        if (!this.isFloating || !this.floatingData) return;
        const sprite = App.projectData.sprites[this.currentSprite];
        const h = this.floatingData.length;
        const w = this.floatingData[0].length;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const val = this.floatingData[y][x];
                // Overwrite everything including transparency to match StageEditor behavior
                const ty = this.floatingPos.y + y;
                const tx = this.floatingPos.x + x;

                // Ensure row exists
                if (!sprite.data[ty]) {
                    // Check dimension bounds before extending?
                    // Assuming processPixel logic handles bounds or we should check?
                    // render loop checks bounds, so we should be safe to just check existence
                    continue;
                }

                if (typeof sprite.data[ty][tx] !== 'undefined') {
                    sprite.data[ty][tx] = val;
                }
            }
        }
        this.isFloating = false;
        this.floatingData = null;
        this.render();
    },

    // 選択範囲をコピー
    copySelection() {
        if (!this.selectionStart || !this.selectionEnd) {
            return;
        }

        const sprite = App.projectData.sprites[this.currentSprite];
        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);

        // 範囲内のデータをコピー
        const data = [];
        for (let y = y1; y <= y2; y++) {
            const row = [];
            for (let x = x1; x <= x2; x++) {
                row.push(sprite.data[y][x]);
            }
            data.push(row);
        }
        this.rangeClipboard = data;

        // コピー後、選択を解除する
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        // 選択モードをペーストモードまたはそのまま待機させる処理へ
        this.render();
    },

    // ペースト確定
    confirmPaste() {
        if (!this.pasteData) return;

        this.saveHistory();
        const sprite = App.projectData.sprites[this.currentSprite];
        const dataH = this.pasteData.length;
        const dataW = this.pasteData[0].length;

        for (let dy = 0; dy < dataH; dy++) {
            for (let dx = 0; dx < dataW; dx++) {
                const tx = this.pasteOffset.x + dx;
                const ty = this.pasteOffset.y + dy;
                const dimension = this.getCurrentSpriteDimension();
                if (tx >= 0 && tx < dimension && ty >= 0 && ty < dimension) {
                    const val = this.pasteData[dy][dx];
                    if (val >= 0) { // 透明以外を上書き
                        sprite.data[ty][tx] = val;
                    }
                }
            }
        }

        // ペーストモード終了
        this.pasteMode = false;
        this.pasteData = null;
        this.currentTool = 'pen';
        document.querySelectorAll('#paint-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'pen');
        });
        this.render();
        this.initSpriteGallery();
    },

    flipVertical() {
        // ペーストモード時はペーストデータを反転
        if (this.pasteMode && this.pasteData) {
            this.pasteData.reverse();
            this.render();
            return;
        }

        // 浮動選択範囲（移動中）を優先して反転
        if (this.isFloating && this.floatingData) {
            this.floatingData.reverse();
            this.render();
            return;
        }

        // 静的な選択範囲があればその範囲内のみ反転
        if (this.selectionStart && this.selectionEnd) {
            const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            const sprite = App.projectData.sprites[this.currentSprite];
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
            this.render();
            this.initSpriteGallery();
            return;
        }

        // 選択範囲がない場合は全体を反転
        const sprite = App.projectData.sprites[this.currentSprite];
        sprite.data.reverse();
        this.render();
        this.initSpriteGallery();
    },

    flipHorizontal() {
        // ペーストモード時はペーストデータを反転
        if (this.pasteMode && this.pasteData) {
            this.pasteData.forEach(row => row.reverse());
            this.render();
            return;
        }

        // 浮動選択範囲（移動中）を優先して反転
        if (this.isFloating && this.floatingData) {
            this.floatingData.forEach(row => row.reverse());
            this.render();
            return;
        }

        // 静的な選択範囲があればその範囲内のみ反転
        if (this.selectionStart && this.selectionEnd) {
            const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            const sprite = App.projectData.sprites[this.currentSprite];
            for (let y = 0; y < h; y++) {
                const row = sprite.data[y1 + y].slice(x1, x1 + w);
                row.reverse();
                for (let x = 0; x < w; x++) {
                    sprite.data[y1 + y][x1 + x] = row[x];
                }
            }
            this.render();
            this.initSpriteGallery();
            return;
        }

        // 選択範囲がない場合は全体を反転
        const sprite = App.projectData.sprites[this.currentSprite];
        sprite.data.forEach(row => row.reverse());
        this.render();
        this.initSpriteGallery();
    },

    // ========== おてほん（下絵ガイド） ==========
    handleGuideButtonClick() {
        if (!this.guideImage) {
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

                this.guideImage = canvas;
                this.guideImageVisible = true;
                // 初期位置・スケールをリセット
                this.guideScale = 1;
                this.guideOffsetX = 0;
                this.guideOffsetY = 0;
                // 調整モードON（初回読込み時のみ）
                this.guideAdjustMode = true;
                this.updateGuideButtonState();
                this.render();

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
        this.guideImageVisible = !this.guideImageVisible;
        this.updateGuideButtonState();
        this.render();
    },

    resetGuideImage() {
        this.guideImage = null;
        this.guideImageVisible = false;
        this.guideScale = 1;
        this.guideOffsetX = 0;
        this.guideOffsetY = 0;
        this.guideRotation = 0;
        this.guideAdjustMode = false;
        this.guideAdjustData = null;
        this.updateGuideButtonState();
        this.render();
    },

    updateGuideButtonState() {
        const btn = document.querySelector('#paint-tools .paint-tool-btn[data-tool="guide"]');
        if (btn) {
            btn.classList.toggle('guide-active', this.guideImage && this.guideImageVisible);
            btn.classList.toggle('guide-loaded', this.guideImage !== null);
        }
    },

    floatSelection() {
        if (!this.selectionStart || !this.selectionEnd) return;
        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
        const w = x2 - x1 + 1;
        const h = y2 - y1 + 1;

        const floatingData = [];
        const sprite = App.projectData.sprites[this.currentSprite];

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

        this.floatingData = floatingData;
        this.floatingPos = { x: x1, y: y1 };
        this.isFloating = true;
    },

    commitFloatingData() {
        if (!this.isFloating || !this.floatingData) return;

        const sprite = App.projectData.sprites[this.currentSprite];
        const dim = this.getCurrentSpriteDimension();

        // 浮動データをキャンバスに書き戻す
        for (let y = 0; y < this.floatingData.length; y++) {
            for (let x = 0; x < this.floatingData[0].length; x++) {
                const val = this.floatingData[y][x];
                // 浮動データの透明（-1）も書き込むか？
                // 通常Moveツールは「切り取り＆移動」なので、移動先の絵を上書きする。透明部分は透けるべきだが...
                // ここでは単純なペースト同様、透明部分(-1)は書き込まないことにする（合成）
                // いや、もし「移動」なら、元の矩形がそのまま移動すべきなので、透明も書き込む（上書き）
                // ただし、もしユーザーが「透明部分は下の絵を残したい」と思うなら別だが。
                // pixel art editor の挙動としては上書きが自然。
                // でも -1 は透明なので、下の色が見えるべき？ 
                // data 上では -1 が入ると「透明」になる。
                // つまり -1 を書き込めばそこは透明になる（消しゴム効果）。

                const tx = this.floatingPos.x + x;
                const ty = this.floatingPos.y + y;

                if (tx >= 0 && tx < dim && ty >= 0 && ty < dim) {
                    // 境界チェックの上で書き込み
                    if (sprite.data[ty]) {
                        sprite.data[ty][tx] = val;
                    }
                }
            }
        }

        this.isFloating = false;
        this.floatingData = null;
        this.render();
    },

    // ========== 参照更新ヘルパー ==========
    // スプライト操作時のマップデータ参照更新
    updateMapSpriteReferences(action, index) {
        const stage = App.projectData.stage;
        if (!stage) return;

        const updateLayer = (layer) => {
            if (!layer) return;
            for (let y = 0; y < layer.length; y++) {
                if (!layer[y]) continue;
                for (let x = 0; x < layer[y].length; x++) {
                    const val = layer[y][x];
                    if (val === -1) continue;

                    // テンプレート（100以上）は対象外、通常スプライト（0-99）のみ
                    if (val >= 100) continue;

                    if (action === 'insert') {
                        // 挿入箇所以降のIDを+1
                        if (val >= index) {
                            layer[y][x] = val + 1;
                        }
                    } else if (action === 'delete') {
                        if (val === index) {
                            // 削除されたスプライトは空(-1)に
                            layer[y][x] = -1;
                        } else if (val > index) {
                            // 削除箇所以降のIDを-1
                            layer[y][x] = val - 1;
                        }
                    }
                }
            }
        };

        // 全レイヤー更新
        updateLayer(stage.layers.bg);
        updateLayer(stage.layers.fg);
        // collisionは通常0/1だが、将来的に拡張される可能性も考慮して一応通すか、あるいは除外か。
        // 現状の仕様では collision にスプライトIDは入らない（0か1）ので、影響はないはずだが
        // 念のため bg/fg のみに限定するのが安全。
        // updateLayer(stage.layers.collision); 
    },

    // テンプレート内のスプライト参照更新
    updateTemplateSpriteReferences(action, index) {
        if (!App.projectData.templates) return;

        console.log(`[SpriteEditor] updateTemplateSpriteReferences action=${action} index=${index}`);

        App.projectData.templates.forEach((template, tIdx) => {
            if (!template.sprites) return;

            Object.keys(template.sprites).forEach(key => {
                const spriteDef = template.sprites[key];
                if (!spriteDef || !spriteDef.frames) return;

                // 参照共有チェック（念のため）
                // if (spriteDef._updated) return;
                // spriteDef._updated = true; 
                // ※通常共有されないはずだが、万が一共有されていると二重更新になる

                for (let i = 0; i < spriteDef.frames.length; i++) {
                    const val = spriteDef.frames[i];
                    if (val === null || val === undefined) continue;

                    if (action === 'insert') {
                        // 挿入箇所以降のIDを+1
                        if (val >= index) {
                            console.log(`  Upd Tmpl[${tIdx}].${key}[${i}]: ${val} -> ${val + 1}`);
                            spriteDef.frames[i] = val + 1;
                        }
                    } else if (action === 'delete') {
                        if (val === index) {
                            // 削除されたスプライトを参照している場合
                            console.log(`  Del Tmpl[${tIdx}].${key}[${i}]: ${val} -> Empty`);
                            spriteDef.frames.splice(i, 1);
                            i--; // インデックス調整
                        } else if (val > index) {
                            // 削除箇所以降のIDを-1
                            console.log(`  Upd Tmpl[${tIdx}].${key}[${i}]: ${val} -> ${val - 1}`);
                            spriteDef.frames[i] = val - 1;
                        }
                    }
                }
            });
        });
    },

    // オブジェクト（旧形式配置）のスプライト参照更新
    updateObjectSpriteReferences(action, index) {
        if (!App.projectData.objects) return;

        console.log(`[SpriteEditor] updateObjectSpriteReferences action=${action} index=${index}`);

        App.projectData.objects.forEach((obj, oIdx) => {
            if (obj.sprite === undefined || obj.sprite === null) return;
            const val = obj.sprite;

            if (action === 'insert') {
                if (val >= index) {
                    console.log(`  Upd Obj[${oIdx}]: ${val} -> ${val + 1}`);
                    obj.sprite = val + 1;
                }
            } else if (action === 'delete') {
                if (val === index) {
                    // オブジェクトが参照していたスプライトが削除された場合
                    // デフォルト(0)に戻すか、削除するか？
                    // 配置データなので削除するのは危険（位置情報が消える）。0にする。
                    console.log(`  Upd Obj[${oIdx}]: ${val} -> 0 (Reset)`);
                    obj.sprite = 0;
                } else if (val > index) {
                    console.log(`  Upd Obj[${oIdx}]: ${val} -> ${val - 1}`);
                    obj.sprite = val - 1;
                }
            }
        });
    },

    // カラー操作時のスプライトデータ参照更新
    updateAllSpriteColorReferences(action, index) {
        const sprites = App.projectData.sprites;
        sprites.forEach(sprite => {
            if (!sprite.data) return;

            for (let y = 0; y < sprite.data.length; y++) {
                if (!sprite.data[y]) continue;
                for (let x = 0; x < sprite.data[y].length; x++) {
                    const val = sprite.data[y][x];
                    if (val === -1) continue; // 透明

                    if (action === 'insert') {
                        // 挿入箇所以降のインデックスを+1
                        // index = 挿入された位置（新しい色）
                        // 例: index=2に挿入(元2は3へ) -> val >= 2 なら +1
                        if (val >= index) {
                            sprite.data[y][x] = val + 1;
                        }
                    } else if (action === 'delete') {
                        if (val === index) {
                            // 削除された色は透明(-1)に（または0=黒にする手もあるが、破壊的なので透明が無難）
                            sprite.data[y][x] = -1;
                        } else if (val > index) {
                            // 削除箇所以降のインデックスを-1
                            sprite.data[y][x] = val - 1;
                        }
                    }
                }
            }
        });
    }

};
