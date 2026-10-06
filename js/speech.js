/**
 * Spoken guidance — TypePets
 * Lines play from recordings that ship with the site (audio/voice/, made ahead of time with
 * natural-sounding voices by scripts/voice/build.py). A line with no recording is read by the
 * browser's built-in speechSynthesis instead, using on-device voices only. Either way no text
 * ever leaves the computer. Everything quietly no-ops when unsupported.
 *
 * Recordings come in packs (one MP3 per training stage or article and voice, listed in
 * js/voice-*.js). A page picks its pack with usePack(); say() splits a line into sentences and
 * plays the recordings back to back. If any sentence has no recording, the whole line uses the
 * device voice so one line never mixes two voices.
 *
 * Device-level preferences: localStorage 'typepets_speech' = 'on' | 'off', and
 * 'typepets_voice' = one of VOICES below (Michael until the kid picks another).
 * Until the kid picks on/off, each page decides the default (Training: on for stages 1–2).
 * Speech also stays quiet while the site sound is muted (window.sound).
 *
 * API (window.speech):
 *   supported            — false when the browser can't talk
 *   isOn(defaultOn)      — current setting (defaultOn is used until a choice is saved)
 *   setOn(bool)          — save the choice
 *   usePack(name, load)  — recordings for this page ('training-3', 'article-12'); load = fetch now
 *   voices               — [{ id, name }] of the recorded voices; build.py records each of them
 *   currentVoice()       — the chosen one ({ id, name })
 *   nextVoice()          — switch to the next voice, save it, and return it
 *   hasRecordings()      — true when this page's lines will play in the chosen recorded voice
 *                          (pages show the voice picker only then; 'speechvoicechange' fires on
 *                          window when this may have changed)
 *   say(text)            — speak now, cutting off whatever was still being said
 *   cancel()             — stop talking
 *   keyName(char)        — how to say a key out loud ("comma", "space", "A")
 *   clipKey(text)        — the lookup key of a recorded sentence (shared with the build script)
 */
