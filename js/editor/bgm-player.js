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

        // キーボードプレビュー用
        this.currentKeyOsc = null;
        this.currentKeyGain = null;

        // 音階定義（5オクターブ = C1-B5）
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
        return this.audioCtx;
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

        // ゲームエンジンのBGMコンテキストもクリア
        if (typeof GameEngine !== 'undefined' && GameEngine.bgmAudioCtx) {
            try { GameEngine.bgmAudioCtx.close(); } catch (e) { }
            GameEngine.bgmAudioCtx = null;
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
        // C1 = 0, B5 = 59
        const noteIdx = this.noteNames.indexOf(note);
        return (octave - 1) * 12 + noteIdx;
    }

    pitchToNote(pitch) {
        const octave = Math.floor(pitch / 12) + 1;
        const noteIdx = pitch % 12;
        return { note: this.noteNames[noteIdx], octave };
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
        panner.connect(this.audioCtx.destination);

        const freq = this.getFrequency(note, octave);
        const osc = this.audioCtx.createOscillator();
        let volumeScale = 1.0;

        // 波形タイプ
        if (trackType === 'square') {
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
            else if (tone === 2) { osc.type = 'sawtooth'; volumeScale = 0.6; }
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
        const isShort = (tone === 1 || tone === 4);
        const isFadeIn = (tone === 2 || tone === 5);
        const t = this.audioCtx.currentTime;

        if (isShort) {
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.5);
        } else if (isFadeIn) {
            gain.gain.setValueAtTime(0.01, t);
            gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.7);
            gain.gain.setValueAtTime(volume, t + duration * 0.9);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        } else {
            gain.gain.setValueAtTime(volume, t);
            const sustainTime = duration * 0.8;
            gain.gain.setValueAtTime(volume, t + sustainTime);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        }

        osc.connect(gain);
        osc.start();
        osc.stop(t + duration);
    }

    /**
     * 再生ループ用モノフォニック発音（トラックごとに同時発音1に制限）
     */
    playNoteMonophonic(note, octave, duration, trackIdx, trackType, track) {
        if (!this.audioCtx) return;
        const tone = track.tone || 0;

        // 前の音を停止
        if (this.activeOscillators[trackIdx]) {
            try { this.activeOscillators[trackIdx].osc.stop(); } catch (e) { }
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
            else if (tone === 2) { osc.type = 'sawtooth'; volumeScale = 0.6; }
        }

        osc.frequency.value = freq;

        // tone別の基本音量
        let baseVol;
        if (trackType === 'square') {
            switch (tone) {
                case 0: baseVol = 0.12; break;
                case 1: baseVol = 0.15; break;
                case 2: baseVol = 0.15; break;
                case 3: baseVol = 0.25; break;
                case 4: baseVol = 0.35; break;
                case 5: baseVol = 0.3; break;
                case 6: baseVol = 0.05; break;
                default: baseVol = 0.12; break;
            }
        } else {
            baseVol = 0.2;
        }
        const volume = baseVol * track.volume * volumeScale;
        const t = this.audioCtx.currentTime;

        // エンベロープ設定
        const isShort = (tone === 1 || tone === 4);
        const isFadeIn = (tone === 2 || tone === 5);

        if (isShort) {
            gain.gain.setValueAtTime(volume, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration * 0.5);
        } else if (isFadeIn) {
            gain.gain.setValueAtTime(0.01, t);
            gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.7);
            gain.gain.setValueAtTime(volume, t + duration * 0.9);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        } else {
            gain.gain.setValueAtTime(volume, t);
            gain.gain.setValueAtTime(volume, t + duration - 0.05);
            gain.gain.linearRampToValueAtTime(0.01, t + duration);
        }

        osc.connect(gain);
        osc.start();
        osc.stop(t + duration + 0.05);

        this.activeOscillators[trackIdx] = { osc, gain };

        // 停止後にクリア
        setTimeout(() => {
            if (this.activeOscillators[trackIdx] && this.activeOscillators[trackIdx].osc === osc) {
                this.activeOscillators[trackIdx] = null;
            }
        }, duration * 1000);
    }

    // ========== Kickトーン（短くピッチ下降する音） ==========
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
        const t = this.audioCtx.currentTime;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.25, t + duration);
        gain.gain.setValueAtTime(0.5 * volume, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(gain);
        osc.start();
        osc.stop(t + duration);
    }

    // ========== トレモロ（1オクターブ上と交互に高速切替） ==========
    playTremolo(note, octave, volume, pan, duration) {
        if (!this.audioCtx) return;
        const freq1 = this.getFrequency(note, octave);
        const freq2 = freq1 * 2;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner);
        panner.connect(this.audioCtx.destination);

        osc.type = 'square';
        const tremoloRate = 30;
        const numCycles = Math.ceil(duration * tremoloRate);
        const cycleTime = 1 / tremoloRate;
        const t = this.audioCtx.currentTime;

        for (let i = 0; i < numCycles; i++) {
            osc.frequency.setValueAtTime(i % 2 === 0 ? freq1 : freq2, t + i * cycleTime);
        }

        gain.gain.setValueAtTime(0.05 * volume, t);
        const sustainTime = duration * 0.8;
        gain.gain.setValueAtTime(0.05 * volume, t + sustainTime);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(gain);
        osc.start();
        osc.stop(t + duration);
    }

    // ========== Noise (ピッチ) - 音程対応の持続ノイズ ==========
    playPitchedNoise(pitch, duration, volume = 1.0, pan = 0.0) {
        if (!this.audioCtx) return null;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;

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
        panner.connect(ctx.destination);

        noise.start(t);
        noise.stop(t + bufferDuration);

        return { noise, gain };
    }

    // ========== NES APU風ドラムキット ==========
    playDrum(pitch, duration, volume = 1.0, pan = 0.0, tone = 0) {
        if (!this.audioCtx) return null;
        const ctx = this.audioCtx;
        const t = ctx.currentTime;
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
            default:
                filterType = 'bandpass'; filterFreq = 3000; filterQ = 0.8;
                drumVol = 0.3 * volume;
                isRoll = (duration > 0.15);
                decayTime = isRoll ? duration : 0.15;
                useShortNoise = false; pitchEnvDown = false;
                attackTime = 0.005; holdTime = 0.00; break;
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
        panner.connect(ctx.destination);

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
            panner.connect(this.audioCtx.destination);

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
        panner.connect(this.audioCtx.destination);

        let volumeScale = 1.0;
        if (trackType === 'square') {
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
            else if (tone === 2) { osc.type = 'sawtooth'; volumeScale = 0.6; }
        }

        osc.frequency.value = freq;
        let baseVol = (trackType === 'square') ? 0.12 : 0.2;
        if (trackType === 'square') {
            switch (tone) {
                case 0: baseVol = 0.12; break;
                case 1: baseVol = 0.15; break;
                case 2: baseVol = 0.15; break;
                case 3: baseVol = 0.25; break;
                case 4: baseVol = 0.35; break;
                case 5: baseVol = 0.3; break;
                case 6: baseVol = 0.05; break;
            }
        }
        if (trackType === 'triangle' && tone === 2) volumeScale = 0.6;
        gain.gain.value = baseVol * track.volume * volumeScale;

        osc.connect(gain);
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
     * 再生を開始する
     * @param {Object} song - getCurrentSong() で取得したソングデータ
     * @param {string[]} trackTypes - トラックの波形タイプ配列
     * @param {number} startStep - 開始ステップ（一時停止後は resume から渡す）
     * @param {Function} onStep - ステップ更新コールバック (step) => void
     */
    play(song, trackTypes, startStep, onStep) {
        if (this.isPlaying) return;
        this.isPlaying = true;

        const stepDuration = 60 / song.bpm / 4; // 16分音符
        let step = startStep;
        const maxSteps = song.bars;
        this.isPaused = false;

        this.playInterval = setInterval(() => {
            song.tracks.forEach((track, trackIdx) => {
                track.notes.forEach(note => {
                    if (note.step === step) {
                        const { note: noteName, octave } = this.pitchToNote(note.pitch);
                        this.playNoteMonophonic(
                            noteName, octave,
                            stepDuration * note.length,
                            trackIdx,
                            trackTypes[trackIdx],
                            track
                        );
                    }
                });
            });

            if (onStep) onStep(step);

            step++;
            if (step >= maxSteps) step = 0;
        }, stepDuration * 1000);
    }

    pause() {
        this.isPlaying = false;
        this.isPaused = true;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }
}
