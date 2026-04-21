/**
 * PixelGameKit - BGMエディタ ピアノロール入力コントローラー
 *
 * 責務: Canvas上の全ポインター/タッチ入力を受け取り、
 *       楽曲データを変更してオーナー(SoundEditor)に再描画を要求する。
 * 状態フロー: 入力イベント → NoteEditor内部状態更新 → SoundEditor共有状態更新 → owner.render()
 */

class NoteEditor {
    constructor(canvas, owner) {
        this._canvas = canvas;
        this._o = owner; // SoundEditor

        // ─── ドラッグ/タップ 共通状態 ───
        this._isDragging = false;
        this._hasMoved   = false;
        this._startX = 0;
        this._startY = 0;

        // ─── 長押し / ノート移動 ───
        this._longPressTimer  = null;
        this._isLongPress     = false;
        this._draggingNote    = null;
        this._originalStep    = 0;
        this._originalPitch   = 0;

        // ─── 新規ノート作成 ───
        this._isCreatingNote  = false;
        this._creatingNote    = null;
        this._createStartStep = 0;

        // ─── タッチ: 2本指パン ───
        this._isTwoFingerPan = false;
        this._lastTouchX     = 0;
        this._lastTouchY     = 0;

        // ─── PC: 中ボタンパン ───
        this._isMidPan = false;
        this._midPanX  = 0;
        this._midPanY  = 0;

        // ─── タッチ: 遅延入力バッファ（2本指誤入力防止）───
        this._pendingTimer = null;
        this._pendingData  = null;

        // ─── オートスクロール ───
        this._autoScrollTimer      = null;
        this._autoScrollDelayTimer = null;
        this._autoScrollX = 0;
        this._autoScrollY = 0;
        this._lastPointerEvent = null;

        this._handlers = null;
    }

    // ─────────────────────────────────────────
    //  公開 API
    // ─────────────────────────────────────────

    attach() {
        const h = {
            wheel:          (e) => this._onWheel(e),
            mousedown:      (e) => this._onMouseDown(e),
            touchstart:     (e) => this._onTouchStart(e),
            touchmove:      (e) => this._onTouchMove(e),
            touchend:       (e) => this._onTouchEnd(e),
            winMousemove:   (e) => this._onWindowMouseMove(e),
            winMouseup:     (e) => this._onWindowMouseUp(e),
        };
        this._handlers = h;

        this._canvas.addEventListener('wheel',      h.wheel,      { passive: false });
        this._canvas.addEventListener('mousedown',  h.mousedown);
        this._canvas.addEventListener('touchstart', h.touchstart, { passive: false });
        this._canvas.addEventListener('touchmove',  h.touchmove,  { passive: false });
        this._canvas.addEventListener('touchend',   h.touchend);
        window.addEventListener('mousemove', h.winMousemove);
        window.addEventListener('mouseup',   h.winMouseup);
    }

    detach() {
        if (!this._handlers) return;
        const h = this._handlers;
        this._canvas.removeEventListener('wheel',      h.wheel);
        this._canvas.removeEventListener('mousedown',  h.mousedown);
        this._canvas.removeEventListener('touchstart', h.touchstart);
        this._canvas.removeEventListener('touchmove',  h.touchmove);
        this._canvas.removeEventListener('touchend',   h.touchend);
        window.removeEventListener('mousemove', h.winMousemove);
        window.removeEventListener('mouseup',   h.winMouseup);
        this._stopAutoScroll();
        this._handlers = null;
    }

    // ─────────────────────────────────────────
    //  イベントハンドラ
    // ─────────────────────────────────────────

    _onWheel(e) {
        if (App.currentScreen !== 'sound') return;
        e.preventDefault();
        const o = this._o;
        const maxScrollY = 72 * o.cellSize - this._canvas.height;
        const speed = 0.3;
        o.scrollX = Math.max(0, o.scrollX + (e.shiftKey ? e.deltaY : 0) * speed);
        o.scrollY = Math.max(0, Math.min(maxScrollY, o.scrollY + (e.shiftKey ? 0 : e.deltaY) * speed));
        o.render();
    }

