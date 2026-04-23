/**
 * PixelGameKit - ダイアログUI管理
 */

const AppDialogs = {
    showActionMenu(title, actions) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;z-index:9999;';

        const modal = document.createElement('div');
        modal.className = 'action-sheet';
        modal.style.cssText = 'background:transparent;width:95%;max-width:400px;margin-bottom:20px;display:flex;flex-direction:column;gap:8px;';

        const menuGroup = document.createElement('div');
        menuGroup.style.cssText = 'background:rgba(255,255,255,0.9);backdrop-filter:blur(10px);border-radius:14px;overflow:hidden;transform:translateY(100%);transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);';

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.textContent = title;
            titleEl.style.cssText = 'padding:12px;text-align:center;font-size:13px;color:#888;border-bottom:1px solid rgba(0,0,0,0.1);font-weight:600;';
            menuGroup.appendChild(titleEl);
        }

        actions.forEach((action, index) => {
            if (action.style === 'cancel') return;

            const btn = document.createElement('button');
            btn.textContent = action.text;
            let btnStyle = 'width:100%;padding:16px;border:none;background:transparent;font-size:16px;color:#007aff;cursor:pointer;';

            if (action.style === 'destructive') {
                btnStyle += 'color:#ff3b30;';
            }
            if (index < actions.length - 1 && !(index === actions.length - 2 && actions[actions.length - 1].style === 'cancel')) {
                btnStyle += 'border-bottom:1px solid rgba(0,0,0,0.1);';
            }

            btn.style.cssText = btnStyle;
            btn.addEventListener('click', () => {
                closeModal();
                if (action.action) action.action();
            });
            menuGroup.appendChild(btn);
        });

        modal.appendChild(menuGroup);

        const cancelAction = actions.find(a => a.style === 'cancel');
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = cancelAction ? (cancelAction.text || AppI18N.I18N['U105']?.[AppI18N.currentLang] || 'キャンセル') : (AppI18N.I18N['U105']?.[AppI18N.currentLang] || 'キャンセル');
        cancelBtn.style.cssText = 'width:100%;padding:16px;border:none;background:rgba(255,255,255,0.9);backdrop-filter:blur(10px);border-radius:14px;font-size:16px;font-weight:600;color:#007aff;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.1);transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);';

        cancelBtn.addEventListener('click', () => {
            closeModal();
            if (cancelAction && cancelAction.action) cancelAction.action();
        });

        modal.appendChild(cancelBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            menuGroup.style.transform = 'translateY(0)';
            cancelBtn.style.transform = 'translateY(0)';
        });

        const closeModal = () => {
            menuGroup.style.transform = 'translateY(100%)';
            cancelBtn.style.transform = 'translateY(100%)';
            overlay.style.transition = 'opacity 0.2s';
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            }, 300);
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    },

    showAlert(message, subMessage, onOk) {
        const modal = document.getElementById('generic-confirm-modal');
        const msgEl = document.getElementById('generic-confirm-msg');
        const subEl = document.getElementById('generic-confirm-body');
        const okBtn = document.getElementById('generic-confirm-ok');
        const cancelBtn = document.getElementById('generic-confirm-cancel');

        if (!modal || !okBtn || !cancelBtn) {
            alert(message + (subMessage ? "\n" + subMessage : ""));
            if (onOk) onOk();
            return;
        }

        msgEl.textContent = message;
        subEl.textContent = subMessage || '';
        modal.classList.remove('hidden');

        AppI18N.applyLang();

        cancelBtn.classList.add('hidden');

        const btnText = AppI18N.I18N['U306']?.[AppI18N.currentLang] || 'Close';
        okBtn.textContent = btnText;

        const close = () => {
            modal.classList.add('hidden');
            cancelBtn.classList.remove('hidden');
            AppI18N.applyLang();
            okBtn.onclick = null;
            modal.onclick = null;
        };

        okBtn.onclick = () => { close(); if (onOk) onOk(); };
        modal.onclick = (e) => { if (e.target === modal) close(); };

        AppI18N.applyLang();
    },

    showConfirm(message, subMessage, onOk, onCancel) {
        const modal = document.getElementById('generic-confirm-modal');
        const msgEl = document.getElementById('generic-confirm-msg');
        const subEl = document.getElementById('generic-confirm-body');
        const okBtn = document.getElementById('generic-confirm-ok');
        const cancelBtn = document.getElementById('generic-confirm-cancel');

        if (!modal || !okBtn || !cancelBtn) {
            if (confirm(message + (subMessage ? "\n" + subMessage : ""))) {
                if (onOk) onOk();
            } else {
                if (onCancel) onCancel();
            }
            return;
        }

        msgEl.textContent = message;
        subEl.textContent = subMessage || '';
        modal.classList.remove('hidden');

        const close = () => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            modal.onclick = null;
        };

        okBtn.onclick = () => { close(); if (onOk) onOk(); };
        cancelBtn.onclick = () => { close(); if (onCancel) onCancel(); };
        modal.onclick = (e) => { if (e.target === modal) close(); };

        AppI18N.applyLang();
    }
};
