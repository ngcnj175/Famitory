/**
 * BGM Editor - Audio Playback Engine
 * Web Audio APIの管理、音声合成、再生制御を担当する
 * DOM / Canvas には一切触れない
 */
class BgmPlayer {
    constructor() {
        // Web Audio
        this.audioCtx = null;
        this.waveCache = {};

        // 再生状態
        this.isPlaying = false;
        this.isPaused = false;
        this.playInterval = null;
        this.activeOscillators = [null, null, null, null];
        // ポルタメント（スライド音色）用: 直前音の周波数をトラック毎に保持
        this.lastFreq = [null, null, null, null];
        this.outputNode = null; // 外部から設定可能な出力先（未設定時はaudioCtx.destination）
        // ルックアヘッド予約済みの音源一覧（stop() で未来予約分を一斉停止するため）
        this._scheduledSources = [];

        // キーボードプレビュー用
        this.currentKeyOsc = null;
        this.currentKeyGain = null;

        // 音階定義（7オクターブ = C1-B7）
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }

    // ========== AudioContext 管理 ==========

    /**
     * AudioContextを初期化する（まだない場合のみ）
     */
    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
    }

    /**
     * 出力先を取得する（outputNodeが設定されていればそちら、なければdestination）
     */
    getOutput() {
        return this.outputNode || this.audioCtx.destination;
    }

    /**
     * AudioContextを再作成する（iOS確認ダイアログ後の対策）
     */
    reset() {
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch (e) { }
        }
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.waveCache = {};
        this.activeOscillators = [null, null, null, null];
        this.lastFreq = [null, null, null, null];

        // ゲームエンジンのBGMプレイヤーもクリア
        if (typeof GameEngine !== 'undefined' && GameEngine.gameBgmPlayer) {
            try { GameEngine.gameBgmPlayer.audioCtx?.close(); } catch (e) { }
            GameEngine.gameBgmPlayer.outputNode = null;
        }
    }

    /**
     * suspendedなら再開を試みる（iOS対応）
     */
    resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(e => console.log('AudioContext resume failed:', e));
        }
    }

    // ========== 音程ユーティリティ ==========

    getFrequency(note, octave) {
        const noteIdx = this.noteNames.indexOf(note);
        // A4 = 440Hz
        const semitone = (octave - 4) * 12 + noteIdx - 9;
        return 440 * Math.pow(2, semitone / 12);
    }

    noteToPitch(note, octave) {
        // C1 = 0, B7 = 83
        const noteIdx = this.noteNames.indexOf(note);
        return (octave - 1) * 12 + noteIdx;
    }

    pitchToNote(pitch) {
        const octave = Math.floor(pitch / 12) + 1;
        const noteIdx = pitch % 12;
        return { note: this.noteNames[noteIdx], octave };
    }

    /**
     * オシレーターとゲインの接続。Standard系(tone 0,1,2,7)は低域を薄く削って軽い響きに。
     */
    connectOscToGain(osc, gain, trackType, tone) {
        if (trackType === 'square' && (tone === 0 || tone === 1 || tone === 2 || tone === 7)) {
            const hp = this.audioCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 180;
            osc.connect(hp);
            hp.connect(gain);
        } else {
            osc.connect(gain);
        }
    }

    /**
     * オシレーターの波形と triangle 音量スケールをまとめて設定する。
     * @returns {number} triangle sawtooth用のvolumeScale補正(通常1.0)
     */
    setupToneWaveform(osc, trackType, tone) {
        if (trackType === 'square') {
            // Sharp系(3-5) と Sharp (Slide)(8) はデューティ12.5%のパルス波
            if ((tone >= 3 && tone <= 5) || tone === 8) {
                const wave = this.getPeriodicWave(0.125);
                if (wave) { osc.setPeriodicWave(wave); return 1.0; }
            }
            osc.type = 'square';
            return 1.0;
        }
        if (trackType === 'triangle') {
            if (tone === 1) { osc.type = 'sine'; return 1.0; }
            if (tone === 2) { osc.type = 'sawtooth'; return 0.6; }
            osc.type = 'triangle';
            return 1.0;
        }
        return 1.0;
    }

    /**
     * tone別の基本音量を取得する。
     */
    getBaseVol(trackType, tone) {
        if (trackType !== 'square') return 0.2;
        switch (tone) {
            case 1: return 0.135; // Standard (Short)
            case 2: return 0.135; // Standard (FadeIn)
            case 3: return 0.275; // Sharp
            case 4: return 0.385; // Sharp (Short)
            case 5: return 0.33;  // Sharp (FadeIn)
            case 6: return 0.05;  // Tremolo
            case 8: return 0.275; // Sharp (Slide)
            default: return 0.108; // Standard(0) / Standard Slide(7) / 未定義
        }
    }

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
    }

    // ========== 音声生成（プレビュー用・1回完結型） ==========

    /**
     * 短音プレビュー再生（鍵盤タップ用）
     * trackTypes: 外から渡すことでBgmPlayerが依存しない
     */
    playNote(note, octave, trackType, track, duration = 0.2) {
        if (!this.audioCtx) return;
        const tone = track.tone || 0;

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
        panner.connect(this.getOutput());

        const freq = this.getFrequency(note, octave);
        const osc = this.audioCtx.createOscillator();
        const volumeScale = this.setupToneWaveform(osc, trackType, tone);
        osc.frequency.value = freq;

        const volume = this.getBaseVol(trackType, tone) * track.volume * volumeScale;

        // エンベロープ設定
        const isShort = (tone === 1 || tone === 4);
        const isFadeIn = (tone === 2 || tone === 5);
        const t = this.audioCtx.currentTime;

        if (isShort) {
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.5);
        } else if (isFadeIn) {
            // ピーク到達を早めて拍に乗るよう改善
            const fadePeak = Math.min(duration * 0.25, 0.06);
            gain.gain.setValueAtTime(0.01, t);
            gain.gain.exponentialRampToValueAtTime(volume, t + fadePeak);
            gain.gain.setValueAtTime(volume, t + duration * 0.9);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        } else {
            gain.gain.setValueAtTime(volume, t);
            const sustainTime = duration * 0.8;
            gain.gain.setValueAtTime(volume, t + sustainTime);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        }

        this.connectOscToGain(osc, gain, trackType, tone);
        osc.start();
        osc.stop(t + duration);
    }

    /**
     * 再生ループ用モノフォニック発音（トラックごとに同時発音1に制限）
     * startTime を渡すと未来時刻で予約発音（ルックアヘッドスケジューリング用）。
     */
    playNoteMonophonic(note, octave, duration, trackIdx, trackType, track, currentStep = null, startTime = null) {
        if (!this.audioCtx) return;
        const tone = track.tone || 0;
        const t = startTime ?? this.audioCtx.currentTime;

        // 前の音を停止（新ノート開始時刻で切る: モノフォニック）
        this._stopActive(trackIdx, t);

        // スライド音色（Square: tone 7=Standard Slide, 8=Sharp Slide）
        const isSlideTone = (trackType === 'square' && (tone === 7 || tone === 8));

        // ノイズトラック
        if (trackType === 'noise') {
            const pitch = this.noteToPitch(note, octave);
            if (tone === 0) {
                // PitchedNoise はモノフォニック（1トラック=1音のコンセプト）
                const src = this.playPitchedNoise(pitch, duration, track.volume, track.pan, t);
                if (src) this.activeOscillators[trackIdx] = src;
            } else {
                // Drum系 (tone=1〜7) はファミコン準拠でポリフォニック（連打を許容）
                this.playDrum(pitch, duration, track.volume, track.pan, tone, t);
            }
            return;
        }

        // TRIANGLE Kickトーン（モノフォニック）
        if (trackType === 'triangle' && tone === 3) {
            const src = this.playKickTone(note, octave, track.volume, track.pan, duration, t);
            if (src) this.activeOscillators[trackIdx] = src;
            return;
        }

        // SQUARE Tremoloトーン（モノフォニック）
        if (trackType === 'square' && tone === 6) {
            const src = this.playTremolo(note, octave, track.volume, track.pan, duration, t);
            if (src) this.activeOscillators[trackIdx] = src;
            return;
        }

        // 通常の音色
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = track.pan;
        gain.connect(panner);
        panner.connect(this.getOutput());

        const freq = this.getFrequency(note, octave);
        const osc = this.audioCtx.createOscillator();
        const volumeScale = this.setupToneWaveform(osc, trackType, tone);

        // 周波数設定（スライド判定: 同じトラックで直前に鳴った音があれば距離を問わずスライド）
        const doSlide = isSlideTone
            && currentStep !== null
            && this.lastFreq[trackIdx] != null;
        if (doSlide) {
            // スライド時間はノート長に応じて短縮（短い音符でも成立するように）
            const slideTime = Math.min(0.2, duration * 0.7);
            osc.frequency.setValueAtTime(this.lastFreq[trackIdx], t);
            osc.frequency.linearRampToValueAtTime(freq, t + slideTime);
        } else {
            osc.frequency.value = freq;
        }

        const volume = this.getBaseVol(trackType, tone) * track.volume * volumeScale;

        // エンベロープ設定
        const isShort = (tone === 1 || tone === 4);
        const isFadeIn = (tone === 2 || tone === 5);

        if (isShort) {
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.5);
        } else if (isFadeIn) {
            // ピーク到達を早めて拍に乗るよう改善
            const fadePeak = Math.min(duration * 0.25, 0.06);
            gain.gain.setValueAtTime(0.01, t);
            gain.gain.exponentialRampToValueAtTime(volume, t + fadePeak);
            gain.gain.setValueAtTime(volume, t + duration * 0.9);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        } else if (doSlide) {
            // スライド時は再アタックを目立たせないよう短くフェードイン
            gain.gain.setValueAtTime(volume * 0.4, t);
            gain.gain.linearRampToValueAtTime(volume, t + 0.012);
            gain.gain.setValueAtTime(volume, t + duration - 0.05);
            gain.gain.linearRampToValueAtTime(0.01, t + duration);
        } else {
            gain.gain.setValueAtTime(volume, t);
            gain.gain.setValueAtTime(volume, t + duration - 0.05);
            gain.gain.linearRampToValueAtTime(0.01, t + duration);
        }

        this.connectOscToGain(osc, gain, trackType, tone);
        osc.start(t);
        osc.stop(t + duration + 0.05);
        this._trackScheduled(osc);

        this.activeOscillators[trackIdx] = { osc, gain };

        // スライド判定用に直前音の周波数を記録
        if (currentStep !== null) {
            this.lastFreq[trackIdx] = freq;
        }

        // 停止後にクリア（未来予約時は実発音時刻を考慮）
        const cleanupDelayMs = Math.max(0, (t - this.audioCtx.currentTime + duration) * 1000);
        setTimeout(() => {
            if (this.activeOscillators[trackIdx] && this.activeOscillators[trackIdx].osc === osc) {
                this.activeOscillators[trackIdx] = null;
            }
        }, cleanupDelayMs);
    }

    // ========== 内部ヘルパ: トラック単位で発音中の音を停止 ==========
    // when を渡すとその時刻に停止予約（モノフォニック切替用）。省略時は即停止。
    _stopActive(trackIdx, when = null) {
        const prev = this.activeOscillators[trackIdx];
        if (!prev) return;
        const src = prev.osc || prev.noise;
        if (src) {
            try { src.stop(when ?? this.audioCtx.currentTime); } catch (e) { }
        }
        this.activeOscillators[trackIdx] = null;
    }

    // ========== 内部ヘルパ: 予約済み音源を追跡（stop() 時に未来予約分も止めるため） ==========
    _trackScheduled(src) {
        if (!src) return;
        this._scheduledSources.push(src);
        // 一定数以上溜まったら古いものから掃除（最大200件）
        if (this._scheduledSources.length > 400) {
            this._scheduledSources.splice(0, 200);
        }
    }

    // ========== Kickトーン（短くピッチ下降する音） ==========
    playKickTone(note, octave, volume, pan, duration = 0.15, startTime = null) {
        if (!this.audioCtx) return null;
        const freq = this.getFrequency(note, octave);
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(this.getOutput());

        osc.type = 'triangle';
        const t = startTime ?? this.audioCtx.currentTime;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.25, t + duration);
        gain.gain.setValueAtTime(0.5 * volume, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + duration);
        this._trackScheduled(osc);
        return { osc, gain };
    }

    // ========== トレモロ（1オクターブ上と交互に高速切替） ==========
    playTremolo(note, octave, volume, pan, duration, startTime = null) {
        if (!this.audioCtx) return null;
        const freq1 = this.getFrequency(note, octave);
        const freq2 = freq1 * 2;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(this.getOutput());

        osc.type = 'square';
        const tremoloRate = 30;
        const numCycles = Math.ceil(duration * tremoloRate);
        const cycleTime = 1 / tremoloRate;
        const t = startTime ?? this.audioCtx.currentTime;

        for (let i = 0; i < numCycles; i++) {
            osc.frequency.setValueAtTime(i % 2 === 0 ? freq1 : freq2, t + i * cycleTime);
        }

        gain.gain.setValueAtTime(0.05 * volume, t);
        const sustainTime = duration * 0.8;
        gain.gain.setValueAtTime(0.05 * volume, t + sustainTime);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(gain);
        osc.start(t);
        osc.stop(t + duration);
        this._trackScheduled(osc);
        return { osc, gain };
    }

    // ========== Noise (ピッチ) - 音程対応の持続ノイズ ==========
    playPitchedNoise(pitch, duration, volume = 1.0, pan = 0.0, startTime = null) {
        if (!this.audioCtx) return null;
        const ctx = this.audioCtx;
        const t = startTime ?? ctx.currentTime;

        const { note, octave } = this.pitchToNote(pitch);
        const freq = this.getFrequency(note, octave);
        const actualDuration = duration * 0.6;

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

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 1.2;

        const gain = ctx.createGain();
        const noiseVol = 0.44 * volume;
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;

        gain.gain.setValueAtTime(noiseVol, t);
        gain.gain.setValueAtTime(noiseVol, t + Math.max(0, actualDuration - 0.03));
        gain.gain.linearRampToValueAtTime(0.01, t + actualDuration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.getOutput());

        noise.start(t);
        noise.stop(t + bufferDuration);
        this._trackScheduled(noise);

        return { noise, gain };
    }

    // ========== NES APU風ドラムキット ==========
    playDrum(pitch, duration, volume = 1.0, pan = 0.0, tone = 0, startTime = null) {
        if (!this.audioCtx) return null;
        const ctx = this.audioCtx;
        const t = startTime ?? ctx.currentTime;
        const octave = Math.floor(pitch / 12) + 1;

        let filterType, filterFreq, filterQ, drumVol, decayTime, useShortNoise, pitchEnvDown, attackTime, holdTime, isRoll;

        switch (octave) {
            case 1: // Low Kick
                filterType = 'lowpass'; filterFreq = 120; filterQ = 1.5;
                drumVol = 0.9 * volume; decayTime = 0.14;
                useShortNoise = false; pitchEnvDown = true;
                attackTime = 0.008; holdTime = 0.00; isRoll = false; break;
            case 2: // Tight Snare
                filterType = 'bandpass'; filterFreq = 1200; filterQ = 1.5;
                drumVol = 0.5 * volume; decayTime = 0.13;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.002; holdTime = 0.00; isRoll = false; break;
            case 3: // Open Snare / Clap
                filterType = 'bandpass'; filterFreq = 2200; filterQ = 0.6;
                drumVol = 0.3 * volume; decayTime = 0.22;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.003; holdTime = 0.015; isRoll = false; break;
            case 4: // Closed Hi-Hat
                filterType = 'highpass'; filterFreq = 7000; filterQ = 0.5;
                drumVol = 0.3 * volume; decayTime = 0.05;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.001; holdTime = 0.00; isRoll = false; break;
            case 5: // Open Hi-Hat
                filterType = 'highpass'; filterFreq = 5000; filterQ = 0.5;
                drumVol = 0.3 * volume; decayTime = 0.25;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.001; holdTime = 0.00; isRoll = false; break;
            case 6: // Noise Roll
                filterType = 'bandpass'; filterFreq = 3000; filterQ = 0.8;
                drumVol = 0.3 * volume;
                isRoll = (duration > 0.15);
                decayTime = isRoll ? duration : 0.15;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.005; holdTime = 0.00; break;
            case 7: // Cymbal (シャリ〜ンと持続するノイズ)
            default:
                filterType = 'highpass'; filterFreq = 6000; filterQ = 0.4;
                drumVol = 0.28 * volume; decayTime = 0.6;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.002; holdTime = 0.02; isRoll = false; break;
        }

        const noteInOct = pitch % 12;
        filterFreq *= (1 + noteInOct * 0.02);
        if (!isRoll) decayTime *= (1 + noteInOct * 0.015);

        const actualDuration = Math.max(decayTime + attackTime + holdTime + 0.02, 0.05);
        const bufferSize = Math.floor(ctx.sampleRate * actualDuration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (useShortNoise) {
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
            let lfsr = 1;
            for (let i = 0; i < bufferSize; i++) {
                const bit = ((lfsr >> 0) ^ (lfsr >> 1)) & 1;
                data[i] = (lfsr & 1) ? 1.0 : -1.0;
                lfsr = (lfsr >> 1) | (bit << 14);
            }
        }

        if (isRoll) {
            const rollRate = 24;
            for (let i = 0; i < bufferSize; i++) {
                const sec = i / ctx.sampleRate;
                const phase = (sec * rollRate) % 1.0;
                const amp = 0.2 + 0.8 * Math.pow(1.0 - phase, 2);
                data[i] *= amp;
            }
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = filterFreq;
        filter.Q.value = filterQ;

        if (pitchEnvDown) {
            filter.frequency.setValueAtTime(filterFreq * 2.5, t);
            filter.frequency.exponentialRampToValueAtTime(filterFreq, t + decayTime * 0.4);
        }

        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.getOutput());

        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(drumVol, t + attackTime);
        if (isRoll) {
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
        this._trackScheduled(noise);

        return { noise, gain };
    }

    // ========== キーボードプレビュー（長押し用：持続音） ==========

    /**
     * 持続音を開始する（鍵盤長押し用）
     * @returns {{osc, gain}|null} 停止用のノードを返す
     */
    startKeySound(note, octave, trackType, track) {
        this.stopKeySound();
        if (!this.audioCtx) return null;

        const tone = track.tone || 0;
        const pitch = this.noteToPitch(note, octave);

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
            return;
        }

        // Kickトーン
        if (trackType === 'triangle' && tone === 3) {
            this.playKickTone(note, octave, track.volume, track.pan);
            return;
        }

        // Tremoloトーン
        if (trackType === 'square' && tone === 6) {
            const freq1 = this.getFrequency(note, octave);
            const freq2 = freq1 * 2;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const panner = this.audioCtx.createStereoPanner();
            panner.pan.value = track.pan;
            gain.connect(panner);
            panner.connect(this.getOutput());

            osc.type = 'square';
            const tremoloRate = 30;
            const maxDuration = 5;
            const numCycles = tremoloRate * maxDuration;
            const cycleTime = 1 / tremoloRate;
            for (let i = 0; i < numCycles; i++) {
                const t = this.audioCtx.currentTime + i * cycleTime;
                osc.frequency.setValueAtTime(i % 2 === 0 ? freq1 : freq2, t);
            }
            gain.gain.value = 0.05 * track.volume;
            osc.connect(gain);
            osc.start();
            this.currentKeyOsc = osc;
            this.currentKeyGain = gain;
            return;
        }

        // 通常トーン（持続）
        const freq = this.getFrequency(note, octave);
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = track.pan;
        gain.connect(panner);
        panner.connect(this.getOutput());

        const volumeScale = this.setupToneWaveform(osc, trackType, tone);
        osc.frequency.value = freq;
        gain.gain.value = this.getBaseVol(trackType, tone) * track.volume * volumeScale;

        this.connectOscToGain(osc, gain, trackType, tone);
        osc.start();
        this.currentKeyOsc = osc;
        this.currentKeyGain = gain;
    }

    /**
     * 持続音を停止する（鍵盤リリース用）
     */
    stopKeySound() {
        if (this.currentKeyGain && this.audioCtx) {
            this.currentKeyGain.gain.exponentialRampToValueAtTime(
                0.01,
                this.audioCtx.currentTime + 0.1
            );
        }
        if (this.currentKeyOsc) {
            try {
                this.currentKeyOsc.stop(
                    this.audioCtx ? this.audioCtx.currentTime + 0.1 : 0
                );
            } catch (e) { }
            this.currentKeyOsc = null;
            this.currentKeyGain = null;
        }
    }

    // ========== 再生制御 ==========

    /**
     * 再生を開始する（ルックアヘッド予約スケジューリング）
     * @param {Object} song - ソングデータ
     * @param {string[]} trackTypes - トラックの波形タイプ配列
     * @param {number} startStep - 開始ステップ（pause 後の再開時に現在ステップを渡す）
     * @param {Function} onStep - ステップ更新コールバック (step) => void
     * @param {boolean} loop - ループ再生するか
     * @param {Function} isPausedFn - 外部からの一時停止判定関数（任意、ゲーム一時停止連動用）
     * @param {Function} mutedTracksFn - ミュート中トラック配列を返す関数（任意）
     */
    play(song, trackTypes, startStep, onStep, loop = true, isPausedFn = null, mutedTracksFn = null) {
        if (this.isPlaying) return;
        if (!this.audioCtx) return;
        this.isPlaying = true;
        this.isPaused = false;

        const stepDuration = 60 / song.bpm / 4; // 16分音符
        const maxSteps = song.bars;
        const LOOKAHEAD_MS = 25;           // スケジューラ起動間隔（ゆるい）
        const SCHEDULE_AHEAD = 0.15;       // 現在時刻 +150ms 先までのノートを予約
        const INITIAL_OFFSET = 0.05;       // 初回発音までの余裕

        let scheduledStep = startStep;
        let nextStepTime = this.audioCtx.currentTime + INITIAL_OFFSET;
        let prevExternalPaused = false;    // 外部isPausedFnからの一時停止検出用

        this._scheduledSources = [];

        this.playInterval = setInterval(() => {
            if (!this.audioCtx) return;
            // AudioContextがsuspendedの場合、再開を試みてこのサイクルをスキップ
            if (this.audioCtx.state !== 'running') {
                this.audioCtx.resume().catch(() => {});
                nextStepTime = this.audioCtx.currentTime + INITIAL_OFFSET;
                return;
            }

            // 一時停止判定
            const externalPaused = (isPausedFn && isPausedFn()) || this.isPaused;
            if (externalPaused) {
                prevExternalPaused = true;
                return;
            }
            // 一時停止から復帰: nextStepTime を現在時刻基準に再同期
            if (prevExternalPaused) {
                prevExternalPaused = false;
                nextStepTime = this.audioCtx.currentTime + INITIAL_OFFSET;
                this.lastFreq = [null, null, null, null];
            }

            const muted = mutedTracksFn ? mutedTracksFn() : null;

            // 現在時刻 + SCHEDULE_AHEAD まで、まだ予約していないステップを一括予約
            while (nextStepTime < this.audioCtx.currentTime + SCHEDULE_AHEAD && this.isPlaying) {
                const step = scheduledStep;
                const t = nextStepTime;

                song.tracks.forEach((track, trackIdx) => {
                    if (muted && muted[trackIdx]) return;
                    track.notes.forEach(note => {
                        if (note.step === step) {
                            const { note: noteName, octave } = this.pitchToNote(note.pitch);
                            this.playNoteMonophonic(
                                noteName, octave,
                                stepDuration * note.length,
                                trackIdx,
                                trackTypes[trackIdx],
                                track,
                                step,
                                t
                            );
                        }
                    });
                });

                // UI更新は実発音時刻に合わせて遅延実行（音と視覚の同期）
                if (onStep) {
                    const delayMs = Math.max(0, (t - this.audioCtx.currentTime) * 1000);
                    setTimeout(() => {
                        if (this.isPlaying && !this.isPaused) onStep(step);
                    }, delayMs);
                }

                scheduledStep++;
                nextStepTime += stepDuration;

                if (scheduledStep >= maxSteps) {
                    if (loop) {
                        scheduledStep = 0;
                        this.lastFreq = [null, null, null, null];
                    } else {
                        // 最終ノート再生完了まで待ってから停止
                        const stopDelayMs = Math.max(0, (t - this.audioCtx.currentTime + stepDuration) * 1000);
                        setTimeout(() => this.stop(), stopDelayMs);
                        return;
                    }
                }
            }
        }, LOOKAHEAD_MS);
    }

    /**
     * メトロノーム用の短いクリック音を鳴らす
     * @param {boolean} accent - 小節頭のアクセント音（高め）にするか
     */
    playMetronomeClick(accent = false) {
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = accent ? 2000 : 1200;
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.getOutput());
        osc.start(now);
        osc.stop(now + 0.06);
    }

    pause() {
        this.isPlaying = false;
        this.isPaused = true;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this._cancelScheduledSources();
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this._cancelScheduledSources();
        // スライド用の直前音情報をリセット
        this.lastFreq = [null, null, null, null];
    }

    // 未来予約した音源をすべて停止し、トラック状態をリセット
    _cancelScheduledSources() {
        if (this.audioCtx) {
            const now = this.audioCtx.currentTime;
            this._scheduledSources.forEach(src => {
                try { src.stop(now); } catch (e) { }
            });
        }
        this._scheduledSources = [];
        this.activeOscillators = [null, null, null, null];
    }
}
