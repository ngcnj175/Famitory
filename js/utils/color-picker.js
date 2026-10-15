// カラー編集モーダル（PIXEL画面のパレット編集・STAGE画面の背景色編集で共有）
//
// 使い方:
//   ColorPicker.open({
//       initialColor: '#RRGGBB',
//       title: 'カラー編集',          // 省略時は I18N U430 or 'カラー編集'
//       swatchesLabel: 'よく使う色',   // スウォッチ見出し
//       swatches: ['#000000', ...],   // 下部に並べる候補色（省略時は非表示）
//       onApply: (hex) => { ... }     // OK押下時に呼ばれる
//   });
const ColorPicker = {
    hsvToRgb(h, s, v) {
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
    },

    rgbToHsv(r, g, b) {
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
    },

    rgbToHex(r, g, b) {
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    },

    hexToRgb(hex) {
        hex = (hex || '').replace('#', '');
        return { r: parseInt(hex.substr(0, 2), 16), g: parseInt(hex.substr(2, 2), 16), b: parseInt(hex.substr(4, 2), 16) };
    },

    _i18n(id, fallback) {
        const lang = (typeof AppI18N !== 'undefined' && AppI18N.currentLang) || App?.currentLang;
        return App?.I18N?.[id]?.[lang] || fallback;
    },

    open({ initialColor = '#000000', title, swatchesLabel, swatches = [], onApply } = {}) {
        const titleText = title || this._i18n('U430', 'カラー編集');
        const swatchHeading = swatchesLabel || this._i18n('U433', 'よく使う色');
        const cancelLabel = this._i18n('U105', 'キャンセル') || this._i18n('U179', 'キャンセル');
        const okLabel = this._i18n('U120', 'OK');
        const curLabel = this._i18n('U431', '現在');
        const newLabel = this._i18n('U432', '編集中');

        let hue = 0, saturation = 100, brightness = 100;
        let r = 255, g = 0, b = 0;

        const initRgb = this.hexToRgb(initialColor);
        r = initRgb.r; g = initRgb.g; b = initRgb.b;
        const initHsv = this.rgbToHsv(r, g, b);
        hue = initHsv.h; saturation = initHsv.s; brightness = initHsv.v;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;touch-action:none;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#2d2d44;padding:20px;border-radius:16px;width:90%;max-width:320px;box-shadow:0 10px 40px rgba(0,0,0,0.4);';

        const swatchesHtml = swatches.length ? `
            <div style="margin-bottom:16px;">
                <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">${swatchHeading}</div>
                <div id="cp-recent" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
            </div>` : '';

        modal.innerHTML = `
            <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:16px;text-align:center;">${titleText}</div>
            <div style="display:flex;gap:12px;margin-bottom:16px;">
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">${curLabel}</div>
                    <div id="cp-current" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${initialColor};"></div>
                </div>
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">${newLabel}</div>
                    <div id="cp-new" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${initialColor};"></div>
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
                        <input type="number" id="cp-value-r" min="0" max="255" value="${r}" inputmode="numeric" style="width:48px;padding:4px 6px;border:1px solid #444466;border-radius:6px;background:#1a1a2e;color:#fff;font-size:13px;text-align:right;-moz-appearance:textfield;">
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="color:#6bff6b;font-size:14px;font-weight:600;width:24px;">G</span>
                        <input type="range" id="cp-slider-g" min="0" max="255" value="${g}" style="flex:1;height:28px;border-radius:14px;-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:linear-gradient(to right,#000,#00ff00);">
                        <input type="number" id="cp-value-g" min="0" max="255" value="${g}" inputmode="numeric" style="width:48px;padding:4px 6px;border:1px solid #444466;border-radius:6px;background:#1a1a2e;color:#fff;font-size:13px;text-align:right;-moz-appearance:textfield;">
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="color:#6b6bff;font-size:14px;font-weight:600;width:24px;">B</span>
                        <input type="range" id="cp-slider-b" min="0" max="255" value="${b}" style="flex:1;height:28px;border-radius:14px;-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:linear-gradient(to right,#000,#0000ff);">
                        <input type="number" id="cp-value-b" min="0" max="255" value="${b}" inputmode="numeric" style="width:48px;padding:4px 6px;border:1px solid #444466;border-radius:6px;background:#1a1a2e;color:#fff;font-size:13px;text-align:right;-moz-appearance:textfield;">
                    </div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                <label style="color:#8888aa;font-size:12px;">HEX</label>
                <input type="text" id="cp-hex" value="${initialColor}" maxlength="7" style="flex:1;padding:10px 12px;border:2px solid #444466;border-radius:8px;background:#1a1a2e;color:#fff;font-family:monospace;font-size:14px;text-transform:uppercase;">
            </div>
            ${swatchesHtml}
            <div style="display:flex;gap:10px;">
                <button id="cp-cancel" style="flex:1;padding:14px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#444466;color:#fff;">${cancelLabel}</button>
                <button id="cp-ok" style="flex:1;padding:14px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#4a7dff;color:#fff;">${okLabel}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

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
        const swatchesEl = modal.querySelector('#cp-recent');

        const updateUI = () => {
            const rgb = this.hsvToRgb(hue, saturation, brightness);
            r = rgb.r; g = rgb.g; b = rgb.b;
            const hex = this.rgbToHex(r, g, b);
            newColorEl.style.backgroundColor = hex;
            if (document.activeElement !== hexInput) hexInput.value = hex;
            sbBox.style.backgroundColor = this.rgbToHex(...Object.values(this.hsvToRgb(hue, 100, 100)));
            sbCursor.style.left = `${saturation}%`;
            sbCursor.style.top = `${100 - brightness}%`;
            hueCursor.style.left = `${(hue / 360) * 100}%`;
            sliderR.value = r; sliderG.value = g; sliderB.value = b;
            if (document.activeElement !== valueR) valueR.value = r;
            if (document.activeElement !== valueG) valueG.value = g;
            if (document.activeElement !== valueB) valueB.value = b;
        };

        const updateFromRGB = () => {
            const hsv = this.rgbToHsv(r, g, b);
            hue = hsv.h; saturation = hsv.s; brightness = hsv.v;
            updateUI();
        };

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

        // SBボックス
        let sbDrag = false;
        const updateSB = (e) => {
            const rect = sbBox.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            saturation = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
            brightness = Math.max(0, Math.min(100, (1 - (touch.clientY - rect.top) / rect.height) * 100));
            updateUI();
        };
        sbBox.addEventListener('mousedown', e => { sbDrag = true; updateSB(e); });
        sbBox.addEventListener('touchstart', e => { e.preventDefault(); sbDrag = true; updateSB(e); }, { passive: false });
        const onMove = e => { if (sbDrag) updateSB(e); };
        const onTouchMove = e => { if (sbDrag) { e.preventDefault(); updateSB(e); } };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        const stopSb = () => sbDrag = false;
        document.addEventListener('mouseup', stopSb);
        document.addEventListener('touchend', stopSb);

        // Hueスライダー
        let hueDrag = false;
        const updateHue = (e) => {
            const rect = hueSlider.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            hue = Math.max(0, Math.min(360, ((touch.clientX - rect.left) / rect.width) * 360));
            updateUI();
        };
        hueSlider.addEventListener('mousedown', e => { hueDrag = true; updateHue(e); });
        hueSlider.addEventListener('touchstart', e => { e.preventDefault(); hueDrag = true; updateHue(e); }, { passive: false });
        const onHueMove = e => { if (hueDrag) updateHue(e); };
        const onHueTouchMove = e => { if (hueDrag) { e.preventDefault(); updateHue(e); } };
        document.addEventListener('mousemove', onHueMove);
        document.addEventListener('touchmove', onHueTouchMove, { passive: false });
        const stopHue = () => hueDrag = false;
        document.addEventListener('mouseup', stopHue);
        document.addEventListener('touchend', stopHue);

        // RGBスライダー
        [sliderR, sliderG, sliderB].forEach(slider => {
            slider.addEventListener('input', () => {
                r = +sliderR.value; g = +sliderG.value; b = +sliderB.value;
                updateFromRGB();
            });
        });

        // RGB数値入力
        const bindRgbNumberInput = (el, setter) => {
            el.addEventListener('input', () => {
                const n = parseInt(el.value, 10);
                if (Number.isNaN(n)) return;
                setter(Math.max(0, Math.min(255, n)));
                updateFromRGB();
            });
            el.addEventListener('blur', () => {
                const n = parseInt(el.value, 10);
                const clamped = Number.isNaN(n) ? 0 : Math.max(0, Math.min(255, n));
                setter(clamped);
                el.value = clamped;
                updateFromRGB();
            });
            el.addEventListener('focus', () => el.select());
        };
        bindRgbNumberInput(valueR, (v) => { r = v; });
        bindRgbNumberInput(valueG, (v) => { g = v; });
        bindRgbNumberInput(valueB, (v) => { b = v; });

        // HEX入力（#なしでも受付、blur時に#付与）
        const normalizeHex = (raw) => {
            const v = (raw || '').trim().replace(/^#/, '').toUpperCase();
            return /^[0-9A-F]{6}$/.test(v) ? '#' + v : null;
        };
        hexInput.addEventListener('input', () => {
            const hex = normalizeHex(hexInput.value);
            if (hex) {
                const rgb = this.hexToRgb(hex);
                r = rgb.r; g = rgb.g; b = rgb.b;
                updateFromRGB();
            }
        });
        hexInput.addEventListener('blur', () => {
            const hex = normalizeHex(hexInput.value);
            hexInput.value = hex || this.rgbToHex(r, g, b);
        });

        // スウォッチ
        if (swatchesEl && swatches.length) {
            swatches.forEach(c => {
                const div = document.createElement('div');
                div.style.cssText = `width:28px;height:28px;border-radius:6px;border:2px solid #444466;cursor:pointer;background:${c};flex-shrink:0;`;
                div.addEventListener('click', () => {
                    const rgb = this.hexToRgb(c);
                    r = rgb.r; g = rgb.g; b = rgb.b;
                    updateFromRGB();
                });
                swatchesEl.appendChild(div);
            });
        }

        updateUI();

        const close = () => {
            document.body.style.overflow = originalOverflow;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('mouseup', stopSb);
            document.removeEventListener('touchend', stopSb);
            document.removeEventListener('mousemove', onHueMove);
            document.removeEventListener('touchmove', onHueTouchMove);
            document.removeEventListener('mouseup', stopHue);
            document.removeEventListener('touchend', stopHue);
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
        };

        modal.querySelector('#cp-ok').addEventListener('click', () => {
            const hex = this.rgbToHex(r, g, b);
            if (typeof onApply === 'function') onApply(hex);
            close();
        });
        modal.querySelector('#cp-cancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    }
};
