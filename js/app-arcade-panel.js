/**
 * PixelGameKit - ARCADE 登録情報制御
 * 公開モーダル（SHARE）内の「ARCADE情報」セクションの入出力を担当。
 * projectData.meta.arcade = { comment, thumbnail } に保存する。
 */

const COMMENT_MAX_LENGTH = 80;

const AppArcadePanel = {

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const captureBtn = document.getElementById('arcade-thumb-capture-btn');
        const clearBtn = document.getElementById('arcade-thumb-clear-btn');
        const commentInput = document.getElementById('arcade-comment-input');

        if (captureBtn) {
            captureBtn.addEventListener('click', () => this.onCapture());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.setThumbnail(''));
        }
        if (commentInput) {
            // Enter単独入力を禁止（IME確定のEnterは変換確定なので compositionend で除外される）
            commentInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !commentInput._composing) {
                    e.preventDefault();
                    this._showLimitToast('U549');
                }
            });
            commentInput.addEventListener('input', () => {
                if (commentInput._composing) return;
                this.sanitizeComment();
                this.autoGrowComment();
            });
            commentInput.addEventListener('compositionstart', () => { commentInput._composing = true; });
            commentInput.addEventListener('compositionend', () => {
                commentInput._composing = false;
                this.sanitizeComment();
                this.autoGrowComment();
            });
        }
    },

    // 改行除去＋文字数上限適用（貼り付け・IME確定後などをカバー）
    sanitizeComment() {
        const el = document.getElementById('arcade-comment-input');
        if (!el) return;
        let v = el.value;
        const hadNewline = /[\r\n]/.test(v);
        if (hadNewline) v = v.replace(/[\r\n]+/g, ' ');
        const overflow = [...v].length > COMMENT_MAX_LENGTH;
        if (overflow) v = [...v].slice(0, COMMENT_MAX_LENGTH).join('');
        if (v !== el.value) el.value = v;
        if (overflow) this._showLimitToast('U548');
        else if (hadNewline) this._showLimitToast('U549');
    },

    // トースト（連打時は1.5秒に1回に間引き）
    _showLimitToast(i18nId) {
        const now = Date.now();
        if (this._lastLimitToastAt && now - this._lastLimitToastAt < 1500) return;
        this._lastLimitToastAt = now;
        const raw = (typeof AppI18N !== 'undefined')
            ? AppI18N.t(i18nId).replace('{n}', COMMENT_MAX_LENGTH)
            : (i18nId === 'U549' ? '改行は使えません' : `コメントは${COMMENT_MAX_LENGTH}文字までです`);
        if (typeof App !== 'undefined' && App.showToast) App.showToast(raw);
    },

    autoGrowComment() {
        const el = document.getElementById('arcade-comment-input');
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
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
        if (commentInput) {
            commentInput.value = arcade.comment || '';
            // reflow: 表示後に auto-grow を反映
            requestAnimationFrame(() => this.autoGrowComment());
        }
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
            remixOK: !!meta.remixOK,
            originalTitle: meta.originalTitle || '',
            originalAuthor: meta.originalAuthor || '',
            originalShareId: meta.originalShareId || ''
        };
    }
};
