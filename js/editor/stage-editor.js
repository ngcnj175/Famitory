/**
 * PixelGameKit - 繧ｹ繝・・繧ｸ繧ｨ繝・ぅ繧ｿ v4・郁ｩｳ邏ｰ險ｭ螳壹ヱ繝阪Ν蟇ｾ蠢懶ｼ・
 */

const StageEditor = {
    canvas: null,
    ctx: null,
    tileSize: 20,

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
        player: 'プレイヤー',
        enemy: 'てき',
        material: 'ブロック・背景',
        item: 'アイテム',
        goal: 'ゴール'
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
                typeLabel.textContent = this.typeLabels[this.editingTemplate.type] || this.editingTemplate.type;
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
            idle: '立ち', walk: '歩き', climb: 'のぼる', jump: 'ジャンプ',
            attack: '攻撃', shot: '見た目', life: 'ライフ', main: '見た目',
            transformItem: '変身アイテム'
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
            html += '<div class="param-section-label">能力</div>';
            html += this.renderSlider('足の速さ', 'speed', config.speed ?? 5, 1, 10);

            // ② ジャンプ力（プレイヤーは 2段ジャンプトグル付き）
            if (type === 'player') {
                html += this.renderSliderWithCheck('ジャンプ力', 'jumpPower', config.jumpPower ?? 10, 1, 20, '2段ジャンプ', 'wJump', config.wJump);
            } else {
                html += this.renderSlider('ジャンプ力', 'jumpPower', config.jumpPower ?? 10, 1, 20);
            }

            // ③ ライフ スプライト行 ＋ ライフ数（プレイヤーのみ）
            if (type === 'player') {
                html += this.renderSpriteRow('life');
                html += this.renderSlider('ライフ数', 'life', config.life ?? 3, 1, 5);
            } else {
                // てきはライフスプライトなしでライフ数のみ
                html += this.renderSlider('ライフ数', 'life', config.life ?? 1, 1, 5);
            }

            // てき専用: 特性セクション（武器より先に表示）
            if (type === 'enemy') {
                html += '<div class="param-section-label">特性</div>';
                html += `
                    <div class="param-row">
                        <span class="param-label">てきの動き</span>
                        <select class="param-select" data-key="move">
                            <option value="idle" ${config.move === 'idle' ? 'selected' : ''}>動かない</option>
                            <option value="patrol" ${config.move === 'patrol' ? 'selected' : ''}>うろうろ</option>
                            <option value="jump" ${config.move === 'jump' ? 'selected' : ''}>ぴょんぴょん</option>
                            <option value="jumpPatrol" ${config.move === 'jumpPatrol' ? 'selected' : ''}>うろぴょん</option>
                            <option value="chase" ${config.move === 'chase' ? 'selected' : ''}>追いかけてくる</option>
                            <option value="rush" ${config.move === 'rush' ? 'selected' : ''}>とっしん</option>
                        </select>
                    </div>
                `;
                html += this.renderToggle('空中', 'isAerial', config.isAerial);
                html += this.renderToggle('ボスてき', 'isBoss', config.isBoss);
                html += `
                    <div class="param-row">
                        <span class="param-label">ドロップ</span>
                        <select class="param-select" data-key="dropItem">
                            <option value="none" ${!config.dropItem || config.dropItem === 'none' ? 'selected' : ''}>なし</option>
                            <option value="coin" ${config.dropItem === 'coin' ? 'selected' : ''}>コイン</option>
                            <option value="muteki" ${config.dropItem === 'muteki' ? 'selected' : ''}>むてき</option>
                            <option value="lifeup" ${config.dropItem === 'lifeup' ? 'selected' : ''}>ライフアップ</option>
                            <option value="clear" ${config.dropItem === 'clear' ? 'selected' : ''}>クリア</option>
                            <option value="weapon" ${config.dropItem === 'weapon' ? 'selected' : ''}>武器</option>
                            <option value="bomb" ${config.dropItem === 'bomb' ? 'selected' : ''}>ボム</option>
                            <option value="easter" ${config.dropItem === 'easter' ? 'selected' : ''}>イースターエッグ</option>
                        </select>
                    </div>
                `;
            }

            // ④ 武器
            html += '<div class="param-section-label">武器</div>';
            // 飛び道具 スプライト行
            html += this.renderSpriteRow('shot');

            // ⑤ 軌道
            html += `
                <div class="param-row">
                    <span class="param-label">軌道</span>
                    <select class="param-select" data-key="shotType">
                        <option value="melee" ${config.shotType === 'melee' ? 'selected' : ''}>近接</option>
                        <option value="straight" ${config.shotType === 'straight' || !config.shotType ? 'selected' : ''}>ストレート</option>
                        <option value="arc" ${config.shotType === 'arc' ? 'selected' : ''}>山なり</option>
                        <option value="drop" ${config.shotType === 'drop' ? 'selected' : ''}>真下に落下</option>
                        <option value="spread" ${config.shotType === 'spread' ? 'selected' : ''}>拡散</option>
                        <option value="boomerang" ${config.shotType === 'boomerang' ? 'selected' : ''}>ブーメラン</option>
                        <option value="pinball" ${config.shotType === 'pinball' ? 'selected' : ''}>ピンボール</option>
                        <option value="orbit" ${config.shotType === 'orbit' ? 'selected' : ''}>回転</option>
                    </select>
                </div>
            `;

            // ⑥ 速度
            html += this.renderBlockGauge('速度', 'shotSpeed', config.shotSpeed ?? 3, 1, 5);

            // ⑦ 連射
            html += this.renderBlockGauge('連射', 'shotRate', config.shotRate ?? 3, 1, 5);

            // ⑧ 届く距離（旧射程距離）
            html += this.renderBlockGauge('届く距離', 'shotMaxRange', config.shotMaxRange ?? 3, 1, 5);

            // プレイヤー専用: はじめから使える
            if (type === 'player') {
                html += `
                    <div class="param-row param-row-toggle">
                        <span class="param-label"></span>
                        <label class="toggle-switch toggle-inline" style="margin-left: 0;">
                            <span class="toggle-label" style="margin-right: 6px; font-weight: normal;">はじめから使える</span>
                            <input type="checkbox" data-key="weaponFromStart" ${config.weaponFromStart ?? true ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
            }

            // プレイヤー専用 SE設定
            if (type === 'player') {
                html += '<div class="param-section-label">効果音</div>';
                html += this.renderSeSelect('ジャンプ音', 'seJump', config.seJump ?? 0);
                html += this.renderSeSelect('攻撃音', 'seAttack', config.seAttack ?? 5);
                html += this.renderSeSelect('ダメージ音', 'seDamage', config.seDamage ?? 10);
                html += this.renderSeSelect('ゲット音', 'seItemGet', config.seItemGet ?? 15);
            }
        } else if (type === 'material') {
            html += `
                <div class="param-row">
                    <span class="param-label">ギミック</span>
                    <select class="param-select" data-key="gimmick">
                        <option value="none" ${!config.gimmick || config.gimmick === 'none' ? 'selected' : ''}>なし</option>
                        <option value="moveH" ${config.gimmick === 'moveH' ? 'selected' : ''}>横移動</option>
                        <option value="moveV" ${config.gimmick === 'moveV' ? 'selected' : ''}>縦移動</option>
                        <option value="fall" ${config.gimmick === 'fall' ? 'selected' : ''}>落下</option>
                        <option value="ladder" ${config.gimmick === 'ladder' ? 'selected' : ''}>はしご</option>
                        <option value="spring" ${config.gimmick === 'spring' ? 'selected' : ''}>スプリング</option>
                        <option value="door" ${config.gimmick === 'door' ? 'selected' : ''}>とびら</option>
                    </select>
                </div>
            `;
            if (config.gimmick === 'spring') {
                html += this.renderBlockGauge('はねる力', 'springPower', config.springPower ?? 3, 1, 5);
            }
            // ギミック「なし」の時のみ当たり判定・耐久性を表示
            if (!config.gimmick || config.gimmick === 'none') {
                html += this.renderToggle('当たり判定', 'collision', config.collision !== false);
                html += this.renderSlider('耐久性', 'life', config.life ?? -1, -1, 10);
            }
        } else if (type === 'item') {
            html += `
                <div class="param-row">
                    <span class="param-label">種類</span>
                    <select class="param-select" data-key="itemType">
                        <option value="coin" ${config.itemType === 'coin' ? 'selected' : ''}>コイン</option>
                        <option value="muteki" ${config.itemType === 'muteki' ? 'selected' : ''}>むてき</option>
                        <option value="lifeup" ${config.itemType === 'lifeup' ? 'selected' : ''}>ライフアップ</option>
                        <option value="clear" ${config.itemType === 'clear' ? 'selected' : ''}>クリア</option>
                        <option value="weapon" ${config.itemType === 'weapon' ? 'selected' : ''}>武器</option>
                        <option value="bomb" ${config.itemType === 'bomb' ? 'selected' : ''}>ボム</option>
                        <option value="key" ${config.itemType === 'key' ? 'selected' : ''}>カギ</option>
                        <option value="easter" ${config.itemType === 'easter' ? 'selected' : ''}>イースターエッグ</option>
                    </select>
                </div>
            `;
            // イースターエッグの場合のみメッセージ入力欄を表示
            if (config.itemType === 'easter') {
                html += `
                    <div class="param-row">
                        <span class="param-label">メッセージ</span>
                        <input type="text" class="param-input" data-key="easterMessage" 
                               value="${config.easterMessage || ''}" 
                               maxlength="20" placeholder="最大20文字">
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
        // 値を1-5の範囲にマッピング
        let mappedValue = value;

        // 特殊ケース: lifeで-1は無限
        if (key === 'life' && min === -1) {
            if (value === -1) mappedValue = 0; // 無限は0番目
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

        return `
            <div class="param-row param-row-gauge">
                <span class="param-label">${label}</span>
                <div class="block-gauge" data-key="${key}" data-min="${min}" data-max="${max}">
                    ${blocks}
                </div>
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
                { id: 0, name: 'ジャンプ01', type: 'jump_01' },
                { id: 1, name: 'ジャンプ02', type: 'jump_02' },
                { id: 2, name: 'ジャンプ03', type: 'jump_03' },
                { id: 3, name: 'ジャンプ04', type: 'jump_04' },
                { id: 4, name: 'ジャンプ05', type: 'jump_05' },
                // 攻撃系
                { id: 5, name: '攻撃01', type: 'attack_01' },
                { id: 6, name: '攻撃02', type: 'attack_02' },
                { id: 7, name: '攻撃03', type: 'attack_03' },
                { id: 8, name: '攻撃04', type: 'attack_04' },
                { id: 9, name: '攻撃05', type: 'attack_05' },
                // ダメージ系
                { id: 10, name: 'ダメージ_01', type: 'damage_01' },
                { id: 11, name: 'ダメージ_02', type: 'damage_02' },
                { id: 12, name: 'ダメージ_03', type: 'damage_03' },
                { id: 13, name: 'ダメージ_04', type: 'damage_04' },
                { id: 14, name: 'ダメージ_05', type: 'damage_05' },
                // ゲット系
                { id: 15, name: 'ゲット_01', type: 'itemGet_01' },
                { id: 16, name: 'ゲット_02', type: 'itemGet_02' },
                { id: 17, name: 'ゲット_03', type: 'itemGet_03' },
                { id: 18, name: 'ゲット_04', type: 'itemGet_04' },
                { id: 19, name: 'ゲット_05', type: 'itemGet_05' },
                // その他
                { id: 20, name: 'その他01(決定)', type: 'other_01' },
                { id: 21, name: 'その他02(キャンセル)', type: 'other_02' },
                { id: 22, name: 'その他03(カーソル)', type: 'other_03' },
                { id: 23, name: 'その他04(ポーズ)', type: 'other_04' },
                { id: 24, name: 'その他05(爆発)', type: 'other_05' }
            ];
            // プロジェクトデータに登録
            if (App.projectData) {
                App.projectData.sounds = sounds;
            }
        }

        // 驕ｸ謚樔ｸｭ縺ｮSE蜷阪ｒ蜿門ｾ・
        let selectedName = 'なし';
        if (selectedValue >= 0 && selectedValue < sounds.length) {
            selectedName = sounds[selectedValue].name;
        }

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
                        // 特殊ケース: 0=無敵(-1), 1-5=1-5
                        value = index === 0 ? -1 : index;
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

    // SE繝励Ξ繝薙Η繝ｼ蜀咲函
    playSePreview(seIndex) {
        console.log('[SE Preview] Called with index:', seIndex);
        const sounds = App.projectData?.sounds;
        console.log('[SE Preview] sounds array:', sounds);
        if (!sounds || seIndex < 0 || seIndex >= sounds.length) {
            console.log('[SE Preview] Invalid index or no sounds');
            return;
        }

        const se = sounds[seIndex];
        console.log('[SE Preview] SE data:', se);
        if (se && se.type) {
            // NesAudio縺ｾ縺溘・AudioManager繧剃ｽｿ縺｣縺ｦ蜀咲函
            const audioEngine = window.NesAudio || window.AudioManager || (typeof NesAudio !== 'undefined' ? NesAudio : null);
            console.log('[SE Preview] Audio engine found:', !!audioEngine);

            if (audioEngine && audioEngine.playSE) {
                // 繧ｳ繝ｳ繝・く繧ｹ繝亥・髢九ｒ隧ｦ縺ｿ繧具ｼ・OS蟇ｾ蠢懶ｼ・
                try {
                    if (audioEngine.ensureContext) {
                        audioEngine.ensureContext();
                    }
                    // AudioContext縺茎uspended縺ｮ蝣ｴ蜷医・ resume 繧貞ｾ・▽
                    if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
                        console.log('[SE Preview] AudioContext suspended, resuming...');
                        audioEngine.ctx.resume().then(() => {
                            console.log('[SE Preview] AudioContext resumed, playing:', se.type);
                            audioEngine.playSE(se.type);
                        });
                    } else {
                        console.log('[SE Preview] Playing immediately:', se.type);
                        audioEngine.playSE(se.type);
                    }
                } catch (err) {
                    console.error('[SE Preview] Error:', err);
                }
            } else {
                console.log('[SE Preview] No audio engine or playSE method');
            }
        }
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
                { id: 0, name: 'ジャンプ', type: 'jump' },
                { id: 1, name: '攻撃', type: 'attack' },
                { id: 2, name: 'ダメージ', type: 'damage' },
                { id: 3, name: 'ゲット', type: 'itemGet' }
            ];
        }

        let html = `
            <div class="se-select-item ${this.selectedSeIndex === -1 ? 'current' : ''}" data-se-index="-1">
                <span class="se-name">なし</span>
            </div>
        `;
        sounds.forEach((se, idx) => {
            html += `
                <div class="se-select-item ${this.selectedSeIndex === idx ? 'current' : ''}" data-se-index="${idx}">
                    <span class="se-name">${se.name}</span>
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

        // ソング一覧を取得（SoundEditorから）
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
                    <span class="se-name">${song.name || `Song ${idx + 1}`}</span>
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
                btn.textContent = song?.name || `Song ${parseInt(idx) + 1}`;
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

    // ========== 繧ｿ繧､繝ｫ菫晏ｭ・==========
    saveTemplate() {
        if (!this.editingTemplate) return;

        // IDLE縺ｾ縺溘・繝｡繧､繝ｳ繧ｹ繝励Λ繧､繝医′蠢・・
        const idleFrames = this.editingTemplate.sprites?.idle?.frames || [];
        const mainFrames = this.editingTemplate.sprites?.main?.frames || [];
        const hasMainSprite = idleFrames.length > 0 || mainFrames.length > 0;

        if (!hasMainSprite) {
            alert('スプライトを登録してください');
            return;
        }

        if (!App.projectData.templates) {
            App.projectData.templates = [];
        }

        // 譌｢蟄倥ユ繝ｳ繝励Ξ繝ｼ繝育ｷｨ髮・凾・壼商縺・せ繝励Λ繧､繝・D繧呈眠縺励＞ID縺ｧ鄂ｮ謠・
        if (this.editingIndex >= 0) {
            const oldTemplate = App.projectData.templates[this.editingIndex];
            const oldSpriteId = oldTemplate?.sprites?.idle?.frames?.[0] ?? oldTemplate?.sprites?.main?.frames?.[0];
            const newSpriteId = this.editingTemplate.sprites?.idle?.frames?.[0] ?? this.editingTemplate.sprites?.main?.frames?.[0];

            // 繧ｹ繝励Λ繧､繝・D縺悟､画峩縺輔ｌ縺溷ｴ蜷医√せ繝・・繧ｸ蜀・ｒ鄂ｮ謠・
            if (oldSpriteId !== undefined && newSpriteId !== undefined && oldSpriteId !== newSpriteId) {
                this.replaceSpritesInStage(oldSpriteId, newSpriteId);
            }

            App.projectData.templates[this.editingIndex] = this.editingTemplate;
        } else {
            App.projectData.templates.push(this.editingTemplate);
            this.selectedTemplate = App.projectData.templates.length - 1;
        }

        this.closeConfigPanel();
        this.initTemplateList();
        this.render(); // 繧ｹ繝・・繧ｸ繧貞・謠冗判
    },

    // 繧ｹ繝・・繧ｸ蜀・・繧ｹ繝励Λ繧､繝・D繧堤ｽｮ謠・
    replaceSpritesInStage(oldId, newId) {
        const stage = App.projectData.stage;
        if (!stage?.layers?.fg) return;

        const layer = stage.layers.fg;
        for (let y = 0; y < layer.length; y++) {
            for (let x = 0; x < layer[y].length; x++) {
                if (layer[y][x] === oldId) {
                    layer[y][x] = newId;
                }
            }
        }
    },

    // ========== 繧ｿ繧､繝ｫ繝・Φ繝励Ξ繝ｼ繝井ｸ隕ｧ ==========
    initTemplateList() {
        const container = document.getElementById('tile-list');
        if (!container) return;

        container.innerHTML = '';

        if (!App.projectData.templates) {
            App.projectData.templates = [];
        }
        this.templates = App.projectData.templates;

        const typeIcons = {
            player: '👤',
            enemy: '👾',
            material: '🧱',
            item: '💎',
            goal: '🏁'
        };

        const basePlayerIdx = this.templates.findIndex(t => t.type === 'player');

        this.templates.forEach((template, index) => {
            const div = document.createElement('div');
            div.className = 'tile-item' + (this.selectedTemplate === index ? ' selected' : '');

            // 変身プレイヤーの場合はtransformItemスロットを優先
            let frames, speed;
            if (template.type === 'player' && basePlayerIdx >= 0 && index !== basePlayerIdx) {
                frames = template.sprites?.transformItem?.frames || template.sprites?.idle?.frames || template.sprites?.main?.frames || [];
                speed = template.sprites?.transformItem?.speed || template.sprites?.idle?.speed || template.sprites?.main?.speed || 8;
            } else {
                frames = template.sprites?.idle?.frames || template.sprites?.main?.frames || [];
                speed = template.sprites?.idle?.speed || template.sprites?.main?.speed || 8;
            }

            if (frames.length > 0) {
                const miniCanvas = document.createElement('canvas');
                miniCanvas.width = 16;
                miniCanvas.height = 16;

                // 初期フレーム描画
                const firstSprite = App.projectData.sprites[frames[0]];
                if (firstSprite) {
                    this.renderSpriteToMiniCanvas(firstSprite, miniCanvas, this.getBackgroundColor());
                }

                // 複数フレームの場合のアニメーション
                if (frames.length > 1) {
                    let frameIndex = 0;
                    const animInterval = setInterval(() => {
                        // 画面がステージでなくなったらアニメ停止
                        if (App.currentScreen !== 'stage') {
                            clearInterval(animInterval);
                            return;
                        }
                        frameIndex = (frameIndex + 1) % frames.length;
                        const sprite = App.projectData.sprites[frames[frameIndex]];
                        if (sprite) {
                            this.renderSpriteToMiniCanvas(sprite, miniCanvas, this.getBackgroundColor());
                        }
                    }, 1000 / speed);
                }

                div.appendChild(miniCanvas);

                // 種別バッジ（スプライトがある場合のみ）
                const badge = document.createElement('span');
                badge.className = 'type-badge';
                badge.textContent = typeIcons[template.type] || '?';
                div.appendChild(badge);

            } else {
                // スプライト未登録（空）の場合
                div.classList.add('empty');
                // バッジは表示しない（+マークのみ、CSSで表示）
            }

            let isLongPress = false;

            // タップ/クリック処理（シングル＝座標に選択、ダブル＝設定表示）
            const handleTap = (e) => {
                // イベントターゲットがこのdiv内でない場合は無視
                if (e && e.target && !div.contains(e.target)) {
                    return;
                }

                // 長押し判定後はクリック処理を中断
                if (isLongPress) return;

                const state = this.tileClickState;

                // 蜷後§繧ｿ繧､繝ｫ縺ｸ縺ｮ2蝗樒岼縺ｮ繧ｯ繝ｪ繝・け・医ム繝悶Ν繧ｿ繝・・・・
                if (state.index === index && state.count === 1) {
                    clearTimeout(state.timer);
                    state.count = 0;
                    state.index = null;

                    // 繝繝悶Ν繧ｿ繝・・・夊ｨｭ螳夊｡ｨ遉ｺ
                    this.editingTemplate = { ...template, sprites: { ...template.sprites } };
                    this.editingIndex = index;
                    this.openConfigPanel();
                } else {
                    // 譛蛻昴・繧ｯ繝ｪ繝・け・壼叉蠎ｧ縺ｫ驕ｸ謚・
                    clearTimeout(state.timer);
                    state.index = index;
                    state.count = 1;

                    // 蜊ｳ蠎ｧ縺ｫ驕ｸ謚槭ｒ蜿肴丐・磯≦蟒ｶ縺ｪ縺暦ｼ・
                    this.selectedTemplate = index;
                    this.initTemplateList();

                    // 繝繝悶Ν繧ｿ繝・・逕ｨ繧ｿ繧､繝槭・・磯∈謚槫ｾ後ｂ繝繝悶Ν繧ｿ繝・・繧貞女縺台ｻ倥￠繧具ｼ・
                    state.timer = setTimeout(() => {
                        state.count = 0;
                        state.index = null;
                    }, 300);
                }
            };

            div.addEventListener('click', handleTap);

            // 長押しでメニュー表示 (PC mousedown + Touch start)
            let longPressTimer = null;

            const startLongPress = () => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    App.showActionMenu(null, [
                        { text: '複製', action: () => this.duplicateTemplate(index) },
                        { text: '削除', style: 'destructive', action: () => this.deleteTemplate(index, false) },
                        { text: 'キャンセル', style: 'cancel' }
                    ]);
                }, 800);
            };

            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };

            // Touch
            div.addEventListener('touchstart', startLongPress, { passive: true });
            div.addEventListener('touchend', cancelLongPress);
            div.addEventListener('touchmove', cancelLongPress);

            // Mouse (PC)
            div.addEventListener('mousedown', startLongPress);
            div.addEventListener('mouseup', cancelLongPress);
            div.addEventListener('mouseleave', cancelLongPress);

            container.appendChild(div);
        });
    },

    // 繧ｿ繧､繝ｫ繝・Φ繝励Ξ繝ｼ繝医ｒ蜑企勁
    deleteTemplate(index, needConfirm = true) {
        if (needConfirm && !confirm('このタイルを削除しますか？')) {
            return;
        }

        // マップ上のテンプレート参照を更新（削除前に実行）
        this.updateMapTemplateReferences('delete', index);

        // テンプレートを削除
        App.projectData.templates.splice(index, 1);

        if (this.selectedTemplate === index) {
            this.selectedTemplate = null;
            this.closeConfigPanel();
        } else if (this.selectedTemplate > index) {
            this.selectedTemplate--;
        }
        this.initTemplateList();
        this.render();
    },

    // タイルテンプレートを複製
    duplicateTemplate(index) {
        const src = App.projectData.templates[index];
        const newTmpl = JSON.parse(JSON.stringify(src));

        // 【修正】マップ上のテンプレート参照を更新（挿入によるズレ補正）
        // index+1 に挿入されるので、既存の index+1 以上のIDを +1 する
        this.updateMapTemplateReferences('insert', index + 1);

        // 該当タイルの後ろに追加
        App.projectData.templates.splice(index + 1, 0, newTmpl);

        // 選択状態の調整
        if (this.selectedTemplate !== null) {
            if (this.selectedTemplate > index) {
                this.selectedTemplate++;
            } else if (this.selectedTemplate === index) {
                this.selectedTemplate = index + 1; // 複製を選択
            }
        }

        this.initTemplateList();
        this.render();
    },

    // 繧ｭ繝｣繝ｳ繝舌せ縺九ｉ謖・ｮ壹う繝ｳ繝・ャ繧ｯ繧ｹ縺ｮ繧ｿ繧､繝ｫ繧偵☆縺ｹ縺ｦ繧ｯ繝ｪ繧｢
    clearTileFromCanvas(templateIndex) {
        const stage = App.projectData.stage;
        if (!stage || !stage.layers) return;

        const layer = stage.layers.fg;
        if (!layer) return;

        // 繧ｿ繧､繝ｫ縺ｮ譛蛻昴・繧ｹ繝励Λ繧､繝医う繝ｳ繝・ャ繧ｯ繧ｹ繧貞叙蠕・
        const template = App.projectData.templates[templateIndex];
        if (!template) return;

        const spriteIdx = template.sprites?.idle?.frames?.[0] ?? template.sprites?.main?.frames?.[0];
        if (spriteIdx === undefined) return;

        // 繧ｭ繝｣繝ｳ繝舌せ荳翫・隧ｲ蠖薙ち繧､繝ｫ繧・1縺ｫ鄂ｮ謠・
        for (let y = 0; y < stage.height; y++) {
            for (let x = 0; x < stage.width; x++) {
                if (layer[y][x] === spriteIdx) {
                    layer[y][x] = -1;
                }
            }
        }
    },

    // テンプレート削除・挿入時のマップ参照更新
    updateMapTemplateReferences(action, index) {
        const stage = App.projectData.stage;
        if (!stage) return;

        // 1. マップタイル（レイヤー）の更新
        if (stage.layers) {
            ['bg', 'fg', 'collision'].forEach(layerName => {
                const layer = stage.layers[layerName];
                if (!layer) return;

                for (let y = 0; y < stage.height; y++) {
                    for (let x = 0; x < stage.width; x++) {
                        const val = layer[y][x];
                        // テンプレート参照は 100以上
                        if (val < 100) continue;

                        const templateId = val - 100;

                        if (action === 'insert') {
                            // 挿入箇所以降のIDを+1
                            if (templateId >= index) {
                                layer[y][x] = (templateId + 1) + 100;
                            }
                        } else if (action === 'delete') {
                            if (templateId === index) {
                                // 削除されたテンプレートを参照している場合 -> 削除(-1)
                                layer[y][x] = -1;
                            } else if (templateId > index) {
                                // 削除箇所以降のIDを-1
                                layer[y][x] = (templateId - 1) + 100;
                            }
                        }
                    }
                }
            });
        }

        // 2. エンティティ（Player/Enemy/Itemなど）の更新
        if (stage.entities && Array.isArray(stage.entities)) {
            if (action === 'insert') {
                stage.entities.forEach(e => {
                    if (e.templateId >= index) {
                        e.templateId++;
                    }
                });
            } else if (action === 'delete') {
                // 削除対象のエンティティを除去
                // filterを使うと再代入が必要になるため、spliceで逆順処理推奨だが、
                // ここでは分かりやすさ優先で filter 結果を代入
                stage.entities = stage.entities.filter(e => e.templateId !== index);

                // 削除箇所以降のIDを-1
                stage.entities.forEach(e => {
                    if (e.templateId > index) {
                        e.templateId--;
                    }
                });
            }
        }
    },

    // --- オートスクロール関数 ---
    stopAutoScroll() {
        if (this.autoScrollDelayTimer) {
            clearTimeout(this.autoScrollDelayTimer);
            this.autoScrollDelayTimer = null;
        }
        if (this.autoScrollTimer) {
            clearInterval(this.autoScrollTimer);
            this.autoScrollTimer = null;
        }
    },

    startAutoScroll(dx, dy) {
        this.autoScrollX = dx;
        this.autoScrollY = dy;
        if (this.autoScrollTimer || this.autoScrollDelayTimer) return;

        this.autoScrollDelayTimer = setTimeout(() => {
            this.autoScrollDelayTimer = null;
            this.autoScrollTimer = setInterval(() => {
                const stage = App.projectData?.stage;
                if (!stage || (!this.selectionMode && !this.pasteMode)) {
                    this.stopAutoScroll();
                    return;
                }

                const maxScrollX = Math.max(0, (stage.width - 16) * this.tileSize);
                const maxScrollY = Math.max(0, (stage.height - 16) * this.tileSize);
                
                const oldX = this.canvasScrollX;
                const oldY = this.canvasScrollY;

                // dx, dy が正ならカーソルは右/下端にある -> 表示領域を右/下に動かす = canvasScrollX/Y は負の方向に減る
                this.canvasScrollX = Math.max(-maxScrollX, Math.min(0, this.canvasScrollX - this.autoScrollX));
                this.canvasScrollY = Math.max(-maxScrollY, Math.min(0, this.canvasScrollY - this.autoScrollY));

                if (this.canvasScrollX === oldX && this.canvasScrollY === oldY) return;

                if (this.lastPointerEvent && this.handleAutoScrollMove) {
                    this.handleAutoScrollMove(this.lastPointerEvent);
                }
                this.render();
            }, 30);
        }, 300);
    },

    // ========== 繧ｭ繝｣繝ｳ繝舌せ ==========
    initCanvasEvents() {
        if (!this.canvas) return;

        // 驥崎､・Μ繧ｹ繝翫・髦ｲ豁｢
        if (this.canvasEventsInitialized) return;
        this.canvasEventsInitialized = true;

        let isDrawing = false;


        // 2譛ｬ謖・ヱ繝ｳ逕ｨ縺ｮ迥ｶ諷・
        this.canvasScrollX = 0;
        this.canvasScrollY = 0;
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let lastScrollX = 0;
        let lastScrollY = 0;

        // --- PC: マウスホイールスクロール ---
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const stage = App.projectData?.stage;
            if (!stage) return;
            const maxScrollX = Math.max(0, (stage.width - 16) * this.tileSize);
            const maxScrollY = Math.max(0, (stage.height - 16) * this.tileSize);
            if (maxScrollX === 0 && maxScrollY === 0) return;

            const speed = 0.3;
            const dx = (e.shiftKey ? e.deltaY : 0) * speed;
            const dy = (e.shiftKey ? 0 : e.deltaY) * speed;
            this.canvasScrollX = Math.max(-maxScrollX, Math.min(0, this.canvasScrollX - dx));
            this.canvasScrollY = Math.max(-maxScrollY, Math.min(0, this.canvasScrollY - dy));
            this.render();
        }, { passive: false });

        // --- PC: 中ボタンドラッグパン ---
        let isMiddlePanning = false;
        let midPanX = 0, midPanY = 0;
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                isMiddlePanning = true;
                midPanX = e.clientX;
                midPanY = e.clientY;
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (!isMiddlePanning) return;
            const stage = App.projectData?.stage;
            if (!stage) return;
            const maxScrollX = Math.max(0, (stage.width - 16) * this.tileSize);
            const maxScrollY = Math.max(0, (stage.height - 16) * this.tileSize);

            const dx = e.clientX - midPanX;
            const dy = e.clientY - midPanY;
            midPanX = e.clientX;
            midPanY = e.clientY;
            this.canvasScrollX = Math.max(-maxScrollX, Math.min(0, this.canvasScrollX + dx));
            this.canvasScrollY = Math.max(-maxScrollY, Math.min(0, this.canvasScrollY + dy));
            this.render();
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 1) isMiddlePanning = false;
        });

        const handleStart = (e) => {
            if (e.cancelable) e.preventDefault(); // Prevent native selection/drag
            // 中ボタン（パン用）は描画に使わない
            if (e.button !== undefined && e.button !== 0) return;
            if (isDrawing) return;
            hasMoved = false;

            // 繧ｿ繝・メ蛻､螳夲ｼ・譛ｬ謖・ヱ繝ｳ蟇ｾ蠢懶ｼ・
            if (e.touches && e.touches.length >= 2) {
                isPanning = true;
                panStartX = e.touches[0].clientX;
                panStartY = e.touches[0].clientY;
                lastScrollX = this.canvasScrollX;
                lastScrollY = this.canvasScrollY;
                isDrawing = false;
                return;
            }

            const { x, y } = this.getTileFromEvent(e);

            // 矩形選択モード
            if (this.currentTool === 'select') {
                try {
                    if (this.selectionStart && this.selectionEnd && this.isPointInSelection(x, y)) {
                        if (!this.isFloating) {
                            this.saveToHistory();
                            this.floatSelection();
                        }
                        this.selectionMoveStart = { x, y };
                        this.isMovingSelection = true;
                    } else {
                        if (this.isFloating) {
                            this.commitFloatingData();
                        }
                        this.selectionStart = { x, y };
                        this.selectionEnd = { x, y };
                        this.isMovingSelection = false;
                        this.isSelecting = true;
                    }
                    isDrawing = true; // 処理成功時のみ描画フラグを立てる
                    this.render();
                } catch (e) {
                    console.error('Selection Logic Error:', e);
                    isDrawing = false; // エラー時はリセット
                }
                return;
            }

            // 繝壹・繧ｹ繝医Δ繝ｼ繝・
            if (this.currentTool === 'paste' && this.pasteMode) {
                isDrawing = true;
                this.selectionMoveStart = { x, y }; // 繝峨Λ繝・げ髢句ｧ狗せ縺ｨ縺励※蛻ｩ逕ｨ
                return;
            }

            // 縺昴・莉悶・繝峨Ο繝ｼ繧､繝ｳ繧ｰ繝・・繝ｫ
            if (this.currentTool === 'pen' || this.currentTool === 'eraser' || this.currentTool === 'fill') {
                this.saveToHistory();
            }

            isDrawing = true;
            this.processPixel(e);
        };

        const checkAutoScroll = (e) => {
            if (this.currentTool !== 'select' && this.currentTool !== 'paste') {
                this.stopAutoScroll();
                return;
            }

            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.clientX ?? e.touches?.[0]?.clientX;
            const clientY = e.clientY ?? e.touches?.[0]?.clientY;
            
            if (clientX === undefined || clientY === undefined) return;

            const edgeSize = 30;
            const scrollSpeed = 15;
            let dx = 0;
            let dy = 0;

            if (clientX < rect.left + edgeSize) dx = -scrollSpeed;
            else if (clientX > rect.right - edgeSize) dx = scrollSpeed;

            if (clientY < rect.top + edgeSize) dy = -scrollSpeed;
            else if (clientY > rect.bottom - edgeSize) dy = scrollSpeed;

            if (dx !== 0 || dy !== 0) {
                this.startAutoScroll(dx, dy);
            } else {
                this.stopAutoScroll();
            }
        };

        const handleMove = (e) => {
            if (isPanning && e.touches && e.touches.length >= 2) {
                // 2譛ｬ謖・ヱ繝ｳ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ
                const dx = e.touches[0].clientX - panStartX;
                const dy = e.touches[0].clientY - panStartY;
                const parent = this.canvas.parentElement;
                parent.scrollLeft = -lastScrollX - dx;
                parent.scrollTop = -lastScrollY - dy;
                return;
            }

            if (!isDrawing) return;
            hasMoved = true;
            this.lastPointerEvent = e;
            checkAutoScroll(e);

            const { x, y } = this.getTileFromEvent(e);

            // 遽・峇驕ｸ謚槭Δ繝ｼ繝・
            if (this.currentTool === 'select') {
                if (this.isMovingSelection && this.selectionMoveStart) {
                    const dx = x - this.selectionMoveStart.x;
                    const dy = y - this.selectionMoveStart.y;
                    if (dx !== 0 || dy !== 0) {
                        this.selectionStart.x += dx;
                        this.selectionStart.y += dy;
                        this.selectionEnd.x += dx;
                        this.selectionEnd.y += dy;

                        if (this.isFloating) {
                            this.floatingPos.x += dx;
                            this.floatingPos.y += dy;
                        }

                        this.selectionMoveStart = { x, y };
                    }
                } else {
                    this.selectionEnd = { x, y };
                }
                this.render();
                return;
            }

            // 繝壹・繧ｹ繝医Δ繝ｼ繝会ｼ育ｧｻ蜍包ｼ・
            if (this.currentTool === 'paste' && this.pasteMode && this.selectionMoveStart) {
                const dx = x - this.selectionMoveStart.x;
                const dy = y - this.selectionMoveStart.y;
                this.pasteOffset.x += dx;
                this.pasteOffset.y += dy;
                this.selectionMoveStart = { x, y };
                this.render();
                return;
            }

            this.processPixel(e);
        };

        const handleEnd = () => {
            this.stopAutoScroll();
            this.lastPointerEvent = null;

            if (isPanning) {
                isPanning = false;
                return;
            }
            if (!isDrawing) return;

            isDrawing = false;

            // 遽・峇驕ｸ謚槭・繝壹・繧ｹ繝育ｧｻ蜍慕ｵゆｺ・凾縺ｮ蜃ｦ逅・
            if (this.currentTool === 'select') {
                this.isSelecting = false;

                if (!hasMoved && !this.isMovingSelection) {
                    this.cancelSelectionMode();
                }
                this.isMovingSelection = false;
                this.selectionMoveStart = null;
                this.render();
                return;
            }
            if (this.currentTool === 'paste') {
                this.selectionMoveStart = null;
                this.confirmPaste();
                return;
            }
        };

        // handleAutoScrollMove を this に紐づけて setInterval から呼べるようにする
        this.handleAutoScrollMove = handleMove;

        this.canvas.addEventListener('mousedown', handleStart);
        this.canvas.addEventListener('mousemove', handleMove);
        this.canvas.addEventListener('mouseup', handleEnd);
        this.canvas.addEventListener('mouseleave', handleEnd);

        // 2譛ｬ謖・ヱ繝ｳ隱､蜈･蜉幃亟豁｢逕ｨ
        let pendingDrawTimer = null;
        let pendingDrawData = null;
        let hasMoved = false;

        // 繧ｿ繝・メ繧､繝吶Φ繝茨ｼ・譛ｬ謖・ｼ壹ち繧､繝ｫ謫堺ｽ懊・譛ｬ謖・ｼ壹ヱ繝ｳ・・
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // 2譛ｬ謖・ｼ壹ヱ繝ｳ髢句ｧ・- 菫晉蕗荳ｭ縺ｮ蜈･蜉帙′縺ゅｌ縺ｰ繧ｭ繝｣繝ｳ繧ｻ繝ｫ
                if (pendingDrawTimer) {
                    clearTimeout(pendingDrawTimer);
                    pendingDrawTimer = null;
                    pendingDrawData = null;
                }
                isPanning = true;
                isDrawing = false;
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                panStartX = (touch1.clientX + touch2.clientX) / 2;
                panStartY = (touch1.clientY + touch2.clientY) / 2;
                lastScrollX = this.canvasScrollX;
                lastScrollY = this.canvasScrollY;
                e.preventDefault();
            } else if (e.touches.length === 1 && !isPanning) {
                // 1譛ｬ謖・ｼ夐≦蟒ｶ縺励※繧ｿ繧､繝ｫ謫堺ｽ懶ｼ・譛ｬ謖・ヱ繝ｳ隱､蜈･蜉幃亟豁｢・・
                e.preventDefault();
                pendingDrawData = e.touches[0];
                pendingDrawTimer = setTimeout(() => {
                    if (pendingDrawData && !isPanning) {
                        handleStart(pendingDrawData);
                    }
                    pendingDrawTimer = null;
                    pendingDrawData = null;
                }, 50);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && isPanning) {
                // 2譛ｬ謖・ｼ壹ヱ繝ｳ荳ｭ
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentX = (touch1.clientX + touch2.clientX) / 2;
                const currentY = (touch1.clientY + touch2.clientY) / 2;

                this.canvasScrollX = lastScrollX + (currentX - panStartX);
                this.canvasScrollY = lastScrollY + (currentY - panStartY);

                // 繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ遽・峇繧貞宛髯・
                const maxScrollX = Math.max(0, (App.projectData.stage.width - 16) * this.tileSize);
                const maxScrollY = Math.max(0, (App.projectData.stage.height - 16) * this.tileSize);
                this.canvasScrollX = Math.max(-maxScrollX, Math.min(0, this.canvasScrollX));
                this.canvasScrollY = Math.max(-maxScrollY, Math.min(0, this.canvasScrollY));

                this.render();
                e.preventDefault();
            } else if (e.touches.length === 1 && !isPanning) {
                e.preventDefault();
                handleMove(e.touches[0]);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                isPanning = false;
            }
            if (e.touches.length === 0) {
                handleEnd();
            }
        });
    },



    getTileFromEvent(e) {
        // 1. PC (Mouse): offsetX / offsetY を優先利用
        // これらは要素のパディングボックス座標系（枠線除外・変換適用前）で返されるため、
        // CSS transform や border の計算を自動的に回避できて最も正確。
        if (e.offsetX !== undefined && e.offsetY !== undefined) {
            // クライアントサイズ（padding含む・border除外）と内部解像度の比率
            const w = this.canvas.clientWidth;
            const h = this.canvas.clientHeight;
            if (w === 0 || h === 0) return { x: 0, y: 0 };

            const scaleX = this.canvas.width / w;
            const scaleY = this.canvas.height / h;

            // スクロールオフセットを加算してステージ座標に変換
            const scrollOffsetX = Math.round(-(this.canvasScrollX || 0) / this.tileSize);
            const scrollOffsetY = Math.round(-(this.canvasScrollY || 0) / this.tileSize);
            const x = Math.floor((e.offsetX * scaleX) / this.tileSize) + scrollOffsetX;
            const y = Math.floor((e.offsetY * scaleY) / this.tileSize) + scrollOffsetY;
            return { x, y };
        }

        // 2. Touch (Fallback): touches[] から手動計算
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;

        if (clientX === undefined || clientY === undefined) return { x: 0, y: 0 };

        const rect = this.canvas.getBoundingClientRect();

        // 枠線の幅を計算
        const cssScaleX = rect.width / this.canvas.offsetWidth;
        const cssScaleY = rect.height / this.canvas.offsetHeight;

        const style = window.getComputedStyle(this.canvas);
        const borderLeft = (parseFloat(style.borderLeftWidth) || 0) * cssScaleX;
        const borderTop = (parseFloat(style.borderTopWidth) || 0) * cssScaleY;
        const borderRight = (parseFloat(style.borderRightWidth) || 0) * cssScaleX;
        const borderBottom = (parseFloat(style.borderBottomWidth) || 0) * cssScaleY;

        const drawRectWidth = rect.width - borderLeft - borderRight;
        const scaleX = this.canvas.width / drawRectWidth;
        const scaleY = this.canvas.height / (rect.height - borderTop - borderBottom);

        // スクロールオフセットを加算してステージ座標に変換
        const scrollOffsetX = Math.round(-(this.canvasScrollX || 0) / this.tileSize);
        const scrollOffsetY = Math.round(-(this.canvasScrollY || 0) / this.tileSize);
        const x = Math.floor(((clientX - rect.left - borderLeft) * scaleX) / this.tileSize) + scrollOffsetX;
        const y = Math.floor(((clientY - rect.top - borderTop) * scaleY) / this.tileSize) + scrollOffsetY;

        return { x, y };
    },

    isPointInSelection(x, y) {
        if (!this.selectionStart || !this.selectionEnd) return false;
        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    },

    startSelectionMode() {
        this.selectionMode = true;
        this.pasteMode = false;

        if (!this.selectionStart) {
            this.selectionStart = null;
            this.selectionEnd = null;
        }

        this.currentTool = 'select';
        document.querySelectorAll('#stage-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'select');
        });
        this.render();
    },

    cancelSelectionMode() {
        if (!this.selectionMode) return;

        if (this.isFloating) {
            this.commitFloatingData();
        }

        this.isSelecting = false;
        this.selectionMode = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.isMovingSelection = false;
        this.selectionMoveStart = null;
        this.render();
    },

    copySelection() {
        if (!this.selectionStart || !this.selectionEnd) {
            return;
        }

        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);

        const stage = App.projectData.stage;
        const layer = stage.layers.fg;
        const tiles = [];

        // Tiles Copy
        for (let y = y1; y <= y2; y++) {
            const row = [];
            for (let x = x1; x <= x2; x++) {
                if (x >= 0 && x < stage.width && y >= 0 && y < stage.height) {
                    row.push(layer[y][x]);
                } else {
                    row.push(-1);
                }
            }
            tiles.push(row);
        }

        // Entities Copy
        const entities = [];
        if (stage.entities) {
            stage.entities.forEach(e => {
                if (e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2) {
                    entities.push({
                        ...e,
                        relX: e.x - x1,
                        relY: e.y - y1
                    });
                }
            });
        }

        this.rangeClipboard = { tiles, entities };
        // alert removed

        // コピー後、選択を解除する
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        this.render();
    },

    pasteTiles() {
        if (!this.rangeClipboard) return;

        // Verify clipboard format
        let tiles = [];
        let entities = [];

        if (Array.isArray(this.rangeClipboard)) {
            // Old format (just tiles)
            tiles = this.rangeClipboard;
        } else if (this.rangeClipboard.tiles) {
            // New format
            tiles = this.rangeClipboard.tiles;
            entities = this.rangeClipboard.entities || [];
        } else {
            return;
        }

        if (tiles.length === 0 && entities.length === 0) return;

        this.pasteMode = true;
        this.selectionMode = false;
        this.pasteData = { tiles, entities: JSON.parse(JSON.stringify(entities)) };

        // 画面中央付近に配置
        // canvasScrollX, Y は負の値をとる。例: スクロールで右に移動=canvasScrollXはマイナス
        // tileSizeはそのまま画面上のピクセル相当
        const scrollX = Math.floor(-(this.canvasScrollX || 0) / this.tileSize);
        const scrollY = Math.floor(-(this.canvasScrollY || 0) / this.tileSize);

        // STAGEの表示画面の大きさを元に、現在のスクロール位置から見てだいたい画面内になるように
        this.pasteOffset = {
            x: Math.max(0, scrollX + 2),
            y: Math.max(0, scrollY + 2)
        };

        this.currentTool = 'paste';
        document.querySelectorAll('#stage-tools .paint-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'paste');
        });
        this.render();
    },

    confirmPaste() {
        if (!this.pasteData || !this.pasteData.tiles) return;

        this.saveToHistory();
        const stage = App.projectData.stage;
        const layer = stage.layers.fg;

        const tiles = this.pasteData.tiles;
        const h = tiles.length;
        const w = tiles[0].length;

        // Paste Tiles
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const tx = this.pasteOffset.x + dx;
                const ty = this.pasteOffset.y + dy;
                const tile = tiles[dy][dx];

                if (tx >= 0 && tx < stage.width && ty >= 0 && ty < stage.height) {
                    if (tile !== -1) {
                        layer[ty][tx] = tile;
                    }
                }
            }
        }

        // Paste Entities
        if (this.pasteData.entities) {
            if (!stage.entities) stage.entities = [];
            this.pasteData.entities.forEach(e => {
                const newX = this.pasteOffset.x + e.relX;
                const newY = this.pasteOffset.y + e.relY;
                stage.entities.push({
                    x: newX,
                    y: newY,
                    templateId: e.templateId
                });
            });
        }

        this.pasteMode = false;
        this.pasteData = null;
        this.currentTool = 'select';
        this.startSelectionMode();
    },

    flipVertical() {
        if (this.pasteMode && this.pasteData) {
            this.flipData(this.pasteData, 'v');
            this.render();
            return;
        }
        if (this.isFloating && this.floatingData) {
            const data = { tiles: this.floatingData, entities: this.floatingEntities };
            this.flipData(data, 'v');
            this.floatingData = data.tiles;
            this.floatingEntities = data.entities;
            this.render();
            return;
        }
        if (this.selectionStart && this.selectionEnd) {
            this.saveToHistory();
            const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            // 範囲内のデータを抽出
            const tiles = [];
            for (let y = y1; y <= y2; y++) {
                tiles.push([...App.projectData.stage.layers.fg[y].slice(x1, x1 + w)]);
            }
            const entities = [];
            if (App.projectData.stage.entities) {
                App.projectData.stage.entities.forEach(e => {
                    if (e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2) {
                        entities.push({ ...e, relX: e.x - x1, relY: e.y - y1 });
                    }
                });
                // 範囲内のエンティティを一度削除
                App.projectData.stage.entities = App.projectData.stage.entities.filter(e => 
                    !(e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2)
                );
            }

            const data = { tiles, entities };
            this.flipData(data, 'v');

            // 反転したデータを書き戻す
            for (let dy = 0; dy < data.tiles.length; dy++) {
                for (let dx = 0; dx < data.tiles[0].length; dx++) {
                    App.projectData.stage.layers.fg[y1 + dy][x1 + dx] = data.tiles[dy][dx];
                }
            }
            data.entities.forEach(e => {
                App.projectData.stage.entities.push({ ...e, x: x1 + e.relX, y: y1 + e.relY });
            });

            this.render();
            return;
        }
    },

    flipHorizontal() {
        if (this.pasteMode && this.pasteData) {
            this.flipData(this.pasteData, 'h');
            this.render();
            return;
        }
        if (this.isFloating && this.floatingData) {
            const data = { tiles: this.floatingData, entities: this.floatingEntities };
            this.flipData(data, 'h');
            this.floatingData = data.tiles;
            this.floatingEntities = data.entities;
            this.render();
            return;
        }
        if (this.selectionStart && this.selectionEnd) {
            this.saveToHistory();
            const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);
            const w = x2 - x1 + 1;
            const h = y2 - y1 + 1;

            const tiles = [];
            for (let y = y1; y <= y2; y++) {
                tiles.push([...App.projectData.stage.layers.fg[y].slice(x1, x1 + w)]);
            }
            const entities = [];
            if (App.projectData.stage.entities) {
                App.projectData.stage.entities.forEach(e => {
                    if (e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2) {
                        entities.push({ ...e, relX: e.x - x1, relY: e.y - y1 });
                    }
                });
                App.projectData.stage.entities = App.projectData.stage.entities.filter(e => 
                    !(e.x >= x1 && e.x <= x2 && e.y >= y1 && e.y <= y2)
                );
            }

            const data = { tiles, entities };
            this.flipData(data, 'h');

            for (let dy = 0; dy < data.tiles.length; dy++) {
                for (let dx = 0; dx < data.tiles[0].length; dx++) {
                    App.projectData.stage.layers.fg[y1 + dy][x1 + dx] = data.tiles[dy][dx];
                }
            }
            data.entities.forEach(e => {
                App.projectData.stage.entities.push({ ...e, x: x1 + e.relX, y: y1 + e.relY });
            });

            this.render();
            return;
        }
    },

    processPixel(e) {
        if (App.currentScreen !== 'stage') return;

        // 繧､繝吶Φ繝医°繧峨け繝ｩ繧､繧｢繝ｳ繝亥ｺｧ讓吶ｒ蜿門ｾ暦ｼ・ndefined蟇ｾ遲厄ｼ・
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        if (clientX === undefined || clientY === undefined) return;

        const { x, y } = this.getTileFromEvent(e);

        // 蠎ｧ讓吶′NaN縺ｮ蝣ｴ蜷医・蜃ｦ逅・＠縺ｪ縺・
        if (isNaN(x) || isNaN(y)) return;

        const stage = App.projectData.stage;
        if (x < 0 || x >= stage.width || y < 0 || y >= stage.height) return;

        const layer = stage.layers[this.currentLayer];

        // 驕ｸ謚樔ｸｭ縺ｮ繝・Φ繝励Ξ繝ｼ繝医・繧ｹ繝励Λ繧､繝医し繧､繧ｺ繧貞叙蠕・
        // 繧ｨ繝ｳ繝・ぅ繝・ぅ驟榊・縺ｮ遒ｺ菫・
        if (!stage.entities) stage.entities = [];

        // テンプレート取得ヘルパー
        const getTemplate = (idx) => {
            return (App.projectData.templates && App.projectData.templates[idx]) || null;
        };

        // スプライトサイズ取得
        const getTemplateSize = (templateIdx) => this.getTemplateSize(templateIdx);

        switch (this.currentTool) {
            case 'pen':
                if (this.selectedTemplate !== null) {
                    const tmpl = getTemplate(this.selectedTemplate);
                    const spriteSize = getTemplateSize(this.selectedTemplate);

                    // 繧ｨ繝ｳ繝・ぅ繝・ぅ繧ｿ繧､繝励・蝣ｴ蜷茨ｼ・ntities驟榊・縺ｸ霑ｽ蜉・・
                    if (tmpl && ['player', 'enemy', 'item'].includes(tmpl.type)) {
                        // 譌｢蟄倥・蜷悟ｺｧ讓吶お繝ｳ繝・ぅ繝・ぅ繧貞炎髯､・井ｸ頑嶌縺搾ｼ・
                        // 32x32縺ｮ蝣ｴ蜷医・2x2鬆伜沺縺ｮ驥崎､・ｒ閠・・縺吶∋縺阪□縺後√す繝ｳ繝励Ν縺ｫ蜴溽せ荳閾ｴ縺ｧ蛻､螳・
                        // 縺ｾ縺溘・縲後◎縺ｮ蠎ｧ讓吶↓縺ゅｋ繧ゅ・縲阪ｒ豸医☆
                        const removeIdx = stage.entities.findIndex(e => {
                            // 蜷後§蠎ｧ讓吶↓縺ゅｋ繧ｨ繝ｳ繝・ぅ繝・ぅ繧呈爾縺・
                            // 蜴ｳ蟇・↓縺ｯ遏ｩ蠖｢蛻､螳壹☆縺ｹ縺阪□縺後√お繝・ぅ繧ｿ謫堺ｽ懊→縺励※縺ｯ蜴溽せ繧ｯ繝ｪ繝・け縺ｧ荳頑嶌縺阪′閾ｪ辟ｶ
                            return e.x === x && e.y === y;
                        });
                        if (removeIdx >= 0) {
                            stage.entities.splice(removeIdx, 1);
                        }

                        // 譁ｰ隕剰ｿｽ蜉
                        stage.entities.push({
                            x: x,
                            y: y,
                            templateId: this.selectedTemplate
                        });

                        // 繝槭ャ繝励ち繧､繝ｫ縺ｮ譖ｸ縺崎ｾｼ縺ｿ縺ｯ繧ｹ繧ｭ繝・・・郁レ譎ｯ邯ｭ謖・ｼ・
                    } else {
                        // 騾壼ｸｸ繧ｿ繧､繝ｫ・・ap驟榊・縺ｸ譖ｸ縺崎ｾｼ縺ｿ・・
                        const tileValue = this.selectedTemplate + 100;

                        if (spriteSize === 2) {
                            // 32x32繧ｹ繝励Λ繧､繝・
                            const snapX = Math.floor(x / 2) * 2;
                            const snapY = Math.floor(y / 2) * 2;

                            for (let dy = 0; dy < 2; dy++) {
                                for (let dx = 0; dx < 2; dx++) {
                                    const tx = snapX + dx;
                                    const ty = snapY + dy;
                                    if (tx >= 0 && tx < stage.width && ty >= 0 && ty < stage.height) {
                                        if (dx === 0 && dy === 0) {
                                            layer[ty][tx] = tileValue;
                                        } else {
                                            layer[ty][tx] = -1000 - (dy * 2 + dx);
                                        }
                                    }
                                }
                            }
                        } else {
                            // 16x16繧ｹ繝励Λ繧､繝・
                            layer[y][x] = tileValue;
                        }
                    }
                }
                break;

            case 'eraser':
                // 縺ｾ縺壹お繝ｳ繝・ぅ繝・ぅ繧貞炎髯､
                let entityDeleted = false;
                for (let i = stage.entities.length - 1; i >= 0; i--) {
                    const e = stage.entities[i];
                    // 繧ｨ繝ｳ繝・ぅ繝・ぅ縺ｮ蜊譛蛾伜沺繧定ｨ育ｮ・
                    const tmpl = getTemplate(e.templateId);
                    const size = getTemplateSize(e.templateId);
                    const w = (size === 2) ? 2 : 1;
                    const h = (size === 2) ? 2 : 1;

                    // 繧ｯ繝ｪ繝・け蠎ｧ讓吶′繧ｨ繝ｳ繝・ぅ繝・ぅ蜀・↓縺ゅｋ縺・
                    if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) {
                        stage.entities.splice(i, 1);
                        entityDeleted = true;
                        // 驥阪↑縺｣縺ｦ縺・ｋ蝣ｴ蜷医☆縺ｹ縺ｦ豸医☆縺九∽ｸ逡ｪ荳翫□縺第ｶ医☆縺九ゅ％縺薙〒縺ｯ蜈ｨ縺ｦ豸医☆縲・
                    }
                }

                // 繧ｨ繝ｳ繝・ぅ繝・ぅ縺悟炎髯､縺輔ｌ縺溷ｴ蜷医√・繝・・繧ｿ繧､繝ｫ縺ｯ豸医＆縺ｪ縺・ｼ郁ｪ､謫堺ｽ憺亟豁｢・・
                // 縺溘□縺励√Θ繝ｼ繧ｶ繝ｼ縺梧・遉ｺ逧・↓閭梧勹繧よｶ医＠縺溘＞蝣ｴ蜷医・蜀阪け繝ｪ繝・け縺悟ｿ・ｦ・
                if (entityDeleted) break;

                // 繝槭ャ繝励ち繧､繝ｫ縺ｮ蜑企勁蜃ｦ逅・ｼ域里蟄倥Ο繧ｸ繝・け・・
                const currentTile = layer[y][x];
                if (currentTile <= -1000) {
                    const offset = -(currentTile + 1000);
                    const dx = offset % 2;
                    const dy = Math.floor(offset / 2);
                    const originX = x - dx;
                    const originY = y - dy;
                    for (let iy = 0; iy < 2; iy++) {
                        for (let ix = 0; ix < 2; ix++) {
                            const tx = originX + ix;
                            const ty = originY + iy;
                            if (tx >= 0 && tx < stage.width && ty >= 0 && ty < stage.height) {
                                layer[ty][tx] = -1;
                            }
                        }
                    }
                } else if (currentTile >= 100) {
                    const templateIdx = currentTile - 100;
                    const spriteSize = getTemplateSize(templateIdx);
                    if (spriteSize === 2) {
                        for (let iy = 0; iy < 2; iy++) {
                            for (let ix = 0; ix < 2; ix++) {
                                const tx = x + ix;
                                const ty = y + iy;
                                if (tx >= 0 && tx < stage.width && ty >= 0 && ty < stage.height) {
                                    layer[ty][tx] = -1;
                                }
                            }
                        }
                    } else {
                        layer[y][x] = -1;
                    }
                } else {
                    layer[y][x] = -1;
                }
                break;

            case 'fill':
                if (this.selectedTemplate !== null) {
                    const tmpl = getTemplate(this.selectedTemplate);
                    // 繧ｨ繝ｳ繝・ぅ繝・ぅ縺ｮ蝪励ｊ縺､縺ｶ縺励・繧ｵ繝昴・繝医＠縺ｪ縺・ｼ医・繝・・縺ｮ縺ｿ・・
                    if (tmpl && ['player', 'enemy', 'item'].includes(tmpl.type)) {
                        alert('繧ｭ繝｣繝ｩ繧ｯ繧ｿ繝ｼ繧・い繧､繝・Β縺ｧ蝪励ｊ縺､縺ｶ縺励・縺ｧ縺阪∪縺帙ｓ');
                        return;
                    }

                    const newValue = this.selectedTemplate + 100;
                    this.floodFill(x, y, layer[y][x], newValue);
                }
                break;

            case 'eyedropper':
                // 譛蜑埼擇・医お繝ｳ繝・ぅ繝・ぅ・峨ｒ蜆ｪ蜈亥叙蠕・
                let foundEntity = null;
                for (const e of stage.entities) {
                    const tmpl = getTemplate(e.templateId);
                    const size = getTemplateSize(e.templateId);
                    const w = (size === 2) ? 2 : 1;
                    const h = (size === 2) ? 2 : 1;
                    if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) {
                        foundEntity = e;
                        break; // 譛蛻昴↓隕九▽縺九▲縺溘ｂ縺ｮ繧呈治逕ｨ
                    }
                }

                if (foundEntity) {
                    this.selectedTemplate = foundEntity.templateId;
                    this.initTemplateList();
                    // 繝・・繝ｫ繧偵・繝ｳ縺ｫ謌ｻ縺・
                    this.currentTool = 'pen';
                    // 繝・・繝ｫ繝舌・縺ｮ隕九◆逶ｮ譖ｴ譁ｰ縺ｯ逵∫払・亥・謠冗判縺ｧ蜿肴丐縺輔ｌ繧九°隕∫｢ｺ隱搾ｼ・
                } else {
                    // 繝槭ャ繝励ち繧､繝ｫ縺九ｉ蜿門ｾ・
                    const tileId = layer[y][x];
                    if (tileId >= 100) {
                        const templateIdx = tileId - 100;
                        if (templateIdx >= 0 && templateIdx < this.templates.length) {
                            this.selectedTemplate = templateIdx;
                            this.initTemplateList();
                            this.currentTool = 'pen';
                        }
                    } else if (tileId >= 0) {
                        const idx = this.templates.findIndex(t =>
                            (t.sprites?.idle?.frames?.[0] === tileId) || (t.sprites?.main?.frames?.[0] === tileId)
                        );
                        if (idx >= 0) {
                            this.selectedTemplate = idx;
                            this.initTemplateList();
                            this.currentTool = 'pen';
                        }
                    }
                }
                break;
        }

        this.render();
    },

    floodFill(startX, startY, targetValue, newValue) {
        if (targetValue === newValue) return;

        const stage = App.projectData.stage;
        const layer = stage.layers[this.currentLayer];
        const stack = [[startX, startY]];

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= stage.width || y < 0 || y >= stage.height) continue;
            if (layer[y][x] !== targetValue) continue;

            layer[y][x] = newValue;
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
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

    render() {
        if (!this.canvas || !this.ctx) return;
        if (App.currentScreen !== 'stage') return;

        // 背景色
        this.ctx.fillStyle = this.getBackgroundColor();
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // FGレイヤーのみ描画
        this.renderLayer('fg', 1);

        // エンティティ描画
        this.renderEntities();

        this.renderGrid();
        this.renderSelection();
    },

    renderEntities() {
        const stage = App.projectData.stage;
        if (!stage.entities) return;

        const templates = App.projectData.templates || [];
        const sprites = App.projectData.sprites;
        const palette = App.nesPalette;
        const basePlayerIdx = templates.findIndex(t => t.type === 'player');

        stage.entities.forEach(entity => {
            const template = templates[entity.templateId];
            if (!template) return;

            // 変身プレイヤー: 変身アイテムのスプライトを表示
            let spriteIdx;
            if (template.type === 'player' && basePlayerIdx >= 0 && entity.templateId !== basePlayerIdx) {
                spriteIdx = template.sprites?.transformItem?.frames?.[0]
                    ?? template.sprites?.idle?.frames?.[0]
                    ?? template.sprites?.main?.frames?.[0];
            } else {
                spriteIdx = template.sprites?.idle?.frames?.[0] ?? template.sprites?.main?.frames?.[0];
            }
            const sprite = sprites[spriteIdx];
            if (sprite) {
                // 謨ｵ縺ｯ蟾ｦ蜷代″縺ｫ蜿崎ｻ｢縺励※謠冗判
                const flipX = template.type === 'enemy';
                this.renderSprite(sprite, entity.x, entity.y, palette, flipX);
            }
        });
    },

    renderLayer(layerName, alpha) {
        const stage = App.projectData.stage;
        const layer = stage.layers[layerName];
        const sprites = App.projectData.sprites;
        const templates = App.projectData.templates || [];
        const palette = App.nesPalette;
        const basePlayerIdx = templates.findIndex(t => t.type === 'player');

        this.ctx.globalAlpha = alpha;

        for (let y = 0; y < stage.height; y++) {
            for (let x = 0; x < stage.width; x++) {
                const tileId = layer[y][x];

                // 2x2繝槭・繧ｫ繝ｼ繧ｿ繧､繝ｫ縺ｯ繧ｹ繧ｭ繝・・・亥ｷｦ荳翫ち繧､繝ｫ縺ｮ縺ｿ謠冗判・・
                if (tileId <= -1000) continue;

                let sprite;
                if (tileId >= 100) {
                    const template = templates[tileId - 100];
                    const templateIdx = tileId - 100;
                    let spriteIdx;
                    if (template?.type === 'player' && basePlayerIdx >= 0 && templateIdx !== basePlayerIdx) {
                        spriteIdx = template?.sprites?.transformItem?.frames?.[0]
                            ?? template?.sprites?.idle?.frames?.[0]
                            ?? template?.sprites?.main?.frames?.[0];
                    } else {
                        spriteIdx = template?.sprites?.idle?.frames?.[0] ?? template?.sprites?.main?.frames?.[0];
                    }
                    sprite = sprites[spriteIdx];
                } else if (tileId >= 0 && tileId < sprites.length) {
                    // 繧ｹ繝励Λ繧､繝・D繝吶・繧ｹ・域立蠖｢蠑擾ｼ・ 莠呈鋤諤ｧ
                    sprite = sprites[tileId];
                }
                if (sprite) {
                    this.renderSprite(sprite, x, y, palette);
                }
            }
        }

        this.ctx.globalAlpha = 1;
    },

    renderSprite(sprite, tileX, tileY, palette, flipX = false, targetCtx = null) {
        const ctx = targetCtx || this.ctx;
        const scrollX = this.canvasScrollX || 0;
        const scrollY = this.canvasScrollY || 0;

        // スプライトサイズを判定
        const spriteSize = sprite.size || 1;
        const dimension = spriteSize === 2 ? 32 : 16;
        const tileCount = spriteSize === 2 ? 2 : 1;  // 占有するタイル数
        const pixelSize = (this.tileSize * tileCount) / dimension;

        for (let y = 0; y < dimension; y++) {
            for (let x = 0; x < dimension; x++) {
                const colorIndex = sprite.data[y]?.[x];
                if (colorIndex >= 0) {
                    ctx.fillStyle = palette[colorIndex];
                    // flipXの場合はX座標を反転
                    const drawX = flipX
                        ? tileX * this.tileSize + (dimension - 1 - x) * pixelSize + scrollX
                        : tileX * this.tileSize + x * pixelSize + scrollX;
                    ctx.fillRect(
                        drawX,
                        tileY * this.tileSize + y * pixelSize + scrollY,
                        pixelSize + 0.5,
                        pixelSize + 0.5
                    );
                }
            }
        }
    },

    renderSpriteToMiniCanvas(sprite, canvas, bgColor = '#3CBCFC') {
        const ctx = canvas.getContext('2d');
        const palette = App.nesPalette;

        // 繧ｹ繝励Λ繧､繝医し繧､繧ｺ繧貞愛螳・
        const spriteSize = sprite.size || 1;
        const dimension = spriteSize === 2 ? 32 : 16;

        // 繧ｭ繝｣繝ｳ繝舌せ繧ｵ繧､繧ｺ繧偵せ繝励Λ繧､繝医し繧､繧ｺ縺ｫ蜷医ｏ縺帙ｋ
        canvas.width = dimension;
        canvas.height = dimension;

        // 閭梧勹濶ｲ繧呈緒逕ｻ・亥虚逧・↓險ｭ螳壼庄閭ｽ・・
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, dimension, dimension);

        // 繧ｹ繧ｱ繝ｼ繝ｫ菫よ焚・・:1縺ｧ謠冗判・・
        const scale = 1;

        for (let y = 0; y < dimension; y++) {
            for (let x = 0; x < dimension; x++) {
                const colorIndex = sprite.data[y]?.[x];
                if (colorIndex >= 0) {
                    ctx.fillStyle = palette[colorIndex];
                    ctx.fillRect(
                        x * scale,
                        y * scale,
                        scale + 0.1,
                        scale + 0.1
                    );
                }
            }
        }
    },

    renderGrid() {
        const stage = App.projectData.stage;
        const scrollX = this.canvasScrollX || 0;
        const scrollY = this.canvasScrollY || 0;

        // 騾壼ｸｸ縺ｮ繧ｰ繝ｪ繝・ラ邱夲ｼ郁埋繧・ｼ・
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 0.5;

        for (let x = 0; x <= stage.width; x++) {
            const px = x * this.tileSize + scrollX;
            if (px >= 0 && px <= this.canvas.width) {
                this.ctx.beginPath();
                this.ctx.moveTo(px, 0);
                this.ctx.lineTo(px, this.canvas.height);
                this.ctx.stroke();
            }
        }

        for (let y = 0; y <= stage.height; y++) {
            const py = y * this.tileSize + scrollY;
            if (py >= 0 && py <= this.canvas.height) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, py);
                this.ctx.lineTo(this.canvas.width, py);
                this.ctx.stroke();
            }
        }

        // 16繧ｿ繧､繝ｫ豈弱・繧ｬ繧､繝臥ｷ夲ｼ郁ｦ九ｄ縺吶＞襍､邱夲ｼ・
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.lineWidth = 2;

        for (let x = 16; x < stage.width; x += 16) {
            const px = x * this.tileSize + scrollX;
            if (px >= 0 && px <= this.canvas.width) {
                this.ctx.beginPath();
                this.ctx.moveTo(px, 0);
                this.ctx.lineTo(px, this.canvas.height);
                this.ctx.stroke();
            }
        }

        for (let y = 16; y < stage.height; y += 16) {
            const py = y * this.tileSize + scrollY;
            if (py >= 0 && py <= this.canvas.height) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, py);
                this.ctx.lineTo(this.canvas.width, py);
                this.ctx.stroke();
            }
        }
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

    // ========== 繧ｹ繝・・繧ｸ險ｭ螳壹ヱ繝阪Ν ==========
    initStageSettings() {
        const panel = document.getElementById('stage-settings-panel');
        const header = document.getElementById('stage-settings-header');
        if (!panel || !header) return;

        // 繝代ロ繝ｫ蜀・・繧ｯ繝ｪ繝・け/繧ｿ繝・メ繧､繝吶Φ繝医′繧ｭ繝｣繝ｳ繝舌せ縺ｫ莨晄眺縺励↑縺・ｈ縺・↓
        panel.addEventListener('click', (e) => e.stopPropagation());
        panel.addEventListener('touchstart', (e) => e.stopPropagation());
        panel.addEventListener('touchend', (e) => e.stopPropagation());

        // 謚倥ｊ縺溘◆縺ｿ・亥・譛溽憾諷九・髢九＞縺ｦ縺・ｋ・・
        header.addEventListener('click', () => {
            const wasCollapsed = panel.classList.contains('collapsed');
            panel.classList.toggle('collapsed');

            // 繝代ロ繝ｫ繧帝幕縺乗凾縺ｫpendingArea蛟､繧堤樟蝨ｨ縺ｮ繧ｹ繝・・繧ｸ繧ｵ繧､繧ｺ縺九ｉ蜀榊・譛溷喧
            if (wasCollapsed) {
                this.pendingAreaW = Math.floor(App.projectData.stage.width / 16);
                this.pendingAreaH = Math.floor(App.projectData.stage.height / 16);
                this.updateStageSettingsUI();
            }
        });

        // 荳譎ら噪縺ｪ繧ｵ繧､繧ｺ蛟､・井ｿ晏ｭ倥・繧ｿ繝ｳ謚ｼ荳九∪縺ｧ蜿肴丐縺励↑縺・ｼ・
        this.pendingAreaW = Math.floor(App.projectData.stage.width / 16);
        this.pendingAreaH = Math.floor(App.projectData.stage.height / 16);

        // UI隕∫ｴ蜿門ｾ・
        const areaWValue = document.getElementById('area-w-value');
        const areaHValue = document.getElementById('area-h-value');
        const areaWMinus = document.getElementById('area-w-minus');
        const areaWPlus = document.getElementById('area-w-plus');
        const areaHMinus = document.getElementById('area-h-minus');
        const areaHPlus = document.getElementById('area-h-plus');
        const bgColorSwatch = document.getElementById('stage-bg-color');
        const saveBtn = document.getElementById('stage-settings-save');
        const copyEditKeyBtn = document.getElementById('copy-editkey-btn');

        // エディットキーをコピー
        if (copyEditKeyBtn) {
            copyEditKeyBtn.addEventListener('click', async () => {
                const editKeyDisplay = document.getElementById('stage-editkey-display');
                if (editKeyDisplay && editKeyDisplay.value) {
                    try {
                        await navigator.clipboard.writeText(editKeyDisplay.value);
                        if (App && typeof App.showToast === 'function') {
                            App.showToast('エディットキーを コピーしました');
                        }
                    } catch (err) {
                        console.error('Failed to copy: ', err);
                        // フォールバック
                        editKeyDisplay.select();
                        document.execCommand('copy');
                        if (App && typeof App.showToast === 'function') {
                            App.showToast('エディットキーを コピーしました');
                        }
                    }
                }
            });
        }

        // 現在の値を反映
        this.updateStageSettingsUI();

        // 名前は保存ボタン押下時のみ反映（リアルタイム保存しない）
        // イベントリスナーは不要

        // 繧ｨ繝ｪ繧｢繧ｵ繧､繧ｺ螟画峩・・I陦ｨ遉ｺ縺ｮ縺ｿ縲∽ｿ晏ｭ倥・繧ｿ繝ｳ縺ｧ蜿肴丐・・
        if (areaWMinus) {
            areaWMinus.addEventListener('click', () => {
                if (this.pendingAreaW > 1) {
                    this.pendingAreaW--;
                    if (areaWValue) areaWValue.textContent = this.pendingAreaW;
                }
            });
        }
        if (areaWPlus) {
            areaWPlus.addEventListener('click', () => {
                if (this.pendingAreaW < 10) {
                    this.pendingAreaW++;
                    if (areaWValue) areaWValue.textContent = this.pendingAreaW;
                }
            });
        }
        if (areaHMinus) {
            areaHMinus.addEventListener('click', () => {
                if (this.pendingAreaH > 1) {
                    this.pendingAreaH--;
                    if (areaHValue) areaHValue.textContent = this.pendingAreaH;
                }
            });
        }
        if (areaHPlus) {
            areaHPlus.addEventListener('click', () => {
                if (this.pendingAreaH < 10) {
                    this.pendingAreaH++;
                    if (areaHValue) areaHValue.textContent = this.pendingAreaH;
                }
            });
        }

        // 閭梧勹濶ｲ・医せ繝励Λ繧､繝医お繝・ぅ繧ｿ縺ｮ繧ｫ繝ｩ繝ｼ繝斐ャ繧ｫ繝ｼ繧剃ｽｿ逕ｨ・・
        if (bgColorSwatch) {
            bgColorSwatch.addEventListener('click', () => {
                this.openBgColorPicker();
            });
        }

        // 騾乗・濶ｲ
        const transparentSelect = document.getElementById('stage-transparent-index');
        if (transparentSelect) {
            transparentSelect.addEventListener('change', () => {
                App.projectData.stage.transparentIndex = parseInt(transparentSelect.value);
            });
        }

        // BGM選択ボタン
        this.selectedBgmType = null;
        const bgmButtons = document.querySelectorAll('.bgm-select-btn');
        bgmButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedBgmType = btn.dataset.bgmType;
                this.openBgmSelectPopup();
            });
        });

        // BGMポップアップ背景クリックで閉じる
        const bgmPopup = document.getElementById('bgm-select-popup');
        if (bgmPopup) {
            bgmPopup.addEventListener('click', (e) => {
                if (e.target === bgmPopup) {
                    bgmPopup.classList.add('hidden');
                    this.stopBgmPreview();
                }
            });
        }

        // 繧ｯ繝ｪ繧｢譚｡莉ｶ
        const clearCondition = document.getElementById('stage-clear-condition');
        const timeLimitRow = document.getElementById('time-limit-row');
        const timeLimitLabel = document.getElementById('time-limit-label');

        const updateTimeLimitLabel = () => {
            const condition = clearCondition?.value || 'none';
            if (condition === 'survival') {
                if (timeLimitLabel) timeLimitLabel.textContent = 'サバイバル時間';
                if (timeLimitRow) timeLimitRow.style.display = '';
            } else {
                if (timeLimitLabel) timeLimitLabel.textContent = '制限時間';
                // 他の条件でも制限時間を表示する（なしなら無制限）
                if (timeLimitRow) timeLimitRow.style.display = '';
            }
        };

        if (clearCondition) {
            clearCondition.addEventListener('change', () => {
                App.projectData.stage.clearCondition = clearCondition.value;
                updateTimeLimitLabel();
            });
        }

        // 蛻ｶ髯先凾髢難ｼ亥・遘貞ｽ｢蠑擾ｼ・
        const timeMin = document.getElementById('stage-time-min');
        const timeSec = document.getElementById('stage-time-sec');

        // 蜈･蜉帙ヵ繧｣繝ｼ繝ｫ繝峨・繧､繝吶Φ繝井ｼ晄眺繧呈ｭ｢繧√ｋ
        [timeMin, timeSec].forEach(input => {
            if (input) {
                input.addEventListener('click', (e) => e.stopPropagation());
                input.addEventListener('touchstart', (e) => e.stopPropagation());
                input.addEventListener('touchend', (e) => e.stopPropagation());
                input.addEventListener('focus', (e) => e.stopPropagation());
            }
        });

        if (timeMin) {
            timeMin.addEventListener('change', (e) => {
                e.stopPropagation();
                const min = parseInt(timeMin.value) || 0;
                const sec = parseInt(timeSec?.value) || 0;
                App.projectData.stage.timeLimit = min * 60 + sec;
            });
        }
        if (timeSec) {
            timeSec.addEventListener('change', (e) => {
                e.stopPropagation();
                const min = parseInt(timeMin?.value) || 0;
                const sec = parseInt(timeSec.value) || 0;
                App.projectData.stage.timeLimit = min * 60 + sec;
            });
        }

        // 菫晏ｭ倥・繧ｿ繝ｳ
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                // 繧ｿ繧､繝医Ν菫晏ｭ・
                const nameInput = document.getElementById('stage-name-input');
                if (nameInput) {
                    App.projectData.stage.name = nameInput.value;
                    // 繧ｲ繝ｼ繝逕ｻ髱｢繧ｿ繧､繝医Ν縺ｨ騾｣蜍・
                    if (App.projectData.meta) {
                        App.projectData.meta.name = nameInput.value || 'NEW GAME';
                    }
                }

                const authorInput = document.getElementById('stage-author-input');
                if (authorInput && App.projectData.meta) {
                    App.projectData.meta.author = authorInput.value || 'You';
                }

                // 繧ｵ繧､繧ｺ螟画峩
                const newWidth = this.pendingAreaW * 16;
                const newHeight = this.pendingAreaH * 16;
                if (newWidth !== App.projectData.stage.width || newHeight !== App.projectData.stage.height) {
                    this.resizeStage(newWidth, newHeight);
                }

                // 繧ｹ繧ｳ繧｢陦ｨ遉ｺ險ｭ螳・
                const showScoreCheck = document.getElementById('stage-show-score');
                if (showScoreCheck) {
                    App.projectData.stage.showScore = showScoreCheck.checked;
                }

                // 險ｭ螳壹ヱ繝阪Ν繧帝哩縺倥ｋ
                App.updateGameInfo();
                panel.classList.add('collapsed');
            });
        }
    },

    updateStageSettingsUI(preserveFormState = false) {
        const stage = App.projectData.stage;

        const nameInput = document.getElementById('stage-name-input');
        const areaWValue = document.getElementById('area-w-value');
        const areaHValue = document.getElementById('area-h-value');
        const bgColorSwatch = document.getElementById('stage-bg-color');
        const transparentSelect = document.getElementById('stage-transparent-index');
        const timeMin = document.getElementById('stage-time-min');
        const timeSec = document.getElementById('stage-time-sec');
        const authorInput = document.getElementById('stage-author-input');

        // 入力欄の現在値を projectData に反映（背景色変更時など他設定の更新で上書きされないように）
        if (preserveFormState) {
            if (nameInput) {
                stage.name = nameInput.value;
                if (App.projectData.meta) App.projectData.meta.name = nameInput.value || 'NEW GAME';
            }
            if (authorInput && App.projectData.meta) {
                App.projectData.meta.author = authorInput.value || 'You';
            }
        }

        // ステージタイトル・作成者名の表示
        if (nameInput) nameInput.value = stage.name || App.projectData.meta?.name || 'NEW GAME';
        if (authorInput) authorInput.value = App.projectData.meta?.author || 'You';

        // エディットキー表示
        const editKeyDisplay = document.getElementById('stage-editkey-display');
        if (editKeyDisplay) editKeyDisplay.value = App.projectData.meta?.editKey || '';

        // ステージサイズ（preserveFormState時は現在のUI値を保持）
        if (!preserveFormState) {
            this.pendingAreaW = Math.floor(stage.width / 16);
            this.pendingAreaH = Math.floor(stage.height / 16);
        }
        if (areaWValue) areaWValue.textContent = this.pendingAreaW;
        if (areaHValue) areaHValue.textContent = this.pendingAreaH;

        // 閭梧勹濶ｲ
        if (bgColorSwatch) bgColorSwatch.style.backgroundColor = stage.bgColor || '#3CBCFC';

        // 騾乗・濶ｲ
        if (transparentSelect) transparentSelect.value = stage.transparentIndex || 0;

        // 繧ｯ繝ｪ繧｢譚｡莉ｶ
        const clearConditionEl = document.getElementById('stage-clear-condition');
        const timeLimitLabel = document.getElementById('time-limit-label');
        if (clearConditionEl) {
            clearConditionEl.value = stage.clearCondition || 'none';
            // 繝ｩ繝吶Ν譖ｴ譁ｰ
            if (stage.clearCondition === 'survival') {
                if (timeLimitLabel) timeLimitLabel.textContent = 'サバイバル時間';
            } else {
                if (timeLimitLabel) timeLimitLabel.textContent = '制限時間';
            }
        }

        // スコア表示（preserveFormState時は現在のチェック状態を保持）
        const showScoreCheck = document.getElementById('stage-show-score');
        if (showScoreCheck && !preserveFormState) {
            showScoreCheck.checked = stage.showScore !== false;
        }

        // 蛻ｶ髯先凾髢難ｼ亥・遘抵ｼ・
        const totalSec = stage.timeLimit || 0;
        if (timeSec) timeSec.value = totalSec % 60;

        // BGMボタン表示を更新
        this.updateBgmSelects();
    },

    updateBgmSelects() {
        const bgmTypes = ['stage', 'invincible', 'clear', 'gameover', 'boss'];
        const songs = (typeof SoundEditor !== 'undefined' && SoundEditor.songs) ? SoundEditor.songs : [];
        const bgm = App.projectData.stage?.bgm || {};

        bgmTypes.forEach(type => {
            const btn = document.getElementById(`bgm-${type}-btn`);
            if (!btn) return;

            const value = bgm[type];
            if (value === '' || value === undefined || value === null) {
                btn.textContent = 'なし';
            } else {
                const idx = parseInt(value);
                const song = songs[idx];
                btn.textContent = song?.name || `Song ${idx + 1}`;
            }
        });
    },

    resizeStage(newWidth, newHeight) {
        const stage = App.projectData.stage;
        const oldWidth = stage.width;
        const oldHeight = stage.height;

        // 譁ｰ縺励＞繝ｬ繧､繝､繝ｼ驟榊・繧剃ｽ懈・
        const newFg = App.create2DArray(newWidth, newHeight, -1);
        const newBg = App.create2DArray(newWidth, newHeight, -1);
        const newCollision = App.create2DArray(newWidth, newHeight, 0);

        // 邵ｦ・・縺ｯ荳翫↓霑ｽ蜉・域里蟄倥ョ繝ｼ繧ｿ縺ｯ荳九↓繧ｷ繝輔ヨ・峨・縺ｯ荳翫°繧牙炎髯､
        // 讓ｪ・・縺ｯ蜿ｳ縺ｫ霑ｽ蜉縲・縺ｯ蜿ｳ縺九ｉ蜑企勁
        const heightDiff = newHeight - oldHeight;
        const yOffset = heightDiff > 0 ? heightDiff : 0; // 諡｡螟ｧ譎ゅ・邵ｦ繧ｪ繝輔そ繝・ヨ
        const srcYStart = heightDiff < 0 ? -heightDiff : 0; // 邵ｮ蟆乗凾縺ｮ繧ｽ繝ｼ繧ｹ髢句ｧ玖｡・

        // 譌｢蟄倥ョ繝ｼ繧ｿ繧偵さ繝斐・・井ｸ翫↓霑ｽ蜉/荳翫°繧牙炎髯､蟇ｾ蠢懶ｼ・
        for (let srcY = srcYStart; srcY < oldHeight; srcY++) {
            const dstY = srcY - srcYStart + yOffset;
            if (dstY >= newHeight) break;

            for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
                if (stage.layers.fg[srcY] && stage.layers.fg[srcY][x] !== undefined) {
                    newFg[dstY][x] = stage.layers.fg[srcY][x];
                }
                if (stage.layers.bg[srcY] && stage.layers.bg[srcY][x] !== undefined) {
                    newBg[dstY][x] = stage.layers.bg[srcY][x];
                }
                if (stage.layers.collision[srcY] && stage.layers.collision[srcY][x] !== undefined) {
                    newCollision[dstY][x] = stage.layers.collision[srcY][x];
                }
            }
        }

        stage.width = newWidth;
        stage.height = newHeight;
        stage.layers.fg = newFg;
        stage.layers.bg = newBg;
        stage.layers.collision = newCollision;

        // エンティティのY座標もシフト（レイヤーと同じオフセットを適用）
        if (stage.entities && Array.isArray(stage.entities) && heightDiff !== 0) {
            stage.entities.forEach(e => {
                e.y += heightDiff;
            });
            // 縮小時に範囲外になったエンティティを削除
            if (heightDiff < 0) {
                stage.entities = stage.entities.filter(e =>
                    e.y >= 0 && e.y < newHeight && e.x >= 0 && e.x < newWidth
                );
            }
        }
        // 横縮小時に範囲外のエンティティを削除
        if (newWidth < oldWidth && stage.entities) {
            stage.entities = stage.entities.filter(e => e.x >= 0 && e.x < newWidth);
        }

        // 繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ菴咲ｽｮ繧貞ｷｦ荳九°繧芽｡ｨ遉ｺ縺吶ｋ繧医≧縺ｫ險ｭ螳・
        // 邵ｦ・・・会ｼ壹せ繝・・繧ｸ縺ｮ荳狗ｫｯ縺後く繝｣繝ｳ繝舌せ荳狗ｫｯ縺ｫ譚･繧九ｈ縺・↓
        this.canvasScrollX = 0;
        const canvasHeight = 320; // 繧ｭ繝｣繝ｳ繝舌せ縺ｮ鬮倥＆・亥崋螳夲ｼ・
        const stagePixelHeight = newHeight * this.tileSize;
        this.canvasScrollY = stagePixelHeight > canvasHeight ? -(stagePixelHeight - canvasHeight) : 0;

        this.resize();
        this.render();
    },

    openBgColorPicker() {
        const currentColor = App.projectData.stage.bgColor || '#3CBCFC';

        // 状態
        let hue = 0, saturation = 100, brightness = 100;
        let r = 255, g = 0, b = 0;

        // カラー変換関数
        const hsvToRgb = (h, s, v) => {
            s /= 100; v /= 100;
            const c = v * s;
            const x = c * (1 - Math.abs((h / 60) % 2 - 1));
            const m = v - c;
            let r1, g1, b1;
            if (h < 60) { r1 = c; g1 = x; b1 = 0; }
            else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
            else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
            else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
            else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
            else { r1 = c; g1 = 0; b1 = x; }
            return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
        };

        const rgbToHsv = (r, g, b) => {
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const d = max - min;
            let h = 0;
            if (d !== 0) {
                if (max === r) h = ((g - b) / d) % 6;
                else if (max === g) h = (b - r) / d + 2;
                else h = (r - g) / d + 4;
                h *= 60; if (h < 0) h += 360;
            }
            return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
        };

        const rgbToHex = (r, g, b) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();

        const hexToRgb = (hex) => {
            hex = hex.replace('#', '');
            return { r: parseInt(hex.substr(0, 2), 16), g: parseInt(hex.substr(2, 2), 16), b: parseInt(hex.substr(4, 2), 16) };
        };

        // 初期値をcurrentColorから設定
        const initRgb = hexToRgb(currentColor);
        r = initRgb.r; g = initRgb.g; b = initRgb.b;
        const initHsv = rgbToHsv(r, g, b);
        hue = initHsv.h; saturation = initHsv.s; brightness = initHsv.v;

        // bodyスクロール無効化
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // モーダルオーバーレイ
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;touch-action:none;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#2d2d44;padding:20px;border-radius:16px;width:90%;max-width:320px;box-shadow:0 10px 40px rgba(0,0,0,0.4);';

        modal.innerHTML = `
            <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:16px;text-align:center;">背景色</div>
            <div style="display:flex;gap:12px;margin-bottom:16px;">
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">現在</div>
                    <div id="cp-current" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${currentColor};"></div>
                </div>
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">編集中</div>
                    <div id="cp-new" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${currentColor};"></div>
                </div>
            </div>
            <div style="display:flex;gap:4px;margin-bottom:12px;background:#1a1a2e;padding:4px;border-radius:8px;">
                <button id="cp-tab-hsv" style="flex:1;padding:8px;border:none;background:#4a4a6a;color:#fff;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;">HSV</button>
                <button id="cp-tab-rgb" style="flex:1;padding:8px;border:none;background:transparent;color:#8888aa;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;">RGB</button>
            </div>
            <div id="cp-picker-area" style="height:200px;position:relative;margin-bottom:12px;">
                <div id="cp-hsv" style="position:absolute;top:0;left:0;right:0;bottom:0;">
                    <div id="cp-sb-box" style="position:relative;width:100%;height:160px;border-radius:8px;cursor:crosshair;margin-bottom:12px;overflow:hidden;background:#ff0000;">
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to right,#fff,transparent);"></div>
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,transparent,#000);"></div>
                        <div id="cp-sb-cursor" style="position:absolute;width:16px;height:16px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;z-index:10;transform:translate(-50%,-50%);left:100%;top:0%;"></div>
                    </div>
                    <div id="cp-hue-slider" style="position:relative;height:24px;border-radius:12px;background:linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000);cursor:pointer;">
                        <div id="cp-hue-cursor" style="position:absolute;top:50%;width:8px;height:28px;background:#fff;border-radius:4px;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;transform:translate(-50%,-50%);left:0%;"></div>
                    </div>
                </div>
                <div id="cp-rgb" style="position:absolute;top:0;left:0;right:0;bottom:0;display:none;flex-direction:column;justify-content:center;gap:20px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="color:#ff6b6b;font-size:14px;font-weight:600;width:24px;">R</span>
                        <input type="range" id="cp-slider-r" min="0" max="255" value="${r}" style="flex:1;height:28px;border-radius:14px;-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:linear-gradient(to right,#000,#ff0000);">
                        <span id="cp-value-r" style="color:#fff;font-size:13px;width:36px;text-align:right;">${r}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="color:#6bff6b;font-size:14px;font-weight:600;width:24px;">G</span>
                        <input type="range" id="cp-slider-g" min="0" max="255" value="${g}" style="flex:1;height:28px;border-radius:14px;-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:linear-gradient(to right,#000,#00ff00);">
                        <span id="cp-value-g" style="color:#fff;font-size:13px;width:36px;text-align:right;">${g}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="color:#6b6bff;font-size:14px;font-weight:600;width:24px;">B</span>
                        <input type="range" id="cp-slider-b" min="0" max="255" value="${b}" style="flex:1;height:28px;border-radius:14px;-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;background:linear-gradient(to right,#000,#0000ff);">
                        <span id="cp-value-b" style="color:#fff;font-size:13px;width:36px;text-align:right;">${b}</span>
                    </div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                <label style="color:#8888aa;font-size:12px;">HEX</label>
                <input type="text" id="cp-hex" value="${currentColor}" maxlength="7" style="flex:1;padding:10px 12px;border:2px solid #444466;border-radius:8px;background:#1a1a2e;color:#fff;font-family:monospace;font-size:14px;text-transform:uppercase;">
            </div>
            <div style="margin-bottom:16px;">
                <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">カラーパレット</div>
                <div id="cp-recent" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
            </div>
            <div style="display:flex;gap:10px;">
                <button id="cp-cancel" style="flex:1;padding:14px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#444466;color:#fff;">キャンセル</button>
                <button id="cp-ok" style="flex:1;padding:14px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#4a7dff;color:#fff;">OK</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // DOM要素取得
        const newColorEl = modal.querySelector('#cp-new');
        const sbBox = modal.querySelector('#cp-sb-box');
        const sbCursor = modal.querySelector('#cp-sb-cursor');
        const hueSlider = modal.querySelector('#cp-hue-slider');
        const hueCursor = modal.querySelector('#cp-hue-cursor');
        const hexInput = modal.querySelector('#cp-hex');
        const hsvPanel = modal.querySelector('#cp-hsv');
        const rgbPanel = modal.querySelector('#cp-rgb');
        const tabHsv = modal.querySelector('#cp-tab-hsv');
        const tabRgb = modal.querySelector('#cp-tab-rgb');
        const sliderR = modal.querySelector('#cp-slider-r');
        const sliderG = modal.querySelector('#cp-slider-g');
        const sliderB = modal.querySelector('#cp-slider-b');
        const valueR = modal.querySelector('#cp-value-r');
        const valueG = modal.querySelector('#cp-value-g');
        const valueB = modal.querySelector('#cp-value-b');
        const recentColorsEl = modal.querySelector('#cp-recent');

        // UI更新
        const updateUI = () => {
            const rgb = hsvToRgb(hue, saturation, brightness);
            r = rgb.r; g = rgb.g; b = rgb.b;
            const hex = rgbToHex(r, g, b);
            newColorEl.style.backgroundColor = hex;
            hexInput.value = hex;
            sbBox.style.backgroundColor = rgbToHex(...Object.values(hsvToRgb(hue, 100, 100)));
            sbCursor.style.left = `${saturation}%`;
            sbCursor.style.top = `${100 - brightness}%`;
            hueCursor.style.left = `${(hue / 360) * 100}%`;
            if (sliderR) { sliderR.value = r; valueR.textContent = r; }
            if (sliderG) { sliderG.value = g; valueG.textContent = g; }
            if (sliderB) { sliderB.value = b; valueB.textContent = b; }
        };

        const updateFromRGB = () => {
            const hsv = rgbToHsv(r, g, b);
            hue = hsv.h; saturation = hsv.s; brightness = hsv.v;
            updateUI();
        };

        // HSV/RGBタブ切替
        tabHsv.addEventListener('click', () => {
            hsvPanel.style.display = 'block';
            rgbPanel.style.display = 'none';
            tabHsv.style.background = '#4a4a6a'; tabHsv.style.color = '#fff';
            tabRgb.style.background = 'transparent'; tabRgb.style.color = '#8888aa';
        });
        tabRgb.addEventListener('click', () => {
            hsvPanel.style.display = 'none';
            rgbPanel.style.display = 'flex';
            tabRgb.style.background = '#4a4a6a'; tabRgb.style.color = '#fff';
            tabHsv.style.background = 'transparent'; tabHsv.style.color = '#8888aa';
        });

        // SBボックス操作
        let sbDrag = false;
        const updateSB = (e) => {
            const rect = sbBox.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            let x = (touch.clientX - rect.left) / rect.width * 100;
            let y = (touch.clientY - rect.top) / rect.height * 100;
            x = Math.max(0, Math.min(100, x));
            y = Math.max(0, Math.min(100, y));
            saturation = x;
            brightness = 100 - y;
            updateUI();
        };
        sbBox.addEventListener('mousedown', (e) => { sbDrag = true; updateSB(e); });
        sbBox.addEventListener('touchstart', (e) => { sbDrag = true; updateSB(e); e.preventDefault(); }, { passive: false });
        document.addEventListener('mousemove', (e) => { if (sbDrag) updateSB(e); });
        document.addEventListener('touchmove', (e) => { if (sbDrag) { updateSB(e); e.preventDefault(); } }, { passive: false });
        document.addEventListener('mouseup', () => sbDrag = false);
        document.addEventListener('touchend', () => sbDrag = false);

        // Hueスライダー操作
        let hueDrag = false;
        const updateHue = (e) => {
            const rect = hueSlider.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            let x = (touch.clientX - rect.left) / rect.width;
            x = Math.max(0, Math.min(1, x));
            hue = x * 360;
            updateUI();
        };
        hueSlider.addEventListener('mousedown', (e) => { hueDrag = true; updateHue(e); });
        hueSlider.addEventListener('touchstart', (e) => { hueDrag = true; updateHue(e); e.preventDefault(); }, { passive: false });
        document.addEventListener('mousemove', (e) => { if (hueDrag) updateHue(e); });
        document.addEventListener('touchmove', (e) => { if (hueDrag) { updateHue(e); e.preventDefault(); } }, { passive: false });
        document.addEventListener('mouseup', () => hueDrag = false);
        document.addEventListener('touchend', () => hueDrag = false);

        // RGBスライダー
        if (sliderR) sliderR.addEventListener('input', () => { r = parseInt(sliderR.value); updateFromRGB(); });
        if (sliderG) sliderG.addEventListener('input', () => { g = parseInt(sliderG.value); updateFromRGB(); });
        if (sliderB) sliderB.addEventListener('input', () => { b = parseInt(sliderB.value); updateFromRGB(); });

        // HEX入力
        hexInput.addEventListener('change', () => {
            const val = hexInput.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                const rgb = hexToRgb(val);
                r = rgb.r; g = rgb.g; b = rgb.b;
                const hsv = rgbToHsv(r, g, b);
                hue = hsv.h; saturation = hsv.s; brightness = hsv.v;
                updateUI();
            }
        });

        // カラーパレット（App.nesPalette）からスウォッチを生成
        const palette = App.nesPalette || [];
        palette.forEach(c => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `width:24px;height:24px;border-radius:4px;cursor:pointer;border:2px solid #444466;background:${c};flex-shrink:0;`;
            swatch.addEventListener('click', () => {
                const rgb = hexToRgb(c);
                r = rgb.r; g = rgb.g; b = rgb.b;
                const hsv = rgbToHsv(r, g, b);
                hue = hsv.h; saturation = hsv.s; brightness = hsv.v;
                updateUI();
            });
            recentColorsEl.appendChild(swatch);
        });

        updateUI();

        const close = () => {
            document.body.style.overflow = originalOverflow;
            document.body.removeChild(overlay);
        };

        modal.querySelector('#cp-ok').addEventListener('click', () => {
            App.projectData.stage.bgColor = hexInput.value;
            this.updateStageSettingsUI(true); // フォーム状態を保持（ステージサイズ・スコア表示を上書きしない）
            this.initTemplateList();
            this.initSpriteGallery();
            this.render();
            close();
        });

        modal.querySelector('#cp-cancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    },

    // SE繝励Ξ繝薙Η繝ｼ蜀咲函
    playSePreview(seIndex) {
        const sounds = App.projectData?.sounds || [];
        if (seIndex < 0 || seIndex >= sounds.length) return;

        const se = sounds[seIndex];

        // 繧ｰ繝ｭ繝ｼ繝舌Ν繧ｪ繝ｼ繝・ぅ繧ｪ繧ｨ繝ｳ繧ｸ繝ｳ繧剃ｽｿ逕ｨ
        const audio = window.NesAudio || window.AudioManager;
        if (audio) {
            console.log('Previewing SE:', se.name, se.type);
            audio.playSE(se.type);
        } else {
            console.error('Audio engine (NesAudio/AudioManager) not found.');
        }
    },

    renderSelection() {
        const scrollX = this.canvasScrollX || 0;
        const scrollY = this.canvasScrollY || 0;
        const palette = App.nesPalette;
        const sprites = App.projectData.sprites;
        const templates = App.projectData.templates || [];

        // 重なりによるドット格子の発生を防ぐため、一度オフスクリーンに不透明で描画してから透過合成する
        if (!this.offscreenCanvas) {
            this.offscreenCanvas = document.createElement('canvas');
        }
        if (this.offscreenCanvas.width !== this.canvas.width || this.offscreenCanvas.height !== this.canvas.height) {
            this.offscreenCanvas.width = this.canvas.width;
            this.offscreenCanvas.height = this.canvas.height;
        }
        const offCtx = this.offscreenCanvas.getContext('2d');
        offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

        // Helper to render an entity/sprite at pos to offCtx
        const renderSpriteAt = (tileIdOrTemplateId, tx, ty, isEntity = false) => {
            if (tileIdOrTemplateId <= -1000 || tileIdOrTemplateId === -1) return;

            let sprite;
            let flipX = false;

            if (isEntity) {
                const template = templates[tileIdOrTemplateId];
                if (template) {
                    const spriteIdx = template.sprites?.idle?.frames?.[0] ?? template.sprites?.main?.frames?.[0];
                    sprite = sprites[spriteIdx];
                    flipX = template.type === 'enemy';
                }
            } else {
                // Tile logic
                if (tileIdOrTemplateId >= 100) {
                    const template = templates[tileIdOrTemplateId - 100];
                    const spriteIdx = template?.sprites?.idle?.frames?.[0] ?? template?.sprites?.main?.frames?.[0];
                    sprite = sprites[spriteIdx];
                } else if (tileIdOrTemplateId >= 0 && tileIdOrTemplateId < sprites.length) {
                    sprite = sprites[tileIdOrTemplateId];
                }
            }

            if (sprite) {
                this.renderSprite(sprite, tx, ty, palette, flipX, offCtx);
            }
        };

        // ペーストプレビュー
        if (this.pasteMode && this.pasteData && this.pasteData.tiles) {
            const h = this.pasteData.tiles.length;
            const w = this.pasteData.tiles[0].length;

            offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
            for (let dy = 0; dy < h; dy++) {
                for (let dx = 0; dx < w; dx++) {
                    renderSpriteAt(this.pasteData.tiles[dy][dx], this.pasteOffset.x + dx, this.pasteOffset.y + dy);
                }
            }
            if (this.pasteData.entities) {
                this.pasteData.entities.forEach(e => {
                    renderSpriteAt(e.templateId, this.pasteOffset.x + e.relX, this.pasteOffset.y + e.relY, true);
                });
            }
            // 0.7の不透明度でメインキャンバスへ
            this.ctx.globalAlpha = 0.7;
            this.ctx.drawImage(this.offscreenCanvas, 0, 0);
            this.ctx.globalAlpha = 1.0;

            // 枠線
            const rectX = this.pasteOffset.x * this.tileSize + scrollX;
            const rectY = this.pasteOffset.y * this.tileSize + scrollY;
            const rectW = w * this.tileSize;
            const rectH = h * this.tileSize;
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(rectX, rectY, rectW, rectH);
            this.ctx.setLineDash([]);
        }

        if (this.selectionStart && this.selectionEnd) {
            // 浮動レイヤー
            if (this.isFloating && this.floatingData) {
                offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
                for (let y = 0; y < this.floatingData.length; y++) {
                    for (let x = 0; x < this.floatingData[0].length; x++) {
                        renderSpriteAt(this.floatingData[y][x], this.floatingPos.x + x, this.floatingPos.y + y);
                    }
                }
                if (this.floatingEntities) {
                    this.floatingEntities.forEach(e => {
                        renderSpriteAt(e.templateId, this.floatingPos.x + e.relX, this.floatingPos.y + e.relY, true);
                    });
                }
                // 0.5の不透明度でメインキャンバスへ
                this.ctx.globalAlpha = 0.5;
                this.ctx.drawImage(this.offscreenCanvas, 0, 0);
                this.ctx.globalAlpha = 1.0;
            }

            // 選択枠
            const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
            const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);

            const rectX = x1 * this.tileSize + scrollX;
            const rectY = y1 * this.tileSize + scrollY;
            const rectW = (x2 - x1 + 1) * this.tileSize;
            const rectH = (y2 - y1 + 1) * this.tileSize;

            this.ctx.strokeStyle = this.isSelecting ? '#ffffff' : '#90EE90';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(rectX, rectY, rectW, rectH);
            this.ctx.setLineDash([]);
        }
    },

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

