/**
 * SpriteEditorPreview
 * アニメーションプレビュー機能を管理
 */
const SpriteEditorPreview = {
    // 状態
    previewFrames: [],
    previewCurrentFrame: 0,
    previewTileMode: false,
    previewPlaying: false,
    previewSpeed: 3,
    previewTimer: null,

    // 外部参照（親エディタから注入される）
    parentEditor: null,

    /**
     * 初期化。parentEditor は sprite-editor.js のインスタンスを想定
     */
    init(parentEditor) {
        this.parentEditor = parentEditor;
        this.setupEventListeners();
        this.renderPreview();
        this._updatePreviewUI();
    },

    setupEventListeners() {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;

        // D&Dターゲット
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const idx = e.dataTransfer.getData('text/sprite-index');
            if (idx !== '') this.addPreviewFrame(parseInt(idx));
        });

        // スプライトリストdragstart（委譲）
        const spriteList = document.getElementById('sprite-list');
        if (spriteList) {
            spriteList.addEventListener('dragstart', (e) => {
                const item = e.target.closest('.sprite-item');
                if (item) {
                    e.dataTransfer.setData('text/sprite-index', item.dataset.index);
                    e.dataTransfer.effectAllowed = 'copy';
                }
            });

            // ===== iOS/タッチデバイス用タッチドラッグ =====
            let touchDragIdx = -1;
            let touchGhost = null;
            let startX = 0, startY = 0;
            let dragState = 0; // 0: なし, 1: 判定中, 2: ドラッグ中

            spriteList.addEventListener('touchstart', (e) => {
                const item = e.target.closest('.sprite-item');
                if (!item) return;
                touchDragIdx = parseInt(item.dataset.index);
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                dragState = 1;
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (dragState === 0) return;
                const touch = e.touches[0];
                const dx = Math.abs(touch.clientX - startX);
                const dy = Math.abs(touch.clientY - startY);

                if (dragState === 1) {
                    // 縦方向の動きが大きければプレビューへのドラッグと判定
                    if (dy > dx && dy > 5) {
                        dragState = 2;
                    } else if (dx > dy && dx > 5) {
                        dragState = 0; // 横方向はスクロール
                    }
                }

                if (dragState === 2) {
                    e.preventDefault(); // スクロール防止
                    if (!touchGhost) {
                        const item = spriteList.querySelector(`.sprite-item[data-index="${touchDragIdx}"]`);
                        if (item) {
                            touchGhost = item.cloneNode(true);
                            touchGhost.style.position = 'fixed';
                            touchGhost.style.pointerEvents = 'none';
                            touchGhost.style.zIndex = '9999';
                            touchGhost.style.opacity = '0.7';
                            touchGhost.style.margin = '0';
                            document.body.appendChild(touchGhost);
                        }
                    }
                    if (touchGhost) {
                        touchGhost.style.left = (touch.clientX - 16) + 'px';
                        touchGhost.style.top = (touch.clientY - 16) + 'px';
                    }
                }
            }, { passive: false });

            document.addEventListener('touchend', (e) => {
                if (dragState === 2 && touchDragIdx !== -1) {
                    const touch = e.changedTouches[0];
                    const target = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (target && target.closest('#preview-canvas')) {
                        this.addPreviewFrame(touchDragIdx);
                    }
                }
                if (touchGhost) {
                    touchGhost.remove();
                    touchGhost = null;
                }
                dragState = 0;
                touchDragIdx = -1;
            });
        }

        // Tile Modeトグル
        document.getElementById('preview-tile-toggle')?.addEventListener('change', (e) => {
            this.previewTileMode = e.target.checked;
            this.renderPreview();
        });

        // トランスポート
        document.getElementById('preview-prev-btn')?.addEventListener('click', () => this.previewPrev());
        document.getElementById('preview-next-btn')?.addEventListener('click', () => this.previewNext());
        document.getElementById('preview-play-btn')?.addEventListener('click', () => {
            if (this.previewPlaying) this.previewStop(); else this.previewPlay();
        });

        // コピー（フレーム複製）
        document.getElementById('preview-copy-btn')?.addEventListener('click', () => this.copyPreviewFrame());

        // 削除（タップ=現フレーム、長押し=全クリア）
        const delBtn = document.getElementById('preview-delete-btn');
        if (delBtn) {
            let dt = null, dl = false;
            const ds = () => { dl = false; dt = setTimeout(() => { dt = null; dl = true; this.clearAllPreviewFrames(); }, 800); };
            const de = () => { if (dt) { clearTimeout(dt); dt = null; } if (!dl) this.clearPreviewFrame(); };
            const dc = () => { if (dt) { clearTimeout(dt); dt = null; } };
            delBtn.addEventListener('mousedown', ds);
            delBtn.addEventListener('mouseup', de);
            delBtn.addEventListener('mouseleave', dc);
            delBtn.addEventListener('touchstart', (e) => { e.preventDefault(); ds(); }, { passive: false });
            delBtn.addEventListener('touchend', (e) => { e.preventDefault(); de(); });
            delBtn.addEventListener('touchcancel', dc);
        }

        // スピードゲージ
        document.querySelectorAll('#preview-speed-gauge .block-gauge-item').forEach(dot => {
            dot.addEventListener('click', () => {
                this.setPreviewSpeed(parseInt(dot.dataset.level));
            });
        });
    },

    addPreviewFrame(spriteIdx) {
        if (spriteIdx < 0 || spriteIdx >= App.projectData.sprites.length) return;
        this.previewFrames.push(spriteIdx);
        this.previewCurrentFrame = this.previewFrames.length - 1;
        this._updatePreviewUI();
        this.renderPreview();
    },

    copyPreviewFrame() {
        if (this.previewFrames.length === 0) return;
        const idx = this.previewFrames[this.previewCurrentFrame];
        this.previewFrames.splice(this.previewCurrentFrame + 1, 0, idx);
        this.previewCurrentFrame++;
        this._updatePreviewUI();
        this.renderPreview();
    },

    clearPreviewFrame() {
        if (this.previewFrames.length === 0) return;
        this.previewFrames.splice(this.previewCurrentFrame, 1);
        if (this.previewCurrentFrame >= this.previewFrames.length) {
            this.previewCurrentFrame = Math.max(0, this.previewFrames.length - 1);
        }
        if (this.previewFrames.length === 0) this.previewStop();
        this._updatePreviewUI();
        this.renderPreview();
    },

    clearAllPreviewFrames() {
        this.previewStop();
        this.previewFrames = [];
        this.previewCurrentFrame = 0;
        this._updatePreviewUI();
        this.renderPreview();
    },

    previewPrev() {
        if (this.previewFrames.length === 0) return;
        this.previewCurrentFrame = (this.previewCurrentFrame - 1 + this.previewFrames.length) % this.previewFrames.length;
        this._updatePreviewUI();
        this.renderPreview();
    },

    previewNext() {
        if (this.previewFrames.length === 0) return;
        this.previewCurrentFrame = (this.previewCurrentFrame + 1) % this.previewFrames.length;
        this._updatePreviewUI();
        this.renderPreview();
    },

    previewPlay() {
        if (this.previewFrames.length < 2) return;
        this.previewPlaying = true;
        const playBtn = document.getElementById('preview-play-btn');
        if (playBtn) {
            playBtn.classList.add('playing');
            const icon = document.getElementById('preview-play-icon');
            if (icon) icon.innerHTML = '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>';
        }

        const speedMs = [500, 350, 200, 120, 60];
        const ms = speedMs[this.previewSpeed - 1] || 200;
        this.previewTimer = setInterval(() => {
            this.previewCurrentFrame = (this.previewCurrentFrame + 1) % this.previewFrames.length;
            this._updatePreviewUI();
            this.renderPreview();
        }, ms);
    },

    previewStop() {
        this.previewPlaying = false;
        if (this.previewTimer) { clearInterval(this.previewTimer); this.previewTimer = null; }
        const playBtn = document.getElementById('preview-play-btn');
        if (playBtn) {
            playBtn.classList.remove('playing');
            const icon = document.getElementById('preview-play-icon');
            if (icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
    },

    setPreviewSpeed(level) {
        this.previewSpeed = Math.max(1, Math.min(5, level));
        document.querySelectorAll('#preview-speed-gauge .block-gauge-item').forEach(dot => {
            dot.classList.toggle('active', parseInt(dot.dataset.level) <= this.previewSpeed);
        });
        if (this.previewPlaying) { this.previewStop(); this.previewPlay(); }
    },

    _updatePreviewUI() {
        const el = document.getElementById('preview-frame-info');
        const controls = document.getElementById('preview-controls');
        if (!el) return;

        if (this.previewFrames.length === 0) {
            el.textContent = 'Frame: — / —';
            if (controls) controls.classList.add('disabled-preview');
        } else {
            el.textContent = `Frame: ${this.previewCurrentFrame + 1} / ${this.previewFrames.length}`;
            if (controls) controls.classList.remove('disabled-preview');
        }
    },

    renderPreview() {
        const canvas = document.getElementById('preview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const bgColor = App.projectData?.stage?.bgColor || App.projectData?.stage?.backgroundColor || '#3CBCFC';
        canvas.style.backgroundColor = bgColor;

        const cw = 128;
        canvas.width = cw;
        canvas.height = cw;
        ctx.clearRect(0, 0, cw, cw);

        if (this.previewFrames.length === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            // Tile Modeと同じフォント指定（12px, 600）
            ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 滲みを防ぐため整数座標で描画
            const centerX = Math.floor(cw / 2);
            const centerY = Math.floor(cw / 2);

            ctx.fillText('Drop here', centerX, centerY - 6);

            // 縦長でスタイリッシュな矢印（線で描画）
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const arrowY = centerY + 10;
            const arrowH = 16;

            ctx.beginPath();
            ctx.moveTo(centerX, arrowY + arrowH);
            ctx.lineTo(centerX, arrowY); // 縦線
            ctx.lineTo(centerX - 3, arrowY + 4); // 左ハネ
            ctx.moveTo(centerX, arrowY);
            ctx.lineTo(centerX + 3, arrowY + 4); // 右ハネ
            ctx.stroke();

            return;
        }

        const spriteIdx = this.previewFrames[this.previewCurrentFrame];
        const sprite = App.projectData?.sprites?.[spriteIdx];
        if (!sprite) return;

        const palette = App.nesPalette;
        const dim = (sprite.size || 1) === 2 ? 32 : 16;

        // タイルモード等での無駄な隙間を防ぐため、1枚のキャンバスにピクセル描画してからdrawImageする
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = dim;
        tmpCanvas.height = dim;
        const tctx = tmpCanvas.getContext('2d');

        for (let y = 0; y < dim; y++) {
            for (let x = 0; x < dim; x++) {
                if (sprite.data[y]?.[x] >= 0) {
                    tctx.fillStyle = palette[sprite.data[y][x]];
                    tctx.fillRect(x, y, 1, 1);
                }
            }
        }

        ctx.imageSmoothingEnabled = false;

        if (!this.previewTileMode) {
            // 単体モード
            ctx.drawImage(tmpCanvas, 0, 0, cw, cw);
        } else {
            // 9分割モード (Tile Mode)
            // キャンバスサイズ(128px)を3等分すると端数が生じ、端に背景色の隙間ができるのを防ぐため、
            // 各タイルを切り上げ(Math.ceil)たサイズで描画し1px分だけ重ね合わせる
            const tileW = Math.ceil(cw / 3); // 43px
            const tileStep = cw / 3;
            for (let ty = 0; ty < 3; ty++) {
                for (let tx = 0; tx < 3; tx++) {
                    ctx.drawImage(tmpCanvas, Math.floor(tx * tileStep), Math.floor(ty * tileStep), tileW, tileW);
                }
            }
        }
    }
};
