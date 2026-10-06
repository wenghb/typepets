/**
 * TypePets — Pet Wardrobe
 *
 * Colors, patterns, hats, glasses, neck things and places for the pet. What a kid has unlocked
 * is worked out from progress the app already keeps (XP, badges, Bubble Pop, training, articles,
 * practice days, daily goals, feeding), so nothing extra is stored: backups, save codes and
 * profiles can't disagree about it, and players who had progress before the wardrobe existed
 * get their unlocks right away.
 *
 * The look lives in `pet.look` and NEW markers in `pet.seen_items` (js/data.js). Anything in the
 * look that's unknown or not unlocked is shown as the default instead.
 *
 * On pages that load this file, achievements.js calls announceNewUnlocks() after each practice,
 * which pops up "New for Pip: …" for anything that practice unlocked.
 *
 * Needs js/data.js. Uses js/articles-data.js (ARTICLES) for article categories when the page loads it.
 */

const TypePetsWardrobe = (function() {
    'use strict';

    const SLOTS = [
        { id: 'color', label: 'Colors' },
        { id: 'pattern', label: 'Patterns' },
        { id: 'hat', label: 'Hats' },
        { id: 'face', label: 'Glasses' },
        { id: 'neck', label: 'Neck' },
        { id: 'place', label: 'Places' }
    ];
    const DEFAULT_LOOK = { color: 'classic', pattern: 'none', hat: 'none', face: 'none', neck: 'none', place: 'meadow' };

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

    // ─── Worn items ───────────────────────────────────────────
    // Hats: viewBox 100×80 with the brim's bottom near y=78. Glasses: 100×36 with the eyes at
    // x=28 / x=72, y=18. Neck things: 100×40, centred.
    const HAT_BOX = '0 0 100 80', FACE_BOX = '0 0 100 36', NECK_BOX = '0 0 100 40';
    function svg(box, body) {
        return `<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
    }
    let beanieRibs = '';
    for (let x = 20; x <= 80; x += 7.5) beanieRibs += `<path d="M${x} 63 v12" stroke="#115e59" stroke-width="2.4" stroke-linecap="round"/>`;
    const ART = {
        party: svg(HAT_BOX, '<path d="M50 12 L74 74 Q50 80 26 74 Z" fill="#f472b6"/><path d="M50 12 L74 74 Q63 77.5 52 78 Z" fill="#000" opacity="0.07"/>' +
            '<circle cx="48" cy="33" r="3.2" fill="#fde047"/><circle cx="56" cy="47" r="3.2" fill="#60a5fa"/><circle cx="42" cy="55" r="3.2" fill="#fde047"/>' +
            '<circle cx="60" cy="63" r="3" fill="#a7f3d0"/><circle cx="46" cy="68" r="2.6" fill="#60a5fa"/>' +
            '<path d="M25 73 Q50 80 75 73 L76 78 Q50 85 24 78 Z" fill="#fde047"/><circle cx="50" cy="11" r="7.5" fill="#fde047"/><circle cx="47.5" cy="8.5" r="2.4" fill="#fef9c3"/>'),
        // A keycap with the home-row bump, as worn by Home Row Heroes
        keycap: svg(HAT_BOX, '<path d="M7 78 L15 25 Q16 15 27 15 L73 15 Q84 15 85 25 L93 78 Z" fill="#cbd5e1"/><path d="M7 78 L15 25 Q16 15 27 15 L32 15 L22 78 Z" fill="#fff" opacity="0.3"/>' +
            '<rect x="18" y="3" width="64" height="56" rx="12" fill="#f8fafc" stroke="#94a3b8" stroke-width="2.5"/>' +
            '<text x="50" y="41" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="600" font-size="31" fill="#475569">J</text>' +
            '<rect x="41" y="47" width="18" height="4" rx="2" fill="#94a3b8"/>'),
        beanie: svg(HAT_BOX, '<path d="M15 68 Q15 20 50 20 Q85 20 85 68 Z" fill="#2dd4bf"/>' +
            '<path d="M31 31 Q35 50 33 64 M50 23 L50 64 M69 31 Q65 50 67 64" stroke="#14b8a6" stroke-width="3" fill="none" stroke-linecap="round"/>' +
            '<rect x="11" y="60" width="78" height="18" rx="8" fill="#0f766e"/>' + beanieRibs +
            '<circle cx="50" cy="15" r="10" fill="#f1f5f9"/><circle cx="46" cy="12" r="3" fill="#fff"/>'),
        flowers: svg(HAT_BOX, '<path d="M10 72 Q50 56 90 72" stroke="#16a34a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
            '<ellipse cx="26" cy="66" rx="6" ry="3" fill="#22c55e" transform="rotate(-30 26 66)"/><ellipse cx="58" cy="62" rx="6" ry="3" fill="#22c55e" transform="rotate(20 58 62)"/>' +
            '<ellipse cx="74" cy="67" rx="6" ry="3" fill="#22c55e" transform="rotate(35 74 67)"/>' +
            flower(16, 70, '#f9a8d4', 1.05) + flower(33, 64, '#ffffff', 1.1) + flower(50, 61, '#c4b5fd', 1.25) + flower(67, 64, '#fdba74', 1.1) + flower(84, 70, '#f9a8d4', 1.05)),
        wizard: svg(HAT_BOX, '<path d="M23 70 Q38 44 44 26 Q49 10 68 3 Q59 17 61 31 Q64 52 77 70 Z" fill="#7c3aed"/><path d="M61 31 Q64 52 77 70 L66 70 Q58 50 57 30 Z" fill="#000" opacity="0.1"/>' +
            '<ellipse cx="50" cy="72" rx="45" ry="7.5" fill="#5b21b6"/><path d="M27 63 Q50 69 73 63 L75 68 Q50 75 25 68 Z" fill="#fbbf24"/>' +
            `<polygon points="${starPoints(46, 47, 5.5, 2.4)}" fill="#fde047"/><polygon points="${starPoints(57, 30, 4, 1.8)}" fill="#fde047"/><circle cx="38" cy="58" r="1.6" fill="#fde047"/>`),
        crown: svg(HAT_BOX, '<path d="M14 76 L17 30 L34 50 L50 17 L66 50 L83 30 L86 76 Z" fill="#fbbf24" stroke="#d97706" stroke-width="3" stroke-linejoin="round"/>' +
            '<rect x="15" y="61" width="70" height="15" rx="3" fill="#f59e0b"/><circle cx="50" cy="68.5" r="5" fill="#ef4444"/><circle cx="31" cy="68.5" r="4" fill="#3b82f6"/><circle cx="69" cy="68.5" r="4" fill="#22c55e"/>' +
            '<circle cx="17" cy="28" r="4.5" fill="#fde68a"/><circle cx="50" cy="15" r="5" fill="#fde68a"/><circle cx="83" cy="28" r="4.5" fill="#fde68a"/>'),
        gradcap: svg(HAT_BOX, '<path d="M27 50 L27 70 Q50 80 73 70 L73 50 Z" fill="#334155"/><path d="M50 28 L97 43 L50 58 L3 43 Z" fill="#1e293b"/><path d="M50 28 L97 43 L50 48 Z" fill="#fff" opacity="0.06"/>' +
            '<circle cx="50" cy="43" r="3" fill="#fbbf24"/><path d="M50 43 L84 49 L84 64" stroke="#fbbf24" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M80 62 L88 62 L90.5 76 L77.5 76 Z" fill="#fbbf24"/>'),
        round: svg(FACE_BOX, '<circle cx="28" cy="18" r="14" fill="rgba(255,255,255,0.18)" stroke="#334155" stroke-width="3.5"/><circle cx="72" cy="18" r="14" fill="rgba(255,255,255,0.18)" stroke="#334155" stroke-width="3.5"/>' +
            '<path d="M42 17 Q50 11 58 17" stroke="#334155" stroke-width="3.5" fill="none"/><path d="M14 15 L3 12 M86 15 L97 12" stroke="#334155" stroke-width="3" stroke-linecap="round"/>'),
        shades: svg(FACE_BOX, '<path d="M9 7 H47 Q47 31 29 31 Q10 31 9 7 Z" fill="#0f172a"/><path d="M53 7 H91 Q90 31 71 31 Q53 31 53 7 Z" fill="#0f172a"/><rect x="4" y="4" width="92" height="5.5" rx="2.75" fill="#0f172a"/>' +
            '<path d="M21 12 L15 22 M27 12 L24 17 M65 12 L59 22 M71 12 L68 17" stroke="#fff" stroke-width="2.6" fill="none" opacity="0.5" stroke-linecap="round"/>'),
        starglasses: svg(FACE_BOX, `<polygon points="${starPoints(28, 19, 18, 8.5)}" fill="rgba(244,114,182,0.55)" stroke="#db2777" stroke-width="3" stroke-linejoin="round"/>` +
            `<polygon points="${starPoints(72, 19, 18, 8.5)}" fill="rgba(244,114,182,0.55)" stroke="#db2777" stroke-width="3" stroke-linejoin="round"/>` +
            '<path d="M44 17 Q50 13 56 17" stroke="#db2777" stroke-width="3" fill="none"/>'),
        bell: svg(NECK_BOX, '<path d="M6 9 Q50 30 94 9" stroke="#ef4444" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="50" cy="28" r="9" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>' +
            '<path d="M43.5 28 H56.5" stroke="#92400e" stroke-width="2"/><circle cx="50" cy="32.5" r="1.8" fill="#92400e"/><circle cx="46.5" cy="24.5" r="2" fill="#fef3c7"/>'),
        bowtie: svg(NECK_BOX, '<path d="M50 20 L23 7 Q16 20 23 33 Z" fill="#e11d48"/><path d="M50 20 L77 7 Q84 20 77 33 Z" fill="#e11d48"/>' +
            '<g fill="#fff" opacity="0.75"><circle cx="31" cy="16" r="2.2"/><circle cx="28" cy="25" r="2.2"/><circle cx="69" cy="16" r="2.2"/><circle cx="72" cy="25" r="2.2"/></g>' +
            '<rect x="43.5" y="12.5" width="13" height="15" rx="4.5" fill="#be123c"/>'),
        bandana: svg(NECK_BOX, '<path d="M8 7 Q50 22 92 7 L50 39 Z" fill="#3b82f6"/><path d="M8 7 Q50 22 92 7" stroke="#1d4ed8" stroke-width="5.5" fill="none" stroke-linecap="round"/>' +
            '<g fill="#fff"><circle cx="38" cy="21" r="2.4"/><circle cx="62" cy="21" r="2.4"/><circle cx="50" cy="29" r="2.4"/><circle cx="26" cy="15" r="1.8"/><circle cx="74" cy="15" r="1.8"/></g>'),
        scarf: svg(NECK_BOX, '<path d="M64 20 L80 18 L83 38 L67 39 Z" fill="#dc2626"/><path d="M68 39 v-4 M72 39 v-4 M76 38.6 v-4 M80 38.3 v-4" stroke="#fecaca" stroke-width="1.6"/>' +
            '<path d="M4 7 Q50 25 96 7 L96 19 Q50 37 4 19 Z" fill="#ef4444"/><path d="M18 11 L16 24 M34 15 L33 28 M66 15 L67 28 M82 11 L84 24" stroke="#fee2e2" stroke-width="3.5" opacity="0.9"/>')
    };

    // Where worn items sit on each stage, in px inside the creature's box (css/pet-art.css sizes).
    // hat: brim centre; face: between the eyes; neck: below the mouth. Eggs have no face or neck yet.
    const GEAR_SPOTS = {
        egg:    { hat: { x: 40, y: 15, w: 44 } },
        baby:   { hat: { x: 35, y: 9, w: 42 },   face: { x: 35, y: 27.5, w: 64 },  neck: { x: 35, y: 60, w: 38 } },
        kid:    { hat: { x: 40, y: 9, w: 50 },   face: { x: 40, y: 29, w: 80 },    neck: { x: 40, y: 70, w: 46 } },
        teen:   { hat: { x: 42.5, y: 9, w: 54 }, face: { x: 42.5, y: 32, w: 90 },  neck: { x: 42.5, y: 86, w: 50 } },
        adult:  { hat: { x: 50, y: 10, w: 60 },  face: { x: 50, y: 33, w: 114 },   neck: { x: 50, y: 95, w: 56 } },
        master: { hat: { x: 55, y: 10, w: 66 },  face: { x: 55, y: 33.6, w: 130 }, neck: { x: 55, y: 104, w: 60 } }
    };
    const GEAR_HEIGHT = { hat: 0.8, face: 0.36, neck: 0.4 }; // viewBox height ÷ width

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
        { slot: 'color', id: 'galaxy', name: 'Galaxy', finish: true, unlock: { type: 'badge', badge: 'rocket' },
            palette: palette('#a78bfa', '#6d28d9', '#4c1d95', '#2e1065', '#f0abfc', { ink: '#f5f3ff',
                bg: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95) 0 1px, transparent 1.6px) 0 0 / 13px 13px, radial-gradient(circle at 70% 60%, rgba(255, 255, 255, 0.6) 0 1px, transparent 1.6px) 0 0 / 19px 19px, linear-gradient(135deg, #6d28d9, #4c1d95 50%, #1e1b4b)' }) },

        { slot: 'pattern', id: 'none', name: 'Plain' },
        { slot: 'pattern', id: 'belly', name: 'Belly' },
        { slot: 'pattern', id: 'spots', name: 'Spots', unlock: { type: 'evo', species: 'baby' } },
        { slot: 'pattern', id: 'stripes', name: 'Stripes', unlock: { type: 'evo', species: 'kid' } },
        { slot: 'pattern', id: 'stars', name: 'Stars', unlock: { type: 'evo', species: 'teen' } },
        { slot: 'pattern', id: 'hearts', name: 'Hearts', unlock: { type: 'fed', n: 20 } },

        { slot: 'hat', id: 'none', name: 'No hat' },
        { slot: 'hat', id: 'party', name: 'Party Hat', unlock: { type: 'badge', badge: 'first_steps' } },
        { slot: 'hat', id: 'keycap', name: 'Key Cap', unlock: { type: 'badge', badge: 'home_row_hero' } },
        { slot: 'hat', id: 'beanie', name: 'Beanie', unlock: { type: 'days', n: 3 } },
        { slot: 'hat', id: 'flowers', name: 'Flower Crown', unlock: { type: 'badge', badge: 'perfectionist' } },
        { slot: 'hat', id: 'wizard', name: 'Wizard Hat', unlock: { type: 'badge', badge: 'bubble_master' } },
        { slot: 'hat', id: 'crown', name: 'Crown', unlock: { type: 'bubble', level: 20 } },
        { slot: 'hat', id: 'gradcap', name: 'Grad Cap', unlock: { type: 'training', n: 8 } },

        { slot: 'face', id: 'none', name: 'No glasses' },
        { slot: 'face', id: 'round', name: 'Round Glasses', unlock: { type: 'articles', n: 3 } },
        { slot: 'face', id: 'shades', name: 'Speed Shades', unlock: { type: 'badge', badge: 'speed_demon' } },
        { slot: 'face', id: 'starglasses', name: 'Star Glasses', unlock: { type: 'badge', badge: 'sniper' } },

        { slot: 'neck', id: 'none', name: 'Nothing' },
        { slot: 'neck', id: 'bell', name: 'Bell Collar' },
        { slot: 'neck', id: 'bowtie', name: 'Bow Tie', unlock: { type: 'badge', badge: 'pet_parent' } },
        { slot: 'neck', id: 'bandana', name: 'Bandana', unlock: { type: 'bubble', level: 5 } },
        { slot: 'neck', id: 'scarf', name: 'Cozy Scarf', unlock: { type: 'goals', n: 10 } },

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

    function keyOf(item) {
        return item.slot + ':' + item.id; // as stored in pet.seen_items
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
        // Grown-up pets wear a crown; a hat goes on instead of it
        const crown = look.hat && look.hat !== 'none' ? '' : '<div class="crown">👑</div>';
        const gear = gearHTML(species, look);
        switch (species) {
            case 'baby':
                return `<div class="creature-baby${cls}"${style}>${layers}${eyes}<div class="mouth"></div><div class="cheek left"></div><div class="cheek right"></div>${gear}</div>`;
            case 'kid':
                return `<div class="creature-kid${cls}"${style}>${body}${feet}${gear}</div>`;
            case 'teen':
                return `<div class="creature-teen${cls}"${style}>${body}<div class="horn left"></div><div class="horn right"></div>${feet}${gear}</div>`;
            case 'adult':
                return `<div class="creature-adult${cls}"${style}>${body}${wings}${crown}${feet}${gear}</div>`;
            case 'master':
                return `<div class="creature-master${cls}"${style}><div class="aura"></div>${body}${wings}${crown}${feet}${gear}</div>`;
            default:
                return `<div class="creature-egg${cls}"${style}>${layers}<div class="crack"></div>${gear}</div>`;
        }
    }

    /** The hat, glasses and neck thing, placed for this stage (eggs only wear hats). */
    function gearHTML(species, look) {
        const spots = GEAR_SPOTS[species] || GEAR_SPOTS.egg;
        let out = '';
        ['hat', 'face', 'neck'].forEach(slot => {
            const id = look[slot];
            const spot = spots[slot];
            if (!spot || !id || id === 'none' || !ART[id]) return;
            const h = spot.w * GEAR_HEIGHT[slot];
            const top = slot === 'hat' ? spot.y - h : spot.y - h / 2;
            out += `<div class="pet-gear pet-gear-${slot}" style="left: ${(spot.x - spot.w / 2).toFixed(1)}px; top: ${top.toFixed(1)}px; width: ${spot.w}px;">${ART[id]}</div>`;
        });
        return out;
    }

    /** A whole .pet-scene (place + pet) as markup, for pictures that don't need to change. */
    function sceneHTML(species, look) {
        const pl = PLACES[look.place] || PLACES.meadow;
        return `<div class="pet-scene" style="${placeStyle(pl)}"><div class="pet-decor pet-decor-back">${decorSVG(pl.back)}</div>` +
            `<div class="pet-ground"></div><div class="pet-decor pet-decor-front">${decorSVG(pl.front)}</div>` +
            `<div class="pet-creature">${creatureHTML(species, look, '')}</div></div>`;
    }

    // Square of the 300×280 scene that frames each stage with its tallest hat: its side, ending just below the feet
    const AVATAR_CROP = { egg: 136, baby: 116, kid: 138, teen: 162, adult: 174, master: 190 };

    /** The dressed-up pet in a small still square (Home, certificates). `size` in px. */
    function avatarHTML(pet, size, progress) {
        const species = AVATAR_CROP[pet.species] ? pet.species : 'egg';
        const look = resolveLook(pet, progress || getProgress());
        const side = AVATAR_CROP[species];
        const vars = `--avatar-size: ${size}px; --avatar-scale: ${(size / side).toFixed(4)}; --avatar-x: ${-(150 - side / 2)}px; --avatar-y: ${-(222 - side)}px;`;
        return `<span class="pet-avatar" style="${vars}" aria-hidden="true">${sceneHTML(species, look)}</span>`;
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
        const articles = TypePetsData.getCompletedArticles();
        const space = new Set(spaceArticleIds());
        const named = !!pet.name && pet.name !== 'Unnamed';
        return {
            petName: named ? pet.name : 'your pet',
            named: named,
            species: pet.species,
            xp: num(pet.xp),
            fed: num(pet.total_fed),
            sessions: num(stats.total_sessions),
            days: num(stats.practice_days),
            goalDays: num(stats.goal_days),
            bestWpm: Math.floor(num(stats.best_wpm)),
            bestAccuracy: Math.floor(num(stats.best_accuracy)),
            perfect: num(stats.perfect_sessions),
            homeRow: num(stats.finger_progress && stats.finger_progress[1]),
            training: num(TypePetsData.getTrainingStage().max_stage),
            bubble: passed.length ? passed[passed.length - 1] : 0,
            bubbleBest: num(TypePetsData.getBubblePersonalBest()),
            articles: articles.length,
            spaceArticles: articles.filter(id => space.has(String(id))).length,
            badges: new Set(TypePetsData.getAchievements().map(a => a.badge_id))
        };
    }

    // The badges in js/achievements.js, as unlock rules. The badge or its condition unlocks the item.
    // count = [have, need] for a progress bar; done = met with nothing to count; after = an extra sentence.
    const BADGE_RULES = {
        first_steps: { name: '🏁 First Steps', label: 'First lesson', text: () => 'Finish your first lesson', count: p => [p.sessions, 1] },
        pet_parent: { name: '🐣 Pet Parent', label: 'Name your pet', text: () => 'Give your pet a name', done: p => p.named },
        home_row_hero: { name: '⌨️ Home Row Hero', label: 'Home row 95%', text: () => 'Get 95% accuracy on Finger Training stage 1', done: p => p.homeRow >= 95 },
        speed_demon: { name: '⚡ Speed Demon', label: '20 WPM', text: () => 'Type 20 words per minute', count: p => [p.bestWpm, 20] },
        rocket: { name: '🚀 Rocket', label: '40 WPM', text: () => 'Type 40 words per minute', count: p => [p.bestWpm, 40] },
        sniper: { name: '🎯 Sniper', label: '100% accuracy', text: () => 'Get 100% accuracy in a round', done: p => p.bestAccuracy >= 100,
            after: p => `Your best so far is ${p.bestAccuracy}%` },
        perfectionist: { name: '💯 Perfectionist', label: '5 perfect rounds', text: () => 'Get 100% accuracy in 5 rounds', count: p => [p.perfect, 5] },
        bubble_master: { name: '🫧 Bubble Master', label: '1,000 in Bubbles', text: () => 'Score 1,000 points in one Bubble Pop game', count: p => [p.bubbleBest, 1000] }
    };

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
            case 'goals':
                need = u.n;
                have = p.goalDays;
                label = `${need} goal days`;
                text = `Reach your daily goal on ${need} days`;
                break;
            case 'training':
                need = u.n;
                have = p.training;
                label = `All ${need} stages`;
                text = `Finish all ${need} Finger Training stages`;
                break;
            case 'articles':
                need = u.n;
                have = p.articles;
                label = `Read ${need} articles`;
                text = `Finish ${need} articles in Read & Type`;
                break;
            case 'badge': {
                const rule = BADGE_RULES[u.badge];
                if (!rule) break;
                label = rule.label;
                text = `${rule.text(p)} (the ${rule.name} badge)` + (rule.after ? `. ${rule.after(p)}` : '');
                if (rule.count) {
                    [have, need] = rule.count(p);
                    unlocked = p.badges.has(u.badge) || have >= need;
                } else {
                    unlocked = p.badges.has(u.badge) || rule.done(p);
                    return { unlocked, label, text, have: null, need: null };
                }
                break;
            }
            default:
                return { unlocked: false, label: 'Locked', text: 'Not available yet', have: null, need: null };
        }
        if (label === undefined) return { unlocked: false, label: 'Locked', text: 'Not available yet', have: null, need: null };
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
        if (item.slot === 'hat' || item.slot === 'face' || item.slot === 'neck') {
            return item.id === 'none' || !ART[item.id] ? '<span class="wd-none"></span>' : `<span class="wd-art wd-art-${item.slot}">${ART[item.id]}</span>`;
        }
        const pl = PLACES[item.id] || PLACES.meadow;
        return `<span class="wd-mini-scene" style="${placeStyle(pl)}"><span class="pet-decor pet-decor-back">${decorSVG(pl.back)}</span>` +
            `<span class="pet-ground"></span><span class="pet-decor pet-decor-front">${decorSVG(pl.front)}</span></span>`;
    }

    // ─── What's next, what's new ─────────────────────────────

    /** Up to `n` locked items the kid is closest to, each with its requirement (for "Coming up"). */
    function nextUp(p, n) {
        return ITEMS
            .filter(it => it.unlock)
            .map(it => ({ item: it, req: requirement(it, p) }))
            .filter(x => !x.req.unlocked && x.req.need && x.req.have > 0)
            .sort((a, b) => (b.req.have / b.req.need) - (a.req.have / a.req.need))
            .slice(0, n);
    }

    /** Unlocked items the kid hasn't seen yet in the wardrobe ('slot:id'). Free items are never new. */
    function newItemKeys(pet, p) {
        const seen = new Set((pet && pet.seen_items) || []);
        return ITEMS.filter(it => it.unlock && !seen.has(keyOf(it)) && isUnlocked(it, p)).map(keyOf);
    }

    function unlockedKeys(p) {
        return new Set(ITEMS.filter(it => it.unlock && isUnlocked(it, p)).map(keyOf));
    }

    // What was unlocked when this page opened. Practice on this page is compared against it.
    let _baseline = null;
    try {
        if (typeof TypePetsData !== 'undefined') _baseline = unlockedKeys(getProgress());
    } catch (e) {
        _baseline = null;
    }

    /**
     * After practice (achievements.js calls this): pop up "New for Pip: …" for anything unlocked
     * since the page opened or since the last call. Returns the new items.
     */
    function announceNewUnlocks() {
        if (!_baseline) return [];
        let now;
        try { now = unlockedKeys(getProgress()); } catch (e) { return []; }
        const fresh = ITEMS.filter(it => now.has(keyOf(it)) && !_baseline.has(keyOf(it)));
        _baseline = now;
        if (fresh.length) showUnlockToast(fresh, getProgress().petName);
        return fresh;
    }

    function showUnlockToast(items, petName) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const first = items[0];
        const names = items.length === 1 ? first.name
            : items.length === 2 ? `${first.name} and ${items[1].name}`
            : `${first.name} and ${items.length - 1} more`;
        const who = petName === 'your pet' ? 'your pet' : petName;

        const toast = document.createElement('div');
        toast.className = 'toast wardrobe-unlock';
        toast.setAttribute('role', 'status');
        const icon = document.createElement('span');
        icon.className = 'wardrobe-unlock-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '🎁';
        const text = document.createElement('span');
        text.className = 'wardrobe-unlock-text';
        const label = document.createElement('span');
        label.className = 'wardrobe-unlock-label';
        label.textContent = `New for ${who}`;
        const what = document.createElement('span');
        what.className = 'wardrobe-unlock-name';
        what.textContent = names;
        text.appendChild(label);
        text.appendChild(what);
        const link = document.createElement('a');
        link.className = 'wardrobe-unlock-try';
        link.href = '/pages/pet.html#wardrobe-' + first.slot;
        link.textContent = 'Try it on';
        toast.appendChild(icon);
        toast.appendChild(text);
        toast.appendChild(link);
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 8000);
    }

    return {
        SLOTS, ITEMS, DEFAULT_LOOK,
        find, keyOf, getProgress, requirement, isUnlocked, resolveLook, counts, nextUp, newItemKeys,
        creatureHTML, applyPlace, thumbHTML, avatarHTML, announceNewUnlocks
    };
})();
