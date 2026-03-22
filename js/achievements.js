/**
 * Achievement System for TypePets
 * Checks for new badges after every session and shows notifications
 */

const BADGES = {
    first_steps:    { emoji: '🏁', name: 'First Steps',     desc: 'Complete your first lesson!' },
    home_row_hero:  { emoji: '⌨️', name: 'Home Row Hero',   desc: 'Master home row with 95%+ accuracy' },
    on_fire:        { emoji: '🔥', name: 'On Fire',          desc: '3-day practice streak!' },
    unstoppable:    { emoji: '🌋', name: 'Unstoppable',      desc: '7-day practice streak!' },
    speed_demon:    { emoji: '⚡', name: 'Speed Demon',      desc: 'Reach 20 WPM' },
    rocket:         { emoji: '🚀', name: 'Rocket',           desc: 'Reach 40 WPM' },
    sniper:         { emoji: '🎯', name: 'Sniper',           desc: '100% accuracy in a session' },
    perfectionist:  { emoji: '💯', name: 'Perfectionist',    desc: '5 sessions with 100% accuracy' },
    bubble_master:  { emoji: '🫧', name: 'Bubble Master',    desc: 'Score 1000+ in Bubble Pop' },
    pet_parent:     { emoji: '🐣', name: 'Pet Parent',       desc: 'Name your pet' }
};

/**
 * Check achievements after a session
 */
function checkAchievements(sessionData) {
    const newBadges = [];

    // First Steps
    if (!TypePetsData.hasAchievement('first_steps')) {
        newBadges.push('first_steps');
    }

    // Home Row Hero
    if (!TypePetsData.hasAchievement('home_row_hero') && sessionData.mode === 'finger_training' && sessionData.level === 1 && sessionData.accuracy >= 95) {
        newBadges.push('home_row_hero');
    }

    // Speed Demon
    if (!TypePetsData.hasAchievement('speed_demon') && sessionData.wpm >= 20) {
        newBadges.push('speed_demon');
    }

    // Rocket
    if (!TypePetsData.hasAchievement('rocket') && sessionData.wpm >= 40) {
        newBadges.push('rocket');
    }

    // Sniper
    if (!TypePetsData.hasAchievement('sniper') && sessionData.accuracy >= 100) {
        newBadges.push('sniper');
    }

    // Perfectionist
    if (!TypePetsData.hasAchievement('perfectionist')) {
        const sessions = TypePetsData.getSessions(100);
        const perfectCount = sessions.filter(s => s.accuracy >= 100).length;
        if (perfectCount >= 5) newBadges.push('perfectionist');
    }

    // Bubble Master
    if (!TypePetsData.hasAchievement('bubble_master') && sessionData.mode === 'bubble_pop' && (sessionData.score || 0) >= 1000) {
        newBadges.push('bubble_master');
    }

    // On Fire (3-day streak)
    if (!TypePetsData.hasAchievement('on_fire')) {
        const streaks = TypePetsData.getStreaks();
        if (streaks.current_streak >= 3) newBadges.push('on_fire');
    }

    // Unstoppable (7-day streak)
    if (!TypePetsData.hasAchievement('unstoppable')) {
        const streaks = TypePetsData.getStreaks();
        if (streaks.current_streak >= 7) newBadges.push('unstoppable');
    }

    // Pet Parent
    if (!TypePetsData.hasAchievement('pet_parent') && sessionData.mode === 'pet_name') {
        newBadges.push('pet_parent');
    }

    // Award new badges
    for (const badgeId of newBadges) {
        TypePetsData.awardAchievement(badgeId);
        showAchievementUnlock(badgeId);
    }

    return newBadges;
}

/**
 * Show achievement unlock notification
 */
function showAchievementUnlock(badgeId) {
    const badge = BADGES[badgeId];
    if (!badge) return;

    if (window.sound) window.sound.celebration();
    spawnConfetti(80);

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast achievement achievement-unlock';
    toast.innerHTML = `
        <div class="achievement-toast-content">
            <div class="achievement-toast-icon">${badge.emoji}</div>
            <div class="achievement-toast-text">
                <div class="achievement-toast-label">Badge Unlocked</div>
                <div class="achievement-toast-name">${badge.name}</div>
                <div class="achievement-toast-desc">${badge.desc}</div>
            </div>
        </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

/**
 * Render badge gallery for dashboard
 */
function renderBadgeGallery(container) {
    const earned = TypePetsData.getAchievements();
    const earnedSet = new Set(earned.map(a => a.badge_id));

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'badge-gallery';

    for (const [badgeId, badge] of Object.entries(BADGES)) {
        const isEarned = earnedSet.has(badgeId);
        const earnedData = earned.find(a => a.badge_id === badgeId);

        const card = document.createElement('div');
        card.className = `badge-card ${isEarned ? 'badge-earned' : 'badge-locked'}`;
        card.innerHTML = `
            <div class="badge-icon">${isEarned ? badge.emoji : '🔒'}</div>
            <div class="badge-name">${badge.name}</div>
            <div class="badge-desc">${badge.desc}</div>
            ${isEarned && earnedData ? `<div class="badge-date">${new Date(earnedData.earned_at).toLocaleDateString()}</div>` : ''}
        `;
        grid.appendChild(card);
    }

    container.appendChild(grid);
}

window.BADGES = BADGES;
window.checkAchievements = checkAchievements;
window.renderBadgeGallery = renderBadgeGallery;
window.showAchievementUnlock = showAchievementUnlock;
