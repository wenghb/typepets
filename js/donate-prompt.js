/**
 * Donate prompt — a gentle note for grown-ups.
 *
 * - Never interrupts a game: it only renders into a page's `#donateSlot`
 *   element (home + dashboard). On every other page `maybeDonatePrompt()` is a no-op.
 * - At most once every 7 days, and only after real progress
 *   (10+ sessions on 3+ different days and 2+ badges).
 * - The Stripe link sits behind the grown-up gate (see app.js `openDonate`).
 */
(function() {
    const STORAGE_KEY = 'typepets_donate';
    const DAY_MS = 86400000;
    const COOLDOWN_DAYS = 7;
    const BACKOFF_DAYS = 30;       // after 3 "not now"s
    const AFTER_SUPPORT_DAYS = 180; // after they clicked Support

    function getState() {
        try {
            const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return (s && typeof s === 'object') ? s : {};
        } catch (e) { return {}; }
    }

    function saveState(state) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }

    function hasRealMilestones() {
        if (typeof TypePetsData === 'undefined') return false;
        const stats = TypePetsData.getStats();
        return stats.total_sessions >= 10 && stats.practice_days >= 3 && stats.badges >= 2;
    }

    function shouldShow() {
        const s = getState();
        const now = Date.now();
        const since = (t) => (typeof t === 'number' && t > 0) ? now - t : Infinity;
        if (since(s.supported) < AFTER_SUPPORT_DAYS * DAY_MS) return false;
        if (since(s.lastShown) < COOLDOWN_DAYS * DAY_MS) return false;
        if ((s.dismissed || 0) >= 3 && since(s.lastShown) < BACKOFF_DAYS * DAY_MS) return false;
        return hasRealMilestones();
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function render(slot) {
        const stats = TypePetsData.getStats();
        const user = TypePetsData.getUser();
        const name = user.nickname && user.nickname !== 'Player' ? user.nickname : 'Your child';

        const card = el('aside', 'donate-card');
        card.setAttribute('aria-label', 'A note for grown-ups');
        card.appendChild(el('div', 'donate-card-label', 'For grown-ups'));
        card.appendChild(el('h3', 'donate-card-title',
            `💛 ${name} has practiced ${stats.total_sessions} times and earned ${stats.badges} badges`));
        card.appendChild(el('p', 'donate-card-text',
            "TypePets is free, with no ads, no accounts and no tracking. If it's helping with typing, " +
            'a small donation keeps it that way.'));

        const actions = el('div', 'donate-card-actions');
        const support = el('button', 'btn btn-primary', 'Support TypePets');
        support.type = 'button';
        support.addEventListener('click', () => {
            const s = getState();
            s.supported = Date.now();
            saveState(s);
            card.remove();
            if (typeof window.openDonate === 'function') window.openDonate();
        });
        const later = el('button', 'btn btn-secondary', 'Not now');
        later.type = 'button';
        later.addEventListener('click', () => {
            const s = getState();
            s.dismissed = (s.dismissed || 0) + 1;
            s.lastShown = Date.now();
            saveState(s);
            card.remove();
        });
        actions.appendChild(support);
        actions.appendChild(later);
        card.appendChild(actions);

        slot.appendChild(card);
        const s = getState();
        s.lastShown = Date.now();
        saveState(s);
    }

    /**
     * Safe to call from anywhere. Only home/dashboard (pages with #donateSlot) ever show anything.
     */
    window.maybeDonatePrompt = function() {
        try {
            const slot = document.getElementById('donateSlot');
            if (!slot || slot.childElementCount > 0) return;
            if (shouldShow()) render(slot);
        } catch (e) { /* never break the page for this */ }
    };
})();
