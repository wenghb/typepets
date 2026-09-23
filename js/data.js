/**
 * TypePets — localStorage Data Layer
 * All data operations for the static site. No server needed.
 *
 * Data version 2:
 *  - per-browser kid profiles (up to 4), each with its own progress blob
 *    (first/legacy profile keeps the original `typepets_data` key)
 *  - pet care loop (hunger/happiness decay over real time, food earned by practice)
 *  - daily practice goal + streak freeze, local-time dates everywhere
 *  - every mutation re-reads storage first, so two tabs never overwrite each other
 *  - backup / restore ("Pet Passport")
 */

const TypePetsData = (function() {
    'use strict';

    const DATA_VERSION = 2;
    const LEGACY_KEY = 'typepets_data';
    const PROFILES_KEY = 'typepets_profiles';
    const DEFAULT_PROFILE_ID = 'default';
    const MAX_PROFILES = 4;
    const PROFILE_AVATARS = ['🐱', '🐶', '🦊', '🐼', '🐸', '🦄', '🐙', '🐧', '🐯', '🐰', '🐨', '🦖'];

    const DAY_MS = 86400000;
    const MAX_SESSIONS = 500;
    const MAX_ACTIVITIES = 200;

    // Pet care loop — gentle: the pet never dies, it just gets hungry / sad.
    const PET_RULES = {
        HUNGER_DECAY_PER_DAY: 15,
        HAPPY_DECAY_PER_DAY: 10,
        FLOOR: 10,
        FEED_HUNGER: 25,
        FEED_HAPPY: 10,
        PRACTICE_HAPPY: 5,
        FOOD_PER_SESSION: 1,
        GOAL_BONUS_FOOD: 2,
        START_FOOD: 3,
        MAX_FOOD: 99,
        // A session must be at least this long (or this many keys) to earn food
        MIN_SESSION_SECONDS: 20,
        MIN_SESSION_KEYS: 10
    };

    const GOAL_OPTIONS = [5, 10, 15, 20];
    const DEFAULT_GOAL_MINUTES = 10;
    const FREEZE_COOLDOWN_DAYS = 7;
    const BACKUP_REMIND_DAYS = 14;
    const BACKUP_REMIND_MIN_SESSIONS = 5;

    const BACKUP_FORMAT = 'typepets-backup';
    const CODE_PREFIX_PLAIN = 'TP1.';
    const CODE_PREFIX_GZIP = 'TP1z.';

    const MILESTONES = {
        5:  { id: 'golden_apple', name: 'Golden Apple', happiness: 50,  food: 2 },
        10: { id: 'star_cookie',  name: 'Star Cookie',  happiness: 100, food: 2 },
        15: { id: 'rainbow_cake', name: 'Rainbow Cake', happiness: 150, food: 3 },
        20: { id: 'crown',        name: 'Crown',        happiness: 0,   food: 0 },
    };

    const EVO_THRESHOLDS = [
        { xp: 10000, species: 'master', level: 6 },
        { xp: 4000,  species: 'adult',  level: 5 },
        { xp: 1500,  species: 'teen',   level: 4 },
        { xp: 500,   species: 'kid',    level: 3 },
        { xp: 100,   species: 'baby',   level: 2 },
        { xp: 0,     species: 'egg',    level: 1 },
    ];

    // ─── Clock & date helpers (local time everywhere) ───────

    let _clock = function() { return Date.now(); };
    function _now() { return _clock(); }
    function _iso() { return new Date(_now()).toISOString(); }

    function pad2(n) { return String(n).padStart(2, '0'); }

    /** YYYY-MM-DD in the browser's local time zone */
    function localDateStr(input) {
        const d = input instanceof Date ? input : new Date(input === undefined ? _now() : input);
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    function _parseDateStr(s) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
    }

    /** Whole calendar days from a to b (both YYYY-MM-DD). */
    function dayDiff(a, b) {
        const ta = _parseDateStr(a), tb = _parseDateStr(b);
        if (!isFinite(ta) || !isFinite(tb)) return NaN;
        return Math.round((tb - ta) / DAY_MS);
    }

    function addDays(dateStr, n) {
        const t = _parseDateStr(dateStr);
        if (!isFinite(t)) return null;
        const d = new Date(t + n * DAY_MS);
        return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }

    function sessionDate(s) {
        const t = Date.parse(s && s.timestamp);
        return isFinite(t) ? localDateStr(t) : null;
    }

    // ─── Small utils ─────────────────────────────────────────

    function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function num(v, fallback) { v = Number(v); return isFinite(v) ? v : (fallback || 0); }
    function round2(v) { return Math.round(v * 100) / 100; }

    function cleanName(name, maxLen) {
        if (typeof name !== 'string') return '';
        // strip control chars, collapse whitespace
        const s = name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
        return Array.from(s).slice(0, maxLen || 20).join('');
    }

    function validAvatar(a) {
        return (typeof a === 'string' && a.length > 0 && a.length <= 8 && !/[<>&"']/.test(a)) ? a : PROFILE_AVATARS[0];
    }

    // ─── Guarded storage access ──────────────────────────────

    function _storage() {
        try { return (typeof localStorage !== 'undefined' && localStorage) ? localStorage : null; }
        catch (e) { return null; }
    }

    function _getItem(key) {
        try {
            const s = _storage();
            if (!s) return { ok: false, value: null };
            return { ok: true, value: s.getItem(key) };
        } catch (e) { return { ok: false, value: null }; }
    }

    function _setItem(key, value) {
        try {
            const s = _storage();
            if (!s) return false;
            s.setItem(key, value);
            return true;
        } catch (e) {
            console.error('TypePets: failed to save', key, e);
            return false;
        }
    }

    function _removeItem(key) {
        try { const s = _storage(); if (s) s.removeItem(key); } catch (e) { /* ignore */ }
    }

    // ─── Notifications (toasts provided by app.js, if present) ─

    let _saveWarned = false;
    const _notifyLog = [];

    function _notify(message, type, duration, delay) {
        _notifyLog.push({ message, type: type || 'info' });
        if (_notifyLog.length > 20) _notifyLog.shift();
        if (typeof window === 'undefined' || typeof setTimeout !== 'function') return;
        setTimeout(function() {
            try {
                if (typeof window.showToast === 'function') window.showToast(message, type || 'info', duration || 3500);
            } catch (e) { /* ignore */ }
        }, delay || 0);
    }

    function _warnSaveFailed() {
        if (_saveWarned) return;
        _saveWarned = true;
        _notify("⚠️ Progress couldn't be saved — this browser's storage is full or blocked.", 'error', 7000);
    }

    // ─── Default Data Structure ──────────────────────────────

    function getDefaultData() {
        const nowIso = _iso();
        return {
            version: DATA_VERSION,
            user: {
                nickname: 'Player',
                avatar: 'default',
                created_at: nowIso
            },
            training: {
                max_stage: 0,
                stages: {} // { stageId: { bestAccuracy, stars, unlocked } }
            },
            bubbles: {
                max_level: 1,
                speed_preference: 1.0,
                personal_best: 0,
                passed_levels: []
            },
            pet: {
                name: 'Unnamed',
                species: 'egg',
                level: 1,
                xp: 0,
                hunger: 100,       // value at `stats_at`; decays over real time
                happiness: 100,    // value at `stats_at`; decays over real time
                stats_at: nowIso,
                last_fed: nowIso,
                food: PET_RULES.START_FOOD,
                total_fed: 0
            },
            sessions: [],     // { mode, level, wpm, accuracy, duration_seconds, keys_pressed, errors, error_keys, score, speed_multiplier, passed?, no_look?, chars_correct?, timestamp }
            achievements: [],  // { badge_id, earned_at }
            streaks: {
                current_streak: 0,
                longest_streak: 0,
                last_practice_date: null, // local YYYY-MM-DD
                freezes_used: []          // local dates that a streak freeze covered
            },
            activities: [],   // { type, description, xp_earned, extra, timestamp }
            articles: {
                completed: [],    // array of article IDs
                bests: {}         // { articleId: { best_wpm, best_accuracy, best_time, attempts } }
            },
            milestones: [],    // { reward_id, created_at }
            goals: {
                daily_minutes: DEFAULT_GOAL_MINUTES,
                completed_dates: [] // local dates the daily goal was completed
            },
            backup: {
                last_backup_at: null,
                reminder_snoozed_at: null
            }
        };
    }

    // ─── Migration ───────────────────────────────────────────

    /** Deep-merge stored data over defaults. Never drops stored keys; only fills gaps / fixes wrong types. */
    function mergeWithDefaults(defaults, data) {
        if (!isPlainObject(data)) return defaults;
        const out = {};
        for (const key of Object.keys(defaults)) {
            const def = defaults[key];
            const val = data[key];
            if (val === undefined) { out[key] = def; continue; }
            if (def === null) { out[key] = val; continue; }
            if (val === null) { out[key] = def; continue; }
            if (isPlainObject(def)) {
                out[key] = isPlainObject(val) ? mergeWithDefaults(def, val) : def;
            } else if (Array.isArray(def)) {
                out[key] = Array.isArray(val) ? val : def;
            } else if (typeof def === 'number') {
                out[key] = (typeof val === 'number' && isFinite(val)) ? val : def;
            } else if (typeof def === 'string') {
                out[key] = typeof val === 'string' ? val : def;
            } else if (typeof def === 'boolean') {
                out[key] = typeof val === 'boolean' ? val : def;
            } else {
                out[key] = val;
            }
        }
        // Preserve anything we don't know about (e.g. training.stages entries, future fields)
        for (const key of Object.keys(data)) {
            if (!(key in out)) out[key] = data[key];
        }
        return out;
    }

    function _speciesForXp(xp) {
        for (const t of EVO_THRESHOLDS) {
            if (xp >= t.xp) return t;
        }
        return EVO_THRESHOLDS[EVO_THRESHOLDS.length - 1];
    }

    function migrateData(raw) {
        const fromVersion = (typeof raw.version === 'number' && isFinite(raw.version)) ? raw.version : 1;
        const merged = mergeWithDefaults(getDefaultData(), raw);

        if (fromVersion < 2) {
            // v1 → v2. Everything from v1 is kept; new fields come from defaults
            // (food = START_FOOD, decay starts counting from now — no retroactive sadness).
            merged.pet.stats_at = _iso();
            merged.pet.hunger = clamp(num(merged.pet.hunger, 100), 0, 100);
            merged.pet.happiness = clamp(num(merged.pet.happiness, 100), 0, 100);

            // v1 stored UTC dates; recompute the last practice day in local time.
            let latest = NaN;
            for (const s of merged.sessions) {
                const t = Date.parse(s && s.timestamp);
                if (isFinite(t) && (!isFinite(latest) || t > latest)) latest = t;
            }
            if (isFinite(latest)) merged.streaks.last_practice_date = localDateStr(latest);

            // v1 didn't record which bubble levels were passed: every level below max_level was.
            if (!merged.bubbles.passed_levels.length) {
                for (let l = 1; l < Math.min(21, num(merged.bubbles.max_level, 1)); l++) merged.bubbles.passed_levels.push(l);
            }
        }

        merged.version = Math.max(DATA_VERSION, fromVersion);
        return merged;
    }

    /** Normalise a data blob of unknown origin (used by restore). */
    function sanitizeData(data) {
        const d = migrateData(data);
        d.user.nickname = cleanName(d.user.nickname) || 'Player';
        d.pet.name = cleanName(d.pet.name) || 'Unnamed';
        d.pet.xp = clamp(Math.floor(num(d.pet.xp)), 0, 1e7);
        const evo = _speciesForXp(d.pet.xp);
        d.pet.species = evo.species;
        d.pet.level = evo.level;
        d.pet.hunger = clamp(num(d.pet.hunger, 100), 0, 100);
        d.pet.happiness = clamp(num(d.pet.happiness, 100), 0, 100);
        d.pet.food = clamp(Math.floor(num(d.pet.food)), 0, PET_RULES.MAX_FOOD);
        if (!isFinite(Date.parse(d.pet.stats_at))) d.pet.stats_at = _iso();
        d.sessions = d.sessions.filter(isPlainObject).slice(-MAX_SESSIONS);
        d.activities = d.activities.filter(isPlainObject).slice(-MAX_ACTIVITIES).map(a => ({
            type: String(a.type || 'other').slice(0, 20),
            description: String(a.description || '').slice(0, 200),
            xp_earned: num(a.xp_earned),
            extra: isPlainObject(a.extra) ? a.extra : {},
            timestamp: String(a.timestamp || '')
        }));
        d.achievements = d.achievements.filter(a => isPlainObject(a) && typeof a.badge_id === 'string');
        d.milestones = d.milestones.filter(m => isPlainObject(m) && typeof m.reward_id === 'string');
        d.streaks.freezes_used = d.streaks.freezes_used.filter(f => typeof f === 'string').slice(-20);
        d.goals.completed_dates = d.goals.completed_dates.filter(f => typeof f === 'string').slice(-400);
        if (!GOAL_OPTIONS.includes(d.goals.daily_minutes)) d.goals.daily_minutes = DEFAULT_GOAL_MINUTES;
        return d;
    }

    // ─── Profiles registry ───────────────────────────────────

    function keyFor(id) {
        return id === DEFAULT_PROFILE_ID ? LEGACY_KEY : LEGACY_KEY + '_' + id;
    }

    function _defaultRegistry() {
        let name = 'Player';
        const r = _getItem(LEGACY_KEY);
        if (r.ok && r.value) {
            try {
                const d = JSON.parse(r.value);
                if (d && d.user && cleanName(d.user.nickname)) name = cleanName(d.user.nickname);
            } catch (e) { /* ignore */ }
        }
        return {
            active: DEFAULT_PROFILE_ID,
            list: [{ id: DEFAULT_PROFILE_ID, name: name, avatar: PROFILE_AVATARS[0], created_at: _iso() }]
        };
    }

    function loadRegistry() {
        const r = _getItem(PROFILES_KEY);
        let reg = null;
        if (r.ok && r.value) {
            try { reg = JSON.parse(r.value); } catch (e) { reg = null; }
        }
        if (!isPlainObject(reg) || !Array.isArray(reg.list)) return _defaultRegistry();
        const seen = new Set();
        const list = reg.list
            .filter(p => isPlainObject(p) && typeof p.id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(p.id) && !seen.has(p.id) && seen.add(p.id))
            .slice(0, MAX_PROFILES)
            .map(p => ({
                id: p.id,
                name: cleanName(p.name) || 'Player',
                avatar: validAvatar(p.avatar),
                created_at: typeof p.created_at === 'string' ? p.created_at : _iso()
            }));
        if (!list.length) return _defaultRegistry();
        const active = list.some(p => p.id === reg.active) ? reg.active : list[0].id;
        return { active, list };
    }

    function saveRegistry(reg) {
        const ok = _setItem(PROFILES_KEY, JSON.stringify({ active: reg.active, list: reg.list }));
        if (!ok) _warnSaveFailed();
        return ok;
    }

    // The profile this page works with is pinned at load time. Switching profiles reloads the page.
    const _profileId = loadRegistry().active;
    const _key = keyFor(_profileId);
    let _profileGone = false;

    // ─── Load / Save ─────────────────────────────────────────

    /** Returns { ok, data, migrated }. ok=false means storage could not be read at all. */
    function readProfileData(key) {
        const r = _getItem(key);
        if (!r.ok) return { ok: false, data: null };
        if (!r.value) return { ok: true, data: getDefaultData() };
        let parsed;
        try {
            parsed = JSON.parse(r.value);
        } catch (e) {
            console.error('TypePets: saved data is corrupt, keeping a copy', e);
            if (!_getItem(key + '__corrupt').value) _setItem(key + '__corrupt', r.value);
            return { ok: true, data: getDefaultData() };
        }
        if (!isPlainObject(parsed)) return { ok: true, data: getDefaultData() };
        if (parsed.version !== DATA_VERSION) {
            if (num(parsed.version, 1) < DATA_VERSION && !_getItem(key + '__v1_backup').value) {
                // one-time safety copy of the pre-migration blob
                _setItem(key + '__v1_backup', r.value);
            }
            return { ok: true, data: migrateData(parsed), migrated: true };
        }
        return { ok: true, data: mergeWithDefaults(getDefaultData(), parsed) };
    }

    function loadData() {
        const res = readProfileData(_key);
        return res.ok ? res.data : getDefaultData();
    }

    let _data = null;
    let _txDepth = 0;

    function _reload() {
        const res = readProfileData(_key);
        if (res.ok) {
            _data = res.data;
            return !!res.migrated;
        }
        // Storage unreadable (blocked / private mode): keep working in memory.
        if (!_data) _data = getDefaultData();
        return false;
    }

    function _ensure() {
        if (!_data) _reload();
        return _data;
    }

    function _save() {
        if (_profileGone || !_data) return false;
        let ok = false;
        try { ok = _setItem(_key, JSON.stringify(_data)); } catch (e) { ok = false; }
        if (!ok) _warnSaveFailed();
        return ok;
    }

    /**
     * Run a mutation against the freshest stored data.
     * The outermost call re-reads storage first and saves once at the end,
     * so another tab's progress is never overwritten by stale in-memory data.
     */
    function _tx(fn) {
        if (_txDepth === 0) _reload();
        _txDepth++;
        let done = false;
        try {
            const result = fn(_data);
            done = true;
            return result;
        } finally {
            _txDepth--;
            if (_txDepth === 0 && done) _save();
        }
    }

    // Initial load (+ persist a migration right away so it only happens once)
    if (_reload()) _save();

    // Keep in sync with other tabs / back-forward cache
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', function(e) {
            try {
                const s = _storage();
                if (e.storageArea && s && e.storageArea !== s) return;
                if ((e.key === null || e.key === _key) && _txDepth === 0) _reload();
                if (e.key === null || e.key === PROFILES_KEY) {
                    const reg = loadRegistry();
                    if (!reg.list.some(p => p.id === _profileId)) {
                        _profileGone = true;
                        if (typeof location !== 'undefined') location.reload();
                    }
                }
            } catch (err) { /* ignore */ }
        });
        window.addEventListener('pageshow', function(e) {
            // Restored from bfcache: the page's in-memory state may be stale — start fresh.
            if (e && e.persisted && typeof location !== 'undefined') location.reload();
        });
    }

    // ─── User ────────────────────────────────────────────────

    function getUser() {
        return { ..._ensure().user };
    }

    function setNickname(nickname) {
        const name = cleanName(nickname);
        if (!name) return getUser();
        _tx(d => { d.user.nickname = name; });
        const reg = loadRegistry();
        const p = reg.list.find(x => x.id === _profileId);
        if (p) { p.name = name; saveRegistry(reg); }
        return getUser();
    }

    function setAvatar(avatar) {
        _tx(d => { d.user.avatar = avatar; });
        return getUser();
    }

    // ─── Profiles ────────────────────────────────────────────

    function getProfiles() {
        const reg = loadRegistry();
        return {
            active: _profileId,
            max: MAX_PROFILES,
            avatars: PROFILE_AVATARS.slice(),
            list: reg.list.map(p => ({ ...p, active: p.id === _profileId }))
        };
    }

    function getActiveProfile() {
        const reg = loadRegistry();
        const p = reg.list.find(x => x.id === _profileId);
        if (p) return { ...p };
        return { id: _profileId, name: _ensure().user.nickname, avatar: PROFILE_AVATARS[0], created_at: _ensure().user.created_at };
    }

    function addProfile(name, avatar) {
        const reg = loadRegistry();
        if (reg.list.length >= MAX_PROFILES) return { ok: false, error: 'max' };
        name = cleanName(name);
        if (!name) return { ok: false, error: 'name' };
        const id = 'p' + _now().toString(36) + Math.random().toString(36).slice(2, 6);
        const profile = { id, name, avatar: validAvatar(avatar), created_at: _iso() };
        const data = getDefaultData();
        data.user.nickname = name;
        if (!_setItem(keyFor(id), JSON.stringify(data))) { _warnSaveFailed(); return { ok: false, error: 'storage' }; }
        reg.list.push(profile);
        if (!saveRegistry(reg)) { _removeItem(keyFor(id)); return { ok: false, error: 'storage' }; }
        return { ok: true, profile: { ...profile } };
    }

    /** Make `id` the active profile. The caller should reload the page. */
    function switchProfile(id) {
        const reg = loadRegistry();
        if (!reg.list.some(p => p.id === id)) return false;
        reg.active = id;
        return saveRegistry(reg);
    }

    function renameProfile(id, name, avatar) {
        const reg = loadRegistry();
        const p = reg.list.find(x => x.id === id);
        if (!p) return { ok: false, error: 'missing' };
        name = cleanName(name);
        if (!name) return { ok: false, error: 'name' };
        p.name = name;
        if (avatar) p.avatar = validAvatar(avatar);
        if (!saveRegistry(reg)) return { ok: false, error: 'storage' };
        if (id === _profileId) {
            _tx(d => { d.user.nickname = name; });
        } else {
            const res = readProfileData(keyFor(id));
            if (res.ok) {
                res.data.user.nickname = name;
                _setItem(keyFor(id), JSON.stringify(res.data));
            }
        }
        return { ok: true, profile: { ...p } };
    }

    function deleteProfile(id) {
        const reg = loadRegistry();
        const idx = reg.list.findIndex(x => x.id === id);
        if (idx < 0) return { ok: false, error: 'missing' };
        if (reg.list.length <= 1) return { ok: false, error: 'last' };
        reg.list.splice(idx, 1);
        if (reg.active === id || id === _profileId) {
            reg.active = reg.list.some(p => p.id === reg.active) ? reg.active : reg.list[0].id;
        }
        if (!saveRegistry(reg)) return { ok: false, error: 'storage' };
        _removeItem(keyFor(id));
        _removeItem(keyFor(id) + '__v1_backup');
        _removeItem(keyFor(id) + '__corrupt');
        if (id === _profileId) _profileGone = true;
        return { ok: true, active: reg.active, was_current: id === _profileId };
    }

    // ─── Training Stages ─────────────────────────────────────

    function getTrainingProgress() {
        const d = _ensure();
        return {
            max_stage: d.training.max_stage,
            stages: JSON.parse(JSON.stringify(d.training.stages))
        };
    }

    function getTrainingStage() {
        return { max_stage: _ensure().training.max_stage };
    }

    function saveTrainingStage(stage) {
        return _tx(d => {
            if (stage > d.training.max_stage) d.training.max_stage = stage;
            return { max_stage: d.training.max_stage };
        });
    }

    function saveTrainingStageProgress(stageId, bestAccuracy, stars, unlocked) {
        _tx(d => {
            if (!isPlainObject(d.training.stages[stageId])) {
                d.training.stages[stageId] = { bestAccuracy: 0, stars: 0, unlocked: false };
            }
            const s = d.training.stages[stageId];
            if (bestAccuracy > (s.bestAccuracy || 0)) s.bestAccuracy = bestAccuracy;
            if (stars > (s.stars || 0)) s.stars = stars;
            if (unlocked) s.unlocked = true;
        });
    }

    // ─── Bubble Pop ──────────────────────────────────────────

    function getBubbleLevel() {
        return { max_level: _ensure().bubbles.max_level };
    }

    function saveBubbleLevel(level) {
        return _tx(d => {
            if (level > d.bubbles.max_level) d.bubbles.max_level = level;
            return { max_level: d.bubbles.max_level };
        });
    }

    function getBubblePassedLevels() {
        return _ensure().bubbles.passed_levels.slice();
    }

    function getBubblePersonalBest() {
        return _ensure().bubbles.personal_best;
    }

    function saveBubblePersonalBest(score) {
        return _tx(d => {
            if (score > d.bubbles.personal_best) d.bubbles.personal_best = score;
            return d.bubbles.personal_best;
        });
    }

    function getSpeedPreference() {
        return _ensure().bubbles.speed_preference;
    }

    function saveSpeedPreference(speed) {
        _tx(d => { d.bubbles.speed_preference = speed; });
    }

    // ─── Pet ─────────────────────────────────────────────────

    /** Hunger / happiness right now, after lazily applying real-time decay since `stats_at`. */
    function _currentPetStats(pet, nowMs) {
        const since = Date.parse(pet.stats_at);
        const days = isFinite(since) ? Math.max(0, (nowMs - since) / DAY_MS) : 0;
        function decay(base, rate) {
            base = clamp(num(base, 100), 0, 100);
            const floor = Math.min(base, PET_RULES.FLOOR);
            return Math.max(floor, base - rate * days);
        }
        return {
            hunger: decay(pet.hunger, PET_RULES.HUNGER_DECAY_PER_DAY),
            happiness: decay(pet.happiness, PET_RULES.HAPPY_DECAY_PER_DAY)
        };
    }

    /** Inside a transaction: fold decay into the stored values and restart the clock. */
    function _materializePet(d) {
        const cur = _currentPetStats(d.pet, _now());
        d.pet.hunger = round2(cur.hunger);
        d.pet.happiness = round2(cur.happiness);
        d.pet.stats_at = _iso();
    }

    function _daysSincePractice(d) {
        const last = d.streaks.last_practice_date;
        if (!last) return null;
        const diff = dayDiff(last, localDateStr(_now()));
        return isFinite(diff) ? Math.max(0, diff) : null;
    }

    function _petMood(hunger, happiness, daysAway) {
        if (hunger < 30) return 'hungry';
        if (daysAway !== null && daysAway >= 2) return 'lonely';
        if (happiness < 40) return 'sad';
        if (hunger < 60) return 'peckish';
        return 'happy';
    }

    function getPet() {
        const d = _ensure();
        const p = { ...d.pet };
        const cur = _currentPetStats(d.pet, _now());
        p.hunger = Math.round(cur.hunger);
        p.happiness = Math.round(cur.happiness);
        p.food = Math.max(0, Math.floor(num(p.food)));
        p.days_since_practice = _daysSincePractice(d);
        p.mood = _petMood(p.hunger, p.happiness, p.days_since_practice);
        return p;
    }

    /**
     * Feed the pet one food. Returns the pet plus { fed: bool, reason: null | 'no_food' | 'full' }.
     */
    function feedPet() {
        return _tx(d => {
            _materializePet(d);
            const food = Math.max(0, Math.floor(num(d.pet.food)));
            let fed = false;
            let reason = null;
            if (food <= 0) {
                reason = 'no_food';
            } else if (d.pet.hunger >= 100 && d.pet.happiness >= 100) {
                reason = 'full';
            } else {
                d.pet.food = food - 1;
                d.pet.hunger = Math.min(100, d.pet.hunger + PET_RULES.FEED_HUNGER);
                d.pet.happiness = Math.min(100, d.pet.happiness + PET_RULES.FEED_HAPPY);
                d.pet.last_fed = _iso();
                d.pet.total_fed = num(d.pet.total_fed) + 1;
                fed = true;
            }
            return Object.assign(getPet(), { fed, reason });
        });
    }

    function namePet(name) {
        const clean = cleanName(name);
        if (!clean) return getPet();
        _tx(d => { d.pet.name = clean; });
        return getPet();
    }

    function _addPetXp(d, amount) {
        d.pet.xp = Math.max(0, num(d.pet.xp) + Math.max(0, Math.floor(num(amount))));
        const evo = _speciesForXp(d.pet.xp);
        d.pet.species = evo.species;
        d.pet.level = evo.level;
    }

    function addPetXp(amount) {
        _tx(d => { _addPetXp(d, amount); });
        return getPet();
    }

    function addPetHappiness(amount) {
        _tx(d => {
            _materializePet(d);
            d.pet.happiness = clamp(d.pet.happiness + num(amount), 0, 100);
        });
        return getPet();
    }

    // ─── Daily goal ──────────────────────────────────────────

    function _secondsOnDate(d, date) {
        let total = 0;
        for (const s of d.sessions) {
            if (sessionDate(s) === date) total += Math.max(0, num(s.duration_seconds));
        }
        return total;
    }

    function getDailyGoal() {
        const d = _ensure();
        const today = localDateStr(_now());
        const secs = _secondsOnDate(d, today);
        const goal = d.goals.daily_minutes;
        return {
            date: today,
            minutes_today: Math.round(secs / 6) / 10,
            goal_minutes: goal,
            progress: goal > 0 ? Math.min(1, secs / (goal * 60)) : 1,
            completed: d.goals.completed_dates.includes(today) || secs >= goal * 60,
            options: GOAL_OPTIONS.slice()
        };
    }

    function setDailyGoal(minutes) {
        minutes = parseInt(minutes, 10);
        if (!GOAL_OPTIONS.includes(minutes)) return getDailyGoal();
        _tx(d => { d.goals.daily_minutes = minutes; });
        return getDailyGoal();
    }

    /** Last `days` local days (oldest first): { date, minutes, sessions, goal_met, freeze } */
    function getDailyHistory(days) {
        const d = _ensure();
        days = Math.max(1, Math.min(366, days || 7));
        const today = localDateStr(_now());
        const byDate = {};
        for (const s of d.sessions) {
            const date = sessionDate(s);
            if (!date) continue;
            if (!byDate[date]) byDate[date] = { seconds: 0, sessions: 0 };
            byDate[date].seconds += Math.max(0, num(s.duration_seconds));
            byDate[date].sessions++;
        }
        const out = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = addDays(today, -i);
            const b = byDate[date] || { seconds: 0, sessions: 0 };
            out.push({
                date,
                minutes: Math.round(b.seconds / 6) / 10,
                sessions: b.sessions,
                goal_met: d.goals.completed_dates.includes(date),
                freeze: d.streaks.freezes_used.includes(date)
            });
        }
        return out;
    }

    // ─── Sessions ────────────────────────────────────────────

    function _computeXp(session, sessionData) {
        let xp = 0;
        const speedMultiplier = num(sessionData.speed_multiplier, 1) || 1;
        if (session.mode === 'finger_training') {
            xp = 20;
        } else if (session.mode === 'bubble_pop') {
            const baseXp = Math.max(1, Math.floor((num(sessionData.score) || num(sessionData.wpm)) / 10));
            if (speedMultiplier >= 2.0) xp = Math.floor(baseXp * 2.0);
            else if (speedMultiplier >= 1.5) xp = Math.floor(baseXp * 1.5);
            else if (speedMultiplier >= 1.25) xp = Math.floor(baseXp * 1.25);
            else xp = baseXp;
        } else if (session.mode === 'article') {
            xp = Math.max(5, Math.floor(num(sessionData.wpm) * 0.5));
        } else {
            xp = Math.floor(num(sessionData.wpm));
        }
        // No-peek bonus: keyboard / finger hints were hidden for the whole session
        if (sessionData.no_look === true) xp = Math.floor(xp * 1.5);
        return Math.max(0, xp);
    }

    function saveSession(sessionData) {
        sessionData = sessionData || {};
        const result = _tx(d => {
            const now = _now();
            const today = localDateStr(now);
            const session = {
                mode: String(sessionData.mode || 'unknown'),
                level: sessionData.level || 1,
                wpm: num(sessionData.wpm),
                accuracy: num(sessionData.accuracy),
                duration_seconds: clamp(Math.round(num(sessionData.duration_seconds)), 0, 7200),
                keys_pressed: Math.max(0, num(sessionData.keys_pressed)),
                errors: Math.max(0, num(sessionData.errors)),
                error_keys: isPlainObject(sessionData.error_keys) ? sessionData.error_keys : {},
                score: num(sessionData.score),
                speed_multiplier: num(sessionData.speed_multiplier, 1) || 1.0,
                timestamp: new Date(now).toISOString()
            };
            if (typeof sessionData.passed === 'boolean') session.passed = sessionData.passed;
            if (sessionData.no_look === true) session.no_look = true;
            if (sessionData.chars_correct !== undefined && isFinite(Number(sessionData.chars_correct))) {
                session.chars_correct = Math.max(0, Math.round(Number(sessionData.chars_correct)));
            }

            const secondsBefore = _secondsOnDate(d, today);
            d.sessions.push(session);
            if (d.sessions.length > MAX_SESSIONS) d.sessions = d.sessions.slice(-MAX_SESSIONS);

            // Streak (local dates, with weekly freeze)
            const streak = _updateStreak(d, today);

            // XP — only ever from real practice
            const xpEarned = _computeXp(session, sessionData);
            _addPetXp(d, xpEarned);

            // Log activity
            const speedMultiplier = session.speed_multiplier;
            if (session.mode === 'finger_training') {
                const stage = session.level;
                const acc = session.accuracy;
                if (acc >= 85) {
                    addActivity('training', `Completed Training Stage ${stage}`, xpEarned, { stage, accuracy: acc });
                    saveTrainingStage(stage);
                } else {
                    addActivity('training', `Practiced Training Stage ${stage}`, xpEarned, { stage, accuracy: acc });
                }
            } else if (session.mode === 'bubble_pop') {
                const verb = session.passed === true ? 'Passed' : 'Played';
                addActivity('bubble', `${verb} Bubble Level ${session.level}`, xpEarned, { level: session.level, score: session.score, speed: speedMultiplier });
            } else if (session.mode === 'article') {
                addActivity('article', `Typed article`, xpEarned, { article_id: session.level, wpm: session.wpm });
            }

            // Pet care: real practice cheers the pet up and earns food
            _materializePet(d);
            let foodEarned = 0;
            const counts = session.duration_seconds >= PET_RULES.MIN_SESSION_SECONDS || session.keys_pressed >= PET_RULES.MIN_SESSION_KEYS;
            if (counts) {
                foodEarned += PET_RULES.FOOD_PER_SESSION;
                d.pet.happiness = Math.min(100, d.pet.happiness + PET_RULES.PRACTICE_HAPPY);
            }

            // Daily goal
            const goalMinutes = d.goals.daily_minutes;
            const secondsAfter = secondsBefore + session.duration_seconds;
            let goalJustCompleted = false;
            if (secondsAfter >= goalMinutes * 60 && !d.goals.completed_dates.includes(today)) {
                goalJustCompleted = true;
                d.goals.completed_dates.push(today);
                if (d.goals.completed_dates.length > 400) d.goals.completed_dates = d.goals.completed_dates.slice(-400);
                foodEarned += PET_RULES.GOAL_BONUS_FOOD;
                addActivity('goal', `Daily goal complete (${goalMinutes} min)`, 0, { minutes: goalMinutes });
            }

            // Bubble milestone rewards — only for a level that was actually passed
            const milestoneRewards = [];
            if (session.mode === 'bubble_pop' && session.passed === true) {
                const lvl = parseInt(session.level, 10);
                if (lvl >= 1 && lvl <= 20 && !d.bubbles.passed_levels.includes(lvl)) {
                    d.bubbles.passed_levels.push(lvl);
                    d.bubbles.passed_levels.sort((a, b) => a - b);
                }
                for (const [milestoneLevel, reward] of Object.entries(MILESTONES)) {
                    if (lvl >= parseInt(milestoneLevel, 10)) {
                        if (awardMilestone(reward.id)) {
                            milestoneRewards.push({ ...reward });
                            if (reward.happiness > 0) d.pet.happiness = Math.min(100, d.pet.happiness + reward.happiness);
                            foodEarned += reward.food;
                            addActivity('milestone', `Earned ${reward.name}!`, 0, { reward_id: reward.id, level: parseInt(milestoneLevel, 10) });
                        }
                    }
                }
            }

            d.pet.food = Math.min(PET_RULES.MAX_FOOD, Math.max(0, Math.floor(num(d.pet.food))) + foodEarned);

            return {
                session_id: d.sessions.length,
                xp_earned: xpEarned,
                milestone_rewards: milestoneRewards,
                daily_goal: {
                    minutes_today: Math.round(secondsAfter / 6) / 10,
                    goal_minutes: goalMinutes,
                    just_completed: goalJustCompleted
                },
                food_earned: foodEarned,
                streak: streak
            };
        });

        // Friendly notices (shown on any page that has app.js toasts)
        const petName = (function() { const n = _data.pet.name; return n && n !== 'Unnamed' ? n : 'your pet'; })();
        if (result.streak.freeze_used) {
            _notify(`🧊 Streak freeze used — your ${result.streak.current}-day streak is safe!`, 'success', 5000, 1200);
        }
        if (result.daily_goal.just_completed) {
            _notify(`🎯 Daily goal done! +${result.food_earned} 🍎 food for ${petName}`, 'success', 5000, 1600);
        } else if (result.food_earned > 0) {
            _notify(`🍎 +${result.food_earned} food for ${petName}!`, 'success', 3000, 1600);
        }
        return result;
    }

    function getSessions(limit) {
        limit = limit || 50;
        const sorted = [..._ensure().sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return sorted.slice(0, limit);
    }

    // ─── Streaks ─────────────────────────────────────────────

    function _freezeAvailable(s, missedDate) {
        return s.freezes_used.every(f => {
            const diff = dayDiff(f, missedDate);
            return !isFinite(diff) || Math.abs(diff) >= FREEZE_COOLDOWN_DAYS;
        });
    }

    function _updateStreak(d, today) {
        const s = d.streaks;
        const last = s.last_practice_date;
        let freezeUsed = false;
        if (last !== today) {
            const gap = last ? dayDiff(last, today) : NaN;
            if (isFinite(gap) && gap < 0) {
                // Clock / time zone went backwards — treat as the same day.
            } else if (gap === 1) {
                s.current_streak = (s.current_streak || 0) + 1;
            } else if (gap === 2 && s.current_streak > 0 && _freezeAvailable(s, addDays(today, -1))) {
                // Exactly one missed day and a freeze is available this week: streak survives.
                s.freezes_used.push(addDays(today, -1));
                if (s.freezes_used.length > 20) s.freezes_used = s.freezes_used.slice(-20);
                s.current_streak = (s.current_streak || 0) + 1;
                freezeUsed = true;
            } else {
                s.current_streak = 1;
            }
            if (!(isFinite(gap) && gap < 0)) s.last_practice_date = today;
        }
        if (!s.current_streak) s.current_streak = 1;
        s.longest_streak = Math.max(s.longest_streak || 0, s.current_streak);
        return { current: s.current_streak, freeze_used: freezeUsed };
    }

    /** Legacy API: records a practice day for today. */
    function updateStreak() {
        return _tx(d => _updateStreak(d, localDateStr(_now())));
    }

    function getStreaks() {
        const d = _ensure();
        const s = d.streaks;
        const today = localDateStr(_now());
        const gap = s.last_practice_date ? dayDiff(s.last_practice_date, today) : NaN;
        let current = s.current_streak || 0;
        let freezePending = false;
        if (!isFinite(gap)) {
            current = 0;
        } else if (gap <= 1) {
            // still alive (gap 1 = not practiced yet today)
        } else if (gap === 2 && current > 0 && _freezeAvailable(s, addDays(today, -1))) {
            freezePending = true; // practising today will spend a freeze on yesterday
        } else {
            current = 0;
        }
        const lastFreeze = s.freezes_used.length ? s.freezes_used[s.freezes_used.length - 1] : null;
        const sinceFreeze = lastFreeze ? dayDiff(lastFreeze, today) : NaN;
        return {
            current_streak: current,
            longest_streak: s.longest_streak || 0,
            last_practice_date: s.last_practice_date,
            practiced_today: gap === 0,
            freeze_ready: _freezeAvailable(s, today),
            freeze_pending: freezePending,
            last_freeze_date: lastFreeze,
            freeze_used_recently: isFinite(sinceFreeze) && sinceFreeze >= 0 && sinceFreeze < FREEZE_COOLDOWN_DAYS,
            freezes_used: s.freezes_used.slice()
        };
    }

    // ─── Achievements ────────────────────────────────────────

    function getAchievements() {
        return [..._ensure().achievements];
    }

    function awardAchievement(badgeId) {
        return _tx(d => {
            if (d.achievements.some(a => a.badge_id === badgeId)) return false;
            d.achievements.push({ badge_id: badgeId, earned_at: _iso() });
            return true;
        });
    }

    function hasAchievement(badgeId) {
        return _ensure().achievements.some(a => a.badge_id === badgeId);
    }

    // ─── Activities ──────────────────────────────────────────

    function addActivity(type, description, xp, extra) {
        _tx(d => {
            d.activities.push({
                type: type,
                description: description,
                xp_earned: xp || 0,
                extra: extra || {},
                timestamp: _iso()
            });
            if (d.activities.length > MAX_ACTIVITIES) d.activities = d.activities.slice(-MAX_ACTIVITIES);
        });
    }

    function getRecentActivities(limit) {
        limit = limit || 5;
        const sorted = [..._ensure().activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return sorted.slice(0, limit);
    }

    // ─── Articles ────────────────────────────────────────────

    function getCompletedArticles() {
        return [..._ensure().articles.completed];
    }

    function markArticleCompleted(articleId) {
        _tx(d => {
            if (!d.articles.completed.includes(articleId)) d.articles.completed.push(articleId);
        });
    }

    function getArticleBest(articleId) {
        const b = _ensure().articles.bests[articleId];
        return b ? { ...b } : { best_wpm: 0, best_accuracy: 0, best_time: 0, attempts: 0 };
    }

    function updateArticleBest(articleId, wpm, accuracy, time) {
        return _tx(d => {
            if (!isPlainObject(d.articles.bests[articleId])) {
                d.articles.bests[articleId] = { best_wpm: 0, best_accuracy: 0, best_time: 0, attempts: 0 };
            }
            const b = d.articles.bests[articleId];
            b.attempts = (b.attempts || 0) + 1;
            if (wpm > b.best_wpm) b.best_wpm = wpm;
            if (accuracy > b.best_accuracy) b.best_accuracy = accuracy;
            if (!b.best_time || time < b.best_time) b.best_time = time;
            return { ...b };
        });
    }

    // ─── Milestones ──────────────────────────────────────────

    function getMilestones() {
        return [..._ensure().milestones];
    }

    function awardMilestone(rewardId) {
        return _tx(d => {
            if (d.milestones.some(m => m.reward_id === rewardId)) return false;
            d.milestones.push({ reward_id: rewardId, created_at: _iso() });
            return true;
        });
    }

    function hasMilestone(rewardId) {
        return _ensure().milestones.some(m => m.reward_id === rewardId);
    }

    // ─── Stats ───────────────────────────────────────────────

    function getStats() {
        const d = _ensure();
        const sessions = d.sessions;
        const totalSessions = sessions.length;
        const totalKeys = sessions.reduce((s, x) => s + (x.keys_pressed || 0), 0);
        const totalTime = sessions.reduce((s, x) => s + (x.duration_seconds || 0), 0);
        const wpmValues = sessions.filter(s => s.wpm > 0).map(s => s.wpm);
        const accValues = sessions.filter(s => s.accuracy > 0).map(s => s.accuracy);

        const avgWpm = wpmValues.length > 0 ? Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length * 10) / 10 : 0;
        const avgAccuracy = accValues.length > 0 ? Math.round(accValues.reduce((a, b) => a + b, 0) / accValues.length * 10) / 10 : 0;
        const bestWpm = wpmValues.length > 0 ? Math.round(Math.max(...wpmValues) * 10) / 10 : 0;

        // Today's stats (local date)
        const today = localDateStr(_now());
        const todaySessions = sessions.filter(s => sessionDate(s) === today);
        const practiceDays = new Set(sessions.map(sessionDate).filter(Boolean)).size;

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
            practice_days: practiceDays,
            badges: d.achievements.length,
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

    function getWeakness(sessionsOverride) {
        const combined = {};
        (sessionsOverride || _ensure().sessions).forEach(s => {
            if (s.error_keys && typeof s.error_keys === 'object') {
                for (const [key, count] of Object.entries(s.error_keys)) {
                    combined[key] = (combined[key] || 0) + num(count);
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
        const d = _ensure();
        return {
            training_stage: d.training.max_stage,
            training_total: 8,
            bubble_level: d.bubbles.max_level,
            bubble_total: 20,
            pet: getPet(),
            articles_completed: d.articles.completed.length,
            articles_total: 10,
            recent_activities: getRecentActivities(5),
            milestones: d.milestones.map(m => m.reward_id)
        };
    }

    // ─── Backup / restore (Pet Passport) ─────────────────────

    function exportBackup() {
        const d = _ensure();
        const prof = getActiveProfile();
        return {
            format: BACKUP_FORMAT,
            format_version: 1,
            data_version: DATA_VERSION,
            exported_at: _iso(),
            profile: { name: prof.name, avatar: prof.avatar },
            data: JSON.parse(JSON.stringify(d))
        };
    }

    function _bytesToB64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
    }

    function _b64ToBytes(b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    async function _pipeThrough(bytes, stream) {
        const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
        return new Uint8Array(await out.arrayBuffer());
    }

    /** Compact copy-paste save code (gzip + base64 when the browser supports it). */
    async function exportSaveCode() {
        const bytes = new TextEncoder().encode(JSON.stringify(exportBackup()));
        if (typeof CompressionStream === 'function' && typeof Response === 'function' && typeof Blob === 'function') {
            try {
                return CODE_PREFIX_GZIP + _bytesToB64(await _pipeThrough(bytes, new CompressionStream('gzip')));
            } catch (e) { /* fall back to plain */ }
        }
        return CODE_PREFIX_PLAIN + _bytesToB64(bytes);
    }

    function _summarize(data, profile) {
        return {
            name: (profile && cleanName(profile.name)) || data.user.nickname,
            avatar: profile ? validAvatar(profile.avatar) : null,
            pet_name: data.pet.name && data.pet.name !== 'Unnamed' ? data.pet.name : 'Unnamed pet',
            pet_level: data.pet.level,
            pet_species: data.pet.species,
            xp: data.pet.xp,
            sessions: data.sessions.length,
            badges: data.achievements.length,
            exported_at: null
        };
    }

    /** Validate a backup object (wrapper or raw data blob). Returns { ok, data, summary } or { ok:false, error }. */
    function validateBackup(obj) {
        const bad = { ok: false, error: "This doesn't look like a TypePets backup." };
        if (!isPlainObject(obj)) return bad;
        let data = obj;
        let profile = null;
        let exportedAt = null;
        if (obj.format === BACKUP_FORMAT) {
            data = obj.data;
            profile = isPlainObject(obj.profile) ? obj.profile : null;
            exportedAt = typeof obj.exported_at === 'string' ? obj.exported_at : null;
        }
        if (!isPlainObject(data) || !isPlainObject(data.pet)) return bad;
        if (data.sessions !== undefined && !Array.isArray(data.sessions)) return bad;
        if (!isPlainObject(data.user) && !isPlainObject(data.training) && !Array.isArray(data.sessions)) return bad;
        let clean;
        try { clean = sanitizeData(JSON.parse(JSON.stringify(data))); } catch (e) { return bad; }
        const summary = _summarize(clean, profile);
        summary.exported_at = exportedAt;
        return { ok: true, data: clean, summary, profile: profile ? { name: summary.name, avatar: summary.avatar } : null };
    }

    /** Parse a save code, JSON text, or object. Always resolves; check `.ok`. */
    async function parseBackup(input) {
        try {
            if (typeof input !== 'string') return validateBackup(input);
            const text = input.trim();
            if (!text) return { ok: false, error: 'Paste a save code or pick a backup file first.' };
            if (text.charAt(0) === '{') return validateBackup(JSON.parse(text));
            const compact = text.replace(/\s+/g, '');
            if (compact.indexOf(CODE_PREFIX_GZIP) === 0) {
                if (typeof DecompressionStream !== 'function') {
                    return { ok: false, error: 'This browser is too old to open compressed save codes. Try the backup file instead.' };
                }
                const bytes = await _pipeThrough(_b64ToBytes(compact.slice(CODE_PREFIX_GZIP.length)), new DecompressionStream('gzip'));
                return validateBackup(JSON.parse(new TextDecoder().decode(bytes)));
            }
            if (compact.indexOf(CODE_PREFIX_PLAIN) === 0) {
                const bytes = _b64ToBytes(compact.slice(CODE_PREFIX_PLAIN.length));
                return validateBackup(JSON.parse(new TextDecoder().decode(bytes)));
            }
            return { ok: false, error: "That save code isn't complete or isn't a TypePets code." };
        } catch (e) {
            return { ok: false, error: "That save code isn't complete or isn't a TypePets code." };
        }
    }

    /** Replace the active profile's progress with a validated backup (from parseBackup/validateBackup). */
    function restoreBackup(parsed) {
        const v = (parsed && parsed.ok && parsed.data) ? validateBackup(parsed.data) : validateBackup(parsed);
        if (!v.ok) return v;
        const profileInfo = (parsed && parsed.profile) || v.profile;
        v.data.backup.last_backup_at = _iso();
        // Be kind: the pet resumes from the backed-up mood instead of decaying for the time the backup sat in a drawer.
        v.data.pet.stats_at = _iso();
        if (_txDepth !== 0) return { ok: false, error: 'busy' };
        _data = v.data;
        if (!_save()) return { ok: false, error: 'storage' };
        const reg = loadRegistry();
        const p = reg.list.find(x => x.id === _profileId);
        if (p) {
            p.name = cleanName(v.data.user.nickname) || p.name;
            if (profileInfo && profileInfo.avatar) p.avatar = validAvatar(profileInfo.avatar);
            // registry might be synthesized (never saved) — saving it is harmless
            saveRegistry(reg);
        }
        return { ok: true, summary: v.summary };
    }

    function markBackupDone() {
        _tx(d => { d.backup.last_backup_at = _iso(); });
    }

    function snoozeBackupReminder() {
        _tx(d => { d.backup.reminder_snoozed_at = _iso(); });
    }

    function getBackupStatus() {
        const d = _ensure();
        const now = _now();
        const last = Date.parse(d.backup.last_backup_at);
        const snoozed = Date.parse(d.backup.reminder_snoozed_at);
        const daysSince = isFinite(last) ? Math.floor((now - last) / DAY_MS) : null;
        const sessions = d.sessions.length;
        const stale = daysSince === null || daysSince >= BACKUP_REMIND_DAYS;
        const snoozedRecently = isFinite(snoozed) && (now - snoozed) < BACKUP_REMIND_DAYS * DAY_MS;
        return {
            last_backup_at: d.backup.last_backup_at,
            days_since: daysSince,
            sessions: sessions,
            should_remind: sessions >= BACKUP_REMIND_MIN_SESSIONS && stale && !snoozedRecently
        };
    }

    // ─── Reset ───────────────────────────────────────────────

    function resetAllData() {
        const nickname = _ensure().user.nickname;
        return _tx(() => {
            _data = getDefaultData();
            _data.user.nickname = nickname;
            return _data;
        });
    }

    // ─── Public API ──────────────────────────────────────────

    return {
        // User
        getUser, setNickname, setAvatar,
        // Profiles
        getProfiles, getActiveProfile, addProfile, switchProfile, renameProfile, deleteProfile,
        // Training
        getTrainingProgress, getTrainingStage, saveTrainingStage, saveTrainingStageProgress,
        // Bubbles
        getBubbleLevel, saveBubbleLevel, getBubblePassedLevels, getBubblePersonalBest, saveBubblePersonalBest,
        getSpeedPreference, saveSpeedPreference,
        // Pet
        getPet, feedPet, namePet, addPetXp, addPetHappiness,
        // Sessions
        saveSession, getSessions,
        // Daily goal
        getDailyGoal, setDailyGoal, getDailyHistory,
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
        // Backup
        exportBackup, exportSaveCode, parseBackup, validateBackup, restoreBackup,
        markBackupDone, snoozeBackupReminder, getBackupStatus,
        // Reset
        resetAllData,
        // Helpers
        localDateStr,
        // Constants
        EVO_THRESHOLDS, PET_RULES, GOAL_OPTIONS, MAX_PROFILES, MILESTONES, DATA_VERSION,
        // Test hooks (not used by the app)
        __test: {
            setClock: function(fn) { _clock = fn; },
            dayDiff, addDays, loadData, keyFor,
            notifications: _notifyLog,
            get profileId() { return _profileId; }
        }
    };

})();
