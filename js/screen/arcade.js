/**
 * PixelGameKit - ARCADE 画面
 * ShareArcade から一覧を取得し、フィルタ / 検索 / ソート / クリエイタ絞り込みを提供する。
 * カードクリックでゲームURLを新しいタブで開く。
 */

const AppArcade = {

    _list: [],
    _bound: false,

    // ARCADE画面を開いた時に呼ばれる（App.refreshCurrentScreen経由）
    async show() {
        this.bindOnce();
        await this.load(false);
    },

    bindOnce() {
        if (this._bound) return;
        this._bound = true;

        const searchInput = document.getElementById('arcade-search-input');
        const sortSelect = document.getElementById('arcade-sort-select');
        const refreshBtn = document.getElementById('arcade-refresh-btn');
        const chipClear = document.getElementById('arcade-creator-chip-clear');
        const commentClose = document.getElementById('arcade-comment-modal-close');
        const commentModal = document.getElementById('arcade-comment-modal');
        const thumbClose = document.getElementById('arcade-thumb-modal-close');
        const thumbModal = document.getElementById('arcade-thumb-modal');

        if (searchInput) searchInput.addEventListener('input', () => this.render());
        if (sortSelect) sortSelect.addEventListener('change', () => this.render());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.load(true));
        if (chipClear) chipClear.addEventListener('click', () => this.setCreatorFilter(null));
        if (commentClose) commentClose.addEventListener('click', () => this.closeCommentModal());
        if (commentModal) {
            commentModal.addEventListener('click', (e) => {
                if (e.target === commentModal) this.closeCommentModal();
            });
        }
        if (thumbClose) thumbClose.addEventListener('click', () => this.closeThumbnailModal());
        if (thumbModal) {
            thumbModal.addEventListener('click', (e) => {
                if (e.target === thumbModal) this.closeThumbnailModal();
            });
        }
    },

    async load(force) {
        const loading = document.getElementById('arcade-loading');
        const empty = document.getElementById('arcade-empty');
        const grid = document.getElementById('arcade-grid');
        if (loading) loading.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');
        if (grid) grid.innerHTML = '';

        try {
            this._list = await ShareArcade.fetchListCached(force);
        } catch (e) {
            console.error('[AppArcade] load failed:', e);
            this._list = [];
        }
        if (loading) loading.classList.add('hidden');
        this.render();
    },

    setCreatorFilter(creator) {
        this._creatorFilter = creator || null;
        const chip = document.getElementById('arcade-creator-chip');
        const label = document.getElementById('arcade-creator-chip-label');
        if (chip && label) {
            if (this._creatorFilter) {
                label.textContent = this._creatorFilter;
                chip.classList.remove('hidden');
            } else {
                chip.classList.add('hidden');
            }
        }
        this.render();
    },

    render() {
        const grid = document.getElementById('arcade-grid');
        const empty = document.getElementById('arcade-empty');
        if (!grid) return;

        const searchInput = document.getElementById('arcade-search-input');
        const sortSelect = document.getElementById('arcade-sort-select');
        const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
        const sortKey = sortSelect ? sortSelect.value : 'likes';

        let items = this._list.slice();
        if (this._creatorFilter) {
            items = items.filter(it => (it.creator || '') === this._creatorFilter);
        }
        if (q) {
            items = items.filter(it =>
                (it.title || '').toLowerCase().includes(q) ||
                (it.creator || '').toLowerCase().includes(q) ||
                (it.comment || '').toLowerCase().includes(q)
            );
        }
        items.sort((a, b) => {
            switch (sortKey) {
                case 'new': return (b.createdAt || 0) - (a.createdAt || 0);
                case 'updated': return (b.updatedAt || 0) - (a.updatedAt || 0);
                case 'likes':
                default: return (b.likes || 0) - (a.likes || 0);
            }
        });

        grid.innerHTML = '';
        if (items.length === 0) {
            if (empty) empty.classList.remove('hidden');
            return;
        }
        if (empty) empty.classList.add('hidden');

        for (const it of items) {
            grid.appendChild(this.createCard(it));
        }
    },

    createCard(item) {
        const card = document.createElement('div');
        card.className = 'arcade-card';

        // 左: サムネ（タップで拡大モーダル）
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'arcade-card-thumb';
        if (item.thumbnail) {
            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.alt = item.title || '';
            thumbWrap.appendChild(img);
        } else {
            thumbWrap.classList.add('no-thumb');
            thumbWrap.textContent = 'NO IMG';
        }
        thumbWrap.addEventListener('click', () => this.openThumbnailModal(item));
        card.appendChild(thumbWrap);

        // 中央: 4行固定（RemixOK / タイトル / クリエイタ / コメント）
        const body = document.createElement('div');
        body.className = 'arcade-card-body';

        // 1行目: RemixOK タグ（無い場合も高さ確保）
        const tagRow = document.createElement('div');
        tagRow.className = 'arcade-card-tagrow';
        if (item.remixOK) {
            const tag = document.createElement('span');
            tag.className = 'arcade-card-remixtag';
            tag.textContent = 'RemixOK';
            tagRow.appendChild(tag);
        } else {
            tagRow.innerHTML = '&nbsp;';
        }
        body.appendChild(tagRow);

        // 2行目: タイトル
        const title = document.createElement('div');
        title.className = 'arcade-card-title';
        title.textContent = item.title || 'NO TITLE';
        body.appendChild(title);

        // 3行目: クリエイタ
        const creator = document.createElement('div');
        creator.className = 'arcade-card-creator';
        creator.textContent = item.creator || '-';
        if (item.creator) {
            creator.classList.add('clickable');
            creator.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setCreatorFilter(item.creator);
            });
        }
        body.appendChild(creator);

        // 4行目: コメント（無い場合も高さ確保）
        const comment = document.createElement('div');
        comment.className = 'arcade-card-comment';
        if (item.comment) {
            const truncated = item.comment.length > 40
                ? item.comment.slice(0, 40) + '…'
                : item.comment;
            comment.textContent = truncated;
            if (item.comment.length > 40) {
                comment.classList.add('clickable');
                comment.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openCommentModal(item);
                });
            }
        } else {
            comment.innerHTML = '&nbsp;';
        }
        body.appendChild(comment);

        card.appendChild(body);

        // 右上: いいね数
        const likes = document.createElement('div');
        likes.className = 'arcade-card-likes';
        likes.innerHTML = '<img src="images/like_icon.svg" alt="like"><span>' + (item.likes || 0) + '</span>';
        card.appendChild(likes);

        // 右下: PLAYボタン
        const playBtn = document.createElement('button');
        playBtn.className = 'arcade-card-play';
        playBtn.type = 'button';
        playBtn.textContent = (typeof AppI18N !== 'undefined')
            ? (AppI18N.I18N['U010']?.[AppI18N.currentLang] || 'PLAY')
            : 'PLAY';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openGame(item);
        });
        card.appendChild(playBtn);

        return card;
    },

    openThumbnailModal(item) {
        const modal = document.getElementById('arcade-thumb-modal');
        const img = document.getElementById('arcade-thumb-modal-img');
        const title = document.getElementById('arcade-thumb-modal-title');
        if (!modal) return;
        if (img) {
            if (item.thumbnail) {
                img.src = item.thumbnail;
                img.style.display = 'inline-block';
            } else {
                img.removeAttribute('src');
                img.style.display = 'none';
            }
        }
        if (title) title.textContent = item.title || '';
        modal.classList.remove('hidden');
    },

    closeThumbnailModal() {
        const modal = document.getElementById('arcade-thumb-modal');
        if (modal) modal.classList.add('hidden');
    },

    openGame(item) {
        if (!item || !item.id) return;
        const url = Share.createShortUrl(item.id);
        window.open(url, '_blank');
    },

    openCommentModal(item) {
        const modal = document.getElementById('arcade-comment-modal');
        const title = document.getElementById('arcade-comment-modal-title');
        const body = document.getElementById('arcade-comment-modal-body');
        if (!modal) return;
        if (title) title.textContent = item.title || '';
        if (body) body.textContent = item.comment || '';
        modal.classList.remove('hidden');
    },

    closeCommentModal() {
        const modal = document.getElementById('arcade-comment-modal');
        if (modal) modal.classList.add('hidden');
    }
};
