/**
 * Spoken guidance — TypePets
 * Talks through the browser's built-in speechSynthesis. Only on-device voices are used,
 * so no text ever leaves the computer. Everything quietly no-ops when unsupported.
 *
 * Device-level preference: localStorage 'typepets_speech' = 'on' | 'off'.
 * Until the kid picks, each page decides the default (Training: on for stages 1–2).
 * Speech also stays quiet while the site sound is muted (window.sound).
 *
 * API (window.speech):
 *   supported            — false when the browser can't talk
 *   isOn(defaultOn)      — current setting (defaultOn is used until a choice is saved)
 *   setOn(bool)          — save the choice
 *   say(text)            — speak now, cutting off whatever was still being said
 *   cancel()             — stop talking
 *   keyName(char)        — how to say a key out loud ("comma", "space", "A")
 */
(function () {
    'use strict';

    const PREF_KEY = 'typepets_speech';

    const synth = (typeof window !== 'undefined' && window.speechSynthesis &&
        typeof window.SpeechSynthesisUtterance === 'function') ? window.speechSynthesis : null;

    let voice = null;
    let voicesKnown = false;
    let pending = null;

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

    /** Prefer an on-device US English voice; remote (cloud) voices are never used. */
    function pickVoice() {
        if (!synth) return;
        let voices = [];
        try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
        voicesKnown = voices.length > 0;
        const english = voices.filter(v => v.localService && /^en([-_]|$)/i.test(v.lang || ''));
        const us = english.filter(v => /^en[-_]US/i.test(v.lang || ''));
        voice = us.find(v => v.default) || english.find(v => v.default) || us[0] || english[0] || null;
    }

    function soundMuted() {
        return !!(window.sound && window.sound.enabled === false);
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

    function speakNow(text, opts) {
        if (!synth) return false;
        if (voicesKnown && !voice) return false; // no on-device English voice
        if (typeof document !== 'undefined' && document.hidden) return false;
        try {
            // Never build a backlog: a new line always replaces the old one
            if (synth.speaking || synth.pending) synth.cancel();
            const u = new SpeechSynthesisUtterance(String(text));
            if (voice) {
                u.voice = voice;
                u.lang = voice.lang;
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

    if (synth) {
        pickVoice();
        if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', pickVoice);
        else if ('onvoiceschanged' in synth) synth.onvoiceschanged = pickVoice;

        // Something asked to talk before the page was clicked — say it on the first interaction,
        // unless the page says something newer first.
        const flush = () => {
            if (!pending) return;
            const p = pending;
            setTimeout(() => {
                if (pending !== p) return;
                pending = null;
                speakNow(p.text, p.opts);
            }, 0);
        };
        window.addEventListener('click', flush, true);
        window.addEventListener('keydown', flush, true);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                try { synth.cancel(); } catch (e) { /* ignore */ }
            }
        });
    }

    const KEY_NAMES = {
        ' ': 'space', '\n': 'enter', ',': 'comma', '.': 'period', '/': 'slash', ';': 'semicolon',
        "'": 'quote', '"': 'double quote', '-': 'dash', '=': 'equals', '[': 'left bracket',
        ']': 'right bracket', '\\': 'backslash', '`': 'backtick', '!': 'exclamation mark',
        '?': 'question mark', ':': 'colon', '%': 'percent',
    };

    window.speech = {
        supported: !!synth,

        isOn(defaultOn) {
            if (!synth) return false;
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

        say(text, opts) {
            if (!synth || !text || soundMuted()) return false;
            if (!hasActivation()) {
                pending = { text, opts };
                return false;
            }
            pending = null;
            return speakNow(text, opts);
        },

        cancel() {
            pending = null;
            if (!synth) return;
            try { synth.cancel(); } catch (e) { /* ignore */ }
        },

        keyName(ch) {
            if (Object.prototype.hasOwnProperty.call(KEY_NAMES, ch)) return KEY_NAMES[ch];
            if (/^[a-z]$/i.test(ch)) return ch.toUpperCase();
            return String(ch);
        },
    };
})();
