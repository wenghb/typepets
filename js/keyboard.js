/**
 * Virtual Keyboard — SVG rendered with 8 color-coded finger zones + glove hands resting on it
 */

const KEYBOARD_LAYOUT = [
    // Row 0: number row
    [
        { key: '`', shift: '~', w: 1, finger: 'l-pinky' },
        { key: '1', shift: '!', w: 1, finger: 'l-pinky' },
        { key: '2', shift: '@', w: 1, finger: 'l-ring' },
        { key: '3', shift: '#', w: 1, finger: 'l-middle' },
        { key: '4', shift: '$', w: 1, finger: 'l-index' },
        { key: '5', shift: '%', w: 1, finger: 'l-index' },
        { key: '6', shift: '^', w: 1, finger: 'r-index' },
        { key: '7', shift: '&', w: 1, finger: 'r-index' },
        { key: '8', shift: '*', w: 1, finger: 'r-middle' },
        { key: '9', shift: '(', w: 1, finger: 'r-ring' },
        { key: '0', shift: ')', w: 1, finger: 'r-pinky' },
        { key: '-', shift: '_', w: 1, finger: 'r-pinky' },
        { key: '=', shift: '+', w: 1, finger: 'r-pinky' },
        { key: 'Backspace', label: '⌫', w: 2, finger: 'r-pinky' },
    ],
    // Row 1: top row
    [
        { key: 'Tab', label: 'Tab', w: 1.5, finger: 'l-pinky' },
        { key: 'q', w: 1, finger: 'l-pinky' },
        { key: 'w', w: 1, finger: 'l-ring' },
        { key: 'e', w: 1, finger: 'l-middle' },
        { key: 'r', w: 1, finger: 'l-index' },
        { key: 't', w: 1, finger: 'l-index' },
        { key: 'y', w: 1, finger: 'r-index' },
        { key: 'u', w: 1, finger: 'r-index' },
        { key: 'i', w: 1, finger: 'r-middle' },
        { key: 'o', w: 1, finger: 'r-ring' },
        { key: 'p', w: 1, finger: 'r-pinky' },
        { key: '[', shift: '{', w: 1, finger: 'r-pinky' },
        { key: ']', shift: '}', w: 1, finger: 'r-pinky' },
        { key: '\\', shift: '|', w: 1.5, finger: 'r-pinky' },
    ],
    // Row 2: home row
    [
        { key: 'CapsLock', label: 'Caps', w: 1.75, finger: 'l-pinky' },
        { key: 'a', w: 1, finger: 'l-pinky' },
        { key: 's', w: 1, finger: 'l-ring' },
        { key: 'd', w: 1, finger: 'l-middle' },
        { key: 'f', w: 1, finger: 'l-index', home: true },
        { key: 'g', w: 1, finger: 'l-index' },
        { key: 'h', w: 1, finger: 'r-index' },
        { key: 'j', w: 1, finger: 'r-index', home: true },
        { key: 'k', w: 1, finger: 'r-middle' },
        { key: 'l', w: 1, finger: 'r-ring' },
        { key: ';', shift: ':', w: 1, finger: 'r-pinky' },
        { key: "'", shift: '"', w: 1, finger: 'r-pinky' },
        { key: 'Enter', label: 'Enter', w: 2.25, finger: 'r-pinky' },
    ],
    // Row 3: bottom row
    [
        { key: 'ShiftLeft', label: 'Shift', w: 2.25, finger: 'l-pinky' },
        { key: 'z', w: 1, finger: 'l-pinky' },
        { key: 'x', w: 1, finger: 'l-ring' },
        { key: 'c', w: 1, finger: 'l-middle' },
        { key: 'v', w: 1, finger: 'l-index' },
        { key: 'b', w: 1, finger: 'l-index' },
        { key: 'n', w: 1, finger: 'r-index' },
        { key: 'm', w: 1, finger: 'r-index' },
        { key: ',', shift: '<', w: 1, finger: 'r-middle' },
        { key: '.', shift: '>', w: 1, finger: 'r-ring' },
        { key: '/', shift: '?', w: 1, finger: 'r-pinky' },
        { key: 'ShiftRight', label: 'Shift', w: 2.75, finger: 'r-pinky' },
    ],
    // Row 4: space row
    [
        { key: 'Ctrl', label: 'Ctrl', w: 1.25, finger: 'l-pinky' },
        { key: 'Alt', label: 'Alt', w: 1.25, finger: 'l-pinky' },
        { key: 'Meta', label: '⌘', w: 1.25, finger: 'l-pinky' },
        { key: ' ', label: 'Space', w: 6.25, finger: 'thumb' },
        { key: 'MetaR', label: '⌘', w: 1.25, finger: 'r-pinky' },
        { key: 'AltR', label: 'Alt', w: 1.25, finger: 'r-pinky' },
        { key: 'CtrlR', label: 'Ctrl', w: 1.25, finger: 'r-pinky' },
    ],
];

