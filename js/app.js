/**
 * TypePets — Main application module
 * Shared UI for every app page: toasts, theme/sound toggles, mobile nav,
 * profile switcher, and the grown-up gate in front of donation links.
 */

/**
 * Guarded localStorage helpers (storage can be blocked or full)
 */
function tpStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
}

function tpStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Spawn confetti
 */
function spawnConfetti(count = 50) {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
        piece.style.animationDelay = Math.random() * 0.5 + 's';
        piece.style.width = (Math.random() * 8 + 6) + 'px';
        piece.style.height = (Math.random() * 8 + 6) + 'px';
        container.appendChild(piece);
    }
    setTimeout(() => container.remove(), 4000);
}

/**
 * Daily-goal progress ring (SVG). progress is 0..1.
 */
function createGoalRing(progress, valueText, unitText) {
    const NS = 'http://www.w3.org/2000/svg';
    const r = 40;
    const c = 2 * Math.PI * r;
    const wrap = document.createElement('div');
    wrap.className = 'goal-ring';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', `${valueText} ${unitText}`);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 96 96');
    svg.setAttribute('aria-hidden', 'true');
    const track = document.createElementNS(NS, 'circle');
    const fill = document.createElementNS(NS, 'circle');
    [track, fill].forEach((circle) => {
        circle.setAttribute('cx', '48');
        circle.setAttribute('cy', '48');
        circle.setAttribute('r', String(r));
        svg.appendChild(circle);
    });
    track.setAttribute('class', 'goal-ring-track');
    fill.setAttribute('class', 'goal-ring-fill');
    const p = Math.max(0, Math.min(1, progress || 0));
    fill.setAttribute('stroke-dasharray', c.toFixed(2));
    fill.setAttribute('stroke-dashoffset', (c * (1 - p)).toFixed(2));
    if (p <= 0) fill.style.display = 'none';
    wrap.appendChild(svg);
    const label = document.createElement('div');
    label.className = 'goal-ring-label';
    const value = document.createElement('span');
    value.className = 'goal-ring-value';
    value.textContent = valueText;
    const unit = document.createElement('span');
    unit.className = 'goal-ring-unit';
    unit.textContent = unitText;
    label.appendChild(value);
    label.appendChild(unit);
    wrap.appendChild(label);
    return wrap;
}

/**
 * Dark/Light theme toggle
 */
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    tpStorageSet('typepets-theme', next);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

/**
 * Sound mute — device-level setting in `typepets_sound_muted` ('1' / '0')
 */
function isSoundMuted() {
    return tpStorageGet('typepets_sound_muted') === '1';
}

function applySoundState(muted) {
    const s = window.sound;
    if (s) {
        try {
            if (typeof s.setMuted === 'function') {
                s.setMuted(muted);
            } else {
                s.enabled = !muted;
                if ('muted' in s) s.muted = muted;
            }
        } catch (e) { /* ignore */ }
    }
    const btn = document.getElementById('soundToggle');
    if (btn) {
        btn.textContent = muted ? '🔇' : '🔊';
        btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
        btn.title = muted ? 'Sound is off — click to turn on' : 'Sound is on — click to mute';
    }
}

function toggleSound() {
    const s = window.sound;
    const currentlyMuted = s
        ? (typeof s.muted === 'boolean' ? s.muted : s.enabled === false)
        : isSoundMuted();
    const muted = !currentlyMuted;
    tpStorageSet('typepets_sound_muted', muted ? '1' : '0');
    applySoundState(muted);
}

/**
 * Restore saved theme + sound state on load
 */
(function restoreSettings() {
    const saved = tpStorageGet('typepets-theme');
    if (saved === 'dark' || saved === 'light') {
        document.documentElement.setAttribute('data-theme', saved);
        const btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
    }
    applySoundState(isSoundMuted());
})();

/**
 * Initialize sound on first user interaction
 */
