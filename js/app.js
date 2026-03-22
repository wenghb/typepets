/**
 * TypePets — Main application module
 */

/**
 * Show a toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
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
 * Dark/Light theme toggle
 */
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('typepets-theme', next);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

function toggleSound() {
    if (window.sound) {
        const enabled = window.sound.toggle();
        const btn = document.getElementById('soundToggle');
        if (btn) btn.textContent = enabled ? '🔊' : '🔇';
    }
}

/**
 * Restore saved theme on load
 */
(function restoreTheme() {
    const saved = localStorage.getItem('typepets-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        const btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
    }
})();

/**
 * Initialize sound on first user interaction
 */
document.addEventListener('click', () => {
    if (window.sound) window.sound.init();
}, { once: true });

document.addEventListener('keydown', () => {
    if (window.sound) window.sound.init();
}, { once: true });

/**
 * Update user display in nav
 */
(function updateUserDisplay() {
    const user = TypePetsData.getUser();
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = user.nickname;
})();
