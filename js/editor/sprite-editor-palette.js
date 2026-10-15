/**
 * SpriteEditorPalette
 * カラーパレット管理（表示・編集・プリセット・CRUD）
 */
const SpriteEditorPalette = {
    editor: null,

    init(parentEditor) {
        this.editor = parentEditor;
        this.initColorPalette();
        this.initAddColorButton();
        this.initPresetDialogEvents();
    },

    initColorPalette() {
        const container = document.getElementById('color-list');
        if (!container) return;

        container.innerHTML = '';

        const palette = App.nesPalette;

        palette.forEach((color, index) => {
            const div = document.createElement('div');
            div.className = 'palette-color' + (index === this.editor.selectedColor ? ' selected' : '');
            div.style.backgroundColor = color;

            // 長押しで削除
            let longPressTimer;
            let isLongPress = false;

            const startLongPress = () => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    App.showActionMenu(null, [
                        { text: App.I18N['U177']?.[App.currentLang] || '複製', action: () => this.duplicateColor(index) },
                        { text: App.I18N['U178']?.[App.currentLang] || '削除', style: 'destructive', action: () => this.deleteColor(index, false) },
                        { text: App.I18N['U179']?.[App.currentLang] || 'キャンセル', style: 'cancel' }
                    ]);
                }, 600);
            };

            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };

            div.addEventListener('mousedown', startLongPress);
            div.addEventListener('mouseup', cancelLongPress);
            div.addEventListener('mouseleave', cancelLongPress);
            div.addEventListener('touchstart', startLongPress, { passive: true });
            div.addEventListener('touchmove', cancelLongPress, { passive: true });
            div.addEventListener('touchend', cancelLongPress);

            // 選択中の色を再タップで編集、それ以外は選択（結果ダブルタップでも編集が開く）
            div.addEventListener('click', () => {
                if (isLongPress) return;
                if (this.editor.selectedColor === index) {
                    this.editColor(index);
                } else {
                    this.selectColor(index);
                }
            });

            container.appendChild(div);
        });
    },

    // ＋ボタンのイベント設定（init時に1回だけ呼ばれる）
    initAddColorButton() {
        const addBtn = document.getElementById('add-color-btn');
        if (!addBtn || addBtn.dataset.initialized) return; // 既に初期化済みならスキップ
        addBtn.dataset.initialized = 'true';

        let longPressTimer = null;
        let isLongPress = false;

        const startPress = () => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                this.openPresetDialog();
            }, 800);
        };

        const endPress = () => {
            clearTimeout(longPressTimer);
            if (!isLongPress) {
                // 短押し: 色追加（追加した色を選択状態にする）
                App.nesPalette.push('#000000');
                this.editor.selectedColor = App.nesPalette.length - 1;
                this.initColorPalette();
            }
        };

        addBtn.addEventListener('mousedown', startPress);
        addBtn.addEventListener('mouseup', endPress);
        addBtn.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
        addBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); }, { passive: false });
        addBtn.addEventListener('touchend', (e) => { e.preventDefault(); endPress(); }, { passive: false });
        addBtn.addEventListener('touchcancel', () => clearTimeout(longPressTimer));
    },

    // プリセット選択ダイアログを開く
    openPresetDialog() {
        const dialog = document.getElementById('palette-preset-dialog');
        if (dialog) {
            // 未選択状態で開く
            document.querySelectorAll('#palette-preset-list .preset-item').forEach(item => {
                item.classList.remove('selected');
                const arrow = item.querySelector('.preset-item-arrow');
                if (arrow) arrow.textContent = '';
            });
            dialog.classList.remove('hidden');
        }
    },

    // プリセット選択ダイアログを閉じる
    closePresetDialog() {
        const dialog = document.getElementById('palette-preset-dialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
    },

    // プリセットを適用（追加モード）
    applyPresetAdd() {
        const selected = document.querySelector('#palette-preset-list .preset-item.selected');
        if (!selected) {
            alert(App.I18N['U180']?.[App.currentLang] || 'プリセットを選択してください');
            return;
        }
        const preset = App.PALETTE_PRESETS[selected.dataset.value];
        if (preset) {
            // 既存パレットに追加
            preset.colors.forEach(color => {
                if (!App.nesPalette.includes(color)) {
                    App.nesPalette.push(color);
                }
            });
            this.initColorPalette();
            this.closePresetDialog();
        }
    },

    // プリセットを適用（置換モード）
    applyPresetReplace() {
        const selected = document.querySelector('#palette-preset-list .preset-item.selected');
        if (!selected) {
            alert(App.I18N['U180']?.[App.currentLang] || 'プリセットを選択してください');
            return;
        }

        const msg = App.I18N['U181']?.[App.currentLang] || '現在のパレットをおきかえますか？\nピクセルの色が変わる可能性があります。';
        const parts = msg.split('\n');

        App.showConfirm(parts[0], parts[1], () => {
            const preset = App.PALETTE_PRESETS[selected.dataset.value];
            if (preset) {
                App.nesPalette = preset.colors.slice();
                this.initColorPalette();
                this.closePresetDialog();
            }
        });
    },

    // プリセットダイアログのイベント初期化
    initPresetDialogEvents() {
        const addBtn = document.getElementById('preset-add-btn');
        const replaceBtn = document.getElementById('preset-replace-btn');
        const closeBtn = document.getElementById('preset-close-btn');
        const dialog = document.getElementById('palette-preset-dialog');

        if (addBtn) addBtn.addEventListener('click', () => this.applyPresetAdd());
        if (replaceBtn) replaceBtn.addEventListener('click', () => this.applyPresetReplace());
        if (closeBtn) closeBtn.addEventListener('click', () => this.closePresetDialog());

        // 各項目のクリックで選択（‖＋ライトグレー背景）
        document.querySelectorAll('#palette-preset-list .preset-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('#palette-preset-list .preset-item').forEach(el => {
                    el.classList.remove('selected');
                    const a = el.querySelector('.preset-item-arrow');
                    if (a) a.textContent = '';
                });
                item.classList.add('selected');
                const arrow = item.querySelector('.preset-item-arrow');
                if (arrow) arrow.textContent = '▶';
            });
        });

        // 背景クリックで閉じる
        if (dialog) {
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) this.closePresetDialog();
            });
        }
    },

    // 色を削除（確認あり）
    deleteColor(index, needConfirm = true) {
        if (App.nesPalette.length <= 1) {
            alert(App.I18N['U183']?.[App.currentLang] || '最低1色は必要です');
            return;
        }
        if (needConfirm && !confirm('この色を削除しますか？\n（使用されているドットは透明になります）')) {
            return;
        }

        // スプライト内の参照を更新（削除）
        this.editor.updateAllSpriteColorReferences('delete', index);

        App.nesPalette.splice(index, 1);
        if (this.editor.selectedColor >= App.nesPalette.length) {
            this.editor.selectedColor = App.nesPalette.length - 1;
        }
        this.initColorPalette();
    },

    // 色を複製
    duplicateColor(index) {
        const color = App.nesPalette[index];

        // スプライト内の参照を更新（挿入によるズレ補正）
        // index+1 の位置に挿入される
        this.editor.updateAllSpriteColorReferences('insert', index + 1);

        // 該当色の後ろに追加
        App.nesPalette.splice(index + 1, 0, color);
        // 追加した色を選択状態にする
        this.editor.selectedColor = index + 1;
        this.initColorPalette();
    },

    editColor(index) {
        ColorPicker.open({
            initialColor: App.nesPalette[index],
            swatches: [
                '#000000', '#ffffff', '#ff0000', '#00ff00',
                '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
                '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'
            ],
            onApply: (hex) => {
                App.nesPalette[index] = hex;
                this.initColorPalette();
                this.editor.render();
                this.editor.initSpriteGallery();
            }
        });
    },

    selectColor(index) {
        this.editor.selectedColor = index;
        document.querySelectorAll('.palette-color').forEach((el, i) => {
            el.classList.toggle('selected', i === index);
        });
    }
};
