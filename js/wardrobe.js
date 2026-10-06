/**
 * TypePets — Pet Wardrobe
 *
 * Colors, patterns and places for the pet. What a kid has unlocked is worked out from progress
 * the app already keeps (XP, badges, Bubble Pop levels, articles, practice days, feeding), so
 * nothing extra is stored: backups, save codes and profiles can't disagree about it, and
 * players who had progress before the wardrobe existed get their unlocks right away.
 *
 * The look itself lives in `pet.look` (js/data.js). Anything in it that's unknown or not
 * unlocked is shown as the default instead.
 *
 * Needs js/data.js. Uses js/articles-data.js (ARTICLES) for article categories when the page loads it.
 */

const TypePetsWardrobe = (function() {
    'use strict';

    const SLOTS = [
        { id: 'color', label: 'Colors' },
        { id: 'pattern', label: 'Patterns' },
        { id: 'place', label: 'Places' }
    ];
    const DEFAULT_LOOK = { color: 'classic', pattern: 'none', place: 'meadow' };

    const STAGE_NAMES = { egg: 'Egg', baby: 'Baby', kid: 'Kid', teen: 'Teen', adult: 'Adult', master: 'Master' };
    const SPACE_ARTICLE_IDS = [3, 8, 13, 26]; // when js/articles-data.js isn't on the page

    function num(v) { v = Number(v); return isFinite(v) ? v : 0; }

    function rgba(hex, alpha) {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }

    // s1–s3 = body gradient (light → dark), deep = feet / spots, mouth = mouth fill.
    // ink = mouth lines on dark colors, lt = star and heart patterns on very light colors.
    function palette(s1, s2, s3, deep, mouth, extra) {
        return Object.assign({ s1, s2, s3, deep, mouth }, extra || {});
    }

    // Unlock rules: { type, ... } — see requirement() below
    const ITEMS = [
        { slot: 'color', id: 'classic', name: 'Classic' },
        { slot: 'color', id: 'bubblegum', name: 'Bubblegum', palette: palette('#fbcfe8', '#f472b6', '#db2777', '#be185d', '#831843') },
        { slot: 'color', id: 'sky', name: 'Sky', palette: palette('#bae6fd', '#38bdf8', '#0284c7', '#0369a1', '#0c4a6e') },
        { slot: 'color', id: 'mint', name: 'Mint', palette: palette('#a7f3d0', '#34d399', '#059669', '#047857', '#064e3b') },
        { slot: 'color', id: 'lemon', name: 'Lemon', palette: palette('#fef9c3', '#fde047', '#eab308', '#ca8a04', '#713f12', { lt: '#ca8a04' }) },
        { slot: 'color', id: 'grape', name: 'Grape', palette: palette('#e9d5ff', '#c084fc', '#9333ea', '#7e22ce', '#581c87') },
        { slot: 'color', id: 'tangerine', name: 'Tangerine', palette: palette('#fed7aa', '#fb923c', '#ea580c', '#c2410c', '#7c2d12') },
        { slot: 'color', id: 'cherry', name: 'Cherry', palette: palette('#fecaca', '#f87171', '#dc2626', '#b91c1c', '#7f1d1d') },
        { slot: 'color', id: 'cocoa', name: 'Cocoa', palette: palette('#e7cba9', '#c08f63', '#8b5e3c', '#6b4226', '#3f2617') },
        { slot: 'color', id: 'snow', name: 'Snow', palette: palette('#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8', '#475569', { lt: '#94a3b8' }) },
        { slot: 'color', id: 'midnight', name: 'Midnight', palette: palette('#818cf8', '#4f46e5', '#312e81', '#1e1b4b', '#c7d2fe', { ink: '#e0e7ff' }) },
        { slot: 'color', id: 'gold', name: 'Gold Sparkle', finish: true, unlock: { type: 'evo', species: 'master' },
            palette: palette('#fef9c3', '#facc15', '#ca8a04', '#a16207', '#713f12', { bg: 'linear-gradient(135deg, #fef9c3, #fde047 35%, #facc15 60%, #ca8a04)' }) },
        { slot: 'color', id: 'rainbow', name: 'Rainbow', finish: true, unlock: { type: 'days', n: 7 },
            palette: palette('#fda4af', '#fde047', '#60a5fa', '#7c3aed', '#581c87', { bg: 'linear-gradient(125deg, #f87171, #fbbf24 22%, #4ade80 42%, #38bdf8 62%, #a78bfa 80%, #f472b6)' }) },
        { slot: 'color', id: 'galaxy', name: 'Galaxy', finish: true, unlock: { type: 'wpm', n: 40, badge: 'rocket' },
            palette: palette('#a78bfa', '#6d28d9', '#4c1d95', '#2e1065', '#f0abfc', { ink: '#f5f3ff',
                bg: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95) 0 1px, transparent 1.6px) 0 0 / 13px 13px, radial-gradient(circle at 70% 60%, rgba(255, 255, 255, 0.6) 0 1px, transparent 1.6px) 0 0 / 19px 19px, linear-gradient(135deg, #6d28d9, #4c1d95 50%, #1e1b4b)' }) },

        { slot: 'pattern', id: 'none', name: 'Plain' },
        { slot: 'pattern', id: 'belly', name: 'Belly' },
        { slot: 'pattern', id: 'spots', name: 'Spots', unlock: { type: 'evo', species: 'baby' } },
        { slot: 'pattern', id: 'stripes', name: 'Stripes', unlock: { type: 'evo', species: 'kid' } },
        { slot: 'pattern', id: 'stars', name: 'Stars', unlock: { type: 'evo', species: 'teen' } },
        { slot: 'pattern', id: 'hearts', name: 'Hearts', unlock: { type: 'fed', n: 20 } },

        { slot: 'place', id: 'meadow', name: 'Meadow' },
        { slot: 'place', id: 'beach', name: 'Beach' },
        { slot: 'place', id: 'sea', name: 'Under the Sea', unlock: { type: 'bubble', level: 10 } },
        { slot: 'place', id: 'candy', name: 'Candy Land', unlock: { type: 'bubble', level: 15 } },
        { slot: 'place', id: 'space', name: 'Outer Space', unlock: { type: 'space', n: 3 } },
        { slot: 'place', id: 'night', name: 'Starry Night', unlock: { type: 'evo', species: 'adult' } }
    ];

    function find(slot, id) {
        return ITEMS.find(it => it.slot === slot && it.id === id) || null;
    }

    // ─── Places (Pet page backgrounds, drawn on a 300×280 box) ─────

    function starPoints(cx, cy, outer, inner) {
        const pts = [];
        for (let i = 0; i < 10; i++) {
            const a = (-90 + i * 36) * Math.PI / 180;
            const r = i % 2 ? inner : outer;
            pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
        }
        return pts.join(' ');
    }

    function flower(cx, cy, color, scale) {
        let out = '';
        for (let i = 0; i < 5; i++) {
            const a = (i * 72 - 90) * Math.PI / 180;
            out += `<circle cx="${(cx + Math.cos(a) * 4.6 * scale).toFixed(1)}" cy="${(cy + Math.sin(a) * 4.6 * scale).toFixed(1)}" r="${(4 * scale).toFixed(1)}" fill="${color}"/>`;
        }
        return out + `<circle cx="${cx}" cy="${cy}" r="${(3 * scale).toFixed(1)}" fill="#facc15"/>`;
    }

    // Same stars every time (a seeded sequence), so the sky doesn't reshuffle on each render
    function starfield(seed, count, maxY) {
        let s = seed;
        const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
        let out = '';
        for (let i = 0; i < count; i++) {
            const x = (next() * 300).toFixed(0), y = (next() * maxY).toFixed(0), r = (0.7 + next() * 1.1).toFixed(1);
            out += `<circle class="pet-twinkle" style="animation-delay:${(next() * 2.6).toFixed(2)}s" cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`;
        }
        return out;
    }

    function waves(y, opacity) {
        let d = `M0 ${y}`;
        for (let x = 0; x < 300; x += 20) d += ' q5 -4 10 0 t10 0';
        return `<path d="${d}" stroke="#e0f2fe" stroke-width="2" fill="none" opacity="${opacity}"/>`;
    }

    const FISH = '<ellipse rx="13" ry="7.5"/><path d="M11 0 l11 -8 v16 z"/><circle cx="-6" cy="-2" r="1.7" fill="#1e293b"/>';

    // sky = scene background (its lower 40% matches the ground), g1/g2 = the ground hill,
    // back = drawn behind the hill, front = in front of the hill but behind the pet
    const PLACES = {
        meadow: {
            sky: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 60%, #86efac 60%, #4ade80 100%)', g1: '#86efac', g2: '#4ade80',
            back: '<g fill="#fff" opacity="0.85"><ellipse cx="64" cy="54" rx="24" ry="10"/><ellipse cx="78" cy="46" rx="15" ry="11"/><ellipse cx="52" cy="48" rx="11" ry="8"/></g>' +
                '<g fill="#fff" opacity="0.7"><ellipse cx="228" cy="36" rx="18" ry="7"/><ellipse cx="238" cy="30" rx="11" ry="8"/></g>',
            front: '<path d="M40 248 v-12 M262 238 v-12 M236 266 v-10" stroke="#15803d" stroke-width="2"/>' +
                flower(40, 233, '#f472b6', 0.8) + flower(262, 223, '#ffffff', 0.8) + flower(236, 254, '#c4b5fd', 0.7)
        },
        beach: {
            sky: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 34%, #7dd3fc 43%, #38bdf8 43%, #0ea5e9 61%, #fde68a 61%, #fcd34d 100%)', g1: '#fde68a', g2: '#fbbf24',
            back: '<circle cx="244" cy="50" r="30" fill="#fde047" opacity="0.25"/><circle cx="244" cy="50" r="19" fill="#fde047"/>' +
                waves(134, 0.8) + waves(152, 0.55) +
                '<path d="M72 118 v-24 l15 22 z" fill="#fff"/><path d="M63 119 h28 l-5 7 h-18 z" fill="#f97316"/>',
            front: `<polygon points="${starPoints(54, 240, 11, 5)}" fill="#fb923c"/>` +
                '<path d="M232 256 q11 -20 22 0 z" fill="#fda4af"/><path d="M243 254 v-12 M238 255 l4 -10 M248 255 l-4 -10" stroke="#fb7185" stroke-width="1.2"/>'
        },
        sea: {
            sky: 'linear-gradient(180deg, #a5f3fc 0%, #22d3ee 28%, #0891b2 60%, #fde68a 60%, #fcd34d 100%)', g1: '#fde68a', g2: '#f59e0b',
            back: '<path d="M40 0 H72 L124 170 H66 Z" fill="#fff" opacity="0.12"/><path d="M190 0 H210 L236 170 H200 Z" fill="#fff" opacity="0.1"/>' +
                `<g transform="translate(232 72)" fill="#fb923c">${FISH}</g><g transform="translate(60 112) scale(0.7)" fill="#fde047">${FISH}</g>`,
            front: '<path d="M28 276 q-11 -20 0 -40 q11 -20 0 -42" stroke="#16a34a" stroke-width="7" fill="none" stroke-linecap="round"/>' +
                '<path d="M46 276 q9 -16 0 -30" stroke="#22c55e" stroke-width="6" fill="none" stroke-linecap="round"/>' +
                '<path d="M272 276 q10 -18 0 -36 q-10 -18 0 -34" stroke="#16a34a" stroke-width="7" fill="none" stroke-linecap="round"/>' +
                '<g fill="#f472b6"><circle cx="246" cy="258" r="9"/><circle cx="236" cy="250" r="6"/><circle cx="256" cy="248" r="6"/></g>' +
                '<g fill="rgba(255,255,255,0.35)" stroke="#fff" stroke-width="1.2"><circle class="pet-bubble" cx="82" cy="200" r="4"/>' +
                '<circle class="pet-bubble" style="animation-delay:1.3s" cx="220" cy="210" r="3"/><circle class="pet-bubble" style="animation-delay:2.6s" cx="110" cy="220" r="2.5"/></g>'
        },
        candy: {
            sky: 'linear-gradient(180deg, #fdf2f8 0%, #fce7f3 30%, #fbcfe8 60%, #a7f3d0 60%, #6ee7b7 100%)', g1: '#a7f3d0', g2: '#6ee7b7',
            back: '<g fill="#f9a8d4" opacity="0.8"><ellipse cx="70" cy="50" rx="26" ry="13"/><ellipse cx="88" cy="42" rx="16" ry="12"/></g>' +
                '<g fill="#c4b5fd" opacity="0.75"><ellipse cx="230" cy="70" rx="24" ry="11"/><ellipse cx="244" cy="62" rx="14" ry="11"/></g>',
            front: '<rect x="44" y="210" width="3.5" height="40" rx="1.7" fill="#fff"/><circle cx="45.7" cy="204" r="15" fill="#f472b6"/>' +
                '<path d="M45.7 204 m-9 0 a9 9 0 1 0 18 0 a6.5 6.5 0 1 0 -13 0 a4 4 0 1 0 8 0" stroke="#fff" stroke-width="2.5" fill="none"/>' +
                '<rect x="260" y="200" width="3.5" height="40" rx="1.7" fill="#fff"/><circle cx="261.7" cy="194" r="13" fill="#2dd4bf"/>' +
                '<path d="M261.7 194 m-8 0 a8 8 0 1 0 16 0 a5.5 5.5 0 1 0 -11 0 a3 3 0 1 0 6 0" stroke="#fff" stroke-width="2.3" fill="none"/>' +
                '<path d="M218 266 q0 -16 10 -16 q10 0 10 16 z" fill="#f87171"/><path d="M240 268 q0 -13 8 -13 q8 0 8 13 z" fill="#facc15"/>'
        },
        space: {
            sky: 'linear-gradient(180deg, #020617 0%, #1e1b4b 45%, #312e81 60%, #cbd5e1 60%, #94a3b8 100%)', g1: '#cbd5e1', g2: '#94a3b8',
            back: starfield(42, 40, 165) +
                '<g transform="rotate(-18 72 64)"><path d="M36 64 A36 9.5 0 0 1 108 64" stroke="#fde68a" stroke-width="4" fill="none"/>' +
                '<circle cx="72" cy="64" r="17" fill="#fbbf24"/><path d="M57 58 Q72 62 87 58" stroke="#f59e0b" stroke-width="3" fill="none" opacity="0.7"/>' +
                '<path d="M36 64 A36 9.5 0 0 0 108 64" stroke="#fde68a" stroke-width="4" fill="none"/></g>' +
                '<circle cx="240" cy="42" r="9" fill="#60a5fa"/><path d="M234 38 q4 -3 7 1 q-2 5 -6 3 z M242 44 q4 0 5 3 q-3 2 -6 0 z" fill="#4ade80"/>',
            front: '<g fill="#94a3b8"><ellipse cx="50" cy="240" rx="16" ry="5"/><ellipse cx="252" cy="230" rx="12" ry="4"/><ellipse cx="226" cy="262" rx="18" ry="5.5"/></g>' +
                '<g fill="#7c8aa0"><ellipse cx="50" cy="241" rx="11" ry="3"/><ellipse cx="226" cy="263" rx="12" ry="3.5"/></g>'
        },
        night: {
            sky: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 35%, #3730a3 60%, #166534 60%, #14532d 100%)', g1: '#166534', g2: '#14532d',
            back: starfield(7, 34, 160) +
                '<circle cx="236" cy="54" r="21" fill="#fef9c3"/><circle cx="229" cy="47" r="4" fill="#fde68a"/><circle cx="244" cy="62" r="5" fill="#fde68a"/><circle cx="243" cy="45" r="2.4" fill="#fde68a"/>',
            front: '<g fill="#fde047"><circle cx="48" cy="200" r="6" opacity="0.22"/><circle cx="48" cy="200" r="2"/>' +
                '<circle cx="252" cy="214" r="6" opacity="0.22"/><circle cx="252" cy="214" r="2"/><circle cx="226" cy="186" r="5" opacity="0.22"/><circle cx="226" cy="186" r="1.7"/></g>'
        }
    };

    function decorSVG(markup) {
        return `<svg viewBox="0 0 300 280" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" focusable="false">${markup}</svg>`;
    }

    function placeStyle(pl) {
        return `--sky: ${pl.sky}; --g1: ${pl.g1}; --g2: ${pl.g2};`;
    }

    /** Dress a .pet-scene for a place: background, hill colors and the two decor layers. */
    function applyPlace(sceneEl, placeId) {
        const id = PLACES[placeId] ? placeId : DEFAULT_LOOK.place;
        if (sceneEl.dataset.place === id) return;
        const pl = PLACES[id];
        sceneEl.dataset.place = id;
        sceneEl.style.setProperty('--sky', pl.sky);
        sceneEl.style.setProperty('--g1', pl.g1);
        sceneEl.style.setProperty('--g2', pl.g2);
        let back = sceneEl.querySelector(':scope > .pet-decor-back');
        let front = sceneEl.querySelector(':scope > .pet-decor-front');
        if (!back) {
            back = document.createElement('div');
            back.className = 'pet-decor pet-decor-back';
            sceneEl.insertBefore(back, sceneEl.firstChild);
        }
        if (!front) {
            front = document.createElement('div');
            front.className = 'pet-decor pet-decor-front';
            const ground = sceneEl.querySelector(':scope > .pet-ground');
            sceneEl.insertBefore(front, ground ? ground.nextSibling : back.nextSibling);
        }
        back.innerHTML = decorSVG(pl.back);
        front.innerHTML = decorSVG(pl.front);
    }

    // ─── The pet ──────────────────────────────────────────────

    /** CSS variables for a non-classic color (Classic uses each stage's colors from css/pet.css). */
    function paletteStyle(p) {
        const bg = p.bg || `linear-gradient(135deg, ${p.s1}, ${p.s2}, ${p.s3})`;
        return [
            `--skin-bg: ${bg}`,
            `--glow: ${rgba(p.s2, 0.4)}`,
            `--glow-2: ${rgba(p.s2, 0.18)}`,
            `--deep: ${p.deep}`,
            `--horn: ${p.s3}`,
            `--mouth: ${p.mouth}`,
            `--ink: ${p.ink || '#1e293b'}`,
            `--smile: ${p.ink || p.mouth}`,
            `--wing-bg: linear-gradient(135deg, ${rgba(p.s1, 0.65)}, ${rgba(p.s2, 0.25)})`,
            `--aura-bg: radial-gradient(circle, ${rgba(p.s2, 0.22)}, transparent 70%)`,
            `--patt: ${rgba(p.deep, 0.45)}`,
            `--light: ${rgba(p.lt || '#ffffff', 0.78)}`
        ].join('; ');
    }

    /**
     * The pet's markup for a stage and look. `look` should come from resolveLook().
     * expressionClass: '' | 'expression-hungry' | 'expression-sleeping'
     */
    function creatureHTML(species, look, expressionClass) {
        const color = find('color', look.color);
        const style = color && color.palette ? ` style="${paletteStyle(color.palette)}"` : '';
        const layers = (look.pattern && look.pattern !== 'none' ? `<div class="pet-pattern pattern-${look.pattern}"></div>` : '') +
            (color && color.finish ? '<div class="pet-shine"></div>' : '');
        const cls = expressionClass ? ' ' + expressionClass : '';
        const eyes = '<div class="eye left"></div><div class="eye right"></div>';
        const feet = '<div class="foot left"></div><div class="foot right"></div>';
        const body = `<div class="body">${layers}${eyes}<div class="mouth"></div></div>`;
        const wings = '<div class="wing left"></div><div class="wing right"></div>';
        const crown = '<div class="crown">👑</div>';
        switch (species) {
            case 'baby':
                return `<div class="creature-baby${cls}"${style}>${layers}${eyes}<div class="mouth"></div><div class="cheek left"></div><div class="cheek right"></div></div>`;
            case 'kid':
                return `<div class="creature-kid${cls}"${style}>${body}${feet}</div>`;
            case 'teen':
                return `<div class="creature-teen${cls}"${style}>${body}<div class="horn left"></div><div class="horn right"></div>${feet}</div>`;
            case 'adult':
                return `<div class="creature-adult${cls}"${style}>${body}${wings}${crown}${feet}</div>`;
            case 'master':
                return `<div class="creature-master${cls}"${style}><div class="aura"></div>${body}${wings}${crown}${feet}</div>`;
            default:
                return `<div class="creature-egg${cls}"${style}>${layers}<div class="crack"></div></div>`;
        }
    }

    // ─── Unlocks ──────────────────────────────────────────────

    function spaceArticleIds() {
        try {
            /* global ARTICLES */
            if (typeof ARTICLES !== 'undefined' && Array.isArray(ARTICLES) && ARTICLES.length) {
                return ARTICLES.filter(a => a.category === 'space').map(a => String(a.id));
            }
        } catch (e) { /* ignore */ }
        return SPACE_ARTICLE_IDS.map(String);
    }

    /** The progress unlocks are checked against. Read it once per render and pass it around. */
    function getProgress() {
        const pet = TypePetsData.getPet();
        const stats = TypePetsData.getStats();
        const passed = TypePetsData.getBubblePassedLevels();
        const space = new Set(spaceArticleIds());
        return {
            petName: pet.name && pet.name !== 'Unnamed' ? pet.name : 'your pet',
            species: pet.species,
            xp: num(pet.xp),
            fed: num(pet.total_fed),
            days: num(stats.practice_days),
            bestWpm: Math.floor(num(stats.best_wpm)),
            bubble: passed.length ? passed[passed.length - 1] : 0,
            spaceArticles: TypePetsData.getCompletedArticles().filter(id => space.has(String(id))).length,
            badges: new Set(TypePetsData.getAchievements().map(a => a.badge_id))
        };
    }

    function evoXp(species) {
        const t = TypePetsData.EVO_THRESHOLDS.find(e => e.species === species);
        return t ? t.xp : Infinity;
    }

    /**
     * What it takes to unlock an item:
     * { unlocked, label (short, for the tile), text (a full sentence), have, need } — have/need
     * are null when there's nothing to count.
     */
    function requirement(item, p) {
        const u = item.unlock;
        if (!u) return { unlocked: true, label: 'Free', text: 'Free for everyone', have: null, need: null };
        let have, need, unlocked, label, text;
        switch (u.type) {
            case 'evo': {
                const name = STAGE_NAMES[u.species];
                need = evoXp(u.species);
                have = p.xp;
                label = `Grow to ${name}`;
                text = `Grow into ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name} (${need.toLocaleString()} XP)`;
                break;
            }
            case 'days':
                need = u.n;
                have = p.days;
                label = `Practice ${need} days`;
                text = `Practice on ${need} different days (they don't have to be in a row)`;
                break;
            case 'fed':
                need = u.n;
                have = p.fed;
                label = `Feed ${need} times`;
                text = `Feed ${p.petName} ${need} times`;
                break;
            case 'bubble':
                need = u.level;
                have = p.bubble;
                label = `Bubble level ${need}`;
                text = `Pass level ${need} in Bubble Pop`;
                break;
            case 'space':
                need = u.n;
                have = p.spaceArticles;
                label = `${need} space articles`;
                text = `Finish ${need} space articles in Read & Type`;
                break;
            case 'wpm':
                need = u.n;
                have = p.bestWpm;
                unlocked = p.badges.has(u.badge) || have >= need;
                label = `${need} WPM`;
                text = `Type ${need} words per minute (the 🚀 Rocket badge)`;
                break;
            default:
                return { unlocked: false, label: 'Locked', text: 'Not available yet', have: null, need: null };
        }
        if (unlocked === undefined) unlocked = have >= need;
        return { unlocked, label, text, have: Math.min(have, need), need };
    }

    function isUnlocked(item, p) {
        return !!item && requirement(item, p).unlocked;
    }

    /** The look to show: the stored choice per slot, or the default if it's unknown or locked. */
    function resolveLook(pet, p) {
        const stored = (pet && pet.look) || {};
        const out = {};
        SLOTS.forEach(s => {
            const item = find(s.id, stored[s.id]);
            out[s.id] = item && isUnlocked(item, p) ? item.id : DEFAULT_LOOK[s.id];
        });
        return out;
    }

    function counts(p) {
        const all = ITEMS.filter(it => it.id !== 'none');
        return { unlocked: all.filter(it => isUnlocked(it, p)).length, total: all.length };
    }

    // ─── Thumbnails for the wardrobe tiles ───────────────────

    /** A small picture of an item, drawn on the pet's current color and stage where that matters. */
    function thumbHTML(item, species, look) {
        if (item.slot === 'color') {
            if (!item.palette) return '<span class="wd-swatch wd-swatch-classic"></span>';
            return `<span class="wd-swatch" style="${paletteStyle(item.palette)}">${item.finish ? '<span class="pet-shine"></span>' : ''}</span>`;
        }
        if (item.slot === 'pattern') {
            const color = find('color', look.color);
            const style = color && color.palette ? ` style="${paletteStyle(color.palette)}"` : '';
            const pattern = item.id !== 'none' ? `<span class="pet-pattern pattern-${item.id}"></span>` : '';
            return `<span class="wd-swatch wd-stage-${STAGE_NAMES[species] ? species : 'egg'}"${style}>${pattern}</span>`;
        }
        const pl = PLACES[item.id] || PLACES.meadow;
        return `<span class="wd-mini-scene" style="${placeStyle(pl)}"><span class="pet-decor pet-decor-back">${decorSVG(pl.back)}</span>` +
            `<span class="pet-ground"></span><span class="pet-decor pet-decor-front">${decorSVG(pl.front)}</span></span>`;
    }

    return {
        SLOTS, ITEMS, DEFAULT_LOOK,
        find, getProgress, requirement, isUnlocked, resolveLook, counts,
        creatureHTML, applyPlace, thumbHTML
    };
})();
