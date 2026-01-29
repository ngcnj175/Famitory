/**
 * PixelGameKit - ステージエディタ v4（詳細設定パネル対応）
 */

const StageEditor = {
    canvas: null,
    ctx: null,
    tileSize: 20,

    // 状態
    currentTool: 'pen',
    currentLayer: 'fg', // FGのみ使用（BGは単色背景）
    selectedTemplate: null,
    templates: [],

    // 設定パネル
    isConfigOpen: false,
    editingTemplate: null,
    editingIndex: -1, // -1:新規, 0以上:編集
    draggedSpriteIndex: null,

    // タイルクリック状態（ダブルタップ検出用）
    tileClickState: { index: null, timer: null, count: 0 },

    // UNDO履歴
    undoHistory: [],
    maxUndoHistory: 20,

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
        this.initCanvasEvents(); // イベントリスナー再設定
        this.updateStageSettingsUI();
        this.resize();
        this.render();
    },

    // ========== ツールバー ==========
    initTools() {
        // 重複リスナー防止
        if (this.toolsInitialized) return;
        this.toolsInitialized = true;

        // ステージ画面専用のツールボタンを選択
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

            // マウスイベント
            btn.addEventListener('mousedown', startLongPress);
            btn.addEventListener('mouseup', cancelLongPress);
            btn.addEventListener('mouseleave', cancelLongPress);

            // タッチイベント
            btn.addEventListener('touchstart', startLongPress, { passive: true });
            btn.addEventListener('touchend', cancelLongPress);

            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;

                // UNDOツール
                if (tool === 'undo') {
                    this.undo();
                    return;
                }

                // 特殊ツール（copy, paste等）はスキップ
                if (['copy', 'paste', 'flip-v', 'flip-h'].includes(tool)) {
                    return;
                }

                this.currentTool = tool;
                document.querySelectorAll('#stage-tools .paint-tool-btn').forEach(b => {
                    // 描画ツールのみアクティブ切替
                    if (['pen', 'eraser', 'fill', 'eyedropper'].includes(b.dataset.tool)) {
                        b.classList.toggle('active', b === btn);
                    }
                });
            });
        });
    },

    // ========== 背景色取得 ==========
    getBackgroundColor() {
        // ステージ設定の背景色を使用
        return App.projectData.stage?.bgColor || App.projectData.stage?.backgroundColor || '#3CBCFC';
    },

    // ========== スプライトギャラリー（ドラッグ元） ==========
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

    // ========== タイル追加ボタン ==========
    initAddTileButton() {
        const addBtn = document.getElementById('add-tile-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openTypeSelectPopup());
        }
    },

    // 属性選択ポップアップを開く
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
        // キャンセルボタン
        const cancelBtn = document.getElementById('type-select-cancel');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.closeTypeSelectPopup();
        }

        // 属性選択ボタン
        document.querySelectorAll('.type-select-item').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                this.closeTypeSelectPopup();
                this.addNewTile(type);
            };
        });
    },

    addNewTile(type) {
        // 新規タイル作成
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
                return ['idle', 'walk', 'jump', 'attack', 'shot', 'life'];
            case 'enemy':
                return ['idle', 'walk', 'jump', 'attack', 'shot'];
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
                return { life: 3, lifeCount: 3, speed: 5, jumpPower: 10, wJump: false, shotMaxRange: 16 };
            case 'enemy':
                return { life: 1, lifeCount: 1, speed: 3, jumpPower: 5, shotMaxRange: 16, move: 'idle' };
            case 'material':
                return { collision: true, life: -1 };
            case 'item':
                return { itemType: 'star' };
            default:
                return {};
        }
    },

    // ========== 設定パネル ==========
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

    // 属性ラベル表示用のマッピング
    typeLabels: {
        player: 'プレイヤー',
        enemy: 'てき',
        material: 'ブロック・背景',
        item: 'アイテム',
        goal: 'ゴール'
    },

    openConfigPanel() {
        // ステージ設定パネルを閉じる
        const stageSettingsPanel = document.getElementById('stage-settings-panel');
        if (stageSettingsPanel) stageSettingsPanel.classList.add('collapsed');

        const panel = document.getElementById('tile-config-panel');
        if (panel && this.editingTemplate) {
            panel.classList.remove('hidden');
            this.isConfigOpen = true;

            // 属性ラベルを更新
            const typeLabel = document.getElementById('tile-type-label');
            if (typeLabel) {
                typeLabel.textContent = this.typeLabels[this.editingTemplate.type] || this.editingTemplate.type;
            }

            this.renderConfigContent();

            // パネルを先頭にスクロール
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
        const spriteKeys = this.getSpriteKeysForType(type);

        // スプライト設定セクション
        let spriteHtml = '';
        spriteKeys.forEach(key => {
            spriteHtml += this.renderSpriteRow(key);
        });
        spriteSection.innerHTML = spriteHtml;

        // パラメータ設定セクション
        paramSection.innerHTML = this.renderParamSection(type);

        this.initConfigEvents();
    },

    renderSpriteRow(slot) {
        const spriteData = this.editingTemplate.sprites[slot] || { frames: [], speed: 5, loop: true };
        const speed = spriteData.speed || 5;
        const firstFrame = spriteData.frames?.[0];

        // スロット表示名
        const labels = {
            idle: '立ち', walk: '歩き', jump: 'ジャンプ',
            attack: '攻撃', shot: '飛び道具', life: 'ライフ', main: '見た目'
        };

        return `
            <div class="sprite-row" data-slot="${slot}">
                <span class="sprite-row-label">${labels[slot] || slot.toUpperCase()}</span>
                <div class="sprite-slot" data-slot="${slot}">
                    ${firstFrame !== undefined ? `<canvas width="16" height="16" data-sprite="${firstFrame}"></canvas>` : ''}
                </div>
                <!-- 速度設定ブロックゲージ (1-20 -> 5段階) -->
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
            html += this.renderSlider('ライフ数', 'life', config.life ?? 3, 1, 10);
            html += this.renderSlider('足の速さ', 'speed', config.speed ?? 5, 1, 10);
            // プレイヤーのみ2段ジャンプを表示
            if (type === 'player') {
                html += this.renderSliderWithCheck('ジャンプ力', 'jumpPower', config.jumpPower ?? 10, 1, 20, '2段ジャンプ', 'wJump', config.wJump);
            } else {
                html += this.renderSlider('ジャンプ力', 'jumpPower', config.jumpPower ?? 10, 1, 20);
            }
            html += this.renderSlider('射程距離', 'shotMaxRange', config.shotMaxRange ?? 16, 0, 16);
            html += `
                <div class="param-row">
                    <span class="param-label">攻撃タイプ</span>
                    <select class="param-select" data-key="shotType">
                        <option value="melee" ${config.shotType === 'melee' ? 'selected' : ''}>近接</option>
                        <option value="straight" ${config.shotType === 'straight' || !config.shotType ? 'selected' : ''}>ストレート</option>
                        <option value="arc" ${config.shotType === 'arc' ? 'selected' : ''}>やまなり</option>
                        <option value="drop" ${config.shotType === 'drop' ? 'selected' : ''}>鳥のフン</option>
                        <option value="spread" ${config.shotType === 'spread' ? 'selected' : ''}>拡散</option>
                        <option value="boomerang" ${config.shotType === 'boomerang' ? 'selected' : ''}>ブーメラン</option>
                        <option value="pinball" ${config.shotType === 'pinball' ? 'selected' : ''}>ピンポン</option>
                    </select>
                </div>
            `;

            // プレイヤー専用: はじめから使えるトグル（別行で配置、攻撃タイプ選択枠と位置を揃える）
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

            // プレイヤー専用SE設定
            if (type === 'player') {
                html += '<div class="param-section-label">効果音</div>';
                html += this.renderSeSelect('ジャンプ音', 'seJump', config.seJump ?? 0);
                html += this.renderSeSelect('攻撃音', 'seAttack', config.seAttack ?? 5);
                html += this.renderSeSelect('ダメージ音', 'seDamage', config.seDamage ?? 10);
                html += this.renderSeSelect('ゲット音', 'seItemGet', config.seItemGet ?? 15);
            }

            if (type === 'enemy') {
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
                            <option value="muteki" ${config.dropItem === 'muteki' ? 'selected' : ''}>むてき</option>
                            <option value="lifeup" ${config.dropItem === 'lifeup' ? 'selected' : ''}>ライフアップ</option>
                            <option value="clear" ${config.dropItem === 'clear' ? 'selected' : ''}>クリア</option>
                            <option value="weapon" ${config.dropItem === 'weapon' ? 'selected' : ''}>武器</option>
                            <option value="easter" ${config.dropItem === 'easter' ? 'selected' : ''}>イースターエッグ</option>
                        </select>
                    </div>
                `;
            }
        } else if (type === 'material') {
            html += this.renderToggle('当たり判定', 'collision', config.collision !== false);
            html += this.renderSlider('耐久性', 'life', config.life ?? -1, -1, 10);
            html += `
                <div class="param-row">
                    <span class="param-label">ギミック</span>
                    <select class="param-select" data-key="gimmick">
                        <option value="none" ${!config.gimmick || config.gimmick === 'none' ? 'selected' : ''}>なし</option>
                        <option value="moveH" ${config.gimmick === 'moveH' ? 'selected' : ''}>横移動</option>
                        <option value="moveV" ${config.gimmick === 'moveV' ? 'selected' : ''}>縦移動</option>
                        <option value="fall" ${config.gimmick === 'fall' ? 'selected' : ''}>落下</option>
                    </select>
                </div>
            `;
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
                        <option value="easter" ${config.itemType === 'easter' ? 'selected' : ''}>イースターエッグ</option>
                    </select>
                </div>
            `;
            // イースターエッグの場合はメッセージ入力欄を表示
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
        // ブロックゲージに変更（5個固定、タップ形式）
        return this.renderBlockGauge(label, key, value, min, max);
    },

    renderBlockGauge(label, key, value, min, max) {
        // 値を0-5の範囲にマッピング
        let mappedValue = value;

        // 特殊ケース: lifeで-1は無限
        if (key === 'life' && min === -1) {
            if (value === -1) mappedValue = 0; // 無限=0番目
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
        // ブロックゲージ + トグルスイッチに変更
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

    renderSeSelect(label, key, selectedValue) {
        // sounds配列がない場合はデフォルトプリセットを使用
        let sounds = App.projectData?.sounds;
        if (!sounds || sounds.length === 0) {
            sounds = [
                // ジャンプ系
                { id: 0, name: 'ジャンプ_01', type: 'jump_01' },
                { id: 1, name: 'ジャンプ_02', type: 'jump_02' },
                { id: 2, name: 'ジャンプ_03', type: 'jump_03' },
                { id: 3, name: 'ジャンプ_04', type: 'jump_04' },
                { id: 4, name: 'ジャンプ_05', type: 'jump_05' },
                // 攻撃系
                { id: 5, name: '攻撃_01', type: 'attack_01' },
                { id: 6, name: '攻撃_02', type: 'attack_02' },
                { id: 7, name: '攻撃_03', type: 'attack_03' },
                { id: 8, name: '攻撃_04', type: 'attack_04' },
                { id: 9, name: '攻撃_05', type: 'attack_05' },
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
                { id: 20, name: 'その他_01(決定)', type: 'other_01' },
                { id: 21, name: 'その他_02(キャンセル)', type: 'other_02' },
                { id: 22, name: 'その他_03(カーソル)', type: 'other_03' },
                { id: 23, name: 'その他_04(ポーズ)', type: 'other_04' },
                { id: 24, name: 'その他_05(爆発)', type: 'other_05' }
            ];
            // プロジェクトデータに追加
            if (App.projectData) {
                App.projectData.sounds = sounds;
            }
        }

        // 選択中のSE名を取得
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
        // スプライトスロットのクリックイベント
        document.querySelectorAll('.sprite-slot').forEach(slotEl => {
            slotEl.addEventListener('click', () => {
                const slot = slotEl.dataset.slot;
                if (slot) {
                    this.openSpriteSelectPopup(slot);
                }
            });
        });

        // スプライト速度スライダー
        document.querySelectorAll('.sprite-speed').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const slot = slider.dataset.slot;
                if (slot && this.editingTemplate?.sprites?.[slot]) {
                    const speed = parseInt(e.target.value);
                    this.editingTemplate.sprites[slot].speed = speed;
                    // 速度表示をリアルタイム更新
                    const countEl = document.querySelector(`.sprite-count[data-slot="${slot}"]`);
                    if (countEl) {
                        countEl.textContent = speed;
                    }
                    // アニメーションをリアルタイム更新
                    this.updateConfigAnimations();
                }
            });
        });

        // スプライト設定の初期化・修正
        if (this.editingTemplate?.sprites) {
            Object.keys(this.editingTemplate.sprites).forEach(slot => {
                const sprite = this.editingTemplate.sprites[slot];
                // 攻撃アニメーションはループさせない
                if (slot === 'attack') {
                    sprite.loop = false;
                } else if (sprite.loop === undefined) {
                    // 他はデフォルトでループ
                    sprite.loop = true;
                }
            });
        }

        // パラメータスライダー (legacy support)
        document.querySelectorAll('.param-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const key = slider.dataset.key;
                let value = parseInt(e.target.value);

                if (key && this.editingTemplate?.config) {
                    // LIFE設定（Material）の0スキップ対応
                    if (key === 'life' && this.editingTemplate.type === 'material') {
                        if (value >= 0) value += 1; // 0以上は+1して保存（0をスキップ）
                    }

                    this.editingTemplate.config[key] = value;
                    // 値表示を更新
                    const valueEl = document.querySelector(`.param-value[data-key="${key}"]`);
                    if (valueEl) {
                        valueEl.textContent = value === -1 ? '∞' : value;
                    }
                }
            });
        });

        // ブロックゲージクリック
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
                        // 特殊ケース: 0=無限(-1), 1-5=1-5
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

        // トグルスイッチ / チェックボックス
        document.querySelectorAll('.toggle-switch input[type="checkbox"], .param-check-label input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const key = cb.dataset.key;
                if (key && this.editingTemplate?.config) {
                    this.editingTemplate.config[key] = cb.checked;
                }
            });
        });

        // パラメータセレクト
        document.querySelectorAll('.param-select').forEach(select => {
            select.addEventListener('change', () => {
                const key = select.dataset.key;
                if (key && this.editingTemplate?.config) {
                    // SE関連は数値で保存
                    if (key.startsWith('se')) {
                        this.editingTemplate.config[key] = parseInt(select.value);
                    } else {
                        this.editingTemplate.config[key] = select.value;
                    }

                    // itemTypeが変更された場合はUIリフレッシュ（メッセージ欄の表示/非表示）
                    if (key === 'itemType') {
                        this.renderConfigContent();
                        this.initConfigEvents();
                    }
                }
            });
        });

        // パラメータテキスト入力（イースターエッグメッセージなど）
        document.querySelectorAll('.param-input').forEach(input => {
            input.addEventListener('input', () => {
                const key = input.dataset.key;
                if (key && this.editingTemplate?.config) {
                    this.editingTemplate.config[key] = input.value;
                }
            });
        });

        // SEプレビューボタン
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

        // SE選択ボタン
        document.querySelectorAll('.se-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                const val = parseInt(btn.dataset.value);
                const currentValue = isNaN(val) ? -1 : val;
                this.openSeSelectPopup(key, currentValue);
            });
        });

        // アニメーションを初期化
        this.updateConfigAnimations();
    },

    // 設定パネル内のアニメーションを更新
    updateConfigAnimations() {
        // 既存のアニメーションタイマーをクリア
        if (this.configAnimationIntervals) {
            this.configAnimationIntervals.forEach(id => clearInterval(id));
        }
        this.configAnimationIntervals = [];

        // スプライトをキャンバスに描画（アニメーションも対応）
        document.querySelectorAll('.sprite-slot').forEach(slotEl => {
            const slot = slotEl.dataset.slot;
            const canvas = slotEl.querySelector('canvas');
            if (!canvas || !slot) return;

            const spriteData = this.editingTemplate?.sprites?.[slot];
            const frames = spriteData?.frames || [];
            const speed = spriteData?.speed || 8;

            if (frames.length === 0) return;

            // 初期フレーム描画
            const firstSprite = App.projectData.sprites[frames[0]];
            if (firstSprite) {
                this.renderSpriteToMiniCanvas(firstSprite, canvas, this.getBackgroundColor());
            }

            // 複数フレームの場合はアニメーション
            if (frames.length > 1) {
                let frameIndex = 0;
                const animInterval = setInterval(() => {
                    // パネルが閉じられたらアニメ停止
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

    // SEプレビュー再生
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
            // NesAudioまたはAudioManagerを使って再生
            const audioEngine = window.NesAudio || window.AudioManager || (typeof NesAudio !== 'undefined' ? NesAudio : null);
            console.log('[SE Preview] Audio engine found:', !!audioEngine);

            if (audioEngine && audioEngine.playSE) {
                // コンテキスト再開を試みる（iOS対応）
                try {
                    if (audioEngine.ensureContext) {
                        audioEngine.ensureContext();
                    }
                    // AudioContextがsuspendedの場合は resume を待つ
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

    // ========== SE選択ポップアップ ==========
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

        // SE一覧を生成
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

        // リスト内のタッチイベント伝播を停止（グローバルスクロールブロックの回避）
        list.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        list.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

        // イベントを設定
        list.querySelectorAll('.se-select-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // プレビューボタンクリック時は選択しない
                if (e.target.classList.contains('se-preview-btn')) return;

                // 即座に選択を確定
                this.selectedSeIndex = parseInt(item.dataset.seIndex);
                this.confirmSeSelection();
            });
        });

        list.querySelectorAll('.se-preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(btn.dataset.seIndex);
                this.playSePreview(idx);
            });
            // タッチイベントも追加（反応性向上）
            btn.addEventListener('touchstart', (e) => {
                e.stopPropagation(); // リストのスクロール以外への伝播防止
            }, { passive: true });
        });

        // ポップアップ外クリックで閉じる
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
            // UIを更新
            this.renderConfigContent();
            this.initConfigEvents();
        }
        this.closeSeSelectPopup();
    },

    // ========== スプライト選択ポップアップ ==========
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

        // 背景色を動的に取得
        const bgColor = App.projectData.stage?.bgColor || App.projectData.stage?.backgroundColor || '#3CBCFC';

        // スプライト一覧を横スクロール形式で表示
        list.innerHTML = '';
        App.projectData.sprites.forEach((sprite, index) => {
            const item = document.createElement('div');
            item.className = 'sprite-select-item';
            item.style.backgroundColor = bgColor; // 動的背景色
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
            // 選択解除
            this.selectedSpriteOrder.splice(orderIndex, 1);
            itemEl.classList.remove('selected');
            const orderNum = itemEl.querySelector('.sprite-select-order');
            if (orderNum) orderNum.remove();
        } else {
            // 選択追加
            this.selectedSpriteOrder.push(spriteIndex);
            itemEl.classList.add('selected');
            const orderNum = document.createElement('span');
            orderNum.className = 'sprite-select-order';
            orderNum.textContent = this.selectedSpriteOrder.length;
            itemEl.appendChild(orderNum);
        }

        // 順番表示を更新
        this.updateSpriteSelectionOrder();
    },

    updateSpriteSelectionOrder() {
        const list = document.getElementById('sprite-select-list');
        if (!list) return;

        list.querySelectorAll('.sprite-select-item').forEach(item => {
            const canvas = item.querySelector('canvas');
            if (!canvas) return;
            // canvasからsprite indexを取得する方法がないため、順番だけ更新
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

    // ========== タイル保存 ==========
    saveTemplate() {
        if (!this.editingTemplate) return;

        // IDLEまたはメインスプライトが必須
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

        // 既存テンプレート編集時：古いスプライトIDを新しいIDで置換
        if (this.editingIndex >= 0) {
            const oldTemplate = App.projectData.templates[this.editingIndex];
            const oldSpriteId = oldTemplate?.sprites?.idle?.frames?.[0] ?? oldTemplate?.sprites?.main?.frames?.[0];
            const newSpriteId = this.editingTemplate.sprites?.idle?.frames?.[0] ?? this.editingTemplate.sprites?.main?.frames?.[0];

            // スプライトIDが変更された場合、ステージ内を置換
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
        this.render(); // ステージを再描画
    },

    // ステージ内のスプライトIDを置換
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

    // ========== タイルテンプレート一覧 ==========
    initTemplateList() {
        const container = document.getElementById('tile-list');
        if (!container) return;

        container.innerHTML = '';

        if (!App.projectData.templates) {
            App.projectData.templates = [];
        }
        this.templates = App.projectData.templates;

        const typeIcons = {
            player: '🎮',
            enemy: '👾',
            material: '🧱',
            item: '⭐',
            goal: '🚩'
        };

        this.templates.forEach((template, index) => {
            const div = document.createElement('div');
            div.className = 'tile-item' + (this.selectedTemplate === index ? ' selected' : '');

            // サムネイル（IDLEまたはメイン）
            const frames = template.sprites?.idle?.frames || template.sprites?.main?.frames || [];
            const speed = template.sprites?.idle?.speed || template.sprites?.main?.speed || 8;

            if (frames.length > 0) {
                const miniCanvas = document.createElement('canvas');
                miniCanvas.width = 16;
                miniCanvas.height = 16;

                // 初期フレーム描画
                const firstSprite = App.projectData.sprites[frames[0]];
                if (firstSprite) {
                    this.renderSpriteToMiniCanvas(firstSprite, miniCanvas, this.getBackgroundColor());
                }

                // 複数フレームの場合はアニメーション
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
            }

            // 種別バッジ
            const badge = document.createElement('span');
            badge.className = 'type-badge';
            badge.textContent = typeIcons[template.type] || '?';
            div.appendChild(badge);

            // タップ/クリック処理（シングル：即座に選択、ダブル：設定表示）
            const handleTap = (e) => {
                // イベントターゲットがこのdiv内でない場合は無視（iPhoneバグ対策）
                if (e && e.target && !div.contains(e.target)) {
                    return;
                }

                const state = this.tileClickState;

                // 同じタイルへの2回目のクリック（ダブルタップ）
                if (state.index === index && state.count === 1) {
                    clearTimeout(state.timer);
                    state.count = 0;
                    state.index = null;

                    // ダブルタップ：設定表示
                    this.editingTemplate = { ...template, sprites: { ...template.sprites } };
                    this.editingIndex = index;
                    this.openConfigPanel();
                } else {
                    // 最初のクリック：即座に選択
                    clearTimeout(state.timer);
                    state.index = index;
                    state.count = 1;

                    // 即座に選択を反映（遅延なし）
                    this.selectedTemplate = index;
                    this.initTemplateList();

                    // ダブルタップ用タイマー（選択後もダブルタップを受け付ける）
                    state.timer = setTimeout(() => {
                        state.count = 0;
                        state.index = null;
                    }, 300);
                }
            };

            div.addEventListener('click', handleTap);

            // 長押しでメニュー表示
            let longPressTimer = null;
            div.addEventListener('touchstart', () => {
                longPressTimer = setTimeout(() => {
                    App.showActionMenu(null, [
                        { text: '複製', action: () => this.duplicateTemplate(index) },
                        { text: '削除', style: 'destructive', action: () => this.deleteTemplate(index, false) },
                        { text: 'キャンセル', style: 'cancel' }
                    ]);
                }, 800);
            }, { passive: true });

            div.addEventListener('touchend', () => clearTimeout(longPressTimer));
            div.addEventListener('touchmove', () => clearTimeout(longPressTimer));

            container.appendChild(div);
        });
    },

    // タイルテンプレートを削除
    deleteTemplate(index, needConfirm = true) {
        if (needConfirm && !confirm('このタイルを削除しますか？')) {
            return;
        }
        // キャンバスから該当タイルをクリア
        this.clearTileFromCanvas(index);

        // テンプレートを削除
        App.projectData.templates.splice(index, 1);

        // 削除後のインデックス調整
        this.updateCanvasTileIndices(index);

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

    // キャンバスから指定インデックスのタイルをすべてクリア
    clearTileFromCanvas(templateIndex) {
        const stage = App.projectData.stage;
        if (!stage || !stage.layers) return;

        const layer = stage.layers.fg;
        if (!layer) return;

        // タイルの最初のスプライトインデックスを取得
        const template = App.projectData.templates[templateIndex];
        if (!template) return;

        const spriteIdx = template.sprites?.idle?.frames?.[0] ?? template.sprites?.main?.frames?.[0];
        if (spriteIdx === undefined) return;

        // キャンバス上の該当タイルを-1に置換
        for (let y = 0; y < stage.height; y++) {
            for (let x = 0; x < stage.width; x++) {
                if (layer[y][x] === spriteIdx) {
                    layer[y][x] = -1;
                }
            }
        }
    },

    // テンプレート削除後のインデックス調整
    // 削除されたインデックスより大きいスプライト参照を持つタイルは調整不要
    // （タイル配置はスプライトインデックスを使用しているため）
    updateCanvasTileIndices(deletedIndex) {
        // 注意: 現在の実装ではタイル配置時にスプライトインデックスを使用しているため
        // テンプレートインデックスの調整は不要
        // 将来的にテンプレートインデックスを使用する場合はここで調整
    },

    // ========== キャンバス ==========
    initCanvasEvents() {
        if (!this.canvas) return;

        // 重複リスナー防止
        if (this.canvasEventsInitialized) return;
        this.canvasEventsInitialized = true;

        let isDrawing = false;

        // 2本指パン用の状態
        this.canvasScrollX = 0;
        this.canvasScrollY = 0;
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let lastScrollX = 0;
        let lastScrollY = 0;

        const handleStart = (e) => {
            if (isDrawing) return; // 重複呼び出し防止
            this.saveToHistory();
            isDrawing = true;
            this.processPixel(e);
        };

        const handleMove = (e) => {
            if (isDrawing) this.processPixel(e);
        };

        const handleEnd = () => {
            isDrawing = false;
        };

        this.canvas.addEventListener('mousedown', handleStart);
        this.canvas.addEventListener('mousemove', handleMove);
        this.canvas.addEventListener('mouseup', handleEnd);
        this.canvas.addEventListener('mouseleave', handleEnd);

        // 2本指パン誤入力防止用
        let pendingDrawTimer = null;
        let pendingDrawData = null;

        // タッチイベント（1本指：タイル操作、2本指：パン）
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // 2本指：パン開始 - 保留中の入力があればキャンセル
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
                // 1本指：遅延してタイル操作（2本指パン誤入力防止）
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
                // 2本指：パン中
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentX = (touch1.clientX + touch2.clientX) / 2;
                const currentY = (touch1.clientY + touch2.clientY) / 2;

                this.canvasScrollX = lastScrollX + (currentX - panStartX);
                this.canvasScrollY = lastScrollY + (currentY - panStartY);

                // スクロール範囲を制限
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

    processPixel(e) {
        if (App.currentScreen !== 'stage') return;

        // イベントからクライアント座標を取得（undefined対策）
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        if (clientX === undefined || clientY === undefined) return;

        const rect = this.canvas.getBoundingClientRect();

        // キャンバス外のタッチは無視（ステージ設定パネルなど他UI要素のタップ対策）
        if (clientX < rect.left || clientX > rect.right ||
            clientY < rect.top || clientY > rect.bottom) {
            return;
        }

        const scrollX = this.canvasScrollX || 0;
        const scrollY = this.canvasScrollY || 0;
        const x = Math.floor((clientX - rect.left - scrollX) / this.tileSize);
        const y = Math.floor((clientY - rect.top - scrollY) / this.tileSize);

        // 座標がNaNの場合は処理しない
        if (isNaN(x) || isNaN(y)) return;

        const stage = App.projectData.stage;
        if (x < 0 || x >= stage.width || y < 0 || y >= stage.height) return;

        const layer = stage.layers[this.currentLayer];

        // 選択中のテンプレートのスプライトサイズを取得
        // エンティティ配列の確保
        if (!stage.entities) stage.entities = [];

        // テンプレート取得ヘルパー
        const getTemplate = (idx) => {
            return (App.projectData.templates && App.projectData.templates[idx]) || null;
        };

        // スプライトサイズ取得ヘルパー
        const getTemplateSize = (templateIdx) => {
            const tmpl = getTemplate(templateIdx);
            if (!tmpl) return 1;
            const spriteIdx = tmpl.sprites?.idle?.frames?.[0] ?? tmpl.sprites?.main?.frames?.[0];
            const sprite = App.projectData.sprites[spriteIdx];
            return sprite?.size || 1;
        };

        switch (this.currentTool) {
            case 'pen':
                if (this.selectedTemplate !== null) {
                    const tmpl = getTemplate(this.selectedTemplate);
                    const spriteSize = getTemplateSize(this.selectedTemplate);

                    // エンティティタイプの場合（Entities配列へ追加）
                    if (tmpl && ['player', 'enemy', 'item'].includes(tmpl.type)) {
                        // 既存の同座標エンティティを削除（上書き）
                        // 32x32の場合は2x2領域の重複を考慮すべきだが、シンプルに原点一致で判定
                        // または「その座標にあるもの」を消す
                        const removeIdx = stage.entities.findIndex(e => {
                            // 同じ座標にあるエンティティを探す
                            // 厳密には矩形判定すべきだが、エディタ操作としては原点クリックで上書きが自然
                            return e.x === x && e.y === y;
                        });
                        if (removeIdx >= 0) {
                            stage.entities.splice(removeIdx, 1);
                        }

                        // 新規追加
                        stage.entities.push({
                            x: x,
                            y: y,
                            templateId: this.selectedTemplate
                        });

                        // マップタイルの書き込みはスキップ（背景維持）
                    } else {
                        // 通常タイル（Map配列へ書き込み）
                        const tileValue = this.selectedTemplate + 100;

                        if (spriteSize === 2) {
                            // 32x32スプライト
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
                            // 16x16スプライト
                            layer[y][x] = tileValue;
                        }
                    }
                }
                break;

            case 'eraser':
                // まずエンティティを削除
                let entityDeleted = false;
                for (let i = stage.entities.length - 1; i >= 0; i--) {
                    const e = stage.entities[i];
                    // エンティティの占有領域を計算
                    const tmpl = getTemplate(e.templateId);
                    const size = getTemplateSize(e.templateId);
                    const w = (size === 2) ? 2 : 1;
                    const h = (size === 2) ? 2 : 1;

                    // クリック座標がエンティティ内にあるか
                    if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) {
                        stage.entities.splice(i, 1);
                        entityDeleted = true;
                        // 重なっている場合すべて消すか、一番上だけ消すか。ここでは全て消す。
                    }
                }

                // エンティティが削除された場合、マップタイルは消さない（誤操作防止）
                // ただし、ユーザーが明示的に背景も消したい場合は再クリックが必要
                if (entityDeleted) break;

                // マップタイルの削除処理（既存ロジック）
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
                    // エンティティの塗りつぶしはサポートしない（マップのみ）
                    if (tmpl && ['player', 'enemy', 'item'].includes(tmpl.type)) {
                        alert('キャラクターやアイテムで塗りつぶしはできません');
                        return;
                    }

                    const newValue = this.selectedTemplate + 100;
                    this.floodFill(x, y, layer[y][x], newValue);
                }
                break;

            case 'eyedropper':
                // 最前面（エンティティ）を優先取得
                let foundEntity = null;
                for (const e of stage.entities) {
                    const tmpl = getTemplate(e.templateId);
                    const size = getTemplateSize(e.templateId);
                    const w = (size === 2) ? 2 : 1;
                    const h = (size === 2) ? 2 : 1;
                    if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) {
                        foundEntity = e;
                        break; // 最初に見つかったものを採用
                    }
                }

                if (foundEntity) {
                    this.selectedTemplate = foundEntity.templateId;
                    this.initTemplateList();
                    // ツールをペンに戻す
                    this.currentTool = 'pen';
                    // ツールバーの見た目更新は省略（再描画で反映されるか要確認）
                } else {
                    // マップタイルから取得
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

        // キャンバスは常に16x16タイル（320px）固定
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

        // 背景色（Pixel画面の背景色を使用）
        this.ctx.fillStyle = this.getBackgroundColor();
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // FGレイヤーのみ描画
        this.renderLayer('fg', 1);

        // エンティティ描画（新規追加）
        this.renderEntities();

        this.renderGrid();
    },

    renderEntities() {
        const stage = App.projectData.stage;
        if (!stage.entities) return;

        const templates = App.projectData.templates || [];
        const sprites = App.projectData.sprites;
        const palette = App.nesPalette;

        stage.entities.forEach(entity => {
            const template = templates[entity.templateId];
            if (!template) return;

            const spriteIdx = template.sprites?.idle?.frames?.[0] ?? template.sprites?.main?.frames?.[0];
            const sprite = sprites[spriteIdx];
            if (sprite) {
                // 敵は左向きに反転して描画
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

        this.ctx.globalAlpha = alpha;

        for (let y = 0; y < stage.height; y++) {
            for (let x = 0; x < stage.width; x++) {
                const tileId = layer[y][x];

                // 2x2マーカータイルはスキップ（左上タイルのみ描画）
                if (tileId <= -1000) continue;

                let sprite;
                if (tileId >= 100) {
                    // テンプレートIDベース（新形式）
                    const template = templates[tileId - 100];
                    const spriteIdx = template?.sprites?.idle?.frames?.[0] ?? template?.sprites?.main?.frames?.[0];
                    sprite = sprites[spriteIdx];
                } else if (tileId >= 0 && tileId < sprites.length) {
                    // スプライトIDベース（旧形式）- 互換性
                    sprite = sprites[tileId];
                }
                if (sprite) {
                    this.renderSprite(sprite, x, y, palette);
                }
            }
        }

        this.ctx.globalAlpha = 1;
    },

    renderSprite(sprite, tileX, tileY, palette, flipX = false) {
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
                    this.ctx.fillStyle = palette[colorIndex];
                    // flipXの場合はX座標を反転
                    const drawX = flipX
                        ? tileX * this.tileSize + (dimension - 1 - x) * pixelSize + scrollX
                        : tileX * this.tileSize + x * pixelSize + scrollX;
                    this.ctx.fillRect(
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

        // スプライトサイズを判定
        const spriteSize = sprite.size || 1;
        const dimension = spriteSize === 2 ? 32 : 16;

        // キャンバスサイズをスプライトサイズに合わせる
        canvas.width = dimension;
        canvas.height = dimension;

        // 背景色を描画（動的に設定可能）
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, dimension, dimension);

        // スケール係数（1:1で描画）
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

        // 通常のグリッド線（薄め）
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

        // 16タイル毎のガイド線（見やすい赤線）
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

    // ========== UNDO機能 ==========
    saveToHistory() {
        // デバウンス（100ms以内の連続呼び出しを無視）
        const now = Date.now();
        if (this.lastSaveTime && now - this.lastSaveTime < 100) {
            return;
        }
        this.lastSaveTime = now;

        const stage = App.projectData.stage;
        // FGレイヤーの現在の状態をディープコピー
        const snapshot = stage.layers.fg.map(row => [...row]);

        this.undoHistory.push(snapshot);

        // 履歴が多すぎる場合は古いものを削除
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

        // スナップショットを復元
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

    // ========== ステージ設定パネル ==========
    initStageSettings() {
        const panel = document.getElementById('stage-settings-panel');
        const header = document.getElementById('stage-settings-header');
        if (!panel || !header) return;

        // パネル内のクリック/タッチイベントがキャンバスに伝播しないように
        panel.addEventListener('click', (e) => e.stopPropagation());
        panel.addEventListener('touchstart', (e) => e.stopPropagation());
        panel.addEventListener('touchend', (e) => e.stopPropagation());

        // 折りたたみ（初期状態は開いている）
        header.addEventListener('click', () => {
            const wasCollapsed = panel.classList.contains('collapsed');
            panel.classList.toggle('collapsed');

            // パネルを開く時にpendingArea値を現在のステージサイズから再初期化
            if (wasCollapsed) {
                this.pendingAreaW = Math.floor(App.projectData.stage.width / 16);
                this.pendingAreaH = Math.floor(App.projectData.stage.height / 16);
                this.updateStageSettingsUI();
            }
        });

        // 一時的なサイズ値（保存ボタン押下まで反映しない）
        this.pendingAreaW = Math.floor(App.projectData.stage.width / 16);
        this.pendingAreaH = Math.floor(App.projectData.stage.height / 16);

        // UI要素取得
        const areaWValue = document.getElementById('area-w-value');
        const areaHValue = document.getElementById('area-h-value');
        const areaWMinus = document.getElementById('area-w-minus');
        const areaWPlus = document.getElementById('area-w-plus');
        const areaHMinus = document.getElementById('area-h-minus');
        const areaHPlus = document.getElementById('area-h-plus');
        const bgColorSwatch = document.getElementById('stage-bg-color');
        const saveBtn = document.getElementById('stage-settings-save');

        // 現在の値を反映
        this.updateStageSettingsUI();

        // 名前は保存ボタン押下時のみ反映（リアルタイム保存しない）
        // イベントリスナーは不要

        // エリアサイズ変更（UI表示のみ、保存ボタンで反映）
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

        // 背景色（スプライトエディタのカラーピッカーを使用）
        if (bgColorSwatch) {
            bgColorSwatch.addEventListener('click', () => {
                this.openBgColorPicker();
            });
        }

        // 透明色
        const transparentSelect = document.getElementById('stage-transparent-index');
        if (transparentSelect) {
            transparentSelect.addEventListener('change', () => {
                App.projectData.stage.transparentIndex = parseInt(transparentSelect.value);
            });
        }

        // BGMサブ項目
        const bgmStage = document.getElementById('bgm-stage');
        const bgmInvincible = document.getElementById('bgm-invincible');
        const bgmClear = document.getElementById('bgm-clear');
        const bgmGameover = document.getElementById('bgm-gameover');

        if (bgmStage) {
            bgmStage.addEventListener('change', () => {
                if (!App.projectData.stage.bgm) App.projectData.stage.bgm = {};
                App.projectData.stage.bgm.stage = bgmStage.value;
            });
        }
        if (bgmInvincible) {
            bgmInvincible.addEventListener('change', () => {
                if (!App.projectData.stage.bgm) App.projectData.stage.bgm = {};
                App.projectData.stage.bgm.invincible = bgmInvincible.value;
            });
        }
        if (bgmClear) {
            bgmClear.addEventListener('change', () => {
                if (!App.projectData.stage.bgm) App.projectData.stage.bgm = {};
                App.projectData.stage.bgm.clear = bgmClear.value;
            });
        }
        if (bgmGameover) {
            bgmGameover.addEventListener('change', () => {
                if (!App.projectData.stage.bgm) App.projectData.stage.bgm = {};
                App.projectData.stage.bgm.gameover = bgmGameover.value;
            });
        }

        // ボスBGM
        const bgmBoss = document.getElementById('bgm-boss');
        if (bgmBoss) {
            bgmBoss.addEventListener('change', () => {
                if (!App.projectData.stage.bgm) App.projectData.stage.bgm = {};
                App.projectData.stage.bgm.boss = bgmBoss.value;
            });
        }

        // クリア条件
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
                // 他の条件でも制限時間は表示する（0なら無制限）
                if (timeLimitRow) timeLimitRow.style.display = '';
            }
        };

        if (clearCondition) {
            clearCondition.addEventListener('change', () => {
                App.projectData.stage.clearCondition = clearCondition.value;
                updateTimeLimitLabel();
            });
        }

        // 制限時間（分秒形式）
        const timeMin = document.getElementById('stage-time-min');
        const timeSec = document.getElementById('stage-time-sec');

        // 入力フィールドのイベント伝播を止める
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

        // 保存ボタン
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                // タイトル保存
                const nameInput = document.getElementById('stage-name-input');
                if (nameInput) {
                    App.projectData.stage.name = nameInput.value;
                    // ゲーム画面タイトルと連動
                    if (App.projectData.meta) {
                        App.projectData.meta.name = nameInput.value || 'NEW GAME';
                    }
                }

                // サイズ変更
                const newWidth = this.pendingAreaW * 16;
                const newHeight = this.pendingAreaH * 16;
                if (newWidth !== App.projectData.stage.width || newHeight !== App.projectData.stage.height) {
                    this.resizeStage(newWidth, newHeight);
                }

                // スコア表示設定
                const showScoreCheck = document.getElementById('stage-show-score');
                if (showScoreCheck) {
                    App.projectData.stage.showScore = showScoreCheck.checked;
                }

                // 設定パネルを閉じる
                panel.classList.add('collapsed');
            });
        }
    },

    updateStageSettingsUI() {
        const stage = App.projectData.stage;

        const nameInput = document.getElementById('stage-name-input');
        const areaWValue = document.getElementById('area-w-value');
        const areaHValue = document.getElementById('area-h-value');
        const bgColorSwatch = document.getElementById('stage-bg-color');
        const transparentSelect = document.getElementById('stage-transparent-index');
        const timeMin = document.getElementById('stage-time-min');
        const timeSec = document.getElementById('stage-time-sec');
        const bgmStage = document.getElementById('bgm-stage');
        const bgmInvincible = document.getElementById('bgm-invincible');
        const bgmClear = document.getElementById('bgm-clear');
        const bgmGameover = document.getElementById('bgm-gameover');
        const bgmBoss = document.getElementById('bgm-boss');

        // 名前（ステージ名またはプロジェクト名）
        if (nameInput) nameInput.value = stage.name || App.projectData.meta?.name || 'NEW GAME';

        // サイズ
        this.pendingAreaW = Math.floor(stage.width / 16);
        this.pendingAreaH = Math.floor(stage.height / 16);
        if (areaWValue) areaWValue.textContent = this.pendingAreaW;
        if (areaHValue) areaHValue.textContent = this.pendingAreaH;

        // 背景色
        if (bgColorSwatch) bgColorSwatch.style.backgroundColor = stage.bgColor || '#3CBCFC';

        // 透明色
        if (transparentSelect) transparentSelect.value = stage.transparentIndex || 0;

        // クリア条件
        const clearConditionEl = document.getElementById('stage-clear-condition');
        const timeLimitLabel = document.getElementById('time-limit-label');
        if (clearConditionEl) {
            clearConditionEl.value = stage.clearCondition || 'none';
            // ラベル更新
            if (stage.clearCondition === 'survival') {
                if (timeLimitLabel) timeLimitLabel.textContent = 'サバイバル時間';
            } else {
                if (timeLimitLabel) timeLimitLabel.textContent = '制限時間';
            }
        }

        // スコア表示設定
        const showScoreCheck = document.getElementById('stage-show-score');
        if (showScoreCheck) {
            // デフォルトはtrue（undefinedの場合もtrue）
            showScoreCheck.checked = stage.showScore !== false;
        }

        // 制限時間（分秒）
        const totalSec = stage.timeLimit || 0;
        if (timeSec) timeSec.value = totalSec % 60;

        // BGM選択肢を動的生成
        this.updateBgmSelects();

        // BGM
        const bgm = stage.bgm || {};
        if (bgmStage) bgmStage.value = bgm.stage || '';
        if (bgmInvincible) bgmInvincible.value = bgm.invincible || '';
        if (bgmClear) bgmClear.value = bgm.clear || '';
        if (bgmGameover) bgmGameover.value = bgm.gameover || '';
        if (bgmBoss) bgmBoss.value = bgm.boss || '';
    },

    updateBgmSelects() {
        const selects = [
            document.getElementById('bgm-stage'),
            document.getElementById('bgm-invincible'),
            document.getElementById('bgm-clear'),
            document.getElementById('bgm-gameover'),
            document.getElementById('bgm-boss')
        ];

        const songs = App.projectData.songs || [];

        selects.forEach(select => {
            if (!select) return;
            const currentValue = select.value;

            // 選択肢をクリアして再構築
            select.innerHTML = '<option value="">なし</option>';

            songs.forEach((song, idx) => {
                const option = document.createElement('option');
                option.value = idx.toString();
                option.textContent = song.name || `SONG ${idx + 1}`;
                select.appendChild(option);
            });

            // 元の選択を復元
            select.value = currentValue;
        });
    },

    resizeStage(newWidth, newHeight) {
        const stage = App.projectData.stage;
        const oldWidth = stage.width;
        const oldHeight = stage.height;

        // 新しいレイヤー配列を作成
        const newFg = App.create2DArray(newWidth, newHeight, -1);
        const newBg = App.create2DArray(newWidth, newHeight, -1);
        const newCollision = App.create2DArray(newWidth, newHeight, 0);

        // 縦：+は上に追加（既存データは下にシフト）、-は上から削除
        // 横：+は右に追加、-は右から削除
        const heightDiff = newHeight - oldHeight;
        const yOffset = heightDiff > 0 ? heightDiff : 0; // 拡大時の縦オフセット
        const srcYStart = heightDiff < 0 ? -heightDiff : 0; // 縮小時のソース開始行

        // 既存データをコピー（上に追加/上から削除対応）
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

        // スクロール位置を左下から表示するように設定
        // 縦（Y）：ステージの下端がキャンバス下端に来るように
        this.canvasScrollX = 0;
        const canvasHeight = 320; // キャンバスの高さ（固定）
        const stagePixelHeight = newHeight * this.tileSize;
        this.canvasScrollY = stagePixelHeight > canvasHeight ? -(stagePixelHeight - canvasHeight) : 0;

        this.resize();
        this.render();
    },

    openBgColorPicker() {
        // SpriteEditorと同じフルカラーピッカーを実装
        const currentColor = App.projectData.stage.bgColor || '#3CBCFC';

        // よく使う色プリセット
        const recentColors = [
            '#3CBCFC', '#000000', '#ffffff', '#ff0000',
            '#00ff00', '#0000ff', '#ffff00', '#ff00ff',
            '#00ffff', '#ff6b6b', '#4ecdc4', '#96ceb4'
        ];

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
            <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:16px;">背景色</div>
            <div style="display:flex;gap:12px;margin-bottom:16px;">
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">現在</div>
                    <div id="cp-current" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${currentColor};opacity:0.7;"></div>
                </div>
                <div style="flex:1;text-align:center;">
                    <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">編集中</div>
                    <div id="cp-new" style="width:100%;height:50px;border-radius:8px;border:2px solid #444466;background:${currentColor};"></div>
                </div>
            </div>
            <div id="cp-picker-area" style="height:200px;position:relative;margin-bottom:12px;">
                <div id="cp-hsv" style="position:absolute;top:0;left:0;right:0;bottom:0;">
                    <div id="cp-sb-box" class="sb-box" style="position:relative;width:100%;height:160px;border-radius:8px;cursor:crosshair;margin-bottom:12px;overflow:hidden;background:#ff0000;">
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to right,#fff,transparent);"></div>
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,transparent,#000);"></div>
                        <div id="cp-sb-cursor" style="position:absolute;width:16px;height:16px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;z-index:10;transform:translate(-50%,-50%);left:100%;top:0%;"></div>
                    </div>
                    <div id="cp-hue-slider" class="hue-slider" style="position:relative;height:24px;border-radius:12px;background:linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000);cursor:pointer;">
                        <div id="cp-hue-cursor" style="position:absolute;top:50%;width:8px;height:28px;background:#fff;border-radius:4px;box-shadow:0 0 4px rgba(0,0,0,0.5);pointer-events:none;transform:translate(-50%,-50%);left:0%;"></div>
                    </div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                <label style="color:#8888aa;font-size:12px;">HEX</label>
                <input type="text" id="cp-hex" value="${currentColor}" maxlength="7" style="flex:1;padding:10px 12px;border:2px solid #444466;border-radius:8px;background:#1a1a2e;color:#fff;font-family:monospace;font-size:14px;text-transform:uppercase;">
            </div>
            <div style="margin-bottom:16px;">
                <div style="color:#8888aa;font-size:11px;margin-bottom:6px;">よく使う色</div>
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
        };

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

        // よく使う色
        recentColors.forEach(c => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `width:28px;height:28px;border-radius:6px;cursor:pointer;border:2px solid #444466;background:${c};`;
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
            this.updateStageSettingsUI();
            this.initTemplateList(); // タイルパレットサムネイル更新
            this.initSpriteGallery(); // スプライトギャラリー更新
            this.render();
            close();
        });

        modal.querySelector('#cp-cancel').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    },

    // SEプレビュー再生
    playSePreview(seIndex) {
        const sounds = App.projectData?.sounds || [];
        if (seIndex < 0 || seIndex >= sounds.length) return;

        const se = sounds[seIndex];

        // グローバルオーディオエンジンを使用
        const audio = window.NesAudio || window.AudioManager;
        if (audio) {
            console.log('Previewing SE:', se.name, se.type);
            audio.playSE(se.type);
        } else {
            console.error('Audio engine (NesAudio/AudioManager) not found.');
        }
    }
};