    _onMouseDown(e) {
        if (e.button === 1) {
            // 中ボタン: パン開始
            if (App.currentScreen !== 'sound') return;
            e.preventDefault();
            this._stopAutoScroll();
            this._lastPointerEvent = null;
            this._isMidPan = true;
            this._midPanX = e.clientX;
            this._midPanY = e.clientY;
            return;
        }
        if (e.button !== 0) return;
        this._handlePointerDown(e, false);
    }

    _onTouchStart(e) {
        if (e.touches.length === 2) {
            // 2本指パン開始
            if (this._pendingTimer) {
                clearTimeout(this._pendingTimer);
                this._pendingTimer = null;
                this._pendingData  = null;
            }
            // 作成中のノートがあれば取り消し
            if (this._isCreatingNote && this._creatingNote) {
                const song  = this._o.getCurrentSong();
                const track = song.tracks[this._o.currentTrack];
                const idx   = track.notes.indexOf(this._creatingNote);
                if (idx >= 0) track.notes.splice(idx, 1);
                this._isCreatingNote = false;
                this._creatingNote   = null;
                this._o.render();
            }
            this._isTwoFingerPan = true;
            this._lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            this._lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            this._isDragging = false;
            e.preventDefault();
            return;
        }

        if (e.touches.length === 1) {
            e.preventDefault();
            this._handlePointerDown(e, true);
        }
    }

    _onTouchMove(e) {
        if (e.touches.length === 2 && this._isTwoFingerPan) {
            const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const o  = this._o;
            const maxScrollY = 72 * o.cellSize - this._canvas.height;
            o.scrollX = Math.max(0, o.scrollX + (this._lastTouchX - cx));
            o.scrollY = Math.max(0, Math.min(maxScrollY, o.scrollY + (this._lastTouchY - cy)));
            this._lastTouchX = cx;
            this._lastTouchY = cy;
            o.render();
            e.preventDefault();
            return;
        }

        if (this._isDragging && e.touches.length === 1) {
            e.preventDefault();
            this._lastPointerEvent = e;
            this._checkAutoScroll(e.touches[0].clientX, e.touches[0].clientY,
                (ev) => this._processMove(ev));
            this._processMove(e);
        }
    }

    _onTouchEnd(e) {
        // 1本残っている = 2本指→1本指の遷移: 何もしない
        if (e.touches.length === 1 && this._isTwoFingerPan) return;

        if (e.touches.length === 0) {
            if (this._isTwoFingerPan) {
                this._isTwoFingerPan = false;
                this._isDragging     = false;
                return;
            }
            this._handlePointerUp(e, true);
        }
    }

    _onWindowMouseMove(e) {
        // 中ボタンパン
        if (this._isMidPan) {
            const o = this._o;
            const maxScrollY = 72 * o.cellSize - this._canvas.height;
            o.scrollX = Math.max(0, o.scrollX + (this._midPanX - e.clientX));
            o.scrollY = Math.max(0, Math.min(maxScrollY, o.scrollY + (this._midPanY - e.clientY)));
            this._midPanX = e.clientX;
            this._midPanY = e.clientY;
            o.render();
        }
        // ドラッグ
        if (this._isDragging) {
            e.preventDefault();
            this._lastPointerEvent = e;
            this._checkAutoScroll(e.clientX, e.clientY, (ev) => this._processMove(ev));
            this._processMove(e);
        }
    }

    _onWindowMouseUp(e) {
        if (e.button === 1) {
            this._isMidPan = false;
            return;
        }
        if (!this._isDragging) return;
        this._handlePointerUp(e, false);
    }

    // ─────────────────────────────────────────
    //  共通ポインター処理（Down/Move/Up）
    // ─────────────────────────────────────────

