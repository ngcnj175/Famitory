/**
 * PixelGameKit - プロジェクト管理
 */

// デフォルトSEリスト（createDefaultProject と migrateProjectData で共用）
const DEFAULT_SOUNDS = [
    { id: 0,  name: 'ジャンプ_01',        type: 'jump_01'   },
    { id: 1,  name: 'ジャンプ_02',        type: 'jump_02'   },
    { id: 2,  name: 'ジャンプ_03',        type: 'jump_03'   },
    { id: 3,  name: 'ジャンプ_04',        type: 'jump_04'   },
    { id: 4,  name: 'ジャンプ_05',        type: 'jump_05'   },
    { id: 5,  name: '攻撃_01',            type: 'attack_01' },
    { id: 6,  name: '攻撃_02',            type: 'attack_02' },
    { id: 7,  name: '攻撃_03',            type: 'attack_03' },
    { id: 8,  name: '攻撃_04',            type: 'attack_04' },
    { id: 9,  name: '攻撃_05',            type: 'attack_05' },
    { id: 10, name: 'ダメージ_01',        type: 'damage_01' },
    { id: 11, name: 'ダメージ_02',        type: 'damage_02' },
    { id: 12, name: 'ダメージ_03',        type: 'damage_03' },
    { id: 13, name: 'ダメージ_04',        type: 'damage_04' },
    { id: 14, name: 'ダメージ_05',        type: 'damage_05' },
    { id: 15, name: 'ゲット_01',          type: 'itemGet_01'},
    { id: 16, name: 'ゲット_02',          type: 'itemGet_02'},
    { id: 17, name: 'ゲット_03',          type: 'itemGet_03'},
    { id: 18, name: 'ゲット_04',          type: 'itemGet_04'},
    { id: 19, name: 'ゲット_05',          type: 'itemGet_05'},
    { id: 20, name: 'その他_01(決定)',    type: 'other_01'  },
    { id: 21, name: 'その他_02(キャンセル)', type: 'other_02'},
    { id: 22, name: 'その他_03(カーソル)', type: 'other_03' },
    { id: 23, name: 'その他_04(ポーズ)',  type: 'other_04'  },
    { id: 24, name: 'その他_05(爆発)',    type: 'other_05'  }
];