// Key-to-finger mapping (flat)
const KEY_FINGER_MAP = {};
KEYBOARD_LAYOUT.forEach(row => {
    row.forEach(k => {
        KEY_FINGER_MAP[k.key.toLowerCase()] = k.finger;
    });
});

// Finger to friendly name
const FINGER_NAMES = {
    'l-pinky': 'Left Pinky',
    'l-ring': 'Left Ring',
    'l-middle': 'Left Middle',
    'l-index': 'Left Index',
    'r-index': 'Right Index',
    'r-middle': 'Right Middle',
    'r-ring': 'Right Ring',
    'r-pinky': 'Right Pinky',
    'thumb': 'Thumb',
};

// Finger to color
const FINGER_COLORS = {
    'l-pinky': '#ec4899',
    'l-ring': '#a855f7',
    'l-middle': '#3b82f6',
    'l-index': '#22c55e',
    'r-index': '#eab308',
    'r-middle': '#f97316',
    'r-ring': '#ef4444',
    'r-pinky': '#d946ef',
    'thumb': '#64748b',
};

/**
 * Cartoon glove hands drawn on top of the keyboard, fingertips resting on the home row.
 * Each hand is one smooth outline (so the gaps between fingers are soft curves), with the
 * fingertips colored like that finger's key zone. The finger for the next key is tinted and
 * reaches toward that key.
 *
 * Geometry lives in "hand space": 21 units per key, origin at the A key's fingertip spot,
 * y growing toward the wrist. The left hand is drawn there; the right hand is its mirror image.
 */