    _handlePointerDown(e, isTouch) {
        const pos           = this._getPos(e);
        const { step, pitch } = this._getStepPitch(pos);
        const o             = this._o;

        this._isDragging = true;
        this._hasMoved   = false;
        this._startX     = pos.x;
        this._startY     = pos.y;

        // ── 選択ツール ──
        if (o.currentTool === 'select') {
            if (o.isStepInSelection(step, pitch)) {
                o.isMovingSelection  = true;
                o.selectionMoveStart = { step, pitch };
                const song  = o.getCurrentSong();
                const track = song.tracks[o.currentTrack];
                const sStep  = Math.min(o.selectionStart.step,  o.selectionEnd.step);
                const eStep  = Math.max(o.selectionStart.step,  o.selectionEnd.step);
                const sPitch = Math.min(o.selectionStart.pitch, o.selectionEnd.pitch);
                const ePitch = Math.max(o.selectionStart.pitch, o.selectionEnd.pitch);
                o.movingNotes = track.notes.filter(n =>
                    n.step >= sStep && n.step <= eStep && n.pitch >= sPitch && n.pitch <= ePitch
                );
            } else {
                o.isMovingSelection = false;
                o.selectionStart    = { step, pitch };
                o.selectionEnd      = { step, pitch };
                if (!isTouch) o.isSelecting = true;
            }
            o.render();
            return;
        }

        // ── ペーストモード ──
        if (o.currentTool === 'paste') {
            o.pasteDragStart = { step, pitch };
            o.render();
            return;
        }

        // ── 消しゴム ──
        if (o.currentTool === 'eraser') {
            const note = o.findNoteAt(step, pitch);
            if (note) {
                const song  = o.getCurrentSong();
                const track = song.tracks[o.currentTrack];
                const idx   = track.notes.indexOf(note);
                if (idx >= 0) { track.notes.splice(idx, 1); o.render(); }
            }
            return;
        }

        // ── 鉛筆ツール ──
        const note = o.findNoteAt(step, pitch);
        if (note) {
            // 既存ノート: 長押しでドラッグ移動 / シーク
            this._originalStep  = note.step;
            this._originalPitch = note.pitch;
            this._longPressTimer = setTimeout(() => {
                this._isLongPress  = true;
                this._draggingNote = note;
                o.seekToStep(step);
            }, 400);
        } else if (!isTouch) {
            // マウス: 即座にノート作成
            if (o.currentTool !== 'pencil') return;
            this._startNoteCreate(step, pitch, 400);
        } else {
            // タッチ: 50ms遅延して作成（2本指誤入力防止）
            this._pendingData  = { step, pitch };
            this._pendingTimer = setTimeout(() => {
                if (o.selectionMode || o.pasteMode) {
                    this._pendingTimer = null;
                    this._pendingData  = null;
                    return;
                }
                if (this._pendingData && !this._isTwoFingerPan) {
                    const d = this._pendingData;
                    this._startNoteCreate(d.step, d.pitch, 350);
                }
                this._pendingTimer = null;
                this._pendingData  = null;
            }, 50);
        }
    }

    _processMove(e) {
        const pos = this._getPos(e);
        const o   = this._o;

        const moved = Math.abs(pos.x - this._startX) > 5 || Math.abs(pos.y - this._startY) > 5;
        if (moved && !this._isLongPress && !this._isCreatingNote) clearTimeout(this._longPressTimer);
        if (moved) this._hasMoved = true;

        const { step, pitch } = this._getStepPitch(pos);

        // 選択ツール
        if (o.currentTool === 'select') {
            if (o.isMovingSelection && o.selectionMoveStart) {
                const ds = step - o.selectionMoveStart.step;
                const dp = pitch - o.selectionMoveStart.pitch;
                if (o.selectionStart) { o.selectionStart.step += ds; o.selectionStart.pitch += dp; }
                if (o.selectionEnd)   { o.selectionEnd.step   += ds; o.selectionEnd.pitch   += dp; }
                o.movingNotes.forEach(n => { n.step += ds; n.pitch += dp; });
                o.selectionMoveStart = { step, pitch };
            } else {
                o.selectionEnd = { step, pitch };
            }
            o.render();
            return;
        }

        // ペーストモード
        if (o.currentTool === 'paste') {
            if (o.pasteDragStart) {
                o.pasteOffset.step  += step  - o.pasteDragStart.step;
                o.pasteOffset.pitch += pitch - o.pasteDragStart.pitch;
                o.pasteDragStart = { step, pitch };
            }
            o.render();
            return;
        }

        // 消しゴム（ストローク削除）
        if (o.currentTool === 'eraser') {
            const note = o.findNoteAt(step, pitch);
            if (note) {
                const song  = o.getCurrentSong();
                const track = song.tracks[o.currentTrack];
                const idx   = track.notes.indexOf(note);
                if (idx >= 0) { track.notes.splice(idx, 1); o.render(); }
            }
            return;
        }

        // 長押しドラッグ: ノート移動
        if (this._isLongPress && this._draggingNote) {
            this._draggingNote.step  = Math.max(0, step);
            this._draggingNote.pitch = pitch;
            o.render();
        }

        // 新規ノート作成中: ドラッグで長さ更新
        if (this._isCreatingNote && this._creatingNote) {
            this._creatingNote.length = Math.max(1, step - this._createStartStep + 1);
            o.render();
        }
    }

