/**
 * PixelGameKit - ステージエディタ 設定パネル
 */

class StageSettings {
    constructor(owner) {
        this.owner = owner;
    }

    initStageSettings() {
        const panel = document.getElementById('stage-settings-panel');
        const header = document.getElementById('stage-settings-header');
        if (!panel || !header) return;

        // パネル内のクリック/タッチイベントがキャンバスに伝わらないように
        panel.addEventListener('click', (e) => e.stopPropagation());
        panel.addEventListener('touchstart', (e) => e.stopPropagation());
        panel.addEventListener('touchend', (e) => e.stopPropagation());

        // ヘッダクリックでパネル開閉
        header.addEventListener('click', () => {
            const wasCollapsed = panel.classList.contains('collapsed');
            panel.classList.toggle('collapsed');

            // パネルを開く時にpendingArea値を現在のステージサイズから最新に
            if (wasCollapsed) {
                this.owner.pendingAreaW = Math.floor(App.projectData.stage.width / 16);
                this.owner.pendingAreaH = Math.floor(App.projectData.stage.height / 16);
                this.updateStageSettingsUI();
            }
        });

        // 一時的なサイズ値（保存ボタン押下まで反映しない）
        this.owner.pendingAreaW = Math.floor(App.projectData.stage.width / 16);
        this.owner.pendingAreaH = Math.floor(App.projectData.stage.height / 16);

        // UI要素取得
        const areaWValue = document.getElementById('area-w-value');
        const areaHValue = document.getElementById('area-h-value');
        const areaWMinus = document.getElementById('area-w-minus');
        const areaWPlus = document.getElementById('area-w-plus');
        const areaHMinus = document.getElementById('area-h-minus');
        const areaHPlus = document.getElementById('area-h-plus');
        const bgColorSwatch = document.getElementById('stage-bg-color');
        const saveBtn = document.getElementById('stage-settings-save');
        const copyEditKeyBtn = document.getElementById('copy-editkey-btn');

        // エディットキーをコピー
        if (copyEditKeyBtn) {
            copyEditKeyBtn.addEventListener('click', async () => {
                const editKeyDisplay = document.getElementById('stage-editkey-display');
                if (editKeyDisplay && editKeyDisplay.value) {
                    try {
                        await navigator.clipboard.writeText(editKeyDisplay.value);
                        if (App && typeof App.showToast === 'function') {
                            App.showToast(this.owner.t('U436') || 'エディットキーをコピーしました');
                        }
                    } catch (err) {
                        console.error('Failed to copy: ', err);
                        // フォールバック
                        editKeyDisplay.select();
                        document.execCommand('copy');
                        if (App && typeof App.showToast === 'function') {
                            App.showToast(this.owner.t('U436') || 'エディットキーをコピーしました');
                        }
                    }
                }
            });
        }

        // 現在の値を反映
        this.updateStageSettingsUI();

        // 名前は保存ボタン押下時のみ反映（リアルタイム保存しない）
        // イベントリスナーは不要

        // エリアサイズ変更（UI表示のみ、保存ボタンまで反映しない）
        if (areaWMinus) {
            areaWMinus.addEventListener('click', () => {
                if (this.owner.pendingAreaW > 1) {
                    this.owner.pendingAreaW--;
                    if (areaWValue) areaWValue.textContent = this.owner.pendingAreaW;
                }
            });
        }
        if (areaWPlus) {
            areaWPlus.addEventListener('click', () => {
                if (this.owner.pendingAreaW < 32) {
                    this.owner.pendingAreaW++;
                    if (areaWValue) areaWValue.textContent = this.owner.pendingAreaW;
                }
            });
        }
        if (areaHMinus) {
            areaHMinus.addEventListener('click', () => {
                if (this.owner.pendingAreaH > 1) {
                    this.owner.pendingAreaH--;
                    if (areaHValue) areaHValue.textContent = this.owner.pendingAreaH;
                }
            });
        }
        if (areaHPlus) {
            areaHPlus.addEventListener('click', () => {
                if (this.owner.pendingAreaH < 10) {
                    this.owner.pendingAreaH++;
                    if (areaHValue) areaHValue.textContent = this.owner.pendingAreaH;
                }
            });
        }

        // 背景色（スプライトエディタのカラーピッカーを使用）
        if (bgColorSwatch) {
            bgColorSwatch.addEventListener('click', () => {
                this.openBgColorPicker();
            });
        }

        // 透明色
        const transparentSelect = document.getElementById('stage-transparent-index');

        // BGM選択ボタン
        this.owner.selectedBgmType = null;
        const bgmButtons = document.querySelectorAll('.bgm-select-btn');
        bgmButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.owner.selectedBgmType = btn.dataset.bgmType;
                this.owner.openBgmSelectPopup();
            });
        });

        // BGMポップアップ背景クリックで閉じる
        const bgmPopup = document.getElementById('bgm-select-popup');
        if (bgmPopup) {
            bgmPopup.addEventListener('click', (e) => {
                if (e.target === bgmPopup) {
                    bgmPopup.classList.add('hidden');
                    this.owner.stopBgmPreview();
                }
            });
        }

        // クリア条件（UI表示の切り替えのみ）
        const clearCondition = document.getElementById('stage-clear-condition');
        const timeLimitRow = document.getElementById('time-limit-row');
        const timeLimitLabel = document.getElementById('time-limit-label');

        const updateTimeLimitLabel = () => {
            const condition = clearCondition?.value || 'none';
            if (condition === 'survival') {
                if (timeLimitLabel) timeLimitLabel.textContent = 'サバイバル時間';
                if (timeLimitRow) timeLimitRow.style.display = '';
            } else {
                if (timeLimitLabel) timeLimitLabel.textContent = '制限時間';
                if (timeLimitRow) timeLimitRow.style.display = '';
            }
        };

        if (clearCondition) {
            clearCondition.addEventListener('change', updateTimeLimitLabel);
            updateTimeLimitLabel();
        }

        // 保存ボタンでの一括保存処理
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const stage = App.projectData.stage;
                const meta = App.projectData.meta;

                // タイトル・作成者
                const nameInput = document.getElementById('stage-name-input');
                if (nameInput) {
                    stage.name = nameInput.value;
                    if (meta) meta.name = nameInput.value || 'NEW GAME';
                }

                const authorInput = document.getElementById('stage-author-input');
                if (authorInput && meta) {
                    meta.author = authorInput.value || 'You';
                }

                // スコア表示設定
                const showScoreCheck = document.getElementById('stage-show-score');
                if (showScoreCheck) {
                    stage.showScore = showScoreCheck.checked;
                }

                // 背景透過インデックス
                if (transparentSelect) {
                    stage.transparentIndex = parseInt(transparentSelect.value) || 0;
                }

                // クリア条件
                if (clearCondition) {
                    stage.clearCondition = clearCondition.value;
                }

                // 制限時間
                const timeMin = document.getElementById('stage-time-min');
                const timeSec = document.getElementById('stage-time-sec');
                if (timeMin && timeSec) {
                    const min = parseInt(timeMin.value) || 0;
                    const sec = parseInt(timeSec.value) || 0;
                    stage.timeLimit = min * 60 + sec;
                }

                // サイズ変更（最後に実行して再描画処理を含ませる）
                const newWidth = this.owner.pendingAreaW * 16;
                const newHeight = this.owner.pendingAreaH * 16;
                if (newWidth !== stage.width || newHeight !== stage.height) {
                    this.resizeStage(newWidth, newHeight);
                }

                // 設定パネルを閉じる
                App.updateGameInfo();
                panel.classList.add('collapsed');
            });
        }
    }

    updateStageSettingsUI(preserveFormState = false) {
        const stage = App.projectData.stage;

        const nameInput = document.getElementById('stage-name-input');
        const areaWValue = document.getElementById('area-w-value');
        const areaHValue = document.getElementById('area-h-value');
        const bgColorSwatch = document.getElementById('stage-bg-color');
        const transparentSelect = document.getElementById('stage-transparent-index');
        const timeMin = document.getElementById('stage-time-min');
        const timeSec = document.getElementById('stage-time-sec');
        const authorInput = document.getElementById('stage-author-input');

        // 入力欄の現在値をprojectDataに反映（背景色変更時など他設定の更新で上書きされないように）
        if (preserveFormState) {
            if (nameInput) {
                stage.name = nameInput.value;
                if (App.projectData.meta) App.projectData.meta.name = nameInput.value || 'NEW GAME';
            }
            if (authorInput && App.projectData.meta) {
                App.projectData.meta.author = authorInput.value || 'You';
            }
        }

        // ステージタイトル・作成者名の表示
        if (nameInput) nameInput.value = stage.name || App.projectData.meta?.name || 'NEW GAME';
        if (authorInput) authorInput.value = App.projectData.meta?.author || 'You';

        // エディットキー表示
        const editKeyDisplay = document.getElementById('stage-editkey-display');
        if (editKeyDisplay) editKeyDisplay.value = App.projectData.meta?.editKey || '';

        // ステージサイズ（preserveFormState時は現在のUI値を保持）
        if (!preserveFormState) {
            this.owner.pendingAreaW = Math.floor(stage.width / 16);
            this.owner.pendingAreaH = Math.floor(stage.height / 16);
        }
        if (areaWValue) areaWValue.textContent = this.owner.pendingAreaW;
        if (areaHValue) areaHValue.textContent = this.owner.pendingAreaH;

        // 背景色
        if (bgColorSwatch) bgColorSwatch.style.backgroundColor = stage.bgColor || '#3CBCFC';

        // 透明色
        if (transparentSelect) transparentSelect.value = stage.transparentIndex || 0;

        // クリア条件・制限時間・スコア表示（preserveFormState時はフォームの現在値を保持）
        const clearConditionEl = document.getElementById('stage-clear-condition');
        const timeLimitLabel = document.getElementById('time-limit-label');
        const showScoreCheck = document.getElementById('stage-show-score');
        if (!preserveFormState) {
            if (clearConditionEl) {
                clearConditionEl.value = stage.clearCondition || 'none';
                if (timeLimitLabel) {
                    timeLimitLabel.textContent = stage.clearCondition === 'survival' ? 'サバイバル時間' : '制限時間';
                }
            }
            const totalSec = stage.timeLimit || 0;
            if (timeMin) timeMin.value = Math.floor(totalSec / 60);
            if (timeSec) timeSec.value = totalSec % 60;
            if (showScoreCheck) showScoreCheck.checked = stage.showScore !== false;
        }

        // BGMボタン表示を更新
        this.updateBgmSelects();
    }

    updateBgmSelects() {
        const bgmTypes = ['stage', 'invincible', 'clear', 'gameover', 'boss'];
        const songs = App.projectData.songs || [];
        const bgm = App.projectData.stage?.bgm || {};

        bgmTypes.forEach(type => {
            const btn = document.getElementById(`bgm-${type}-btn`);
            if (!btn) return;

            const value = bgm[type];
            if (value === '' || value === undefined || value === null) {
                btn.textContent = (App.currentLang === 'ENG') ? 'None' : 'なし';
            } else {
                const idx = parseInt(value);
                const song = songs[idx];
                btn.textContent = song?.name || `BGM ${idx + 1}`;
            }
        });
    }

    resizeStage(newWidth, newHeight) {
        const stage = App.projectData.stage;
        const oldWidth = stage.width;
        const oldHeight = stage.height;

        // 新しいレイヤー配列を作成
        const newFg = App.create2DArray(newWidth, newHeight, -1);
        const newBg = App.create2DArray(newWidth, newHeight, -1);
        const newCollision = App.create2DArray(newWidth, newHeight, 0);

        // 縦方向は上に追加、古いデータは下にシフト；横方向は上から削除
        // 横方向は右に追加、古いデータは右から削除
        const heightDiff = newHeight - oldHeight;
        const yOffset = heightDiff > 0 ? heightDiff : 0; // 拡大時のオフセット
        const srcYStart = heightDiff < 0 ? -heightDiff : 0; // 縮小時のソース開始位置

        // 既存のデータをコピー（上に追加/下から削除対応）
        for (let srcY = srcYStart; srcY < oldHeight; srcY++) {
            const dstY = srcY - srcYStart + yOffset;
            if (dstY >= newHeight) break;

            for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
                if (stage.layers.fg[srcY] && stage.layers.fg[srcY][x] !== undefined) {
                    newFg[dstY][x] = stage.layers.fg[srcY][x];
                }
                if (stage.layers.bg[srcY] && stage.layers.bg[srcY][x] !== undefined) {
                    newBg[dstY][x] = stage.layers.bg[srcY][x];
                }
                if (stage.layers.collision[srcY] && stage.layers.collision[srcY][x] !== undefined) {
                    newCollision[dstY][x] = stage.layers.collision[srcY][x];
                }
            }
        }

        stage.width = newWidth;
        stage.height = newHeight;
        stage.layers.fg = newFg;
        stage.layers.bg = newBg;
        stage.layers.collision = newCollision;

        // エンティティのY座標もシフト（レイヤーと同じオフセットを適用）
        if (stage.entities && Array.isArray(stage.entities) && heightDiff !== 0) {
            stage.entities.forEach(e => {
                e.y += heightDiff;
            });
            // 縮小時に範囲外になったエンティティを削除
            if (heightDiff < 0) {
                stage.entities = stage.entities.filter(e =>
                    e.y >= 0 && e.y < newHeight && e.x >= 0 && e.x < newWidth
                );
            }
        }
        // 横縮小時に範囲外のエンティティを削除
        if (newWidth < oldWidth && stage.entities) {
            stage.entities = stage.entities.filter(e => e.x >= 0 && e.x < newWidth);
        }

        // スクロール位置を左下から表示するようにリセット
        // 縦方向：ステージの上辺がキャンバス上辺に来るように
        this.owner.canvasScrollX = 0;
        const canvasHeight = 320; // キャンバスの高さ（固定値）
        const stagePixelHeight = newHeight * this.owner.tileSize;
        this.owner.canvasScrollY = stagePixelHeight > canvasHeight ? -(stagePixelHeight - canvasHeight) : 0;

        this.owner.resize();
        this.owner.render();
    }

    openBgColorPicker() {
        const currentColor = App.projectData.stage.bgColor || '#3CBCFC';

        // 状態
        let hue = 0, saturation = 100, brightness = 100;
        let r = 255, g = 0, b = 0;

        // カラー変換関数
        const hsvToRgb = (h, s, v) => {
            s /= 100; v /= 100;
            const c = v * s;
            const x = c * (1 - Math.abs((h / 60) % 2 - 1));
            const m = v - c;
            let r1, g1, b1;
            if (h < 60) { r1 = c; g1 = x; b1 = 0; }
            else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
            else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
            else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
            else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
            else { r1 = c; g1 = 0; b1 = x; }
            return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
        };

        const rgbToHsv = (r, g, b) => {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const d = max - min;
            let h = 0;
            if (d !== 0) {
                if (max === r) h = ((g - b) / d) % 6;
                else if (max === g) h = (b - r) / d + 2;
                else h = (r - g) / d + 4;
                h *= 60; if (h < 0) h += 360;
            }
            return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
        };

        const rgbToHex = (r, g, b) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();

        const hexToRgb = (hex) => {
            hex = hex.replace('#', '');
            return { r: parseInt(hex.substr(0, 2), 16), g: parseInt(hex.substr(2, 2), 16), b: parseInt(hex.substr(4, 2), 16) };
        };

        // 初期値をcurrentColorから設定
        const initRgb = hexToRgb(currentColor);
        r = initRgb.r; g = initRgb.g; b = initRgb.b;
        const initHsv = rgbToHsv(r, g, b);
        hue = initHsv.h; saturation = initHsv.s; brightness = initHsv.v;

        // bodyスクロール無効化
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // モーダルオーバーレイ
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;touch-action:none;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#2d2d44;padding:20px;border-radius:16px;width:90%;max-width:320px;box-shadow:0 10px 40px rgba(0,0,0,0.4);';

        modal.innerHTML = `
            <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:16px;text-align:center;">背景色</div>
            <div style="display:flex;gap:12px;margin-bottom:16px;">
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">現在</div>
                    <div id="cp-current" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${currentColor};"></div>
                </div>
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">編集中</div>
                    <div id="cp-new" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${currentColor};"></div>
                </div>
            </div>
            <div style="display:flex;gap:4px;margin-bottom:12px;background:#1a1a2e;padding:4px;border-radius:8px;">
                <button id="cp-tab-hsv" style="flex:1;padding:8px;border:none;background:#4a4a6a;color:#fff;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;">HSV</button>
                <button id="cp-tab-rgb" style="flex:1;padding:8px;border:none;background:transparent;color:#8888aa;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;">RGB</button>
            </div>
            <div id="cp-picker-area" style="height:200px;position:relative;margin-bottom:12px;">
                <div id="cp-hsv" style="position:absolute;top:0;left:0;right:0;bottom:0;">
                    <div id="cp-sb-box" style="position:relative;width:100%;height:160px;border-radius:8px;cursor:crosshair;margin-bottom:12px;overflow:hidden;background:#ff0000;">
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to right,#fff,transparent);"></div>
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,transparent,#000);"></div>
                        <div id="cp-sb-cursor" style="position:absolute;width:16px;height:16px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;z-index:10;transform:translate(-50%,-50%);left:100%;top:0%;"></div>
                    </div>
                    <div id="cp-hue-slider" style="position:relative;height:24px;border-radius:12px;background:linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000);cursor:pointer;">
                        <div id="cp-hue-cursor" style="position:absolute;top:50%;width:8px;height:28px;background:#fff;border-radius:4px;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;transform:translate(-50%,-50%);left:0%;"></div>
                    </div>
                </div>
                <div id="cp-rgb" style="position:absolute;top:0;left:0;right:0;bottom:0;display:none;flex-direction:column;justify-content:center;gap:20px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="color:#ff6b6b;font-size:14px;font-weight:600;width:24px;">R</span>
                        <input type="range" id="cp-slider-r" min="0" max="255" value="${r}" style="flex:1;height:28px;border-radius:14px;-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:linear-gradient(to right,#000,#ff0000);">
                        <span id="cp-value-r" style="color:#fff;font-size:13px;width:36px;text-align:right;">${r}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="color:#6bff6b;font-size:14px;font-weight:600;width:24px;">G</span>
                        <input type="range" id="cp-slider-g" min="0" max="255" value="${g}" style="flex:1;height:28px;border-radius:14px;-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:linear-gradient(to right,#000,#00ff00);">
                        <span id="cp-value-g" style="color:#fff;font-size:13px;width:36px;text-align:right;">${g}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="color:#6b6bff;font-size:14px;font-weight:600;width:24px;">B</span>
                        <input type="range" id="cp-slider-b" min="0" max="255" value="${b}" style="flex:1;height:28px;border-radius:14px;-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:linear-gradient(to right,#000,#0000ff);">
                        <span id="cp-value-b" style="color:#fff;font-size:13px;width:36px;text-align:right;">${b}</span>
                    </div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                <label style="color:#8888aa;font-size:12px;">HEX</label>
                <input type="text" id="cp-hex" value="${currentColor}" maxlength="7" style="flex:1;padding:10px 12px;border:2px solid #444466;border-radius:8px;background:#1a1a2e;color:#fff;font-family:monospace;font-size:14px;text-transform:uppercase;">
            </div>
            <div style="margin-bottom:16px;">
                <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">カラーパレット</div>
                <div id="cp-recent" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
            </div>
            <div style="display:flex;gap:10px;">
                <button id="cp-cancel" style="flex:1;padding:14px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#444466;color:#fff;">キャンセル</button>
                <button id="cp-ok" style="flex:1;padding:14px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#4a7dff;color:#fff;">OK</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // DOM要素取得
        const newColorEl = modal.querySelector('#cp-new');
        const sbBox = modal.querySelector('#cp-sb-box');
        const sbCursor = modal.querySelector('#cp-sb-cursor');
        const hueSlider = modal.querySelector('#cp-hue-slider');
        const hueCursor = modal.querySelector('#cp-hue-cursor');
        const hexInput = modal.querySelector('#cp-hex');
        const hsvPanel = modal.querySelector('#cp-hsv');
        const rgbPanel = modal.querySelector('#cp-rgb');
        const tabHsv = modal.querySelector('#cp-tab-hsv');
        const tabRgb = modal.querySelector('#cp-tab-rgb');
        const sliderR = modal.querySelector('#cp-slider-r');
        const sliderG = modal.querySelector('#cp-slider-g');
        const sliderB = modal.querySelector('#cp-slider-b');
        const valueR = modal.querySelector('#cp-value-r');
        const valueG = modal.querySelector('#cp-value-g');
        const valueB = modal.querySelector('#cp-value-b');
        const recentColorsEl = modal.querySelector('#cp-recent');

        // UI更新
        const updateUI = () => {
            const rgb = hsvToRgb(hue, saturation, brightness);
            r = rgb.r; g = rgb.g; b = rgb.b;
            const hex = rgbToHex(r, g, b);
            newColorEl.style.backgroundColor = hex;
            hexInput.value = hex;
            sbBox.style.backgroundColor = rgbToHex(...Object.values(hsvToRgb(hue, 100, 100)));
            sbCursor.style.left = `${saturation}%`;
            sbCursor.style.top = `${100 - brightness}%`;
            hueCursor.style.left = `${(hue / 360) * 100}%`;
            if (sliderR) { sliderR.value = r; valueR.textContent = r; }
            if (sliderG) { sliderG.value = g; valueG.textContent = g; }
            if (sliderB) { sliderB.value = b; valueB.textContent = b; }
        };

        const updateFromRGB = () => {
            const hsv = rgbToHsv(r, g, b);
            hue = hsv.h; saturation = hsv.s; brightness = hsv.v;
            updateUI();
        };

        // HSV/RGBタブ切替
        tabHsv.addEventListener('click', () => {
            hsvPanel.style.display = 'block';
            rgbPanel.style.display = 'none';
            tabHsv.style.background = '#4a4a6a'; tabHsv.style.color = '#fff';
            tabRgb.style.background = 'transparent'; tabRgb.style.color = '#8888aa';
        });
        tabRgb.addEventListener('click', () => {
            hsvPanel.style.display = 'none';
            rgbPanel.style.display = 'flex';
            tabRgb.style.background = '#4a4a6a'; tabRgb.style.color = '#fff';
            tabHsv.style.background = 'transparent'; tabHsv.style.color = '#8888aa';
        });

        // SBボックス操作
        let sbDrag = false;
        const updateSB = (e) => {
            const rect = sbBox.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            let x = (touch.clientX - rect.left) / rect.width * 100;
            let y = (touch.clientY - rect.top) / rect.height * 100;
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));
            saturation = x;
            brightness = 100 - y;
            updateUI();
        };
        sbBox.addEventListener('mousedown', (e) => { sbDrag = true; updateSB(e); });
        sbBox.addEventListener('touchstart', (e) => { sbDrag = true; updateSB(e); e.preventDefault(); }, { passive: false });
        document.addEventListener('mousemove', (e) => { if (sbDrag) updateSB(e); });
        document.addEventListener('touchmove', (e) => { if (sbDrag) { updateSB(e); e.preventDefault(); } }, { passive: false });
        document.addEventListener('mouseup', () => sbDrag = false);
        document.addEventListener('touchend', () => sbDrag = false);

        // Hueスライダー操作
        let hueDrag = false;
        const updateHue = (e) => {
            const rect = hueSlider.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            let x = (touch.clientX - rect.left) / rect.width;
            x = Math.max(0, Math.min(1, x));
            hue = x * 360;
            updateUI();
        };
        hueSlider.addEventListener('mousedown', (e) => { hueDrag = true; updateHue(e); });
        hueSlider.addEventListener('touchstart', (e) => { hueDrag = true; updateHue(e); e.preventDefault(); }, { passive: false });
        document.addEventListener('mousemove', (e) => { if (hueDrag) updateHue(e); });
        document.addEventListener('touchmove', (e) => { if (hueDrag) { updateHue(e); e.preventDefault(); } }, { passive: false });
        document.addEventListener('mouseup', () => hueDrag = false);
        document.addEventListener('touchend', () => hueDrag = false);

        // RGBスライダー
        if (sliderR) sliderR.addEventListener('input', () => { r = parseInt(sliderR.value); updateFromRGB(); });
        if (sliderG) sliderG.addEventListener('input', () => { g = parseInt(sliderG.value); updateFromRGB(); });
        if (sliderB) sliderB.addEventListener('input', () => { b = parseInt(sliderB.value); updateFromRGB(); });

        // HEX入力
        hexInput.addEventListener('change', () => {
            const val = hexInput.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                const rgb = hexToRgb(val);
                r = rgb.r; g = rgb.g; b = rgb.b;
                const hsv = rgbToHsv(r, g, b);
                hue = hsv.h; saturation = hsv.s; brightness = hsv.v;
                updateUI();
            }
        });

        // カラーパレット（App.nesPalette）からスウォッチを生成
        const palette = App.nesPalette || [];
        palette.forEach(c => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `width:24px;height:24px;border-radius:4px;cursor:pointer;border:2px solid #444466;background:${c};flex-shrink:0;`;
            swatch.addEventListener('click', () => {
                const rgb = hexToRgb(c);
                r = rgb.r; g = rgb.g; b = rgb.b;
                const hsv = rgbToHsv(r, g, b);
                hue = hsv.h; saturation = hsv.s; brightness = hsv.v;
                updateUI();
            });
            recentColorsEl.appendChild(swatch);
        });

        updateUI();

        const close = () => {
            document.body.style.overflow = originalOverflow;
            document.body.removeChild(overlay);
        };

        modal.querySelector('#cp-ok').addEventListener('click', () => {
            App.projectData.stage.bgColor = hexInput.value;
            this.updateStageSettingsUI(true);
            this.owner.initTemplateList();
            this.owner.initSpriteGallery();
            this.owner.render();
            close();
        });

        modal.querySelector('#cp-cancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    }

    playSePreview(seIndex) {
        const sounds = App.projectData?.sounds || [];
        if (seIndex < 0 || seIndex >= sounds.length) return;

        const se = sounds[seIndex];

        // グローバルオーディオエンジンを使用
        const audio = window.NesAudio || window.AudioManager;
        if (audio) {
            console.log('Previewing SE:', se.name, se.type);
            audio.playSE(se.type);
        } else {
            console.error('Audio engine (NesAudio/AudioManager) not found.');
        }
    }
}
