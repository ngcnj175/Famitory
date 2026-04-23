/**
 * SpriteEditorPalette
 * カラーパレット管理（表示・編集・プリセット・CRUD）
 */
const SpriteEditorPalette = {
    editor: null,

    init(parentEditor) {
        this.editor = parentEditor;
        this.initColorPalette();
        this.initAddColorButton();
        this.initPresetDialogEvents();
    },

    initColorPalette() {
        const container = document.getElementById('color-list');
        if (!container) return;

        container.innerHTML = '';

        const palette = App.nesPalette;

        palette.forEach((color, index) => {
            const div = document.createElement('div');
            div.className = 'palette-color' + (index === this.editor.selectedColor ? ' selected' : '');
            div.style.backgroundColor = color;

            // 長押しで削除
            let longPressTimer;
            let isLongPress = false;

            const startLongPress = () => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    App.showActionMenu(null, [
                        { text: App.I18N['U177']?.[App.currentLang] || '複製', action: () => this.duplicateColor(index) },
                        { text: App.I18N['U178']?.[App.currentLang] || '削除', style: 'destructive', action: () => this.deleteColor(index, false) },
                        { text: App.I18N['U179']?.[App.currentLang] || 'キャンセル', style: 'cancel' }
                    ]);
                }, 600);
            };

            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };

            div.addEventListener('mousedown', startLongPress);
            div.addEventListener('mouseup', cancelLongPress);
            div.addEventListener('mouseleave', cancelLongPress);
            div.addEventListener('touchstart', startLongPress, { passive: true });
            div.addEventListener('touchmove', cancelLongPress, { passive: true });
            div.addEventListener('touchend', cancelLongPress);

            // ダブルタップで編集、シングルタップで選択
            let lastTapTime = 0;

            div.addEventListener('click', () => {
                if (isLongPress) return;
                const now = Date.now();
                if (now - lastTapTime < 300) {
                    // ダブルタップ → 編集
                    this.editColor(index);
                    lastTapTime = 0;
                } else {
                    // シングルタップ → 選択
                    this.selectColor(index);
                    lastTapTime = now;
                }
            });

            container.appendChild(div);
        });
    },

    // ＋ボタンのイベント設定（init時に1回だけ呼ばれる）
    initAddColorButton() {
        const addBtn = document.getElementById('add-color-btn');
        if (!addBtn || addBtn.dataset.initialized) return; // 既に初期化済みならスキップ
        addBtn.dataset.initialized = 'true';

        let longPressTimer = null;
        let isLongPress = false;

        const startPress = () => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                this.openPresetDialog();
            }, 800);
        };

        const endPress = () => {
            clearTimeout(longPressTimer);
            if (!isLongPress) {
                // 短押し: 色追加（追加した色を選択状態にする）
                App.nesPalette.push('#000000');
                this.editor.selectedColor = App.nesPalette.length - 1;
                this.initColorPalette();
            }
        };

        addBtn.addEventListener('mousedown', startPress);
        addBtn.addEventListener('mouseup', endPress);
        addBtn.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
        addBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); }, { passive: false });
        addBtn.addEventListener('touchend', (e) => { e.preventDefault(); endPress(); }, { passive: false });
        addBtn.addEventListener('touchcancel', () => clearTimeout(longPressTimer));
    },

    // プリセット選択ダイアログを開く
    openPresetDialog() {
        const dialog = document.getElementById('palette-preset-dialog');
        if (dialog) {
            // 未選択状態で開く
            document.querySelectorAll('#palette-preset-list .preset-item').forEach(item => {
                item.classList.remove('selected');
                const arrow = item.querySelector('.preset-item-arrow');
                if (arrow) arrow.textContent = '';
            });
            dialog.classList.remove('hidden');
        }
    },

    // プリセット選択ダイアログを閉じる
    closePresetDialog() {
        const dialog = document.getElementById('palette-preset-dialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
    },

    // プリセットを適用（追加モード）
    applyPresetAdd() {
        const selected = document.querySelector('#palette-preset-list .preset-item.selected');
        if (!selected) {
            alert(App.I18N['U180']?.[App.currentLang] || 'プリセットを選択してください');
            return;
        }
        const preset = App.PALETTE_PRESETS[selected.dataset.value];
        if (preset) {
            // 既存パレットに追加
            preset.colors.forEach(color => {
                if (!App.nesPalette.includes(color)) {
                    App.nesPalette.push(color);
                }
            });
            this.initColorPalette();
            this.closePresetDialog();
        }
    },

    // プリセットを適用（置換モード）
    applyPresetReplace() {
        const selected = document.querySelector('#palette-preset-list .preset-item.selected');
        if (!selected) {
            alert(App.I18N['U180']?.[App.currentLang] || 'プリセットを選択してください');
            return;
        }

        const msg = App.I18N['U181']?.[App.currentLang] || '現在のパレットをおきかえますか？\nスプライトの色が変わる可能性があります。';
        const parts = msg.split('\n');

        App.showConfirm(parts[0], parts[1], () => {
            const preset = App.PALETTE_PRESETS[selected.dataset.value];
            if (preset) {
                App.nesPalette = preset.colors.slice();
                this.initColorPalette();
                this.closePresetDialog();
            }
        });
    },

    // プリセットダイアログのイベント初期化
    initPresetDialogEvents() {
        const addBtn = document.getElementById('preset-add-btn');
        const replaceBtn = document.getElementById('preset-replace-btn');
        const closeBtn = document.getElementById('preset-close-btn');
        const dialog = document.getElementById('palette-preset-dialog');

        if (addBtn) addBtn.addEventListener('click', () => this.applyPresetAdd());
        if (replaceBtn) replaceBtn.addEventListener('click', () => this.applyPresetReplace());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closePresetDialog());

        // 各項目のクリックで選択（‖＋ライトグレー背景）
        document.querySelectorAll('#palette-preset-list .preset-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('#palette-preset-list .preset-item').forEach(el => {
                    el.classList.remove('selected');
                    const a = el.querySelector('.preset-item-arrow');
                    if (a) a.textContent = '';
                });
                item.classList.add('selected');
                const arrow = item.querySelector('.preset-item-arrow');
                if (arrow) arrow.textContent = '▶';
            });
        });

        // 背景クリックで閉じる
        if (dialog) {
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) this.closePresetDialog();
            });
        }
    },

    // 色を削除（確認あり）
    deleteColor(index, needConfirm = true) {
        if (App.nesPalette.length <= 1) {
            alert(App.I18N['U183']?.[App.currentLang] || '最低1色は必要です');
            return;
        }
        if (needConfirm && !confirm('この色を削除しますか？\n（使用されているドットは透明になります）')) {
            return;
        }

        // スプライト内の参照を更新（削除）
        this.editor.updateAllSpriteColorReferences('delete', index);

        App.nesPalette.splice(index, 1);
        if (this.editor.selectedColor >= App.nesPalette.length) {
            this.editor.selectedColor = App.nesPalette.length - 1;
        }
        this.initColorPalette();
    },

    // 色を複製
    duplicateColor(index) {
        const color = App.nesPalette[index];

        // スプライト内の参照を更新（挿入によるズレ補正）
        // index+1 の位置に挿入される
        this.editor.updateAllSpriteColorReferences('insert', index + 1);

        // 該当色の後ろに追加
        App.nesPalette.splice(index + 1, 0, color);
        // 追加した色を選択状態にする
        this.editor.selectedColor = index + 1;
        this.initColorPalette();
    },

    editColor(index) {
        const currentColor = App.nesPalette[index];

        // よく使う色プリセット
        const recentColors = [
            '#000000', '#ffffff', '#ff0000', '#00ff00',
            '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'
        ];

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

        // モーダルオーバーレイを作成
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;touch-action:none;';

        // モーダルコンテンツ
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#2d2d44;padding:20px;border-radius:16px;width:90%;max-width:320px;box-shadow:0 10px 40px rgba(0,0,0,0.4);';

        modal.innerHTML = `
            <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:16px;text-align:center;">${App.I18N['U430']?.[App.currentLang] || 'カラー編集'}</div>
            <div style="display:flex;gap:12px;margin-bottom:16px;">
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">${App.I18N['U431']?.[App.currentLang] || '現在'}</div>
                    <div id="cp-current" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${currentColor};"></div>
                </div>
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">${App.I18N['U432']?.[App.currentLang] || '編集中'}</div>
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
                <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">${App.I18N['U433']?.[App.currentLang] || 'よく使う色'}</div>
                <div id="cp-recent" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
            </div>
            <div style="display:flex;gap:10px;">
                <button id="cp-cancel" style="flex:1;padding:14px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#444466;color:#fff;">${App.I18N['U105']?.[App.currentLang] || 'キャンセル'}</button>
                <button id="cp-ok" style="flex:1;padding:14px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#4a7dff;color:#fff;">${App.I18N['U120']?.[App.currentLang] || 'OK'}</button>
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
            sliderR.value = r; sliderG.value = g; sliderB.value = b;
            valueR.textContent = r; valueG.textContent = g; valueB.textContent = b;
        };

        const updateFromRGB = () => {
            const hsv = rgbToHsv(r, g, b);
            hue = hsv.h; saturation = hsv.s; brightness = hsv.v;
            updateUI();
        };

        // タブ切り替え
        tabHsv.addEventListener('click', () => {
            tabHsv.style.background = '#4a4a6a'; tabHsv.style.color = '#fff';
            tabRgb.style.background = 'transparent'; tabRgb.style.color = '#8888aa';
            hsvPanel.style.display = 'block'; rgbPanel.style.display = 'none';
        });
        tabRgb.addEventListener('click', () => {
            tabRgb.style.background = '#4a4a6a'; tabRgb.style.color = '#fff';
            tabHsv.style.background = 'transparent'; tabHsv.style.color = '#8888aa';
            rgbPanel.style.display = 'flex'; hsvPanel.style.display = 'none';
        });

        // SBボックス操作
        let sbDrag = false;
        const updateSB = (e) => {
            const rect = sbBox.getBoundingClientRect();
            saturation = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            brightness = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));
            updateUI();
        };
        sbBox.addEventListener('mousedown', e => { sbDrag = true; updateSB(e); });
        sbBox.addEventListener('touchstart', e => { e.preventDefault(); sbDrag = true; updateSB(e.touches[0]); }, { passive: false });
        document.addEventListener('mousemove', e => { if (sbDrag) updateSB(e); });
        document.addEventListener('touchmove', e => { if (sbDrag) { e.preventDefault(); updateSB(e.touches[0]); } }, { passive: false });
        document.addEventListener('mouseup', () => sbDrag = false);
        document.addEventListener('touchend', () => sbDrag = false);

        // Hueスライダー
        let hueDrag = false;
        const updateHue = (e) => {
            const rect = hueSlider.getBoundingClientRect();
            hue = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
            updateUI();
        };
        hueSlider.addEventListener('mousedown', e => { hueDrag = true; updateHue(e); });
        hueSlider.addEventListener('touchstart', e => { e.preventDefault(); hueDrag = true; updateHue(e.touches[0]); }, { passive: false });
        document.addEventListener('mousemove', e => { if (hueDrag) updateHue(e); });
        document.addEventListener('touchmove', e => { if (hueDrag) { e.preventDefault(); updateHue(e.touches[0]); } }, { passive: false });
        document.addEventListener('mouseup', () => hueDrag = false);
        document.addEventListener('touchend', () => hueDrag = false);

        // RGBスライダー
        [sliderR, sliderG, sliderB].forEach(slider => {
            slider.addEventListener('input', () => {
                r = +sliderR.value; g = +sliderG.value; b = +sliderB.value;
                updateFromRGB();
            });
        });

        // HEX入力
        hexInput.addEventListener('input', () => {
            let v = hexInput.value;
            if (!v.startsWith('#')) v = '#' + v;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
                const rgb = hexToRgb(v);
                r = rgb.r; g = rgb.g; b = rgb.b;
                updateFromRGB();
            }
        });

        // よく使う色
        recentColors.forEach(color => {
            const div = document.createElement('div');
            div.style.cssText = `width:28px;height:28px;border-radius:6px;border:2px solid #444466;cursor:pointer;background:${color};`;
            div.addEventListener('click', () => {
                const rgb = hexToRgb(color);
                r = rgb.r; g = rgb.g; b = rgb.b;
                updateFromRGB();
            });
            recentColorsEl.appendChild(div);
        });

        // 初期UI更新
        updateUI();

        // ボタン
        const closeModal = () => {
            document.body.style.overflow = originalOverflow;
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        };

        modal.querySelector('#cp-ok').addEventListener('click', () => {
            App.nesPalette[index] = rgbToHex(r, g, b);
            this.initColorPalette();
            this.editor.render();
            this.editor.initSpriteGallery();
            closeModal();
        });

        modal.querySelector('#cp-cancel').addEventListener('click', closeModal);

        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    },

    selectColor(index) {
        this.editor.selectedColor = index;
        document.querySelectorAll('.palette-color').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
    }
};