    _handlePointerUp(e, isTouch) {
        const o = this._o;

        // 選択ツール
        if (o.currentTool === 'select') {
            if (!this._hasMoved && !o.isMovingSelection) {
                o.selectionStart = null;
                o.selectionEnd   = null;
                o.render();
            }
            o.isSelecting        = false;
            o.isMovingSelection  = false;
            o.selectionMoveStart = null;
            this._isDragging = false;
            this._hasMoved   = false;
            return;
        }

        // ペーストモード: 確定
        if (o.currentTool === 'paste') {
            o.confirmPaste();
            this._isDragging = false;
            return;
        }

        // タッチ: まだ保留中ならタップ扱いでノートをトグル
        if (isTouch && !this._isLongPress && !this._isCreatingNote) {
            if (this._pendingTimer) {
                clearTimeout(this._pendingTimer);
                this._pendingTimer = null;
                if (this._pendingData && !this._isTwoFingerPan && !o.selectionMode && !o.pasteMode) {
                    const d    = this._pendingData;
                    const song = o.getCurrentSong();
                    const note = { step: d.step, pitch: d.pitch, length: 1 };
                    song.tracks[o.currentTrack].notes.push(note);
                    const { note: noteName, octave } = o.player.pitchToNote(d.pitch);
                    o.player.playNote(noteName, octave, o.trackTypes[o.currentTrack], song.tracks[o.currentTrack]);
                    o.render();
                }
                this._pendingData = null;
            } else {
                clearTimeout(this._longPressTimer);
                const pos           = this._getPosFromEvent(e);
                const { step, pitch } = this._getStepPitch(pos);
                const existing = o.findNoteAt(step, pitch);
                if (existing) {
                    const song  = o.getCurrentSong();
                    const track = song.tracks[o.currentTrack];
                    const idx   = track.notes.indexOf(existing);
                    if (idx >= 0) { track.notes.splice(idx, 1); o.render(); }
                }
            }
        }

        // マウス: ドラッグなしタップ → 既存ノートを削除
        if (!isTouch && !this._isLongPress && !this._isCreatingNote) {
            clearTimeout(this._longPressTimer);
            const pos           = this._getPos(e);
            const { step, pitch } = this._getStepPitch(pos);
            const existing = o.findNoteAt(step, pitch);
            if (existing) {
                const song  = o.getCurrentSong();
                const track = song.tracks[o.currentTrack];
                const idx   = track.notes.indexOf(existing);
                if (idx >= 0) { track.notes.splice(idx, 1); o.render(); }
            }
        }

        this._isDragging     = false;
        this._isLongPress    = false;
        this._draggingNote   = null;
        this._isCreatingNote = false;
        this._creatingNote   = null;
        clearTimeout(this._longPressTimer);
    }

    // ─────────────────────────────────────────
    //  ノート作成ヘルパー
    // ─────────────────────────────────────────

