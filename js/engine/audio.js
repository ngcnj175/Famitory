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
     * リピートスイープ型SE（PowerUp/コイン取得等、階段状に上昇する音）
     * segmentDuration の周波数スイープを repeatCount 回リトリガー
     */
    playRepeatingSweep(config) {
        this.ensureContext();
        const {
            startFreq,
            endFreq,
            segmentDuration = 0.08,
            repeatCount = 6,
            waveType = 'square',
            duty = null,
            startGain = 0.2,
            envelopeType = 'exponential'
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

        const t0 = this.ctx.currentTime;
        const step = segmentDuration / 4;
        for (let i = 0; i < repeatCount; i++) {
            const segStart = t0 + segmentDuration * i;
            osc.frequency.setValueAtTime(startFreq, segStart);
            if (envelopeType === 'exponential') {
                osc.frequency.exponentialRampToValueAtTime(endFreq, segStart + segmentDuration);
            } else {
                osc.frequency.linearRampToValueAtTime(endFreq, segStart + segmentDuration);
            }
            gain.gain.setValueAtTime(startGain, segStart);
            gain.gain.setValueAtTime(startGain * 0.6, segStart + step);
            gain.gain.setValueAtTime(startGain * 0.25, segStart + step * 2);
            gain.gain.setValueAtTime(0.001, segStart + step * 3);
        }

        const totalDur = segmentDuration * repeatCount;
        const tail = 0.02;
        gain.gain.linearRampToValueAtTime(0, t0 + totalDur + tail);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t0);
        osc.stop(t0 + totalDur + tail);
    },

    /**
     * ノイズ型SE（打撃・爆発等）
     * filterFreq > 0 のとき LPF を適用（Boom系に有効）
     *   sustainPunch : 発音直後のゲイン跳ね上がり倍率（0=なし）
     *   filterFreq   : LPF初期カットオフ Hz（0=フィルタなし）
     *   filterSweep  : duration 全体でのカットオフ変化量 Hz（負=下降）
     *   pitchJump    : 発音直後だけカットオフを +Hz 跳ね上げ（0=なし）
     */
    playNoiseSE(config) {
        this.ensureContext();
        const {
            duration = 0.1,
            startGain = 0.2,
            sustainPunch = 0,
            filterFreq = 0,
            filterSweep = 0,
            pitchJump = 0
        } = config;

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
        const peakGain = sustainPunch > 0 ? startGain * (1 + sustainPunch) : startGain;
        gainNode.gain.setValueAtTime(peakGain, t);
        gainNode.gain.setValueAtTime(startGain * 0.6, t + step);
        gainNode.gain.setValueAtTime(startGain * 0.25, t + step * 2);
        gainNode.gain.setValueAtTime(0.001, t + step * 3);

        if (filterFreq > 0) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(filterFreq + pitchJump, t);
            if (pitchJump > 0) {
                filter.frequency.linearRampToValueAtTime(filterFreq, t + 0.02);
            }
            filter.frequency.linearRampToValueAtTime(
                Math.max(20, filterFreq + filterSweep), t + duration
            );
            source.connect(filter);
            filter.connect(gainNode);
        } else {
            source.connect(gainNode);
        }

        gainNode.connect(this.masterGain);

        source.start();
        source.stop(this.ctx.currentTime + duration);
    },

    // ==================================================
    // Unified Synth Engine (統合シンセ, Bfxr風)
    //   波形: square/sine/triangle/sawtooth/noise
    //   ADSR + ピッチスライド + vibrato + harmonics + HPF/LPF
    //   既存の playFreqSweep/playMultiNote/playNoiseSE は変更なし
    // ==================================================
    playUnifiedSE(config) {
        this.ensureContext();
        const {
            waveType = 'square', duty = null,
            attackTime = 0, sustainTime = 0.1, sustainPunch = 0, decayTime = 0.1,
            masterVolume = 0.2,
            frequencyStart = 440, frequencySlide = 0, slideType = 'exponential',
            vibratoDepth = 0, vibratoSpeed = 0,
            harmonics = 0, harmonicsFalloff = 0.5,
            hpfFreq = 0, hpfSweep = 0,
            lpfFreq = 0, lpfSweep = 0, lpfResonance = 1
        } = config;
        const totalDur = Math.max(0.01, attackTime + sustainTime + decayTime);
        const t0 = this.ctx.currentTime;
        const isNoise = waveType === 'noise';
        const sources = [];
        if (isNoise) {
            const bufSize = Math.max(1, Math.floor(this.ctx.sampleRate * totalDur));
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            sources.push({ outNode: src, toStart: src, freqParam: null });
        } else {
            const oscCount = 1 + Math.max(0, Math.min(4, Math.floor(harmonics)));
            for (let i = 0; i < oscCount; i++) {
                const osc = this.ctx.createOscillator();
                if (duty && waveType === 'square') {
                    const key = `pulse_${duty}`;
                    if (!this.waveCache[key]) {
                        const n = 4096;
                        const real = new Float32Array(n);
                        const imag = new Float32Array(n);
                        for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
                        this.waveCache[key] = this.ctx.createPeriodicWave(real, imag);
                    }
                    osc.setPeriodicWave(this.waveCache[key]);
                } else {
                    osc.type = waveType;
                }
                const mult = i + 1;
                const startF = Math.max(20, frequencyStart * mult);
                const endF = Math.max(20, (frequencyStart + frequencySlide) * mult);
                osc.frequency.setValueAtTime(startF, t0);
                if (frequencySlide !== 0) {
                    if (slideType === 'exponential') osc.frequency.exponentialRampToValueAtTime(endF, t0 + totalDur);
                    else osc.frequency.linearRampToValueAtTime(endF, t0 + totalDur);
                }
                const harmGain = this.ctx.createGain();
                harmGain.gain.value = i === 0 ? 1 : Math.pow(harmonicsFalloff, i);
                osc.connect(harmGain);
                sources.push({ outNode: harmGain, toStart: osc, freqParam: osc.frequency });
            }
        }
        let lfo = null;
        if (!isNoise && vibratoDepth > 0 && vibratoSpeed > 0) {
            lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.frequency.value = vibratoSpeed;
            lfoGain.gain.value = vibratoDepth;
            lfo.connect(lfoGain);
            sources.forEach(s => { if (s.freqParam) lfoGain.connect(s.freqParam); });
        }
        const mixer = this.ctx.createGain();
        sources.forEach(s => s.outNode.connect(mixer));
        let chain = mixer;
        if (hpfFreq > 0) {
            const hpf = this.ctx.createBiquadFilter();
            hpf.type = 'highpass';
            hpf.frequency.setValueAtTime(hpfFreq, t0);
            if (hpfSweep !== 0) hpf.frequency.linearRampToValueAtTime(Math.max(20, hpfFreq + hpfSweep), t0 + totalDur);
            chain.connect(hpf); chain = hpf;
        }
        if (lpfFreq > 0) {
            const lpf = this.ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.setValueAtTime(lpfFreq, t0);
            if (lpfSweep !== 0) lpf.frequency.linearRampToValueAtTime(Math.max(20, lpfFreq + lpfSweep), t0 + totalDur);
            lpf.Q.value = lpfResonance;
            chain.connect(lpf); chain = lpf;
        }
        const envGain = this.ctx.createGain();
        const peakGain = masterVolume * (1 + sustainPunch);
        if (attackTime > 0) {
            envGain.gain.setValueAtTime(0.0001, t0);
            envGain.gain.linearRampToValueAtTime(peakGain, t0 + attackTime);
        } else {
            envGain.gain.setValueAtTime(peakGain, t0);
        }
        envGain.gain.setValueAtTime(peakGain, t0 + attackTime);
        if (sustainPunch > 0 && sustainTime > 0) {
            envGain.gain.linearRampToValueAtTime(masterVolume, t0 + attackTime + Math.min(sustainTime, sustainTime * 0.3 + 0.02));
        }
        envGain.gain.setValueAtTime(masterVolume, t0 + attackTime + sustainTime);
        if (decayTime > 0) envGain.gain.linearRampToValueAtTime(0.0001, t0 + totalDur);
        chain.connect(envGain);
        envGain.connect(this.masterGain);
        sources.forEach(s => { s.toStart.start(t0); s.toStart.stop(t0 + totalDur + 0.02); });
        if (lfo) { lfo.start(t0); lfo.stop(t0 + totalDur + 0.02); }
    },

    // ========== ジャンプ系 ==========
    playSE_jump_01() { this.playFreqSweep({ startFreq: 200, endFreq: 600, duration: 0.1, waveType: 'square' }); },
    playSE_jump_02() { this.playFreqSweep({ startFreq: 300, endFreq: 900, duration: 0.08, waveType: 'square' }); },
    playSE_jump_03() { this.playFreqSweep({ startFreq: 304, endFreq: 988, waveType: 'square', startGain: 0.5, duration: 0.205, duty: 0.25 }); },
    playSE_jump_04() { this.playFreqSweep({ startFreq: 150, duration: 0.1, waveType: 'square', numSegments: [{ freq: 800, time: 0.04 }, { freq: 400, time: 0.06 }] }); },
    playSE_jump_05() { this.playFreqSweep({ startFreq: 400, endFreq: 1000, duration: 0.1, waveType: 'square', startGain: 0.15 }); },

    // ========== 攻撃系 ==========
    playSE_attack_01() { this.playFreqSweep({ startFreq: 393, endFreq: 1394, waveType: 'sawtooth', startGain: 0.31, duration: 0.055, duty: 0.25 }); },
    playSE_attack_02() { this.playFreqSweep({ startFreq: 800, endFreq: 200, duration: 0.06, waveType: 'square', duty: 0.125 }); },
    playSE_attack_03() { this.playNoiseSE({ duration: 0.05, startGain: 0.3 }); },
    playSE_attack_04() { this.playFreqSweep({ startFreq: 600, endFreq: 150, duration: 0.06, waveType: 'square' }); },
    playSE_attack_05() { this.playFreqSweep({ startFreq: 1200, endFreq: 400, duration: 0.08, waveType: 'square', duty: 0.25 }); },

    // ========== ダメージ系 ==========
    playSE_damage_01() { this.playFreqSweep({ startFreq: 400, endFreq: 100, duration: 0.15, waveType: 'square' }); },
    playSE_damage_02() { this.playFreqSweep({ startFreq: 300, endFreq: 80, duration: 0.1, waveType: 'square' }); },
    playSE_damage_03() { this.playFreqSweep({ startFreq: 200, endFreq: 50, duration: 0.15, waveType: 'square' }); },
    playSE_damage_04() { this.playNoiseSE({ duration: 0.36, startGain: 0.52, sustainPunch: 0.6, filterFreq: 1600, filterSweep: -2490, pitchJump: 960 }); },
    playSE_damage_05() { this.playFreqSweep({ startFreq: 500, endFreq: 60, duration: 0.12, waveType: 'square', duty: 0.25 }); },

    // ========== アイテムゲット系 ==========
    playSE_itemGet_01() { this.playMultiNote({ waveType: 'square', notes: [{ freq: 523, duration: 0.05 }, { freq: 784, duration: 0.07 }] }); },
    playSE_itemGet_02() { this.playRepeatingSweep({ startFreq: 295, endFreq: 2827, segmentDuration: 0.24, repeatCount: 1, waveType: 'square', startGain: 0.15 }); },
    playSE_itemGet_03() { this.playMultiNote({ waveType: 'square', gain: 0.57, notes: [{ freq: 467, duration: 0.061, spacing: 0.035 }, { freq: 945, duration: 0.099 }, { freq: 1429, duration: 0.097, spacing: 0.034 }, { freq: 1416, duration: 0.039 }, { freq: 1219, duration: 0.05 }], duty: 0.5 }); },
    playSE_itemGet_04() { this.playMultiNote({ waveType: 'square', duty: 0.25, gain: 0.5, notes: [{ freq: 523, duration: 0.05 }, { freq: 659, duration: 0.07 }] }); },
    playSE_itemGet_05() {
        this.ensureContext();
        const t = this.ctx.currentTime;
        const duty = 0.25;
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
        // 880 Hz (A5) → 1320 Hz (E6, 完全5度上), 計67ms
        [[880, t, 0.030], [1320, t + 0.032, 0.035]].forEach(([freq, start, dur]) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.setPeriodicWave(this.waveCache[cacheKey]);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.5, start);
            gain.gain.setValueAtTime(0, start + dur);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(start);
            osc.stop(start + dur + 0.001);
        });
    },

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
