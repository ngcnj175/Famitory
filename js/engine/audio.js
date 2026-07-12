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

    // ==================================================
    // Unified Synth Engine (統合シンセ, Bfxr風)
    //   全 playSE_<name> はこの1メソッドを呼び出す
    //   波形: square/sine/triangle/sawtooth/noise
    //   ADSR + ピッチスライド + vibrato + harmonics
    //   HPF/LPF/BPF + pitchJump + bitCrush + flanger + compression
    // ==================================================
    playUnifiedSE(config) {
        this.ensureContext();
        // Sequence mode: notes配列で連続再生
        if (config.notes && config.notes.length > 0) {
            const baseCfg = { ...config };
            delete baseCfg.notes;
            let t = config.startTime != null ? config.startTime : this.ctx.currentTime;
            for (const note of config.notes) {
                this.playUnifiedSE({
                    ...baseCfg,
                    sustainTime: note.duration,
                    frequencyStart: note.freq,
                    frequencySlide: 0,
                    startTime: t
                });
                t += note.duration + (note.spacing || 0);
            }
            return;
        }
        // Repeat mode: repeatCount+segmentDuration で同じ波形を繰り返し
        if ((config.repeatCount || 1) > 1) {
            const segDur = config.segmentDuration || config.sustainTime || 0.1;
            const baseCfg = { ...config };
            delete baseCfg.repeatCount;
            delete baseCfg.segmentDuration;
            baseCfg.sustainTime = segDur;
            const t0 = config.startTime != null ? config.startTime : this.ctx.currentTime;
            for (let i = 0; i < config.repeatCount; i++) {
                this.playUnifiedSE({ ...baseCfg, startTime: t0 + segDur * i });
            }
            return;
        }
        const {
            waveType = 'square', duty = null,
            envelopeMode = 'adsr',
            attackTime = 0, sustainTime = 0.1, sustainPunch = 0, decayTime = 0.1,
            masterVolume = 0.2,
            frequencyStart = 440, frequencySlide = 0, slideType = 'exponential',
            frequencyRamps = null,
            pitchJump1Amount = 0, pitchJump1Onset = 0,
            pitchJump2Amount = 0, pitchJump2Onset = 0,
            vibratoDepth = 0, vibratoSpeed = 0,
            harmonics = 0, harmonicsFalloff = 0.5,
            hpfFreq = 0, hpfSweep = 0,
            lpfFreq = 0, lpfSweep = 0, lpfResonance = 1, lpfPitchJump = 0,
            bpfFreq = 0, bpfSweep = 0, bpfQ = 1,
            bitCrush = 0,
            flangerOffset = 0, flangerSweep = 0,
            compression = 0,
            startTime = null
        } = config;
        const isLegacy = envelopeMode === 'legacy4step';
        const totalDur = isLegacy
            ? Math.max(0.01, sustainTime)
            : Math.max(0.01, attackTime + sustainTime + decayTime);
        const t0 = startTime != null ? startTime : this.ctx.currentTime;
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
                osc.frequency.setValueAtTime(startF, t0);
                if (frequencyRamps && frequencyRamps.length > 0) {
                    let rampT = t0;
                    for (const r of frequencyRamps) {
                        const rEnd = Math.max(20, r.freq * mult);
                        if (slideType === 'exponential') osc.frequency.exponentialRampToValueAtTime(rEnd, rampT + r.time);
                        else osc.frequency.linearRampToValueAtTime(rEnd, rampT + r.time);
                        rampT += r.time;
                    }
                } else if (frequencySlide !== 0) {
                    const endF = Math.max(20, (frequencyStart + frequencySlide) * mult);
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
        // pitchJump: ConstantSourceで基本周波数に加算 (Bfxr風2段階)
        let jumpCS = null;
        if (!isNoise && (pitchJump1Amount || pitchJump2Amount)) {
            jumpCS = this.ctx.createConstantSource();
            jumpCS.offset.setValueAtTime(0, t0);
            let accum = 0;
            if (pitchJump1Amount && pitchJump1Onset > 0) {
                accum += pitchJump1Amount;
                jumpCS.offset.setValueAtTime(accum, t0 + totalDur * pitchJump1Onset);
            }
            if (pitchJump2Amount && pitchJump2Onset > 0) {
                accum += pitchJump2Amount;
                jumpCS.offset.setValueAtTime(accum, t0 + totalDur * pitchJump2Onset);
            }
            sources.forEach(s => { if (s.freqParam) jumpCS.connect(s.freqParam); });
        }
        const mixer = this.ctx.createGain();
        sources.forEach(s => s.outNode.connect(mixer));
        let chain = mixer;
        if (bpfFreq > 0) {
            const bpf = this.ctx.createBiquadFilter();
            bpf.type = 'bandpass';
            bpf.frequency.setValueAtTime(bpfFreq, t0);
            if (bpfSweep !== 0) bpf.frequency.linearRampToValueAtTime(Math.max(20, bpfFreq + bpfSweep), t0 + totalDur);
            bpf.Q.value = bpfQ;
            chain.connect(bpf); chain = bpf;
        }
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
            lpf.frequency.setValueAtTime(lpfFreq + lpfPitchJump, t0);
            if (lpfPitchJump > 0) lpf.frequency.linearRampToValueAtTime(lpfFreq, t0 + 0.02);
            if (lpfSweep !== 0) lpf.frequency.linearRampToValueAtTime(Math.max(20, lpfFreq + lpfSweep), t0 + totalDur);
            lpf.Q.value = lpfResonance;
            chain.connect(lpf); chain = lpf;
        }
        // bitCrush: WaveShaperで振幅を量子化 (0=無効, 1=1bit相当)
        if (bitCrush > 0) {
            const ws = this.ctx.createWaveShaper();
            const bits = Math.max(1, 16 - bitCrush * 15);
            const steps = Math.pow(2, bits);
            const n = 65536;
            const curve = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                const x = (i / (n / 2)) - 1;
                curve[i] = Math.round(x * steps) / steps;
            }
            ws.curve = curve;
            chain.connect(ws); chain = ws;
        }
        // flanger: ディレイ+スイープでウェット/ドライミックス (Bfxr風静的フランジャー)
        if (flangerOffset > 0 || flangerSweep !== 0) {
            const maxDelay = Math.max(0.001, (Math.abs(flangerOffset) + Math.abs(flangerSweep)) / 1000 + 0.001);
            const delay = this.ctx.createDelay(maxDelay);
            const startD = Math.max(0, flangerOffset) / 1000;
            const endD = Math.max(0, flangerOffset + flangerSweep) / 1000;
            delay.delayTime.setValueAtTime(startD, t0);
            if (flangerSweep !== 0) delay.delayTime.linearRampToValueAtTime(endD, t0 + totalDur);
            const wetGain = this.ctx.createGain();
            const dryGain = this.ctx.createGain();
            const flangerMix = this.ctx.createGain();
            wetGain.gain.value = 0.5;
            dryGain.gain.value = 0.5;
            chain.connect(delay); delay.connect(wetGain); wetGain.connect(flangerMix);
            chain.connect(dryGain); dryGain.connect(flangerMix);
            chain = flangerMix;
        }
        const envGain = this.ctx.createGain();
        const peakGain = masterVolume * (1 + sustainPunch);
        if (isLegacy) {
            const step = totalDur / 4;
            envGain.gain.setValueAtTime(peakGain, t0);
            envGain.gain.setValueAtTime(masterVolume * 0.6, t0 + step);
            envGain.gain.setValueAtTime(masterVolume * 0.25, t0 + step * 2);
            envGain.gain.setValueAtTime(0.001, t0 + step * 3);
        } else {
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
        }
        chain.connect(envGain);
        let outNode = envGain;
        // compression: DynamicsCompressorで音量の一貫性 (0=無効, 1=最大圧縮)
        if (compression > 0) {
            const comp = this.ctx.createDynamicsCompressor();
            comp.threshold.value = -24 - compression * 20;
            comp.knee.value = 30;
            comp.ratio.value = 1 + compression * 19;
            comp.attack.value = 0.003;
            comp.release.value = 0.1;
            envGain.connect(comp); outNode = comp;
        }
        outNode.connect(this.masterGain);
        sources.forEach(s => { s.toStart.start(t0); s.toStart.stop(t0 + totalDur + 0.02); });
        if (lfo) { lfo.start(t0); lfo.stop(t0 + totalDur + 0.02); }
        if (jumpCS) { jumpCS.start(t0); jumpCS.stop(t0 + totalDur + 0.02); }
    },

    // ========== ジャンプ系 ==========
    playSE_jump_01() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 400, frequencySlide: 600, sustainTime: 0.1, masterVolume: 0.15 }); },
    playSE_jump_02() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 300, frequencySlide: 600, sustainTime: 0.08 }); },
    playSE_jump_03() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 200, frequencySlide: 400, sustainTime: 0.1 }); },
    playSE_jump_04() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 150, sustainTime: 0.1, frequencyRamps: [{ freq: 800, time: 0.04 }, { freq: 400, time: 0.06 }] }); },
    playSE_jump_05() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', duty: 0.25, frequencyStart: 304, frequencySlide: 684, sustainTime: 0.205, masterVolume: 0.5 }); },

    // ========== 攻撃系 ==========
    playSE_attack_01() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'sawtooth', duty: 0.25, frequencyStart: 393, frequencySlide: 1001, sustainTime: 0.055, masterVolume: 0.31 }); },
    playSE_attack_02() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', duty: 0.125, frequencyStart: 800, frequencySlide: -600, sustainTime: 0.06 }); },
    playSE_attack_03() { this.playUnifiedSE({ waveType: 'noise', attackTime: 0, sustainTime: 0.085, decayTime: 0.06, masterVolume: 0.26, frequencyStart: 3642, sustainPunch: 1.15, frequencySlide: -1044, slideType: 'linear', hpfFreq: 1380, hpfSweep: -3860, lpfFreq: 2120, lpfSweep: 1030, lpfResonance: 0.6, flangerOffset: 0, flangerSweep: 20 }); },
    playSE_attack_04() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 600, frequencySlide: -450, sustainTime: 0.06 }); },
    playSE_attack_05() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', duty: 0.25, frequencyStart: 1200, frequencySlide: -800, sustainTime: 0.08 }); },

    // ========== ダメージ系 ==========
    playSE_damage_01() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 400, frequencySlide: -300, sustainTime: 0.15 }); },
    playSE_damage_02() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 300, frequencySlide: -220, sustainTime: 0.1 }); },
    playSE_damage_03() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 200, frequencySlide: -150, sustainTime: 0.15 }); },
    playSE_damage_04() { this.playUnifiedSE({ waveType: 'square', attackTime: 0, sustainTime: 0.165, decayTime: 0.095, masterVolume: 0.34, frequencyStart: 164, frequencySlide: -122, vibratoDepth: 23, vibratoSpeed: 9.5, pitchJump1Amount: 160, pitchJump1Onset: 0.1, flangerOffset: 0, flangerSweep: -20 }); },
    playSE_damage_05() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', duty: 0.25, frequencyStart: 500, frequencySlide: -440, sustainTime: 0.12 }); },

    // ========== アイテムゲット系 ==========
    playSE_itemGet_01() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', notes: [{ freq: 523, duration: 0.05 }, { freq: 784, duration: 0.07 }] }); },
    playSE_itemGet_02() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 295, frequencySlide: 2532, sustainTime: 0.24, masterVolume: 0.15 }); },
    playSE_itemGet_03() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', duty: 0.5, masterVolume: 0.57, notes: [{ freq: 467, duration: 0.061, spacing: 0.035 }, { freq: 945, duration: 0.099 }, { freq: 1429, duration: 0.097, spacing: 0.034 }, { freq: 1416, duration: 0.039 }, { freq: 1219, duration: 0.05 }] }); },
    playSE_itemGet_04() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', duty: 0.25, masterVolume: 0.5, notes: [{ freq: 523, duration: 0.05 }, { freq: 659, duration: 0.07 }] }); },
    playSE_itemGet_05() { this.playUnifiedSE({ waveType: 'square', attackTime: 0, sustainTime: 0.15, decayTime: 0.195, masterVolume: 0.36, frequencyStart: 85, duty: 0.25, sustainPunch: 0.4, frequencySlide: 3000, vibratoDepth: 13, vibratoSpeed: 17, hpfFreq: 1200, hpfSweep: -1660, lpfSweep: -600, pitchJump1Amount: 480, pitchJump1Onset: 0.42, pitchJump2Amount: 800, pitchJump2Onset: 0.28, flangerOffset: 0, flangerSweep: -20, compression: 0.06, repeatCount: 2 }); },

    // ========== その他系 ==========
    playSE_other_01() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 440, frequencySlide: 440, sustainTime: 0.05, masterVolume: 0.15 }); },
    playSE_other_02() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 440, frequencySlide: -220, sustainTime: 0.05, masterVolume: 0.15 }); },
    playSE_other_03() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 660, sustainTime: 0.03, masterVolume: 0.1 }); },
    playSE_other_04() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'square', frequencyStart: 330, sustainTime: 0.05 }); },
    playSE_other_05() { this.playUnifiedSE({ envelopeMode: 'legacy4step', waveType: 'noise', sustainTime: 0.15, masterVolume: 0.4 }); },

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
