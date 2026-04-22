/**
 * PixelGameKit - ステージエディタ キャンバス入力管理
 * マウス・タッチ・ホイール等のCanvasイベントを管理するクラス
 */

class StageCanvasInput {
    constructor(owner) {
        this.owner = owner;
    }

    // メインのイベントアタッチ（initCanvasEvents に相当）
    attach() {
        const o = this.owner;  // owner shorthand
        const self = this;

        if (!o.canvas) return;
        if (o.canvasEventsInitialized) return;
        o.canvasEventsInitialized = true;

        let isDrawing = false;

        // 2本指パン用の状態
        o.canvasScrollX = 0;
        o.canvasScrollY = 0;
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let lastScrollX = 0;
        let lastScrollY = 0;

        // --- PC: マウスホイールスクロール ---
        o.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const stage = App.projectData?.stage;
            if (!stage) return;
            const maxScrollX = Math.max(0, (stage.width - 16) * o.tileSize);
            const maxScrollY = Math.max(0, (stage.height - 16) * o.tileSize);
            if (maxScrollX === 0 && maxScrollY === 0) return;

            const speed = 0.3;
            const dx = (e.shiftKey ? e.deltaY : 0) * speed;
            const dy = (e.shiftKey ? 0 : e.deltaY) * speed;
            o.canvasScrollX = Math.max(-maxScrollX, Math.min(0, o.canvasScrollX - dx));
            o.canvasScrollY = Math.max(-maxScrollY, Math.min(0, o.canvasScrollY - dy));
            o.render();
        }, { passive: false });

        // --- PC: 中ボタンドラッグパン ---
        let isMiddlePanning = false;
        let midPanX = 0, midPanY = 0;
        o.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                isMiddlePanning = true;
                midPanX = e.clientX;
                midPanY = e.clientY;
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (!isMiddlePanning) return;
            const stage = App.projectData?.stage;
            if (!stage) return;
            const maxScrollX = Math.max(0, (stage.width - 16) * o.tileSize);
            const maxScrollY = Math.max(0, (stage.height - 16) * o.tileSize);

            const dx = e.clientX - midPanX;
            const dy = e.clientY - midPanY;
            midPanX = e.clientX;
            midPanY = e.clientY;
            o.canvasScrollX = Math.max(-maxScrollX, Math.min(0, o.canvasScrollX + dx));
            o.canvasScrollY = Math.max(-maxScrollY, Math.min(0, o.canvasScrollY + dy));
            o.render();
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 1) isMiddlePanning = false;
        });

        const handleStart = (e) => {
            if (e.cancelable) e.preventDefault(); // Prevent native selection/drag
            // 中ボタン（パン用）は描画に使わない
            if (e.button !== undefined && e.button !== 0) return;
            if (isDrawing) return;
            hasMoved = false;

            // 繧ｿ繝・メ蛻､螳夲ｼ・譛ｬ謖・ヱ繝ｳ蟇ｾ蠢懶ｼ・
            if (e.touches && e.touches.length >= 2) {
                isPanning = true;
                panStartX = e.touches[0].clientX;
                panStartY = e.touches[0].clientY;
                lastScrollX = o.canvasScrollX;
                lastScrollY = o.canvasScrollY;
                isDrawing = false;
                return;
            }

            const { x, y } = o.getTileFromEvent(e);

            // 矩形選択モード
            if (o.currentTool === 'select') {
                try {
                    if (o.selectionStart && o.selectionEnd && o.isPointInSelection(x, y)) {
                        if (!o.isFloating) {
                            o.saveToHistory();
                            o.floatSelection();
                        }
                        o.selectionMoveStart = { x, y };
                        o.isMovingSelection = true;
                    } else {
                        if (o.isFloating) {
                            o.commitFloatingData();
                        }
                        o.selectionStart = { x, y };
                        o.selectionEnd = { x, y };
                        o.isMovingSelection = false;
                        o.isSelecting = true;
                    }
                    isDrawing = true; // 処理成功時のみ描画フラグを立てる
                    o.render();
                } catch (e) {
                    console.error('Selection Logic Error:', e);
                    isDrawing = false; // エラー時はリセット
                }
                return;
            }

            // 繝壹・繧ｹ繝医Δ繝ｼ繝・
            if (o.currentTool === 'paste' && o.pasteMode) {
                isDrawing = true;
                o.selectionMoveStart = { x, y }; // 繝峨Λ繝・げ髢句ｧ狗せ縺ｨ縺励※蛻ｩ逕ｨ
                return;
            }

            // 縺昴・莉悶・繝峨Ο繝ｼ繧､繝ｳ繧ｰ繝・・繝ｫ
            if (o.currentTool === 'pen' || o.currentTool === 'eraser' || o.currentTool === 'fill') {
                o.saveToHistory();
            }

            isDrawing = true;
            o.processPixel(e);
        };

        const checkAutoScroll = (e) => {
            if (o.currentTool !== 'select' && o.currentTool !== 'paste') {
                o.stopAutoScroll();
                return;
            }

            const rect = o.canvas.getBoundingClientRect();
            const clientX = e.clientX ?? e.touches?.[0]?.clientX;
            const clientY = e.clientY ?? e.touches?.[0]?.clientY;
            
            if (clientX === undefined || clientY === undefined) return;

            const edgeSize = 30;
            const scrollSpeed = 15;
            let dx = 0;
            let dy = 0;

            if (clientX < rect.left + edgeSize) dx = -scrollSpeed;
            else if (clientX > rect.right - edgeSize) dx = scrollSpeed;

            if (clientY < rect.top + edgeSize) dy = -scrollSpeed;
            else if (clientY > rect.bottom - edgeSize) dy = scrollSpeed;

            if (dx !== 0 || dy !== 0) {
                o.startAutoScroll(dx, dy);
            } else {
                o.stopAutoScroll();
            }
        };

        const handleMove = (e) => {
            if (isPanning && e.touches && e.touches.length >= 2) {
                // 2譛ｬ謖・ヱ繝ｳ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ
                const dx = e.touches[0].clientX - panStartX;
                const dy = e.touches[0].clientY - panStartY;
                const parent = o.canvas.parentElement;
                parent.scrollLeft = -lastScrollX - dx;
                parent.scrollTop = -lastScrollY - dy;
                return;
            }

            if (!isDrawing) return;
            hasMoved = true;
            o.lastPointerEvent = e;
            checkAutoScroll(e);

            const { x, y } = o.getTileFromEvent(e);

            // 遽・峇驕ｸ謚槭Δ繝ｼ繝・
            if (o.currentTool === 'select') {
                if (o.isMovingSelection && o.selectionMoveStart) {
                    const dx = x - o.selectionMoveStart.x;
                    const dy = y - o.selectionMoveStart.y;
                    if (dx !== 0 || dy !== 0) {
                        o.selectionStart.x += dx;
                        o.selectionStart.y += dy;
                        o.selectionEnd.x += dx;
                        o.selectionEnd.y += dy;

                        if (o.isFloating) {
                            o.floatingPos.x += dx;
                            o.floatingPos.y += dy;
                        }

                        o.selectionMoveStart = { x, y };
                    }
                } else {
                    o.selectionEnd = { x, y };
                }
                o.render();
                return;
            }

            // 繝壹・繧ｹ繝医Δ繝ｼ繝会ｼ育ｧｻ蜍包ｼ・
            if (o.currentTool === 'paste' && o.pasteMode && o.selectionMoveStart) {
                const dx = x - o.selectionMoveStart.x;
                const dy = y - o.selectionMoveStart.y;
                o.pasteOffset.x += dx;
                o.pasteOffset.y += dy;
                o.selectionMoveStart = { x, y };
                o.render();
                return;
            }

            o.processPixel(e);
        };

        const handleEnd = () => {
            o.stopAutoScroll();
            o.lastPointerEvent = null;

            if (isPanning) {
                isPanning = false;
                return;
            }
            if (!isDrawing) return;

            isDrawing = false;

            // 遽・峇驕ｸ謚槭・繝壹・繧ｹ繝育ｧｻ蜍慕ｵゆｺ・凾縺ｮ蜃ｦ逅・
            if (o.currentTool === 'select') {
                o.isSelecting = false;

                if (!hasMoved && !o.isMovingSelection) {
                    o.cancelSelectionMode();
                }
                o.isMovingSelection = false;
                o.selectionMoveStart = null;
                o.render();
                return;
            }
            if (o.currentTool === 'paste') {
                o.selectionMoveStart = null;
                o.confirmPaste();
                return;
            }
        };

        // mouseleave 専用ハンドラ：選択ツールの場合は選択をキャンセルしない
        // （ユーザーが消しゴムボタン等に移動した際に選択が消えるバグを防ぐ）
        const handleLeave = () => {
            o.stopAutoScroll();
            o.lastPointerEvent = null;

            if (isPanning) {
                isPanning = false;
                return;
            }
            if (!isDrawing) return;
            isDrawing = false;

            if (o.currentTool === 'select') {
                o.isSelecting = false;
                // mouseleave では hasMoved に関わらず選択を維持する
                o.isMovingSelection = false;
                o.selectionMoveStart = null;
                o.render();
                return;
            }
            if (o.currentTool === 'paste') {
                o.selectionMoveStart = null;
                o.confirmPaste();
                return;
            }
        };

        // handleAutoScrollMove を this に紐づけて setInterval から呼べるようにする
        o.handleAutoScrollMove = handleMove;

        o.canvas.addEventListener('mousedown', handleStart);
        o.canvas.addEventListener('mousemove', handleMove);
        o.canvas.addEventListener('mouseup', handleEnd);
        o.canvas.addEventListener('mouseleave', handleLeave);

        // 2譛ｬ謖・ヱ繝ｳ隱､蜈･蜉幃亟豁｢逕ｨ
        let pendingDrawTimer = null;
        let pendingDrawData = null;
        let hasMoved = false;

        // 繧ｿ繝・メ繧､繝吶Φ繝茨ｼ・譛ｬ謖・ｼ壹ち繧､繝ｫ謫堺ｽ懊・譛ｬ謖・ｼ壹ヱ繝ｳ・・
        o.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // 2譛ｬ謖・ｼ壹ヱ繝ｳ髢句ｧ・- 菫晉蕗荳ｭ縺ｮ蜈･蜉帙′縺ゅｌ縺ｰ繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                if (pendingDrawTimer) {
                    clearTimeout(pendingDrawTimer);
                    pendingDrawTimer = null;
                    pendingDrawData = null;
                }
                isPanning = true;
                isDrawing = false;
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                panStartX = (touch1.clientX + touch2.clientX) / 2;
                panStartY = (touch1.clientY + touch2.clientY) / 2;
                lastScrollX = o.canvasScrollX;
                lastScrollY = o.canvasScrollY;
                e.preventDefault();
            } else if (e.touches.length === 1 && !isPanning) {
                // 1譛ｬ謖・ｼ夐≦蟒ｶ縺励※繧ｿ繧､繝ｫ謫堺ｽ懶ｼ・譛ｬ謖・ヱ繝ｳ隱､蜈･蜉幃亟豁｢・・
                e.preventDefault();
                pendingDrawData = e.touches[0];
                pendingDrawTimer = setTimeout(() => {
                    if (pendingDrawData && !isPanning) {
                        handleStart(pendingDrawData);
                    }
                    pendingDrawTimer = null;
                    pendingDrawData = null;
                }, 50);
            }
        }, { passive: false });

        o.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && isPanning) {
                // 2譛ｬ謖・ｼ壹ヱ繝ｳ荳ｭ
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentX = (touch1.clientX + touch2.clientX) / 2;
                const currentY = (touch1.clientY + touch2.clientY) / 2;

                o.canvasScrollX = lastScrollX + (currentX - panStartX);
                o.canvasScrollY = lastScrollY + (currentY - panStartY);

                // 繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ遽・峇繧貞宛髯・
                const maxScrollX = Math.max(0, (App.projectData.stage.width - 16) * o.tileSize);
                const maxScrollY = Math.max(0, (App.projectData.stage.height - 16) * o.tileSize);
                o.canvasScrollX = Math.max(-maxScrollX, Math.min(0, o.canvasScrollX));
                o.canvasScrollY = Math.max(-maxScrollY, Math.min(0, o.canvasScrollY));

                o.render();
                e.preventDefault();
            } else if (e.touches.length === 1 && !isPanning) {
                e.preventDefault();
                handleMove(e.touches[0]);
            }
        }, { passive: false });

        o.canvas.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                isPanning = false;
            }
            if (e.touches.length === 0) {
                handleEnd();
            }
        });
    }



    getTileFromEvent(e) {
        const o = this.owner;
        // 1. PC (Mouse): offsetX / offsetY を優先利用
        // これらは要素のパディングボックス座標系（枠線除外・変換適用前）で返されるため、
        // CSS transform や border の計算を自動的に回避できて最も正確。
        if (e.offsetX !== undefined && e.offsetY !== undefined) {
            // クライアントサイズ（padding含む・border除外）と内部解像度の比率
            const w = o.canvas.clientWidth;
            const h = o.canvas.clientHeight;
            if (w === 0 || h === 0) return { x: 0, y: 0 };

            const scaleX = o.canvas.width / w;
            const scaleY = o.canvas.height / h;

            // スクロールオフセットを加算してステージ座標に変換
            const scrollOffsetX = Math.round(-(o.canvasScrollX || 0) / o.tileSize);
            const scrollOffsetY = Math.round(-(o.canvasScrollY || 0) / o.tileSize);
            const x = Math.floor((e.offsetX * scaleX) / o.tileSize) + scrollOffsetX;
            const y = Math.floor((e.offsetY * scaleY) / o.tileSize) + scrollOffsetY;
            return { x, y };
        }

        // 2. Touch (Fallback): touches[] から手動計算
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;

        if (clientX === undefined || clientY === undefined) return { x: 0, y: 0 };

        const rect = o.canvas.getBoundingClientRect();

        // 枠線の幅を計算
        const cssScaleX = rect.width / o.canvas.offsetWidth;
        const cssScaleY = rect.height / o.canvas.offsetHeight;

        const style = window.getComputedStyle(o.canvas);
        const borderLeft = (parseFloat(style.borderLeftWidth) || 0) * cssScaleX;
        const borderTop = (parseFloat(style.borderTopWidth) || 0) * cssScaleY;
        const borderRight = (parseFloat(style.borderRightWidth) || 0) * cssScaleX;
        const borderBottom = (parseFloat(style.borderBottomWidth) || 0) * cssScaleY;

        const drawRectWidth = rect.width - borderLeft - borderRight;
        const scaleX = o.canvas.width / drawRectWidth;
        const scaleY = o.canvas.height / (rect.height - borderTop - borderBottom);

        // スクロールオフセットを加算してステージ座標に変換
        const scrollOffsetX = Math.round(-(o.canvasScrollX || 0) / o.tileSize);
        const scrollOffsetY = Math.round(-(o.canvasScrollY || 0) / o.tileSize);
        const x = Math.floor(((clientX - rect.left - borderLeft) * scaleX) / o.tileSize) + scrollOffsetX;
        const y = Math.floor(((clientY - rect.top - borderTop) * scaleY) / o.tileSize) + scrollOffsetY;

        return { x, y };
    }

    isPointInSelection(x, y) {
        const o = this.owner;
        if (!o.selectionStart || !o.selectionEnd) return false;
        const x1 = Math.min(o.selectionStart.x, o.selectionEnd.x);
        const y1 = Math.min(o.selectionStart.y, o.selectionEnd.y);
        const x2 = Math.max(o.selectionStart.x, o.selectionEnd.x);
        const y2 = Math.max(o.selectionStart.y, o.selectionEnd.y);
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    }

    startSelectionMode() {
        const o = this.owner;
        o.selectionMode = true;
        o.pasteMode = false;

        if (!o.selectionStart) {
            o.selectionStart = null;
            o.selectionEnd = null;
        }

        o.currentTool = 'select';
        document.querySelectorAll('#stage-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'select');
        });
        o.render();
    }

    cancelSelectionMode() {
        const o = this.owner;
        if (!o.selectionMode) return;

        if (o.isFloating) {
            o.commitFloatingData();
        }

        o.isSelecting = false;
        o.selectionMode = false;
        o.selectionStart = null;
        o.selectionEnd = null;
        o.isMovingSelection = false;
        o.selectionMoveStart = null;
        o.render();
    }

    copySelection() {
        const o = this.owner;
        if (!o.selectionStart || !o.selectionEnd) {
            return;
        }

        const x1 = Math.min(o.selectionStart.x, o.selectionEnd.x);
        const y1 = Math.min(o.selectionStart.y, o.selectionEnd.y);
        const x2 = Math.max(o.selectionStart.x, o.selectionEnd.x);
        const y2 = Math.max(o.selectionStart.y, o.selectionEnd.y);

        const stage = App.projectData.stage;
        const layer = stage.layers.fg;
        const tiles = [];

        // Tiles Copy
        for (let y = y1; y <= y2; y++) {
            const row = [];
            for (let x = x1; x <= x2; x++) {
                if (x >= 0 && x < stage.width && y >= 0 && y < stage.height) {
                    row.push(layer[y][x]);
                } else {
                    row.push(-1);
                }
            }
            tiles.push(row);
        }

        // Entities Copy
        const entities = [];
        if (stage.entities) {
            stage.entities.forEach(e => {
                if (e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2) {
                    entities.push({
                        ...e,
                        relX: e.x - x1,
                        relY: e.y - y1
                    });
                }
            });
        }

        o.rangeClipboard = { tiles, entities };
        // alert removed

        // コピー後、選択を解除する
        o.isSelecting = false;
        o.selectionStart = null;
        o.selectionEnd = null;

        o.render();
    }

    pasteTiles() {
        const o = this.owner;
        if (!o.rangeClipboard) return;

        // Verify clipboard format
        let tiles = [];
        let entities = [];

        if (Array.isArray(o.rangeClipboard)) {
            // Old format (just tiles)
            tiles = o.rangeClipboard;
        } else if (o.rangeClipboard.tiles) {
            // New format
            tiles = o.rangeClipboard.tiles;
            entities = o.rangeClipboard.entities || [];
        } else {
            return;
        }

        if (tiles.length === 0 && entities.length === 0) return;

        o.pasteMode = true;
        o.selectionMode = false;
        o.pasteData = { tiles, entities: JSON.parse(JSON.stringify(entities)) };

        // 画面中央付近に配置
        // canvasScrollX, Y は負の値をとる。例: スクロールで右に移動=canvasScrollXはマイナス
        // tileSizeはそのまま画面上のピクセル相当
        const scrollX = Math.floor(-(o.canvasScrollX || 0) / o.tileSize);
        const scrollY = Math.floor(-(o.canvasScrollY || 0) / o.tileSize);

        // STAGEの表示画面の大きさを元に、現在のスクロール位置から見てだいたい画面内になるように
        o.pasteOffset = {
            x: Math.max(0, scrollX + 2),
            y: Math.max(0, scrollY + 2)
        };

        o.currentTool = 'paste';
        document.querySelectorAll('#stage-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'paste');
        });
        o.render();
    }

    confirmPaste() {
        const o = this.owner;
        if (!o.pasteData || !o.pasteData.tiles) return;

        o.saveToHistory();
        const stage = App.projectData.stage;
        const layer = stage.layers.fg;

        const tiles = o.pasteData.tiles;
        const h = tiles.length;
        const w = tiles[0].length;

        // Paste Tiles
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const tx = o.pasteOffset.x + dx;
                const ty = o.pasteOffset.y + dy;
                const tile = tiles[dy][dx];

                if (tx >= 0 && tx < stage.width && ty >= 0 && ty < stage.height) {
                    if (tile !== -1) {
                        layer[ty][tx] = tile;
                    }
                }
            }
        }

        // Paste Entities
        if (o.pasteData.entities) {
            if (!stage.entities) stage.entities = [];
            o.pasteData.entities.forEach(e => {
                const newX = o.pasteOffset.x + e.relX;
                const newY = o.pasteOffset.y + e.relY;
                stage.entities.push({
                    x: newX,
                    y: newY,
                    templateId: e.templateId
                });
            });
        }

        o.pasteMode = false;
        o.pasteData = null;
        o.currentTool = 'select';
        o.startSelectionMode();
    }

    flipVertical() {
        const o = this.owner;
        if (o.pasteMode && o.pasteData) {
            o.flipData(o.pasteData, 'v');
            o.render();
            return;
        }
        if (o.isFloating && o.floatingData) {
            const data = { tiles: o.floatingData, entities: o.floatingEntities };
            o.flipData(data, 'v');
            o.floatingData = data.tiles;
            o.floatingEntities = data.entities;
            o.render();
            return;
        }
        if (o.selectionStart && o.selectionEnd) {
            o.saveToHistory();
            const x1 = Math.min(o.selectionStart.x, o.selectionEnd.x);
            const y1 = Math.min(o.selectionStart.y, o.selectionEnd.y);
            const x2 = Math.max(o.selectionStart.x, o.selectionEnd.x);
            const y2 = Math.max(o.selectionStart.y, o.selectionEnd.y);
            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            // 範囲内のデータを抽出
            const tiles = [];
            for (let y = y1; y <= y2; y++) {
                tiles.push([...App.projectData.stage.layers.fg[y].slice(x1, x1 + w)]);
            }
            const entities = [];
            if (App.projectData.stage.entities) {
                App.projectData.stage.entities.forEach(e => {
                    if (e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2) {
                        entities.push({ ...e, relX: e.x - x1, relY: e.y - y1 });
                    }
                });
                // 範囲内のエンティティを一度削除
                App.projectData.stage.entities = App.projectData.stage.entities.filter(e => 
                    !(e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2)
                );
            }

            const data = { tiles, entities };
            o.flipData(data, 'v');

            // 反転したデータを書き戻す
            for (let dy = 0; dy < data.tiles.length; dy++) {
                for (let dx = 0; dx < data.tiles[0].length; dx++) {
                    App.projectData.stage.layers.fg[y1 + dy][x1 + dx] = data.tiles[dy][dx];
                }
            }
            data.entities.forEach(e => {
                App.projectData.stage.entities.push({ ...e, x: x1 + e.relX, y: y1 + e.relY });
            });

            o.render();
            return;
        }
    }

    flipHorizontal() {
        const o = this.owner;
        if (o.pasteMode && o.pasteData) {
            o.flipData(o.pasteData, 'h');
            o.render();
            return;
        }
        if (o.isFloating && o.floatingData) {
            const data = { tiles: o.floatingData, entities: o.floatingEntities };
            o.flipData(data, 'h');
            o.floatingData = data.tiles;
            o.floatingEntities = data.entities;
            o.render();
            return;
        }
        if (o.selectionStart && o.selectionEnd) {
            o.saveToHistory();
            const x1 = Math.min(o.selectionStart.x, o.selectionEnd.x);
            const y1 = Math.min(o.selectionStart.y, o.selectionEnd.y);
            const x2 = Math.max(o.selectionStart.x, o.selectionEnd.x);
            const y2 = Math.max(o.selectionStart.y, o.selectionEnd.y);
            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            const tiles = [];
            for (let y = y1; y <= y2; y++) {
                tiles.push([...App.projectData.stage.layers.fg[y].slice(x1, x1 + w)]);
            }
            const entities = [];
            if (App.projectData.stage.entities) {
                App.projectData.stage.entities.forEach(e => {
                    if (e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2) {
                        entities.push({ ...e, relX: e.x - x1, relY: e.y - y1 });
                    }
                });
                App.projectData.stage.entities = App.projectData.stage.entities.filter(e => 
                    !(e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2)
                );
            }

            const data = { tiles, entities };
            o.flipData(data, 'h');

            for (let dy = 0; dy < data.tiles.length; dy++) {
                for (let dx = 0; dx < data.tiles[0].length; dx++) {
                    App.projectData.stage.layers.fg[y1 + dy][x1 + dx] = data.tiles[dy][dx];
                }
            }
            data.entities.forEach(e => {
                App.projectData.stage.entities.push({ ...e, x: x1 + e.relX, y: y1 + e.relY });
            });

            o.render();
            return;
        }
    }

    processPixel(e) {
        const o = this.owner;
        if (App.currentScreen !== 'stage') return;

        // 繧､繝吶Φ繝医°繧峨け繝ｩ繧､繧｢繝ｳ繝亥ｺｧ讓吶ｒ蜿門ｾ暦ｼ・ndefined蟇ｾ遲厄ｼ・
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        if (clientX === undefined || clientY === undefined) return;

        const { x, y } = o.getTileFromEvent(e);

        // 蠎ｧ讓吶′NaN縺ｮ蝣ｴ蜷医・蜃ｦ逅・＠縺ｪ縺・
        if (isNaN(x) || isNaN(y)) return;

        const stage = App.projectData.stage;
        if (x < 0 || x >= stage.width || y < 0 || y >= stage.height) return;

        const layer = stage.layers[o.currentLayer];

        // 驕ｸ謚樔ｸｭ縺ｮ繝・Φ繝励Ξ繝ｼ繝医・繧ｹ繝励Λ繧､繝医し繧､繧ｺ繧貞叙蠕・
        // 繧ｨ繝ｳ繝・ぅ繝・ぅ驟榊・縺ｮ遒ｺ菫・
        if (!stage.entities) stage.entities = [];

        // テンプレート取得ヘルパー
        const getTemplate = (idx) => {
            return (App.projectData.templates && App.projectData.templates[idx]) || null;
        };

        // スプライトサイズ取得
        const getTemplateSize = (templateIdx) => o.getTemplateSize(templateIdx);

        switch (o.currentTool) {
            case 'pen':
                if (o.selectedTemplate !== null) {
                    const tmpl = getTemplate(o.selectedTemplate);
                    const spriteSize = getTemplateSize(o.selectedTemplate);

                    // 繧ｨ繝ｳ繝・ぅ繝・ぅ繧ｿ繧､繝励・蝣ｴ蜷茨ｼ・ntities驟榊・縺ｸ霑ｽ蜉・・
                    if (tmpl && ['player', 'enemy', 'item'].includes(tmpl.type)) {
                        // 譌｢蟄倥・蜷悟ｺｧ讓吶お繝ｳ繝・ぅ繝・ぅ繧貞炎髯､・井ｸ頑嶌縺搾ｼ・
                        // 32x32縺ｮ蝣ｴ蜷医・2x2鬆伜沺縺ｮ驥崎､・ｒ閠・・縺吶∋縺阪□縺後√す繝ｳ繝励Ν縺ｫ蜴溽せ荳閾ｴ縺ｧ蛻､螳・
                        // 縺ｾ縺溘・縲後◎縺ｮ蠎ｧ讓吶↓縺ゅｋ繧ゅ・縲阪ｒ豸医☆
                        const removeIdx = stage.entities.findIndex(e => {
                            // 蜷後§蠎ｧ讓吶↓縺ゅｋ繧ｨ繝ｳ繝・ぅ繝・ぅ繧呈爾縺・
                            // 蜴ｳ蟇・↓縺ｯ遏ｩ蠖｢蛻､螳壹☆縺ｹ縺阪□縺後√お繝・ぅ繧ｿ謫堺ｽ懊→縺励※縺ｯ蜴溽せ繧ｯ繝ｪ繝・け縺ｧ荳頑嶌縺阪′閾ｪ辟ｶ
                            return e.x === x && e.y === y;
                        });
                        if (removeIdx >= 0) {
                            stage.entities.splice(removeIdx, 1);
                        }

                        // 譁ｰ隕剰ｿｽ蜉
                        stage.entities.push({
                            x: x,
                            y: y,
                            templateId: o.selectedTemplate
                        });

                        // 繝槭ャ繝励ち繧､繝ｫ縺ｮ譖ｸ縺崎ｾｼ縺ｿ縺ｯ繧ｹ繧ｭ繝・・・郁レ譎ｯ邯ｭ謖・ｼ・
                    } else {
                        // 騾壼ｸｸ繧ｿ繧､繝ｫ・・ap驟榊・縺ｸ譖ｸ縺崎ｾｼ縺ｿ・・
                        const tileValue = o.selectedTemplate + 100;

                        if (spriteSize === 2) {
                            // 32x32繧ｹ繝励Λ繧､繝・
                            const snapX = Math.floor(x / 2) * 2;
                            const snapY = Math.floor(y / 2) * 2;

                            for (let dy = 0; dy < 2; dy++) {
                                for (let dx = 0; dx < 2; dx++) {
                                    const tx = snapX + dx;
                                    const ty = snapY + dy;
                                    if (tx >= 0 && tx < stage.width && ty >= 0 && ty < stage.height) {
                                        if (dx === 0 && dy === 0) {
                                            layer[ty][tx] = tileValue;
                                        } else {
                                            layer[ty][tx] = -1000 - (dy * 2 + dx);
                                        }
                                    }
                                }
                            }
                        } else {
                            // 16x16繧ｹ繝励Λ繧､繝・
                            layer[y][x] = tileValue;
                        }
                    }
                }
                break;

            case 'eraser':
                // 縺ｾ縺壹お繝ｳ繝・ぅ繝・ぅ繧貞炎髯､
                let entityDeleted = false;
                for (let i = stage.entities.length - 1; i >= 0; i--) {
                    const e = stage.entities[i];
                    // 繧ｨ繝ｳ繝・ぅ繝・ぅ縺ｮ蜊譛蛾伜沺繧定ｨ育ｮ・
                    const tmpl = getTemplate(e.templateId);
                    const size = getTemplateSize(e.templateId);
                    const w = (size === 2) ? 2 : 1;
                    const h = (size === 2) ? 2 : 1;

                    // 繧ｯ繝ｪ繝・け蠎ｧ讓吶′繧ｨ繝ｳ繝・ぅ繝・ぅ蜀・↓縺ゅｋ縺・
                    if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) {
                        stage.entities.splice(i, 1);
                        entityDeleted = true;
                        // 驥阪↑縺｣縺ｦ縺・ｋ蝣ｴ蜷医☆縺ｹ縺ｦ豸医☆縺九∽ｸ逡ｪ荳翫□縺第ｶ医☆縺九ゅ％縺薙〒縺ｯ蜈ｨ縺ｦ豸医☆縲・
                    }
                }

                // 繧ｨ繝ｳ繝・ぅ繝・ぅ縺悟炎髯､縺輔ｌ縺溷ｴ蜷医√・繝・・繧ｿ繧､繝ｫ縺ｯ豸医＆縺ｪ縺・ｼ郁ｪ､謫堺ｽ憺亟豁｢・・
                // 縺溘□縺励√Θ繝ｼ繧ｶ繝ｼ縺梧・遉ｺ逧・↓閭梧勹繧よｶ医＠縺溘＞蝣ｴ蜷医・蜀阪け繝ｪ繝・け縺悟ｿ・ｦ・
                if (entityDeleted) break;

                // 繝槭ャ繝励ち繧､繝ｫ縺ｮ蜑企勁蜃ｦ逅・ｼ域里蟄倥Ο繧ｸ繝・け・・
                const currentTile = layer[y][x];
                if (currentTile <= -1000) {
                    const offset = -(currentTile + 1000);
                    const dx = offset % 2;
                    const dy = Math.floor(offset / 2);
                    const originX = x - dx;
                    const originY = y - dy;
                    for (let iy = 0; iy < 2; iy++) {
                        for (let ix = 0; ix < 2; ix++) {
                            const tx = originX + ix;
                            const ty = originY + iy;
                            if (tx >= 0 && tx < stage.width && ty >= 0 && ty < stage.height) {
                                layer[ty][tx] = -1;
                            }
                        }
                    }
                } else if (currentTile >= 100) {
                    const templateIdx = currentTile - 100;
                    const spriteSize = getTemplateSize(templateIdx);
                    if (spriteSize === 2) {
                        for (let iy = 0; iy < 2; iy++) {
                            for (let ix = 0; ix < 2; ix++) {
                                const tx = x + ix;
                                const ty = y + iy;
                                if (tx >= 0 && tx < stage.width && ty >= 0 && ty < stage.height) {
                                    layer[ty][tx] = -1;
                                }
                            }
                        }
                    } else {
                        layer[y][x] = -1;
                    }
                } else {
                    layer[y][x] = -1;
                }
                break;

            case 'fill':
                if (o.selectedTemplate !== null) {
                    const tmpl = getTemplate(o.selectedTemplate);
                    // エンティティの塗りつぶしはサポートしない（マップのみ）
                    if (tmpl && ['player', 'enemy', 'item'].includes(tmpl.type)) {
                        alert('キャラクターやアイテムで塗りつぶしはできません');
                        return;
                    }

                    const newValue = o.selectedTemplate + 100;
                    this.floodFill(x, y, layer[y][x], newValue);
                }
                break;

            case 'eyedropper':
                // 譛蜑埼擇・医お繝ｳ繝・ぅ繝・ぅ・峨ｒ蜆ｪ蜈亥叙蠕・
                let foundEntity = null;
                for (const e of stage.entities) {
                    const tmpl = getTemplate(e.templateId);
                    const size = getTemplateSize(e.templateId);
                    const w = (size === 2) ? 2 : 1;
                    const h = (size === 2) ? 2 : 1;
                    if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) {
                        foundEntity = e;
                        break; // 譛蛻昴↓隕九▽縺九▲縺溘ｂ縺ｮ繧呈治逕ｨ
                    }
                }

                if (foundEntity) {
                    o.selectedTemplate = foundEntity.templateId;
                    o.initTemplateList();
                    // 繝・・繝ｫ繧偵・繝ｳ縺ｫ謌ｻ縺・
                    o.currentTool = 'pen';
                    // 繝・・繝ｫ繝舌・縺ｮ隕九◆逶ｮ譖ｴ譁ｰ縺ｯ逵∫払・亥・謠冗判縺ｧ蜿肴丐縺輔ｌ繧九°隕∫｢ｺ隱搾ｼ・
                } else {
                    // 繝槭ャ繝励ち繧､繝ｫ縺九ｉ蜿門ｾ・
                    const tileId = layer[y][x];
                    if (tileId >= 100) {
                        const templateIdx = tileId - 100;
                        if (templateIdx >= 0 && templateIdx < o.templates.length) {
                            o.selectedTemplate = templateIdx;
                            o.initTemplateList();
                            o.currentTool = 'pen';
                        }
                    } else if (tileId >= 0) {
                        const idx = o.templates.findIndex(t =>
                            (t.sprites?.idle?.frames?.[0] === tileId) || (t.sprites?.main?.frames?.[0] === tileId)
                        );
                        if (idx >= 0) {
                            o.selectedTemplate = idx;
                            o.initTemplateList();
                            o.currentTool = 'pen';
                        }
                    }
                }
                break;
        }

        o.render();
    }

    floodFill(startX, startY, targetValue, newValue) {
        const o = this.owner;
        if (targetValue === newValue) return;

        const stage = App.projectData.stage;
        const layer = stage.layers[this.owner.currentLayer];
        const stack = [[startX, startY]];

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= stage.width || y < 0 || y >= stage.height) continue;
            if (layer[y][x] !== targetValue) continue;

            layer[y][x] = newValue;
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }

    // 選択範囲内のタイル・エンティティをすべて削除
    eraseSelection() {
        const o = this.owner;
        if (!o.selectionStart || !o.selectionEnd) return false;

        const stage = App.projectData.stage;
        if (!stage) return false;

        const layer = stage.layers[o.currentLayer];
        if (!layer) return false;

        const x1 = Math.min(o.selectionStart.x, o.selectionEnd.x);
        const y1 = Math.min(o.selectionStart.y, o.selectionEnd.y);
        const x2 = Math.max(o.selectionStart.x, o.selectionEnd.x);
        const y2 = Math.max(o.selectionStart.y, o.selectionEnd.y);

        o.saveToHistory();

        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (x < 0 || x >= stage.width || y < 0 || y >= stage.height) continue;
                layer[y][x] = -1;
            }
        }

        // 選択範囲内のエンティティも削除
        if (stage.entities) {
            stage.entities = stage.entities.filter(e =>
                !(e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2)
            );
        }

        this.cancelSelectionMode();
        o.render();
        return true;
    }
}
