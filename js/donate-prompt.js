/**
 * Donate prompt — shown after achievement moments.
 * Non-intrusive, dismissible, only shows occasionally.
 */
(function() {
    const DONATE_URL = 'https://buy.stripe.com/bJecN7fDM1eSeNigYH8EM00';
    const STORAGE_KEY = 'typepets_donate';
    const SHOW_EVERY_N = 3; // Show after every N achievements
    const COOLDOWN_HOURS = 12; // Don't show again within this window

    function getDonateState() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { count: 0, lastShown: 0, dismissed: 0 };
        } catch { return { count: 0, lastShown: 0, dismissed: 0 }; }
    }

    function saveDonateState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function shouldShow() {
        const state = getDonateState();
        state.count++;
        saveDonateState(state);

        // First time — always show (welcome prompt)
        if (state.count === 1) return true;

        // Then every N achievements
        if (state.count % SHOW_EVERY_N !== 0) return false;

        // Cooldown — don't nag
        const hoursSinceLast = (Date.now() - state.lastShown) / (1000 * 60 * 60);
        if (hoursSinceLast < COOLDOWN_HOURS) return false;

        return true;
    }

    function createPrompt() {
        const overlay = document.createElement('div');
        overlay.id = 'donatePrompt';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.4); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            animation: dpFadeIn 0.3s ease;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
            background: white; border-radius: 16px; padding: 32px;
            max-width: 380px; width: 90%; text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            animation: dpSlideUp 0.4s ease;
            font-family: 'Nunito', sans-serif;
        `;

        card.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 12px;">💛</div>
            <h3 style="margin: 0 0 8px; font-family: 'Fredoka', sans-serif; color: #2D3748; font-size: 22px;">
                You're doing great!
            </h3>
            <p style="margin: 0 0 20px; color: #6B7280; font-size: 15px; line-height: 1.5;">
                TypePets is free and ad-free. If you enjoy it, a small donation helps us build more games and features.
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <a href="${DONATE_URL}" target="_blank" rel="noopener"
                   style="background: #F6C255; color: #7C5C00; border: none; padding: 10px 24px;
                          border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer;
                          text-decoration: none; display: inline-block;">
                    Support TypePets
                </a>
                <button id="dpDismiss"
                   style="background: #F0F2F5; color: #6B7280; border: none; padding: 10px 20px;
                          border-radius: 8px; font-size: 15px; cursor: pointer;">
                    Maybe later
                </button>
            </div>
        `;

        overlay.appendChild(card);

        // Style injection
        if (!document.getElementById('dpStyles')) {
            const style = document.createElement('style');
            style.id = 'dpStyles';
            style.textContent = `
                @keyframes dpFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes dpSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);

        // Dismiss handlers
        document.getElementById('dpDismiss').onclick = () => dismiss(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) dismiss(overlay); };
    }

    function dismiss(overlay) {
        overlay.style.animation = 'dpFadeIn 0.2s ease reverse';
        setTimeout(() => overlay.remove(), 200);
        const state = getDonateState();
        state.dismissed++;
        state.lastShown = Date.now();
        saveDonateState(state);
    }

    /**
     * Call this after achievement moments.
     * It internally tracks frequency and cooldown — safe to call often.
     */
    window.maybeDonatePrompt = function() {
        if (shouldShow()) {
            // Delay slightly so the achievement celebration plays first
            setTimeout(createPrompt, 1500);
        }
    };
})();
