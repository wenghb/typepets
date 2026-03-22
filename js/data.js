/**
 * TypePets — localStorage Data Layer
 * All data operations for the static site. No server needed.
 * Data version for future migration support.
 */

const TypePetsData = (function() {
    'use strict';

    const DATA_VERSION = 1;
    const STORAGE_KEY = 'typepets_data';

    // ─── Default Data Structure ──────────────────────────────

    function getDefaultData() {
        return {
            version: DATA_VERSION,
            user: {
                nickname: 'Player',
                avatar: 'default',
                created_at: new Date().toISOString()
            },
            training: {
                max_stage: 0,
                stages: {} // { stageId: { bestAccuracy, stars, unlocked } }
            },
            bubbles: {
                max_level: 1,
                speed_preference: 1.0,
                personal_best: 0
            },
            pet: {
                name: 'Unnamed',
                species: 'egg',
                level: 1,
                xp: 0,
                hunger: 100,
                happiness: 100,
                last_fed: new Date().toISOString()
            },
            sessions: [],     // { mode, level, wpm, accuracy, duration, keys_pressed, errors, error_keys, score, speed_multiplier, timestamp }
            achievements: [],  // { badge_id, earned_at }
            streaks: {
                current_streak: 0,
                longest_streak: 0,
                last_practice_date: null
            },
            activities: [],   // { type, description, xp, extra, timestamp }
            articles: {
                completed: [],    // array of article IDs
                bests: {}         // { articleId: { best_wpm, best_accuracy, best_time, attempts } }
            },
            milestones: []    // { reward_id, created_at }
        };
    }

    // ─── Load / Save ─────────────────────────────────────────

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return getDefaultData();
            const data = JSON.parse(raw);
            if (data.version !== DATA_VERSION) {
                return migrateData(data);
            }
            return data;
        } catch (e) {
            console.error('Failed to load data:', e);
            return getDefaultData();
        }
    }

    function saveData(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    }

    function migrateData(data) {
        // Future: handle version migrations
        // For now, just return defaults if version mismatch
        console.warn('Data version mismatch, resetting to defaults');
        return getDefaultData();
    }

    let _data = loadData();

    function _save() {
        saveData(_data);
    }

    // ─── User ────────────────────────────────────────────────

    function getUser() {
        return { ..._data.user };
    }

    function setNickname(nickname) {
        _data.user.nickname = nickname;
        _save();
        return getUser();
    }

    function setAvatar(avatar) {
        _data.user.avatar = avatar;
        _save();
        return getUser();
    }

    // ─── Training Stages ─────────────────────────────────────

    function getTrainingProgress() {
        return {
            max_stage: _data.training.max_stage,
            stages: { ..._data.training.stages }
        };
    }

    function getTrainingStage() {
        return { max_stage: _data.training.max_stage };
    }

    function saveTrainingStage(stage) {
        if (stage > _data.training.max_stage) {
            _data.training.max_stage = stage;
        }
        _save();
        return { max_stage: _data.training.max_stage };
    }

    function saveTrainingStageProgress(stageId, bestAccuracy, stars, unlocked) {
        if (!_data.training.stages[stageId]) {
            _data.training.stages[stageId] = { bestAccuracy: 0, stars: 0, unlocked: false };
        }
        const s = _data.training.stages[stageId];
        if (bestAccuracy > s.bestAccuracy) s.bestAccuracy = bestAccuracy;
        if (stars > s.stars) s.stars = stars;
        if (unlocked) s.unlocked = true;
        _save();
    }

    // ─── Bubble Pop ──────────────────────────────────────────

    function getBubbleLevel() {
        return { max_level: _data.bubbles.max_level };
    }

    function saveBubbleLevel(level) {
        if (level > _data.bubbles.max_level) {
            _data.bubbles.max_level = level;
        }
        _save();
        return { max_level: _data.bubbles.max_level };
    }

    function getBubblePersonalBest() {
        return _data.bubbles.personal_best;
    }

    function saveBubblePersonalBest(score) {
        if (score > _data.bubbles.personal_best) {
            _data.bubbles.personal_best = score;
        }
        _save();
        return _data.bubbles.personal_best;
    }

    function getSpeedPreference() {
        return _data.bubbles.speed_preference;
    }

    function saveSpeedPreference(speed) {
        _data.bubbles.speed_preference = speed;
        _save();
    }

    // ─── Pet ─────────────────────────────────────────────────

    const EVO_THRESHOLDS = [
        { xp: 10000, species: 'master', level: 6 },
        { xp: 4000,  species: 'adult',  level: 5 },
        { xp: 1500,  species: 'teen',   level: 4 },
        { xp: 500,   species: 'kid',    level: 3 },
        { xp: 100,   species: 'baby',   level: 2 },
        { xp: 0,     species: 'egg',    level: 1 },
    ];

    function getPet() {
        return { ..._data.pet };
    }

    function feedPet() {
        _data.pet.hunger = Math.min(100, _data.pet.hunger + 20);
        _data.pet.last_fed = new Date().toISOString();
        _save();
        return getPet();
    }

    function namePet(name) {
        _data.pet.name = name;
        _save();
        return getPet();
    }

    function addPetXp(amount) {
        _data.pet.xp += amount;
        // Check evolution
        for (const threshold of EVO_THRESHOLDS) {
            if (_data.pet.xp >= threshold.xp) {
                _data.pet.species = threshold.species;
                _data.pet.level = threshold.level;
                break;
            }
        }
        _save();
        return getPet();
    }

    function addPetHappiness(amount) {
        _data.pet.happiness = Math.min(100, _data.pet.happiness + amount);
        _save();
        return getPet();
    }

    // ─── Sessions ────────────────────────────────────────────

    function saveSession(sessionData) {
        const session = {
            mode: sessionData.mode,
            level: sessionData.level || 1,
            wpm: sessionData.wpm || 0,
            accuracy: sessionData.accuracy || 0,
            duration_seconds: sessionData.duration_seconds || 0,
            keys_pressed: sessionData.keys_pressed || 0,
            errors: sessionData.errors || 0,
            error_keys: sessionData.error_keys || {},
            score: sessionData.score || 0,
            speed_multiplier: sessionData.speed_multiplier || 1.0,
            timestamp: new Date().toISOString()
        };

        _data.sessions.push(session);

        // Keep max 500 sessions
        if (_data.sessions.length > 500) {
            _data.sessions = _data.sessions.slice(-500);
        }

        // Update streak
        updateStreak();

        // Add XP to pet
        let xpEarned = 0;
        const speedMultiplier = sessionData.speed_multiplier || 1.0;

        if (session.mode === 'finger_training') {
            xpEarned = 20;
        } else if (session.mode === 'bubble_pop') {
            const baseXp = Math.max(1, Math.floor((sessionData.score || sessionData.wpm || 0) / 10));
            if (speedMultiplier >= 2.0) xpEarned = Math.floor(baseXp * 2.0);
            else if (speedMultiplier >= 1.5) xpEarned = Math.floor(baseXp * 1.5);
            else if (speedMultiplier >= 1.25) xpEarned = Math.floor(baseXp * 1.25);
            else xpEarned = baseXp;
        } else if (session.mode === 'article') {
            xpEarned = Math.max(5, Math.floor((sessionData.wpm || 0) * 0.5));
        } else {
            xpEarned = Math.floor(sessionData.wpm || 0);
        }

        addPetXp(xpEarned);

        // Log activity
        if (session.mode === 'finger_training') {
            const stage = session.level;
            const acc = session.accuracy;
            if (acc >= 85) {
                addActivity('training', `Completed Training Stage ${stage}`, xpEarned, { stage, accuracy: acc });
                saveTrainingStage(stage);
            }
        } else if (session.mode === 'bubble_pop') {
            addActivity('bubble', `Played Bubble Level ${session.level}`, xpEarned, { level: session.level, score: session.score, speed: speedMultiplier });
        } else if (session.mode === 'article') {
            addActivity('article', `Typed article`, xpEarned, { article_id: session.level, wpm: session.wpm });
        }

        // Check bubble milestone rewards
        const milestoneRewards = [];
        if (session.mode === 'bubble_pop') {
            const MILESTONES = {
                5:  { id: 'golden_apple', name: 'Golden Apple', happiness: 50 },
                10: { id: 'star_cookie',  name: 'Star Cookie',  happiness: 100 },
                15: { id: 'rainbow_cake', name: 'Rainbow Cake', happiness: 150 },
                20: { id: 'crown',        name: 'Crown',        happiness: 0 },
            };
            for (const [milestoneLevel, reward] of Object.entries(MILESTONES)) {
                if (session.level >= parseInt(milestoneLevel)) {
                    const awarded = awardMilestone(reward.id);
                    if (awarded) {
                        milestoneRewards.push(reward);
                        if (reward.happiness > 0) {
                            addPetHappiness(reward.happiness);
                        }
                        addActivity('milestone', `Earned ${reward.name}!`, 0, { reward_id: reward.id, level: parseInt(milestoneLevel) });
                    }
                }
            }
        }

        _save();

        return {
            session_id: _data.sessions.length,
            xp_earned: xpEarned,
            milestone_rewards: milestoneRewards
        };
    }

    function getSessions(limit) {
        limit = limit || 50;
        const sorted = [..._data.sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return sorted.slice(0, limit);
    }

    // ─── Streaks ─────────────────────────────────────────────

    function updateStreak() {
        const today = new Date().toISOString().split('T')[0];
        const s = _data.streaks;
        const lastDate = s.last_practice_date;

        if (lastDate === today) {
            // Already practiced today
        } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            if (lastDate === yesterday) {
                s.current_streak++;
            } else {
                s.current_streak = 1;
            }
        }

        s.longest_streak = Math.max(s.longest_streak, s.current_streak);
        s.last_practice_date = today;
        _save();
    }

    function getStreaks() {
        return { ..._data.streaks };
    }

    // ─── Achievements ────────────────────────────────────────

    function getAchievements() {
        return [..._data.achievements];
    }

    function awardAchievement(badgeId) {
        if (_data.achievements.some(a => a.badge_id === badgeId)) {
            return false; // Already earned
        }
        _data.achievements.push({
            badge_id: badgeId,
            earned_at: new Date().toISOString()
        });
        _save();
        return true;
    }

    function hasAchievement(badgeId) {
        return _data.achievements.some(a => a.badge_id === badgeId);
    }

    // ─── Activities ──────────────────────────────────────────

    function addActivity(type, description, xp, extra) {
        _data.activities.push({
            type: type,
            description: description,
            xp_earned: xp || 0,
            extra: extra || {},
            timestamp: new Date().toISOString()
        });
        // Keep max 200 activities
        if (_data.activities.length > 200) {
            _data.activities = _data.activities.slice(-200);
        }
        _save();
    }

    function getRecentActivities(limit) {
        limit = limit || 5;
        const sorted = [..._data.activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return sorted.slice(0, limit);
    }

    // ─── Articles ────────────────────────────────────────────

    function getCompletedArticles() {
        return [..._data.articles.completed];
    }

    function markArticleCompleted(articleId) {
        if (!_data.articles.completed.includes(articleId)) {
            _data.articles.completed.push(articleId);
        }
        _save();
    }

    function getArticleBest(articleId) {
        return _data.articles.bests[articleId] || { best_wpm: 0, best_accuracy: 0, best_time: 0, attempts: 0 };
    }

    function updateArticleBest(articleId, wpm, accuracy, time) {
        if (!_data.articles.bests[articleId]) {
            _data.articles.bests[articleId] = { best_wpm: 0, best_accuracy: 0, best_time: 0, attempts: 0 };
        }
        const b = _data.articles.bests[articleId];
        b.attempts++;
        if (wpm > b.best_wpm) b.best_wpm = wpm;
        if (accuracy > b.best_accuracy) b.best_accuracy = accuracy;
        if (b.best_time === 0 || time < b.best_time) b.best_time = time;
        _save();
        return b;
    }

    // ─── Milestones ──────────────────────────────────────────

    function getMilestones() {
        return [..._data.milestones];
    }

    function awardMilestone(rewardId) {
        if (_data.milestones.some(m => m.reward_id === rewardId)) {
            return false;
        }
        _data.milestones.push({
            reward_id: rewardId,
            created_at: new Date().toISOString()
        });
        _save();
        return true;
    }

    function hasMilestone(rewardId) {
        return _data.milestones.some(m => m.reward_id === rewardId);
    }

    // ─── Stats ───────────────────────────────────────────────

    function getStats() {
        const sessions = _data.sessions;
        const totalSessions = sessions.length;
        const totalKeys = sessions.reduce((s, x) => s + (x.keys_pressed || 0), 0);
        const totalTime = sessions.reduce((s, x) => s + (x.duration_seconds || 0), 0);
        const wpmValues = sessions.filter(s => s.wpm > 0).map(s => s.wpm);
        const accValues = sessions.filter(s => s.accuracy > 0).map(s => s.accuracy);

        const avgWpm = wpmValues.length > 0 ? Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length * 10) / 10 : 0;
        const avgAccuracy = accValues.length > 0 ? Math.round(accValues.reduce((a, b) => a + b, 0) / accValues.length * 10) / 10 : 0;
        const bestWpm = wpmValues.length > 0 ? Math.round(Math.max(...wpmValues) * 10) / 10 : 0;

        // Today's stats
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = sessions.filter(s => s.timestamp && s.timestamp.startsWith(today));

        const streaks = getStreaks();
        const pet = getPet();

        // Finger training progress
        const fingerSessions = sessions.filter(s => s.mode === 'finger_training');
        const fingerProgress = {};
        fingerSessions.forEach(s => {
            if (!fingerProgress[s.level] || s.accuracy > fingerProgress[s.level]) {
                fingerProgress[s.level] = s.accuracy;
            }
        });

        return {
            total_sessions: totalSessions,
            total_keys: totalKeys,
            total_time: totalTime,
            avg_wpm: avgWpm,
            avg_accuracy: avgAccuracy,
            best_wpm: bestWpm,
            current_streak: streaks.current_streak,
            longest_streak: streaks.longest_streak,
            pet: pet,
            today: {
                sessions_today: todaySessions.length,
                keys_today: todaySessions.reduce((s, x) => s + (x.keys_pressed || 0), 0),
                time_today: todaySessions.reduce((s, x) => s + (x.duration_seconds || 0), 0)
            },
            finger_progress: fingerProgress
        };
    }

    function getWeakness() {
        const combined = {};
        _data.sessions.forEach(s => {
            if (s.error_keys && typeof s.error_keys === 'object') {
                for (const [key, count] of Object.entries(s.error_keys)) {
                    combined[key] = (combined[key] || 0) + count;
                }
            }
        });
        const sortedKeys = Object.entries(combined).sort((a, b) => b[1] - a[1]);
        return {
            weak_keys: sortedKeys.slice(0, 10),
            total_errors: Object.values(combined).reduce((a, b) => a + b, 0)
        };
    }

    // ─── Integrated Progress (for home page) ─────────────────

    function getIntegratedProgress() {
        const articlesCompleted = _data.articles.completed.length;
        const pet = getPet();
        const recentActivities = getRecentActivities(5);
        const milestoneIds = _data.milestones.map(m => m.reward_id);

        return {
            training_stage: _data.training.max_stage,
            training_total: 8,
            bubble_level: _data.bubbles.max_level,
            bubble_total: 20,
            pet: pet,
            articles_completed: articlesCompleted,
            articles_total: 10,
            recent_activities: recentActivities,
            milestones: milestoneIds
        };
    }

    // ─── Reset ───────────────────────────────────────────────

    function resetAllData() {
        _data = getDefaultData();
        _save();
        return _data;
    }

    // ─── Public API ──────────────────────────────────────────

    return {
        // User
        getUser, setNickname, setAvatar,
        // Training
        getTrainingProgress, getTrainingStage, saveTrainingStage, saveTrainingStageProgress,
        // Bubbles
        getBubbleLevel, saveBubbleLevel, getBubblePersonalBest, saveBubblePersonalBest,
        getSpeedPreference, saveSpeedPreference,
        // Pet
        getPet, feedPet, namePet, addPetXp, addPetHappiness,
        // Sessions
        saveSession, getSessions,
        // Streaks
        getStreaks, updateStreak,
        // Achievements
        getAchievements, awardAchievement, hasAchievement,
        // Activities
        addActivity, getRecentActivities,
        // Articles
        getCompletedArticles, markArticleCompleted, getArticleBest, updateArticleBest,
        // Milestones
        getMilestones, awardMilestone, hasMilestone,
        // Stats
        getStats, getWeakness, getIntegratedProgress,
        // Reset
        resetAllData,
        // Constants
        EVO_THRESHOLDS
    };

})();
