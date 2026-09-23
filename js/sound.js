/**
 * Sound effects using Web Audio API — no external files needed!
 * Enhanced with combo sounds, better tones, and more satisfying feedback.
 *
 * Mute is a device-level setting stored in localStorage 'typepets_sound_muted' ('1' / '0'),
 * read on construction so it sticks across pages. `window.sound.enabled` (true = sound on),
 * `muted`, `setMuted(bool)` and `toggle()` all keep it in sync.
 */
const SOUND_MUTED_KEY = 'typepets_sound_muted';

function readSoundMuted() {
    try {
        return localStorage.getItem(SOUND_MUTED_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function writeSoundMuted(muted) {
    try {
        localStorage.setItem(SOUND_MUTED_KEY, muted ? '1' : '0');
    } catch (e) {
        // storage blocked (private mode) — mute still works for this page
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = !readSoundMuted();
        this._volume = 0.6;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            try { this.ctx = new AudioCtx(); } catch (e) { this.ctx = null; }
        }
    }

    _ensureCtx() {
        if (!this.ctx) this.init();
        if (!this.ctx) return false;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
    }

    get muted() {
        return !this.enabled;
    }

    set muted(value) {
        this.setMuted(value);
    }

    isMuted() {
        return !this.enabled;
    }

    /** Mute/unmute, remember it for every page, and update the nav button. Returns `enabled`. */
    setMuted(muted) {
        this.enabled = muted === '0' || muted === 'false' ? true : !muted;
        writeSoundMuted(!this.enabled);
        if (!this.enabled && window.speech && typeof window.speech.cancel === 'function') window.speech.cancel();
        this.syncButton();
        return this.enabled;
    }

    syncButton() {
        if (typeof document === 'undefined') return;
        const btn = document.getElementById('soundToggle');
        if (btn) btn.textContent = this.enabled ? '🔊' : '🔇';
    }

    _gain(vol) {
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol * this._volume, this.ctx.currentTime);
        return g;
    }

    keyClick() {
        if (!this.enabled || !this._ensureCtx()) return;
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
        if (!this.enabled || !this._ensureCtx()) return;
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
        if (!this.enabled || !this._ensureCtx()) return;
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
        if (!this.enabled || !this._ensureCtx()) return;
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
        if (!this.enabled || !this._ensureCtx()) return;
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
        if (!this.enabled || !this._ensureCtx()) return;
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
        if (!this.enabled || !this._ensureCtx()) return;
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
        return this.setMuted(this.enabled);
    }
}

window.sound = new SoundEngine();

// Show the saved mute state on the nav button, and follow changes made in other tabs
window.sound.syncButton();
if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.sound.syncButton());
}
window.addEventListener('storage', (e) => {
    if (e.key !== SOUND_MUTED_KEY) return;
    window.sound.enabled = e.newValue !== '1';
    window.sound.syncButton();
});
