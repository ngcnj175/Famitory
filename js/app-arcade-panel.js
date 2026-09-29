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
            // IME確定前は超過チェックせず、通常入力と確定タイミングでチェック
            commentInput.addEventListener('input', (e) => {
                if (commentInput._composing) return;
                this.enforceCommentLimit();
                this.autoGrowComment();
            });
            commentInput.addEventListener('compositionstart', () => { commentInput._composing = true; });
            commentInput.addEventListener('compositionend', () => {
                commentInput._composing = false;
                this.enforceCommentLimit();
                this.autoGrowComment();
            });
        }
    },

    // 文字数上限を超えたらトリム＋トースト（連打時は間引き）
    enforceCommentLimit() {
        const el = document.getElementById('arcade-comment-input');
        if (!el) return;
        if ([...el.value].length <= COMMENT_MAX_LENGTH) return;
        el.value = [...el.value].slice(0, COMMENT_MAX_LENGTH).join('');
        const now = Date.now();
        if (!this._lastLimitToastAt || now - this._lastLimitToastAt > 1500) {
            this._lastLimitToastAt = now;
            const msg = (typeof AppI18N !== 'undefined')
                ? AppI18N.t('U548').replace('{n}', COMMENT_MAX_LENGTH)
                : `コメントは${COMMENT_MAX_LENGTH}文字までです`;
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(msg);
            }
        }
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