document.addEventListener('click', () => {
    if (window.sound && typeof window.sound.init === 'function') window.sound.init();
}, { once: true });

document.addEventListener('keydown', () => {
    if (window.sound && typeof window.sound.init === 'function') window.sound.init();
}, { once: true });

(function() {
    'use strict';

    const DONATE_URL = 'https://buy.stripe.com/bJecN7fDM1eSeNigYH8EM00';

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function button(className, text, onClick) {
        const b = el('button', className, text);
        b.type = 'button';
        if (onClick) b.addEventListener('click', onClick);
        return b;
    }

    // ─── Modal helper ────────────────────────────────────────

    function openModal(opts) {
        opts = opts || {};
        const overlay = el('div', 'tp-modal-overlay');
        const card = el('div', 'tp-modal' + (opts.className ? ' ' + opts.className : ''));
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        if (opts.label) card.setAttribute('aria-label', opts.label);
        overlay.appendChild(card);
        const prevFocus = document.activeElement;

        function onKey(e) {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
        }
        function close() {
            overlay.remove();
            document.removeEventListener('keydown', onKey, true);
            if (prevFocus && typeof prevFocus.focus === 'function') {
                try { prevFocus.focus(); } catch (e) { /* ignore */ }
            }
        }
        document.addEventListener('keydown', onKey, true);
        // Keep typing inside the modal away from game keyboard handlers
        card.addEventListener('keydown', (e) => e.stopPropagation());
        card.addEventListener('keypress', (e) => e.stopPropagation());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.body.appendChild(overlay);
        return { overlay, card, close };
    }

    // ─── Grown-up gate ───────────────────────────────────────

    /** Ask a simple multiplication question before continuing (keeps little kids out of payment pages). */
    function showParentGate(onPass, opts) {
        opts = opts || {};
        let a, b;
        function newQuestion() {
            a = 6 + Math.floor(Math.random() * 4);
            b = 6 + Math.floor(Math.random() * 4);
            question.textContent = `What is ${a} × ${b}?`;
        }
        const m = openModal({ className: 'parent-gate', label: 'Grown-ups only' });
        m.card.appendChild(el('div', 'tp-modal-emoji', '👋'));
        m.card.appendChild(el('h3', null, 'Grown-ups only'));
        m.card.appendChild(el('p', 'tp-modal-text', opts.reason || 'Please ask a grown-up to answer this to continue.'));
        const question = el('p', 'parent-gate-question');
        m.card.appendChild(question);
        const input = el('input', 'tp-input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.autocomplete = 'off';
        input.setAttribute('aria-label', 'Answer');
        m.card.appendChild(input);
        const err = el('p', 'tp-modal-error');
        err.setAttribute('role', 'alert');
        m.card.appendChild(err);
        let wrong = 0;
        function submit() {
            if (parseInt(input.value, 10) === a * b) {
                m.close();
                onPass();
                return;
            }
            wrong++;
            err.textContent = 'Not quite — please ask a grown-up to help.';
            input.value = '';
            if (wrong % 2 === 0) newQuestion();
            input.focus();
        }
        const actions = el('div', 'tp-modal-actions');
        actions.appendChild(button('btn btn-primary', 'Continue', submit));
        actions.appendChild(button('btn btn-secondary', 'Cancel', m.close));
        m.card.appendChild(actions);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        newQuestion();
        setTimeout(() => input.focus(), 50);
    }

    function showDonateLink() {
        const m = openModal({ className: 'donate-final', label: 'Support TypePets' });
        m.card.appendChild(el('div', 'tp-modal-emoji', '💛'));
        m.card.appendChild(el('h3', null, 'Thank you for supporting TypePets'));
        m.card.appendChild(el('p', 'tp-modal-text',
            'TypePets is free, ad-free and has no tracking. Donations pay for hosting and new lessons. ' +
            "You'll choose an amount on Stripe's secure page — TypePets never sees card details."));
        const actions = el('div', 'tp-modal-actions');
        const link = el('a', 'btn btn-primary', 'Continue to Stripe ↗');
        link.href = DONATE_URL;
        link.target = '_blank';
        link.rel = 'noopener';
        link.setAttribute('data-gate-passed', '1');
        link.addEventListener('click', () => setTimeout(m.close, 100));
        actions.appendChild(link);
        actions.appendChild(button('btn btn-secondary', 'Close', m.close));
        m.card.appendChild(actions);
        setTimeout(() => link.focus(), 50);
    }

    function openDonate() {
        showParentGate(showDonateLink, { reason: 'This link is for grown-ups. Please ask one to answer:' });
    }

    // Every Stripe link on app pages goes through the grown-up gate first.
    document.addEventListener('click', function(e) {
        const a = e.target && e.target.closest ? e.target.closest('a[href*="buy.stripe.com"]') : null;
        if (!a || a.hasAttribute('data-gate-passed')) return;
        e.preventDefault();
        e.stopPropagation();
        openDonate();
    }, true);

    window.showParentGate = showParentGate;
    window.openDonate = openDonate;
    window.tpOpenModal = openModal;

    // ─── Mobile navigation ───────────────────────────────────

    function initNav() {
        const nav = document.querySelector('.main-nav');
        if (!nav) return;
        const links = nav.querySelector('.nav-links');
        if (!links) return;

        // Highlight the current page
        const page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
        links.querySelectorAll('a.nav-link').forEach((a) => {
            const target = (a.getAttribute('href') || '').split('/').pop().replace(/\.html$/, '');
            if (target && target === page) {
                a.classList.add('active');
                a.setAttribute('aria-current', 'page');
            }
        });

        if (!links.id) links.id = 'navLinks';

        // Support link inside the mobile menu (the nav button is hidden on phones)
        const support = el('a', 'nav-link nav-link-support', '💛 Support TypePets');
        support.href = DONATE_URL;
        support.target = '_blank';
        support.rel = 'noopener';
        links.appendChild(support);

        const burger = button('nav-burger', '☰');
        burger.setAttribute('aria-label', 'Menu');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-controls', links.id);
        nav.insertBefore(burger, nav.firstChild);

        function setOpen(open) {
            nav.classList.toggle('nav-open', open);
            burger.setAttribute('aria-expanded', open ? 'true' : 'false');
            burger.textContent = open ? '✕' : '☰';
        }
        burger.addEventListener('click', (e) => {
            e.stopPropagation();
            setOpen(!nav.classList.contains('nav-open'));
        });
        links.addEventListener('click', (e) => {
            if (e.target.closest('a')) setOpen(false);
        });
        document.addEventListener('click', (e) => {
            if (nav.classList.contains('nav-open') && !nav.contains(e.target)) setOpen(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && nav.classList.contains('nav-open')) setOpen(false);
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth > 600 && nav.classList.contains('nav-open')) setOpen(false);
        });
    }

    // ─── Profile switcher ────────────────────────────────────

    let profileMenu = null;
    let profileChip = null;

    function closeProfileMenu() {
        if (profileMenu) {
            profileMenu.remove();
            profileMenu = null;
        }
        if (profileChip) profileChip.setAttribute('aria-expanded', 'false');
    }

    function switchTo(id) {
        if (TypePetsData.switchProfile(id)) {
            location.reload();
        } else {
            showToast("Couldn't switch players — storage is blocked.", 'error');
        }
    }

    function toggleProfileMenu() {
        if (profileMenu) { closeProfileMenu(); return; }
        const profs = TypePetsData.getProfiles();
        const menu = el('div', 'profile-menu');
        menu.setAttribute('role', 'menu');
        menu.appendChild(el('div', 'profile-menu-title', "Who's typing?"));

        profs.list.forEach((p) => {
            const row = el('div', 'profile-row' + (p.active ? ' active' : ''));
            const pick = button('profile-pick', null, () => {
                if (p.active) { closeProfileMenu(); return; }
                switchTo(p.id);
            });
            pick.setAttribute('role', 'menuitem');
            pick.appendChild(el('span', 'profile-avatar', p.avatar));
            pick.appendChild(el('span', 'profile-name', p.name));
            if (p.active) pick.appendChild(el('span', 'profile-check', '✓'));
            const edit = button('profile-edit', '✏️', () => {
                closeProfileMenu();
                openProfileEditor(p, profs);
            });
            edit.setAttribute('aria-label', 'Edit ' + p.name);
            edit.title = 'Edit ' + p.name;
            row.appendChild(pick);
            row.appendChild(edit);
            menu.appendChild(row);
        });

        const full = profs.list.length >= profs.max;
        const add = button('profile-add', full ? `${profs.max} players max` : '➕ Add player', () => {
            closeProfileMenu();
            openProfileEditor(null, profs);
        });
        add.disabled = full;
        menu.appendChild(add);
        menu.appendChild(el('div', 'profile-menu-note', 'Each player gets their own pet and progress on this device.'));

        menu.addEventListener('click', (e) => e.stopPropagation());
        document.body.appendChild(menu);
        const r = profileChip.getBoundingClientRect();
        menu.style.top = Math.round(r.bottom + 8) + 'px';
        menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
        profileChip.setAttribute('aria-expanded', 'true');
        profileMenu = menu;
        const first = menu.querySelector('button');
        if (first) first.focus();
    }

    function openProfileEditor(profile, profs) {
        const isNew = !profile;
        const m = openModal({ className: 'profile-editor', label: isNew ? 'New player' : 'Edit player' });
        const used = new Set(profs.list.map((p) => p.avatar));
        let chosen = isNew ? (profs.avatars.find((a) => !used.has(a)) || profs.avatars[0]) : profile.avatar;

        function renderForm() {
            m.card.textContent = '';
            m.card.appendChild(el('h3', null, isNew ? 'New player' : 'Edit player'));
            const label = el('label', 'tp-field-label', 'Name');
            const input = el('input', 'tp-input');
            input.type = 'text';
            input.maxLength = 20;
            input.autocomplete = 'off';
            input.placeholder = 'Your name';
            input.value = isNew ? '' : profile.name;
            label.appendChild(input);
            m.card.appendChild(label);

            m.card.appendChild(el('div', 'tp-field-label', 'Pick an avatar'));
            const grid = el('div', 'avatar-grid');
            profs.avatars.forEach((a) => {
                const b = button('avatar-choice' + (a === chosen ? ' selected' : ''), a, () => {
                    chosen = a;
                    grid.querySelectorAll('.avatar-choice').forEach((x) => {
                        const on = x.textContent === a;
                        x.classList.toggle('selected', on);
                        x.setAttribute('aria-pressed', on ? 'true' : 'false');
                    });
                });
                b.setAttribute('aria-pressed', a === chosen ? 'true' : 'false');
                b.setAttribute('aria-label', 'Avatar ' + a);
                grid.appendChild(b);
            });
            m.card.appendChild(grid);

            const err = el('p', 'tp-modal-error');
            err.setAttribute('role', 'alert');
            m.card.appendChild(err);

            function save() {
                const name = input.value.trim();
                if (!name) { err.textContent = 'Please type a name.'; input.focus(); return; }
                if (isNew) {
                    const r = TypePetsData.addProfile(name, chosen);
                    if (!r.ok) {
                        err.textContent = r.error === 'max' ? `You can have up to ${profs.max} players.` : "Couldn't save — storage is full or blocked.";
                        return;
                    }
                    switchTo(r.profile.id);
                } else {
                    const r = TypePetsData.renameProfile(profile.id, name, chosen);
                    if (!r.ok) { err.textContent = "Couldn't save — storage is full or blocked."; return; }
                    if (profile.active) {
                        location.reload();
                    } else {
                        m.close();
                        showToast('Saved ' + r.profile.name, 'success');
                    }
                }
            }
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

            const actions = el('div', 'tp-modal-actions');
            actions.appendChild(button('btn btn-primary', isNew ? 'Create player' : 'Save', save));
            actions.appendChild(button('btn btn-secondary', 'Cancel', m.close));
            m.card.appendChild(actions);

            if (!isNew && profs.list.length > 1) {
                m.card.appendChild(button('profile-delete-link', '🗑️ Delete this player', renderConfirmDelete));
            }
            setTimeout(() => input.focus(), 50);
        }

        function renderConfirmDelete() {
            m.card.textContent = '';
            m.card.appendChild(el('div', 'tp-modal-emoji', '⚠️'));
            m.card.appendChild(el('h3', null, `Delete ${profile.name}?`));
            m.card.appendChild(el('p', 'tp-modal-text',
                `This erases ${profile.name}'s pet, badges and progress from this device. It can't be undone.`));
            m.card.appendChild(el('p', 'tp-modal-hint', 'Tip: download a backup on the Stats page first.'));
            const actions = el('div', 'tp-modal-actions');
            actions.appendChild(button('btn btn-danger', 'Yes, delete', () => {
                const r = TypePetsData.deleteProfile(profile.id);
                if (!r.ok) {
                    showToast(r.error === 'last' ? "You can't delete the only player." : "Couldn't delete — storage is blocked.", 'error');
                    m.close();
                    return;
                }
                if (r.was_current) {
                    location.reload();
                } else {
                    m.close();
                    showToast(profile.name + ' was deleted', 'info');
                }
            }));
            actions.appendChild(button('btn btn-secondary', 'Keep', renderForm));
            m.card.appendChild(actions);
        }

        renderForm();
    }

    function initProfileChip() {
        const chip = document.querySelector('.main-nav .nav-user');
        if (!chip || typeof TypePetsData === 'undefined') return;
        const prof = TypePetsData.getActiveProfile();

        let nameEl = chip.querySelector('#userName');
        if (!nameEl) {
            nameEl = el('span');
            nameEl.id = 'userName';
            chip.appendChild(nameEl);
        }
        nameEl.classList.add('nav-user-name');
        nameEl.textContent = prof.name;

        const avatar = el('span', 'nav-user-avatar', prof.avatar);
        avatar.setAttribute('aria-hidden', 'true');
        chip.insertBefore(avatar, chip.firstChild);
        const caret = el('span', 'nav-user-caret', '▾');
        caret.setAttribute('aria-hidden', 'true');
        chip.appendChild(caret);

        chip.classList.add('nav-user-switcher');
        chip.setAttribute('role', 'button');
        chip.tabIndex = 0;
        chip.setAttribute('aria-haspopup', 'menu');
        chip.setAttribute('aria-expanded', 'false');
        chip.setAttribute('aria-label', `Player: ${prof.name}. Switch player`);
        chip.title = 'Switch player';
        profileChip = chip;

        chip.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
        chip.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleProfileMenu(); }
        });
        document.addEventListener('click', closeProfileMenu);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProfileMenu(); });
        window.addEventListener('resize', closeProfileMenu);
    }

    // ─── Ask the browser to keep our data (once, after real progress) ─

    function requestPersistentStorage() {
        try {
            if (!navigator.storage || typeof navigator.storage.persist !== 'function') return;
            if (tpStorageGet('typepets_persist_requested')) return;
            if (typeof TypePetsData === 'undefined' || TypePetsData.getSessions(1).length === 0) return;
            tpStorageSet('typepets_persist_requested', '1');
            const check = typeof navigator.storage.persisted === 'function' ? navigator.storage.persisted() : Promise.resolve(false);
            check.then((already) => already || navigator.storage.persist()).catch(() => {});
        } catch (e) { /* ignore */ }
    }

    initNav();
    initProfileChip();
    requestPersistentStorage();
})();
