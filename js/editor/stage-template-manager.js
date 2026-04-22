/**
 * PixelGameKit - ステージエディタ テンプレート管理
 */

class StageTemplateManager {
    constructor(owner) {
        this.owner = owner; // StageEditor reference
        this.autoScrollTimer = null;
        this.autoScrollDelayTimer = null;
    }

    // ========== テンプレート保存 ==========
    saveTemplate() {
        if (!this.owner.editingTemplate) return;

        // IDLEまたはメインスプライトが必須
        const idleFrames = this.owner.editingTemplate.sprites?.idle?.frames || [];
        const mainFrames = this.owner.editingTemplate.sprites?.main?.frames || [];
        const hasMainSprite = idleFrames.length > 0 || mainFrames.length > 0;

        if (!hasMainSprite) {
            alert(this.owner.t('U285'));
            return;
        }

        if (!App.projectData.templates) {
            App.projectData.templates = [];
        }

        // 既存テンプレート編集時：古いスプライトIDを新しいIDで置換
        if (this.owner.editingIndex >= 0) {
            const oldTemplate = App.projectData.templates[this.owner.editingIndex];
            const oldSpriteId = oldTemplate?.sprites?.idle?.frames?.[0] ?? oldTemplate?.sprites?.main?.frames?.[0];
            const newSpriteId = this.owner.editingTemplate.sprites?.idle?.frames?.[0] ?? this.owner.editingTemplate.sprites?.main?.frames?.[0];

            // スプライトIDが変更された場合、ステージ上を置換
            if (oldSpriteId !== undefined && newSpriteId !== undefined && oldSpriteId !== newSpriteId) {
                this.replaceSpritesInStage(oldSpriteId, newSpriteId);
            }

            App.projectData.templates[this.owner.editingIndex] = this.owner.editingTemplate;
        } else {
            App.projectData.templates.push(this.owner.editingTemplate);
            this.owner.selectedTemplate = App.projectData.templates.length - 1;
        }

        this.owner.closeConfigPanel();
        this.owner.initTemplateList();
        this.owner.render(); // ステージを再描画
    }

    // ステージ上のスプライトIDを置換
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
    }

    // ========== テンプレートリスト表示 ==========
    initTemplateList() {
        const container = document.getElementById('tile-list');
        if (!container) return;

        container.innerHTML = '';

        if (!App.projectData.templates) {
            App.projectData.templates = [];
        }
        this.owner.templates = App.projectData.templates;

        const typeIcons = {
            player: '👤',
            enemy: '👾',
            material: '🧱',
            item: '💎',
            goal: '🏁'
        };

        const basePlayerIdx = this.owner.templates.findIndex(t => t.type === 'player');

        this.owner.templates.forEach((template, index) => {
            const div = document.createElement('div');
            div.className = 'tile-item' + (this.owner.selectedTemplate === index ? ' selected' : '');

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
                    this.owner.renderSpriteToMiniCanvas(firstSprite, miniCanvas, this.owner.getBackgroundColor());
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
                            this.owner.renderSpriteToMiniCanvas(sprite, miniCanvas, this.owner.getBackgroundColor());
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

                const state = this.owner.tileClickState;

                // 同じタイルへの2連続のクリック（ダブルタップ）
                if (state.index === index && state.count === 1) {
                    clearTimeout(state.timer);
                    state.count = 0;
                    state.index = null;

                    // ダブルタップ：設定表示
                    this.owner.editingTemplate = { ...template, sprites: { ...template.sprites } };
                    this.owner.editingIndex = index;
                    this.owner.openConfigPanel();
                } else {
                    // 最初のクリック：座標に選択
                    clearTimeout(state.timer);
                    state.index = index;
                    state.count = 1;

                    // 座標に選択を更新（表示もリファクタなし）
                    this.owner.selectedTemplate = index;
                    this.owner.initTemplateList();

                    // ダブルタップ用タイマ：２回目のクリックがなければリセット
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
                        { text: this.owner.t('U286'), action: () => this.duplicateTemplate(index) },
                        { text: this.owner.t('U287'), style: 'destructive', action: () => this.deleteTemplate(index, false) },
                        { text: this.owner.t('U288'), style: 'cancel' }
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
    }

    // テンプレートリストの項目を削除
    deleteTemplate(index, needConfirm = true) {
        if (needConfirm && !confirm('このタイルを削除しますか？')) {
            return;
        }

        // マップ上のテンプレート参照を更新（削除前に実行）
        this.updateMapTemplateReferences('delete', index);

        // テンプレートを削除
        App.projectData.templates.splice(index, 1);

        if (this.owner.selectedTemplate === index) {
            this.owner.selectedTemplate = null;
            this.owner.closeConfigPanel();
        } else if (this.owner.selectedTemplate > index) {
            this.owner.selectedTemplate--;
        }
        this.owner.initTemplateList();
        this.owner.render();
    }

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
        if (this.owner.selectedTemplate !== null) {
            if (this.owner.selectedTemplate > index) {
                this.owner.selectedTemplate++;
            } else if (this.owner.selectedTemplate === index) {
                this.owner.selectedTemplate = index + 1; // 複製を選択
            }
        }

        this.owner.initTemplateList();
        this.owner.render();
    }

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

        // キャンバス上の該当タイルをすべて-1に置換
        for (let y = 0; y < stage.height; y++) {
            for (let x = 0; x < stage.width; x++) {
                if (layer[y][x] === spriteIdx) {
                    layer[y][x] = -1;
                }
            }
        }
    }

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
                stage.entities = stage.entities.filter(e => e.templateId !== index);

                // 削除箇所以降のIDを-1
                stage.entities.forEach(e => {
                    if (e.templateId > index) {
                        e.templateId--;
                    }
                });
            }
        }
    }

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
    }

    startAutoScroll(dx, dy) {
        this.owner.autoScrollX = dx;
        this.owner.autoScrollY = dy;
        if (this.autoScrollTimer || this.autoScrollDelayTimer) return;

        this.autoScrollDelayTimer = setTimeout(() => {
            this.autoScrollDelayTimer = null;
            this.autoScrollTimer = setInterval(() => {
                const stage = App.projectData?.stage;
                if (!stage || (!this.owner.selectionMode && !this.owner.pasteMode)) {
                    this.stopAutoScroll();
                    return;
                }

                const maxScrollX = Math.max(0, (stage.width - 16) * this.owner.tileSize);
                const maxScrollY = Math.max(0, (stage.height - 16) * this.owner.tileSize);

                const oldX = this.owner.canvasScrollX;
                const oldY = this.owner.canvasScrollY;

                // dx, dy が正ならカーソルは右/下端にある -> 表示領域を右/下に動かす = canvasScrollX/Y は負の方向に減る
                this.owner.canvasScrollX = Math.max(-maxScrollX, Math.min(0, this.owner.canvasScrollX - this.owner.autoScrollX));
                this.owner.canvasScrollY = Math.max(-maxScrollY, Math.min(0, this.owner.canvasScrollY - this.owner.autoScrollY));

                if (this.owner.canvasScrollX === oldX && this.owner.canvasScrollY === oldY) return;

                if (this.owner.lastPointerEvent && this.owner.handleAutoScrollMove) {
                    this.owner.handleAutoScrollMove(this.owner.lastPointerEvent);
                }
                this.owner.render();
            }, 30);
        }, 300);
    }
}