(function () {
    'use strict';

    const PREF_KEY = 'typepets_speech';
    const VOICE_KEY = 'typepets_voice';

    // Kokoro voice ids (scripts/voice/build.py records each) and the names kids see. First = default.
    const VOICES = [
        { id: 'am_michael', name: 'Michael' },
        { id: 'af_heart', name: 'Hannah' },
        { id: 'af_bella', name: 'Bella' },
    ];
    const hasWindow = typeof window !== 'undefined';

    const synth = (hasWindow && window.speechSynthesis &&
        typeof window.SpeechSynthesisUtterance === 'function') ? window.speechSynthesis : null;

    const AudioCtx = hasWindow ? (window.AudioContext || window.webkitAudioContext) : null;
    const OfflineCtx = hasWindow ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;
    const canPlayClips = !!(AudioCtx && OfflineCtx && typeof fetch === 'function');

    const SENTENCE_GAP = 0.1;   // extra pause between recorded sentences, in seconds
    const LOAD_WAIT_MS = 1500;  // a line still waiting for its recording after this uses the device voice
    const WAKE_WAIT_MS = 400;   // same, for an audio output the browser won't start
    const RETRY_MS = 60000;     // a pack that failed to load is tried again after this

    let deviceVoice = null;
    let voicesKnown = false;
    let pending = null;

    let audio = null;           // AudioContext for playback, made on the first click or key press
    let packName = null;
    let recordedVoice = readVoice();
    const packs = {};           // MP3 url -> { clips, buffer, promise, waited, failedAt }
    const warned = new Set();   // lines already reported as missing a recording
    let playing = [];           // sources of the line being played
    let lineSeq = 0;            // bumped by every new line and by cancel(), so stale work can tell

    function readPref() {
        try {
            const v = localStorage.getItem(PREF_KEY);
            return v === 'on' || v === 'off' ? v : null;
        } catch (e) {
            return null;
        }
    }

    function writePref(value) {
        try {
            localStorage.setItem(PREF_KEY, value);
        } catch (e) {
            // storage blocked — the choice lasts for this page only
        }
    }

    function readVoice() {
        let id = null;
        try { id = localStorage.getItem(VOICE_KEY); } catch (e) { id = null; }
        return VOICES.some(v => v.id === id) ? id : VOICES[0].id;
    }

    function soundMuted() {
        return !!(hasWindow && window.sound && window.sound.enabled === false);
    }

    // Chrome/Safari refuse to talk before the first click or key press on the page
    function hasActivation() {
        try {
            const ua = navigator.userActivation;
            return !ua || ua.hasBeenActive;
        } catch (e) {
            return true;
        }
    }

    // ─── Device voice (fallback) ──────────────────────────────

    // Higher-quality voices some systems offer (macOS Premium/Enhanced, Windows Natural)
    const NATURAL_VOICE = /\b(premium|enhanced|natural|neural)\b/i;
    const PLEASANT_VOICE = /\b(ava|zoe|allison|samantha|susan|evan|nathan|tom|joelle|noelle|nicky|aria|jenny)\b/i;
    // Joke and robot voices on macOS, never used
    const NOVELTY_VOICE = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|eddy|flo|fred|good news|grandma|grandpa|hysterical|jester|junior|kathy|organ|ralph|reed|rocko|sandy|shelley|superstar|trinoids|whisper|wobble|zarvox)\b/i;

    function voiceScore(v) {
        let score = 0;
        if (/^en[-_]US/i.test(v.lang || '')) score += 4;
        if (NATURAL_VOICE.test(v.name || '')) score += 8;
        if (PLEASANT_VOICE.test(v.name || '')) score += 2;
        if (v.default) score += 1;
        return score;
    }

    /** Best-sounding on-device English voice; remote (cloud) voices are never used. */
    function pickVoice() {
        if (!synth) return;
        let voices = [];
        try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
        voicesKnown = voices.length > 0;
        deviceVoice = null;
        let best = -Infinity;
        for (const v of voices) {
            if (!v.localService || !/^en([-_]|$)/i.test(v.lang || '') || NOVELTY_VOICE.test(v.name || '')) continue;
            const score = voiceScore(v);
            if (score > best) { best = score; deviceVoice = v; }
        }
    }

    function speakSynth(text, opts) {
        if (!synth) return false;
        if (voicesKnown && !deviceVoice) return false; // no on-device English voice
        try {
            if (synth.speaking || synth.pending) synth.cancel();
            const u = new SpeechSynthesisUtterance(String(text));
            if (deviceVoice) {
                u.voice = deviceVoice;
                u.lang = deviceVoice.lang;
            }
            u.rate = (opts && opts.rate) || 1;
            u.pitch = 1.1;
            u.volume = 1;
            synth.speak(u);
            return true;
        } catch (e) {
            return false;
        }
    }

    // ─── Recorded voice ───────────────────────────────────────

    /** Lowercase, single spaces, no punctuation at either end: "A. Left Pinky." → "a. left pinky" */
    function clipKey(text) {
        return String(text).toLowerCase().replace(/\s+/g, ' ')
            .replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');
    }

    /** "Stage 1: Home Row. A. Left Pinky." → ["Stage 1: Home Row.", "A.", "Left Pinky."] ("2.3" stays whole) */
    function sentences(text) {
        const t = String(text).trim();
        const out = [];
        const re = /[.!?]+\s+/g;
        let last = 0;
        let m;
        while ((m = re.exec(t))) {
            out.push(t.slice(last, m.index + m[0].trimEnd().length));
            last = m.index + m[0].length;
        }
        if (last < t.length) out.push(t.slice(last));
        return out;
    }

    function packInfo(name) {
        const all = hasWindow && window.VOICE_PACKS;
        return name && all && Object.prototype.hasOwnProperty.call(all, name) ? all[name] : null;
    }

    /** The chosen voice's recording of a pack ({ src, at }), if it has one */
    function recordingOf(name) {
        const info = packInfo(name);
        const rec = info && info.voices && info.voices[recordedVoice];
        return rec && typeof rec.src === 'string' ? rec : null;
    }

    /** clip key -> [start ms, length ms]; null if the pack list is malformed */
    function clipTable(keys, at) {
        if (!Array.isArray(keys) || !Array.isArray(at) || at.length !== keys.length * 2) return null;
        const table = Object.create(null);
        keys.forEach((key, i) => { table[key] = [at[2 * i], at[2 * i + 1]]; });
        return table;
    }

    function voiceChanged() {
        try {
            window.dispatchEvent(new Event('speechvoicechange'));
        } catch (e) { /* very old browser: buttons update on the next page action */ }
    }

    /** [start, length] in ms for each recording, joining sentences recorded as one; null if any is missing */
    function planClips(clips, text) {
        const parts = sentences(text);
        const plan = [];
        for (let i = 0; i < parts.length;) {
            let j = parts.length;
            let hit = null;
            for (; j > i; j--) {
                const key = clipKey(parts.slice(i, j).join(' '));
                if (key && Object.prototype.hasOwnProperty.call(clips, key)) { hit = clips[key]; break; }
            }
            if (!hit) return null;
            plan.push(hit);
            i = j;
        }
        return plan.length ? plan : null;
    }

    function decode(data) {
        return new Promise((resolve, reject) => {
            let off;
            try {
                off = new OfflineCtx(1, 1, 24000);
            } catch (e) {
                off = new OfflineCtx(1, 1, 44100); // Safari before 14.1 only takes 44.1 kHz and up
            }
            const ret = off.decodeAudioData(data, resolve, reject);
            if (ret && typeof ret.catch === 'function') ret.catch(reject);
        });
    }

    /** Recently failed packs don't count: their lines use the device voice until the retry */
    function failed(pack) {
        return !!(pack && pack.failedAt && Date.now() - pack.failedAt < RETRY_MS);
    }

    function loadPack(name) {
        const rec = recordingOf(name);
        if (!rec || !canPlayClips) return null;
        const id = rec.src;
        let pack = packs[id];
        if (pack && pack.failedAt && !failed(pack)) pack = null; // time to try again
        if (!pack) {
            const clips = clipTable(packInfo(name).keys, rec.at);
            if (!clips) {
                if (!warned.has(id)) console.warn('[speech] Voice pack list is malformed; using the device voice:', name);
                warned.add(id);
                return null;
            }
            pack = packs[id] = { clips, buffer: null, promise: null, waited: false, failedAt: 0 };
            pack.promise = fetch(rec.src)
                .then(r => {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.arrayBuffer();
                })
                .then(decode)
                .then(buffer => { pack.buffer = buffer; })
                .catch(err => {
                    // Offline, blocked or broken: the device voice takes over until a retry
                    pack.failedAt = Date.now();
                    console.warn('[speech] Could not load voice recordings; using the device voice:', rec.src, err);
                    voiceChanged();
                });
        }
        return pack;
    }

    /** Make or wake the audio output; must first run inside a click or key press for Safari */
    function unlockAudio() {
        if (!canPlayClips) return null;
        try {
            if (!audio) audio = new AudioCtx();
            if (audio.state !== 'running' && audio.resume) {
                const r = audio.resume();
                if (r && typeof r.catch === 'function') r.catch(() => {});
            }
        } catch (e) {
            audio = null;
        }
        return audio;
    }

    function stopClips() {
        const list = playing;
        playing = [];
        for (const src of list) {
            try { src.stop(); } catch (e) { /* already stopped */ }
        }
    }

    function schedule(plan, buffer) {
        let t = audio.currentTime + 0.02;
        for (const [startMs, lengthMs] of plan) {
            const src = audio.createBufferSource();
            src.buffer = buffer;
            src.connect(audio.destination);
            src.start(t, startMs / 1000, lengthMs / 1000);
            playing.push(src);
            t += lengthMs / 1000 + SENTENCE_GAP;
        }
    }

    /** Play the line from the pack, or hand it to the device voice */
    function playLine(line, pack) {
        const plan = planClips(pack.clips, line.text);
        if (!plan) {
            const t = String(line.text);
            if (!warned.has(t)) console.warn('[speech] No recording for this line (re-run scripts/voice/build.py):', t);
            warned.add(t);
        }
        if (!plan || !unlockAudio()) return speakSynth(line.text, line.opts);
        if (audio.state === 'running') {
            schedule(plan, pack.buffer);
            return true;
        }
        // The output is still waking up (or the browser won't let it): wait briefly, never queue a stale line
        let settled = false;
        const giveUp = setTimeout(() => {
            if (settled || line.seq !== lineSeq) return;
            settled = true;
            speakSynth(line.text, line.opts);
        }, WAKE_WAIT_MS);
        const wake = audio.resume ? audio.resume() : null;
        if (wake && typeof wake.then === 'function') {
            wake.then(() => {
                if (settled || line.seq !== lineSeq || audio.state !== 'running') return;
                settled = true;
                clearTimeout(giveUp);
                schedule(plan, pack.buffer);
            }, () => {});
        }
        return true;
    }

    function speakNow(text, opts) {
        if (typeof document !== 'undefined' && document.hidden) return false;
        // Never build a backlog: a new line always replaces the old one
        stopAll();
        const line = { text, opts, seq: ++lineSeq };
        const pack = packName ? loadPack(packName) : null;
        // No recordings, or they failed, or a line already waited for them: the device voice,
        // right now (iPad Safari only lets it start inside the key press or click)
        if (!pack || failed(pack) || (!pack.buffer && pack.waited)) return speakSynth(text, opts);
        unlockAudio(); // while still inside the click or key press that asked to talk, if there was one
        if (pack.buffer) return playLine(line, pack);

        // Recording still downloading: the first line waits for it rather than switch voices
        pack.waited = true;
        let settled = false;
        const giveUp = setTimeout(() => {
            if (settled || line.seq !== lineSeq) return;
            settled = true;
            speakSynth(text, opts);
        }, LOAD_WAIT_MS);
        pack.promise.then(() => {
            if (settled || line.seq !== lineSeq) return;
            settled = true;
            clearTimeout(giveUp);
            if (pack.buffer) playLine(line, pack);
            else speakSynth(text, opts);
        });
        return true;
    }

    /** speakNow(), but a broken recording never throws into the typing code that asked */
    function talk(text, opts) {
        try {
            return speakNow(text, opts);
        } catch (e) {
            console.warn('[speech] Could not play the recording; using the device voice:', e);
            return speakSynth(text, opts);
        }
    }

    /** Keep only the current page's recordings, in the current voice, in memory */
    function dropOtherPacks() {
        const rec = packName ? recordingOf(packName) : null;
        for (const id of Object.keys(packs)) {
            if (!rec || id !== rec.src) delete packs[id];
        }
    }

    function stopAll() {
        lineSeq++;
        stopClips();
        if (synth) {
            try {
                if (synth.speaking || synth.pending) synth.cancel();
            } catch (e) { /* ignore */ }
        }
    }

    // ─── Setup ────────────────────────────────────────────────

    if (synth) {
        pickVoice();
        if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', pickVoice);
        else if ('onvoiceschanged' in synth) synth.onvoiceschanged = pickVoice;
    }

    if ((synth || canPlayClips) && typeof document !== 'undefined') {
        // Something asked to talk before the page was clicked — say it on the first interaction,
        // unless the page says something newer first.
        const onInteract = () => {
            if (audio || (pending && packName)) unlockAudio();
            if (!pending) return;
            const p = pending;
            setTimeout(() => {
                if (pending !== p) return;
                pending = null;
                talk(p.text, p.opts);
            }, 0);
        };
        window.addEventListener('click', onInteract, true);
        window.addEventListener('keydown', onInteract, true);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopAll();
        });
    }

    const KEY_NAMES = {
        ' ': 'space', '\n': 'enter', ',': 'comma', '.': 'period', '/': 'slash', ';': 'semicolon',
        "'": 'quote', '"': 'double quote', '-': 'dash', '=': 'equals', '[': 'left bracket',
        ']': 'right bracket', '\\': 'backslash', '`': 'backtick', '!': 'exclamation mark',
        '?': 'question mark', ':': 'colon', '%': 'percent',
    };

    window.speech = {
        supported: !!(synth || canPlayClips),

        isOn(defaultOn) {
            if (!this.supported) return false;
            const pref = readPref();
            return pref === null ? !!defaultOn : pref === 'on';
        },

        hasPreference() {
            return readPref() !== null;
        },

        setOn(on) {
            writePref(on ? 'on' : 'off');
            if (!on) this.cancel();
        },

        usePack(name, load) {
            packName = packInfo(name) ? name : null;
            dropOtherPacks();
            if (packName && load) loadPack(packName);
        },

        hasRecordings() {
            if (!canPlayClips || !packName || !recordingOf(packName)) return false;
            return !failed(packs[recordingOf(packName).src]);
        },

        voices: VOICES.map(v => ({ id: v.id, name: v.name })),

        currentVoice() {
            const v = VOICES.find(x => x.id === recordedVoice) || VOICES[0];
            return { id: v.id, name: v.name };
        },

        nextVoice() {
            const i = VOICES.findIndex(v => v.id === recordedVoice);
            recordedVoice = VOICES[(i + 1) % VOICES.length].id;
            try {
                localStorage.setItem(VOICE_KEY, recordedVoice);
            } catch (e) {
                // storage blocked — the choice lasts for this page only
            }
            this.cancel();
            dropOtherPacks();
            if (packName) loadPack(packName);
            voiceChanged();
            return this.currentVoice();
        },

        say(text, opts) {
            if (!this.supported || !text || soundMuted()) return false;
            if (!hasActivation()) {
                pending = { text, opts };
                return false;
            }
            pending = null;
            return talk(text, opts);
        },

        cancel() {
            pending = null;
            stopAll();
        },

        keyName(ch) {
            if (Object.prototype.hasOwnProperty.call(KEY_NAMES, ch)) return KEY_NAMES[ch];
            if (/^[a-z]$/i.test(ch)) return ch.toUpperCase();
            return String(ch);
        },

        clipKey,
    };
})();
