/**
 * PixelGameKit - ファミコン風オーディオエンジン
 * テンプレート化版（3種類のジェネレータで SE を統一管理）
 */

const NesAudio = {
    ctx: null,
    masterGain: null,

    // 音階周波数テーブル
    noteFrequencies: {
        'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
        'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
        'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
    },

    init() {
        // AudioContextは初回ユーザー操作後に初期化
        // iOS向け: バックグラウンド復帰時にAudioContextを自動再開する
        this._setupIOSAudioRecovery();
    },

    /**
     * iOS/Safari向けオーディオ自動復旧ハンドラ
     * 通話・バックグラウンド移行でAudioContextがsuspendedになる問題に対処
     */
    _setupIOSAudioRecovery() {
        if (this._iosRecoverySetup) return;
        this._iosRecoverySetup = true;

        const resume = () => {
            // SE用AudioContext
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            // BGM用AudioContext (GameEngineが持つ)
            if (window.GameEngine && GameEngine.gameBgmPlayer?.audioCtx?.state === 'suspended') {
                GameEngine.gameBgmPlayer.audioCtx.resume().catch(() => {});
            }
            // BGMエディタのAudioContext
            if (window.SoundEditor && SoundEditor.player?.audioCtx?.state === 'suspended') {
                SoundEditor.player.audioCtx.resume().catch(() => {});
            }
        };

        // ページが前面に戻った時
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) resume();
        });

        // iOS Safari向け: ページ表示時（bfcache復帰含む）
        window.addEventListener('pageshow', (e) => {
            if (e.persisted || !document.hidden) resume();
        });

        // ユーザータッチで確実に復旧（iOSはユーザー操作が必要な場合がある）
        document.addEventListener('touchstart', resume, { passive: true, capture: true });
        document.addEventListener('pointerdown', resume, { passive: true, capture: true });
    },

    ensureContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    },

    getFrequency(note, octave) {
        const baseFreq = this.noteFrequencies[note];
        if (!baseFreq) return 440;

        // オクターブ4を基準に計算
        const octaveDiff = octave - 4;
        return baseFreq * Math.pow(2, octaveDiff);
    },

    // 波形キャッシュ
    waveCache: {},

    playNote(trackType, note, octave, duration, tone = 0) {
        this.ensureContext();

        const freq = this.getFrequency(note, octave);

        switch (trackType) {
            case 'pulse1':
            case 'pulse2':
                this.playPulse(freq, duration, tone);
                break;
            case 'triangle':
                this.playTriangle(freq, duration, tone);
                break;
            case 'noise':
                this.playNoise(duration, tone);
                break;
        }
    },

    // 矩形波 (tone: 0=Square50%, 1=Square25%, 2=Square12.5%)
    playPulse(freq, duration, tone) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Duty比の決定
        let duty = 0.5;
        if (tone === 1) duty = 0.25;
        if (tone === 2) duty = 0.125;

        if (duty === 0.5) {
            osc.type = 'square';
        } else {
            // PeriodicWaveでDuty比の異なる矩形波を生成
            const cacheKey = `pulse_${duty}`;
            if (!this.waveCache[cacheKey]) {
                const n = 4096;
                const real = new Float32Array(n);
                const imag = new Float32Array(n);
                for (let i = 1; i < n; i++) {
                    imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
                }
                this.waveCache[cacheKey] = this.ctx.createPeriodicWave(real, imag);
            }
            osc.setPeriodicWave(this.waveCache[cacheKey]);
        }

        osc.frequency.value = freq;

        // Base volume unified to 0.2
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    // 三角波 (tone: 0=Triangle, 1=Sine, 2=Sawtooth)
    playTriangle(freq, duration, tone) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        if (tone === 1) {
            osc.type = 'sine'; // 丸い音
        } else if (tone === 2) {
            osc.type = 'sawtooth'; // 拡張音源風
            gain.gain.value = 0.2;
        } else {
            osc.type = 'triangle'; // 標準
        }

        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    // ノイズ (tone: 0=White/Drum, 1=Short/Staccato, 2=Kick(Low), 3=Snare(タン))
    playNoise(duration, tone) {
        let bufferSize;

        if (tone === 1) {
            bufferSize = 128;
        } else if (tone === 3) {
            // スネア: ノート長かかわらず小さく固定
            bufferSize = Math.floor(this.ctx.sampleRate * 0.1);
        } else {
            bufferSize = this.ctx.sampleRate * duration;
        }

        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // ノイズ生成
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        if (tone === 1) {
            source.loop = true;
            source.loopEnd = buffer.duration;
        }

        const gain = this.ctx.createGain();

        // フィルタ（Kick・ Snare用）
        let filter = null;
        if (tone === 2) {
            // Kick: ローパスでボコボコ
            filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 200;
            filter.Q.value = 1;
            source.connect(filter);
            filter.connect(gain);
        } else if (tone === 3) {
            // Snare: バンドパスでタンっと短い
            filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1500;
            filter.Q.value = 0.5;
            source.connect(filter);
            filter.connect(gain);
        } else {
            source.connect(gain);
        }

        // ボリューム設定
        const volume = (tone === 2) ? 0.8 : (tone === 3) ? 0.5 : 0.2;
        const stopTime = (tone === 3) ? 0.1 : duration;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + stopTime);

        gain.connect(this.masterGain);

        source.start();
        source.stop(this.ctx.currentTime + stopTime);
    },

    // ========== SE再生 ==========
    playSE(seType) {
        this.ensureContext();

        // 動的にメソッドを呼び出し
        const methodName = 'playSE_' + seType;
        if (typeof this[methodName] === 'function') {
            this[methodName]();
        } else {
            console.warn('Unknown SE type:', seType);
        }
    },

    // ========== 3つのジェネレータ関数 ==========

    /**
     * 周波数スイープ型SE（ジャンプ、攻撃、ダメージ等）
     */
    playFreqSweep(config) {
        this.ensureContext();
        const {
            startFreq,
            endFreq,
            duration = 0.1,
            waveType = 'square',
            duty = null,
            startGain = 0.2,
            envelopeType = 'exponential',
            numSegments = null
        } = config;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        if (duty && waveType === 'square') {
            const cacheKey = `pulse_${duty}`;
            if (!this.waveCache[cacheKey]) {
                const n = 4096;
                const real = new Float32Array(n);
                const imag = new Float32Array(n);
                for (let i = 1; i < n; i++) {
                    imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
                }
                this.waveCache[cacheKey] = this.ctx.createPeriodicWave(real, imag);
            }
            osc.setPeriodicWave(this.waveCache[cacheKey]);
        } else {
            osc.type = waveType;
        }

        osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);

        if (numSegments) {
            let currentTime = this.ctx.currentTime;
            numSegments.forEach(segment => {
                if (envelopeType === 'exponential') {
                    osc.frequency.exponentialRampToValueAtTime(segment.freq, currentTime + segment.time);
                } else {
                    osc.frequency.linearRampToValueAtTime(segment.freq, currentTime + segment.time);
                }
                currentTime += segment.time;
            });
        } else {
            if (envelopeType === 'exponential') {
                osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
            } else {
                osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
            }
        }

        const t = this.ctx.currentTime;
        const step = duration / 4;
        gain.gain.setValueAtTime(startGain, t);
        gain.gain.setValueAtTime(startGain * 0.6, t + step);
        gain.gain.setValueAtTime(startGain * 0.25, t + step * 2);
        gain.gain.setValueAtTime(0.001, t + step * 3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    /**
     * マルチノート型SE（アイテムゲット時のメロディ）
     */
    playMultiNote(config) {
        this.ensureContext();
        const {
            notes,
            waveType = 'square',
            duty = null,
            gain = 0.2
        } = config;

        let currentTime = this.ctx.currentTime;

        notes.forEach((note) => {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            if (duty && waveType === 'square') {
                const cacheKey = `pulse_${duty}`;
                if (!this.waveCache[cacheKey]) {
                    const n = 4096;
                    const real = new Float32Array(n);
                    const imag = new Float32Array(n);
                    for (let i = 1; i < n; i++) {
                        imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
                    }
                    this.waveCache[cacheKey] = this.ctx.createPeriodicWave(real, imag);
                }
                osc.setPeriodicWave(this.waveCache[cacheKey]);
            } else {
                osc.type = waveType;
            }

            osc.frequency.value = note.freq;

            const startTime = currentTime;
            const duration = note.duration;
            currentTime += duration + (note.spacing || 0);

            const step = duration / 4;
            gainNode.gain.setValueAtTime(gain, startTime);
            gainNode.gain.setValueAtTime(gain * 0.6, startTime + step);
            gainNode.gain.setValueAtTime(gain * 0.25, startTime + step * 2);
            gainNode.gain.setValueAtTime(0.001, startTime + step * 3);

            osc.connect(gainNode);
            gainNode.connect(this.masterGain);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    },

    /**
     * ノイズ型SE（打撃・爆発等）
     */
    playNoiseSE(config) {
        this.ensureContext();
        const { duration = 0.1, startGain = 0.2 } = config;

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.ctx.createGain();
        const t = this.ctx.currentTime;
        const step = duration / 4;
        gainNode.gain.setValueAtTime(startGain, t);
        gainNode.gain.setValueAtTime(startGain * 0.6, t + step);
        gainNode.gain.setValueAtTime(startGain * 0.25, t + step * 2);
        gainNode.gain.setValueAtTime(0.001, t + step * 3);

        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        source.start();
        source.stop(this.ctx.currentTime + duration);
    },

    // ========== ジャンプ系 ==========
    playSE_jump_01() { this.playFreqSweep({ startFreq: 200, endFreq: 600, duration: 0.1, waveType: 'square' }); },
    playSE_jump_02() { this.playFreqSweep({ startFreq: 300, endFreq: 900, duration: 0.08, waveType: 'square' }); },
    playSE_jump_03() { this.playFreqSweep({ startFreq: 250, endFreq: 500, duration: 0.1, waveType: 'square', duty: 0.25 }); },
    playSE_jump_04() { this.playFreqSweep({ startFreq: 150, duration: 0.1, waveType: 'square', numSegments: [{ freq: 800, time: 0.04 }, { freq: 400, time: 0.06 }] }); },
    playSE_jump_05() { this.playFreqSweep({ startFreq: 400, endFreq: 1000, duration: 0.1, waveType: 'square', startGain: 0.15 }); },

    // ========== 攻撃系 ==========
    playSE_attack_01() { this.playFreqSweep({ startFreq: 400, endFreq: 100, duration: 0.06, waveType: 'square', duty: 0.25 }); },
    playSE_attack_02() { this.playFreqSweep({ startFreq: 800, endFreq: 200, duration: 0.06, waveType: 'square', duty: 0.125 }); },
    playSE_attack_03() { this.playNoiseSE({ duration: 0.05, startGain: 0.3 }); },
    playSE_attack_04() { this.playFreqSweep({ startFreq: 600, endFreq: 150, duration: 0.06, waveType: 'square' }); },
    playSE_attack_05() { this.playFreqSweep({ startFreq: 1200, endFreq: 400, duration: 0.08, waveType: 'square', duty: 0.25 }); },

    // ========== ダメージ系 ==========
    playSE_damage_01() { this.playFreqSweep({ startFreq: 400, endFreq: 100, duration: 0.15, waveType: 'square' }); },
    playSE_damage_02() { this.playFreqSweep({ startFreq: 300, endFreq: 80, duration: 0.1, waveType: 'square' }); },
    playSE_damage_03() { this.playFreqSweep({ startFreq: 200, endFreq: 50, duration: 0.15, waveType: 'square' }); },
    playSE_damage_04() { this.playNoiseSE({ duration: 0.1, startGain: 0.2 }); },
    playSE_damage_05() { this.playFreqSweep({ startFreq: 500, endFreq: 60, duration: 0.12, waveType: 'square', duty: 0.25 }); },

    // ========== アイテムゲット系 ==========
    playSE_itemGet_01() { this.playMultiNote({ waveType: 'square', notes: [{ freq: 523, duration: 0.05 }, { freq: 784, duration: 0.07 }] }); },
    playSE_itemGet_02() { this.playFreqSweep({ startFreq: 988, endFreq: 1319, duration: 0.08, waveType: 'square', startGain: 0.15 }); },
    playSE_itemGet_03() { this.playMultiNote({ waveType: 'square', notes: [{ freq: 392, duration: 0.05 }, { freq: 523, duration: 0.07 }] }); },
    playSE_itemGet_04() { this.playMultiNote({ waveType: 'square', duty: 0.25, notes: [{ freq: 523, duration: 0.05 }, { freq: 659, duration: 0.07 }] }); },
    playSE_itemGet_05() { this.playFreqSweep({ startFreq: 440, endFreq: 660, duration: 0.08, waveType: 'square' }); },

    // ========== その他系 ==========
    playSE_other_01() { this.playFreqSweep({ startFreq: 440, endFreq: 880, duration: 0.05, waveType: 'square', startGain: 0.15 }); },
    playSE_other_02() { this.playFreqSweep({ startFreq: 440, endFreq: 220, duration: 0.05, waveType: 'square', startGain: 0.15 }); },
    playSE_other_03() { this.playFreqSweep({ startFreq: 660, endFreq: 660, duration: 0.03, waveType: 'square', startGain: 0.1 }); },
    playSE_other_04() { this.playFreqSweep({ startFreq: 330, endFreq: 330, duration: 0.05, waveType: 'square' }); },
    playSE_other_05() { this.playNoiseSE({ duration: 0.15, startGain: 0.4 }); },

    // 旧SE互換用エイリアス
    playSE_jump() { this.playSE_jump_01(); },
    playSE_attack() { this.playSE_attack_01(); },
    playSE_damage() { this.playSE_damage_01(); },
    playSE_itemGet() { this.playSE_itemGet_01(); },

    // SE: 爆発音 - FC風
    playSE_explosion() {
        this.ensureContext();
        const t = this.ctx.currentTime;
        const dur = 0.3;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + dur);
        const step = dur / 4;
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.setValueAtTime(0.17, t + step);
        gain.gain.setValueAtTime(0.07, t + step * 2);
        gain.gain.setValueAtTime(0.001, t + step * 3);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + dur);
        // アタック: 短いノイズ（フィルタなし）
        const noiseDur = 0.04;
        const noiseSize = Math.floor(this.ctx.sampleRate * noiseDur);
        const noiseBuf = this.ctx.createBuffer(1, noiseSize, this.ctx.sampleRate);
        const noiseData = noiseBuf.getChannelData(0);
        for (let i = 0; i < noiseSize; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseSize);
        }
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuf;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.2, t);
        noiseGain.gain.setValueAtTime(0.05, t + 0.02);
        noiseGain.gain.setValueAtTime(0.001, t + noiseDur);
        noiseSrc.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noiseSrc.start(t);
        noiseSrc.stop(t + noiseDur);
    },

    // SE: 敵を倒す（短い「ポン」音）- v2.0.1オリジナル
    playSE_enemyDefeat() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
};

// グローバル公開と互換性確保
window.NesAudio = NesAudio;
window.AudioManager = NesAudio;
