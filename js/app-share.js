/**
 * PixelGameKit - シェア機能
 */

const AppShare = {

    // 共有ダイアログの公開ステータスバッジを更新
    updateShareStatus() {
        const badge = document.getElementById('share-status');
        if (!badge) return;
        const hasShareId = !!(App.projectData?.meta?.shareId);
        badge.classList.toggle('hidden', !hasShareId);
    },

    // 公開確認ダイアログを表示し、OKされたら onConfirm を呼ぶ
    showPublishConfirm(isFirstTime, onConfirm) {
        const modal = document.getElementById('publish-confirm-modal');
        const msgEl = document.getElementById('publish-confirm-msg');
        const subEl = document.getElementById('publish-confirm-sub');
        const okBtn = document.getElementById('publish-confirm-ok');
        const cancelBtn = document.getElementById('publish-confirm-cancel');
        if (!modal || !okBtn || !cancelBtn) return;

        msgEl.textContent = isFirstTime
            ? (AppI18N.I18N['U373']?.[AppI18N.currentLang] || 'この作品を公開しますか？')
            : (AppI18N.I18N['U374']?.[AppI18N.currentLang] || '公開中の作品を更新しますか？');
        subEl.textContent = isFirstTime
            ? (AppI18N.I18N['U375']?.[AppI18N.currentLang] || 'URLが発行され、だれでもプレイできるようになります')
            : (AppI18N.I18N['U376']?.[AppI18N.currentLang] || '現在の内容で上書き保存されます');

        modal.classList.remove('hidden');

        const close = () => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            modal.onclick = null;
        };

        okBtn.onclick = async () => { close(); await onConfirm(); };
        cancelBtn.onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };
    },

    // 公開確認→actionFn(url)→Firebase保存 の順で実行するヘルパー
    // iOS Safari ではユーザージェスチャー直後でないとクリップボードAPIが使えないため、
    // Firebase保存（ネットワーク通信）より先に actionFn を実行する
    async publishAndShare(actionFn) {
        if (this._shareLoading) {
            App.showToast('処理中です…少しお待ちください');
            return;
        }

        const isFirstTime = !App.projectData?.meta?.shareId;

        // URLを事前に確定（初回はIDを先に生成、2回目以降は既存IDを使い回す）
        const shareId = App.projectData.meta?.shareId || Share.generateShortId();
        const url = Share.createShortUrl(shareId);

        this.showPublishConfirm(isFirstTime, async () => {
            // --- ユーザージェスチャー直後（「はい」タップ） ---
            // クリップボードコピーや window.open はここで実行しないとiOSで失敗する
            await actionFn(url);

            // --- 以降はバックグラウンドでFirebase保存 ---
            if (!window.firebaseDB || typeof Share === 'undefined') {
                App.showToast('クラウド接続がありません');
                return;
            }

            this._shareLoading = true;

            try {
                // 保存前にリミックスOKフラグを更新
                const remixOkCheckbox = document.getElementById('share-remix-ok');
                if (remixOkCheckbox) {
                    App.projectData.meta.remixOK = remixOkCheckbox.checked;
                }

                const id = await Share.saveOrUpdateGame(shareId, App.projectData, !isFirstTime);

                if (!id) {
                    App.showToast('保存に失敗しました');
                    this._shareLoading = false;
                    return;
                }

                App.projectData.meta.shareId = id;
                if (App.currentProjectName) {
                    Storage.saveProject(App.currentProjectName, App.projectData);
                }

                App._shareUrl = url;
                this.updateShareStatus();
                App.showToast(isFirstTime ? '公開しました' : '更新しました');
            } catch (e) {
                console.error('[Share] publishAndShare error:', e);
                App.showToast('保存でエラーが発生しました');
            } finally {
                this._shareLoading = false;
            }
        });
    },

    // クリップボードコピー（iOS対応強化版）
    async copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                console.warn('Clipboard API failed, falling back to legacy:', e);
            }
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.contentEditable = true;
        textarea.readOnly = false;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);

        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textarea.setSelectionRange(0, 999999);

        let success = false;
        try {
            success = document.execCommand('copy');
        } catch (e) {
            console.error('execCommand copy failed:', e);
        }

        document.body.removeChild(textarea);
        selection.removeAllRanges();
        return success;
    },

    // シェアモーダル簡易版イベント
    bindShareSimpleEvents() {
        const copyUrlBtn = document.getElementById('copy-url-btn');
        const xBtn = document.getElementById('share-x-btn');
        const discordBtn = document.getElementById('share-discord-btn');
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const fileInput = document.getElementById('import-file-input');
        const closeBtn = document.getElementById('share-close-btn');

        const scoreCopyUrlBtn = document.getElementById('score-copy-url-btn');
        const scoreXBtn = document.getElementById('score-share-x-btn');
        const scoreDiscordBtn = document.getElementById('score-share-discord-btn');
        const scoreCloseBtn = document.getElementById('score-share-close-btn');

        // URLコピー → 公開確認 → コピー実行 (メインシェア用)
        copyUrlBtn.onclick = () => {
            this.publishAndShare(async (url) => {
                const success = await this.copyToClipboard(url);
                App.showToast(success ? 'URLを コピーしました' : 'コピーに失敗しました');
            });
        };

        // スコア共有用: URLのみコピー
        if (scoreCopyUrlBtn) {
            scoreCopyUrlBtn.onclick = async () => {
                const url = document.getElementById('score-share-url-input').value;
                if (!url) return;
                const success = await this.copyToClipboard(url);
                if (success) {
                    const successMsg = document.getElementById('score-copy-success');
                    if (successMsg) {
                        successMsg.classList.remove('hidden');
                        setTimeout(() => successMsg.classList.add('hidden'), 2000);
                    }
                    App.showToast('URLを コピーしました');
                } else {
                    App.showToast('コピーに失敗しました');
                }
            };
        }

        // X に投稿 → 公開確認 → Twitter URL へ遷移
        xBtn.onclick = () => {
            this.publishAndShare((url) => {
                const gameName = App.projectData.meta.name || 'Game';
                let twitterUrl;
                if (App.isPlayOnlyMode) {
                    const text = `「${gameName}」であそぼう！ #FAMITORY`;
                    twitterUrl = Share.createTwitterUrl(url, text);
                } else {
                    const hashTag = gameName.replace(/\s/g, '');
                    const text = `${gameName} を作りました！\nブラウザですぐ遊べます👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`;
                    twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                }
                window.open(twitterUrl, '_blank');
            });
        };

        // Discord → 公開確認 → テキスト+URLをクリップボードへ
        discordBtn.onclick = () => {
            this.publishAndShare(async (url) => {
                const gameName = App.projectData.meta.name || 'Game';
                let text;
                if (App.isPlayOnlyMode) {
                    text = `FAMITORYでゲームを作ったよ!\n${url}`;
                } else {
                    const hashTag = gameName.replace(/\s/g, '');
                    text = `${gameName} を作りました！\nブラウザですぐ遊べます👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`;
                }
                const success = await this.copyToClipboard(text);
                App.showToast(success ? 'Discord用に コピーしました' : 'コピーに失敗しました');
            });
        };

        // 書き出し
        exportBtn.onclick = () => {
            const name = App.currentProjectName || App.projectData.meta.name || 'MyGame';
            AppProject.exportProject(name);
        };

        // スコア共有用: Xに投稿
        if (scoreXBtn) {
            scoreXBtn.onclick = () => {
                const sdata = Share.currentShareData;
                if (!sdata) return;
                const url = sdata.url || document.getElementById('score-share-url-input').value;
                const gameName = sdata.title || 'Game';
                const hashTag = gameName.replace(/\s/g, '');
                const header = sdata.isClear
                    ? `${gameName} クリア！\nScore: ${sdata.score}\nブラウザですぐ遊べます👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`
                    : `${gameName} GAME OVER\nScore: ${sdata.score}\nくやしい…リベンジして👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(header)}`, '_blank');
            };
        }

        // スコア共有用: Discordに投稿
        if (scoreDiscordBtn) {
            scoreDiscordBtn.onclick = async () => {
                const sdata = Share.currentShareData;
                if (!sdata) return;
                const url = sdata.url || document.getElementById('score-share-url-input').value;
                const gameName = sdata.title || 'Game';
                const hashTag = gameName.replace(/\s/g, '');
                const header = sdata.isClear
                    ? `${gameName} クリア！\nScore: ${sdata.score}\nブラウザですぐ遊べます👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`
                    : `${gameName} GAME OVER\nScore: ${sdata.score}\nくやしい…リベンジして👇\n${url}\n\n#${hashTag} #Famitory #indiegame #pixelart`;
                const success = await this.copyToClipboard(header);
                App.showToast(success ? 'Discord用に コピーしました' : 'コピーに失敗しました');
            };
        }

        // スコア共有用: 閉じるボタン
        if (scoreCloseBtn) {
            scoreCloseBtn.onclick = () => Share.closeScoreDialog();
        }

        // リミックスOKチェックボックス変更
        const remixOkCheckbox = document.getElementById('share-remix-ok');
        if (remixOkCheckbox) {
            remixOkCheckbox.addEventListener('change', (e) => {
                if (App.projectData) {
                    App.projectData.meta.remixOK = e.target.checked;
                    if (App.currentProjectName) {
                        Storage.saveProject(App.currentProjectName, App.projectData);
                    }
                }
            });
        }

        // 読み込み
        importBtn.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) AppProject.importProject(file);
            e.target.value = '';
        };

        const close = () => document.getElementById('share-dialog').classList.add('hidden');
        closeBtn.onclick = close;
        document.getElementById('share-dialog').onclick = (e) => {
            if (e.target === document.getElementById('share-dialog')) close();
        };
    },
};
