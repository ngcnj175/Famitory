/**
 * PixelGameKit - シェア機能
 */

const AppShare = {

    // 共有ダイアログの公開ステータス・CTAボタンを状態に応じて更新
    updateShareStatus() {
        const badge = document.getElementById('share-status');
        const unpublishBtn = document.getElementById('share-unpublish-btn');
        const publishBtn = document.getElementById('publish-main-btn');
        const openLinksBtn = document.getElementById('open-share-links-btn');
        const hasShareId = !!(App.projectData?.meta?.shareId);
        if (badge) badge.classList.toggle('hidden', !hasShareId);
        if (unpublishBtn) unpublishBtn.classList.toggle('hidden', !hasShareId);
        if (openLinksBtn) openLinksBtn.classList.toggle('hidden', !hasShareId);
        if (publishBtn) {
            // 未公開=「この作品を公開する」 / 公開中=「更新する」
            const key = hasShareId ? 'U547' : 'U542';
            publishBtn.textContent = AppI18N.t(key);
            publishBtn.setAttribute('data-i18n', key);
        }
    },

    // ARCADE情報エリアの表示切替（「ARCADEに登録」チェック連動）
    updateArcadeInfoVisibility() {
        const arcadeInfo = document.getElementById('share-arcade-info');
        const cb = document.getElementById('share-arcade-on');
        if (!arcadeInfo || !cb) return;
        arcadeInfo.classList.toggle('hidden-slot', !cb.checked);
    },

    // 公開モーダルの入力値を projectData に確定 + ローカル保存（モーダル閉じる時に呼ぶ）
    persistShareDialogState() {
        if (!App.projectData || !App.projectData.meta) return;
        const remixCb = document.getElementById('share-remix-ok');
        const arcadeOnCb = document.getElementById('share-arcade-on');
        if (remixCb)   App.projectData.meta.remixOK  = remixCb.checked;
        if (arcadeOnCb) App.projectData.meta.arcadeOff = !arcadeOnCb.checked;
        if (typeof AppArcadePanel !== 'undefined') AppArcadePanel.saveToProject();
        if (App.currentProjectName) {
            Storage.saveProject(App.currentProjectName, App.projectData);
            Storage.save('currentProject', App.projectData);
        }
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
    async publishAndShare(actionFn, onSuccess) {
        if (this._shareLoading) {
            App.showToast(AppI18N.t('U377'));
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
                App.showToast(AppI18N.t('U378'));
                return;
            }

            this._shareLoading = true;

            try {
                // 保存前にリミックスOKフラグを更新
                const remixOkCheckbox = document.getElementById('share-remix-ok');
                if (remixOkCheckbox) {
                    App.projectData.meta.remixOK = remixOkCheckbox.checked;
                }

                // ARCADE 登録フラグの永続化（UIは「登録する」ON→内部は arcadeOff=false）
                const arcadeOnCheckbox = document.getElementById('share-arcade-on');
                if (arcadeOnCheckbox) {
                    App.projectData.meta.arcadeOff = !arcadeOnCheckbox.checked;
                }

                // ARCADE設定パネルの入力値を meta.arcade に確定
                if (typeof AppArcadePanel !== 'undefined') {
                    AppArcadePanel.saveToProject();
                }

                const id = await Share.saveOrUpdateGame(shareId, App.projectData, !isFirstTime);

                if (!id) {
                    App.showToast(AppI18N.t('U379'));
                    this._shareLoading = false;
                    return;
                }

                App.projectData.meta.shareId = id;
                if (App.currentProjectName) {
                    Storage.saveProject(App.currentProjectName, App.projectData);
                }

                // ARCADE 登録 / 解除
                const arcadeOnCheckboxForReg = document.getElementById('share-arcade-on');
                const arcadeOff = !(arcadeOnCheckboxForReg && arcadeOnCheckboxForReg.checked);
                if (typeof ShareArcade !== 'undefined' && typeof AppArcadePanel !== 'undefined') {
                    if (arcadeOff) {
                        await ShareArcade.unpublish(id);
                    } else {
                        await ShareArcade.publish(id, AppArcadePanel.buildMetaForPublish());
                    }
                }

                App._shareUrl = url;
                this.updateShareStatus();
                App.showToast(AppI18N.t(isFirstTime ? 'U380' : 'U381'));

                // 初回公開時はエディットキーの保管を促す
                if (isFirstTime) {
                    const key = App.projectData?.meta?.editKey || '';
                    const sub = key
                        ? `${AppI18N.t('U522')}: ${key}\n${AppI18N.t('U531')}`
                        : AppI18N.t('U531');
                    AppDialogs.showAlert(AppI18N.t('U530'), sub);
                }

                if (typeof onSuccess === 'function') onSuccess(url);
            } catch (e) {
                console.error('[Share] publishAndShare error:', e);
                App.showToast(AppI18N.t('U382'));
            } finally {
                this._shareLoading = false;
            }
        });
    },

    // ゲームを非公開に戻す（Firebase の games/{id} を完全削除 + ARCADE 登録も解除）
    async unpublishGame() {
        if (this._shareLoading) {
            App.showToast(AppI18N.t('U377'));
            return;
        }
        const id = App.projectData?.meta?.shareId;
        if (!id) return;

        AppDialogs.showConfirm(
            AppI18N.t('U525'),
            AppI18N.t('U526'),
            async () => {
                if (!window.firebaseDB) {
                    App.showToast(AppI18N.t('U378'));
                    return;
                }
                this._shareLoading = true;
                const ok = await Share.deleteGame(id);
                if (ok) {
                    if (typeof ShareArcade !== 'undefined') {
                        ShareArcade.invalidateCache();
                    }
                    App.projectData.meta.shareId = '';
                    if (App.currentProjectName) {
                        Storage.saveProject(App.currentProjectName, App.projectData);
                    }
                    this.updateShareStatus();
                    App.showToast(AppI18N.t('U527'));
                } else {
                    App.showToast(AppI18N.t('U528'));
                }
                this._shareLoading = false;
            }
        );
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

    // 共有リンクモーダルを開く（公開後の URL/X/Discord ボタン群）
    openShareLinksDialog() {
        const dialog = document.getElementById('share-links-dialog');
        if (!dialog) return;
        // メイン公開モーダルは閉じる（入力値を永続化）
        this.persistShareDialogState();
        document.getElementById('share-dialog')?.classList.add('hidden');
        dialog.classList.remove('hidden');
    },

    // シェアモーダル簡易版イベント
    bindShareSimpleEvents() {
        const copyUrlBtn = document.getElementById('copy-url-btn');
        const xBtn = document.getElementById('share-x-btn');
        const discordBtn = document.getElementById('share-discord-btn');
        const closeBtn = document.getElementById('share-close-btn');
        const shareLinksCloseBtn = document.getElementById('share-links-close-btn');
        const publishMainBtn = document.getElementById('publish-main-btn');
        const openShareLinksBtn = document.getElementById('open-share-links-btn');
        const arcadeOnCheckbox = document.getElementById('share-arcade-on');

        const scoreCopyUrlBtn = document.getElementById('score-copy-url-btn');
        const scoreXBtn = document.getElementById('score-share-x-btn');
        const scoreDiscordBtn = document.getElementById('score-share-discord-btn');
        const scoreCloseBtn = document.getElementById('score-share-close-btn');

        // 公開/更新 主要CTA → 公開確認 → 成功後に共有リンクモーダルへ遷移
        if (publishMainBtn) {
            publishMainBtn.onclick = () => {
                this.publishAndShare(async (url) => {
                    // ユーザージェスチャー内で行う処理は特になし（クリップボード等は共有モーダルで行う）
                }, () => {
                    // 保存完了後に共有リンクダイアログを開く
                    this.openShareLinksDialog();
                });
            };
        }

        // 「共有する」ボタン → 共有リンクモーダルを開く（公開済み専用）
        if (openShareLinksBtn) {
            openShareLinksBtn.onclick = () => this.openShareLinksDialog();
        }

        // URLコピー（共有リンクモーダル内・公開済み前提）
        if (copyUrlBtn) {
            copyUrlBtn.onclick = async () => {
                const shareId = App.projectData?.meta?.shareId;
                if (!shareId) return;
                const url = Share.createShortUrl(shareId);
                const success = await this.copyToClipboard(url);
                App.showToast(AppI18N.t(success ? 'U383' : 'U384'));
            };
        }

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
                    App.showToast(AppI18N.t('U383'));
                } else {
                    App.showToast(AppI18N.t('U384'));
                }
            };
        }

        // X に投稿（共有リンクモーダル・公開済み前提）
        if (xBtn) {
            xBtn.onclick = () => {
                const shareId = App.projectData?.meta?.shareId;
                if (!shareId) return;
                const url = Share.createShortUrl(shareId);
                const gameName = App.projectData.meta.name || 'Game';
                let twitterUrl;
                if (App.isPlayOnlyMode) {
                    const text = AppI18N.t('U385', { gameName });
                    twitterUrl = Share.createTwitterUrl(url, text);
                } else {
                    const hashTag = gameName.replace(/\s/g, '');
                    const text = AppI18N.t('U386', { gameName, url, hashTag });
                    twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                }
                window.open(twitterUrl, '_blank');
            };
        }

        // 非公開に戻す
        const unpublishBtn = document.getElementById('share-unpublish-btn');
        if (unpublishBtn) {
            unpublishBtn.onclick = () => this.unpublishGame();
        }

        // Discord（共有リンクモーダル・公開済み前提）
        if (discordBtn) {
            discordBtn.onclick = async () => {
                const shareId = App.projectData?.meta?.shareId;
                if (!shareId) return;
                const url = Share.createShortUrl(shareId);
                const gameName = App.projectData.meta.name || 'Game';
                let text;
                if (App.isPlayOnlyMode) {
                    text = AppI18N.t('U387', { url });
                } else {
                    const hashTag = gameName.replace(/\s/g, '');
                    text = AppI18N.t('U386', { gameName, url, hashTag });
                }
                const success = await this.copyToClipboard(text);
                App.showToast(AppI18N.t(success ? 'U388' : 'U384'));
            };
        }

        // スコア共有用: Xに投稿
        if (scoreXBtn) {
            scoreXBtn.onclick = () => {
                const sdata = Share.currentShareData;
                if (!sdata) return;
                const url = sdata.url || document.getElementById('score-share-url-input').value;
                const gameName = sdata.title || 'Game';
                const hashTag = gameName.replace(/\s/g, '');
                const header = AppI18N.t(sdata.isClear ? 'U453' : 'U454', { gameName, score: sdata.score, url, hashTag });
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
                const header = AppI18N.t(sdata.isClear ? 'U453' : 'U454', { gameName, score: sdata.score, url, hashTag });
                const success = await this.copyToClipboard(header);
                App.showToast(AppI18N.t(success ? 'U388' : 'U384'));
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

        // ARCADEに登録チェックボックス変更 → ARCADE情報エリア表示切替
        if (arcadeOnCheckbox) {
            arcadeOnCheckbox.addEventListener('change', () => this.updateArcadeInfoVisibility());
        }

        const closeShareDialog = () => {
            this.persistShareDialogState();
            document.getElementById('share-dialog').classList.add('hidden');
        };
        if (closeBtn) closeBtn.onclick = closeShareDialog;
        document.getElementById('share-dialog').onclick = (e) => {
            if (e.target === document.getElementById('share-dialog')) closeShareDialog();
        };

        const closeShareLinksDialog = () => document.getElementById('share-links-dialog').classList.add('hidden');
        if (shareLinksCloseBtn) shareLinksCloseBtn.onclick = closeShareLinksDialog;
        document.getElementById('share-links-dialog').onclick = (e) => {
            if (e.target === document.getElementById('share-links-dialog')) closeShareLinksDialog();
        };
    },
};
