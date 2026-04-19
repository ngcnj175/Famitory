/**
 * PixelGameKit - サウンドエディタ（新UI）
 */

const SoundEditor = {
    // I18N
    t(id) {
        return App.I18N[id]?.[App.currentLang] || "";
    },
    // キャンバス
    canvas: null,
    ctx: null,

    // ソング管理
    songs: [],
    currentSongIdx: 0,

    // トラック
    currentTrack: 0, // 0-3: Tr1-Tr4
    trackTypes: ['square', 'square', 'triangle', 'noise'],

    // 再生状態
    isPlaying: false,
    isPaused: false,
    isStepRecording: false,
    rtNoteStartStep: -1,
    rtNotePitch: -1,
    playInterval: null,
    activeOscillators: [null, null, null, null], // トラックごとの再生中オシレーター（同時発音1制限用）

    // ピアノロール
    cellSize: 20,
    scrollX: 0, // 横スクロール位置
    scrollY: 480, // 縦スクロール位置（C4が下端に表示: (71-36)*20=700、表示領域を考慮して調整）
    highlightPitch: -1, // ハイライト中の音階

    // オートスクロール
    autoScrollTimer: null,
    autoScrollX: 0,
    autoScrollY: 0,
    lastPointerEvent: null,

    // 編集ツール
    currentTool: 'pencil', // pencil, eraser, select, copy, paste

    // 範囲選択
    selectionMode: false,
    selectionStart: null, // {step, noteIdx}
    selectionEnd: null,   // {step, noteIdx}
    rangeClipboard: null,
    pasteMode: false,
    pasteData: null,
    pasteOffset: { step: 0, note: 0 },
    isMovingSelection: false,
    selectionMoveStart: null,
    movingNotes: [],

    // 入力位置
    currentStep: 0,

    // 音階定義（5オクターブ = C1-B5）
    noteNames: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],

    // Web Audio
    audioCtx: null,

    init() {
        this.canvas = document.getElementById('piano-roll-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Web Audio初期化
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // ソングデータ初期化（マイグレーション含む）
        this.migrateSongData();

        this.songs = App.projectData.songs;
        if (this.songs.length === 0) {
            this.addSong();
        }

        // 新UI初期化
        this.initConsoleHeader();
        this.initChannelStrip();
        this.initTools();
        this.initPlayerPanel();
        this.initKeyboard();
        this.initPianoRoll();
        this.initSongJukebox(); // モーダル初期化

        this.resize(); // キャンバスサイズ設定
        this.updateConsoleDisplay();
        this.updateChannelStripUI();
    },

    refresh() {
        if (!App.projectData.songs) {
            App.projectData.songs = [];
        }
        this.songs = App.projectData.songs;
        if (this.songs.length === 0) {
            this.addSong();
        }

        // iOS対応: audioCtxがsuspendedなら再開を試みる
        if (this.audioCtx) {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(e => console.log('AudioContext resume failed:', e));
            }
        } else {
            // audioCtxがnullなら再作成
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.resize(); // キャンバスサイズ設定
        this.updateConsoleDisplay();
        this.updateChannelStripUI();
    },

    // データ構造のマイグレーション (Vol/Pan追加)
    migrateSongData() {
        if (!App.projectData.songs) {
            App.projectData.songs = [];
            return;
        }
        App.projectData.songs.forEach(song => {
            if (!song.tracks) return;
            song.tracks.forEach(track => {
                if (typeof track.volume === 'undefined') track.volume = 0.65;
                if (typeof track.pan === 'undefined') track.pan = 0.0;
                if (typeof track.tone === 'undefined') track.tone = 0; // 音色バリエーション (0=Default)
            });
        });
    },

    // 波形キャッシュ
    waveCache: {},

    getPeriodicWave(duty) {
        if (!this.audioCtx) return null;

        const cacheKey = `pulse_${duty}`;
        if (this.waveCache[cacheKey]) return this.waveCache[cacheKey];

        const n = 4096;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);
        for (let i = 1; i < n; i++) {
            imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
        }
        const wave = this.audioCtx.createPeriodicWave(real, imag);
        this.waveCache[cacheKey] = wave;
        return wave;
    },

    // iOSでconfirmダイアログ後にAudioContextが壊れる問題対策
    resetAudioContext() {
        // 古いコンテキストをクローズ
        if (this.audioCtx) {
            try {
                this.audioCtx.close();
            } catch (e) { }
        }
        // 新しいコンテキストを作成
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // アクティブオシレーターをクリア
        this.activeOscillators = [null, null, null, null];

        // ゲームエンジンのコンテキストもリセット
        if (typeof GameEngine !== 'undefined' && GameEngine.bgmAudioCtx) {
            try {
                GameEngine.bgmAudioCtx.close();
            } catch (e) { }
            GameEngine.bgmAudioCtx = null;
        }
    },

    resize() {
        if (!this.canvas) return;
        // ピアノロール: 16x16グリッド（STAGE画面と同じ設定）
        // キャンバスは常に16x16タイル（320px）固定
        const canvasSize = 320;

        // 内部解像度（stage-editor.jsと同じ）
        this.canvas.width = canvasSize;
        this.canvas.height = canvasSize;

        // CSS表示サイズはJSで設定しない
        // style.width/heightを指定するとレスポンシブ対応時に縦長/横長になるリスクがある
        // CSSの aspect-ratio: 1 に完全に任せる

        this.render();
    },

    // ========== Console Header (ソング制御盤) ==========
    initConsoleHeader() {
        // ソング追加ボタン
        document.getElementById('song-add-btn')?.addEventListener('click', () => {
            this.addSong();
        });

        // ソング削除ボタン
        document.getElementById('song-delete-btn')?.addEventListener('click', () => {
            this.deleteSong();
        });

        // 前へ
        document.getElementById('song-prev-btn')?.addEventListener('click', () => {
            let nextIdx = this.currentSongIdx - 1;
            if (nextIdx < 0) nextIdx = this.songs.length - 1;
            this.selectSong(nextIdx);
        });

        // 次へ
        document.getElementById('song-next-btn')?.addEventListener('click', () => {
            let nextIdx = this.currentSongIdx + 1;
            if (nextIdx >= this.songs.length) nextIdx = 0;
            this.selectSong(nextIdx);
        });

        // 数値入力モーダル初期化
        const numModal = document.getElementById('number-input-modal');
        const numOkBtn = document.getElementById('number-input-ok');
        const numCancelBtn = document.getElementById('number-input-cancel');
        if (numModal && numOkBtn && numCancelBtn) {
            numOkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                numOkBtn.blur();
                if (document.activeElement) document.activeElement.blur();

                if (this.onNumberInputCallback) {
                    const val = document.getElementById('number-input-value').value;
                    const callback = this.onNumberInputCallback;
                    this.onNumberInputCallback = null; // コールバックを確実に1度だけでクリア
                    callback(val);
                }
                numModal.classList.add('hidden');
                // iOS: User gesture (click) resumes AudioContext
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
            });
            numCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                numCancelBtn.blur();
                if (document.activeElement) document.activeElement.blur();

                this.onNumberInputCallback = null; // クリア
                numModal.classList.add('hidden');
                // iOS: Ensure resume even on cancel if needed
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
            });
        }

        // タイトルタップ（名前変更モーダル表示）
        const titleEl = document.getElementById('song-title-display');
        if (titleEl) {
            let longPressTimer;
            let isLongPress = false;
            const startLongPress = (e) => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    App.showActionMenu(null, [
                        { text: '複製', action: () => this.duplicateSong() },
                        { text: '削除', style: 'destructive', action: () => this.deleteSong() },
                        { text: 'キャンセル', style: 'cancel' }
                    ]);
                }, 800);
            };
            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };
            titleEl.addEventListener('mousedown', startLongPress);
            titleEl.addEventListener('mouseup', cancelLongPress);
            titleEl.addEventListener('mouseleave', cancelLongPress);
            titleEl.addEventListener('touchstart', startLongPress, { passive: true });
            titleEl.addEventListener('touchend', cancelLongPress);
            titleEl.addEventListener('click', () => {
                if (isLongPress) return;
                this.openSongNameModal();
            });
        }

        // モーダル保存ボタン
        document.getElementById('song-name-save')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.activeElement?.blur();
            this.saveSongName();
        });

        // モーダルキャンセルボタン
        document.getElementById('song-name-cancel')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.activeElement?.blur();
            this.closeSongNameModal();
        });

        // メニュー（ジュークボックスを開く）



        // BPM表示（タップで入力、ダブルタップでデフォルト、ドラッグで調整）
        const bpmDisplay = document.getElementById('bpm-display');
        if (bpmDisplay) {
            let lastTapBpm = 0;
            let isDraggingBpm = false;
            let startYBpm = 0;
            let startValueBpm = 0;
            let hasDraggedBpm = false;
            let bpmTapTimeout = null;

            const onStartBpm = (e) => {
                isDraggingBpm = true;
                hasDraggedBpm = false;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                startYBpm = clientY;
                startValueBpm = this.getCurrentSong().bpm;
                e.preventDefault();
            };

            const onMoveBpm = (e) => {
                if (!isDraggingBpm) return;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const delta = Math.round((startYBpm - clientY) / 3);
                if (Math.abs(delta) > 0) {
                    hasDraggedBpm = true;
                    const song = this.getCurrentSong();
                    song.bpm = Math.max(60, Math.min(240, startValueBpm + delta));
                    this.updateConsoleDisplay();
                }
            };

            const onEndBpm = (e) => {
                if (!isDraggingBpm) return;
                isDraggingBpm = false;

                const wasTarget = e.target === bpmDisplay || bpmDisplay.contains(e.target);

                if (!wasTarget || hasDraggedBpm) {
                    if (hasDraggedBpm && this.isPlaying) {
                        // ドラッグで値が変わった場合のみ再開
                        this.stop();
                        this.play();
                    }
                    hasDraggedBpm = false;
                    return;
                }

                const now = Date.now();
                if (now - lastTapBpm < 350) {
                    // ダブルタップ
                    if (bpmTapTimeout) clearTimeout(bpmTapTimeout);
                    this.getCurrentSong().bpm = 120;
                    this.updateConsoleDisplay();
                    lastTapBpm = 0;
                } else {
                    // シングルタップ(遅延実行)
                    lastTapBpm = now;
                    bpmTapTimeout = setTimeout(() => {
                        if (lastTapBpm !== 0) {
                            this.openBpmInput();
                            lastTapBpm = 0;
                        }
                    }, 350);
                }
            };

            bpmDisplay.addEventListener('mousedown', onStartBpm);
            bpmDisplay.addEventListener('touchstart', onStartBpm, { passive: false });
            document.addEventListener('mousemove', onMoveBpm);
            document.addEventListener('touchmove', onMoveBpm, { passive: false });
            document.addEventListener('mouseup', onEndBpm);
            document.addEventListener('touchend', onEndBpm);
        }

        // BAR表示（タップで入力、ダブルタップでデフォルト、ドラッグで調整）
        const barDisplay = document.getElementById('bar-display');
        if (barDisplay) {
            let lastTapBar = 0;
            let isDraggingBar = false;
            let startYBar = 0;
            let startValueBar = 0;
            let hasDraggedBar = false;
            let barTapTimeout = null;

            const onStartBar = (e) => {
                isDraggingBar = true;
                hasDraggedBar = false;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                startYBar = clientY;
                startValueBar = this.getCurrentSong().bars;
                e.preventDefault();
            };

            const onMoveBar = (e) => {
                if (!isDraggingBar) return;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const delta = Math.round((startYBar - clientY) / 10);
                if (Math.abs(delta) > 0) {
                    hasDraggedBar = true;
                    const song = this.getCurrentSong();
                    song.bars = Math.max(1, Math.min(256, startValueBar + delta));
                    this.updateConsoleDisplay();
                    this.render();
                }
            };

            const onEndBar = (e) => {
                if (!isDraggingBar) return;
                isDraggingBar = false;

                const wasTarget = e.target === barDisplay || barDisplay.contains(e.target);

                if (!wasTarget || hasDraggedBar) {
                    if (hasDraggedBar && this.isPlaying) {
                        // ドラッグで値が変わった場合のみ再開
                        this.stop();
                        this.play();
                    }
                    hasDraggedBar = false;
                    return;
                }

                const now = Date.now();
                if (now - lastTapBar < 350) {
                    // ダブルタップ
                    if (barTapTimeout) clearTimeout(barTapTimeout);
                    this.getCurrentSong().bars = 16;
                    this.updateConsoleDisplay();
                    this.render();
                    lastTapBar = 0;
                } else {
                    // シングルタップ(遅延実行)
                    lastTapBar = now;
                    barTapTimeout = setTimeout(() => {
                        if (lastTapBar !== 0) {
                            this.openBarInput();
                            lastTapBar = 0;
                        }
                    }, 350);
                }
            };

            barDisplay.addEventListener('mousedown', onStartBar);
            barDisplay.addEventListener('touchstart', onStartBar, { passive: false });
            document.addEventListener('mousemove', onMoveBar);
            document.addEventListener('touchmove', onMoveBar, { passive: false });
            document.addEventListener('mouseup', onEndBar);
            document.addEventListener('touchend', onEndBar);
        }
    },

    // 数値入力ダイアログ (iOS対策: prompt非推奨)
    openNumberInput(title, initialValue, callback) {
        const modal = document.getElementById('number-input-modal');
        const titleEl = document.getElementById('number-input-title');
        const inputEl = document.getElementById('number-input-value');
        if (!modal || !titleEl || !inputEl) return;

        titleEl.textContent = title;
        inputEl.value = initialValue;
        this.onNumberInputCallback = callback;
        modal.classList.remove('hidden');
        inputEl.focus();
    },

    // BPM入力ダイアログ
    openBpmInput() {
        // Playback stops/resumes automatically handled by modal (no blocking)
        // But to be safe, we can pause if we want, or rely on non-blocking nature.
        // For iOS, let's keep playing if possible, or pause?
        // Let's pause to avoid confusion, and resume in OK callback.
        /*
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.pause();
        */

        // prompt is blocking, but modal is not. We don't necessarily need to pause!
        // However, user might want to focus on input.
        // Let's NOT pause automatically unless requested. User can hear the change immediately.

        const current = this.getCurrentSong().bpm;
        this.openNumberInput('SPEED (60-240)', current, (val) => {
            const value = parseInt(val);
            if (!isNaN(value) && value >= 60 && value <= 240) {
                // Stop & play to restart scheduler with new BPM
                const wasPlaying = this.isPlaying;
                if (wasPlaying) this.stop();

                this.getCurrentSong().bpm = value;
                this.updateConsoleDisplay();

                if (wasPlaying) this.play();
            }
        });
    },

    // BAR入力ダイアログ
    openBarInput() {
        const current = this.getCurrentSong().bars;
        this.openNumberInput('STEP (1-256)', current, (val) => {
            const value = parseInt(val);
            if (!isNaN(value) && value >= 1 && value <= 256) {
                // Restart scheduler if size changed (though less critical for bars)
                const wasPlaying = this.isPlaying;
                if (wasPlaying) this.stop();

                this.getCurrentSong().bars = value;
                this.updateConsoleDisplay();
                this.render();

                if (wasPlaying) this.play();
            }
        });
    },

    updateConsoleDisplay() {
        const song = this.getCurrentSong();
        const titleEl = document.getElementById('song-title-display');
        const bpmEl = document.getElementById('bpm-display');
        const barEl = document.getElementById('bar-display');

        if (titleEl) {
            const span = titleEl.querySelector('span');
            if (span) {
                span.textContent = song.name;
                // テキストが枠を越える場合はスクロールクラスを付与
                span.classList.remove('marquee');
                if (span.offsetWidth > titleEl.clientWidth - 16) {
                    span.classList.add('marquee');
                }
            } else {
                titleEl.textContent = song.name;
            }
        }
        if (bpmEl) bpmEl.textContent = song.bpm;
        if (barEl) barEl.textContent = song.bars;
    },

    // ========== ソング名変更モーダル ==========
    openSongNameModal() {
        const song = this.getCurrentSong();
        const popup = document.getElementById('song-name-popup');
        const input = document.getElementById('song-name-input');
        if (popup && input) {
            input.value = song.name;
            popup.classList.remove('hidden');
            // iOSでのバースト防止：再生停止
            if (this.isPlaying) {
                this.wasPlayingBeforeModal = true;
                this.pause();
            } else {
                this.wasPlayingBeforeModal = false;
            }
        }
    },

    closeSongNameModal() {
        const popup = document.getElementById('song-name-popup');
        if (popup) {
            popup.classList.add('hidden');
        }
    },

    saveSongName() {
        const input = document.getElementById('song-name-input');
        if (input) {
            const newName = input.value.trim().substring(0, 16);
            if (newName) {
                const song = this.getCurrentSong();
                song.name = newName;
                this.updateConsoleDisplay();
                // ステージエディタ等の更新
                if (typeof StageEditor !== 'undefined' && StageEditor.updateBgmSelects) {
                    StageEditor.updateBgmSelects();
                }
            }
            this.closeSongNameModal();
        }
    },

    // ========== Channel Strip (フッターミキサー) ==========
    initChannelStrip() {
        const container = document.getElementById('bgm-channel-strip');
        if (!container) return;

        container.innerHTML = '';
        // 楽器名のみ表示（TR1～4は削除）
        const trackLabels = ['SQUARE1', 'SQUARE2', 'TRIANGLE', 'NOISE'];

        trackLabels.forEach((label, idx) => {
            const div = document.createElement('div');
            div.className = 'channel-strip-track' + (idx === this.currentTrack ? ' active' : '');
            div.dataset.track = idx;

            div.innerHTML = `
                <div class="track-info">
                    <span class="track-name">${label}</span>
                </div>
                <div class="track-knobs">
                    <div class="knob-wrap">
                        <div class="knob-ctrl vol-knob" data-type="vol" data-track="${idx}"></div>
                        <span class="knob-label">VOL</span>
                    </div>
                    <div class="knob-wrap">
                        <div class="knob-ctrl pan-knob" data-type="pan" data-track="${idx}"></div>
                        <span class="knob-label">PAN</span>
                    </div>
                </div>
             `;

            // トラック選択イベント（長押しで音色変更）
            let longPressTimer;
            const startLongPress = (e) => {
                longPressTimer = setTimeout(() => {
                    this.showToneSelectMenu(idx);
                }, 600);
            };
            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };

            const trackInfo = div.querySelector('.track-info');
            trackInfo.addEventListener('mousedown', startLongPress);
            trackInfo.addEventListener('touchstart', startLongPress, { passive: true });
            trackInfo.addEventListener('mouseup', cancelLongPress);
            trackInfo.addEventListener('mouseleave', cancelLongPress);
            trackInfo.addEventListener('touchend', cancelLongPress);

            trackInfo.addEventListener('click', (e) => {
                // ノブ操作時はトラック切り替えしない
                if (e.target.classList.contains('knob-ctrl')) return;

                this.currentTrack = idx;
                this.updateChannelStripUI();
                this.render();
            });

            container.appendChild(div);
        });

        // ノブのドラッグ操作初期化
        this.initKnobInteractions();
    },

    showToneSelectMenu(trackIdx) {
        const song = this.getCurrentSong();
        const track = song.tracks[trackIdx];
        const trackType = ['square', 'square', 'triangle', 'noise'][trackIdx];

        // 既存のメニューがあれば削除
        const existing = document.getElementById('tone-select-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'tone-select-menu';
        menu.className = 'tone-select-menu';

        const title = document.createElement('div');
        title.className = 'tone-menu-title';
        title.textContent = App.I18N['U295']?.[App.currentLang] || '音色を選択';
        menu.appendChild(title);

        let options = [];
        if (trackType === 'square') {
            options = [
                { val: 0, id: 'U296', fallback: 'Standard' },
                { val: 1, id: 'U297', fallback: 'Standard (Short)' },
                { val: 2, id: 'U298', fallback: 'Standard (FadeIn)' },
                { val: 3, id: 'U299', fallback: 'Sharp' },
                { val: 4, id: 'U300', fallback: 'Sharp (Short)' },
                { val: 5, id: 'U301', fallback: 'Sharp (FadeIn)' },
                { val: 6, id: 'U302', fallback: 'Tremolo (高速)' }
            ];
        } else if (trackType === 'triangle') {
            options = [
                { val: 0, id: 'U296', fallback: 'Standard' },
                { val: 1, id: 'U303', fallback: 'Soft (Sine)' },
                { val: 2, id: 'U304', fallback: 'Power (Saw)' },
                { val: 3, id: 'U305', fallback: 'Kick (ピッチ下降)' }
            ];
        } else if (trackType === 'noise') {
            options = [
                { val: 0, id: 'U399', fallback: 'Noise (ピッチ)' },
                { val: 1, id: 'U400', fallback: 'Drum Kit' }
            ];
        }

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'tone-menu-btn' + (track.tone === opt.val ? ' active' : '');
            btn.innerText = App.I18N[opt.id]?.[App.currentLang] || opt.fallback;
            btn.onclick = () => {
                track.tone = opt.val;
                // UI反映（必要なら）
                menu.remove();

                // プレビュー再生
                this.previewTone(trackIdx);
            };
            menu.appendChild(btn);
        });

        // 閉じるボタン（背景クリックで閉じる機能があれば不要だが、念のため）
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tone-menu-close';
        closeBtn.innerText = App.I18N['U306']?.[App.currentLang] || '閉じる';
        closeBtn.onclick = () => menu.remove();
        menu.appendChild(closeBtn);

        document.body.appendChild(menu);
    },

    previewTone(trackIdx) {
        const note = 'C';
        const octave = 4;
        this.currentTrack = trackIdx;
        // 単音再生（プレビュー）
        this.playNote(note, octave, 0.4);
    },

    updateChannelStripUI() {
        // アクティブトラック表示更新
        const tracks = document.querySelectorAll('.channel-strip-track');
        tracks.forEach((t, idx) => {
            t.classList.toggle('active', idx === this.currentTrack);
        });

        // ノブの回転更新
        const song = this.getCurrentSong();
        song.tracks.forEach((track, idx) => {
            const volKnob = document.querySelector(`.vol-knob[data-track="${idx}"]`);
            const panKnob = document.querySelector(`.pan-knob[data-track="${idx}"]`);

            if (volKnob) {
                // Vol 0.0-1.0 => -135deg to +135deg
                const deg = (track.volume * 270) - 135;
                volKnob.style.transform = `rotate(${deg}deg)`;
            }
            if (panKnob) {
                // Pan -1.0 to 1.0 => -135deg to +135deg
                const deg = track.pan * 135;
                panKnob.style.transform = `rotate(${deg}deg)`;
            }
        });
    },

    initKnobInteractions() {
        let activeKnob = null;
        let startY = 0;
        let startVal = 0;

        // ダブルタップ検出用
        let lastTapTime = {};
        const DOUBLE_TAP_DELAY = 300;

        const handleDoubleTap = (e) => {
            if (!e.target.classList.contains('knob-ctrl')) return;

            const knob = e.target;
            const trackIdx = parseInt(knob.dataset.track);
            const type = knob.dataset.type;
            const now = Date.now();
            const key = `${type}_${trackIdx}`;

            if (lastTapTime[key] && (now - lastTapTime[key]) < DOUBLE_TAP_DELAY) {
                // ダブルタップ検出 - デフォルト値にリセット
                const song = this.getCurrentSong();
                const track = song.tracks[trackIdx];

                if (type === 'vol') {
                    track.volume = 0.65; // デフォルト65%
                } else {
                    track.pan = 0.0; // デフォルト中央
                }

                this.updateChannelStripUI();
                lastTapTime[key] = 0; // リセット
            } else {
                lastTapTime[key] = now;
            }
        };

        const handleStart = (e) => {
            if (!e.target.classList.contains('knob-ctrl')) return;
            e.preventDefault();
            e.stopPropagation();

            activeKnob = e.target;
            const trackIdx = parseInt(activeKnob.dataset.track);
            const type = activeKnob.dataset.type;
            const song = this.getCurrentSong();
            const track = song.tracks[trackIdx];

            startY = e.touches ? e.touches[0].pageY : e.pageY;
            startVal = (type === 'vol') ? track.volume : track.pan;

            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
        };

        const handleMove = (e) => {
            if (!activeKnob) return;
            e.preventDefault(); // スクロール防止

            const currentY = e.touches ? e.touches[0].pageY : e.pageY;
            const deltaY = startY - currentY; // 上にドラッグでプラス

            const song = this.getCurrentSong();
            const trackIdx = parseInt(activeKnob.dataset.track);
            const track = song.tracks[trackIdx];
            const type = activeKnob.dataset.type;

            // 感度調整
            const Sensitivity = 0.005;

            if (type === 'vol') {
                let newVal = startVal + (deltaY * Sensitivity);
                newVal = Math.max(0.0, Math.min(1.0, newVal));
                track.volume = newVal;
            } else {
                let newVal = startVal + (deltaY * Sensitivity);
                newVal = Math.max(-1.0, Math.min(1.0, newVal));
                track.pan = newVal;
            }

            this.updateChannelStripUI();
        };

        const handleEnd = () => {
            activeKnob = null;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };

        const container = document.getElementById('bgm-channel-strip');
        container.addEventListener('mousedown', handleStart);
        container.addEventListener('touchstart', handleStart, { passive: false });
        container.addEventListener('click', handleDoubleTap);
        container.addEventListener('touchend', (e) => {
            // タッチでのダブルタップ検出（iPhone対応）
            if (e.target.classList.contains('knob-ctrl')) {
                handleDoubleTap(e);
            }
        });
    },

    // ========== BGM Jukebox (BGMリスト) ==========
    initSongJukebox() {
        const modal = document.getElementById('song-jukebox-modal');

        // 背景クリックで閉じる
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    },

    openSongJukebox() {
        const modal = document.getElementById('song-jukebox-modal');
        this.renderJukeboxList();
        modal.classList.remove('hidden');
    },

    renderJukeboxList() {
        const listContainer = document.getElementById('jukebox-list');
        if (!listContainer) return;

        let html = '';
        this.songs.forEach((song, idx) => {
            const isCurrent = idx === this.currentSongIdx ? 'current' : '';
            html += `
                <div class="se-select-item ${isCurrent}" data-song-index="${idx}">
                    <span class="se-name">${song.name}</span>
                    <button class="se-preview-btn" data-song-index="${idx}">▶</button>
                </div>
            `;
        });

        listContainer.innerHTML = html;

        // タッチイベント伝播停止
        listContainer.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        listContainer.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

        // アイテムクリックで選択
        listContainer.querySelectorAll('.se-select-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // プレビューボタンクリック時は選択しない
                if (e.target.classList.contains('se-preview-btn')) return;

                const idx = parseInt(item.dataset.songIndex);
                this.selectSong(idx);
                document.getElementById('song-jukebox-modal').classList.add('hidden');
            });

            // 長押しで削除
            let longPressTimer;
            item.addEventListener('mousedown', () => {
                longPressTimer = setTimeout(() => {
                    const idx = parseInt(item.dataset.songIndex);
                    if (this.songs.length <= 1) {
                        App.showAlert(this.t('U307'));
                        return;
                    }
                    App.showConfirm(this.t('U308'), this.songs[idx].name, () => {
                        this.deleteSong(idx);
                        this.renderJukeboxList();
                    });
                }, 800);
            });
            item.addEventListener('touchstart', () => {
                longPressTimer = setTimeout(() => {
                    const idx = parseInt(item.dataset.songIndex);
                    if (this.songs.length <= 1) {
                        App.showAlert(this.t('U307'));
                        return;
                    }
                    App.showConfirm(this.t('U308'), this.songs[idx].name, () => {
                        this.deleteSong(idx);
                        this.renderJukeboxList();
                    });
                }, 800);
            }, { passive: true });
            item.addEventListener('mouseup', () => clearTimeout(longPressTimer));
            item.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
            item.addEventListener('touchend', () => clearTimeout(longPressTimer));
        });

        // プレビューボタン
        listContainer.querySelectorAll('.se-preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.songIndex);

                // トグル動作: 再生中で同じ曲なら停止
                if (this.currentSongIdx === idx && this.isPlaying) {
                    this.stop();
                    // ボタンを停止状態に戻す
                    btn.textContent = '▶';
                    btn.classList.remove('playing');
                    return;
                }

                this.selectSong(idx);
                this.play();
                // 他のボタンをリセット
                listContainer.querySelectorAll('.se-preview-btn').forEach(b => {
                    b.textContent = '▶';
                    b.classList.remove('playing');
                });
                btn.textContent = '■';
                btn.classList.add('playing');
            });
        });
    },

    showSongContextMenu(idx, event) {
        // 簡易実装：ブラウザ標準のconfirm/promptで代用
        const action = prompt('操作を選択 (delete / duplicate / rename)', 'duplicate');
        if (!action) return;

        if (action.toLowerCase() === 'delete') {
            this.deleteSong(idx);
            this.renderJukeboxList();
        } else if (action.toLowerCase() === 'duplicate') {
            this.duplicateSong(idx);
            this.renderJukeboxList();
        } else if (action.toLowerCase() === 'rename') {
            const song = this.songs[idx];
            const newName = prompt('新しい名前', song.name);
            if (newName) {
                song.name = newName;
                this.renderJukeboxList();
                this.updateConsoleDisplay();
            }
        }
    },

    duplicateSong() {
        const currentSong = this.getCurrentSong();
        if (!currentSong) return;
        const duplicatedSong = JSON.parse(JSON.stringify(currentSong));

        duplicatedSong.name = currentSong.name + "のコピー";
        this.songs.push(duplicatedSong);

        // 追加したソングへ移動
        this.selectSong(this.songs.length - 1);

        // 保存
        if (window.Storage) Storage.saveProject();
    },

    addSong() {
        const newSong = {
            name: `BGM ${this.songs.length + 1}`,
            bpm: 120,
            bars: 16,
            tracks: [
                { type: 'square', volume: 0.65, pan: 0.0, tone: 0, notes: [] },
                { type: 'square', volume: 0.65, pan: 0.0, tone: 0, notes: [] },
                { type: 'triangle', volume: 0.65, pan: 0.0, tone: 0, notes: [] },
                { type: 'noise', volume: 0.65, pan: 0.0, tone: 0, notes: [] }
            ]
        };
        this.songs.push(newSong);
        this.selectSong(this.songs.length - 1);
    },

    deleteSong() {
        if (this.songs.length <= 1) {
            App.showAlert(this.t('U307'));
            return;
        }

        App.showConfirm(this.t('U313').replace('${this.getCurrentSong().name}', this.getCurrentSong().name), "", () => {

        // --- Web Audio API 初期化 ---
        this.resetAudioContext();

        // --- パレット読み込み ---
        this.songs.splice(this.currentSongIdx, 1);

        // インデックス調整（末尾を削除した場合は一つ前へ）
        if (this.currentSongIdx >= this.songs.length) {
            this.currentSongIdx = this.songs.length - 1;
        }

        // 表示更新
        this.selectSong(this.currentSongIdx);

        // ステージエディタ等のBGM選択肢更新
        if (typeof StageEditor !== 'undefined' && StageEditor.updateBgmSelects) {
            StageEditor.updateBgmSelects();
        }
        });
    },

    selectSong(idx) {
        const wasPlaying = this.isPlaying;

        // 再生中なら一旦停止
        if (this.isPlaying) {
            this.stop();
        }

        this.currentSongIdx = idx;
        this.scrollX = 0;
        this.currentStep = 0;
        this.updateConsoleDisplay();
        this.updateChannelStripUI();
        this.render();

        // 再生中だった場合は新しい曲を再生
        if (wasPlaying) {
            this.play();
        }
    },

    getCurrentSong() {
        return this.songs[this.currentSongIdx] || this.songs[0];
    },

    // ========== 編集ツール ==========
    initTools() {
        const tools = document.querySelectorAll('.sound-tool-btn');
        tools.forEach(tool => {
            tool.addEventListener('click', () => {
                tools.forEach(t => t.classList.remove('active'));
                tool.classList.add('active');
                this.currentTool = tool.dataset.tool || 'pencil';
            });
        });
    },

    // ========== プレイヤーパネル ==========
    initPlayerPanel() {
        // 戻る（旧DEL） - タップ: 直前のノート削除
        const delBtn = document.getElementById('sound-del-btn');
        if (delBtn) {
            delBtn.addEventListener('click', () => {
                this.deleteLastNote();
            });
        }

        // PLAY/PAUSE/STOP（シングル=一時停止/再生、ダブル=停止）
        const playBtn = document.getElementById('sound-play-btn');
        if (playBtn) {
            let lastClickTime = 0;
            playBtn.addEventListener('click', (e) => {
                // 親のdiv(sound-controls)への伝播を防ぐ必要はないが念のため
                const now = Date.now();
                if (now - lastClickTime < 300) {
                    // ダブルクリック: 停止（位置リセット）
                    this.stop();
                } else if (this.isPlaying) {
                    // 再生中シングルクリック: 一時停止
                    this.pause();
                } else if (this.isPaused) {
                    // 一時停止中シングルクリック: 再開
                    this.resume();
                } else {
                    // 停止中シングルクリック: 再生
                    this.play();
                }
                lastClickTime = now;
            });
        }

        // STEP REC（ステップ録音ON/OFF）
        const stepRecBtn = document.getElementById('sound-step-rec-btn');
        if (stepRecBtn) {
            stepRecBtn.addEventListener('click', () => {
                this.isStepRecording = !this.isStepRecording;
                stepRecBtn.classList.toggle('active', this.isStepRecording);
                if (this.isStepRecording) {
                    // ステップ録音ON: 現在位置をリセット
                    this.currentStep = 0;
                    this.render();
                }
            });
        }

        // SELECT
        const selectBtn = document.getElementById('sound-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                this.startSelectionMode();
            });
        }

        // COPY（選択範囲をコピー / 長押しで数値指定ポップアップ）
        const copyBtn = document.getElementById('sound-copy-btn');
        if (copyBtn) {
            let copyPressTimer = null;
            let copyLongPressed = false;

            const onCopyStart = (e) => {
                copyLongPressed = false;
                copyPressTimer = setTimeout(() => {
                    copyPressTimer = null;
                    copyLongPressed = true;
                    this.openNumCopyPopup();
                }, 800);
            };

            const onCopyEnd = (e) => {
                if (copyPressTimer) {
                    clearTimeout(copyPressTimer);
                    copyPressTimer = null;
                }
                if (!copyLongPressed) {
                    this.copySelection();
                }
            };

            const onCopyCancel = () => {
                if (copyPressTimer) {
                    clearTimeout(copyPressTimer);
                    copyPressTimer = null;
                }
            };

            copyBtn.addEventListener('mousedown', onCopyStart);
            copyBtn.addEventListener('mouseup', onCopyEnd);
            copyBtn.addEventListener('mouseleave', onCopyCancel);
            copyBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                onCopyStart(e);
            }, { passive: false });
            copyBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                onCopyEnd(e);
            });
            copyBtn.addEventListener('touchcancel', onCopyCancel);
        }

        // PASTE（コピーした範囲をペースト）
        const pasteBtn = document.getElementById('sound-paste-btn');
        if (pasteBtn) {
            pasteBtn.addEventListener('click', () => this.startPasteMode());
        }

        // REST（ステップを進める、休符入力）
        const restBtn = document.getElementById('sound-rest-btn');
        if (restBtn) {
            restBtn.addEventListener('click', () => {
                if (this.isStepRecording) {
                    this.currentStep++;
                    const song = this.getCurrentSong();
                    const maxSteps = song.bars;
                    if (this.currentStep >= maxSteps) {
                        this.currentStep = 0;
                    }
                    this.render();
                }
            });
        }

        // TIE（直前のノートを1ステップ延長）
        const tieBtn = document.getElementById('sound-tie-btn');
        if (tieBtn) {
            tieBtn.addEventListener('click', () => {
                if (this.isStepRecording) {
                    const song = this.getCurrentSong();
                    const track = song.tracks[this.currentTrack];
                    // 直前のステップにあるノートを延長
                    const prevStep = this.currentStep - 1;
                    if (prevStep >= 0) {
                        const prevNote = track.notes.find(n => n.step + n.length - 1 === prevStep);
                        if (prevNote) {
                            prevNote.length++;
                            this.currentStep++;
                            const maxSteps = song.bars;
                            if (this.currentStep >= maxSteps) {
                                this.currentStep = 0;
                            }
                            this.render();
                        }
                    }
                }
            });
        }

        // PEN（通常入力モードに戻る）
        const penBtn = document.getElementById('sound-pen-btn');
        if (penBtn) {
            penBtn.addEventListener('click', () => {
                // モード解除してペン（入力）モードへ
                this.currentTool = 'pencil';
                this.selectionMode = false;
                this.pasteMode = false;

                // 選択範囲クリア
                this.selectionStart = null;
                this.selectionEnd = null;
                this.pasteData = null; // ペーストデータもクリア

                // ボタンのアクティブ状態を更新
                const allBtns = document.querySelectorAll('#sound-controls .sound-ctrl-btn');
                allBtns.forEach(b => b.classList.remove('active'));
                penBtn.classList.add('active');

                this.render();
            });
        }

        // 消しゴム（クリック: 消しゴムモード切替、長押し: トラック全削除）
        const eraserBtn = document.getElementById('sound-eraser-btn');
        if (eraserBtn) {
            let longPressTimer = null;
            let isLongPress = false;

            const startLongPress = () => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    this.clearCurrentTrack();
                }, 800);
            };

            const cancelLongPress = () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };

            eraserBtn.addEventListener('mousedown', startLongPress);
            eraserBtn.addEventListener('mouseup', cancelLongPress);
            eraserBtn.addEventListener('mouseleave', cancelLongPress);
            eraserBtn.addEventListener('touchstart', startLongPress, { passive: true });
            eraserBtn.addEventListener('touchend', cancelLongPress);
            eraserBtn.addEventListener('touchcancel', cancelLongPress);

            eraserBtn.addEventListener('click', () => {
                if (!isLongPress) {
                    // 範囲選択中なら選択範囲を一括削除
                    if (this.selectionStart && this.selectionEnd) {
                        const song = this.getCurrentSong();
                        const track = song.tracks[this.currentTrack];
                        
                        const sStep = Math.min(this.selectionStart.step, this.selectionEnd.step);
                        const eStep = Math.max(this.selectionStart.step, this.selectionEnd.step);
                        const sPitch = Math.min(this.selectionStart.pitch, this.selectionEnd.pitch);
                        const ePitch = Math.max(this.selectionStart.pitch, this.selectionEnd.pitch);

                        track.notes = track.notes.filter(n => {
                            // 範囲内にあるノートは除外（削除）
                            return !(n.step >= sStep && n.step <= eStep && n.pitch >= sPitch && n.pitch <= ePitch);
                        });
                    }

                    // 消しゴムモードに切り替え
                    this.currentTool = 'eraser';
                    this.selectionMode = false;
                    this.pasteMode = false;
                    this.selectionStart = null;
                    this.selectionEnd = null;
                    this.pasteData = null;

                    // ボタンのアクティブ状態を更新
                    const allBtns = document.querySelectorAll('#sound-controls .sound-ctrl-btn');
                    allBtns.forEach(b => b.classList.remove('active'));
                    eraserBtn.classList.add('active');

                    this.render();
                }
            });
        }
    },

    // ========== 鍵盤 ==========
    initKeyboard() {
        const container = document.getElementById('piano-keyboard');
        const keyboardArea = document.getElementById('keyboard-area');
        if (!container || !keyboardArea) return;
        container.innerHTML = '';

        // 6オクターブ (C1-B6)
        const octaves = [1, 2, 3, 4, 5, 6];
        let whiteKeyIndex = 0;
        const whiteKeyWidth = 40; // CSS拡大版に合わせる

        octaves.forEach(oct => {
            this.noteNames.forEach((note, idx) => {
                const isBlack = note.includes('#');
                const key = document.createElement('div');
                key.className = 'piano-key ' + (isBlack ? 'black' : 'white');
                key.dataset.note = note;
                key.dataset.octave = oct;

                if (isBlack) {
                    // 黒鍵の位置を計算 (白鍵幅40pxに対応)
                    const prevWhiteKeys = whiteKeyIndex;
                    key.style.left = (prevWhiteKeys * whiteKeyWidth - 12) + 'px';
                } else {
                    whiteKeyIndex++;
                }

                // 鍵盤押下開始
                const startHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.startKeySound(note, oct);
                };

                // 鍵盤離す
                const endHandler = (e) => {
                    this.stopKeySound();
                };

                key.addEventListener('touchstart', startHandler, { passive: false });
                key.addEventListener('mousedown', startHandler);
                key.addEventListener('touchend', endHandler);
                key.addEventListener('touchcancel', endHandler);
                key.addEventListener('mouseup', endHandler);
                key.addEventListener('mouseleave', endHandler);

                container.appendChild(key);
            });
        });

        // ドラッグスクロール機能
        let isDragging = false;
        let hasMoved = false; // ドラッグ移動発生フラグ
        let startX = 0;
        let scrollLeft = 0;

        keyboardArea.addEventListener('mousedown', (e) => {
            // 鍵盤自体のクリックは除外
            if (e.target.classList.contains('piano-key')) return;
            isDragging = true;
            startX = e.pageX - keyboardArea.offsetLeft;
            scrollLeft = keyboardArea.scrollLeft;
            keyboardArea.style.cursor = 'grabbing';
        });

        keyboardArea.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - keyboardArea.offsetLeft;
            const walk = (x - startX) * 1.5;
            keyboardArea.scrollLeft = scrollLeft - walk;
        });

        keyboardArea.addEventListener('mouseup', () => {
            isDragging = false;
            keyboardArea.style.cursor = 'grab';
        });

        keyboardArea.addEventListener('mouseleave', () => {
            isDragging = false;
            keyboardArea.style.cursor = 'grab';
        });

        // タッチスクロール
        let touchStartX = 0;
        let touchScrollLeft = 0;

        keyboardArea.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('piano-key')) return;
            touchStartX = e.touches[0].pageX;
            touchScrollLeft = keyboardArea.scrollLeft;
        }, { passive: true });

        keyboardArea.addEventListener('touchmove', (e) => {
            if (e.target.classList.contains('piano-key')) return;
            const x = e.touches[0].pageX;
            const walk = (touchStartX - x) * 1.5;
            keyboardArea.scrollLeft = touchScrollLeft + walk;
            this.updateScrollbar();
        }, { passive: true });

        // 初期カーソル
        keyboardArea.style.cursor = 'grab';

        // rangeスライダー連動
        this.initKeyboardScrollbar();

        // 初期スクロール位置（C4が左端に表示）
        // C1からC4まで白鍵は21個（C,D,E,F,G,A,B × 3オクターブ = 21個）
        // 白鍵幅40px × 21 = 840px
        const setInitialScroll = () => {
            const targetScroll = 840;
            if (keyboardArea.scrollWidth > keyboardArea.clientWidth) {
                keyboardArea.scrollLeft = targetScroll;

                // スクロールバーも同期
                const scrollbar = document.getElementById('keyboard-scrollbar');
                if (scrollbar) {
                    const maxScroll = keyboardArea.scrollWidth - keyboardArea.clientWidth;
                    if (maxScroll > 0) {
                        scrollbar.value = (targetScroll / maxScroll) * 100;
                    }
                }
            } else {
                // まだ描画されていない場合、再試行
                requestAnimationFrame(setInitialScroll);
            }
        };
        requestAnimationFrame(setInitialScroll);

        // --- PCキーボード対応 ---
        if (typeof this.kbBaseOctave === 'undefined') {
            this.kbBaseOctave = 4; // 初期オクターブ
        }

        const keyMap = {
            'A': { note: 'C', octaveOffset: 0 },
            'W': { note: 'C#', octaveOffset: 0 },
            'S': { note: 'D', octaveOffset: 0 },
            'E': { note: 'D#', octaveOffset: 0 },
            'D': { note: 'E', octaveOffset: 0 },
            'F': { note: 'F', octaveOffset: 0 },
            'T': { note: 'F#', octaveOffset: 0 },
            'G': { note: 'G', octaveOffset: 0 },
            'Y': { note: 'G#', octaveOffset: 0 },
            'H': { note: 'A', octaveOffset: 0 },
            'U': { note: 'A#', octaveOffset: 0 },
            'J': { note: 'B', octaveOffset: 0 },
            'K': { note: 'C', octaveOffset: 1 },
            'O': { note: 'C#', octaveOffset: 1 },
            'L': { note: 'D', octaveOffset: 1 }
        };

        window.addEventListener('keydown', (e) => {
            if (App.currentScreen !== 'sound') return;
            if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

            const key = e.key.toUpperCase();

            // スペースキー操作
            if (key === ' ' || e.code === 'Space') {
                e.preventDefault();
                if (e.repeat) return; // 押しっぱなしによる連続トグルを防ぐ

                if (e.shiftKey) {
                    // Shift + Space: 録音 (STEP REC) Toggle
                    const stepRecBtn = document.getElementById('sound-step-rec-btn');
                    if (stepRecBtn) {
                        stepRecBtn.classList.add('pressed');
                        stepRecBtn.click();
                    }
                } else {
                    // Space: 再生 / 停止
                    const playBtn = document.getElementById('sound-play-btn');
                    if (playBtn) {
                        playBtn.classList.add('pressed');
                        playBtn.click();
                    }
                }
                return;
            }

            // オクターブ変更
            if (key === 'Z') {
                this.kbBaseOctave = Math.max(1, this.kbBaseOctave - 1);
                return;
            }
            if (key === 'X') {
                this.kbBaseOctave = Math.min(6, this.kbBaseOctave + 1);
                return;
            }

            // 戻る（左矢印キー）
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (e.repeat) return;
                const delBtn = document.getElementById('sound-del-btn');
                if (delBtn) {
                    delBtn.classList.add('pressed');
                    delBtn.click();
                }
                return;
            }

            // REST / TIE（右矢印キー）
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (e.repeat) return;
                if (e.shiftKey) {
                    // TIE
                    const tieBtn = document.getElementById('sound-tie-btn');
                    if (tieBtn) {
                        tieBtn.classList.add('pressed');
                        tieBtn.click();
                    }
                } else {
                    // REST
                    const restBtn = document.getElementById('sound-rest-btn');
                    if (restBtn) {
                        restBtn.classList.add('pressed');
                        restBtn.click();
                    }
                }
                return;
            }

            // ピアノキー
            const mapping = keyMap[key];
            if (mapping) {
                if (e.repeat) return; // 押しっぱなしによる連続再生を防ぐ
                const oct = this.kbBaseOctave + mapping.octaveOffset;
                if (oct > 6) return;

                // 物理鍵盤の視覚的フィードバック
                const keyEl = document.querySelector(`.piano-key[data-note="${mapping.note}"][data-octave="${oct}"]`);
                if (keyEl) keyEl.classList.add('active');

                // UIの鍵盤クリックと同じ挙動
                // (startKeySound内部でハイライトと録音処理も行われる)
                this.startKeySound(mapping.note, oct);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (App.currentScreen !== 'sound') return;
            const key = e.key.toUpperCase();

            // ピアノキー解除
            if (keyMap[key]) {
                const mapping = keyMap[key];
                // 全てのオクターブの同一音階からactiveを除去（オクターブ切替時の残存防止）
                // ただし、正確な解除のためには現在または直前のオクターブを探す
                const activeKeys = document.querySelectorAll(`.piano-key.active[data-note="${mapping.note}"]`);
                activeKeys.forEach(k => k.classList.remove('active'));

                this.stopKeySound();
            }

            // ボタン解除
            if (key === ' ' || e.code === 'Space') {
                document.getElementById('sound-step-rec-btn')?.classList.remove('pressed');
                document.getElementById('sound-play-btn')?.classList.remove('pressed');
            }
            if (e.key === 'ArrowLeft') {
                document.getElementById('sound-del-btn')?.classList.remove('pressed');
            }
            if (e.key === 'ArrowRight') {
                document.getElementById('sound-rest-btn')?.classList.remove('pressed');
                document.getElementById('sound-tie-btn')?.classList.remove('pressed');
            }
        });
    },

    initKeyboardScrollbar() {
        const scrollbar = document.getElementById('keyboard-scrollbar');
        const keyboardArea = document.getElementById('keyboard-area');
        if (!scrollbar || !keyboardArea) return;

        // スライダー操作時
        scrollbar.addEventListener('input', () => {
            const maxScroll = keyboardArea.scrollWidth - keyboardArea.clientWidth;
            keyboardArea.scrollLeft = (scrollbar.value / 100) * maxScroll;
        });

        // 鍵盤スクロール時
        keyboardArea.addEventListener('scroll', () => {
            this.updateScrollbar();
        });
    },

    updateScrollbar() {
        const scrollbar = document.getElementById('keyboard-scrollbar');
        const keyboardArea = document.getElementById('keyboard-area');
        if (!scrollbar || !keyboardArea) return;

        const maxScroll = keyboardArea.scrollWidth - keyboardArea.clientWidth;
        if (maxScroll > 0) {
            scrollbar.value = (keyboardArea.scrollLeft / maxScroll) * 100;
        }
    },

    onKeyPress(note, octave) {
        // 音再生
        this.playNote(note, octave);

        // ピアノロールのハイライト
        const pitch = this.noteToPitch(note, octave);
        this.highlightPitch = pitch;
        this.render();
        setTimeout(() => {
            this.highlightPitch = -1;
            this.render();
        }, 200);

        // ステップ録音ON時のみノート入力
        if (this.isStepRecording) {
            this.inputNote(note, octave);
        }
    },

    // 現在再生中のオシレーターとゲイン
    currentKeyOsc: null,
    currentKeyGain: null,

    startKeySound(note, octave) {
        // 既に再生中なら停止
        this.stopKeySound();

        if (!this.audioCtx) return;

        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        const trackType = this.trackTypes[this.currentTrack];
        const pitch = this.noteToPitch(note, octave);
        const tone = track.tone || 0;

        // ノイズトラック
        if (trackType === 'noise') {
            let result;
            if (tone === 0) {
                result = this.playPitchedNoise(pitch, 0.5, track.volume, track.pan);
            } else {
                result = this.playDrum(pitch, 0.5, track.volume, track.pan, tone);
            }
            if (result) {
                this.currentKeyOsc = result.noise;
                this.currentKeyGain = result.gain;
            }
        } else if (trackType === 'triangle' && tone === 3) {
            // Kickトーン：ピッチ下降音を再生
            this.playKickTone(note, octave, track.volume, track.pan);
        } else if (trackType === 'square' && tone === 6) {
            // Tremoloトーン：1オクターブ上と交互に高速切替
            const freq1 = this.getFrequency(note, octave);
            const freq2 = freq1 * 2;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const panner = this.audioCtx.createStereoPanner();

            panner.pan.value = track.pan;
            gain.connect(panner);
            panner.connect(this.audioCtx.destination);

            osc.type = 'square';

            // 高速で周波数を交互に切り替える（約30Hzで交互、5秒分スケジュール）
            const tremoloRate = 30;
            const maxDuration = 5;
            const numCycles = tremoloRate * maxDuration;
            const cycleTime = 1 / tremoloRate;

            for (let i = 0; i < numCycles; i++) {
                const t = this.audioCtx.currentTime + i * cycleTime;
                osc.frequency.setValueAtTime(i % 2 === 0 ? freq1 : freq2, t);
            }

            // Tremoloの音量
            gain.gain.value = 0.05 * track.volume;

            osc.connect(gain);
            osc.start();

            this.currentKeyOsc = osc;
            this.currentKeyGain = gain;
        } else {
            const freq = this.getFrequency(note, octave);
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            // パンポット（定位）
            const panner = this.audioCtx.createStereoPanner();
            panner.pan.value = track.pan;

            gain.connect(panner);
            panner.connect(this.audioCtx.destination);

            let volumeScale = 1.0;

            // 波形タイプと音色
            if (trackType === 'square') {
                // tone 0-2: Standard (50%), tone 3-5: Sharp (12.5%)
                if (tone >= 3 && tone <= 5) {
                    const wave = this.getPeriodicWave(0.125);
                    if (wave) osc.setPeriodicWave(wave);
                    else osc.type = 'square';
                } else {
                    osc.type = 'square';
                }
            } else if (trackType === 'triangle') {
                if (tone === 0) {
                    osc.type = 'triangle';
                } else if (tone === 1) {
                    osc.type = 'sine';
                } else if (tone === 2) {
                    osc.type = 'sawtooth';
                    volumeScale = 0.6;
                }
            }

            osc.frequency.value = freq;
            // tone別の基本音量
            let baseVol;
            if (trackType === 'square') {
                switch (tone) {
                    case 0: baseVol = 0.12; break; // Standard
                    case 1: baseVol = 0.15; break; // Standard (Short)
                    case 2: baseVol = 0.15; break; // Standard (FadeIn)
                    case 3: baseVol = 0.25; break; // Sharp
                    case 4: baseVol = 0.35; break; // Sharp (Short)
                    case 5: baseVol = 0.3; break;  // Sharp (FadeIn)
                    case 6: baseVol = 0.05; break; // Tremolo
                    default: baseVol = 0.12; break;
                }
            } else {
                baseVol = 0.2; // Triangle等
            }
            if (trackType === 'triangle' && tone === 2) {
                volumeScale = 0.6; // Sawtooth
            }
            gain.gain.value = baseVol * track.volume * volumeScale;

            osc.connect(gain);
            osc.start();

            this.currentKeyOsc = osc;
            this.currentKeyGain = gain;
        }

        // ピアノロールのハイライト
        this.highlightPitch = pitch;
        this.render();

        // ステップ録音/リアルタイム録音
        if (this.isStepRecording) {
            if (this.isPlaying) {
                // リアルタイム録音：開始位置とピッチを記録
                this.rtNoteStartStep = this.currentStep;
                this.rtNotePitch = pitch;
            } else {
                // 通常のステップ録音
                this.inputNote(note, octave);
            }
        }
    },

    stopKeySound() {
        // リアルタイム録音の確定
        if (this.isStepRecording && this.isPlaying && this.rtNoteStartStep !== -1) {
            const song = this.getCurrentSong();
            const track = song.tracks[this.currentTrack];
            const maxSteps = song.bars;

            // 長さを計算
            let length = this.currentStep - this.rtNoteStartStep;
            if (length <= 0) {
                // ループまたぎの考慮
                if (this.currentStep < this.rtNoteStartStep) {
                    length = (maxSteps - this.rtNoteStartStep) + this.currentStep;
                } else {
                    length = 1; // 同一ステップ内でのリリース
                }
            }

            if (length > 0) {
                track.notes.push({
                    step: this.rtNoteStartStep,
                    pitch: this.rtNotePitch,
                    length: length
                });
            }

            this.rtNoteStartStep = -1;
            this.rtNotePitch = -1;
        }

        if (this.currentKeyGain) {
            // フェードアウト
            this.currentKeyGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        }
        if (this.currentKeyOsc) {
            this.currentKeyOsc.stop(this.audioCtx.currentTime + 0.1);
            this.currentKeyOsc = null;
            this.currentKeyGain = null;
        }

        // ハイライト解除
        this.highlightPitch = -1;
        this.render();
    },

    // Kickトーン（短くピッチ下降する音）
    playKickTone(note, octave, volume, pan, duration = 0.15) {
        if (!this.audioCtx) return;

        const freq = this.getFrequency(note, octave);
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();

        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(this.audioCtx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.25, this.audioCtx.currentTime + duration);

        gain.gain.setValueAtTime(0.5 * volume, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    },

    // トレモロ（1オクターブ上と交互に高速切替）
    playTremolo(note, octave, volume, pan, duration) {
        if (!this.audioCtx) return;

        const freq1 = this.getFrequency(note, octave);
        const freq2 = freq1 * 2; // 1オクターブ上
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();

        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(this.audioCtx.destination);

        osc.type = 'square';

        // 高速で周波数を交互に切り替える（約30Hzで交互）
        const tremoloRate = 30;
        const numCycles = Math.ceil(duration * tremoloRate);
        const cycleTime = 1 / tremoloRate;

        for (let i = 0; i < numCycles; i++) {
            const t = this.audioCtx.currentTime + i * cycleTime;
            osc.frequency.setValueAtTime(i % 2 === 0 ? freq1 : freq2, t);
        }

        // Tremoloの音量
        gain.gain.setValueAtTime(0.05 * volume, this.audioCtx.currentTime);
        const sustainTime = duration * 0.8;
        gain.gain.setValueAtTime(0.05 * volume, this.audioCtx.currentTime + sustainTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    },

    playNote(note, octave, duration = 0.2) {
        if (!this.audioCtx) return;

        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        const trackType = this.trackTypes[this.currentTrack];
        const tone = track.tone || 0;

        // ノイズトラック
        if (trackType === 'noise') {
            const pitch = this.noteToPitch(note, octave);
            if (tone === 0) {
                // Noise (ピッチ): 音程に連動する持続ノイズ
                this.playPitchedNoise(pitch, duration, track.volume, track.pan);
            } else {
                // Drum Kit: 従来のドラム音
                this.playDrum(pitch, duration, track.volume, track.pan, tone);
            }
            return;
        }

        // TRIANGLE Kickトーン
        if (trackType === 'triangle' && tone === 3) {
            this.playKickTone(note, octave, track.volume, track.pan, duration);
            return;
        }

        // SQUARE Tremoloトーン
        if (trackType === 'square' && tone === 6) {
            this.playTremolo(note, octave, track.volume, track.pan, duration);
            return;
        }

        // 通常の音色
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = track.pan;
        gain.connect(panner);
        panner.connect(this.audioCtx.destination);

        const freq = this.getFrequency(note, octave);
        const osc = this.audioCtx.createOscillator();
        let volumeScale = 1.0;

        // 波形タイプ
        if (trackType === 'square') {
            // tone 0-2: Standard (50%), tone 3-5: Sharp (12.5%)
            if (tone >= 3 && tone <= 5) {
                const wave = this.getPeriodicWave(0.125);
                if (wave) osc.setPeriodicWave(wave);
                else osc.type = 'square';
            } else {
                osc.type = 'square';
            }
        } else if (trackType === 'triangle') {
            if (tone === 0) osc.type = 'triangle';
            else if (tone === 1) osc.type = 'sine';
            else if (tone === 2) {
                osc.type = 'sawtooth';
                volumeScale = 0.6;
            }
        }

        osc.frequency.value = freq;

        // tone別の基本音量
        let baseVol;
        if (trackType === 'square') {
            switch (tone) {
                case 0: baseVol = 0.12; break; // Standard
                case 1: baseVol = 0.15; break; // Standard (Short)
                case 2: baseVol = 0.15; break; // Standard (FadeIn)
                case 3: baseVol = 0.25; break; // Sharp
                case 4: baseVol = 0.35; break; // Sharp (Short)
                case 5: baseVol = 0.3; break;  // Sharp (FadeIn)
                case 6: baseVol = 0.05; break; // Tremolo
                default: baseVol = 0.12; break;
            }
        } else {
            baseVol = 0.2; // Triangle等
        }
        const volume = baseVol * track.volume * volumeScale;

        // エンベロープ設定
        const isShort = (tone === 1 || tone === 4); // Standard Short or Sharp Short
        const isFadeIn = (tone === 2 || tone === 5); // Standard FadeIn or Sharp FadeIn

        if (isShort) {
            // Short: 短くスタッカート気味
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration * 0.5);
        } else if (isFadeIn) {
            // FadeIn: アタックがなく徐々に大きくなる
            gain.gain.setValueAtTime(0.01, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(volume, this.audioCtx.currentTime + duration * 0.7);
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime + duration * 0.9);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        } else {
            // Normal: 通常のエンベロープ
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            const sustainTime = duration * 0.8;
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime + sustainTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        }

        osc.connect(gain);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    },

    // 再生用（トラックごとに同時発音数1に制限）
    playNoteMonophonic(note, octave, duration, trackIdx) {
        if (!this.audioCtx) return;

        const song = this.getCurrentSong();
        const track = song.tracks[trackIdx];
        const trackType = this.trackTypes[trackIdx];
        const tone = track.tone || 0;

        // 前の音を停止
        if (this.activeOscillators[trackIdx]) {
            try {
                this.activeOscillators[trackIdx].osc.stop();
            } catch (e) { }
            this.activeOscillators[trackIdx] = null;
        }

        // ノイズトラック
        if (trackType === 'noise') {
            const pitch = this.noteToPitch(note, octave);
            if (tone === 0) {
                this.playPitchedNoise(pitch, duration, track.volume, track.pan);
            } else {
                this.playDrum(pitch, duration, track.volume, track.pan, tone);
            }
            return;
        }

        // TRIANGLE Kickトーン
        if (trackType === 'triangle' && tone === 3) {
            this.playKickTone(note, octave, track.volume, track.pan, duration);
            return;
        }

        // SQUARE Tremoloトーン
        if (trackType === 'square' && tone === 6) {
            this.playTremolo(note, octave, track.volume, track.pan, duration);
            return;
        }

        // 通常の音色
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = track.pan;
        gain.connect(panner);
        panner.connect(this.audioCtx.destination);

        const freq = this.getFrequency(note, octave);
        const osc = this.audioCtx.createOscillator();
        let volumeScale = 1.0;

        // 波形タイプ
        if (trackType === 'square') {
            // tone 0-2: Standard (50%), tone 3-5: Sharp (12.5%)
            if (tone >= 3 && tone <= 5) {
                const wave = this.getPeriodicWave(0.125);
                if (wave) osc.setPeriodicWave(wave);
                else osc.type = 'square';
            } else {
                osc.type = 'square';
            }
        } else if (trackType === 'triangle') {
            if (tone === 0) osc.type = 'triangle';
            else if (tone === 1) osc.type = 'sine';
            else if (tone === 2) {
                osc.type = 'sawtooth';
                volumeScale = 0.6;
            }
        }

        osc.frequency.value = freq;

        // tone別の基本音量
        let baseVol;
        if (trackType === 'square') {
            switch (tone) {
                case 0: baseVol = 0.12; break; // Standard
                case 1: baseVol = 0.15; break; // Standard (Short)
                case 2: baseVol = 0.15; break; // Standard (FadeIn)
                case 3: baseVol = 0.25; break; // Sharp
                case 4: baseVol = 0.35; break; // Sharp (Short)
                case 5: baseVol = 0.3; break;  // Sharp (FadeIn)
                case 6: baseVol = 0.05; break; // Tremolo
                default: baseVol = 0.12; break;
            }
        } else {
            baseVol = 0.2; // Triangle等
        }
        const volume = baseVol * track.volume * volumeScale;

        // エンベロープ設定
        const isShort = (tone === 1 || tone === 4); // Standard Short or Sharp Short
        const isFadeIn = (tone === 2 || tone === 5); // Standard FadeIn or Sharp FadeIn

        if (isShort) {
            // Short: 短くスタッカート気味
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration * 0.5);
        } else if (isFadeIn) {
            // FadeIn: アタックがなく徐々に大きくなる
            gain.gain.setValueAtTime(0.01, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(volume, this.audioCtx.currentTime + duration * 0.7);
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime + duration * 0.9);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        } else {
            // Normal: 通常のエンベロープ
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(volume, this.audioCtx.currentTime + duration - 0.05);
            gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        }

        osc.connect(gain);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration + 0.05);

        this.activeOscillators[trackIdx] = { osc, gain };

        // 停止後にクリア
        setTimeout(() => {
            if (this.activeOscillators[trackIdx] && this.activeOscillators[trackIdx].osc === osc) {
                this.activeOscillators[trackIdx] = null;
            }
        }, duration * 1000);
    },

    getFrequency(note, octave) {
        const noteIdx = this.noteNames.indexOf(note);
        // A4 = 440Hz
        const semitone = (octave - 4) * 12 + noteIdx - 9;
        return 440 * Math.pow(2, semitone / 12);
    },

    noteToPitch(note, octave) {
        // C1 = 0, B5 = 59
        const noteIdx = this.noteNames.indexOf(note);
        return (octave - 1) * 12 + noteIdx;
    },

    pitchToNote(pitch) {
        const octave = Math.floor(pitch / 12) + 1;
        const noteIdx = pitch % 12;
        return { note: this.noteNames[noteIdx], octave };
    },

    // ========== Noise (ピッチ) - 音程対応の持続ノイズ ==========
    playPitchedNoise(pitch, duration, volume = 1.0, pan = 0.0) {
        if (!this.audioCtx) return null;

        const ctx = this.audioCtx;
        const t = ctx.currentTime;

        // ピアノロールの音程から周波数を取得
        const { note, octave } = this.pitchToNote(pitch);
        const freq = this.getFrequency(note, octave);

        const actualDuration = duration * 0.6; // データの長さを60%に調整

        // LFSRノイズバッファ生成（入力データの長さに合わせて持続）
        const bufferDuration = actualDuration + 0.05;
        const bufferSize = Math.floor(ctx.sampleRate * bufferDuration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        let lfsr = 1;
        for (let i = 0; i < bufferSize; i++) {
            const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
            data[i] = (lfsr & 1) ? 1.0 : -1.0;
            lfsr = (lfsr >> 1) | (bit << 14);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // バンドパスフィルタで音程感を付与
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 1.2; // 抜け感のある「ザーッ」にするためQを低めに設定

        // ゲインノード
        const gain = ctx.createGain();
        const noiseVol = 0.44 * volume; // 元の0.55から80%に音量を調整

        // パンポット
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;

        // エンベロープ: 入力の長さに合わせて持続し、最後に短い減衰
        gain.gain.setValueAtTime(noiseVol, t);
        gain.gain.setValueAtTime(noiseVol, t + Math.max(0, actualDuration - 0.03));
        gain.gain.linearRampToValueAtTime(0.01, t + actualDuration);

        // 接続
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);

        noise.start(t);
        noise.stop(t + bufferDuration);

        return { noise: noise, gain: gain };
    },

    // NES APU風ドラムキット（オクターブ1-6で異なるドラム音）
    // Oct1=Low Kick, Oct2=Tight Snare, Oct3=Open Snare/Clap,
    // Oct4=Closed Hi-Hat, Oct5=Open Hi-Hat, Oct6=Noise Roll
    playDrum(pitch, duration, volume = 1.0, pan = 0.0, tone = 0) {
        if (!this.audioCtx) return null;

        const ctx = this.audioCtx;
        const t = ctx.currentTime;

        // オクターブ判定（pitch 0-11=Oct1, 12-23=Oct2, ...）
        const octave = Math.floor(pitch / 12) + 1;

        // --- ドラムタイプ別パラメータ ---
        let filterType, filterFreq, filterQ, drumVol, decayTime, useShortNoise, pitchEnvDown, attackTime, holdTime, isRoll;

        switch (octave) {
            case 1: // Low Kick — 丸く、空気感のある「ボッ」
                filterType = 'lowpass'; filterFreq = 120; filterQ = 1.5;
                drumVol = 0.9 * volume; decayTime = 0.14;
                useShortNoise = false; pitchEnvDown = true;
                attackTime = 0.008; holdTime = 0.00; isRoll = false; break;
            case 2: // Tight Snare — シャープ、タイト
                filterType = 'bandpass'; filterFreq = 1200; filterQ = 1.5;
                drumVol = 0.5 * volume; decayTime = 0.13;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.002; holdTime = 0.00; isRoll = false; break;
            case 3: // Open Snare / Clap — 自然なスネア感「タンッ」
                filterType = 'bandpass'; filterFreq = 2200; filterQ = 0.6;
                drumVol = 0.3 * volume; decayTime = 0.22;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.003; holdTime = 0.015; isRoll = false; break;
            case 4: // Closed Hi-Hat — ホワイトノイズ寄り、極短「サッ」
                filterType = 'highpass'; filterFreq = 7000; filterQ = 0.5;
                drumVol = 0.3 * volume; decayTime = 0.05;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.001; holdTime = 0.00; isRoll = false; break;
            case 5: // Open Hi-Hat — ホワイトノイズ寄り、広がり「サー」
                filterType = 'highpass'; filterFreq = 5000; filterQ = 0.5;
                drumVol = 0.3 * volume; decayTime = 0.25;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.001; holdTime = 0.00; isRoll = false; break;
            case 6: // Noise Roll — 連続ロール「タタタタタ」
            default:
                filterType = 'bandpass'; filterFreq = 3000; filterQ = 0.8;
                drumVol = 0.3 * volume;
                // 音長が0.15s（1STEP強）より長い場合のみロール（高速リトリガー）にする
                isRoll = (duration > 0.15);
                decayTime = isRoll ? duration : 0.15; // 短い場合は単発のディケイ
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.005; holdTime = 0.00; break;
        }

        // 同一オクターブ内のノート位置で微妙にパラメータ変化
        const noteInOct = pitch % 12;
        filterFreq *= (1 + noteInOct * 0.02); // ノートが上がるとフィルタ周波数が少し上がる
        if (!isRoll) decayTime *= (1 + noteInOct * 0.015);

        // --- NES APU 15-bit LFSR風ノイズ生成 ---
        const actualDuration = Math.max(decayTime + attackTime + holdTime + 0.02, 0.05);
        const bufferSize = Math.floor(ctx.sampleRate * actualDuration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (useShortNoise) {
            // 短周期ノイズ（NES short-mode LFSR: 93サンプル周期をループ）
            const period = 93;
            const shortBuf = new Float32Array(period);
            let lfsr = 1;
            for (let i = 0; i < period; i++) {
                const bit = ((lfsr >> 0) ^ (lfsr >> 6)) & 1;
                shortBuf[i] = (lfsr & 1) ? 1.0 : -1.0;
                lfsr = (lfsr >> 1) | (bit << 14);
            }
            for (let i = 0; i < bufferSize; i++) {
                data[i] = shortBuf[i % period];
            }
        } else {
            // 長周期ノイズ（NES long-mode LFSR）
            let lfsr = 1;
            for (let i = 0; i < bufferSize; i++) {
                const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
                data[i] = (lfsr & 1) ? 1.0 : -1.0;
                lfsr = (lfsr >> 1) | (bit << 14);
            }
        }

        // ロール用の高速リトリガー（内部的な音量変調で粒立ちを作る）
        if (isRoll) {
            const rollRate = 24; // 1秒間のパルス数
            for (let i = 0; i < bufferSize; i++) {
                const sec = i / ctx.sampleRate;
                const phase = (sec * rollRate) % 1.0;
                const amp = 0.2 + 0.8 * Math.pow(1.0 - phase, 2); // 減衰するパルス形状
                data[i] *= amp;
            }
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // フィルタ
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = filterFreq;
        filter.Q.value = filterQ;

        // ピッチダウンエンベロープ（Low Kick用）
        if (pitchEnvDown) {
            filter.frequency.setValueAtTime(filterFreq * 2.5, t); // 少し浅く
            filter.frequency.exponentialRampToValueAtTime(filterFreq, t + decayTime * 0.4);
        }

        // ゲインノード
        const gain = ctx.createGain();

        // パンポット
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;

        // 接続
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);

        // エンベロープ
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(drumVol, t + attackTime);
        if (isRoll) {
            // ロールは指定durationまで音を持続させ、最後に減衰
            gain.gain.setValueAtTime(drumVol, t + Math.max(0, duration - 0.05));
            gain.gain.linearRampToValueAtTime(0.01, t + duration);
        } else if (holdTime > 0) {
            gain.gain.setValueAtTime(drumVol, t + attackTime + holdTime);
            gain.gain.exponentialRampToValueAtTime(0.01, t + attackTime + holdTime + decayTime);
        } else {
            gain.gain.exponentialRampToValueAtTime(0.01, t + attackTime + decayTime);
        }

        noise.start(t);
        noise.stop(t + actualDuration);

        return { noise: noise, gain: gain };
    },
    // ========== ノート入力 ==========
    inputNote(note, octave, length = 1) {
        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        const pitch = this.noteToPitch(note, octave);
        const maxSteps = song.bars;

        if (this.currentStep < maxSteps) {
            track.notes.push({
                step: this.currentStep,
                pitch: pitch,
                length: length
            });
            this.currentStep++;
            this.render();
        }
    },

    inputRest() {
        const song = this.getCurrentSong();
        const maxSteps = song.bars;
        if (this.currentStep < maxSteps) {
            this.currentStep++;
            this.render();
        }
    },

    inputTie() {
        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        const maxSteps = song.bars;

        if (track.notes.length > 0) {
            const lastNote = track.notes[track.notes.length - 1];
            lastNote.length++;
            // ノートを伸ばした分、currentStepも進める
            if (this.currentStep < maxSteps) {
                this.currentStep++;
            }
            this.render();
        }
    },

    deleteLastNote() {
        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        if (track.notes.length > 0) {
            track.notes.pop();
            if (this.currentStep > 0) this.currentStep--;
            this.render();
        }
    },

    clearCurrentTrack() {
        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        if (track.notes.length === 0) return;

        // iOSでconfirmダイアログ中に音が溜まる問題対策：再生停止
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.stop();
        }

        App.showConfirm(this.t('U314').replace('${this.currentTrack + 1}', this.currentTrack + 1), "", () => {

        // iOSでconfirmダイアログ後にAudioContextが壊れる対策：再作成
        this.resetAudioContext();

        track.notes = [];
        this.currentStep = 0;
        this.render();
        });
    },

    // ========== コピー/ペースト（範囲選択方式） ==========
    // コピー/ペースト用の状態
    selectionMode: false,
    pasteMode: false,
    selectionStart: null,
    selectionEnd: null,
    noteClipboard: null,
    pasteOffset: { step: 0, pitch: 0 },

    // コピーモード開始（範囲選択）
    copyTrack() {
        this.selectionMode = true;
        this.pasteMode = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        // コピーボタンをアクティブに
        const copyBtn = document.getElementById('sound-copy-btn');
        if (copyBtn) copyBtn.classList.add('active');
        const pasteBtn = document.getElementById('sound-paste-btn');
        if (pasteBtn) pasteBtn.classList.remove('active');

        this.render();
    },

    // 範囲コピー確定
    confirmRangeCopy() {
        if (!this.selectionStart || !this.selectionEnd) return;

        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];

        const step1 = Math.min(this.selectionStart.step, this.selectionEnd.step);
        const step2 = Math.max(this.selectionStart.step, this.selectionEnd.step);
        const pitch1 = Math.min(this.selectionStart.pitch, this.selectionEnd.pitch);
        const pitch2 = Math.max(this.selectionStart.pitch, this.selectionEnd.pitch);

        // 範囲内のノートをコピー（相対位置で保存）
        const copiedNotes = [];
        track.notes.forEach(note => {
            if (note.step >= step1 && note.step <= step2 &&
                note.pitch >= pitch1 && note.pitch <= pitch2) {
                copiedNotes.push({
                    relStep: note.step - step1,
                    relPitch: note.pitch - pitch1,
                    length: note.length
                });
            }
        });

        if (copiedNotes.length === 0) {
            // コピー対象なし
            this.selectionMode = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            const copyBtn = document.getElementById('sound-copy-btn');
            if (copyBtn) copyBtn.classList.remove('active');
            this.render();
            return;
        }

        this.noteClipboard = {
            notes: copiedNotes,
            width: step2 - step1 + 1,
            height: pitch2 - pitch1 + 1
        };

        // 選択モード終了
        this.selectionMode = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        const copyBtn = document.getElementById('sound-copy-btn');
        if (copyBtn) copyBtn.classList.remove('active');
        this.render();
    },

    // ペーストモード開始
    pasteTrack() {
        if (!this.noteClipboard || this.noteClipboard.notes.length === 0) {
            return;
        }

        this.pasteMode = true;
        this.selectionMode = false;
        // 2ステップ右、2ピッチ下にオフセット
        this.pasteOffset = { step: 2, pitch: 2 };

        // ペーストボタンをアクティブに
        const pasteBtn = document.getElementById('sound-paste-btn');
        if (pasteBtn) pasteBtn.classList.add('active');
        const copyBtn = document.getElementById('sound-copy-btn');
        if (copyBtn) copyBtn.classList.remove('active');

        this.render();
    },

    // ペースト確定
    confirmPaste() {
        if (!this.noteClipboard) return;

        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        const maxSteps = song.bars;

        // ペーストデータを追加
        this.noteClipboard.notes.forEach(copyNote => {
            const newStep = this.pasteOffset.step + copyNote.relStep;
            const newPitch = this.pasteOffset.pitch + copyNote.relPitch;

            // 範囲チェック
            if (newStep >= 0 && newStep < maxSteps && newPitch >= 0 && newPitch < 72) {
                // 既存ノートとの重複チェック
                const exists = track.notes.some(n => n.step === newStep && n.pitch === newPitch);
                if (!exists) {
                    track.notes.push({
                        step: newStep,
                        pitch: newPitch,
                        length: copyNote.length
                    });
                }
            }
        });

        // ペーストモード終了
        this.pasteMode = false;
        const pasteBtn = document.getElementById('sound-paste-btn');
        if (pasteBtn) pasteBtn.classList.remove('active');
        this.render();
    },

    // コピー/ペーストのキャンセル
    cancelCopyPaste() {
        this.selectionMode = false;
        this.pasteMode = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        const copyBtn = document.getElementById('sound-copy-btn');
        if (copyBtn) copyBtn.classList.remove('active');
        const pasteBtn = document.getElementById('sound-paste-btn');
        if (pasteBtn) pasteBtn.classList.remove('active');

        this.render();
    },

    // ========== ピアノロール ==========
    initPianoRoll() {
        if (!this.canvas) return;

        let isDragging = false;
        let hasMoved = false; // 前回の編集で変数が消えていたなら追加
        let startX = 0, startY = 0;

        // 長押し＆ドラッグ用
        let longPressTimer = null;
        let isLongPress = false;
        // duplicate removed
        let draggingNote = null;
        let originalStep = 0;
        let originalPitch = 0;

        // --- オートスクロール関数 ---
        const stopAutoScroll = () => {
            if (this.autoScrollDelayTimer) {
                clearTimeout(this.autoScrollDelayTimer);
                this.autoScrollDelayTimer = null;
            }
            if (this.autoScrollTimer) {
                clearInterval(this.autoScrollTimer);
                this.autoScrollTimer = null;
            }
        };

        const startAutoScroll = (dx, dy, eventUpdater) => {
            this.autoScrollX = dx;
            this.autoScrollY = dy;
            if (this.autoScrollTimer || this.autoScrollDelayTimer) return;

            // 300ms待ってからスクロール開始
            this.autoScrollDelayTimer = setTimeout(() => {
                this.autoScrollDelayTimer = null;
                this.autoScrollTimer = setInterval(() => {
                    if (!isDragging) {
                        stopAutoScroll();
                        return;
                    }

                    const maxScrollY = 72 * this.cellSize - this.canvas.height;
                    const oldX = this.scrollX;
                    const oldY = this.scrollY;

                    this.scrollX = Math.max(0, this.scrollX + this.autoScrollX);
                    this.scrollY = Math.max(0, Math.min(maxScrollY, this.scrollY + this.autoScrollY));

                    if (this.scrollX === oldX && this.scrollY === oldY) return;

                    // 座標更新のために直前のイベントで再処理
                    if (this.lastPointerEvent) {
                        eventUpdater(this.lastPointerEvent);
                    }
                    this.render();
                }, 30);
            }, 300);
        };

        const checkAutoScroll = (clientX, clientY, eventUpdater) => {

            const rect = this.canvas.getBoundingClientRect();
            const edgeSize = 30;
            const scrollSpeed = 15;
            let dx = 0;
            let dy = 0;

            if (clientX < rect.left + edgeSize) dx = -scrollSpeed;
            else if (clientX > rect.right - edgeSize) dx = scrollSpeed;

            if (clientY < rect.top + edgeSize) dy = -scrollSpeed;
            else if (clientY > rect.bottom - edgeSize) dy = scrollSpeed;

            if (dx !== 0 || dy !== 0) {
                startAutoScroll(dx, dy, eventUpdater);
            } else {
                stopAutoScroll();
            }
        };

        // 新規ノート入力用（ドラッグで長さ設定）
        let isCreatingNote = false;
        let creatingNote = null;
        let createStartStep = 0;

        // 2本指スクロール用
        let isTwoFingerPan = false;
        let lastTouchX = 0;
        let lastTouchY = 0;

        // --- PC: マウスホイールスクロール ---
        this.canvas.addEventListener('wheel', (e) => {
            if (App.currentScreen !== 'sound') return;
            e.preventDefault();
            const maxScrollY = 72 * this.cellSize - this.canvas.height;
            const speed = 0.3;
            const dx = (e.shiftKey ? e.deltaY : 0) * speed;
            const dy = (e.shiftKey ? 0 : e.deltaY) * speed;
            this.scrollX = Math.max(0, this.scrollX + dx);
            this.scrollY = Math.max(0, Math.min(maxScrollY, this.scrollY + dy));
            this.render();
        }, { passive: false });

        // --- PC: 中ボタンドラッグパン ---
        let isBgmMiddlePan = false;
        let bgmMidPanX = 0, bgmMidPanY = 0;
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                if (App.currentScreen !== 'sound') return;
                stopAutoScroll();
                this.lastPointerEvent = null;

                // ロングタップタイマー解除
                e.preventDefault();
                isBgmMiddlePan = true;
                bgmMidPanX = e.clientX;
                bgmMidPanY = e.clientY;
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (!isBgmMiddlePan) return;
            const maxScrollY = 72 * this.cellSize - this.canvas.height;
            const dx = bgmMidPanX - e.clientX;
            const dy = bgmMidPanY - e.clientY;
            bgmMidPanX = e.clientX;
            bgmMidPanY = e.clientY;
            this.scrollX = Math.max(0, this.scrollX + dx);
            this.scrollY = Math.max(0, Math.min(maxScrollY, this.scrollY + dy));
            this.render();
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 1) isBgmMiddlePan = false;
        });

        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches ? e.touches[0] : e;
            // CSSスケーリングを考慮: 表示サイズと内部解像度の比率で変換
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY
            };
        };

        const getPosFromEvent = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            if (e.changedTouches) {
                return {
                    x: (e.changedTouches[0].clientX - rect.left) * scaleX,
                    y: (e.changedTouches[0].clientY - rect.top) * scaleY
                };
            }
            return getPos(e);
        };

        const getStepPitch = (pos) => {
            const scrollY = this.scrollY || 0;
            const step = Math.floor((pos.x + this.scrollX) / this.cellSize);
            // C1-B5（pitch 0-59）の60音範囲（noteToPitchと一致）
            // scrollYで縦スクロール、上が高音（B5=59）、下が低音（C1=0）
            const maxPitch = 71; // B6
            const row = Math.floor((pos.y + scrollY) / this.cellSize);
            const pitch = Math.max(0, Math.min(71, maxPitch - row));
            return { step, pitch };
        };

        // 共通処理関数
        const processMove = (e) => {
            const pos = getPos(e);

            // startX, startY は initPianoRoll スコープの変数を使用
            const moved = Math.abs(pos.x - startX) > 5 || Math.abs(pos.y - startY) > 5;

            if (moved && !isLongPress && !isCreatingNote) {
                clearTimeout(longPressTimer);
            }
            if (moved) hasMoved = true;

            // 選択モード
            if (this.currentTool === 'select') {
                const { step, pitch } = getStepPitch(pos);

                if (this.isMovingSelection && this.selectionMoveStart) {
                    const deltaStep = step - this.selectionMoveStart.step;
                    const deltaPitch = pitch - this.selectionMoveStart.pitch;

                    // 選択枠を移動
                    if (this.selectionStart) {
                        this.selectionStart.step += deltaStep;
                        this.selectionStart.pitch += deltaPitch;
                    }
                    if (this.selectionEnd) {
                        this.selectionEnd.step += deltaStep;
                        this.selectionEnd.pitch += deltaPitch;
                    }

                    // 選択されていたノートのみを移動







                    this.movingNotes.forEach(note => {

                            note.step += deltaStep;
                            note.pitch += deltaPitch;

                    });

                    this.selectionMoveStart = { step, pitch };
                } else {
                    // 範囲変更
                    this.selectionEnd = { step, pitch };
                }
                this.render();
                return;
            }

            // ペーストモード
            if (this.currentTool === 'paste') {
                const { step, pitch } = getStepPitch(pos);
                if (this.pasteDragStart) {
                    const dStep = step - this.pasteDragStart.step;
                    const dPitch = pitch - this.pasteDragStart.pitch;
                    this.pasteOffset.step += dStep;
                    this.pasteOffset.pitch += dPitch;
                    this.pasteDragStart = { step, pitch };
                }
                this.render();
                return;
            }

            // 消しゴムモード (ストロークで削除)
            if (this.currentTool === 'eraser') {
                const { step, pitch } = getStepPitch(pos);
                const existingNote = this.findNoteAt(step, pitch);
                if (existingNote) {
                    const song = this.getCurrentSong();
                    const track = song.tracks[this.currentTrack];
                    const idx = track.notes.indexOf(existingNote);
                    if (idx >= 0) {
                        track.notes.splice(idx, 1);
                        this.render();
                    }
                }
                return;
            }

            // 長押しドラッグ中ならノート移動
            if (isLongPress && draggingNote) {
                const { step, pitch } = getStepPitch(pos);
                draggingNote.step = Math.max(0, step);
                draggingNote.pitch = pitch;
                this.render();
            }

            // 新規ノート作成中ならドラッグで長さ更新
            if (isCreatingNote && creatingNote) {
                const { step } = getStepPitch(pos);
                const length = Math.max(1, step - createStartStep + 1);
                creatingNote.length = length;
                this.render();
            }
        };

        // 2本指パン誤入力防止用
        let pendingInputTimer = null;
        let pendingInputData = null;

        // タッチスタート
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // 2本指パン開始 - 保留中の入力があればキャンセル
                if (pendingInputTimer) {
                    clearTimeout(pendingInputTimer);
                    pendingInputTimer = null;
                    pendingInputData = null;
                }
                // 作成中のノートがあれば削除
                if (isCreatingNote && creatingNote) {
                    const song = this.getCurrentSong();
                    const track = song.tracks[this.currentTrack];
                    const idx = track.notes.indexOf(creatingNote);
                    if (idx >= 0) {
                        track.notes.splice(idx, 1);
                        this.render();
                    }
                    isCreatingNote = false;
                    creatingNote = null;
                }
                isTwoFingerPan = true;
                lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                isDragging = false;
                e.preventDefault();
                return;
            }

            if (e.touches.length === 1) {
                e.preventDefault();
                const pos = getPos(e);
                const { step, pitch } = getStepPitch(pos);

                isDragging = true;
                hasMoved = false;
                startX = pos.x;
                startY = pos.y;

                // 選択モード
                if (this.currentTool === 'select') {
                    if (this.isStepInSelection(step, pitch)) {
                        this.isMovingSelection = true;
                        this.selectionMoveStart = { step, pitch };
                        
                        // 移動対象のノートを確定
                        const song = this.getCurrentSong();
                        const track = song.tracks[this.currentTrack];
                        const sStep = Math.min(this.selectionStart.step, this.selectionEnd.step);
                        const eStep = Math.max(this.selectionStart.step, this.selectionEnd.step);
                        const sPitch = Math.min(this.selectionStart.pitch, this.selectionEnd.pitch);
                        const ePitch = Math.max(this.selectionStart.pitch, this.selectionEnd.pitch);
                        this.movingNotes = track.notes.filter(n => 
                            n.step >= sStep && n.step <= eStep && n.pitch >= sPitch && n.pitch <= ePitch
                        );
                    } else {
                        this.isMovingSelection = false;
                        this.selectionStart = { step, pitch };
                        this.selectionEnd = { step, pitch };
                    }
                    this.render();
                    return;
                }

                // ペーストモード
                if (this.currentTool === 'paste') {
                    this.pasteDragStart = { step, pitch };
                    this.render();
                    return;
                }

                // 消しゴムモード：タッチした瞬間に削除
                if (this.currentTool === 'eraser') {
                    const note = this.findNoteAt(step, pitch);
                    if (note) {
                        const song = this.getCurrentSong();
                        const track = song.tracks[this.currentTrack];
                        const idx = track.notes.indexOf(note);
                        if (idx >= 0) {
                            track.notes.splice(idx, 1);
                            this.render();
                        }
                    }
                    return;
                }

                // ノートがあるかチェック
                const note = this.findNoteAt(step, pitch);

                if (note) {
                    // 長押し検出開始（既存ノートの移動用 兼 再生位置シーク用）
                    originalStep = note.step;
                    originalPitch = note.pitch;
                    longPressTimer = setTimeout(() => {
                        isLongPress = true;
                        draggingNote = note;
                        this.seekToStep(step);
                    }, 400);
                } else {
                    // 空セル: 遅延してノート作成（2本指パン誤入力防止）
                    pendingInputData = { step, pitch, pos };
                    pendingInputTimer = setTimeout(() => {
                        // 選択モード/ペーストモード中はノート作成しない
                        if (this.selectionMode || this.pasteMode) {
                            pendingInputTimer = null;
                            pendingInputData = null;
                            return;
                        }
                        if (pendingInputData && !isTwoFingerPan) {
                            const newNote = { step: pendingInputData.step, pitch: pendingInputData.pitch, length: 1 };
                            const song = this.getCurrentSong();
                            song.tracks[this.currentTrack].notes.push(newNote);
                            isCreatingNote = true;
                            creatingNote = newNote;
                            createStartStep = pendingInputData.step;
                            const { note: noteName, octave } = this.pitchToNote(pendingInputData.pitch);
                            this.playNote(noteName, octave);
                            this.render();

                            // 長押しでシークとみなしノート作成をキャンセル
                            longPressTimer = setTimeout(() => {
                                if (isCreatingNote && creatingNote && creatingNote.length === 1 && !hasMoved) {
                                    const track = song.tracks[this.currentTrack];
                                    const idx = track.notes.indexOf(creatingNote);
                                    if (idx >= 0) track.notes.splice(idx, 1);
                                    
                                    isCreatingNote = false;
                                    creatingNote = null;
                                    this.seekToStep(step);
                                }
                            }, 350);
                        }
                        pendingInputTimer = null;
                        pendingInputData = null;
                    }, 50);
                }
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            // 中ボタン（パン用）は描画に使わない
            if (e.button !== undefined && e.button !== 0) return;
            const pos = getPos(e);
            const { step, pitch } = getStepPitch(pos);

            isDragging = true;
            hasMoved = false;
            startX = pos.x;
            startY = pos.y;

            // 選択モード
            if (this.currentTool === 'select') {
                if (this.isStepInSelection(step, pitch)) {
                    this.isMovingSelection = true;
                    this.selectionMoveStart = { step, pitch };

                    // 移動対象のノートを確定
                    const song = this.getCurrentSong();
                    const track = song.tracks[this.currentTrack];
                    const sStep = Math.min(this.selectionStart.step, this.selectionEnd.step);
                    const eStep = Math.max(this.selectionStart.step, this.selectionEnd.step);
                    const sPitch = Math.min(this.selectionStart.pitch, this.selectionEnd.pitch);
                    const ePitch = Math.max(this.selectionStart.pitch, this.selectionEnd.pitch);
                    this.movingNotes = track.notes.filter(n => 
                        n.step >= sStep && n.step <= eStep && n.pitch >= sPitch && n.pitch <= ePitch
                    );
                } else {
                    this.isMovingSelection = false;
                    this.selectionStart = { step, pitch };
                    this.selectionEnd = { step, pitch };
                    this.isSelecting = true;
                }
                this.render();
                return;
            }

            // ペーストモード
            if (this.currentTool === 'paste') {
                this.pasteDragStart = { step, pitch };
                this.render();
                return;
            }

            // 消しゴムモード：クリックした瞬間に削除
            if (this.currentTool === 'eraser') {
                const note = this.findNoteAt(step, pitch);
                if (note) {
                    const song = this.getCurrentSong();
                    const track = song.tracks[this.currentTrack];
                    const idx = track.notes.indexOf(note);
                    if (idx >= 0) {
                        track.notes.splice(idx, 1);
                        this.render();
                    }
                }
                return;
            }

            // ノートがあるかチェック
            const note = this.findNoteAt(step, pitch);

            if (note) {
                // 長押し検出開始（既存ノートの移動用 兼 再生位置シーク用）
                originalStep = note.step;
                originalPitch = note.pitch;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    draggingNote = note;
                    this.seekToStep(step);
                }, 400);
            } else {
                // 空セル: 新規ノート作成（ドラッグで長さ設定）
                // 鉛筆ツール以外では作成しない
                if (this.currentTool !== 'pencil') return;

                const newNote = { step, pitch, length: 1 };
                const song = this.getCurrentSong();
                song.tracks[this.currentTrack].notes.push(newNote);
                isCreatingNote = true;
                creatingNote = newNote;
                createStartStep = step;
                const { note: noteName, octave } = this.pitchToNote(pitch);
                this.playNote(noteName, octave);
                this.render();

                // 長押しでシークとみなしノート作成をキャンセル
                longPressTimer = setTimeout(() => {
                    if (isCreatingNote && creatingNote && creatingNote.length === 1 && !hasMoved) {
                        const track = song.tracks[this.currentTrack];
                        const idx = track.notes.indexOf(creatingNote);
                        if (idx >= 0) track.notes.splice(idx, 1);
                        
                        isCreatingNote = false;
                        creatingNote = null;
                        this.seekToStep(step);
                    }
                }, 400);
            }
        });



        // タッチムーブ
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && isTwoFingerPan) {
                // 2本指パンスクロール
                const currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const deltaX = lastTouchX - currentX;
                const deltaY = lastTouchY - currentY;

                this.scrollX = Math.max(0, this.scrollX + deltaX);
                // 72音（pitch 0-71）× 20px = 1440px の縦スクロール範囲（6オクターブ）
                const maxScrollY = 72 * this.cellSize - this.canvas.height;
                this.scrollY = Math.max(0, Math.min(maxScrollY, this.scrollY + deltaY));

                lastTouchX = currentX;
                lastTouchY = currentY;
                this.render();
                e.preventDefault();
            } else if (isDragging && e.touches.length === 1) {
                e.preventDefault();
                this.lastPointerEvent = e;
                checkAutoScroll(e.touches[0].clientX, e.touches[0].clientY, (ev) => processMove(ev));
                processMove(e);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                this.lastPointerEvent = e;
                checkAutoScroll(e.clientX, e.clientY, (ev) => processMove(ev));
                processMove(e);
            }
        });

        // タッチエンド
        this.canvas.addEventListener('touchend', (e) => {
            // 2本指パン中に1本離れた場合は何もしない
            if (e.touches.length === 1 && isTwoFingerPan) {
                return;
            }

            if (e.touches.length === 0) {
                // 2本指パン中だった場合はフラグリセットのみ
                if (isTwoFingerPan) {
                    isTwoFingerPan = false;
                    isDragging = false;
                    return;
                }

                // 選択モード
                if (this.currentTool === 'select') {
                    // 移動なし（タップ）なら選択解除
                    if (!hasMoved && !this.isMovingSelection) {
                        this.selectionStart = null;
                        this.selectionEnd = null;
                        this.render();
                    }
                    this.isMovingSelection = false;
                    this.selectionMoveStart = null;
                    isDragging = false;
                    hasMoved = false;
                    return;
                }

                // ペーストモード：ペースト確定
                if (this.currentTool === 'paste') {
                    this.confirmPaste();
                    isDragging = false;
                    return;
                }

                // ノート作成中でない場合のみタップ処理（既存ノート削除）
                if (isDragging && !isLongPress && !isCreatingNote) {
                    if (pendingInputTimer) {
                        clearTimeout(pendingInputTimer);
                        pendingInputTimer = null;
                        if (pendingInputData && !isTwoFingerPan && !this.selectionMode && !this.pasteMode) {
                            const newNote = { step: pendingInputData.step, pitch: pendingInputData.pitch, length: 1 };
                            const song = this.getCurrentSong();
                            song.tracks[this.currentTrack].notes.push(newNote);
                            const { note: noteName, octave } = this.pitchToNote(pendingInputData.pitch);
                            this.playNote(noteName, octave);
                            this.render();
                        }
                        pendingInputData = null;
                    } else {
                        clearTimeout(longPressTimer);
                        const pos = getPosFromEvent(e);
                        const { step, pitch } = getStepPitch(pos);
                        // 既存ノートがあれば削除
                        const existingNote = this.findNoteAt(step, pitch);
                        if (existingNote) {
                            const song = this.getCurrentSong();
                            const track = song.tracks[this.currentTrack];
                            const idx = track.notes.indexOf(existingNote);
                            if (idx >= 0) {
                                track.notes.splice(idx, 1);
                                this.render();
                            }
                        }
                    }
                }

                isDragging = false;
                isLongPress = false;
                draggingNote = null;
                isCreatingNote = false;
                creatingNote = null;
                clearTimeout(longPressTimer);
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            // 選択モード
            if (this.currentTool === 'select') {
                // 移動なし（タップ）なら選択解除
                if (!hasMoved && !this.isMovingSelection) {
                    this.selectionStart = null;
                    this.selectionEnd = null;
                    this.render();
                }
                this.isSelecting = false;
                this.isMovingSelection = false;
                this.selectionMoveStart = null;
                isDragging = false;
                hasMoved = false;
                return;
            }

            // ペーストモード：ペースト確定
            if (this.currentTool === 'paste') {
                this.confirmPaste();
                isDragging = false;
                return;
            }

            // ノート作成中でない場合のみタップ処理（既存ノート削除）
            if (isDragging && !isLongPress && !isCreatingNote) {
                clearTimeout(longPressTimer);
                const pos = getPos(e);
                const { step, pitch } = getStepPitch(pos);
                // 既存ノートがあれば削除
                const existingNote = this.findNoteAt(step, pitch);
                if (existingNote) {
                    const song = this.getCurrentSong();
                    const track = song.tracks[this.currentTrack];
                    const idx = track.notes.indexOf(existingNote);
                    if (idx >= 0) {
                        track.notes.splice(idx, 1);
                        this.render();
                    }
                }
            }

            isDragging = false;
            isLongPress = false;
            draggingNote = null;
            isCreatingNote = false;
            creatingNote = null;
            clearTimeout(longPressTimer);
        });


    },

    // 範囲選択モード開始
    startSelectionMode() {
        this.selectionMode = true;
        this.pasteMode = false;

        // 既存の選択を維持するか、新規でクリアするか
        if (!this.selectionStart) {
            this.selectionStart = null;
            this.selectionEnd = null;
        }

        this.currentTool = 'select';
        document.querySelectorAll('#sound-controls .sound-ctrl-btn').forEach(b => {
            // sound-select-btn に active を付けたいが、HTML構造的にボタンIDを直接指定する
            if (b.id === 'sound-select-btn') b.classList.add('active');
            else b.classList.remove('active');
        });

        // sound-tool-btn クラスも考慮（もしあれば）
        document.querySelectorAll('.sound-tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === 'select');
        });

        this.render();
    },

    // 範囲コピー
    copySelection() {
        if (!this.selectionStart || !this.selectionEnd) {
            // alert('コピーする範囲を選択してください');
            return;
        }

        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];

        // 正規化
        const sStep = Math.min(this.selectionStart.step, this.selectionEnd.step);
        const eStep = Math.max(this.selectionStart.step, this.selectionEnd.step);
        const sPitch = Math.min(this.selectionStart.pitch, this.selectionEnd.pitch);
        const ePitch = Math.max(this.selectionStart.pitch, this.selectionEnd.pitch);

        // 範囲内のノートを収集
        const notes = track.notes.filter(n => {
            // ノートの一部でも範囲内に入っていればコピー対象とするか、開始位置が含まれるか
            // ここでは開始位置が含まれるものを対象
            return n.step >= sStep && n.step <= eStep && n.pitch >= sPitch && n.pitch <= ePitch;
        }).map(n => ({ ...n, step: n.step - sStep, pitch: n.pitch - sPitch })); // 相対位置

        this.rangeClipboard = {
            width: eStep - sStep + 1,
            height: ePitch - sPitch + 1,
            notes: notes
        };

        // コピー後、選択を解除する
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;

        // alert(`${notes.length} 個のノートをコピーしました`);
        this.render();
    },

    startPasteMode() {
        if (!this.rangeClipboard) {
            App.showAlert(this.t('U317'));
            return;
        }

        this.pasteMode = true;
        this.selectionMode = false;
        this.pasteDragStart = null;
        this.pasteData = JSON.parse(JSON.stringify(this.rangeClipboard));

        // 画面中央付近に配置（現在のスクロール位置基準）
        const scrollStep = Math.floor(this.scrollX / this.cellSize);
        // 音程はC4付近または画面中央
        // スクロールYは上端からのピクセル数。Pitch 71が一番上(y=0)
        // 画面上端のピッチ = 71 - Math.floor(scrollY / cellSize)
        const topPitch = 71 - Math.floor(this.scrollY / this.cellSize);
        // コピーした内容の高さ(Pitch幅)を考慮して少し下（Pitchは小さい方が下）にオフセット
        const pastePitchOffset = topPitch - 4 - Math.floor((this.pasteData.height || 1) / 2);

        this.pasteOffset = {
            step: Math.max(0, scrollStep + 2),
            pitch: Math.max(0, Math.min(71, pastePitchOffset))
        };

        this.currentTool = 'paste';
        document.querySelectorAll('#sound-controls .sound-ctrl-btn').forEach(b => {
            if (b.id === 'sound-paste-btn') b.classList.add('active');
            else b.classList.remove('active');
        });

        this.render();
    },

    confirmPaste() {
        if (!this.pasteData) return;

        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];

        // ペーストデータを現在のトラックに追加
        this.pasteData.notes.forEach(note => {
            const newStep = this.pasteOffset.step + note.step;
            const newPitch = this.pasteOffset.pitch + note.pitch; // ノートのピッチオフセットを加算

            // 範囲チェック
            if (newStep >= 0 && newStep < song.bars && newPitch >= 0 && newPitch <= 71) {
                // 重なるノートを削除するかどうかだが、PixelGameKitの仕様としては重ねてOKまたは上書き
                // 単音トラックなら上書きすべきだが、データ構造的には重複許容
                // ここでは既存の同じ位置・ピッチのノートがあれば削除して上書き
                const existingIdx = track.notes.findIndex(n => n.step === newStep && n.pitch === newPitch);
                if (existingIdx >= 0) {
                    track.notes.splice(existingIdx, 1);
                }
                track.notes.push({
                    step: newStep,
                    pitch: newPitch,
                    length: note.length
                });
            }
        });

        this.pasteMode = false;
        this.pasteData = null;

        // ツールを選択モードに戻す
        this.startSelectionMode();
    },

    // 選択範囲内判定
    isStepInSelection(step, pitch) {
        if (!this.selectionStart || !this.selectionEnd) return false;
        const sStep = Math.min(this.selectionStart.step, this.selectionEnd.step);
        const eStep = Math.max(this.selectionStart.step, this.selectionEnd.step);
        const sPitch = Math.min(this.selectionStart.pitch, this.selectionEnd.pitch);
        const ePitch = Math.max(this.selectionStart.pitch, this.selectionEnd.pitch);
        return step >= sStep && step <= eStep && pitch >= sPitch && pitch <= ePitch;
    },

    handleTap(step, pitch) {
        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];

        // 既存ノートがあれば削除、なければ追加
        const existingNote = this.findNoteAt(step, pitch);

        if (existingNote) {
            // 削除
            const idx = track.notes.indexOf(existingNote);
            if (idx >= 0) {
                track.notes.splice(idx, 1);
            }
        } else {
            // 追加
            const { note, octave } = this.pitchToNote(pitch);
            this.playNote(note, octave);
            track.notes.push({ step, pitch, length: 1 });
        }
        this.render();
    },

    findNoteAt(step, pitch) {
        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        return track.notes.find(n =>
            n.step <= step && n.step + n.length > step && n.pitch === pitch
        );
    },

    deleteNoteAt(step, pitch) {
        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        const idx = track.notes.findIndex(n =>
            n.step <= step && n.step + n.length > step && n.pitch === pitch
        );
        if (idx >= 0) {
            track.notes.splice(idx, 1);
            this.render();
        }
    },

    seekToStep(step) {
        const song = this.getCurrentSong();
        if (step >= 0 && step < song.bars) {
            const wasPlaying = this.isPlaying;
            if (wasPlaying) {
                this.pause(); 
                this.currentStep = step;
                this.play();  
            } else {
                this.currentStep = step;
                this.isPaused = true;
                this.render();
            }
        }
    },

    // ========== 再生 ==========
    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        this.updatePlayButton('play');

        const song = this.getCurrentSong();
        const stepDuration = 60 / song.bpm / 4; // 16分音符
        const startStep = this.isPaused ? this.currentStep : 0;
        let step = startStep;
        const maxSteps = song.bars;

        this.isPaused = false;
        this.playInterval = setInterval(() => {
            // 全トラック再生
            song.tracks.forEach((track, trackIdx) => {
                track.notes.forEach(note => {
                    if (note.step === step) {
                        const { note: noteName, octave } = this.pitchToNote(note.pitch);
                        // 同時発音数1に制限（トラックごと）
                        this.playNoteMonophonic(noteName, octave, stepDuration * note.length, trackIdx);
                    }
                });
            });

            this.currentStep = step;
            this.render();

            step++;
            if (step >= maxSteps) {
                step = 0;
            }
        }, stepDuration * 1000);
    },

    pause() {
        this.isPlaying = false;
        this.isPaused = true;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this.updatePlayButton('pause');
    },

    resume() {
        this.play();
    },

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentStep = 0;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this.updatePlayButton('stop');
        this.render();
    },

    updatePlayButton(state) {
        const playBtn = document.getElementById('sound-play-btn');
        if (!playBtn) return;

        const svg = playBtn.querySelector('svg');
        if (!svg) return;

        if (state === 'play') {
            // 停止アイコン（■）
            svg.innerHTML = '<rect x="6" y="6" width="12" height="12" />';
        } else {
            // 再生アイコン（▶）
            svg.innerHTML = '<path d="M8 5v14l11-7z" />';
        }
    },

    // ========== レンダリング ==========
    render() {
        if (!this.ctx) return;

        const song = this.getCurrentSong();
        const track = song.tracks[this.currentTrack];
        const maxSteps = song.bars;

        // 背景（ゲーム設定の背景色を使用）
        const bgColor = App.projectData?.stage?.bgColor || '#3CBCFC';
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 偶数拍（2拍、4拍）の背景を薄くする
        const beatWidth = 4 * this.cellSize; // 1拍 = 4ステップ
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        for (let bar = 0; bar < song.bars; bar++) {
            for (let beat = 0; beat < 4; beat++) {
                // 偶数拍（2拍目=beat1、4拍目=beat3）を暗くする
                if (beat === 1 || beat === 3) {
                    const x = (bar * 16 + beat * 4) * this.cellSize - this.scrollX;
                    if (x + beatWidth >= 0 && x <= this.canvas.width) {
                        this.ctx.fillRect(x, 0, beatWidth, this.canvas.height);
                    }
                }
            }
        }

        // グリッド（白色）
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 0.5;
        const scrollY = this.scrollY || 0;

        // 縦線
        for (let i = 0; i <= Math.ceil(this.canvas.width / this.cellSize) + 1; i++) {
            this.ctx.beginPath();
            const x = i * this.cellSize - this.scrollX % this.cellSize;
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // 横線（scrollYを適用）
        for (let i = 0; i <= Math.ceil(this.canvas.height / this.cellSize) + 1; i++) {
            this.ctx.beginPath();
            const y = i * this.cellSize - scrollY % this.cellSize;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // オクターブ区切り（Cの音、白1px）
        const maxPitch = 71; // C1-B6 (6オクターブ)
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        for (let octave = 1; octave <= 6; octave++) {
            const cPitch = (octave - 1) * 12; // C1=0, C2=12, C3=24, etc.
            const y = (maxPitch - cPitch + 1) * this.cellSize - scrollY;
            if (y >= 0 && y <= this.canvas.height) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            }
        }

        // 小節区切り（白1px）
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        const barWidth = 16 * this.cellSize;
        for (let bar = 0; bar <= song.bars; bar++) {
            const x = bar * barWidth - this.scrollX;
            if (x >= 0 && x <= this.canvas.width) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
            }
        }

        // 指定小節数外の範囲をグレーアウト
        const maxX = maxSteps * this.cellSize - this.scrollX;
        if (maxX < this.canvas.width) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(maxX, 0, this.canvas.width - maxX, this.canvas.height);
        }

        // ハイライト行
        // maxPitchは既に宣言済み
        if (this.highlightPitch >= 0 && this.highlightPitch <= 71) {
            const y = (maxPitch - this.highlightPitch) * this.cellSize - scrollY;
            if (y + this.cellSize >= 0 && y < this.canvas.height) {
                this.ctx.fillStyle = 'rgba(74, 124, 89, 0.3)';
                this.ctx.fillRect(0, y, this.canvas.width, this.cellSize);
            }
        }

        // ノート描画（白色）
        this.ctx.fillStyle = '#fff';

        track.notes.forEach(note => {
            const x = note.step * this.cellSize - this.scrollX;
            const y = (maxPitch - note.pitch) * this.cellSize - scrollY;
            const w = note.length * this.cellSize - 2;

            if (x + w >= 0 && x <= this.canvas.width && y + this.cellSize >= 0 && y < this.canvas.height) {
                this.ctx.fillRect(x + 1, y + 1, w, this.cellSize - 2);
            }
        });

        // 選択範囲の描画
        // 選択範囲の描画
        if (this.selectionMode && this.selectionStart && this.selectionEnd) {
            const step1 = Math.min(this.selectionStart.step, this.selectionEnd.step);
            const step2 = Math.max(this.selectionStart.step, this.selectionEnd.step);
            const pitch1 = Math.min(this.selectionStart.pitch, this.selectionEnd.pitch);
            const pitch2 = Math.max(this.selectionStart.pitch, this.selectionEnd.pitch);

            const x = step1 * this.cellSize - this.scrollX;
            const y = (maxPitch - pitch2) * this.cellSize - scrollY;
            const w = (step2 - step1 + 1) * this.cellSize;
            const h = (pitch2 - pitch1 + 1) * this.cellSize;

            this.ctx.setLineDash([4, 4]); // 点線
            this.ctx.strokeStyle = this.isSelecting ? '#ffffff' : '#90EE90';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, w, h);
            this.ctx.fillStyle = 'rgba(144, 238, 144, 0.2)'; // Semi-transparent LightGreen
            this.ctx.fillRect(x, y, w, h);
            this.ctx.setLineDash([]);
        }

        // ペーストプレビューの描画
        if (this.pasteMode && this.pasteData) {
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
            this.pasteData.notes.forEach(note => {
                const newStep = this.pasteOffset.step + note.step;
                const newPitch = this.pasteOffset.pitch + note.pitch;
                const x = newStep * this.cellSize - this.scrollX;
                const y = (maxPitch - newPitch) * this.cellSize - scrollY;
                const w = note.length * this.cellSize - 2;

                if (x + w >= 0 && x <= this.canvas.width && y + this.cellSize >= 0 && y < this.canvas.height) {
                    this.ctx.fillRect(x + 1, y + 1, w, this.cellSize - 2);
                }
            });

            // ペースト枠も表示
            if (this.pasteData.width && this.pasteData.height) {
                const width = this.pasteData.width;
                const height = this.pasteData.height;

                const x = this.pasteOffset.step * this.cellSize - this.scrollX;
                const y = (maxPitch - (this.pasteOffset.pitch + height - 1)) * this.cellSize - scrollY;
                const w = width * this.cellSize;
                const h = height * this.cellSize;

                this.ctx.setLineDash([4, 4]);
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(x, y, w, h);
                this.ctx.setLineDash([]);
            }
        }

        // 現在位置
        const x = this.currentStep * this.cellSize - this.scrollX;
        let strokeColor = '#00FF00'; // 再生時
        if (this.isStepRecording) strokeColor = '#FF0000';
        else if (!this.isPlaying) strokeColor = 'rgba(0, 255, 0, 0.5)'; // 停止中/一時停止中

        if (x >= 0 && x <= this.canvas.width) {
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
    },

    // ========== 数値コピー＆ペースト ポップアップ ==========

    _numcopyTracks: [],       // 選択中のトラックインデックス
    _numcopyDragCleanup: [],  // ドラッグイベント解除用

    openNumCopyPopup() {
        const popup = document.getElementById('numcopy-popup');
        if (!popup) return;

        const song = this.getCurrentSong();

        // デフォルト値設定
        this._numcopyTracks = [this.currentTrack];
        document.getElementById('numcopy-from').textContent = '0';
        document.getElementById('numcopy-to').textContent = String(song.bars - 1);
        document.getElementById('numcopy-paste-at').textContent = String(song.bars);

        // トラックボタン状態リセット
        document.querySelectorAll('.numcopy-track-btn').forEach(btn => {
            const trackIdx = btn.dataset.track;
            if (trackIdx !== undefined) {
                btn.classList.toggle('active', parseInt(trackIdx) === this.currentTrack);
            } else {
                // ALLボタン
                btn.classList.remove('active');
            }
        });

        // 再生中なら一時停止
        if (this.isPlaying) {
            this._wasPlayingBeforeNumcopy = true;
            this.pause();
        } else {
            this._wasPlayingBeforeNumcopy = false;
        }

        popup.classList.remove('hidden');

        // イベントバインド
        this._initNumCopyEvents();
    },

    closeNumCopyPopup() {
        const popup = document.getElementById('numcopy-popup');
        if (popup) popup.classList.add('hidden');

        // ドラッグイベント解除
        this._numcopyDragCleanup.forEach(fn => fn());
        this._numcopyDragCleanup = [];
    },

    _initNumCopyEvents() {
        // ドラッグイベント解除用リスト初期化
        this._numcopyDragCleanup.forEach(fn => fn());
        this._numcopyDragCleanup = [];

        // トラックボタン
        document.querySelectorAll('.numcopy-track-btn[data-track]').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.track);
                btn.classList.toggle('active');
                // _numcopyTracks 再構築
                this._numcopyTracks = [];
                document.querySelectorAll('.numcopy-track-btn[data-track].active').forEach(b => {
                    this._numcopyTracks.push(parseInt(b.dataset.track));
                });
                // ALLボタン状態同期
                const allBtn = document.getElementById('numcopy-all-btn');
                if (allBtn) allBtn.classList.toggle('active', this._numcopyTracks.length === 4);
            };
        });

        // ALLボタン
        const allBtn = document.getElementById('numcopy-all-btn');
        if (allBtn) {
            allBtn.onclick = () => {
                const isAllActive = this._numcopyTracks.length === 4;
                document.querySelectorAll('.numcopy-track-btn[data-track]').forEach(btn => {
                    btn.classList.toggle('active', !isAllActive);
                });
                this._numcopyTracks = isAllActive ? [] : [0, 1, 2, 3];
                allBtn.classList.toggle('active', !isAllActive);
            };
        }

        // ドラッグ数値操作（3つの要素に適用）
        const song = this.getCurrentSong();
        this._setupNumCopyDrag('numcopy-from', 0, 255);
        this._setupNumCopyDrag('numcopy-to', 0, 255);
        this._setupNumCopyDrag('numcopy-paste-at', 0, 255);

        // 実行ボタン
        document.getElementById('numcopy-exec').onclick = () => this.execNumCopy();

        // キャンセルボタン
        document.getElementById('numcopy-cancel').onclick = () => this.closeNumCopyPopup();
    },

    // ドラッグ数値操作のセットアップ（BPM/BARと同じパターン）
    _setupNumCopyDrag(elementId, min, max) {
        const el = document.getElementById(elementId);
        if (!el) return;

        let isDragging = false;
        let startY = 0;
        let startValue = 0;
        let hasDragged = false;

        const onStart = (e) => {
            isDragging = true;
            hasDragged = false;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startY = clientY;
            startValue = parseInt(el.textContent) || 0;
            e.preventDefault();
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const delta = Math.round((startY - clientY) / 8);
            if (Math.abs(delta) > 0) {
                hasDragged = true;
                const newVal = Math.max(min, Math.min(max, startValue + delta));
                el.textContent = String(newVal);
            }
        };

        const onEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;

            if (!hasDragged) {
                // タップ → 直接入力
                const current = parseInt(el.textContent) || 0;
                const input = prompt('値を入力', current);
                if (input !== null) {
                    const val = parseInt(input);
                    if (!isNaN(val)) {
                        el.textContent = String(Math.max(min, Math.min(max, val)));
                    }
                }
            }
        };

        el.addEventListener('mousedown', onStart);
        el.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);

        // クリーンアップ関数を登録
        this._numcopyDragCleanup.push(() => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchend', onEnd);
        });
    },

    // 数値指定コピー＆ペースト実行
    execNumCopy() {
        const song = this.getCurrentSong();
        const tracks = this._numcopyTracks;

        if (tracks.length === 0) {
            App.showAlert(this.t('U322'));
            return;
        }

        const fromStep = parseInt(document.getElementById('numcopy-from').textContent) || 0;
        const toStep = parseInt(document.getElementById('numcopy-to').textContent) || 0;
        const pasteAt = parseInt(document.getElementById('numcopy-paste-at').textContent) || 0;

        if (fromStep > toStep) {
            App.showAlert(this.t('U331'));
            return;
        }

        const copyLength = toStep - fromStep + 1;
        let maxPastedStep = 0;

        tracks.forEach(trackIdx => {
            const track = song.tracks[trackIdx];
            if (!track) return;

            // コピー範囲のノートを収集（相対位置で保存）
            const copiedNotes = track.notes
                .filter(n => n.step >= fromStep && n.step <= toStep)
                .map(n => ({ ...n, step: n.step - fromStep }));

            // ペースト先の範囲内の既存ノートを削除（上書き）
            const pasteEnd = pasteAt + copyLength - 1;
            track.notes = track.notes.filter(n => n.step < pasteAt || n.step > pasteEnd);

            // ペースト
            copiedNotes.forEach(note => {
                const newStep = pasteAt + note.step;
                track.notes.push({ ...note, step: newStep });
                // ノートの終了位置を考慮
                const noteEnd = newStep + (note.length || 1);
                if (noteEnd > maxPastedStep) maxPastedStep = noteEnd;
            });
        });

        // STEP数(bars)を超える場合は自動拡張
        if (maxPastedStep > song.bars) {
            song.bars = maxPastedStep;
            this.updateConsoleDisplay();
        }

        this.closeNumCopyPopup();
        this.render();
    }
};