const GloveHands = (() => {
    const UNITS_PER_KEY = 21;
    const U = UNITS_PER_KEY;
    const INK = '#52617A';
    const TIP = {
        'l-pinky': '#E8A3C8', 'l-ring': '#B9A3E8', 'l-middle': '#8DBBEA', 'l-index': '#86D6A4',
        'r-index': '#E8D27A', 'r-middle': '#F0AE7E', 'r-ring': '#EE9A9A', 'r-pinky': '#CFA0E6',
        'thumb': '#A9B6C8',
    };
    const TINT = {
        'l-pinky': '#F7DCEA', 'l-ring': '#E6DDF7', 'l-middle': '#DCEAF8', 'l-index': '#DAF2E3',
        'r-index': '#F7F0D2', 'r-middle': '#FBE5D5', 'r-ring': '#F9DCDC', 'r-pinky': '#EFDDF8',
        'thumb': '#E3E8EF',
    };
    // Left hand at rest. `home` is the key index (0 = A) the fingertip sits on; `base` is the knuckle.
    const FINGERS = [
        { name: 'pinky', home: 0, base: [7, 33], w0: 15.1, w1: 13.6 },
        { name: 'ring', home: 1, base: [25, 36], w0: 16.6, w1: 15.1 },
        { name: 'middle', home: 2, base: [42, 37], w0: 17.1, w1: 15.6 },
        { name: 'index', home: 3, base: [59, 36], w0: 16.6, w1: 15.1 },
    ];
    const THUMB = { base: [71, 64], tip: [86, 31], w0: 20.6, w1: 15.6 };
    const WRIST_L = [13, 86];
    const WRIST_R = [70, 86];
    const MIRROR_X = 9 * U; // A ↔ ; (the two home rows mirror each other)
    const MAX_REACH = 2 * U; // far keys (Enter, Backspace) get a point in their direction
    const HAND_FOLLOW = 0.3; // share of a reach done by moving the whole hand, like real typing
    const MIN_LENGTH = 0.62; // a curled finger never gets shorter than this share of its rest length

    let clipSeq = 0;

    const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
    const pt = p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

    // A finger from knuckle B to fingertip `tip`, w0 wide at the knuckle and w1 at the tip.
    function finger(B, tip, w0, w1) {
        const len = Math.hypot(tip[0] - B[0], tip[1] - B[1]);
        const d = [(tip[0] - B[0]) / len, (tip[1] - B[1]) / len]; // toward the tip
        const n = [-d[1], d[0]]; // toward the finger's right side
        const r = w1 / 2;
        const T = add(B, d, len - r); // center of the rounded tip
        return {
            B, d, n, r, len, w0,
            angle: Math.atan2(d[0], -d[1]) * 180 / Math.PI,
            T, lb: add(B, n, -w0 / 2), rb: add(B, n, w0 / 2), lt: add(T, n, -r), rt: add(T, n, r),
        };
    }

    // Left side up, around the tip, right side down — sides bow out slightly.
    function fingerEdges(f) {
        const ml = add([(f.lb[0] + f.lt[0]) / 2, (f.lb[1] + f.lt[1]) / 2], f.n, -0.7);
        const mr = add([(f.rt[0] + f.rb[0]) / 2, (f.rt[1] + f.rb[1]) / 2], f.n, 0.7);
        return `Q ${pt(ml)} ${pt(f.lt)} A ${f.r} ${f.r} 0 0 1 ${pt(f.rt)} Q ${pt(mr)} ${pt(f.rb)} `;
    }

    function outline(fingers, t) {
        const [pinky, , , index] = fingers;
        let s = `M ${WRIST_L[0]} ${WRIST_L[1] + 60} L ${pt(WRIST_L)} `;
        s += `C ${WRIST_L[0] - 5} ${WRIST_L[1] - 20} ${pt(add(pinky.lb, [-1.5, 30]))} ${pt(pinky.lb)} `;
        fingers.forEach((f, i) => {
            s += fingerEdges(f);
            const next = fingers[i + 1];
            if (next) {
                const mid = [(f.rb[0] + next.lb[0]) / 2, (f.rb[1] + next.lb[1]) / 2 + 4.5];
                s += `Q ${pt(mid)} ${pt(next.lb)} `;
            }
        });
        // Web between index and thumb, the thumb, then the heel of the hand down to the wrist.
        const ml = add([(t.lb[0] + t.lt[0]) / 2, (t.lb[1] + t.lt[1]) / 2], t.n, -0.7);
        const heel = add(t.rb, t.d, 10);
        s += `C ${pt(add(index.rb, [2.5, 14]))} ${pt(add(t.lb, t.d, -10))} ${pt(t.lb)} `;
        s += `Q ${pt(ml)} ${pt(t.lt)} A ${t.r} ${t.r} 0 0 1 ${pt(t.rt)} L ${pt(heel)} `;
        s += `C ${pt(add(heel, [1.5, 10]))} ${pt([WRIST_R[0] + 4, WRIST_R[1] - 10])} ${pt(WRIST_R)} `;
        s += `L ${WRIST_R[0]} ${WRIST_R[1] + 60} Z`;
        return s;
    }

    // The part of a finger from its tip back `depth` units, a bit oversized (it is drawn clipped
    // to the outline). `pad` widens the cut end; keep it 0 when the cut reaches the knuckles.
    function fingerPart(f, depth, pad = 3) {
        const a = add(f.T, f.d, -(depth - f.r));
        return `M ${pt(add(a, f.n, -f.w0 / 2 - pad))} L ${pt(add(f.lt, f.n, -3))} `
            + `A ${f.r + 3} ${f.r + 3} 0 0 1 ${pt(add(f.rt, f.n, 3))} L ${pt(add(a, f.n, f.w0 / 2 + pad))} Z`;
    }

    function tapLines(f, color) {
        // Two little "tap" marks beside the fingertip (not above it, where the key letter is)
        const lines = [-62, 62].map(a =>
            `<line transform="rotate(${a})" x1="0" y1="${-f.r - 3}" x2="0" y2="${-f.r - 7.5}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`
        ).join('');
        return `<g transform="translate(${pt(f.T)}) rotate(${f.angle.toFixed(1)})">${lines}</g>`;
    }

    // The reach from a finger's home key toward `target`, capped at MAX_REACH.
    function reachVector(def, target) {
        const v = [target[0] - def.home * U, target[1]];
        const dist = Math.hypot(v[0], v[1]);
        return dist > MAX_REACH ? v.map(c => c * MAX_REACH / dist) : v;
    }

    // Where a finger's tip goes: its home key, or `reach` away from it (curled no shorter than MIN_LENGTH).
    function tipFor(def, reach) {
        const rest = [def.home * U, 0];
        if (!reach) return rest;
        let tip = add(rest, reach);
        const restLen = Math.hypot(rest[0] - def.base[0], rest[1] - def.base[1]);
        const len = Math.hypot(tip[0] - def.base[0], tip[1] - def.base[1]) || 1;
        if (len < restLen * MIN_LENGTH) {
            tip = add(def.base, [(tip[0] - def.base[0]) / len, (tip[1] - def.base[1]) / len], restLen * MIN_LENGTH);
        }
        return tip;
    }

    // One hand in left-hand space. `target` is already mirrored for the right hand.
    function hand(side, active, target) {
        // Part of the reach moves the whole hand; the active finger stretches the rest of the way
        const activeDef = target && FINGERS.find(def => `${side}-${def.name}` === active);
        const reach = activeDef ? reachVector(activeDef, target) : null;
        const shift = reach ? reach.map(c => c * HAND_FOLLOW) : [0, 0];
        const fingers = FINGERS.map(def => {
            const zone = `${side}-${def.name}`;
            const on = def === activeDef;
            const tip = tipFor(def, on ? reach.map(c => c * (1 - HAND_FOLLOW)) : null);
            return Object.assign(finger(def.base, tip, def.w0, def.w1), { zone, on: zone === active });
        });
        const thumb = Object.assign(finger(THUMB.base, THUMB.tip, THUMB.w0, THUMB.w1), { zone: 'thumb', on: active === 'thumb' });
        const all = fingers.concat([thumb]);
        const path = outline(fingers, thumb);
        const clip = `glove-clip-${clipSeq++}`;

        let s = `<g transform="translate(${pt(shift)})">`;
        s += `<defs><clipPath id="${clip}"><path d="${path}"/></clipPath></defs>`;
        s += `<path d="${path}" fill="#FFFFFF" fill-opacity="0.72"/>`;
        s += `<g clip-path="url(#${clip})">`;
        all.forEach(f => {
            if (f.on) s += `<path d="${fingerPart(f, f === thumb ? f.len - 12 : f.len, 0)}" fill="${TINT[f.zone]}" fill-opacity="0.9"/>`;
            s += `<path d="${fingerPart(f, f.r * 2.1)}" fill="${TIP[f.zone]}"/>`;
        });
        s += `</g>`;
        s += `<path d="${path}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
        // Stitching on the back of the glove
        for (let i = 0; i < 3; i++) {
            const a = fingers[i], b = fingers[i + 1];
            const m = [(a.rb[0] + b.lb[0]) / 2, (a.rb[1] + b.lb[1]) / 2 + 12];
            s += `<path d="M ${pt(m)} q 0.8 7 ${0.4 + (i - 1) * 1.2} 15" stroke="${INK}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.8"/>`;
        }
        all.forEach(f => { if (f.on) s += tapLines(f, TIP[f.zone]); });
        // Rolled cuff
        const cw = WRIST_R[0] - WRIST_L[0];
        s += `<rect x="${WRIST_L[0] - 3}" y="${WRIST_L[1] + 10}" width="${cw + 6}" height="30" fill="#FFFFFF" stroke="${INK}" stroke-width="1.3"/>`;
        s += `<rect x="${WRIST_L[0] - 7}" y="${WRIST_L[1] - 4}" width="${cw + 14}" height="15" rx="7.5" fill="#FFFFFF" stroke="${INK}" stroke-width="1.3"/>`;
        return s + `</g>`;
    }

    /**
     * Both hands as an SVG group.
     * origin: where the A fingertip sits, in keyboard coordinates; scale: keyboard px per hand unit.
     * active: finger id ('l-index', 'thumb', …) or null; target: [x, y] of the key to reach, or null.
     */
    function render({ origin, scale, active = null, target = null }) {
        const t = target ? [(target[0] - origin[0]) / scale, (target[1] - origin[1]) / scale] : null;
        const right = active && active.startsWith('r-');
        return `<g transform="translate(${pt(origin)}) scale(${scale.toFixed(4)})">`
            + hand('l', active, right ? null : t)
            + `<g transform="translate(${MIRROR_X} 0) scale(-1 1)">${hand('r', active, right && t ? [MIRROR_X - t[0], t[1]] : null)}</g>`
            + `</g>`;
    }

    /** How far below the home-row fingertips the cuffs can reach (hands slide down for bottom-row keys). */
    const DEPTH = WRIST_L[1] + 11 + MAX_REACH * HAND_FOLLOW;

    return { render, UNITS_PER_KEY, DEPTH };
})();

class VirtualKeyboard {
    /**
     * options.hands — draw the glove hands over the keyboard (default true)
     */
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.showHands = options.hands !== false;
        this.keyElements = {};
        this.keyCenters = {};
        this.activeKey = null;
        this.activeFinger = null;
        this.validKeys = null; // null = all keys valid
        this.render();
    }

    render() {
        const keyW = 48;
        const keyH = 44;
        const gap = 4;
        const padX = 10;
        const padY = 10;
        const totalW = 15 * (keyW + gap) + padX * 2;
        const totalH = 5 * (keyH + gap) + padY * 2 + 10;

        // Hands rest on the home row: fingertips sit just below the key letters, palms below the keys
        const homeY = padY + 2 * (keyH + gap) + keyH / 2;
        const handScale = (keyW + gap) / GloveHands.UNITS_PER_KEY;
        const handOriginY = homeY + keyH * 0.24;
        const viewH = this.showHands ? Math.ceil(handOriginY + (GloveHands.DEPTH + 4) * handScale) : totalH;

        let svg = `<svg viewBox="0 0 ${totalW} ${viewH}" xmlns="http://www.w3.org/2000/svg" class="keyboard-svg">`;

        // Background (also under the palms, so the gloves look the same in light and dark mode)
        svg += `<rect x="1" y="1" width="${totalW - 2}" height="${viewH - 2}" rx="16" ry="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>`;

        KEYBOARD_LAYOUT.forEach((row, rowIdx) => {
            let x = padX;
            const y = padY + rowIdx * (keyH + gap);

            row.forEach(keyDef => {
                const w = keyDef.w * keyW + (keyDef.w - 1) * gap;
                const label = keyDef.label || keyDef.key.toUpperCase();
                const keyId = `key-${keyDef.key.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const fingerClass = `finger-${keyDef.finger}`;
                const dimClass = '';

                svg += `<g id="${keyId}" class="key-group ${fingerClass}" data-key="${keyDef.key}" data-finger="${keyDef.finger}">`;
                svg += `<rect class="key-bg" x="${x}" y="${y}" width="${w}" height="${keyH}"/>`;

                // Home key indicator
                if (keyDef.home) {
                    svg += `<line x1="${x + w/2 - 6}" y1="${y + keyH - 6}" x2="${x + w/2 + 6}" y2="${y + keyH - 6}" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>`;
                }

                const fontSize = label.length > 3 ? 10 : label.length > 1 ? 11 : 14;
                svg += `<text class="key-label" x="${x + w/2}" y="${y + keyH/2}" font-size="${fontSize}">${this._escapeXml(label)}</text>`;
                svg += `</g>`;
                this.keyCenters[keyDef.key.toLowerCase()] = [x + w / 2, y + keyH / 2];

                x += w + gap;
            });
        });

        if (this.showHands) {
            const a = this.keyCenters['a'];
            this.handOrigin = [a[0], handOriginY];
            this.handScale = handScale;
            // Two copies: the live one follows the next key; No-look mode shows the resting one instead.
            // Rendered separately so each copy gets its own clipPath ids.
            const rest = () => GloveHands.render({ origin: this.handOrigin, scale: handScale });
            svg += `<g class="glove-hands" aria-hidden="true">`
                + `<g class="glove-rest">${rest()}</g><g class="glove-live">${rest()}</g></g>`;
        }

        svg += `</svg>`;

        this.container.innerHTML = `
            <div class="keyboard-wrapper">
                <div class="keyboard-svg-wrap">${svg}</div>
            </div>
        `;

        this.handsLive = this.container.querySelector('.glove-live');

        // Cache key elements
        this.container.querySelectorAll('.key-group').forEach(g => {
            const key = g.getAttribute('data-key');
            this.keyElements[key.toLowerCase()] = g;
        });
    }

    _escapeXml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    _drawHands(finger, target) {
        if (!this.handsLive) return;
        this.handsLive.innerHTML = GloveHands.render({
            origin: this.handOrigin, scale: this.handScale, active: finger, target,
        });
    }

    /**
     * Highlight a key as the next target
     */
    setActiveKey(key) {
        // Clear previous
        if (this.activeKey) {
            const prev = this.keyElements[this.activeKey];
            if (prev) prev.classList.remove('active');
        }
        this._clearFingerHighlight();

        if (!key) { this.activeKey = null; return; }

        const lower = key.toLowerCase();
        this.activeKey = lower;

        // Handle space
        const lookupKey = lower === ' ' ? ' ' : lower;
        const el = this.keyElements[lookupKey];
        if (el) {
            el.classList.remove('dimmed');
            el.classList.add('active');
            const finger = el.getAttribute('data-finger');
            this._highlightFinger(finger, lookupKey);
        }
    }

    /**
     * Flash correct/wrong feedback on a key
     */
    flashKey(key, correct) {
        const lower = key.toLowerCase();
        const lookupKey = lower === ' ' ? ' ' : lower;
        const el = this.keyElements[lookupKey];
        if (!el) return;

        const cls = correct ? 'correct' : 'wrong';
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), 300);
    }

    /**
     * Set which keys are valid (dim the rest)
     */
    setValidKeys(keys) {
        this.validKeys = keys ? new Set(keys.map(k => k.toLowerCase())) : null;
        Object.entries(this.keyElements).forEach(([key, el]) => {
            if (this.validKeys && !this.validKeys.has(key) && key !== ' ') {
                el.classList.add('dimmed');
            } else {
                el.classList.remove('dimmed');
            }
        });
    }

    /**
     * Get finger info for a key
     */
    getFingerForKey(key) {
        const lower = key.toLowerCase();
        const finger = KEY_FINGER_MAP[lower] || KEY_FINGER_MAP[' '];
        return {
            finger,
            name: FINGER_NAMES[finger] || 'Unknown',
            color: FINGER_COLORS[finger] || '#94a3b8'
        };
    }

    _highlightFinger(finger, key) {
        this.activeFinger = finger;
        // Fingertips rest below the letters, so aim at the same spot on the target key
        const c = this.keyCenters[key];
        const target = c && this.handOrigin ? [c[0], c[1] + (this.handOrigin[1] - this.keyCenters['a'][1])] : null;
        this._drawHands(finger, target);
    }

    _clearFingerHighlight() {
        if (this.activeFinger) this._drawHands(null, null);
        this.activeFinger = null;
    }
}

/* ─── Typing helpers (shared by Training + Articles) ─────────── */

/**
 * Active-time clock. Counts only time the kid is actually practicing:
 * - pauses while the tab is hidden or the window is in the background
 * - with `idleMs`, a long gap between keystrokes only counts up to `idleMs`
 * - hold()/release() pause it on purpose (e.g. while a summary card is open)
 */
class ActiveClock {
    constructor(options) {
        const o = options || {};
        this.idleMs = o.idleMs > 0 ? o.idleMs : Infinity;
        this._now = typeof o.now === 'function' ? o.now : () => Date.now();
        this._hidden = false;
        this.reset();
        if (!o.manual && typeof document !== 'undefined' && document.addEventListener) {
            this._hidden = !!document.hidden;
            document.addEventListener('visibilitychange', () => this.setHidden(!!document.hidden));
            window.addEventListener('blur', () => this.setHidden(true));
            window.addEventListener('focus', () => this.setHidden(!!document.hidden));
        }
    }

    reset() {
        this._acc = 0;
        this._last = 0;
        this._started = false;
        this._held = false;
        this._stopped = false;
    }

    get started() { return this._started; }

    _running() {
        return this._started && !this._hidden && !this._held && !this._stopped;
    }

    _flush(now) {
        if (this._running()) this._acc += Math.max(0, Math.min(now - this._last, this.idleMs));
        this._last = now;
    }

    _change(fn) {
        this._flush(this._now());
        fn();
    }

    start() {
        if (this._started || this._stopped) return;
        this._started = true;
        this._last = this._now();
    }

    /** Call on every keystroke. Starts the clock on the first one. */
    tick() {
        if (this._stopped) return;
        if (!this._started) { this.start(); return; }
        const now = this._now();
        // A keystroke proves the page is in front, even if a focus event was missed
        if (this._hidden) { this._hidden = false; this._last = now; return; }
        this._flush(now);
    }

    setHidden(hidden) {
        if (hidden === this._hidden) return;
        this._change(() => { this._hidden = hidden; });
    }

    hold() { this._change(() => { this._held = true; }); }
    release() { this._change(() => { this._held = false; }); }
    stop() { this._change(() => { this._stopped = true; }); }

    /** Seconds since the first keystroke, minus hidden/held/idle time. */
    seconds() {
        let ms = this._acc;
        if (this._running()) ms += Math.max(0, Math.min(this._now() - this._last, this.idleMs));
        return ms / 1000;
    }

    /** True while the clock is waiting for the next keystroke after `idleMs`. */
    isIdle() {
        return this._running() && this._now() - this._last > this.idleMs;
    }
}

const TypingUtils = (function () {
    'use strict';

    /** WPM everywhere = (correctly typed characters / 5) / active minutes. */
    function calcWpm(charsCorrect, activeSeconds) {
        if (!(activeSeconds > 0) || !(charsCorrect > 0)) return 0;
        return Math.round((charsCorrect / 5) / (activeSeconds / 60));
    }

    function calcAccuracy(correct, total) {
        if (!(total > 0)) return 100;
        return Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
    }

    function formatTime(seconds) {
        const s = Math.max(0, Math.floor(seconds || 0));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    function isCapsLockOn(e) {
        try {
            return !!(e && typeof e.getModifierState === 'function' && e.getModifierState('CapsLock'));
        } catch (err) {
            return false;
        }
    }

    /**
     * Sort a keydown event into what the typing screens should do with it:
     *   ime             — IME composition (Chinese/Japanese/Korean input, Android soft keyboards)
     *   capslock        — the Caps Lock key itself
     *   shortcut        — Ctrl/Cmd/Alt combos (Ctrl+F must not count as "f")
     *   ignore          — Shift, arrows, F-keys, Backspace…
     *   repeat          — auto-repeat from a held key
     *   capslock-letter — a letter typed while Caps Lock is on
     *   enter / char    — something to type ({ char })
     * `codeFallback` maps e.code → char for keys whose e.key is not a single character (dead keys).
     */
    function classifyKey(e, options) {
        const opts = options || {};
        const key = e.key;
        if (e.isComposing || e.keyCode === 229 || key === 'Process') return { kind: 'ime' };
        if (key === 'CapsLock') return { kind: 'capslock' };
        if (e.ctrlKey || e.metaKey || e.altKey) return { kind: 'shortcut' };
        if (typeof key !== 'string') return { kind: 'ignore' };
        let ch = null;
        if (key === 'Enter') ch = '\n';
        else if (key.length === 1) ch = key;
        else if (opts.codeFallback && e.code && opts.codeFallback[e.code]) ch = opts.codeFallback[e.code];
        if (ch === null) return { kind: 'ignore' };
        if (e.repeat) return { kind: 'repeat', char: ch };
        if (/^[a-z]$/i.test(ch) && isCapsLockOn(e)) return { kind: 'capslock-letter', char: ch };
        return { kind: ch === '\n' ? 'enter' : 'char', char: ch };
    }

    /** Soft keyboards love "smart" punctuation — map it back to what a US keyboard types. */
    const SMART_CHARS = {
        '‘': "'", '’': "'", '‚': "'", '′': "'",
        '“': '"', '”': '"', '„': '"', '″': '"',
        '–': '-', '—': '-', '−': '-',
        ' ': ' ', '…': '.',
    };

    function normalizeTyped(ch) {
        return Object.prototype.hasOwnProperty.call(SMART_CHARS, ch) ? SMART_CHARS[ch] : ch;
    }

    function isEditableTarget(el) {
        if (!el || !el.tagName) return false;
        return !!el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    }

    /**
     * Classroom links: ?<idParam>=N&min=M. Only whole numbers are accepted; minutes 1–60.
     * Returns { id, minutes, invalid: [param names that were present but unusable] }.
     */
    function parseClassParams(search, spec) {
        const out = { id: null, minutes: null, invalid: [] };
        let params;
        try { params = new URLSearchParams(search || ''); } catch (e) { return out; }
        if (spec && spec.idParam && params.has(spec.idParam)) {
            const raw = (params.get(spec.idParam) || '').trim();
            const n = /^\d{1,4}$/.test(raw) ? parseInt(raw, 10) : NaN;
            if (!isNaN(n) && (!spec.isValidId || spec.isValidId(n))) out.id = n;
            else out.invalid.push(spec.idParam);
        }
        if (params.has('min')) {
            const raw = (params.get('min') || '').trim();
            const m = /^\d{1,3}$/.test(raw) ? parseInt(raw, 10) : NaN;
            if (m >= 1 && m <= 60) out.minutes = m;
            else out.invalid.push('min');
        }
        return out;
    }

    function hasTouch() {
        try {
            return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
        } catch (e) {
            return false;
        }
    }

    /** The main pointer is a finger (phone/tablet), so show "tap to type" hints. */
    function prefersTouch() {
        try {
            return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        } catch (e) {
            return false;
        }
    }

    /**
     * Wire a hidden-but-focusable <input> so phones/tablets without a hardware keyboard
     * get an on-screen keyboard. Hardware keys keep going through the page's keydown
     * handler (which calls noteHandled() + preventDefault, so nothing lands in the input).
     * Characters that only arrive as `input` events (Android keyboards report keyCode 229)
     * are diffed out of the input's value and passed to opts.onChar one by one.
     */
    function attachTouchInput(input, opts) {
        const o = opts || {};
        let last = '';
        let composing = false;
        let lastPointerType = '';
        const recent = [];
        const now = () => (window.performance && performance.now ? performance.now() : Date.now());

        function reset() {
            input.value = '';
            last = '';
        }

        function focus() {
            // Re-focusing an already focused input doesn't bring a closed phone keyboard back
            if (document.activeElement === input) input.blur();
            try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
        }

        function wasJustHandled(ch) {
            const t = now();
            while (recent.length && t - recent[0].t > 200) recent.shift();
            const i = recent.findIndex(r => r.ch === ch);
            if (i === -1) return false;
            recent.splice(i, 1);
            return true;
        }

        input.addEventListener('compositionstart', () => { composing = true; });
        input.addEventListener('compositionend', () => { composing = false; });
        input.addEventListener('beforeinput', (e) => {
            if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') e.preventDefault();
        });
        input.addEventListener('paste', (e) => e.preventDefault());
        input.addEventListener('drop', (e) => e.preventDefault());
        input.addEventListener('input', () => {
            const val = input.value;
            // Only appended text counts; autocorrect rewrites and deletions are ignored
            const added = val.startsWith(last) ? val.slice(last.length) : '';
            last = val;
            for (const raw of added) {
                const ch = normalizeTyped(raw);
                if (wasJustHandled(ch) || wasJustHandled(raw)) continue;
                if (o.onChar) o.onChar(ch);
            }
            if (!composing && val.length > 40) reset();
        });
        input.addEventListener('focus', () => { if (o.onFocusChange) o.onFocusChange(true); });
        input.addEventListener('blur', () => {
            if (!composing) reset();
            if (o.onFocusChange) o.onFocusChange(false);
        });

        (o.tapTargets || []).forEach(el => {
            if (!el) return;
            el.addEventListener('pointerdown', (e) => { lastPointerType = e.pointerType || ''; });
            el.addEventListener('click', (e) => {
                if (e.target && e.target.closest && e.target.closest('button, a, select, textarea')) return;
                const byFinger = lastPointerType ? lastPointerType !== 'mouse' : hasTouch();
                if (byFinger) focus();
            });
        });

        return {
            focus,
            reset,
            isFocused: () => document.activeElement === input,
            /** The page handled this char from a keydown — don't count it again from `input`. */
            noteHandled(ch) {
                recent.push({ ch, t: now() });
                if (recent.length > 10) recent.shift();
            },
        };
    }

    return {
        calcWpm, calcAccuracy, formatTime, isCapsLockOn, classifyKey, normalizeTyped,
        isEditableTarget, parseClassParams, hasTouch, prefersTouch, attachTouchInput,
        ActiveClock,
    };
})();

// Export for use
window.VirtualKeyboard = VirtualKeyboard;
window.KEY_FINGER_MAP = KEY_FINGER_MAP;
window.FINGER_NAMES = FINGER_NAMES;
window.FINGER_COLORS = FINGER_COLORS;
window.ActiveClock = ActiveClock;
window.TypingUtils = TypingUtils;