    _startNoteCreate(step, pitch, longPressDelay) {
        const o    = this._o;
        const song = o.getCurrentSong();
        const newNote = { step, pitch, length: 1 };
        song.tracks[o.currentTrack].notes.push(newNote);
        this._isCreatingNote  = true;
        this._creatingNote    = newNote;
        this._createStartStep = step;

        const { note: noteName, octave } = o.player.pitchToNote(pitch);
        o.player.playNote(noteName, octave, o.trackTypes[o.currentTrack], song.tracks[o.currentTrack]);
        o.render();

        // 長押しでシーク、ノート作成キャンセル
        this._longPressTimer = setTimeout(() => {
            if (this._isCreatingNote && this._creatingNote &&
                this._creatingNote.length === 1 && !this._hasMoved) {
                const track = song.tracks[o.currentTrack];
                const idx   = track.notes.indexOf(this._creatingNote);
                if (idx >= 0) track.notes.splice(idx, 1);
                this._isCreatingNote = false;
                this._creatingNote   = null;
                o.seekToStep(step);
            }
        }, longPressDelay);
    }

    // ─────────────────────────────────────────
    //  座標変換
    // ─────────────────────────────────────────

    _getPos(e) {
        const rect   = this._canvas.getBoundingClientRect();
        const scaleX = this._canvas.width  / rect.width;
        const scaleY = this._canvas.height / rect.height;
        const touch  = e.touches ? e.touches[0] : e;
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top)  * scaleY
        };
    }

    _getPosFromEvent(e) {
        if (e.changedTouches) {
            const rect   = this._canvas.getBoundingClientRect();
            const scaleX = this._canvas.width  / rect.width;
            const scaleY = this._canvas.height / rect.height;
            return {
                x: (e.changedTouches[0].clientX - rect.left) * scaleX,
                y: (e.changedTouches[0].clientY - rect.top)  * scaleY
            };
        }
        return this._getPos(e);
    }

    _getStepPitch(pos) {
        const o        = this._o;
        const scrollY  = o.scrollY || 0;
        const maxPitch = 71;
        const step     = Math.floor((pos.x + o.scrollX) / o.cellSize);
        const row      = Math.floor((pos.y + scrollY)   / o.cellSize);
        const pitch    = Math.max(0, Math.min(71, maxPitch - row));
        return { step, pitch };
    }

    // ─────────────────────────────────────────
    //  オートスクロール
    // ─────────────────────────────────────────

    _stopAutoScroll() {
        if (this._autoScrollDelayTimer) {
            clearTimeout(this._autoScrollDelayTimer);
            this._autoScrollDelayTimer = null;
        }
        if (this._autoScrollTimer) {
            clearInterval(this._autoScrollTimer);
            this._autoScrollTimer = null;
        }
    }

    _startAutoScroll(dx, dy, eventUpdater) {
        this._autoScrollX = dx;
        this._autoScrollY = dy;
        if (this._autoScrollTimer || this._autoScrollDelayTimer) return;

        this._autoScrollDelayTimer = setTimeout(() => {
            this._autoScrollDelayTimer = null;
            this._autoScrollTimer = setInterval(() => {
                if (!this._isDragging) { this._stopAutoScroll(); return; }

                const o          = this._o;
                const maxScrollY = 72 * o.cellSize - this._canvas.height;
                const oldX       = o.scrollX;
                const oldY       = o.scrollY;

                o.scrollX = Math.max(0, o.scrollX + this._autoScrollX);
                o.scrollY = Math.max(0, Math.min(maxScrollY, o.scrollY + this._autoScrollY));

                if (o.scrollX === oldX && o.scrollY === oldY) return;

                if (this._lastPointerEvent) eventUpdater(this._lastPointerEvent);
                o.render();
            }, 30);
        }, 300);
    }

    _checkAutoScroll(clientX, clientY, eventUpdater) {
        const rect      = this._canvas.getBoundingClientRect();
        const edgeSize  = 30;
        const scrollSpd = 15;
        let dx = 0, dy = 0;

        if      (clientX < rect.left  + edgeSize) dx = -scrollSpd;
        else if (clientX > rect.right - edgeSize) dx =  scrollSpd;
        if      (clientY < rect.top    + edgeSize) dy = -scrollSpd;
        else if (clientY > rect.bottom - edgeSize) dy =  scrollSpd;

        if (dx !== 0 || dy !== 0) this._startAutoScroll(dx, dy, eventUpdater);
        else                       this._stopAutoScroll();
    }
}
