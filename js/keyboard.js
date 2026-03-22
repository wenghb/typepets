/**
 * Virtual Keyboard — SVG rendered with 8 color-coded finger zones + hand overlay
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

class VirtualKeyboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.keyElements = {};
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

        let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" class="keyboard-svg">`;

        // Background
        svg += `<rect x="0" y="0" width="${totalW}" height="${totalH}" rx="16" ry="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>`;

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

                x += w + gap;
            });
        });

        svg += `</svg>`;

        // Hand overlay SVG
        const handSvg = this._renderHands();

        this.container.innerHTML = `
            <div class="keyboard-wrapper">
                <div class="keyboard-svg-wrap">${svg}</div>
                <div class="hand-overlay">${handSvg}</div>
            </div>
        `;

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

    _renderHands() {
        // Simple stylized hand SVG with labeled fingers
        const w = 500, h = 160;
        let svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

        // Left hand fingers (from left to right: pinky, ring, middle, index, thumb)
        const leftFingers = [
            { id: 'l-pinky', x: 25, y: 20, w: 22, h: 55, label: 'P' },
            { id: 'l-ring', x: 55, y: 10, w: 22, h: 60, label: 'R' },
            { id: 'l-middle', x: 85, y: 5, w: 22, h: 65, label: 'M' },
            { id: 'l-index', x: 115, y: 12, w: 22, h: 58, label: 'I' },
            { id: 'l-thumb', x: 148, y: 60, w: 28, h: 42, label: 'T', rx: 14 },
        ];

        // Left palm
        svg += `<rect x="20" y="70" width="140" height="80" rx="20" ry="20" fill="#fde68a" stroke="#d97706" stroke-width="1.5" opacity="0.5"/>`;

        leftFingers.forEach(f => {
            const fingerZone = f.id === 'l-thumb' ? 'thumb' : f.id;
            const rx = f.rx || 10;
            svg += `<rect class="finger-shape" data-finger="${fingerZone}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${rx}" ry="${rx}"/>`;
            svg += `<text x="${f.x + f.w/2}" y="${f.y + f.h/2 + 2}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#92400e" pointer-events="none">${f.label}</text>`;
        });

        // Right hand fingers (mirrored)
        const rightFingers = [
            { id: 'r-thumb', x: w - 176, y: 60, w: 28, h: 42, label: 'T', rx: 14 },
            { id: 'r-index', x: w - 137, y: 12, w: 22, h: 58, label: 'I' },
            { id: 'r-middle', x: w - 107, y: 5, w: 22, h: 65, label: 'M' },
            { id: 'r-ring', x: w - 77, y: 10, w: 22, h: 60, label: 'R' },
            { id: 'r-pinky', x: w - 47, y: 20, w: 22, h: 55, label: 'P' },
        ];

        // Right palm
        svg += `<rect x="${w - 160}" y="70" width="140" height="80" rx="20" ry="20" fill="#fde68a" stroke="#d97706" stroke-width="1.5" opacity="0.5"/>`;

        rightFingers.forEach(f => {
            const fingerZone = f.id === 'r-thumb' ? 'thumb' : f.id;
            const rx = f.rx || 10;
            svg += `<rect class="finger-shape" data-finger="${fingerZone}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${rx}" ry="${rx}"/>`;
            svg += `<text x="${f.x + f.w/2}" y="${f.y + f.h/2 + 2}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="#92400e" pointer-events="none">${f.label}</text>`;
        });

        // Labels
        svg += `<text x="90" y="${h - 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#92400e" font-family="Fredoka, sans-serif">Left Hand</text>`;
        svg += `<text x="${w - 90}" y="${h - 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#92400e" font-family="Fredoka, sans-serif">Right Hand</text>`;

        svg += `</svg>`;
        return svg;
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
            this._highlightFinger(finger);
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

    _highlightFinger(finger) {
        this.activeFinger = finger;
        this.container.querySelectorAll(`.finger-shape[data-finger="${finger}"]`).forEach(el => {
            el.classList.add('active');
        });
    }

    _clearFingerHighlight() {
        this.container.querySelectorAll('.finger-shape.active').forEach(el => {
            el.classList.remove('active');
        });
        this.activeFinger = null;
    }
}

// Export for use
window.VirtualKeyboard = VirtualKeyboard;
window.KEY_FINGER_MAP = KEY_FINGER_MAP;
window.FINGER_NAMES = FINGER_NAMES;
window.FINGER_COLORS = FINGER_COLORS;
