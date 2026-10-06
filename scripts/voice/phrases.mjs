#!/usr/bin/env node
/**
 * Every line the site can say out loud, grouped into voice packs. Prints JSON for build.py.
 *
 * Reads the real sources, so the recordings follow the content:
 *   - Training (pages/training.html): the STAGES list, plus the sentences speakKey() and
 *     loadStage() build from it. Those templates are mirrored below; keep them in step.
 *   - Articles (js/articles-data.js): every word, as the read-aloud button says them.
 *   - Fixed lines: string literals in say(...) calls and `intro:` options, found automatically.
 * Key and finger names come from js/speech.js and js/keyboard.js, clip keys from
 * speech.clipKey(), so the lookup at runtime always matches, and the voices from speech.voices.
 *
 * Output: { "voices": [ids], "files": { "<manifest js file>": { "<pack>": [ { "key", "script" } ] } } }
 * `script` is what the voice reads. <A> marks a letter said by its name ("ay", not "uh").
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function loadScript(rel, extra = '') {
    const window = {};
    const context = vm.createContext({ window, document: {}, navigator: {} });
    const result = vm.runInContext(read(rel) + '\n' + extra, context, { filename: rel });
    return { window, result };
}

const { speech } = loadScript('js/speech.js').window;
const keyboard = loadScript('js/keyboard.js').window;
const fingerName = ch => keyboard.VirtualKeyboard.prototype.getFingerForKey.call(null, ch).name;
const ARTICLES = loadScript('js/articles-data.js', 'ARTICLES').result;

const trainingHtml = read('pages/training.html');
const stagesSrc = trainingHtml.match(/const STAGES = (\[[\s\S]*?\n\s*\]);/);
if (!stagesSrc) throw new Error('STAGES not found in pages/training.html');
const STAGES = vm.runInNewContext(stagesSrc[1]);

/** String literals on lines that say something: say('...'), speech.say("..."), intro: '...' */
function spokenLiterals(src) {
    const out = [];
    for (const line of src.split('\n')) {
        if (!/\bsay\(|\bintro:\s/.test(line)) continue;
        for (const m of line.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) {
            const text = (m[1] ?? m[2]).replace(/\\(.)/g, '$1');
            if (/[a-z]/i.test(text)) out.push(text);
        }
    }
    return out;
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** How the voice reads a key's name: letters by name, everything else as written */
function keyScript(ch) {
    return /^[a-z]$/i.test(ch) ? `<${ch.toUpperCase()}>` : capitalize(speech.keyName(ch));
}

class Pack {
    constructor() { this.clips = new Map(); }
    add(text, script = text) {
        const key = speech.clipKey(text);
        if (key && !this.clips.has(key)) this.clips.set(key, { key, script });
    }
    toJSON() { return [...this.clips.values()]; }
}

// ─── Training: one pack per stage ─────────────────────────────

const trainingLines = spokenLiterals(trainingHtml);
const training = {};
for (const stage of STAGES) {
    const pack = new Pack();
    pack.add(`Stage ${stage.id}: ${stage.name}.`);            // loadStage() default intro
    for (const line of trainingLines) pack.add(line);

    const chars = new Set(stage.keys);
    for (const word of stage.words || []) {
        for (const ch of word) chars.add(ch);
        pack.add(`${word}.`);                                 // speakKey(), words mode
    }
    for (const ch of chars) {
        const name = speech.keyName(ch);
        const finger = fingerName(ch);
        pack.add(`${name}.`, `${keyScript(ch)}.`);           // No-look mode: the key only
        pack.add(`${name}. ${finger}.`, `${keyScript(ch)}, ${finger.toLowerCase()}.`);
    }
    training[`training-${stage.id}`] = pack;
}

// ─── Articles: one pack per article ───────────────────────────

const articleLines = spokenLiterals(read('js/articles.js'));
const articles = {};
for (const article of ARTICLES) {
    const pack = new Pack();
    for (const token of article.content.split(/\s+/)) {
        const word = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
        if (word) pack.add(token, `${word}.`);
    }
    for (const line of articleLines) pack.add(line);
    articles[`article-${article.id}`] = pack;
}

process.stdout.write(JSON.stringify({
    voices: speech.voices.map(v => v.id),
    files: {
        'js/voice-training.js': training,
        'js/voice-articles.js': articles,
    },
}, null, 1) + '\n');
