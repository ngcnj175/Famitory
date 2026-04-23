/**
 * PixelGameKit - スプライトエディタ（新UI対応）
 */

const SpriteEditor = {
    canvas: null,
    ctx: null,
    currentSprite: 0,
    selectedColor: 0,
    currentTool: 'pen',
    clipboard: null,

    // 履歴管理
    history: [],
    historyIndex: -1,
    maxHistory: 20,

    SPRITE_SIZE: 16,
    pixelSize: 20,

    // 32x32用のビューポートオフセット（render と SpriteCanvasInput が共有）
    viewportOffsetX: 0,
    viewportOffsetY: 0,

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
        SpriteCanvasInput.init(this);
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
                    pressTimer = setTimeout(() => SpriteCanvasInput.clearSprite(), 800);
                } else if (newBtn.dataset.tool === 'guide') {
                    pressTimer = setTimeout(() => SpriteCanvasInput.resetGuideImage(), 800);
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
                        SpriteCanvasInput.startSelectionMode();
                        break;
                    case 'copy':
                        SpriteCanvasInput.copySelection();
                        break;
                    case 'paste':
                        SpriteCanvasInput.pasteSprite();
                        break;
                    case 'flip-v':
                        this.saveHistory();
                        SpriteCanvasInput.flipVertical();
                        break;
                    case 'flip-h':
                        this.saveHistory();
                        SpriteCanvasInput.flipHorizontal();
                        break;
                    case 'guide':
                        SpriteCanvasInput.handleGuideButtonClick();
                        break;
                    default:
                        // 範囲選択中なら消しゴムツールで一括削除
                        if (tool === 'eraser' && this.selectionStart && this.selectionEnd) {
                            SpriteCanvasInput.clearSelectionArea();
                        }

                        // 選択モードをキャンセル（消しゴム以外のツール、または選択範囲がない場合）
                        SpriteCanvasInput.cancelSelectionMode();
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
