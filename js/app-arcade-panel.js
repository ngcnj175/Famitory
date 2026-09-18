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
            const dataUrl = AppThumbnail.cropCenterSquare(img);
            if (dataUrl) this.setThumbnail(dataUrl);
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