const AppProject = {

    // エディットキー生成（8文字英数字）
    generateEditKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let key = '';
        for (let i = 0; i < 8; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    },

    createEmptySprite(size = 1) {
        const dimension = size === 2 ? 32 : 16;
        return {
            id: 0,
            name: 'sprite_0',
            data: this.create2DArray(dimension, dimension, -1),
            size: size
        };
    },

    create2DArray(width, height, fillValue) {
        return Array(height).fill(null).map(() => Array(width).fill(fillValue));
    },

    createDefaultProject() {
        return {
            version: 1,
            meta: {
                name: 'NEW GAME',
                author: '',
                locked: false,
                createdAt: Date.now(),
                editKey: this.generateEditKey()
            },
            palette: App.nesPalette.slice(0, 16),
            sprites: [this.createEmptySprite()],
            stage: {
                name: '',
                width: 16,
                height: 16,
                bgColor: '#3CBCFC',
                transparentIndex: 0,
                bgm: {
                    stage: '',
                    invincible: '',
                    clear: '',
                    gameover: ''
                },
                clearCondition: 'enemies',
                timeLimit: 0,
                showScore: true,
                layers: {
                    bg: this.create2DArray(16, 16, -1),
                    fg: this.create2DArray(16, 16, -1),
                    collision: this.create2DArray(16, 16, 0)
                }
            },
            objects: [
                { type: 'player', x: 2, y: 14, sprite: 0 }
            ],
            bgm: {
                bpm: 120,
                steps: 16,
                tracks: {
                    pulse1: [],
                    pulse2: [],
                    triangle: [],
                    noise: []
                }
            },
            sounds: DEFAULT_SOUNDS.map(s => ({ ...s }))
        };
    },

    loadOrCreateProject() {
        const saved = Storage.load('currentProject');
        if (saved) {
            App.projectData = saved;
            this.migrateProjectData();
            console.log('Project loaded from storage');
            if (App.projectData.palette) {
                App.nesPalette = App.projectData.palette;
            }
        } else {
            App.projectData = this.createDefaultProject();
            console.log('New project created');
        }
    },

    async checkUrlData() {
        const urlParams = new URLSearchParams(window.location.search);
        const gameId = urlParams.get('g');

        if (gameId) {
            console.log('Loading game from Firebase:', gameId);
            const data = await Share.loadGame(gameId);
            if (data) {
                App.projectData = data;
                this.migrateProjectData();
                App.isPlayOnlyMode = true;
                App._sharedGameId = gameId;
                App._hasLikedThisSession = false;
                console.log('Project loaded from Firebase (play-only mode)');
                if (App.projectData.palette) {
                    App.nesPalette = App.projectData.palette;
                }
                App.applyPlayOnlyMode();
                App.refreshCurrentScreen();
                App.fetchAndShowLikes(gameId);
            } else {
                console.warn('Failed to load game:', gameId);
            }
            return;
        }

        const hash = window.location.hash.slice(1);
        if (hash) {
            try {
                const data = Share.decode(hash);
                if (data) {
                    App.projectData = data;
                    App.isPlayOnlyMode = true;
                    App._hasLikedThisSession = false;
                    console.log('Project loaded from URL hash (play-only mode)');
                    if (App.projectData.palette) {
                        App.nesPalette = App.projectData.palette;
                    }
                    App.applyPlayOnlyMode();
                }
            } catch (e) {
                console.warn('Failed to load from URL hash:', e);
            }
        }
    },

    migrateProjectData() {
        if (App.projectData.meta && !App.projectData.meta.editKey) {
            App.projectData.meta.editKey = this.generateEditKey();
        }

        const stage = App.projectData.stage;
        if (!stage) return;

        if (!stage.entities) {
            stage.entities = [];
        }

        const map = stage.map;
        const width = stage.width;
        const height = stage.height;

        if (!map || !Array.isArray(map)) return;

        for (let y = 0; y < height; y++) {
            if (!map[y]) continue;
            for (let x = 0; x < width; x++) {
                const tileId = map[y][x];
                if (tileId >= 100) {
                    const tmplIdx = tileId - 100;
                    const tmpl = App.projectData.templates[tmplIdx];
                    if (tmpl && (tmpl.type === 'player' || tmpl.type === 'enemy' || tmpl.type === 'item')) {
                        const exists = stage.entities.some(e => e.x === x && e.y === y);
                        if (!exists) {
                            stage.entities.push({ x, y, templateId: tmplIdx });
                        }
                        map[y][x] = 0;
                    }
                }
            }
        }

        if (App.projectData.sounds && App.projectData.sounds.length <= 5) {
            App.projectData.sounds = DEFAULT_SOUNDS.map(s => ({ ...s }));

            if (App.projectData.templates) {
                const seMap = { 0: 0, 1: 5, 2: 10, 3: 15 };
                App.projectData.templates.forEach(tmpl => {
                    if (tmpl.type === 'player' && tmpl.config) {
                        ['seJump', 'seAttack', 'seDamage', 'seItemGet'].forEach(key => {
                            const oldVal = tmpl.config[key];
                            if (oldVal !== undefined && seMap[oldVal] !== undefined) {
                                tmpl.config[key] = seMap[oldVal];
                            }
                        });
                    }
                });
            }
        }
    },

    hasUnsavedChanges() {
        const savedData = Storage.load('currentProject');
        if (!savedData) return true;
        return JSON.stringify(savedData) !== JSON.stringify(App.projectData);
    },

    saveProject() {
        App.projectData.palette = App.nesPalette.slice();

        if (!App.currentProjectName) {
            App.currentProjectName = App.projectData.meta.name || 'MyGame';
        }

        App.projectData.meta.name = App.currentProjectName;
        App.projectData.meta.updatedAt = Date.now();

        Storage.saveProject(App.currentProjectName, App.projectData);
        Storage.save('currentProject', App.projectData);

        App.showToast('セーブしました');
    },

    loadProject(name) {
        const data = Storage.loadProject(name);
        if (data) {
            // ゲームループを確実に停止（isRunning=true でも showPreview が呼ばれるよう）
            if (typeof GameEngine !== 'undefined') {
                GameEngine.stop();
                GameEngine.hasStarted = false;
                GameEngine.isPaused = false;
                GameEngine.titleState = 'title';
            }

            // スプライトエディタの揮発状態をクリア
            if (typeof SpriteEditorPreview !== 'undefined') {
                if (SpriteEditorPreview.previewTimer) {
                    clearTimeout(SpriteEditorPreview.previewTimer);
                    SpriteEditorPreview.previewTimer = null;
                }
                SpriteEditorPreview.previewPlaying = false;
                SpriteEditorPreview.previewFrames = [];
                SpriteEditorPreview.previewCurrentFrame = 0;
            }
            if (typeof SpriteEditor !== 'undefined') {
                SpriteEditor.currentSprite = 0;
                SpriteEditor.history = [];
                SpriteEditor.historyIndex = -1;
                SpriteEditor.selectionMode = false;
                SpriteEditor.selectionStart = null;
                SpriteEditor.selectionEnd = null;
                SpriteEditor.isFloating = false;
                SpriteEditor.floatingData = null;
                SpriteEditor.pasteMode = false;
                SpriteEditor.pasteData = null;
                SpriteEditor.viewportOffsetX = 0;
                SpriteEditor.viewportOffsetY = 0;
            }

            App.projectData = data;
            App.currentProjectName = name;

            App._sharedGameId = null;
            App._likesCount = 0;
            App._hasLikedThisSession = false;
            App.isPlayOnlyMode = false;

            if (App.projectData.palette) {
                App.nesPalette = App.projectData.palette;
            } else {
                App.nesPalette = ['#000000'];
            }

            App.updateGameInfo();
            App.refreshCurrentScreen();
            Storage.save('currentProject', App.projectData);
            const msg = (AppI18N.I18N['U363']?.[AppI18N.currentLang] || '「${name}」を開きました').replace('${name}', name);
            AppDialogs.showAlert(msg);
        } else {
            const failMsg = AppI18N.I18N['U364']?.[AppI18N.currentLang] || 'プロジェクトの読み込みに失敗しました';
            AppDialogs.showAlert(failMsg);
        }
    },

    exportProject(filename) {
        App.projectData.palette = App.nesPalette.slice();

        const data = JSON.stringify(App.projectData, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const a = document.createElement('a');
        a.href = url;
        a.download = `Famitory_${filename}_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importProject(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                let baseName = file.name.replace(/\.(json|pgk)$/i, '');
                let importName = baseName;
                let counter = 1;

                while (Storage.projectExists(importName)) {
                    importName = `${baseName} (${counter})`;
                    counter++;
                }

                if (!data.meta.name) {
                    data.meta.name = importName;
                }
                data.meta.createdAt = Date.now();
                Storage.saveProject(importName, data);

                const msg = (AppI18N.I18N['U365']?.[AppI18N.currentLang] || '「${importName}」としてインポートしました。\n今すぐ開きますか？').replace('${importName}', importName);
                AppDialogs.showConfirm(msg, '', () => {
                    this.loadProject(importName);
                    document.getElementById('share-dialog').classList.add('hidden');
                }, () => {
                    alert(AppI18N.I18N['U366']?.[AppI18N.currentLang] || 'インポートしました。「開く」メニューから選択できます。');
                });

            } catch (err) {
                console.error(err);
                alert('ファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
    },

    showNewGameModal() {
        const modal = document.getElementById('new-game-modal');
        const input = document.getElementById('new-game-name');
        const createBtn = document.getElementById('new-game-create-btn');
        const cancelBtn = document.getElementById('new-game-cancel-btn');

        if (!modal) return;

        input.value = "NEW GAME";
        modal.classList.remove('hidden');
        input.focus();
        input.select();

        const close = () => {
            modal.classList.add('hidden');
            input.onkeydown = null;
            createBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        const create = () => {
            const name = input.value.trim();
            if (!name) return;

            if (Storage.projectExists(name)) {
                alert('そのなまえは すでに つかわれています');
                return;
            }

            App.nesPalette = App.PALETTE_PRESETS.famitory.colors.slice();
            App.projectData = this.createDefaultProject();
            App.projectData.meta.name = name;
            App.projectData.stage.name = name;
            App.currentProjectName = name;

            delete App.projectData.meta.originalAuthor;
            delete App.projectData.meta.originalTitle;
            delete App.projectData.meta.originalShareId;

            App._sharedGameId = null;
            App._likesCount = 0;
            App._hasLikedThisSession = false;
            App.isPlayOnlyMode = false;
            App.updateLikesDisplay(0);

            document.querySelectorAll('.toolbar-icon.locked').forEach(btn => {
                btn.classList.remove('locked');
            });

            Storage.saveProject(name, App.projectData);
            Storage.save('currentProject', App.projectData);

            App.updateGameInfo();
            App.refreshCurrentScreen();

            App.showToast(AppI18N.I18N['U369']?.[AppI18N.currentLang] || 'あたらしいゲームを つくりました');
            close();
        };

        createBtn.onclick = create;
        cancelBtn.onclick = close;

        input.onkeydown = (e) => {
            if (e.key === 'Enter') create();
            if (e.key === 'Escape') close();
        };
    },

    showSimpleProjectList() {
        const modal = document.getElementById('project-list-modal');
        const listContainer = document.getElementById('project-list');
        const scrollContainer = document.getElementById('project-list-scroll');
        const closeBtn = document.getElementById('project-list-close');

        if (scrollContainer) {
            scrollContainer.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: true });
        }

        const openBtn = document.getElementById('project-open-btn');
        const copyBtn = document.getElementById('project-copy-btn');
        const deleteBtn = document.getElementById('project-delete-btn');

        if (!modal || !listContainer) return;

        let selectedName = null;

        const updateButtons = () => {
            const disabled = !selectedName;
            openBtn.disabled = disabled;
            copyBtn.disabled = disabled;
            deleteBtn.disabled = disabled;
        };

        const renderList = () => {
            listContainer.innerHTML = '';
            const list = Storage.getProjectList();

            list.sort((a, b) => b.updatedAt - a.updatedAt);

            if (list.length === 0) {
                const msg = AppI18N.I18N['U370'][AppI18N.currentLang];
                listContainer.innerHTML = `<div style="padding:20px;text-align:center;color:#888;">${msg}</div>`;
                updateButtons();
                return;
            }

            list.forEach(p => {
                const item = document.createElement('div');
                item.className = 'list-item';
                if (p.name === selectedName) {
                    item.classList.add('selected');
                }

                const d = new Date(p.updatedAt);
                const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${('0' + d.getMinutes()).slice(-2)}`;

                item.innerHTML = `
                    <div class="list-item-arrow">${p.name === selectedName ? '▶' : ''}</div>
                    <div class="list-item-content">
                        <div class="list-item-name-wrapper">
                            <span class="list-item-name">${p.name.replace(/\u200B/g, '')}</span>
                        </div>
                        <div class="list-item-date">${dateStr}</div>
                    </div>
                `;

                item.onclick = () => {
                    if (selectedName !== p.name) {
                        selectedName = p.name;
                        renderList();
                        updateButtons();
                    }
                };

                item.ondblclick = () => {
                    selectedName = p.name;
                    openBtn.click();
                };

                listContainer.appendChild(item);
            });
            updateButtons();

            setTimeout(() => {
                const items = listContainer.querySelectorAll('.list-item');
                items.forEach(item => {
                    const nameEl = item.querySelector('.list-item-name');
                    const wrapper = item.querySelector('.list-item-name-wrapper');
                    if (nameEl && wrapper) {
                        if (nameEl.scrollWidth > wrapper.clientWidth) {
                            nameEl.classList.add('long-text');
                        } else {
                            nameEl.classList.remove('long-text');
                        }
                        if (item.classList.contains('selected') && nameEl.classList.contains('long-text')) {
                            nameEl.classList.add('scrolling');
                        } else {
                            nameEl.classList.remove('scrolling');
                        }
                    }
                });
            }, 50);
        };

        selectedName = null;
        modal.classList.remove('hidden');
        renderList();

        const close = () => modal.classList.add('hidden');
        closeBtn.onclick = close;

        openBtn.onclick = () => {
            if (!selectedName) return;
            this.loadProject(selectedName);
            close();
        };

        copyBtn.onclick = () => {
            if (!selectedName) return;
            let newName = selectedName + '\u200B';
            while (Storage.projectExists(newName)) {
                newName += '\u200B';
            }
            if (Storage.duplicateProject(selectedName, newName)) {
                renderList();
            }
        };

        deleteBtn.onclick = () => {
            if (!selectedName) return;
            Storage.deleteProject(selectedName);
            if (App.currentProjectName === selectedName) {
                App.currentProjectName = null;
            }
            selectedName = null;
            renderList();
        };

        modal.onclick = (e) => { if (e.target === modal) close(); };
    },

    initSaveAsModal() {
        const modal = document.getElementById('save-as-modal');
        const okBtn = document.getElementById('save-as-ok-btn');
        const cancelBtn = document.getElementById('save-as-cancel-btn');
        const input = document.getElementById('save-as-name-input');

        if (!modal) return;

        const close = () => modal.classList.add('hidden');

        okBtn.addEventListener('click', () => {
            const newName = input.value.trim();
            if (newName) {
                this.saveProjectAs(newName);
                close();
            } else {
                alert('プロジェクト名を入力してください');
            }
        });

        cancelBtn.addEventListener('click', close);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    },

    showSaveAsModal() {
        const modal = document.getElementById('save-as-modal');
        const input = document.getElementById('save-as-name-input');
        if (modal && input) {
            let initialName = App.currentProjectName || 'MyGame';
            input.value = initialName.replace(/\u200B/g, '');
            modal.classList.remove('hidden');
            input.focus();
        }
    },

    saveProjectAs(newName) {
        const newData = JSON.parse(JSON.stringify(App.projectData));

        newData.meta.updatedAt = Date.now();
        newData.meta.name = newName;
        if (newData.stage) {
            newData.stage.name = newName;
        }

        App.projectData = newData;
        App.currentProjectName = newName;

        App.updateGameInfo();
        if (typeof StageEditor !== 'undefined' && StageEditor.updateStageSettingsUI) {
            StageEditor.updateStageSettingsUI();
        }

        Storage.saveProject(newName, newData);
        Storage.save('currentProject', newData);

        App.showToast(`「${newName}」として保存しました`);
        console.log(`Project saved as: ${newName}`);
    },
};
