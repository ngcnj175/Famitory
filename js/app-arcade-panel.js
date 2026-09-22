/**
 * PixelGameKit - ARCADE 登録情報パネル制御
 * ゲーム設定パネル内の「ARCADE情報」セクションの入出力を担当。
 * projectData.meta.arcade = { comment, thumbnail } に保存する。
 */

const AppArcadePanel = {

    init() {
        this.bindEvents();
        // ゲーム設定パネル開閉時に値を読み込ませるため MutationObserver 的な代替として
        // 「設定を保存」ボタンで書き戻し、パネルを開いた時に読み込むフックを設ける
        this.installPanelHooks();
    },

    bindEvents() {
        const captureBtn = document.getElementById('arcade-thumb-capture-btn');
        const uploadBtn = document.getElementById('arcade-thumb-upload-btn');
        const clearBtn = document.getElementById('arcade-thumb-clear-btn');
        const fileInput = document.getElementById('arcade-thumb-file-input');
        const saveBtn = document.getElementById('stage-settings-save');
        const groupHeader = document.querySelector('#arcade-settings-group .setting-group-header');

        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.onCapture());
        }
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => fileInput && fileInput.click());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.setThumbnail(''));
        }
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.onFileSelected(e));
        }
        if (saveBtn) {
            // stage-settings.js の既存保存処理と並列に走らせる（別リスナー）
            saveBtn.addEventListener('click', () => this.saveToProject());
        }
        if (groupHeader) {
            // 折りたたみ開閉と読み込み（既存の setting-group-header の共通ハンドラを利用しつつ値を反映）
            groupHeader.addEventListener('click', () => {
                // クリック直後は collapsed の切り替わりが完了しているとは限らないので少し遅延
                setTimeout(() => this.loadFromProject(), 0);
            });
        }

        this.bindCropEvents();
    },

    // ========== 画像トリミング（アップロード後の移動/拡大縮小） ==========
    _crop: {
        img: null,        // 元画像 Image
        stageSize: 260,   // 表示ステージのサイズ（px、正方形）
        outSize: 128,     // 出力サイズ
        minScale: 1,      // 最小スケール（cover fit）
        userScale: 1,     // ユーザーによる追加倍率 1〜4
        tx: 0,            // 画像左上の x オフセット (px)
        ty: 0,            // 画像左上の y オフセット (px)
        drag: null,       // { startX, startY, tx0, ty0 }
        pinch: null,      // { d0, s0 }
    },

    bindCropEvents() {
        const cancel = document.getElementById('arcade-crop-cancel');
        const confirm = document.getElementById('arcade-crop-confirm');
        const zoom = document.getElementById('arcade-crop-zoom');
        const stage = document.getElementById('arcade-crop-stage');
        if (cancel) cancel.addEventListener('click', () => this.closeCrop());
        if (confirm) confirm.addEventListener('click', () => this.applyCrop());
        if (zoom) zoom.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10);
            this.setUserScale(v / 100);
        });
        if (stage) {
            stage.addEventListener('mousedown', (e) => this.onDragStart(e.clientX, e.clientY));
            window.addEventListener('mousemove', (e) => this.onDragMove(e.clientX, e.clientY));
            window.addEventListener('mouseup', () => this.onDragEnd());

            stage.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    this.onDragStart(e.touches[0].clientX, e.touches[0].clientY);
                } else if (e.touches.length === 2) {
                    this._crop.pinch = { d0: this._touchDist(e), s0: this._crop.userScale };
                    this._crop.drag = null;
                }
                if (e.cancelable) e.preventDefault();
            }, { passive: false });
            stage.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1 && this._crop.drag) {
                    this.onDragMove(e.touches[0].clientX, e.touches[0].clientY);
                } else if (e.touches.length === 2 && this._crop.pinch) {
                    const d = this._touchDist(e);
                    const ratio = d / this._crop.pinch.d0;
                    this.setUserScale(this._crop.pinch.s0 * ratio);
                }
                if (e.cancelable) e.preventDefault();
            }, { passive: false });
            stage.addEventListener('touchend', () => {
                this._crop.drag = null;
                this._crop.pinch = null;
            });

            stage.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = -e.deltaY * 0.002;
                this.setUserScale(this._crop.userScale * (1 + delta));
            }, { passive: false });
        }
    },

    _touchDist(e) {
        const [a, b] = e.touches;
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    },

    openCrop(img) {
        const popup = document.getElementById('arcade-crop-popup');
        const imgEl = document.getElementById('arcade-crop-image');
        const zoom = document.getElementById('arcade-crop-zoom');
        if (!popup || !imgEl) return;
        const c = this._crop;
        c.img = img;
        // cover fit: 画像がステージを覆う最小スケール
        c.minScale = Math.max(c.stageSize / img.width, c.stageSize / img.height);
        c.userScale = 1;
        imgEl.src = img.src;
        imgEl.style.width = img.width + 'px';
        imgEl.style.height = img.height + 'px';
        // 中央配置
        this._centerImage();
        if (zoom) zoom.value = '100';
        popup.classList.remove('hidden');
        this._render();
    },

    closeCrop() {
        const popup = document.getElementById('arcade-crop-popup');
        if (popup) popup.classList.add('hidden');
        this._crop.img = null;
        this._crop.drag = null;
        this._crop.pinch = null;
    },

    setUserScale(v) {
        const c = this._crop;
        v = Math.max(1, Math.min(4, v));
        // 拡大の中心はステージ中央: 現在の中心画像座標を保ち、スケール変更後も中央にくるよう tx,ty 補正
        const s0 = c.minScale * c.userScale;
        const s1 = c.minScale * v;
        const cx = (c.stageSize / 2 - c.tx) / s0;
        const cy = (c.stageSize / 2 - c.ty) / s0;
        c.userScale = v;
        c.tx = c.stageSize / 2 - cx * s1;
        c.ty = c.stageSize / 2 - cy * s1;
        this._clampOffsets();
        const zoom = document.getElementById('arcade-crop-zoom');
        if (zoom) zoom.value = Math.round(v * 100);
        this._render();
    },

    onDragStart(x, y) {
        const popup = document.getElementById('arcade-crop-popup');
        if (!popup || popup.classList.contains('hidden')) return;
        this._crop.drag = { startX: x, startY: y, tx0: this._crop.tx, ty0: this._crop.ty };
    },

    onDragMove(x, y) {
        const d = this._crop.drag;
        if (!d) return;
        this._crop.tx = d.tx0 + (x - d.startX);
        this._crop.ty = d.ty0 + (y - d.startY);
        this._clampOffsets();
        this._render();
    },

    onDragEnd() {
        this._crop.drag = null;
    },

    _centerImage() {
        const c = this._crop;
        const s = c.minScale * c.userScale;
        c.tx = (c.stageSize - c.img.width * s) / 2;
        c.ty = (c.stageSize - c.img.height * s) / 2;
    },

    _clampOffsets() {
        const c = this._crop;
        const s = c.minScale * c.userScale;
        const w = c.img.width * s;
        const h = c.img.height * s;
        c.tx = Math.min(0, Math.max(c.stageSize - w, c.tx));
        c.ty = Math.min(0, Math.max(c.stageSize - h, c.ty));
    },

    _render() {
        const imgEl = document.getElementById('arcade-crop-image');
        const c = this._crop;
        if (!imgEl || !c.img) return;
        const s = c.minScale * c.userScale;
        imgEl.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${s})`;
    },

    applyCrop() {
        const c = this._crop;
        if (!c.img) return;
        const s = c.minScale * c.userScale;
        // ステージに表示中の領域を元画像座標に変換
        const sx = -c.tx / s;
        const sy = -c.ty / s;
        const sw = c.stageSize / s;
        const sh = c.stageSize / s;
        const off = document.createElement('canvas');
        off.width = c.outSize;
        off.height = c.outSize;
        const ctx = off.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(c.img, sx, sy, sw, sh, 0, 0, c.outSize, c.outSize);
        this.setThumbnail(off.toDataURL('image/png'));
        this.closeCrop();
    },

    installPanelHooks() {
        // ゲーム設定パネル自体を開いた時にも読み込み
        const panelHeader = document.getElementById('stage-settings-header');
        if (panelHeader) {
            panelHeader.addEventListener('click', () => {
                setTimeout(() => this.loadFromProject(), 0);
            });
        }
    },

    onCapture() {
        if (typeof AppThumbnail === 'undefined') return;
        if (!AppThumbnail.hasLastFrame()) {
            const msg = (typeof AppI18N !== 'undefined')
                ? (AppI18N.I18N['U507']?.[AppI18N.currentLang] || 'まずゲームを一度プレイしてください')
                : 'Please play the game once first';
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(msg);
            } else {
                alert(msg);
            }
            return;
        }
        this.setThumbnail(AppThumbnail.getLastFrame());
    },

    async onFileSelected(e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file || typeof AppThumbnail === 'undefined') return;
        try {
            const img = await AppThumbnail.loadImageFromFile(file);
            this.openCrop(img);
        } catch (err) {
            console.warn('[AppArcadePanel] image load failed:', err);
        }
    },

    setThumbnail(dataUrl) {
        const img = document.getElementById('arcade-thumb-preview');
        const placeholder = document.getElementById('arcade-thumb-placeholder');
        if (!img || !placeholder) return;
        if (dataUrl) {
            img.src = dataUrl;
            img.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            img.removeAttribute('src');
            img.style.display = 'none';
            placeholder.style.display = 'block';
        }
        img.dataset.thumb = dataUrl || '';
    },

    loadFromProject() {
        if (typeof App === 'undefined' || !App.projectData) return;
        const arcade = (App.projectData.meta && App.projectData.meta.arcade) || {};
        const commentInput = document.getElementById('arcade-comment-input');
        if (commentInput) commentInput.value = arcade.comment || '';
        this.setThumbnail(arcade.thumbnail || '');
    },

    saveToProject() {
        if (typeof App === 'undefined' || !App.projectData) return;
        if (!App.projectData.meta) App.projectData.meta = {};
        const commentInput = document.getElementById('arcade-comment-input');
        const img = document.getElementById('arcade-thumb-preview');
        App.projectData.meta.arcade = {
            comment: commentInput ? commentInput.value : '',
            thumbnail: (img && img.dataset.thumb) || ''
        };
    },

    // 共有時に登録用メタを組み立てる
    buildMetaForPublish() {
        const meta = App.projectData.meta || {};
        const arcade = meta.arcade || {};
        return {
            title: meta.name || 'NEW GAME',
            creator: meta.author || '',
            comment: arcade.comment || '',
            thumbnail: arcade.thumbnail || '',
            remixOK: !!meta.remixOK
        };
    }
};
