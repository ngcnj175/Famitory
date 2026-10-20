/**
 * PixelGameKit - ステージエディタ 設定パネル
 */

class StageSettings {
    constructor(owner) {
        this.owner = owner;
    }

    initStageSettings() {
        const panel = document.getElementById('stage-settings-panel');
        const header = document.getElementById('stage-settings-header');
        if (!panel || !header) return;

        // パネル内のクリック/タッチイベントがキャンバスに伝わらないように
        panel.addEventListener('click', (e) => e.stopPropagation());
        panel.addEventListener('touchstart', (e) => e.stopPropagation());
        panel.addEventListener('touchend', (e) => e.stopPropagation());

        // ヘッダクリックでパネル開閉
        header.addEventListener('click', () => {
            const wasCollapsed = panel.classList.contains('collapsed');
            panel.classList.toggle('collapsed');

            // パネルを開く時にpendingArea値を現在のステージサイズから最新に
            if (wasCollapsed) {
                this.owner.pendingAreaW = Math.floor(App.projectData.stage.width / 16);
                this.owner.pendingAreaH = Math.floor(App.projectData.stage.height / 16);
                this.updateStageSettingsUI();
                this.adjustContentMaxHeight();
            }
        });

        window.addEventListener('resize', () => {
            if (!panel.classList.contains('collapsed')) this.adjustContentMaxHeight();
        }, { passive: true });

        // 一時的なサイズ値（保存ボタン押下まで反映しない）
        this.owner.pendingAreaW = Math.floor(App.projectData.stage.width / 16);
        this.owner.pendingAreaH = Math.floor(App.projectData.stage.height / 16);

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

        // エリアサイズ変更（UI表示のみ、保存ボタンまで反映しない）
        if (areaWMinus) {
            areaWMinus.addEventListener('click', () => {
                if (this.owner.pendingAreaW > 1) {
                    this.owner.pendingAreaW--;
                    if (areaWValue) areaWValue.textContent = this.owner.pendingAreaW;
                }
            });
        }
        if (areaWPlus) {
            areaWPlus.addEventListener('click', () => {
                if (this.owner.pendingAreaW < 32) {
                    this.owner.pendingAreaW++;
                    if (areaWValue) areaWValue.textContent = this.owner.pendingAreaW;
                }
            });
        }
        if (areaHMinus) {
            areaHMinus.addEventListener('click', () => {
                if (this.owner.pendingAreaH > 1) {
                    this.owner.pendingAreaH--;
                    if (areaHValue) areaHValue.textContent = this.owner.pendingAreaH;
                }
            });
        }
        if (areaHPlus) {
            areaHPlus.addEventListener('click', () => {
                if (this.owner.pendingAreaH < 32) {
                    this.owner.pendingAreaH++;
                    if (areaHValue) areaHValue.textContent = this.owner.pendingAreaH;
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

        // BGM選択ボタン
        this.owner.selectedBgmType = null;
        document.querySelectorAll('.bgm-select-btn[data-bgm-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.owner.selectedBgmType = btn.dataset.bgmType;
                this.owner.openBgmSelectPopup();
            });
        });

        // BGMポップアップ背景クリックで閉じる
        const bgmPopup = document.getElementById('bgm-select-popup');
        if (bgmPopup) {
            bgmPopup.addEventListener('click', (e) => {
                if (e.target === bgmPopup) {
                    bgmPopup.classList.add('hidden');
                    this.owner.stopBgmPreview();
                }
            });
        }

        // 折りたたみグループ（BGM/効果音・サブカテゴリ）
        // トグル記号は常に ▼ を保持し、collapsed 時は CSS で回転させる（サイズ変化防止）
        document.querySelectorAll('.setting-group-header, .se-subgroup-header').forEach(header => {
            const toggle = header.querySelector('.setting-group-toggle, .se-subgroup-toggle');
            if (toggle) toggle.textContent = '▼';
            header.addEventListener('click', () => {
                const group = header.closest('.setting-group, .se-subgroup');
                if (!group) return;
                group.classList.toggle('collapsed');
            });
        });

        // 効果音カテゴリ別選択ボタン
        document.querySelectorAll('.stage-se-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.seCategory;
                const key = btn.dataset.seKey;
                this.owner.openStageSeSelectPopup(category, key);
            });
        });

        // 基本ルールに応じて制限時間ラベルを「サバイバル時間 / 制限時間」で切替
        const clearCondition = document.getElementById('stage-clear-condition');
        const timeLimitLabel = document.getElementById('time-limit-label');

        const updateTimeLimitLabel = () => {
            if (!timeLimitLabel) return;
            const key = clearCondition?.value === 'survival' ? 'U293' : 'U061';
            const fallback = key === 'U293' ? 'サバイバル時間' : '制限時間';
            timeLimitLabel.textContent = AppI18N.I18N[key]?.[AppI18N.currentLang] || fallback;
        };

        if (clearCondition) {
            clearCondition.addEventListener('change', updateTimeLimitLabel);
            updateTimeLimitLabel();
        }

        // 保存ボタンでの一括保存処理
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const stage = App.projectData.stage;

                // 基本ルールをフォーム値から保存
                if (clearCondition) {
                    stage.clearCondition = clearCondition.value;
                }

                // 制限時間をフォーム値から保存
                const timeMin = document.getElementById('stage-time-min');
                const timeSec = document.getElementById('stage-time-sec');
                if (timeMin && timeSec) {
                    const min = parseInt(timeMin.value) || 0;
                    const sec = parseInt(timeSec.value) || 0;
                    stage.timeLimit = min * 60 + sec;
                }

                // サバイバルモードで制限時間が0の場合はエラー
                if (stage.clearCondition === 'survival' && (!stage.timeLimit || stage.timeLimit <= 0)) {
                    const message = AppI18N.I18N['U394']?.[AppI18N.currentLang] || 'サバイバルモードでは制限時間を設定してください';
                    alert(message);
                    return;
                }

                // スコア表示設定
                const showScoreCheck = document.getElementById('stage-show-score');
                if (showScoreCheck) {
                    stage.showScore = showScoreCheck.checked;
                }

                // 背景透過インデックス
                if (transparentSelect) {
                    stage.transparentIndex = parseInt(transparentSelect.value) || 0;
                }

                // サイズ変更（最後に実行して再描画処理を含ませる）
                const newWidth = this.owner.pendingAreaW * 16;
                const newHeight = this.owner.pendingAreaH * 16;
                const sizeChanged = (newWidth !== stage.width || newHeight !== stage.height);

                const finalize = () => {
                    if (sizeChanged) this.resizeStage(newWidth, newHeight);
                    App.updateGameInfo();
                    panel.classList.add('collapsed');
                };

                // 縮小によって範囲外のタイル/エンティティが失われる場合は確認
                if (sizeChanged && this.countOutOfRangeData(newWidth, newHeight) > 0) {
                    const lang = AppI18N.currentLang;
                    const msg = AppI18N.I18N['U600']?.[lang] || 'ステージを縮小すると範囲外のデータが削除されます';
                    const sub = AppI18N.I18N['U552']?.[lang] || 'この操作は取り消せません。';
                    AppDialogs.showConfirm(msg, sub, finalize);
                } else {
                    finalize();
                }
            });
        }
    }

    updateStageSettingsUI(preserveFormState = false) {
        const stage = App.projectData.stage;

        const areaWValue = document.getElementById('area-w-value');
        const areaHValue = document.getElementById('area-h-value');
        const bgColorSwatch = document.getElementById('stage-bg-color');
        const transparentSelect = document.getElementById('stage-transparent-index');
        const timeMin = document.getElementById('stage-time-min');
        const timeSec = document.getElementById('stage-time-sec');

        // ステージサイズ（preserveFormState時は現在のUI値を保持）
        if (!preserveFormState) {
            this.owner.pendingAreaW = Math.floor(stage.width / 16);
            this.owner.pendingAreaH = Math.floor(stage.height / 16);
        }
        if (areaWValue) areaWValue.textContent = this.owner.pendingAreaW;
        if (areaHValue) areaHValue.textContent = this.owner.pendingAreaH;

        // 背景色
        if (bgColorSwatch) bgColorSwatch.style.backgroundColor = stage.bgColor || '#3CBCFC';

        // 透明色
        if (transparentSelect) transparentSelect.value = stage.transparentIndex || 0;

        // 基本ルール・制限時間・スコア表示（preserveFormState時はフォームの現在値を保持）
        const clearConditionEl = document.getElementById('stage-clear-condition');
        const timeLimitLabel = document.getElementById('time-limit-label');
        const showScoreCheck = document.getElementById('stage-show-score');
        if (!preserveFormState) {
            if (clearConditionEl) {
                // 旧データ ('item'/'boss') は 'none' に正規化（配置ベースで自動判定される）
                const current = stage.clearCondition || 'none';
                clearConditionEl.value = (current === 'item' || current === 'boss') ? 'none' : current;
                if (timeLimitLabel) {
                    const key = current === 'survival' ? 'U293' : 'U061';
                    const fallback = key === 'U293' ? 'サバイバル時間' : '制限時間';
                    timeLimitLabel.textContent = AppI18N.I18N[key]?.[AppI18N.currentLang] || fallback;
                }
            }
            const totalSec = stage.timeLimit || 0;
            if (timeMin) timeMin.value = Math.floor(totalSec / 60);
            if (timeSec) timeSec.value = totalSec % 60;
            if (showScoreCheck) showScoreCheck.checked = stage.showScore !== false;
        }

        // BGMボタン表示を更新
        this.updateBgmSelects();
        // 効果音ボタン表示を更新
        this.updateStageSeSelects();
    }

    updateStageSeSelects() {
        const sounds = App.projectData?.sounds || [];
        const se = App.projectData?.stage?.se || {};
        document.querySelectorAll('.stage-se-btn').forEach(btn => {
            const category = btn.dataset.seCategory;
            const key = btn.dataset.seKey;
            const type = se?.[category]?.[key];
            if (!type) {
                btn.textContent = (App.currentLang === 'ENG') ? 'None' : 'なし';
            } else {
                const s = sounds.find(x => x.type === type);
                btn.textContent = s?.name || type;
            }
        });
    }

    updateBgmSelects() {
        const bgmTypes = ['stage', 'invincible', 'clear', 'gameover', 'boss'];
        const songs = App.projectData.songs || [];
        const bgm = App.projectData.stage?.bgm || {};

        bgmTypes.forEach(type => {
            const btn = document.getElementById(`bgm-${type}-btn`);
            if (!btn) return;

            const value = bgm[type];
            if (value === '' || value === undefined || value === null) {
                btn.textContent = (App.currentLang === 'ENG') ? 'None' : 'なし';
            } else {
                const idx = parseInt(value);
                const song = songs[idx];
                btn.textContent = song?.name || `BGM ${idx + 1}`;
            }
        });
    }

    /**
     * 縮小/シフトによって削除されるタイル・エンティティの数を返す
     * resizeStage() の縮小ルール（上側シフト・右側切り捨て）と一致させる
     */
    countOutOfRangeData(newWidth, newHeight) {
        const stage = App.projectData.stage;
        const oldWidth = stage.width;
        const oldHeight = stage.height;
        const heightDiff = newHeight - oldHeight;
        const srcYStart = heightDiff < 0 ? -heightDiff : 0;

        let count = 0;
        const checkLayer = (layer, empty) => {
            if (!Array.isArray(layer)) return;
            for (let y = 0; y < oldHeight; y++) {
                const row = layer[y];
                if (!Array.isArray(row)) continue;
                for (let x = 0; x < oldWidth; x++) {
                    if (y < srcYStart || x >= newWidth) {
                        if (row[x] !== undefined && row[x] !== empty) count++;
                    }
                }
            }
        };
        checkLayer(stage.layers?.fg, -1);
        checkLayer(stage.layers?.bg, -1);
        checkLayer(stage.layers?.collision, 0);

        if (Array.isArray(stage.entities)) {
            for (const e of stage.entities) {
                const newY = e.y + heightDiff;
                if (newY < 0 || newY >= newHeight || e.x < 0 || e.x >= newWidth) count++;
            }
        }
        return count;
    }

    resizeStage(newWidth, newHeight) {
        const stage = App.projectData.stage;
        const oldWidth = stage.width;
        const oldHeight = stage.height;

        // 新しいレイヤー配列を作成
        const newFg = App.create2DArray(newWidth, newHeight, -1);
        const newBg = App.create2DArray(newWidth, newHeight, -1);
        const newCollision = App.create2DArray(newWidth, newHeight, 0);

        // 縦方向は上に追加、古いデータは下にシフト；横方向は上から削除
        // 横方向は右に追加、古いデータは右から削除
        const heightDiff = newHeight - oldHeight;
        const yOffset = heightDiff > 0 ? heightDiff : 0; // 拡大時のオフセット
        const srcYStart = heightDiff < 0 ? -heightDiff : 0; // 縮小時のソース開始位置

        // 既存のデータをコピー（上に追加/下から削除対応）
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

        // スクロール位置を左下から表示するようにリセット
        // 縦方向：ステージの上辺がキャンバス上辺に来るように
        this.owner.canvasScrollX = 0;
        const canvasHeight = 320; // キャンバスの高さ（固定値）
        const stagePixelHeight = newHeight * this.owner.tileSize;
        this.owner.canvasScrollY = stagePixelHeight > canvasHeight ? -(stagePixelHeight - canvasHeight) : 0;

        this.owner.resize();
        this.owner.render();
    }

    openBgColorPicker() {
        const lang = AppI18N.currentLang;
        const t = (id, fallback) => AppI18N.I18N?.[id]?.[lang] || fallback;
        ColorPicker.open({
            initialColor: App.projectData.stage.bgColor || '#3CBCFC',
            title: t('U430', 'カラー編集'),
            swatchesLabel: t('U452', 'カラーパレット'),
            swatches: App.nesPalette || [],
            onApply: (hex) => {
                App.projectData.stage.bgColor = hex;
                this.updateStageSettingsUI(true);
                this.owner.initTemplateList();
                this.owner.initSpriteGallery();
                this.owner.render();
            }
        });
    }

    adjustContentMaxHeight() {
        const content = document.getElementById('stage-settings-content');
        const panelHeader = document.getElementById('stage-settings-header');
        const screen = document.getElementById('stage-screen');
        if (!content || !panelHeader || !screen) return;
        const available = screen.offsetHeight - panelHeader.offsetHeight;
        content.style.maxHeight = Math.max(200, available - 2) + 'px';
    }

    playSePreview(seIndex) {
        const sounds = App.projectData?.sounds || [];
        if (seIndex < 0 || seIndex >= sounds.length) return;
        const se = sounds[seIndex];
        window.NesAudio?.playSE(se.type);
    }
}
