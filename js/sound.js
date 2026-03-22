/**
 * Sound effects using Web Audio API — no external files needed!
 * Enhanced with combo sounds, better tones, and more satisfying feedback.
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this._volume = 0.6;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    _ensureCtx() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    _gain(vol) {
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol * this._volume, this.ctx.currentTime);
        return g;
    }

    keyClick() {
        if (!this.enabled) return;
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.02;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3000, t);
        filter.Q.setValueAtTime(2, t);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08 * this._volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
        noise.stop(t + 0.03);
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.015);
        oscGain.gain.setValueAtTime(0.04 * this._volume, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.025);
    }

    correct() {
        if (!this.enabled) return;
        this._ensureCtx();
        const t = this.ctx.currentTime;
        [880, 1100].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.06);
            gain.gain.setValueAtTime(0, t + i * 0.06);
            gain.gain.linearRampToValueAtTime(0.12 * this._volume, t + i * 0.06 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.18);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.06);
            osc.stop(t + i * 0.06 + 0.2);
        });
    }

    wrong() {
        if (!this.enabled) return;
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.linearRampToValueAtTime(120, t + 0.12);
        gain.gain.setValueAtTime(0.06 * this._volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    combo(count) {
        if (!this.enabled) return;
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const baseFreq = 440 + Math.min(count, 20) * 30;
        const numTones = Math.min(3, Math.floor(count / 3) + 1);
        for (let i = 0; i < numTones; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq + i * 150, t + i * 0.05);
            gain.gain.setValueAtTime(0, t + i * 0.05);
            gain.gain.linearRampToValueAtTime(0.1 * this._volume, t + i * 0.05 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.15);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.05);
            osc.stop(t + i * 0.05 + 0.15);
        }
    }

    levelUp() {
        if (!this.enabled) return;
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.1);
            gain.gain.setValueAtTime(0, t + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.15 * this._volume, t + i * 0.1 + 0.02);
            gain.gain.setValueAtTime(0.15 * this._volume, t + i * 0.1 + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.35);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.1);
            osc.stop(t + i * 0.1 + 0.35);
        });
        const harmonics = [392, 523.25, 659.25, 783.99];
        harmonics.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + i * 0.1 + 0.02);
            gain.gain.setValueAtTime(0, t + i * 0.1 + 0.02);
            gain.gain.linearRampToValueAtTime(0.06 * this._volume, t + i * 0.1 + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.1 + 0.02);
            osc.stop(t + i * 0.1 + 0.3);
        });
    }

    celebration() {
        if (!this.enabled) return;
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const melody = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.50];
        melody.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + i * 0.07);
            gain.gain.setValueAtTime(0, t + i * 0.07);
            gain.gain.linearRampToValueAtTime(0.1 * this._volume, t + i * 0.07 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + i * 0.07);
            osc.stop(t + i * 0.07 + 0.25);
        });
        const chord = [523.25, 659.25, 783.99, 1046.50];
        chord.forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + 0.6);
            gain.gain.setValueAtTime(0, t + 0.6);
            gain.gain.linearRampToValueAtTime(0.08 * this._volume, t + 0.62);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + 0.6);
            osc.stop(t + 1.2);
        });
    }

    pop() {
        if (!this.enabled) return;
        this._ensureCtx();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);
        gain.gain.setValueAtTime(0.2 * this._volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
        const bufferSize = this.ctx.sampleRate * 0.03;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.12 * this._volume, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        noise.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(t);
        noise.stop(t + 0.04);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

window.sound = new SoundEngine();
