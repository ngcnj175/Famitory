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
        const detailClose = document.getElementById('arcade-detail-close');
        const detailModal = document.getElementById('arcade-detail-modal');
        const detailPlay = document.getElementById('arcade-detail-play');

        if (searchInput) searchInput.addEventListener('input', () => this.render());
        if (sortSelect) sortSelect.addEventListener('change', () => this.render());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.load(true));
        if (chipClear) chipClear.addEventListener('click', () => this.setCreatorFilter(null));
        if (detailClose) detailClose.addEventListener('click', () => this.closeDetailModal());
        if (detailModal) {
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) this.closeDetailModal();
            });
        }
        if (detailPlay) {
            detailPlay.addEventListener('click', () => {
                if (this._detailItem) this.openGame(this._detailItem);
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
        card.addEventListener('click', () => this.openDetailModal(item));

        // 左: サムネ
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
        card.appendChild(thumbWrap);

        // 中央: タイトル / クリエイタ+RemixOK / コメント / いいね
        const body = document.createElement('div');
        body.className = 'arcade-card-body';

        const title = document.createElement('div');
        title.className = 'arcade-card-title';
        title.textContent = item.title || 'NO TITLE';
        body.appendChild(title);

        const metaRow = document.createElement('div');
        metaRow.className = 'arcade-card-metarow';
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
        metaRow.appendChild(creator);
        body.appendChild(metaRow);

        const comment = document.createElement('div');
        comment.className = 'arcade-card-comment';
        comment.textContent = item.comment || ' ';
        body.appendChild(comment);

        const likes = document.createElement('div');
        likes.className = 'arcade-card-likes';
        likes.innerHTML = '<img src="images/like_icon.svg" alt="like"><span>' + (item.likes || 0) + '</span>';
        if (item.remixOK) {
            const tag = document.createElement('span');
            tag.className = 'arcade-remixtag';
            tag.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg><span>Remix OK</span>';
            likes.appendChild(tag);
        }
        body.appendChild(likes);

        card.appendChild(body);

        // 右: PLAYボタン（丸ピル）
        const playBtn = document.createElement('button');
        playBtn.className = 'arcade-card-play arcade-play-btn';
        playBtn.type = 'button';
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Play</span>';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openGame(item);
        });
        card.appendChild(playBtn);

        return card;
    },

    openDetailModal(item) {
        this._detailItem = item;
        const modal = document.getElementById('arcade-detail-modal');
        if (!modal) return;
        const thumb = document.getElementById('arcade-detail-thumb');
        const title = document.getElementById('arcade-detail-title');
        const creator = document.getElementById('arcade-detail-creator');
        const tag = document.getElementById('arcade-detail-remixtag');
        const comment = document.getElementById('arcade-detail-comment');
        const likesCount = document.getElementById('arcade-detail-likes-count');
        if (thumb) {
            if (item.thumbnail) {
                thumb.src = item.thumbnail;
                thumb.style.display = 'block';
            } else {
                thumb.removeAttribute('src');
                thumb.style.display = 'none';
            }
        }
        if (title) title.textContent = item.title || '';
        if (creator) creator.textContent = item.creator || '';
        if (tag) tag.classList.toggle('hidden', !item.remixOK);
        if (comment) comment.textContent = item.comment || '';
        if (likesCount) likesCount.textContent = item.likes || 0;
        modal.classList.remove('hidden');
    },

    closeDetailModal() {
        const modal = document.getElementById('arcade-detail-modal');
        if (modal) modal.classList.add('hidden');
        this._detailItem = null;
    },

    openGame(item) {
        this.closeDetailModal();
        if (!item || !item.id) return;
        const url = Share.createShortUrl(item.id);
        window.open(url, '_blank');
    }
};
