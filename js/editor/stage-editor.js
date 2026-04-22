/**
 * PixelGameKit - 繧ｹ繝・・繧ｸ繧ｨ繝・ぅ繧ｿ v4・郁ｩｳ邏ｰ險ｭ螳壹ヱ繝阪Ν蟇ｾ蠢懶ｼ・
 */

const StageEditor = {
    canvas: null,
    ctx: null,
    tileSize: 20,
    
    // 翻訳ヘルパー
    t(id) {
        if (typeof App === 'undefined' || !App.I18N) return id;
        const entry = App.I18N[id];
        if (!entry) return id;
        return entry[App.currentLang] || entry['JPN'] || id;
    },

    // SE名の翻訳取得
    getSeName(se) {
        if (!se) return this.t('U220'); // なし
        // デフォルトのSEリスト（U256〜U280）に一致するか確認
        const nameIdMap = {
            'jump_01': 'U256', 'jump_02': 'U257', 'jump_03': 'U258', 'jump_04': 'U259', 'jump_05': 'U260',
            'attack_01': 'U261', 'attack_02': 'U262', 'attack_03': 'U263', 'attack_04': 'U264', 'attack_05': 'U265',
            'damage_01': 'U266', 'damage_02': 'U267', 'damage_03': 'U268', 'damage_04': 'U269', 'damage_05': 'U270',
            'itemGet_01': 'U271', 'itemGet_02': 'U272', 'itemGet_03': 'U273', 'itemGet_04': 'U274', 'itemGet_05': 'U275',
            'other_01': 'U276', 'other_02': 'U277', 'other_03': 'U278', 'other_04': 'U279', 'other_05': 'U280',
            // 基本タイプ
            'jump': 'U201', 'attack': 'U202', 'damage': 'U281', 'itemGet': 'U282'
        };
        const id = nameIdMap[se.type];
        if (id) {
            return this.t(id);
        }
        return se.name;
    },

    // 迥ｶ諷・
    currentTool: 'pen',
    currentLayer: 'fg', // FG縺ｮ縺ｿ菴ｿ逕ｨ・・G縺ｯ蜊倩牡閭梧勹・・
    selectedTemplate: null,
    templates: [],

    // 險ｭ螳壹ヱ繝阪Ν
    isConfigOpen: false,
    editingTemplate: null,
    editingIndex: -1, // -1:譁ｰ隕・ 0莉･荳・邱ｨ髮・
    draggedSpriteIndex: null,

    // 繧ｿ繧､繝ｫ繧ｯ繝ｪ繝・け迥ｶ諷具ｼ医ム繝悶Ν繧ｿ繝・・讀懷・逕ｨ・・
    tileClickState: { index: null, timer: null, count: 0 },

    // UNDO螻･豁ｴ
    undoHistory: [],
    maxUndoHistory: 20,

    // 遽・峇驕ｸ謚槭・繝壹・繧ｹ繝医Δ繝ｼ繝・
    selectionMode: false,
    selectionStart: null,
    selectionEnd: null,
    rangeClipboard: null,
    pasteMode: false,
    pasteData: null,
    pasteOffset: { x: 0, y: 0 },
    isMovingSelection: false,
    selectionMoveStart: null,
    isFloating: false,
    floatingData: null,
    floatingEntities: null, // Added for entities
    floatingPos: { x: 0, y: 0 },
    isSelecting: false,

    init() {
        this.canvas = document.getElementById('stage-canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }

        // 描画エンジン初期化
        this.renderer = new StageRenderer();
        this.templateManager = new StageTemplateManager(this);
        this.stageSettings = new StageSettings(this);
        this.canvasInput = new StageCanvasInput(this);

        this.initTools();
        this.initAddTileButton();
        this.initConfigPanel();
        this.initSpriteSelectPopup();
        this.initSeSelectPopup();
        this.initTemplateList();
        this.initCanvasEvents();
        this.initStageSettings();
        this.resize();
    },

    refresh() {
        // キャンバスを再取得（DOM更新対応）
        this.canvas = document.getElementById('stage-canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }

        this.initTemplateList();
        this.initCanvasEvents();
        this.updateStageSettingsUI();
        this.resize();
        this.render();
    },

    // ========== 繝・・繝ｫ繝舌・ ==========
    initTools() {
        this.toolsInitialized = true;

        // 繧ｹ繝・・繧ｸ逕ｻ髱｢蟆ら畑縺ｮ繝・・繝ｫ繝懊ち繝ｳ繧帝∈謚・
        document.querySelectorAll('#stage-tools .paint-tool-btn').forEach(btn => {
            let longPressTimer = null;

            const startLongPress = () => {
                if (btn.dataset.tool === 'eraser') {
                    longPressTimer = setTimeout(() => {
                        this.clearAllTiles();
                        longPressTimer = null;
                    }, 800);
                }
            };

            const cancelLongPress = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };

            // 繝槭え繧ｹ繧､繝吶Φ繝・
            btn.addEventListener('mousedown', startLongPress);
            btn.addEventListener('mouseup', cancelLongPress);
            btn.addEventListener('mouseleave', cancelLongPress);

            // 繧ｿ繝・メ繧､繝吶Φ繝・
            btn.addEventListener('touchstart', startLongPress, { passive: true });
            btn.addEventListener('touchend', cancelLongPress);

            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;

                switch (tool) {
                    case 'undo':
                        this.undo();
                        return;
                    case 'select':
                        this.startSelectionMode();
                        break;
                    case 'copy':
                        this.copySelection();
                        return;
                    case 'paste':
                        this.pasteTiles();
                        return;
                    case 'flip-v':
                        this.flipVertical();
                        return;
                    case 'flip-h':
                        this.flipHorizontal();
                        return;
                    default:
                        // 驕ｸ謚槭Δ繝ｼ繝峨く繝｣繝ｳ繧ｻ繝ｫ
                        this.cancelSelectionMode();
                        break;
                }

                // 謠冗判繝・・繝ｫ縺ｮ蝣ｴ蜷医√き繝ｬ繝ｳ繝医ヤ繝ｼ繝ｫ繧呈峩譁ｰ
                if (['pen', 'eraser', 'fill', 'eyedropper', 'select'].includes(tool)) {
                    this.currentTool = tool;
                    document.querySelectorAll('#stage-tools .paint-tool-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.tool === tool);
                    });
                }
            });
        });
    },

    // ========== 閭梧勹濶ｲ蜿門ｾ・==========
    getBackgroundColor() {
        // 繧ｹ繝・・繧ｸ險ｭ螳壹・閭梧勹濶ｲ繧剃ｽｿ逕ｨ
        return App.projectData.stage?.bgColor || App.projectData.stage?.backgroundColor || '#3CBCFC';
    },

    // ========== 繧ｹ繝励Λ繧､繝医ぐ繝｣繝ｩ繝ｪ繝ｼ・医ラ繝ｩ繝・げ蜈・ｼ・==========
    initSpriteGallery() {
        const container = document.getElementById('stage-sprite-list');
        if (!container) return;

        container.innerHTML = '';

        App.projectData.sprites.forEach((sprite, index) => {
            const div = document.createElement('div');
            div.className = 'stage-sprite-item';
            div.draggable = true;

            const miniCanvas = document.createElement('canvas');
            miniCanvas.width = 16;
            miniCanvas.height = 16;
            this.renderSpriteToMiniCanvas(sprite, miniCanvas, this.getBackgroundColor());
            div.style.backgroundImage = `url(${miniCanvas.toDataURL()})`;
            div.style.backgroundSize = 'cover';

            div.addEventListener('dragstart', (e) => {
                this.draggedSpriteIndex = index;
                div.classList.add('dragging');
                e.dataTransfer.setData('text/plain', index.toString());
            });

            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
            });

            container.appendChild(div);
        });
    },

    // ========== 繧ｿ繧､繝ｫ霑ｽ蜉繝懊ち繝ｳ ==========
    initAddTileButton() {
        const addBtn = document.getElementById('add-tile-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openTypeSelectPopup());
        }
    },

    // 螻樊ｧ驕ｸ謚槭・繝・・繧｢繝・・繧帝幕縺・
    openTypeSelectPopup() {
        const popup = document.getElementById('type-select-popup');
        if (popup) {
            popup.classList.remove('hidden');
            this.initTypeSelectEvents();
        }
    },

    closeTypeSelectPopup() {
        const popup = document.getElementById('type-select-popup');
        if (popup) {
            popup.classList.add('hidden');
        }
    },

    initTypeSelectEvents() {
        // 繧ｭ繝｣繝ｳ繧ｻ繝ｫ繝懊ち繝ｳ
        const cancelBtn = document.getElementById('type-select-cancel');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.closeTypeSelectPopup();
        }

        // 螻樊ｧ驕ｸ謚槭・繧ｿ繝ｳ
        document.querySelectorAll('.type-select-item').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                this.closeTypeSelectPopup();
                this.addNewTile(type);
            };
        });
    },

    addNewTile(type) {
        // 譁ｰ隕上ち繧､繝ｫ菴懈・
        this.editingTemplate = this.createDefaultTemplate(type);
        this.editingIndex = -1;
        this.openConfigPanel();
    },

    createDefaultTemplate(type) {
        const spriteKeys = this.getSpriteKeysForType(type);
        const sprites = {};
        spriteKeys.forEach(key => {
            sprites[key] = { frames: [], speed: 5, loop: true };
        });

        return {
            type: type,
            sprites: sprites,
            config: this.getDefaultConfig(type)
        };
    },

    getSpriteKeysForType(type) {
        switch (type) {
            case 'player':
                return ['idle', 'walk', 'climb', 'jump', 'attack', 'shot', 'life'];
            case 'enemy':
                return ['idle', 'walk', 'climb', 'jump', 'attack', 'shot'];
            case 'material':
            case 'item':
                return ['main'];
            default:
                return ['main'];
        }
    },

    getDefaultConfig(type) {
        switch (type) {
            case 'player':
                return { life: 3, lifeCount: 3, speed: 5, jumpPower: 10, wJump: false, shotMaxRange: 3 };
            case 'enemy':
                return { life: 1, lifeCount: 1, speed: 3, jumpPower: 5, shotMaxRange: 3, move: 'idle' };
            case 'material':
                return { collision: true, life: -1 };
            case 'item':
                return { itemType: 'coin' };
            default:
                return {};
        }
    },

    // ========== 險ｭ螳壹ヱ繝阪Ν ==========
    initConfigPanel() {
        const closeBtn = document.getElementById('config-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeConfigPanel());
        }

        const saveBtn = document.getElementById('config-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveTemplate());
        }
    },

    // 螻樊ｧ繝ｩ繝吶Ν陦ｨ遉ｺ逕ｨ縺ｮ繝槭ャ繝斐Φ繧ｰ
    typeLabels: {
        player: 'U193',
        enemy: 'U194',
        material: 'U195',
        item: 'U196',
        goal: 'U197'
    },

    openConfigPanel() {
        // 繧ｹ繝・・繧ｸ險ｭ螳壹ヱ繝阪Ν繧帝哩縺倥ｋ
        const stageSettingsPanel = document.getElementById('stage-settings-panel');
        if (stageSettingsPanel) stageSettingsPanel.classList.add('collapsed');

        const panel = document.getElementById('tile-config-panel');
        if (panel && this.editingTemplate) {
            panel.classList.remove('hidden');
            this.isConfigOpen = true;

            // 螻樊ｧ繝ｩ繝吶Ν繧呈峩譁ｰ
            const typeLabel = document.getElementById('tile-type-label');
            if (typeLabel) {
                const labelId = this.typeLabels[this.editingTemplate.type];
                typeLabel.textContent = labelId ? this.t(labelId) : this.editingTemplate.type;
            }

            this.renderConfigContent();

            // 繝代ロ繝ｫ繧貞・鬆ｭ縺ｫ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ
            panel.scrollTop = 0;
        }
    },

    closeConfigPanel() {
        const panel = document.getElementById('tile-config-panel');
        if (panel) {
            panel.classList.add('hidden');
            this.isConfigOpen = false;
            this.editingTemplate = null;
            this.editingIndex = -1;
        }
    },

    renderConfigContent() {
        const spriteSection = document.getElementById('sprite-config-section');
        const paramSection = document.getElementById('param-config-section');
        if (!spriteSection || !paramSection || !this.editingTemplate) return;

        const type = this.editingTemplate.type;

        if (type === 'player' || type === 'enemy') {
            // スプライトセクション: 立ち・歩き・のぼる・ジャンプ・攻撃（プレイヤー変身時は変身アイテムを攻撃の下に追加）
            const basePlayerIdx = (App.projectData.templates || []).findIndex(t => t.type === 'player');
            const isBasePlayer = type === 'player' && this.editingIndex === basePlayerIdx;
            let baseSprites = ['idle', 'walk', 'climb', 'jump', 'attack'];
            if (type === 'player' && !isBasePlayer) {
                baseSprites = ['idle', 'walk', 'climb', 'jump', 'attack', 'transformItem'];
            }
            let spriteHtml = '';
            baseSprites.forEach(key => {
                spriteHtml += this.renderSpriteRow(key);
            });
            spriteSection.innerHTML = spriteHtml;
        } else {
            // その他（material, item, goal）: 従来通り全スプライト行
            const spriteKeys = this.getSpriteKeysForType(type);
            let spriteHtml = '';
            spriteKeys.forEach(key => {
                spriteHtml += this.renderSpriteRow(key);
            });
            spriteSection.innerHTML = spriteHtml;
        }

        // パラメータセクション
        paramSection.innerHTML = this.renderParamSection(type);

        this.initConfigEvents();
    },


    renderSpriteRow(slot) {
        const spriteData = this.editingTemplate.sprites[slot] || { frames: [], speed: 5, loop: true };
        const speed = spriteData.speed || 5;
        const firstFrame = spriteData.frames?.[0];

        // 繧ｹ繝ｭ繝・ヨ陦ｨ遉ｺ蜷・
        const labels = {
            idle: this.t('U198'), walk: this.t('U199'), climb: this.t('U200'), jump: this.t('U201'),
            attack: this.t('U202'), shot: this.t('U203'), life: this.t('U204'), main: this.t('U203'),
            transformItem: this.t('U205')
        };

        return `
            <div class="sprite-row" data-slot="${slot}">
                <span class="sprite-row-label">${labels[slot] || slot.toUpperCase()}</span>
                <div class="sprite-slot" data-slot="${slot}">
                    ${firstFrame !== undefined ? `<canvas width="16" height="16" data-sprite="${firstFrame}"></canvas>` : ''}
                </div>
                <!-- 騾溷ｺｦ險ｭ螳壹ヶ繝ｭ繝・け繧ｲ繝ｼ繧ｸ (1-20 -> 5谿ｵ髫・ -->
                <div class="block-gauge" data-type="speed" data-slot="${slot}" data-min="1" data-max="20">
                    ${this.renderBlockGaugeItems(slot, speed, 1, 20)}
                </div>
            </div>
        `;
    },

    renderParamSection(type) {
        const config = this.editingTemplate.config || {};
        let html = '';

        if (type === 'player' || type === 'enemy') {
            // ① 能力
            html += `<div class="param-section-label">${this.t('U206')}</div>`;
            html += this.renderSlider(this.t('U207'), 'speed', config.speed ?? 5, 1, 10);

            // ② ジャンプ力（プレイヤーは 2段ジャンプトグル付き）
            if (type === 'player') {
                html += this.renderSliderWithCheck(this.t('U208'), 'jumpPower', config.jumpPower ?? 10, 1, 20, this.t('U209'), 'wJump', config.wJump);
            } else {
                html += this.renderSlider(this.t('U208'), 'jumpPower', config.jumpPower ?? 10, 1, 20);
            }

            // ③ ライフ スプライト行 ＋ ライフ数（プレイヤーのみ）
            if (type === 'player') {
                html += this.renderSpriteRow('life');
                html += this.renderSlider(this.t('U210'), 'life', config.life ?? 3, 1, 5);
            } else {
                // てきはライフスプライトなしでライフ数のみ
                html += this.renderSlider(this.t('U210'), 'life', config.life ?? 1, 1, 5);
            }

            // てき専用: 特性セクション（武器より先に表示）
            if (type === 'enemy') {
                html += `<div class="param-section-label">${this.t('U211')}</div>`;
                html += `
                    <div class="param-row">
                        <span class="param-label">${this.t('U424')}</span>
                        <select class="param-select" data-key="move">
                            <option value="idle" ${config.move === 'idle' ? 'selected' : ''}>${this.t('U213')}</option>
                            <option value="patrol" ${config.move === 'patrol' ? 'selected' : ''}>${this.t('U212')}</option>
                            <option value="jump" ${config.move === 'jump' ? 'selected' : ''}>${this.t('U214')}</option>
                            <option value="jumpPatrol" ${config.move === 'jumpPatrol' ? 'selected' : ''}>${this.t('U215')}</option>
                            <option value="chase" ${config.move === 'chase' ? 'selected' : ''}>${this.t('U216')}</option>
                            <option value="rush" ${config.move === 'rush' ? 'selected' : ''}>${this.t('U217')}</option>
                        </select>
                    </div>
                `;
                html += this.renderToggle(this.t('U218'), 'isAerial', config.isAerial);
                html += this.renderToggle(this.t('U219'), 'isBoss', config.isBoss);
                html += `
                    <div class="param-row">
                        <span class="param-label">${this.t('U425')}</span>
                        <select class="param-select" data-key="dropItem">
                            <option value="none" ${!config.dropItem || config.dropItem === 'none' ? 'selected' : ''}>${this.t('U220')}</option>
                            <option value="coin" ${config.dropItem === 'coin' ? 'selected' : ''}>${this.t('U221')}</option>
                            <option value="muteki" ${config.dropItem === 'muteki' ? 'selected' : ''}>${this.t('U222')}</option>
                            <option value="lifeup" ${config.dropItem === 'lifeup' ? 'selected' : ''}>${this.t('U223')}</option>
                            <option value="clear" ${config.dropItem === 'clear' ? 'selected' : ''}>${this.t('U224')}</option>
                            <option value="weapon" ${config.dropItem === 'weapon' ? 'selected' : ''}>${this.t('U225')}</option>
                            <option value="bomb" ${config.dropItem === 'bomb' ? 'selected' : ''}>${this.t('U226')}</option>
                            <option value="easter" ${config.dropItem === 'easter' ? 'selected' : ''}>${this.t('U227')}</option>
                        </select>
                    </div>
                `;
            }

            // ④ 武器
            html += `<div class="param-section-label">${this.t('U228')}</div>`;
            // 飛び道具 スプライト行
            html += this.renderSpriteRow('shot');

            // ⑤ 軌道
            html += `
                <div class="param-row">
                    <span class="param-label">${this.t('U428')}</span>
                    <select class="param-select" data-key="shotType">
                        <option value="melee" ${config.shotType === 'melee' ? 'selected' : ''}>${this.t('U229')}</option>
                        <option value="straight" ${config.shotType === 'straight' || !config.shotType ? 'selected' : ''}>${this.t('U230')}</option>
                        <option value="arc" ${config.shotType === 'arc' ? 'selected' : ''}>${this.t('U231')}</option>
                        <option value="drop" ${config.shotType === 'drop' ? 'selected' : ''}>${this.t('U232')}</option>
                        <option value="spread" ${config.shotType === 'spread' ? 'selected' : ''}>${this.t('U233')}</option>
                        <option value="boomerang" ${config.shotType === 'boomerang' ? 'selected' : ''}>${this.t('U234')}</option>
                        <option value="pinball" ${config.shotType === 'pinball' ? 'selected' : ''}>${this.t('U235')}</option>
                        <option value="orbit" ${config.shotType === 'orbit' ? 'selected' : ''}>${this.t('U236')}</option>
                    </select>
                </div>
            `;

            // ⑥ 速度
            html += this.renderBlockGauge(this.t('U237'), 'shotSpeed', config.shotSpeed ?? 3, 1, 5);

            // ⑦ 連射
            html += this.renderBlockGauge(this.t('U238'), 'shotRate', config.shotRate ?? 3, 1, 5);

            // ⑧ 届く距離（旧射程距離）
            html += this.renderBlockGauge(this.t('U239'), 'shotMaxRange', config.shotMaxRange ?? 3, 1, 5);

            // プレイヤー専用: はじめから使える
            if (type === 'player') {
                html += `
                    <div class="param-row param-row-toggle">
                        <span class="param-label"></span>
                        <label class="toggle-switch toggle-inline" style="margin-left: 0;">
                            <span class="toggle-label" style="margin-right: 6px; font-weight: normal;">${this.t('U423')}</span>
                            <input type="checkbox" data-key="weaponFromStart" ${config.weaponFromStart ?? true ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
            }

            // プレイヤー専用 SE設定
            if (type === 'player') {
                html += `<div class="param-section-label">${this.t('U240')}</div>`;
                html += this.renderSeSelect(this.t('U241'), 'seJump', config.seJump ?? 0);
                html += this.renderSeSelect(this.t('U242'), 'seAttack', config.seAttack ?? 5);
                html += this.renderSeSelect(this.t('U243'), 'seDamage', config.seDamage ?? 10);
                html += this.renderSeSelect(this.t('U244'), 'seItemGet', config.seItemGet ?? 15);
            }
        } else if (type === 'material') {
            html += `
                <div class="param-row">
                    <span class="param-label">${this.t('U426')}</span>
                    <select class="param-select" data-key="gimmick">
                        <option value="none" ${!config.gimmick || config.gimmick === 'none' ? 'selected' : ''}>${this.t('U220')}</option>
                        <option value="moveH" ${config.gimmick === 'moveH' ? 'selected' : ''}>${this.t('U245')}</option>
                        <option value="moveV" ${config.gimmick === 'moveV' ? 'selected' : ''}>${this.t('U246')}</option>
                        <option value="fall" ${config.gimmick === 'fall' ? 'selected' : ''}>${this.t('U247')}</option>
                        <option value="ladder" ${config.gimmick === 'ladder' ? 'selected' : ''}>${this.t('U248')}</option>
                        <option value="spring" ${config.gimmick === 'spring' ? 'selected' : ''}>${this.t('U249')}</option>
                        <option value="door" ${config.gimmick === 'door' ? 'selected' : ''}>${this.t('U250')}</option>
                    </select>
                </div>
            `;
            if (config.gimmick === 'spring') {
                html += this.renderBlockGauge(this.t('U251'), 'springPower', config.springPower ?? 3, 1, 5);
            }
            // ギミック「なし」の時のみ当たり判定・耐久性を表示
            if (!config.gimmick || config.gimmick === 'none') {
                html += this.renderToggle(this.t('U252'), 'collision', config.collision !== false);
                html += this.renderSlider(this.t('U253'), 'life', config.life ?? -1, -1, 10);
            }
        } else if (type === 'item') {
            html += `
                <div class="param-row">
                    <span class="param-label">${this.t('U427')}</span>
                    <select class="param-select" data-key="itemType">
                        <option value="coin" ${config.itemType === 'coin' ? 'selected' : ''}>${this.t('U221')}</option>
                        <option value="muteki" ${config.itemType === 'muteki' ? 'selected' : ''}>${this.t('U222')}</option>
                        <option value="lifeup" ${config.itemType === 'lifeup' ? 'selected' : ''}>${this.t('U223')}</option>
                        <option value="clear" ${config.itemType === 'clear' ? 'selected' : ''}>${this.t('U224')}</option>
                        <option value="weapon" ${config.itemType === 'weapon' ? 'selected' : ''}>${this.t('U225')}</option>
                        <option value="bomb" ${config.itemType === 'bomb' ? 'selected' : ''}>${this.t('U226')}</option>
                        <option value="key" ${config.itemType === 'key' ? 'selected' : ''}>${this.t('U254')}</option>
                        <option value="easter" ${config.itemType === 'easter' ? 'selected' : ''}>${this.t('U227')}</option>
                    </select>
                </div>
            `;
            // イースターエッグの場合のみメッセージ入力欄を表示
            if (config.itemType === 'easter') {
                html += `
                    <div class="param-row">
                        <span class="param-label">${this.t('U445')}</span>
                        <input type="text" class="param-input" data-key="easterMessage" 
                               value="${config.easterMessage || ''}" 
                               maxlength="20" placeholder="${this.t('U255')}">
                    </div>
                `;
            }
        }

        return html;
    },

    renderSlider(label, key, value, min, max) {
        // ブロックゲージに統合。スライダーは非推奨
        return this.renderBlockGauge(label, key, value, min, max);
    },

    renderBlockGauge(label, key, value, min, max) {
        let mappedValue = value;

        // 特殊ケース: lifeで-1は無限
        if (key === 'life' && min === -1) {
            if (value === -1) mappedValue = 5; // 無限は5番目（全点灯）
            else mappedValue = Math.min(value, 5);
        } else {
            // 通常のマッピング: min-max を 1-5 にマッピング
            const range = max - min;
            mappedValue = Math.round(((value - min) / range) * 4) + 1;
            mappedValue = Math.max(1, Math.min(5, mappedValue));
        }

        let blocks = '';
        for (let i = 1; i <= 5; i++) {
            const active = i <= mappedValue ? 'active' : '';
            blocks += `<span class="block-gauge-item ${active}" data-key="${key}" data-index="${i}"></span>`;
        }

        const infinityDisplay = (key === 'life' && min === -1 && mappedValue === 5) ? 'inline' : 'none';
        return `
            <div class="param-row param-row-gauge">
                <span class="param-label">${label}</span>
                <div class="block-gauge" data-key="${key}" data-min="${min}" data-max="${max}">
                    ${blocks}
                </div>
                <span class="gauge-infinity" style="display: ${infinityDisplay}; margin-left: 6px; font-weight: bold; color: #888;">∞</span>
            </div>
        `;
    },

    renderSliderWithCheck(label, sliderKey, sliderValue, min, max, checkLabel, checkKey, checkValue) {
        // ブロックゲージ + トグルスイッチに統合
        return `
            <div class="param-row param-row-gauge">
                <span class="param-label">${label}</span>
                <div class="block-gauge" data-key="${sliderKey}" data-min="${min}" data-max="${max}">
                    ${this.renderBlockGaugeItems(sliderKey, sliderValue, min, max)}
                </div>
                ${this.renderToggleInline(checkLabel, checkKey, checkValue)}
            </div>
        `;
    },

    renderBlockGaugeItems(key, value, min, max) {
        const range = max - min;
        let mappedValue = Math.round(((value - min) / range) * 4) + 1;
        mappedValue = Math.max(1, Math.min(5, mappedValue));

        let blocks = '';
        for (let i = 1; i <= 5; i++) {
            const active = i <= mappedValue ? 'active' : '';
            blocks += `<span class="block-gauge-item ${active}" data-key="${key}" data-index="${i}"></span>`;
        }
        return blocks;
    },

    renderToggle(label, key, value) {
        return `
            <div class="param-row param-row-toggle">
                <span class="param-label">${label}</span>
                <label class="toggle-switch">
                    <input type="checkbox" data-key="${key}" ${value ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    },

    renderToggleInline(label, key, value) {
        return `
            <label class="toggle-switch toggle-inline" title="${label}">
                <span class="toggle-label" style="margin-right: 6px;">${label}</span>
                <input type="checkbox" data-key="${key}" ${value ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        `;
    },

    // ピクセル単位の実スライダー（射程距離用）
    renderRangeSlider(label, key, value, min, max) {
        return `
            <div class="param-row param-row-range">
                <span class="param-label">${label}</span>
                <div class="range-slider-container">
                    <input type="range" class="range-slider" data-key="${key}" 
                           min="${min}" max="${max}" value="${value}" step="1">
                    <span class="range-value" data-key="${key}">${value}</span>
                </div>
            </div>
        `;
    },

    renderSeSelect(label, key, selectedValue) {
        // soundsがなければデフォルトのSEリストを適用
        let sounds = App.projectData?.sounds;
        if (!sounds || sounds.length === 0) {
            sounds = [
                // ジャンプ系
                { id: 0, name: this.t('U256'), type: 'jump_01' },
                { id: 1, name: this.t('U257'), type: 'jump_02' },
                { id: 2, name: this.t('U258'), type: 'jump_03' },
                { id: 3, name: this.t('U259'), type: 'jump_04' },
                { id: 4, name: this.t('U260'), type: 'jump_05' },
                // 攻撃系
                { id: 5, name: this.t('U261'), type: 'attack_01' },
                { id: 6, name: this.t('U262'), type: 'attack_02' },
                { id: 7, name: this.t('U263'), type: 'attack_03' },
                { id: 8, name: this.t('U264'), type: 'attack_04' },
                { id: 9, name: this.t('U265'), type: 'attack_05' },
                // ダメージ系
                { id: 10, name: this.t('U266'), type: 'damage_01' },
                { id: 11, name: this.t('U267'), type: 'damage_02' },
                { id: 12, name: this.t('U268'), type: 'damage_03' },
                { id: 13, name: this.t('U269'), type: 'damage_04' },
                { id: 14, name: this.t('U270'), type: 'damage_05' },
                // ゲット系
                { id: 15, name: this.t('U271'), type: 'itemGet_01' },
                { id: 16, name: this.t('U272'), type: 'itemGet_02' },
                { id: 17, name: this.t('U273'), type: 'itemGet_03' },
                { id: 18, name: this.t('U274'), type: 'itemGet_04' },
                { id: 19, name: this.t('U275'), type: 'itemGet_05' },
                // その他
                { id: 20, name: this.t('U276'), type: 'other_01' },
                { id: 21, name: this.t('U277'), type: 'other_02' },
                { id: 22, name: this.t('U278'), type: 'other_03' },
                { id: 23, name: this.t('U279'), type: 'other_04' },
                { id: 24, name: this.t('U280'), type: 'other_05' }
            ];
            // プロジェクトデータに登録
            if (App.projectData) {
                App.projectData.sounds = sounds;
            }
        }

        // 驕ｸ謚樔ｸｭ縺ｮSE蜷阪ｒ蜿門ｾ・
        let selectedName = this.getSeName(sounds[selectedValue]);

        return `
            <div class="param-row se-row">
                <span class="param-label">${label}</span>
                <button class="se-select-btn param-select" data-key="${key}" data-value="${selectedValue}">
                    ${selectedName}
                </button>
            </div>
        `;
    },

    renderSoundRow(label, slot) {
        return `
            <div class="sound-reg-row">
                <span class="sound-reg-label">${label}</span>
                <div class="sound-slot" data-slot="${slot}">♪</div>
            </div>
        `;
    },

    initConfigEvents() {
        // 繧ｹ繝励Λ繧､繝医せ繝ｭ繝・ヨ縺ｮ繧ｯ繝ｪ繝・け繧､繝吶Φ繝・
        document.querySelectorAll('.sprite-slot').forEach(slotEl => {
            slotEl.addEventListener('click', () => {
                const slot = slotEl.dataset.slot;
                if (slot) {
                    this.openSpriteSelectPopup(slot);
                }
            });
        });

        // 繧ｹ繝励Λ繧､繝磯溷ｺｦ繧ｹ繝ｩ繧､繝繝ｼ
        document.querySelectorAll('.sprite-speed').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const slot = slider.dataset.slot;
                if (slot && this.editingTemplate?.sprites?.[slot]) {
                    const speed = parseInt(e.target.value);
                    this.editingTemplate.sprites[slot].speed = speed;
                    // 騾溷ｺｦ陦ｨ遉ｺ繧偵Μ繧｢繝ｫ繧ｿ繧､繝譖ｴ譁ｰ
                    const countEl = document.querySelector(`.sprite-count[data-slot="${slot}"]`);
                    if (countEl) {
                        countEl.textContent = speed;
                    }
                    // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧偵Μ繧｢繝ｫ繧ｿ繧､繝譖ｴ譁ｰ
                    this.updateConfigAnimations();
                }
            });
        });

        // 繧ｹ繝励Λ繧､繝郁ｨｭ螳壹・蛻晄悄蛹悶・菫ｮ豁｣
        if (this.editingTemplate?.sprites) {
            Object.keys(this.editingTemplate.sprites).forEach(slot => {
                const sprite = this.editingTemplate.sprites[slot];
                // 謾ｻ謦・い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺ｯ繝ｫ繝ｼ繝励＆縺帙↑縺・
                if (slot === 'attack') {
                    sprite.loop = false;
                } else if (sprite.loop === undefined) {
                    // 莉悶・繝・ヵ繧ｩ繝ｫ繝医〒繝ｫ繝ｼ繝・
                    sprite.loop = true;
                }
            });
        }

        // 繝代Λ繝｡繝ｼ繧ｿ繧ｹ繝ｩ繧､繝繝ｼ (legacy support)
        document.querySelectorAll('.param-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const key = slider.dataset.key;
                let value = parseInt(e.target.value);

                if (key && this.editingTemplate?.config) {
                    // LIFE險ｭ螳夲ｼ・aterial・峨・0繧ｹ繧ｭ繝・・蟇ｾ蠢・
                    if (key === 'life' && this.editingTemplate.type === 'material') {
                        if (value >= 0) value += 1; // 0莉･荳翫・+1縺励※菫晏ｭ假ｼ・繧偵せ繧ｭ繝・・・・
                    }

                    this.editingTemplate.config[key] = value;
                    // 蛟､陦ｨ遉ｺ繧呈峩譁ｰ
                    const valueEl = document.querySelector(`.param-value[data-key="${key}"]`);
                    if (valueEl) {
                        valueEl.textContent = value === -1 ? '∞' : value;
                    }
                }
            });
        });

        // 繝悶Ο繝・け繧ｲ繝ｼ繧ｸ繧ｯ繝ｪ繝・け
        document.querySelectorAll('.block-gauge-item').forEach(item => {
            item.addEventListener('click', () => {
                const key = item.dataset.key;
                const index = parseInt(item.dataset.index);
                const gaugeContainer = item.closest('.block-gauge');
                const min = parseInt(gaugeContainer.dataset.min);
                const max = parseInt(gaugeContainer.dataset.max);

                // data-type="speed" の場合 (スプライト速度)
                if (gaugeContainer.dataset.type === 'speed') {
                    const slot = gaugeContainer.dataset.slot;
                    if (slot && this.editingTemplate?.sprites?.[slot]) {
                        // 速度マッピング (1-20 -> 5段階)
                        const range = max - min;
                        const value = Math.round(((index - 1) / 4) * range + min);

                        this.editingTemplate.sprites[slot].speed = value;

                        // ゲージUI更新
                        gaugeContainer.querySelectorAll('.block-gauge-item').forEach((g, i) => {
                            if (i + 1 <= index) {
                                g.classList.add('active');
                            } else {
                                g.classList.remove('active');
                            }
                        });

                        // アニメーション更新
                        this.updateConfigAnimations();
                    }
                    return;
                }

                if (key && this.editingTemplate?.config) {
                    // インデックス(1-5)を実際の値にマッピング
                    let value;
                    if (key === 'life' && min === -1) {
                        // 特殊ケース: 5番目=無敵(-1), 1-4=1-4
                        value = index === 5 ? -1 : index;
                    } else {
                        // 通常マッピング
                        const range = max - min;
                        value = Math.round(((index - 1) / 4) * range + min);
                    }

                    this.editingTemplate.config[key] = value;

                    // ゲージUIを更新
                    gaugeContainer.querySelectorAll('.block-gauge-item').forEach((g, i) => {
                        if (i + 1 <= index) {
                            g.classList.add('active');
                        } else {
                            g.classList.remove('active');
                        }
                    });

                    // 無限マークの表示切り替え
                    const infinitySpan = gaugeContainer.parentElement.querySelector('.gauge-infinity');
                    if (infinitySpan) {
                        infinitySpan.style.display = (index === 5 && key === 'life' && min === -1) ? 'inline' : 'none';
                    }
                }
            });
        });

        // 繝医げ繝ｫ繧ｹ繧､繝・メ / 繝√ぉ繝・け繝懊ャ繧ｯ繧ｹ
        document.querySelectorAll('.toggle-switch input[type="checkbox"], .param-check-label input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const key = cb.dataset.key;
                if (key && this.editingTemplate?.config) {
                    this.editingTemplate.config[key] = cb.checked;
                }
            });
        });

        // 繝代Λ繝｡繝ｼ繧ｿ繧ｻ繝ｬ繧ｯ繝・
        document.querySelectorAll('.param-select').forEach(select => {
            select.addEventListener('change', () => {
                const key = select.dataset.key;
                if (key && this.editingTemplate?.config) {
                    // SE髢｢騾｣縺ｯ謨ｰ蛟､縺ｧ菫晏ｭ・
                    if (key.startsWith('se')) {
                        this.editingTemplate.config[key] = parseInt(select.value);
                    } else {
                        this.editingTemplate.config[key] = select.value;
                    }

                    // itemType縺悟､画峩縺輔ｌ縺溷ｴ蜷医・UI繝ｪ繝輔Ξ繝・す繝･・医Γ繝・そ繝ｼ繧ｸ谺・・陦ｨ遉ｺ/髱櫁｡ｨ遉ｺ・・
                    if (key === 'itemType' || key === 'gimmick') {
                        this.renderConfigContent();
                        this.initConfigEvents();
                    }
                }
            });
        });

        // 繝代Λ繝｡繝ｼ繧ｿ繝・く繧ｹ繝亥・蜉幢ｼ医う繝ｼ繧ｹ繧ｿ繝ｼ繧ｨ繝・げ繝｡繝・そ繝ｼ繧ｸ縺ｪ縺ｩ・・
        document.querySelectorAll('.param-input').forEach(input => {
            input.addEventListener('input', () => {
                const key = input.dataset.key;
                if (key && this.editingTemplate?.config) {
                    this.editingTemplate.config[key] = input.value;
                }
            });
        });

        // SE繝励Ξ繝薙Η繝ｼ繝懊ち繝ｳ
        document.querySelectorAll('.se-preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const key = btn.dataset.key;
                const select = document.querySelector(`.se-select[data-key="${key}"]`);
                if (select) {
                    const seIndex = parseInt(select.value);
                    if (seIndex >= 0) {
                        this.playSePreview(seIndex);
                    }
                }
            });
        });

        // SE驕ｸ謚槭・繧ｿ繝ｳ
        document.querySelectorAll('.se-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                const val = parseInt(btn.dataset.value);
                const currentValue = isNaN(val) ? -1 : val;
                this.openSeSelectPopup(key, currentValue);
            });
        });

        // レンジスライダー（射程距離など）
        document.querySelectorAll('.range-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const key = slider.dataset.key;
                const value = parseInt(e.target.value);
                if (key && this.editingTemplate?.config) {
                    this.editingTemplate.config[key] = value;
                    // 値表示を更新
                    const valueEl = document.querySelector(`.range-value[data-key="${key}"]`);
                    if (valueEl) {
                        valueEl.textContent = value;
                    }
                }
            });
        });

        // 繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧貞・譛溷喧
        this.updateConfigAnimations();
    },

    // 險ｭ螳壹ヱ繝阪Ν蜀・・繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧呈峩譁ｰ
    updateConfigAnimations() {
        // 譌｢蟄倥・繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧ｿ繧､繝槭・繧偵け繝ｪ繧｢
        if (this.configAnimationIntervals) {
            this.configAnimationIntervals.forEach(id => clearInterval(id));
        }
        this.configAnimationIntervals = [];

        // 繧ｹ繝励Λ繧､繝医ｒ繧ｭ繝｣繝ｳ繝舌せ縺ｫ謠冗判・医い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧ょｯｾ蠢懶ｼ・
        document.querySelectorAll('.sprite-slot').forEach(slotEl => {
            const slot = slotEl.dataset.slot;
            const canvas = slotEl.querySelector('canvas');
            if (!canvas || !slot) return;

            const spriteData = this.editingTemplate?.sprites?.[slot];
            const frames = spriteData?.frames || [];
            const speed = spriteData?.speed || 8;

            if (frames.length === 0) return;

            // 蛻晄悄繝輔Ξ繝ｼ繝謠冗判
            const firstSprite = App.projectData.sprites[frames[0]];
            if (firstSprite) {
                this.renderSpriteToMiniCanvas(firstSprite, canvas, this.getBackgroundColor());
            }

            // 隍・焚繝輔Ξ繝ｼ繝縺ｮ蝣ｴ蜷医・繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ
            if (frames.length > 1) {
                let frameIndex = 0;
                const animInterval = setInterval(() => {
                    // 繝代ロ繝ｫ縺碁哩縺倥ｉ繧後◆繧峨い繝九Γ蛛懈ｭ｢
                    if (!this.isConfigOpen) {
                        clearInterval(animInterval);
                        return;
                    }
                    frameIndex = (frameIndex + 1) % frames.length;
                    const sprite = App.projectData.sprites[frames[frameIndex]];
                    if (sprite) {
                        this.renderSpriteToMiniCanvas(sprite, canvas, this.getBackgroundColor());
                    }
                }, 1000 / speed);
                this.configAnimationIntervals.push(animInterval);
            }
        });
    },

    // ========== SE驕ｸ謚槭・繝・・繧｢繝・・ ==========
    currentSeSelectKey: null,
    selectedSeIndex: -1,

    initSeSelectPopup() {
        const cancelBtn = document.getElementById('se-select-cancel');
        const doneBtn = document.getElementById('se-select-done');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeSeSelectPopup());
        }

        if (doneBtn) {
            doneBtn.addEventListener('click', () => this.confirmSeSelection());
        }
    },

    openSeSelectPopup(key, currentValue) {
        this.currentSeSelectKey = key;
        this.selectedSeIndex = currentValue;

        const popup = document.getElementById('se-select-popup');
        const list = popup.querySelector('.se-select-list');

        // SE荳隕ｧ繧堤函謌・
        let sounds = App.projectData?.sounds;
        if (!sounds || sounds.length === 0) {
            sounds = [
                { id: 0, name: this.t('U201'), type: 'jump' },
                { id: 1, name: this.t('U202'), type: 'attack' },
                { id: 2, name: this.t('U281'), type: 'damage' },
                { id: 3, name: this.t('U282'), type: 'itemGet' }
            ];
        }

        let html = `
            <div class="se-select-item ${this.selectedSeIndex === -1 ? 'current' : ''}" data-se-index="-1">
                <span class="se-name">${this.t('U220')}</span>
            </div>
        `;
        sounds.forEach((se, idx) => {
            html += `
                <div class="se-select-item ${this.selectedSeIndex === idx ? 'current' : ''}" data-se-index="${idx}">
                    <span class="se-name">${this.getSeName(se)}</span>
                    <button class="se-preview-btn" data-se-index="${idx}">▶</button>
                </div>
            `;
        });

        list.innerHTML = html;

        // 繝ｪ繧ｹ繝亥・縺ｮ繧ｿ繝・メ繧､繝吶Φ繝井ｼ晄眺繧貞●豁｢・医げ繝ｭ繝ｼ繝舌Ν繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ繝悶Ο繝・け縺ｮ蝗樣∩・・
        list.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        list.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

        // 繧､繝吶Φ繝医ｒ險ｭ螳・
        list.querySelectorAll('.se-select-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 繝励Ξ繝薙Η繝ｼ繝懊ち繝ｳ繧ｯ繝ｪ繝・け譎ゅ・驕ｸ謚槭＠縺ｪ縺・
                if (e.target.classList.contains('se-preview-btn')) return;

                // 蜊ｳ蠎ｧ縺ｫ驕ｸ謚槭ｒ遒ｺ螳・
                this.selectedSeIndex = parseInt(item.dataset.seIndex);
                this.confirmSeSelection();
            });
        });

        list.querySelectorAll('.se-preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.seIndex);
                this.playSePreview(idx);
            });
            // 繧ｿ繝・メ繧､繝吶Φ繝医ｂ霑ｽ蜉・亥渚蠢懈ｧ蜷台ｸ奇ｼ・
            btn.addEventListener('touchstart', (e) => {
                e.stopPropagation(); // 繝ｪ繧ｹ繝医・繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ莉･螟悶∈縺ｮ莨晄眺髦ｲ豁｢
            }, { passive: true });
        });

        // 繝昴ャ繝励い繝・・螟悶け繝ｪ繝・け縺ｧ髢峨§繧・
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                this.closeSeSelectPopup();
            }
        }, { once: true });

        popup.classList.remove('hidden');
    },

    closeSeSelectPopup() {
        const popup = document.getElementById('se-select-popup');
        popup.classList.add('hidden');
        this.currentSeSelectKey = null;
    },

    confirmSeSelection() {
        if (this.currentSeSelectKey && this.editingTemplate?.config) {
            this.editingTemplate.config[this.currentSeSelectKey] = this.selectedSeIndex;
            // UI繧呈峩譁ｰ
            this.renderConfigContent();
            this.initConfigEvents();
        }
        this.closeSeSelectPopup();
    },

    // ========== BGM選択ポップアップ ==========
    openBgmSelectPopup() {
        const popup = document.getElementById('bgm-select-popup');
        const list = document.getElementById('bgm-select-list');
        if (!popup || !list) return;

        // BGM一覧を取得（SoundEditorから）
        const songs = (typeof SoundEditor !== 'undefined' && SoundEditor.songs) ? SoundEditor.songs : [];
        const currentValue = App.projectData.stage?.bgm?.[this.selectedBgmType] || '';

        let html = `
            <div class="se-select-item ${currentValue === '' ? 'current' : ''}" data-bgm-index="">
                <span class="se-name">なし</span>
            </div>
        `;
        songs.forEach((song, idx) => {
            const isCurrent = currentValue === String(idx) ? 'current' : '';
            html += `
                <div class="se-select-item ${isCurrent}" data-bgm-index="${idx}">
                    <span class="se-name">${song.name || `BGM ${idx + 1}`}</span>
                    <button class="se-preview-btn" data-bgm-index="${idx}">▶</button>
                </div>
            `;
        });

        list.innerHTML = html;

        // タッチイベント伝播停止
        list.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        list.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

        // アイテムクリックで選択
        list.querySelectorAll('.se-select-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('se-preview-btn')) return;

                const idx = item.dataset.bgmIndex;
                this.confirmBgmSelection(idx);
            });
        });

        // プレビューボタン
        list.querySelectorAll('.se-preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.bgmIndex);
                this.playBgmPreview(idx);
            });
        });

        popup.classList.remove('hidden');
    },

    confirmBgmSelection(idx) {
        if (!App.projectData.stage.bgm) App.projectData.stage.bgm = {};
        App.projectData.stage.bgm[this.selectedBgmType] = idx;

        // ボタンテキストを更新
        const btn = document.getElementById(`bgm-${this.selectedBgmType}-btn`);
        if (btn) {
            if (idx === '') {
                btn.textContent = 'なし';
            } else {
                const song = App.projectData.songs?.[parseInt(idx)];
                btn.textContent = song?.name || `BGM ${parseInt(idx) + 1}`;
            }
        }

        document.getElementById('bgm-select-popup').classList.add('hidden');
        this.stopBgmPreview();
    },

    playBgmPreview(idx) {
        // 既に同じ曲をプレビュー中の場合は停止して終了
        if (this.bgmPreviewPlaying && typeof SoundEditor !== 'undefined' &&
            SoundEditor.currentSongIdx === parseInt(idx) && SoundEditor.isPlaying) {
            this.stopBgmPreview();
            return;
        }

        this.stopBgmPreview();
        if (typeof SoundEditor !== 'undefined' && SoundEditor.songs?.[idx]) {
            SoundEditor.selectSong(idx);
            SoundEditor.play();
            this.bgmPreviewPlaying = true;

            // UI更新
            const btn = document.querySelector(`#bgm-select-popup .se-preview-btn[data-bgm-index="${idx}"]`);
            if (btn) {
                btn.textContent = '■';
                btn.classList.add('playing');
            }
        }
    },

    stopBgmPreview() {
        if (this.bgmPreviewPlaying && typeof SoundEditor !== 'undefined') {
            SoundEditor.stop();
            this.bgmPreviewPlaying = false;
        }
        // UIリセット
        const popup = document.getElementById('bgm-select-popup');
        if (popup) {
            popup.querySelectorAll('.se-preview-btn').forEach(btn => {
                btn.textContent = '▶';
                btn.classList.remove('playing');
            });
        }
    },

    // ========== スプライト選択モーダル ==========
    initSpriteSelectPopup() {
        const cancelBtn = document.getElementById('sprite-select-cancel');
        const doneBtn = document.getElementById('sprite-select-done');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeSpriteSelectPopup());
        }

        if (doneBtn) {
            doneBtn.addEventListener('click', () => this.confirmSpriteSelection());
        }
    },

    currentSelectingSlot: null,
    selectedSpriteOrder: [],

    openSpriteSelectPopup(slot) {
        const popup = document.getElementById('sprite-select-popup');
        const list = document.getElementById('sprite-select-list');
        if (!popup || !list) return;

        this.currentSelectingSlot = slot;
        this.selectedSpriteOrder = [...(this.editingTemplate?.sprites?.[slot]?.frames || [])];

        // 閭梧勹濶ｲ繧貞虚逧・↓蜿門ｾ・
        const bgColor = App.projectData.stage?.bgColor || App.projectData.stage?.backgroundColor || '#3CBCFC';

        // 繧ｹ繝励Λ繧､繝井ｸ隕ｧ繧呈ｨｪ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ蠖｢蠑上〒陦ｨ遉ｺ
        list.innerHTML = '';
        App.projectData.sprites.forEach((sprite, index) => {
            const item = document.createElement('div');
            item.className = 'sprite-select-item';
            item.style.backgroundColor = bgColor; // 蜍慕噪閭梧勹濶ｲ
            const orderIndex = this.selectedSpriteOrder.indexOf(index);
            if (orderIndex >= 0) {
                item.classList.add('selected');
                const orderNum = document.createElement('span');
                orderNum.className = 'sprite-select-order';
                orderNum.textContent = orderIndex + 1;
                item.appendChild(orderNum);
            }

            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;
            this.renderSpriteToMiniCanvas(sprite, canvas, bgColor);
            item.appendChild(canvas);

            item.addEventListener('click', () => this.toggleSpriteSelection(index, item));
            list.appendChild(item);
        });

        popup.classList.remove('hidden');
    },

    toggleSpriteSelection(spriteIndex, itemEl) {
        const orderIndex = this.selectedSpriteOrder.indexOf(spriteIndex);
        if (orderIndex >= 0) {
            // 驕ｸ謚櫁ｧ｣髯､
            this.selectedSpriteOrder.splice(orderIndex, 1);
            itemEl.classList.remove('selected');
            const orderNum = itemEl.querySelector('.sprite-select-order');
            if (orderNum) orderNum.remove();
        } else {
            // 驕ｸ謚櫁ｿｽ蜉
            this.selectedSpriteOrder.push(spriteIndex);
            itemEl.classList.add('selected');
            const orderNum = document.createElement('span');
            orderNum.className = 'sprite-select-order';
            orderNum.textContent = this.selectedSpriteOrder.length;
            itemEl.appendChild(orderNum);
        }

        // 鬆・分陦ｨ遉ｺ繧呈峩譁ｰ
        this.updateSpriteSelectionOrder();
    },

    updateSpriteSelectionOrder() {
        const list = document.getElementById('sprite-select-list');
        if (!list) return;

        list.querySelectorAll('.sprite-select-item').forEach(item => {
            const canvas = item.querySelector('canvas');
            if (!canvas) return;
            // canvas縺九ｉsprite index繧貞叙蠕励☆繧区婿豕輔′縺ｪ縺・◆繧√・・分縺縺第峩譁ｰ
        });
    },

    closeSpriteSelectPopup() {
        const popup = document.getElementById('sprite-select-popup');
        if (popup) {
            popup.classList.add('hidden');
        }
        this.currentSelectingSlot = null;
        this.selectedSpriteOrder = [];
    },

    confirmSpriteSelection() {
        if (this.currentSelectingSlot && this.editingTemplate) {
            if (!this.editingTemplate.sprites[this.currentSelectingSlot]) {
                this.editingTemplate.sprites[this.currentSelectingSlot] = { frames: [], speed: 5, loop: true };
            }
            this.editingTemplate.sprites[this.currentSelectingSlot].frames = [...this.selectedSpriteOrder];
            this.renderConfigContent();
        }
        this.closeSpriteSelectPopup();
    },

    // ========== テンプレート管理（StageTemplateManager に委譲）==========
    saveTemplate() {
        if (this.templateManager) this.templateManager.saveTemplate();
    },

    replaceSpritesInStage(oldId, newId) {
        if (this.templateManager) this.templateManager.replaceSpritesInStage(oldId, newId);
    },

    initTemplateList() {
        if (this.templateManager) this.templateManager.initTemplateList();
    },

    deleteTemplate(index, needConfirm = true) {
        if (this.templateManager) this.templateManager.deleteTemplate(index, needConfirm);
    },

    duplicateTemplate(index) {
        if (this.templateManager) this.templateManager.duplicateTemplate(index);
    },

    clearTileFromCanvas(templateIndex) {
        if (this.templateManager) this.templateManager.clearTileFromCanvas(templateIndex);
    },

    updateMapTemplateReferences(action, index) {
        if (this.templateManager) this.templateManager.updateMapTemplateReferences(action, index);
    },

    stopAutoScroll() {
        if (this.templateManager) this.templateManager.stopAutoScroll();
    },

    startAutoScroll(dx, dy) {
        if (this.templateManager) this.templateManager.startAutoScroll(dx, dy);
    },

    // ========== キャンバス ==========

    // Canvas Input delegation wrappers (StageCanvasInput)
    initCanvasEvents() {
        if (this.canvasInput) this.canvasInput.attach();
    },

    floodFill(startX, startY, targetValue, newValue) {
        if (this.canvasInput) this.canvasInput.floodFill(startX, startY, targetValue, newValue);
    },


    resize() {
        const container = document.getElementById('stage-canvas-area');
        if (!container || !this.canvas) return;

        // キャンバスは常に16x16タイル・20px固定ビューポート
        // ステージサイズが大きい場合は2本指パンでスクロール
        this.tileSize = 20;
        const canvasSize = 320;

        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;
        this.canvas.style.width = canvasSize + 'px';
        this.canvas.style.height = canvasSize + 'px';

        this.render();
    },


    // ========== 描画（StageRenderer に委譲）==========
    render() {
        if (!this.canvas || !this.ctx || !this.renderer) return;
        if (App.currentScreen !== 'stage') return;
        this.renderer.render({
            canvas:          this.canvas,
            ctx:             this.ctx,
            tileSize:        this.tileSize,
            stage:           App.projectData.stage,
            sprites:         App.projectData.sprites,
            templates:       App.projectData.templates || [],
            palette:         App.nesPalette,
            bgColor:         this.getBackgroundColor(),
            scrollX:         this.canvasScrollX || 0,
            scrollY:         this.canvasScrollY || 0,
            selectionMode:   this.selectionMode,
            selectionStart:  this.selectionStart,
            selectionEnd:    this.selectionEnd,
            isSelecting:     this.isSelecting,
            isFloating:      this.isFloating,
            floatingData:    this.floatingData,
            floatingEntities: this.floatingEntities,
            floatingPos:     this.floatingPos,
            pasteMode:       this.pasteMode,
            pasteData:       this.pasteData,
            pasteOffset:     this.pasteOffset,
        });
    },

    renderSpriteToMiniCanvas(sprite, canvas, bgColor = '#3CBCFC') {
        if (this.renderer) this.renderer.renderSpriteToMiniCanvas(sprite, canvas, bgColor);
    },

    // ========== UNDO讖溯・ ==========
    saveToHistory() {
        // 繝・ヰ繧ｦ繝ｳ繧ｹ・・00ms莉･蜀・・騾｣邯壼他縺ｳ蜃ｺ縺励ｒ辟｡隕厄ｼ・
        const now = Date.now();
        if (this.lastSaveTime && now - this.lastSaveTime < 100) {
            return;
        }
        this.lastSaveTime = now;

        const stage = App.projectData.stage;
        // FG繝ｬ繧､繝､繝ｼ縺ｮ迴ｾ蝨ｨ縺ｮ迥ｶ諷九ｒ繝・ぅ繝ｼ繝励さ繝斐・
        const snapshot = stage.layers.fg.map(row => [...row]);

        this.undoHistory.push(snapshot);

        // 螻･豁ｴ縺悟､壹☆縺弱ｋ蝣ｴ蜷医・蜿､縺・ｂ縺ｮ繧貞炎髯､
        if (this.undoHistory.length > this.maxUndoHistory) {
            this.undoHistory.shift();
        }
    },

    undo() {
        if (this.undoHistory.length === 0) {
            console.log('No undo history');
            return;
        }

        const snapshot = this.undoHistory.pop();
        const stage = App.projectData.stage;

        // 繧ｹ繝翫ャ繝励す繝ｧ繝・ヨ繧貞ｾｩ蜈・
        stage.layers.fg = snapshot;

        this.render();
        console.log('Undo applied');
    },

    clearAllTiles() {
        if (!confirm('すべてのタイルを削除しますか？')) {
            return;
        }

        this.saveToHistory();

        const stage = App.projectData.stage;
        for (let y = 0; y < stage.height; y++) {
            for (let x = 0; x < stage.width; x++) {
                stage.layers.fg[y][x] = -1;
            }
        }

        this.render();
        console.log('All tiles cleared');
    },

    // Stage Settings delegation wrappers
    initStageSettings() {
        if (this.stageSettings) this.stageSettings.initStageSettings();
    },

    updateStageSettingsUI(preserveFormState = false) {
        if (this.stageSettings) this.stageSettings.updateStageSettingsUI(preserveFormState);
    },

    updateBgmSelects() {
        if (this.stageSettings) this.stageSettings.updateBgmSelects();
    },

    resizeStage(newWidth, newHeight) {
        if (this.stageSettings) this.stageSettings.resizeStage(newWidth, newHeight);
    },

    openBgColorPicker() {
        if (this.stageSettings) this.stageSettings.openBgColorPicker();
    },

    playSePreview(seIndex) {
        if (this.stageSettings) this.stageSettings.playSePreview(seIndex);
    },

    // ========== 繧ｹ繝・・繧ｸ險ｭ螳壹ヱ繝阪Ν ==========

    floatSelection() {
        if (!this.selectionStart || !this.selectionEnd) return;
        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
        const w = x2 - x1 + 1;
        const h = y2 - y1 + 1;

        const stage = App.projectData.stage;
        const layer = stage.layers.fg;
        if (!stage.entities) stage.entities = [];

        // 1. Tiles processing
        const floatingData = [];

        for (let y = 0; y < h; y++) {
            const row = [];
            for (let x = 0; x < w; x++) {
                const ty = y + y1;
                const tx = x + x1;
                if (layer[ty] && typeof layer[ty][tx] !== 'undefined') {
                    row.push(layer[ty][tx]);
                    layer[ty][tx] = -1; // Clear
                } else {
                    row.push(-1);
                }
            }
            floatingData.push(row);
        }

        // 2. Entities processing
        const floatingEntities = [];
        const entitiesToRemove = [];

        stage.entities.forEach((e, index) => {
            if (e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2) {
                floatingEntities.push({
                    ...e,
                    relX: e.x - x1,
                    relY: e.y - y1
                });
                entitiesToRemove.push(index);
            }
        });

        // Remove from stage (sort descending)
        entitiesToRemove.sort((a, b) => b - a).forEach(idx => stage.entities.splice(idx, 1));

        this.floatingData = floatingData;
        this.floatingEntities = floatingEntities;
        this.floatingPos = { x: x1, y: y1 };
        this.isFloating = true;
    },

    commitFloatingData() {
        if (!this.isFloating || !this.floatingData) return;
        const stage = App.projectData.stage;
        const layer = stage.layers.fg;

        // 1. Tiles commit
        const h = this.floatingData.length;
        const w = this.floatingData[0].length;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const val = this.floatingData[y][x];
                const ty = this.floatingPos.y + y;
                const tx = this.floatingPos.x + x;

                if (ty >= 0 && ty < stage.height && tx >= 0 && tx < stage.width) {
                    layer[ty][tx] = val;
                }
            }
        }

        // 2. Entities commit
        if (this.floatingEntities) {
            if (!stage.entities) stage.entities = [];
            this.floatingEntities.forEach(fe => {
                const { relX, relY, ...entityData } = fe;
                stage.entities.push({
                    ...entityData,
                    x: this.floatingPos.x + relX,
                    y: this.floatingPos.y + relY
                });
            });
        }

        this.isFloating = false;
        this.floatingData = null;
        this.floatingEntities = null;
        this.render();
    },

    getTemplateSize(templateIdx) {
        const tmpl = (App.projectData.templates && App.projectData.templates[templateIdx]) || null;
        if (!tmpl) return 1;
        const spriteIdx = tmpl.sprites?.idle?.frames?.[0] ?? tmpl.sprites?.main?.frames?.[0];
        const sprite = App.projectData.sprites[spriteIdx];
        return sprite?.size || 1;
    },

    flipData(data, axis) {
        if (!data || !data.tiles || data.tiles.length === 0) return;
        const tiles = data.tiles;
        const h = tiles.length;
        const w = tiles[0].length;

        const items = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const id = tiles[y][x];
                if (id >= 100) {
                    items.push({ id, x, y, size: this.getTemplateSize(id - 100) });
                } else if (id >= 0) {
                    items.push({ id, x, y, size: 1 });
                }
            }
        }

        const newTiles = Array.from({ length: h }, () => Array(w).fill(-1));
        items.forEach(item => {
            let nx = item.x, ny = item.y;
            if (axis === 'h') nx = (w - item.size) - item.x;
            else ny = (h - item.size) - item.y;

            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                newTiles[ny][nx] = item.id;
                if (item.size === 2) {
                    for (let dy = 0; dy < 2; dy++) {
                        for (let dx = 0; dx < 2; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            if (ny + dy < h && nx + dx < w) {
                                newTiles[ny + dy][nx + dx] = -1000 - (dy * 2 + dx);
                            }
                        }
                    }
                }
            }
        });
        data.tiles = newTiles;

        if (data.entities) {
            data.entities.forEach(e => {
                const size = this.getTemplateSize(e.templateId);
                const s = (size === 2) ? 2 : 1;
                if (axis === 'h') e.relX = (w - s) - e.relX;
                else e.relY = (h - s) - e.relY;
            });
        }
    }
};

