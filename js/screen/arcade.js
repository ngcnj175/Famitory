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

        // サムネ
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'arcade-card-thumb';
        if (item.thumbnail) {
            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.alt = item.title || '';
            thumbWrap.appendChild(img);
        } else {
            thumbWrap.classList.add('no-thumb');
            thumbWrap.textContent = 'NO IMAGE';
        }
        thumbWrap.addEventListener('click', () => this.openGame(item));
        card.appendChild(thumbWrap);

        // タイトル
        const title = document.createElement('div');
        title.className = 'arcade-card-title';
        title.textContent = item.title || 'NO TITLE';
        title.addEventListener('click', () => this.openGame(item));
        card.appendChild(title);

        // クリエイター＋いいね
        const meta = document.createElement('div');
        meta.className = 'arcade-card-meta';
        const creator = document.createElement('span');
        creator.className = 'arcade-card-creator';
        creator.textContent = item.creator || '-';
        if (item.creator) {
            creator.classList.add('clickable');
            creator.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setCreatorFilter(item.creator);
            });
        }
        const likes = document.createElement('span');
        likes.className = 'arcade-card-likes';
        likes.textContent = '♥ ' + (item.likes || 0);
        meta.appendChild(creator);
        meta.appendChild(likes);
        card.appendChild(meta);

        // コメント（40文字プレビュー + タップで全文）
        if (item.comment) {
            const comment = document.createElement('div');
            comment.className = 'arcade-card-comment';
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
            card.appendChild(comment);
        }

        return card;
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
