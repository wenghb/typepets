/**
 * Bubble Pop Game — TypePets
 * Level-based typing game with dual unlock paths, speed control, and pet rewards.
 * All data via TypePetsData (localStorage).
 */

/**
 * Pure game logic (no DOM access): word lists, level table, text normalisation and
 * input matching. Kept apart from the game so it can be unit-tested with node.
 */
const BubblePopLogic = (function() {
    'use strict';

    const HOME_ROW = 'asdfjkl'.split('');
    const ALL_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const WORDS = {
        home_words: ['sad','lad','ask','dad','fall','flask','dash','lash','salad','add','all'],
        short_words: ['the','and','for','are','but','not','you','all','can','her','was','one','our','out','has','his','how','its','may','new','now','old','see','way','who','boy','did','get','let','say','she','too','use','dad','mom','run','fun','big','dog','cat','hat','sun','red','top','hot','cup','map','bed','sit','pen','win','bus','leg','arm','eye'],
        medium_words: ['apple','brave','cloud','dream','every','flame','green','heart','jolly','kites','lemon','music','night','ocean','piano','queen','river','smile','tiger','under','water','about','after','again','began','black','bring','carry','dance','earth','final','ghost','happy','light','magic','never','often','paint','quick','round','sleep','tower','video','world','young'],
        long_words: ['amazing','because','captain','dolphin','excited','fantasy','growing','helpful','imagine','journey','kitchen','library','monster','nothing','outside','penguin','quickly','rainbow','special','trouble','unicorn','volcano','weather','explore','awesome','balloon','camping','dancing'],
        phrases: ['the big dog','run and play','look at that','I can type','good morning','come with me','lets go home','nice to meet','how are you','well done now','the sun is up','try your best','keep it going','you did great'],
    };

    const LEVEL_DEFS = [
        {content:'home_letters',riseTime:10,maxBubbles:3,spawnInterval:3500},
        {content:'home_letters',riseTime:10,maxBubbles:3,spawnInterval:3500},
        {content:'home_letters',riseTime:10,maxBubbles:3,spawnInterval:3500},
        {content:'home_words',riseTime:8,maxBubbles:4,spawnInterval:3000},
        {content:'home_words',riseTime:8,maxBubbles:4,spawnInterval:3000},
        {content:'all_letters',riseTime:7,maxBubbles:4,spawnInterval:2500},
        {content:'all_letters',riseTime:7,maxBubbles:4,spawnInterval:2500},
        {content:'all_letters',riseTime:7,maxBubbles:4,spawnInterval:2500},
        {content:'short_words',riseTime:6,maxBubbles:5,spawnInterval:2200},
        {content:'short_words',riseTime:6,maxBubbles:5,spawnInterval:2200},
        {content:'short_words',riseTime:6,maxBubbles:5,spawnInterval:2200},
        {content:'medium_words',riseTime:5,maxBubbles:5,spawnInterval:2000},
        {content:'medium_words',riseTime:5,maxBubbles:5,spawnInterval:2000},
        {content:'medium_words',riseTime:5,maxBubbles:5,spawnInterval:2000},
        {content:'long_words',riseTime:4.5,maxBubbles:6,spawnInterval:1800},
        {content:'long_words',riseTime:4.5,maxBubbles:6,spawnInterval:1800},
        {content:'long_words',riseTime:4.5,maxBubbles:6,spawnInterval:1800},
        {content:'phrases',riseTime:4,maxBubbles:7,spawnInterval:1500},
        {content:'phrases',riseTime:4,maxBubbles:7,spawnInterval:1500},
        {content:'phrases',riseTime:4,maxBubbles:7,spawnInterval:1500},
    ];

    const WEAK_KEY_RATE = 0.2;          // share of bubbles that practise a past error key
    const HOME_WORD_LETTER_RATE = 0.4;  // home-word levels still mix in single letters

    /** Bubble text: lowercase letters and single spaces only (everything the input can match). */
    function normalizeWord(text) {
        return String(text == null ? '' : text).toLowerCase()
            .replace(/\s+/g, ' ').replace(/[^a-z ]+/g, '').replace(/ +/g, ' ').trim();
    }

    /** What the player typed: lowercase, no leading space, runs of spaces collapsed (a trailing space is kept). */
    function normalizeTyped(raw) {
        return String(raw == null ? '' : raw).toLowerCase().replace(/\s+/g, ' ').replace(/^ /, '');
    }

    /** Keys a level may practise: home-row levels stay on the home row. */
    function allowedKeysFor(content) {
        return (content === 'home_letters' || content === 'home_words') ? HOME_ROW : ALL_LETTERS;
    }

    /**
     * Past error keys that are safe to spawn as bubbles: single a–z letters within the level's
     * key set. Drops spaces, digits (1/2 are power-up hotkeys), punctuation and so on.
     */
    function injectableKeys(weakKeys, allowed) {
        const out = [];
        for (const raw of Object.keys(weakKeys || {})) {
            const k = String(raw).toLowerCase();
            if (/^[a-z]$/.test(k) && allowed.indexOf(k) !== -1 && out.indexOf(k) === -1) out.push(k);
        }
        return out;
    }

    function pick(list, rng) { return list[Math.floor(rng() * list.length)]; }

    /** Choose the text for a new bubble. Always returns a normalised, typeable string. */
    function pickWord(content, weakKeys, rng) {
        rng = rng || Math.random;
        const allowed = allowedKeysFor(content);
        const weak = injectableKeys(weakKeys, allowed);
        let word;
        if (weak.length > 0 && rng() < WEAK_KEY_RATE) {
            word = pick(weak, rng);
        } else {
            switch (content) {
                case 'home_letters': word = pick(HOME_ROW, rng); break;
                case 'home_words': word = rng() < HOME_WORD_LETTER_RATE ? pick(HOME_ROW, rng) : pick(WORDS.home_words, rng); break;
                case 'short_words': case 'medium_words': case 'long_words': case 'phrases': word = pick(WORDS[content], rng); break;
                default: word = pick(ALL_LETTERS, rng);
            }
        }
        return normalizeWord(word) || pick(allowed, rng);
    }

    /**
     * Decide what the current input means, given the words on screen.
     *   pop   → pop a bubble showing `word`, then keep resolving `rest`
     *   wait  → valid start of at least one bubble; keep `text` in the box
     *           (`exact` = it already matches a bubble that is also the start of a longer one)
     *   error → matches nothing on screen
     *   empty → nothing typed
     * Exact matches pop straight away unless another bubble starts with the same text
     * ("s" while "sad" is up); then Space/Enter, or typing on past it, pops the short one.
     * `submit` = Enter was pressed.
     */
    function resolveTyped(raw, words, submit) {
        const t = normalizeTyped(raw);
        if (!t) return { status: 'empty', text: '' };
        const core = t.replace(/ $/, '');
        const endsWithSpace = core.length !== t.length;
        const isExact = (s) => words.indexOf(s) !== -1;
        const isPrefix = (s) => words.some(w => w.startsWith(s));
        const hasLonger = (s) => words.some(w => w.length > s.length && w.startsWith(s));
        const waiting = () => ({
            status: 'wait', text: t, exact: isExact(core),
            spacePops: !endsWithSpace && isExact(core) && !isPrefix(core + ' '),
        });

        if (submit) {
            if (isExact(core)) return { status: 'pop', word: core, rest: '' };
            if (isPrefix(t)) return waiting();
        } else if (endsWithSpace) {
            if (isPrefix(t)) return waiting();          // a phrase continues after this space
            if (isExact(core)) return { status: 'pop', word: core, rest: '' };
        } else {
            if (isExact(t) && !hasLonger(t)) return { status: 'pop', word: t, rest: '' };
            if (isPrefix(t)) return waiting();
        }

        // Not the start of any bubble. If it begins with a complete bubble word, pop that one
        // and carry the remainder over (prefer the longest word whose remainder still fits a bubble).
        let fallback = null;
        for (let k = t.length - 1; k >= 1; k--) {
            const head = t.slice(0, k).replace(/ $/, '');
            if (!head || !isExact(head)) continue;
            const tail = t.slice(k).replace(/^ /, '');
            const others = words.slice();
            others.splice(others.indexOf(head), 1);
            if (tail === '' || others.some(w => w.startsWith(tail) || w === tail.replace(/ $/, ''))) {
                return { status: 'pop', word: head, rest: tail };
            }
            if (!fallback) fallback = { status: 'pop', word: head, rest: tail };
        }
        if (fallback) return fallback;

        const prev = t.slice(0, -1);
        const expected = [];
        for (const w of words) {
            if (w.length > prev.length && w.startsWith(prev) && expected.indexOf(w[prev.length]) === -1) expected.push(w[prev.length]);
        }
        return { status: 'error', typed: t[t.length - 1], expected: expected.length === 1 ? expected[0] : null };
    }

    // ── Frame timing ──────────────────────────────────────────
    // Speeds are tuned in "pixels per 60 fps frame"; dt scales them to the real frame length
    // so the game plays the same on 30, 60 and 144 Hz screens.
    const FRAME_MS = 1000 / 60;
    const MAX_MOVE_MS = 100;    // clamp hiccups so bubbles never teleport
    const MAX_CLOCK_MS = 250;   // longest frame counted towards the level clock / timers

    /** How far to advance this frame: clockMs for timers, dt (in 60 fps frames) for motion. */
    function frameStep(ts, lastTs) {
        if (lastTs == null || !(ts > lastTs)) return { clockMs: 0, dt: 0 };
        const raw = ts - lastTs;
        return { clockMs: Math.min(raw, MAX_CLOCK_MS), dt: Math.min(raw, MAX_MOVE_MS) / FRAME_MS };
    }

    /** Rise speed (px per 60 fps frame) to cross the playfield in `riseTime` seconds. */
    function riseSpeed(height, radius, riseTime) {
        return (height + radius * 2) / (riseTime * 60);
    }

    /** Move one bubble by dt frames. `slow` < 1 while frozen; `gameMs` drives the wobble. */
    function stepBubble(b, dt, slow, gameMs, width) {
        b.y -= b.speed * slow * dt;
        b.x += Math.sin(gameMs / 1000 + b.wobbleOffset) * b.wobbleAmp * 0.25 * dt;
        b.x = Math.max(b.radius, Math.min(width - b.radius, b.x));
        b.scale = Math.min(1, b.scale + 0.04 * dt);
    }

    return {
        HOME_ROW, ALL_LETTERS, WORDS, LEVEL_DEFS, WEAK_KEY_RATE,
        normalizeWord, normalizeTyped, allowedKeysFor, injectableKeys, pickWord, resolveTyped,
        FRAME_MS, MAX_MOVE_MS, MAX_CLOCK_MS, frameStep, riseSpeed, stepBubble,
    };
})();

(function() {
    'use strict';

    const L = BubblePopLogic;
    const LEVEL_DEFS = L.LEVEL_DEFS;

    const STAGE_BUBBLE_MAP = {1:[1,3],2:[4,5],3:[6,8],4:[9,11],5:[12,14],6:[15,17],7:[18,20],8:null};

    function getRequiredStage(level) {
        for (const [stage, range] of Object.entries(STAGE_BUBBLE_MAP)) {
            if (!range) continue;
            if (level >= range[0] && level <= range[1]) return parseInt(stage);
        }
        return null;
    }

    const MILESTONES = {
        5:  { emoji: '🍎', name: 'Golden Apple', desc: '+50 happiness' },
        10: { emoji: '⭐', name: 'Star Cookie', desc: '+100 happiness' },
        15: { emoji: '🌈', name: 'Rainbow Cake', desc: '+150 happiness' },
        20: { emoji: '👑', name: 'Crown', desc: 'Mastery!' },
    };

    function getSpeedLabel(mult) {
        if (mult <= 0.7) return { wpm: '~8 WPM', tier: 'Beginner' };
        if (mult <= 1.0) return { wpm: '~15 WPM', tier: 'Normal' };
        if (mult <= 1.5) return { wpm: '~25 WPM', tier: 'Fast' };
        if (mult <= 2.5) return { wpm: '~40 WPM', tier: 'Expert' };
        if (mult <= 5.0) return { wpm: '~70 WPM', tier: 'Master' };
        return { wpm: '~100+ WPM', tier: 'Insane' };
    }
    function getSpeedBonus(mult) {
        if (mult <= 1.0) return 0;
        return Math.min(500, Math.round((mult - 1.0) * 50));
    }

    let speedMultiplier = TypePetsData.getSpeedPreference();

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const LEVEL_PASS_TIME = 60;
    const FREEZE_MS = 3000;        // ❄️ lasts 3 seconds…
    const FREEZE_SLOWDOWN = 0.15;  // …at 15% speed
    const LEVEL_DESCS = ['Home row','Home row','Home row','Home + words','Home + words','All letters','All letters','All letters','Short words','Short words','Short words','Medium words','Medium words','Medium words','Long words','Long words','Long words','Phrases','Phrases','Phrases'];

    let gameRunning = false, paused = false, score = 0, lives = 3, combo = 0, maxCombo = 0;
    let currentLevel = 1, isFreePlay = false, maxUnlockedLevel = 1, maxTrainingStage = 0;
    let bubbles = [], particles = [], floatingTexts = [];
    let totalPops = 0, totalMisses = 0, errorKeys = {}, weakKeys = {};
    let personalBest = TypePetsData.getBubblePersonalBest();
    let frameId = null, lastTs = null;       // rAF handle + timestamp of the previous frame
    let activeMs = 0;                        // time actually played (excludes pauses / hidden tab)
    let lastSpawnMs = -Infinity, freezeMs = 0, levelTimer = 0;
    let earnedMilestones = new Set();
    let powerUps = { freeze: 0, bomb: 0 };
    let freePlayLevel = 1;
    let typedText = '', typedState = null;   // current partial input + its resolveTyped() result
    let needsRevalidate = false;             // a bubble vanished: re-check what's in the input box

    const BUBBLE_COLORS = [
        {fill:'rgba(74,144,217,0.75)',stroke:'rgba(44,114,187,0.9)',text:'#FFFFFF'},
        {fill:'rgba(155,142,196,0.75)',stroke:'rgba(125,112,166,0.9)',text:'#FFFFFF'},
        {fill:'rgba(60,179,113,0.75)',stroke:'rgba(30,149,83,0.9)',text:'#FFFFFF'},
        {fill:'rgba(237,137,54,0.75)',stroke:'rgba(207,107,24,0.9)',text:'#FFFFFF'},
        {fill:'rgba(205,92,92,0.75)',stroke:'rgba(175,62,62,0.9)',text:'#FFFFFF'},
        {fill:'rgba(70,160,190,0.75)',stroke:'rgba(40,130,160,0.9)',text:'#FFFFFF'},
        {fill:'rgba(218,165,32,0.75)',stroke:'rgba(188,135,2,0.9)',text:'#FFFFFF'},
    ];

    let bgBubbles = [];
    for (let i = 0; i < 15; i++) {
        bgBubbles.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*5+2,speed:Math.random()*0.2+0.08,wobble:Math.random()*Math.PI*2});
    }

    const scoreDisplay = document.getElementById('scoreDisplay');
    const comboDisplay = document.getElementById('comboDisplay');
    const levelDisplay = document.getElementById('levelDisplay');
    const livesDisplay = document.getElementById('livesDisplay');
    const bestDisplay = document.getElementById('bestDisplay');
    const timerDisplay = document.getElementById('timerDisplay');
    const gameInput = document.getElementById('gameInput');
    const startOverlay = document.getElementById('startOverlay');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const canvasContainer = document.getElementById('canvasContainer');
    const freezeBtn = document.getElementById('freezeBtn');
    const bombBtn = document.getElementById('bombBtn');
    const freezeCount = document.getElementById('freezeCount');
    const bombCount = document.getElementById('bombCount');
    const levelList = document.getElementById('levelList');
    const levelCompleteOverlay = document.getElementById('levelCompleteOverlay');
    const pauseOverlay = document.getElementById('pauseOverlay');
    const pauseBtn = document.getElementById('pauseBtn');

    bestDisplay.textContent = personalBest;

    const speedSlider = document.getElementById('speedSlider');
    const speedValueEl = document.getElementById('speedValue');
    const speedWpmEl = document.getElementById('speedWpm');
    const speedBonusEl = document.getElementById('speedBonus');

    function updateSpeedDisplay() {
        const info = getSpeedLabel(speedMultiplier);
        const bonus = getSpeedBonus(speedMultiplier);
        speedValueEl.textContent = speedMultiplier.toFixed(1) + 'x';
        speedWpmEl.textContent = info.wpm + ' — ' + info.tier;
        speedBonusEl.textContent = bonus > 0 ? `+${bonus}% XP bonus` : '';
    }

    speedSlider.value = speedMultiplier;
    updateSpeedDisplay();

    speedSlider.addEventListener('input', () => {
        speedMultiplier = parseFloat(parseFloat(speedSlider.value).toFixed(1));
        TypePetsData.saveSpeedPreference(speedMultiplier);
        updateSpeedDisplay();
    });

    function isLevelUnlockedByTraining(lvl) {
        for (const [stage, range] of Object.entries(STAGE_BUBBLE_MAP)) {
            if (!range) continue;
            if (lvl >= range[0] && lvl <= range[1] && parseInt(stage) <= maxTrainingStage) return true;
        }
        return false;
    }

    function isLevelUnlocked(lvl) {
        if (lvl <= maxUnlockedLevel) return true;
        if (isLevelUnlockedByTraining(lvl)) return true;
        return false;
    }

    function loadProgress() {
        const bl = TypePetsData.getBubbleLevel();
        maxUnlockedLevel = bl.max_level || 1;
        const ts = TypePetsData.getTrainingStage();
        maxTrainingStage = ts.max_stage || 0;
        const milestones = TypePetsData.getMilestones();
        earnedMilestones = new Set(milestones.map(m => m.reward_id));
        renderLevelPanel();
    }

    function renderLevelPanel() {
        levelList.innerHTML = '';
        for (let i = 1; i <= 20; i++) {
            const unlocked = isLevelUnlocked(i);
            const isActive = !isFreePlay && i === currentLevel;
            const isCompleted = i < maxUnlockedLevel;
            let cls = 'level-item';
            if (isActive) cls += ' level-active';
            else if (!unlocked) cls += ' level-locked';
            else if (isCompleted) cls += ' level-completed';
            const iconContent = !unlocked ? '🔒' : isCompleted ? '✓' : i;
            const item = document.createElement('div');
            item.className = cls;
            let descHtml = `<div class="level-desc">${LEVEL_DESCS[i-1]}</div>`;
            if (!unlocked) {
                const reqStage = getRequiredStage(i);
                if (reqStage) descHtml += `<div class="level-lock-reason">Train Stage ${reqStage} or pass Level ${i-1}</div>`;
            }
            if (MILESTONES[i]) {
                const m = MILESTONES[i];
                const rewardId = i===5?'golden_apple':i===10?'star_cookie':i===15?'rainbow_cake':'crown';
                const earned = earnedMilestones.has(rewardId);
                descHtml += `<div class="level-milestone">${m.emoji} ${earned ? '✓' : m.name}</div>`;
            }
            if (unlocked && !isCompleted) {
                const baseXp = i * 3;
                const bonus = getSpeedBonus(speedMultiplier);
                const totalXp = bonus > 0 ? Math.round(baseXp * (1 + bonus / 100)) : baseXp;
                descHtml += `<div class="level-xp-preview">~${totalXp} XP</div>`;
            }
            item.innerHTML = `<div class="level-icon">${iconContent}</div><div class="level-info"><div class="level-name">Level ${i}</div>${descHtml}</div>`;
            if (unlocked) item.onclick = () => selectLevel(i);
            levelList.appendChild(item);
        }
        const fpBtn = document.getElementById('freePlayBtn');
        const fpUnlocked = maxTrainingStage >= 8 || maxUnlockedLevel > 20;
        fpBtn.className = 'free-play-btn' + (isFreePlay ? ' active' : '');
        fpBtn.style.opacity = fpUnlocked ? '1' : '0.4';
        fpBtn.title = fpUnlocked ? '' : 'Complete Training Stage 8 to unlock';
    }

    function selectLevel(lvl) {
        if (!isLevelUnlocked(lvl)) return;
        isFreePlay = false; currentLevel = lvl;
        renderLevelPanel(); levelDisplay.textContent = currentLevel;
        if (!gameRunning) { startOverlay.classList.remove('hidden'); gameOverOverlay.classList.add('hidden'); }
    }

    window.selectFreePlay = function() {
        const fpUnlocked = maxTrainingStage >= 8 || maxUnlockedLevel > 20;
        if (!fpUnlocked) { showToast('Complete Training Stage 8 to unlock Free Play', 'error'); return; }
        isFreePlay = true; currentLevel = 1;
        renderLevelPanel(); levelDisplay.textContent = '∞';
        if (!gameRunning) { startOverlay.classList.remove('hidden'); gameOverOverlay.classList.add('hidden'); }
    };

    window.goNextLevel = function() {
        levelCompleteOverlay.classList.add('hidden');
        currentLevel++; if (currentLevel > 20) currentLevel = 20;
        renderLevelPanel(); startGame();
    };

    window.closeLevelComplete = function() { levelCompleteOverlay.classList.add('hidden'); };

    function getLevelParams() {
        if (isFreePlay) { const idx = Math.min(freePlayLevel-1, LEVEL_DEFS.length-1); return LEVEL_DEFS[idx]; }
        return LEVEL_DEFS[currentLevel-1];
    }

    function spawnBubble() {
        const params = getLevelParams();
        const effectiveMaxBubbles = Math.round(params.maxBubbles * speedMultiplier);
        if (bubbles.length >= effectiveMaxBubbles) return;
        const word = L.pickWord(params.content, weakKeys, Math.random);
        const radius = Math.max(28, 16 + word.length * 8);
        const actualRadius = word.length > 8 ? Math.max(45, 10 + word.length * 5) : radius;
        const x = actualRadius + Math.random() * (W - actualRadius * 2);
        const colorScheme = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
        const speedVariation = L.riseSpeed(H, actualRadius, params.riseTime) * (0.85 + Math.random() * 0.3);
        bubbles.push({x,y:H+actualRadius,radius:actualRadius,word,color:colorScheme,speed:speedVariation,wobbleOffset:Math.random()*Math.PI*2,wobbleAmp:Math.random()*1.2+0.3,opacity:1,scale:0.3,powerUp:Math.random()<0.06?(Math.random()<0.5?'freeze':'bomb'):null});
    }

    function popBubble(index) {
        const b = bubbles[index];
        const numParticles = 10 + b.word.length * 2;
        for (let i = 0; i < numParticles; i++) {
            const angle = (Math.PI*2/numParticles)*i+Math.random()*0.5;
            const sp = 1.5+Math.random()*4;
            particles.push({x:b.x,y:b.y,vx:Math.cos(angle)*sp,vy:Math.sin(angle)*sp,radius:1.5+Math.random()*3,color:b.color.stroke,life:1,decay:0.02+Math.random()*0.02,gravity:0.04});
        }
        if (b.powerUp) { powerUps[b.powerUp]++; updatePowerUpUI(); }
        combo++; if (combo > maxCombo) maxCombo = combo;
        const multiplier = Math.min(combo, 10);
        const wordBonus = b.word.length * 10;
        const points = wordBonus * multiplier;
        score += points; totalPops++;
        floatingTexts.push({x:b.x,y:b.y,text:`+${points}`,color:combo>=5?'#ED8936':'#68D391',life:1,vy:-1.8,size:combo>=5?24:18});
        if (combo >= 5) { canvasContainer.classList.add('screen-shake'); setTimeout(() => canvasContainer.classList.remove('screen-shake'), 300); }
        if (window.sound) window.sound.pop();
        bubbles.splice(index, 1);
        if (isFreePlay) { freePlayLevel = Math.floor(score/300)+1; if (freePlayLevel>20) freePlayLevel=20; }
        updateUI();
    }

    /** Remember a key the player struggled with (a–z only, so it can be practised as a bubble later). */
    function recordErrorKey(key) {
        if (!/^[a-z]$/.test(key || '')) return;
        errorKeys[key] = (errorKeys[key] || 0) + 1;
        weakKeys[key] = (weakKeys[key] || 0) + 1;
    }

    function missedBubble(index) {
        const b = bubbles[index]; lives--; combo = 0; totalMisses++;
        // A missed single letter says "hard to find this key"; a missed word doesn't pin down a key.
        if (b.word.length === 1) recordErrorKey(b.word);
        if (window.sound) window.sound.wrong();
        bubbles.splice(index, 1); needsRevalidate = true; updateUI();
        if (lives <= 0) gameOver();
    }

    /** The bubble with this text that is closest to escaping. */
    function findBubbleIndex(word) {
        let idx = -1;
        for (let i = 0; i < bubbles.length; i++) {
            if (bubbles[i].word === word && (idx < 0 || bubbles[i].y < bubbles[idx].y)) idx = i;
        }
        return idx;
    }

    function setTyped(text, state) {
        typedText = text; typedState = state;
        if (gameInput.value !== text) gameInput.value = text;
    }

    function typingError(r) {
        combo = 0; totalMisses++;
        recordErrorKey(r.expected != null ? r.expected : r.typed);
        gameInput.classList.add('shake'); setTimeout(() => gameInput.classList.remove('shake'), 300);
        if (window.sound) window.sound.wrong();
        updateUI();
    }

    /**
     * Match the input box against the bubbles on screen: pop what's complete, keep a valid
     * partial word, and flash + clear anything that can't become a bubble.
     * `submit` = Enter pressed; `silent` = re-check after a bubble vanished (no error penalty).
     */
    function processInput(submit, silent) {
        let text = gameInput.value;
        for (let guard = 0; guard < 50; guard++) {
            const r = L.resolveTyped(text, bubbles.map(b => b.word), submit);
            submit = false;
            if (r.status === 'pop') {
                const idx = findBubbleIndex(r.word);
                if (idx < 0) break;
                popBubble(idx);
                text = r.rest;
                continue;
            }
            if (r.status === 'wait') { setTyped(r.text, r); return; }
            if (r.status === 'error' && !silent && bubbles.length > 0) typingError(r);
            break;
        }
        setTyped('', null);
    }

    function updateUI() {
        scoreDisplay.textContent = score;
        comboDisplay.textContent = combo > 1 ? `x${Math.min(combo,10)}` : 'x1';
        comboDisplay.style.color = combo>=5?'#E07070':combo>=3?'#ED8936':'var(--text-secondary)';
        levelDisplay.textContent = isFreePlay ? '∞' : currentLevel;
        livesDisplay.textContent = '♥'.repeat(Math.max(0,lives));
        if (score > personalBest) bestDisplay.textContent = score;
    }

    function updateTimerDisplay() {
        const mins = Math.floor(levelTimer/60);
        const secs = levelTimer%60;
        timerDisplay.textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
    }

    function updatePowerUpUI() {
        freezeCount.textContent = powerUps.freeze; bombCount.textContent = powerUps.bomb;
        freezeBtn.disabled = powerUps.freeze <= 0; bombBtn.disabled = powerUps.bomb <= 0;
    }

    window.usePowerUp = function(type) {
        if (powerUps[type] <= 0 || !gameRunning || paused) return;
        powerUps[type]--; updatePowerUpUI();
        if (type === 'freeze') { freezeMs = FREEZE_MS; if (window.sound) window.sound.correct(); }
        else if (type === 'bomb') {
            if (window.sound) window.sound.celebration();
            canvasContainer.classList.add('screen-shake');
            setTimeout(() => canvasContainer.classList.remove('screen-shake'), 400);
            while (bubbles.length > 0) {
                const b = bubbles[0];
                for (let i=0;i<6;i++) {const a=Math.random()*Math.PI*2;particles.push({x:b.x,y:b.y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5,radius:1.5+Math.random()*2.5,color:b.color.stroke,life:1,decay:0.025,gravity:0.04});}
                score += b.word.length * 5; totalPops++; bubbles.splice(0,1);
            }
            needsRevalidate = true;
            updateUI();
        }
    };

    function drawBackground(dt) {
        const grad = ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0,'#1A2744');grad.addColorStop(0.4,'#1E3A5F');grad.addColorStop(0.8,'#2A5070');grad.addColorStop(1,'#2A6A70');
        ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
        if (freezeMs > 0) { ctx.fillStyle='rgba(180,220,240,0.10)'; ctx.fillRect(0,0,W,H); }
        ctx.save(); ctx.globalAlpha=0.03;
        for (let i=0;i<4;i++) {const x=100+i*160;const grad2=ctx.createLinearGradient(x,0,x,H);grad2.addColorStop(0,'#ffffff');grad2.addColorStop(1,'transparent');ctx.fillStyle=grad2;ctx.beginPath();ctx.moveTo(x-25,0);ctx.lineTo(x+25,0);ctx.lineTo(x+50+Math.sin(Date.now()/2000+i)*15,H);ctx.lineTo(x-50+Math.sin(Date.now()/2000+i)*15,H);ctx.fill();}
        ctx.restore();
        ctx.save(); ctx.globalAlpha=0.1;
        for (const bb of bgBubbles) {bb.y-=bb.speed*dt;bb.x+=Math.sin(Date.now()/3000+bb.wobble)*0.15*dt;if(bb.y<-10){bb.y=H+10;bb.x=Math.random()*W;}ctx.beginPath();ctx.arc(bb.x,bb.y,bb.r,0,Math.PI*2);ctx.fillStyle='#88BBDD';ctx.fill();}
        ctx.restore();
        ctx.save();ctx.globalAlpha=0.2;ctx.fillStyle='#1A3A50';ctx.beginPath();ctx.moveTo(0,H);
        for(let x=0;x<=W;x+=40){ctx.lineTo(x,H-12-Math.sin(x/60+Date.now()/5000)*6);}
        ctx.lineTo(W,H);ctx.fill();ctx.restore();
        if (!isFreePlay && gameRunning) {
            const progress = Math.min(activeMs/(LEVEL_PASS_TIME*1000),1);
            ctx.save();ctx.globalAlpha=0.5;ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(20,10,W-40,6);
            ctx.fillStyle=progress>=1?'#68D391':'#4A90D9';ctx.fillRect(20,10,(W-40)*progress,6);ctx.restore();
        }
    }

    function drawBubble(b) {
        ctx.save();const s=Math.min(1,b.scale);ctx.translate(b.x,b.y);ctx.scale(s,s);const r=b.radius;
        ctx.shadowColor=b.color.stroke;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=b.color.fill;ctx.fill();ctx.strokeStyle=b.color.stroke;ctx.lineWidth=1.5;ctx.stroke();ctx.shadowBlur=0;
        ctx.beginPath();ctx.arc(-r*0.25,-r*0.3,r*0.2,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fill();
        const fontSize=b.word.length===1?r*0.85:Math.min(r*0.55,20);
        ctx.font=`bold ${fontSize}px Fredoka, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=3;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;ctx.fillStyle=b.color.text;
        if(b.word.length>10){const words=b.word.split(' ');if(words.length>1){const lineH=fontSize+2;const startY=-(words.length-1)*lineH/2;words.forEach((w,i)=>ctx.fillText(w,0,startY+i*lineH));}else{ctx.fillText(b.word,0,2);}}else{ctx.fillText(b.word,0,2);}
        if(b.powerUp){ctx.font=`${r*0.35}px sans-serif`;ctx.fillText(b.powerUp==='freeze'?'❄️':'💣',0,-r*0.5);}
        if(b.y<50){ctx.globalAlpha=0.4+Math.sin(Date.now()/100)*0.4;ctx.strokeStyle='#E07070';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r+4,0,Math.PI*2);ctx.stroke();}
        ctx.restore();
        drawTypedRing(b);
    }

    /** Ring the bubbles the current input is heading for (green = complete, press Space/Enter). */
    function drawTypedRing(b) {
        if (!typedText || !b.word.startsWith(typedText)) return;
        const exact = !!(typedState && typedState.exact && b.word === typedText.replace(/ $/, ''));
        const s = Math.min(1, b.scale);
        ctx.save();
        ctx.strokeStyle = exact ? '#68D391' : 'rgba(255,255,255,0.85)';
        ctx.lineWidth = exact ? 3 : 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * s + 3, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    /** "Press Space or Enter" hint when a short word is typed that also starts a longer one. */
    function drawInputHint() {
        if (!typedState || !typedState.exact) return;
        const word = typedText.replace(/ $/, '');
        const msg = `Press ${typedState.spacePops ? 'Space or Enter' : 'Enter'} ↵ to pop “${word}”`;
        ctx.save();
        ctx.font = 'bold 16px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(msg).width + 28;
        ctx.globalAlpha = 0.85; ctx.fillStyle = '#1A2744';
        ctx.fillRect(W / 2 - w / 2, H - 46, w, 30);
        ctx.globalAlpha = 1; ctx.fillStyle = '#FFFFFF';
        ctx.fillText(msg, W / 2, H - 31);
        ctx.restore();
    }

    function drawParticles(dt) {
        for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;p.life-=p.decay*dt;if(p.life<=0){particles.splice(i,1);continue;}ctx.save();ctx.globalAlpha=p.life;ctx.beginPath();ctx.arc(p.x,p.y,p.radius*p.life,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.restore();}
    }

    function drawFloatingTexts(dt) {
        for(let i=floatingTexts.length-1;i>=0;i--){const ft=floatingTexts[i];ft.y+=ft.vy*dt;ft.life-=0.015*dt;if(ft.life<=0){floatingTexts.splice(i,1);continue;}ctx.save();ctx.globalAlpha=Math.min(1,ft.life*2);ctx.font=`bold ${ft.size}px Fredoka, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillText(ft.text,ft.x+1,ft.y+1);ctx.fillStyle=ft.color;ctx.fillText(ft.text,ft.x,ft.y);ctx.restore();}
    }

    function startLoop() { if (frameId == null) frameId = requestAnimationFrame(gameLoop); }
    function stopLoop() { if (frameId != null) cancelAnimationFrame(frameId); frameId = null; }

    function gameLoop(ts) {
        frameId = null;
        if (!gameRunning || paused) return;
        const step = L.frameStep(ts, lastTs);
        lastTs = ts;
        activeMs += step.clockMs;
        if (freezeMs > 0) freezeMs = Math.max(0, freezeMs - step.clockMs);
        const secs = Math.floor(activeMs / 1000);
        if (secs !== levelTimer) { levelTimer = secs; updateTimerDisplay(); }
        if (!isFreePlay && activeMs >= LEVEL_PASS_TIME * 1000) { onLevelPassed(); return; }

        const params = getLevelParams();
        if (activeMs - lastSpawnMs >= params.spawnInterval / speedMultiplier) { spawnBubble(); lastSpawnMs = activeMs; }
        const slow = freezeMs > 0 ? FREEZE_SLOWDOWN : 1;
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            L.stepBubble(b, step.dt, slow, activeMs, W);
            if (b.y + b.radius < -10) {
                missedBubble(i);
                if (!gameRunning) return;   // that was the last life
            }
        }
        if (needsRevalidate) { needsRevalidate = false; processInput(false, true); }

        ctx.clearRect(0,0,W,H); drawBackground(step.dt);
        for (let i = bubbles.length - 1; i >= 0; i--) drawBubble(bubbles[i]);
        drawParticles(step.dt); drawFloatingTexts(step.dt); drawInputHint();
        frameId = requestAnimationFrame(gameLoop);
    }

    // ── Pause / resume ────────────────────────────────────────
    function pauseGame() {
        if (!gameRunning || paused) return;
        paused = true;
        stopLoop();
        pauseOverlay.classList.remove('hidden');
        pauseBtn.disabled = true;
    }

    function resumeGame() {
        if (!gameRunning || !paused) return;
        if (document.getElementById('donatePrompt')) return;   // let that dialog be closed first
        paused = false;
        pauseOverlay.classList.add('hidden');
        pauseBtn.disabled = false;
        lastTs = null;   // the paused gap never counts as game time
        startLoop();
        gameInput.focus();
    }

    window.pauseGame = pauseGame;
    window.resumeGame = resumeGame;

    // Switching tab / minimising pauses: the level clock must not run while nobody can play.
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
    pauseOverlay.addEventListener('click', resumeGame);
    const RESUME_IGNORED_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Fn', 'OS'];
    document.addEventListener('keydown', (e) => {
        if (!paused) return;
        if (RESUME_IGNORED_KEYS.indexOf(e.key) !== -1 || e.ctrlKey || e.metaKey || e.altKey) return;
        if (document.getElementById('donatePrompt')) return;
        e.preventDefault(); e.stopPropagation();   // the resume key isn't typed into the game
        resumeGame();
    }, true);
    // A modal (e.g. the donate prompt) appearing mid-game pauses it.
    if (window.MutationObserver && document.body) {
        new MutationObserver(() => {
            if (gameRunning && !paused && document.getElementById('donatePrompt')) pauseGame();
        }).observe(document.body, { childList: true });
    }

    gameInput.addEventListener('input', () => {
        if (!gameRunning || paused) return;
        let value = gameInput.value;
        if (/[12]/.test(value)) {
            // Some (mobile) keyboards don't let keydown block the power-up hotkeys.
            for (const ch of value) {
                if (ch === '1') window.usePowerUp('freeze');
                else if (ch === '2') window.usePowerUp('bomb');
            }
            gameInput.value = value.replace(/[12]/g, '');
        }
        processInput(false, false);
    });

    gameInput.addEventListener('keydown', (e) => {
        if (!gameRunning || paused || e.isComposing) return;
        if (e.key === '1' || e.key === '2') { e.preventDefault(); window.usePowerUp(e.key === '1' ? 'freeze' : 'bomb'); return; }
        if (e.key === 'Enter') { e.preventDefault(); processInput(true, false); return; }
        if (e.key === 'Escape') { e.preventDefault(); if (gameInput.value) setTyped('', null); else pauseGame(); }
    });

    window.startGame = function() {
        score=0;lives=3;combo=0;maxCombo=0;bubbles=[];particles=[];floatingTexts=[];
        totalPops=0;totalMisses=0;errorKeys={};
        powerUps={freeze:1,bomb:0};freezeMs=0;
        levelTimer=0;freePlayLevel=1;
        activeMs=0;lastSpawnMs=-Infinity;lastTs=null;gameRunning=true;paused=false;
        speedMultiplier=parseFloat(speedSlider.value);
        loadWeakKeys();
        startOverlay.classList.add('hidden');gameOverOverlay.classList.add('hidden');levelCompleteOverlay.classList.add('hidden');pauseOverlay.classList.add('hidden');
        pauseBtn.disabled = false;
        updateUI();updateTimerDisplay();updatePowerUpUI();
        setTyped('', null);gameInput.focus();
        stopLoop(); startLoop();
    };

    function onLevelPassed() {
        if (currentLevel < 20) {
            const nextLevel = currentLevel + 1;
            if (nextLevel > maxUnlockedLevel) {
                maxUnlockedLevel = nextLevel;
                TypePetsData.saveBubbleLevel(maxUnlockedLevel);
            }
        }
        renderLevelPanel();
        let subText = currentLevel<20 ? `Level ${currentLevel+1} unlocked!` : 'All levels complete! 🏆';
        const milestoneRewardIds = {5:'golden_apple',10:'star_cookie',15:'rainbow_cake',20:'crown'};
        const rewardId = milestoneRewardIds[currentLevel];
        if (rewardId && !earnedMilestones.has(rewardId)) {
            const m = MILESTONES[currentLevel];
            subText += `\n${m.emoji} You earned ${m.name} for your pet!`;
        }
        document.getElementById('lcTitle').textContent = `Level ${currentLevel} Complete!`;
        document.getElementById('lcSub').textContent = subText;
        gameRunning = false; paused = false; stopLoop(); pauseBtn.disabled = true;
        levelCompleteOverlay.classList.remove('hidden');
        if (window.sound) window.sound.celebration();
        spawnConfetti(60);
        if (window.maybeDonatePrompt) window.maybeDonatePrompt();
        const duration = Math.round(activeMs/1000);
        const accuracy = totalPops+totalMisses>0 ? Math.round((totalPops/(totalPops+totalMisses))*100) : 0;
        const wpm = duration>0 ? Math.round(totalPops/(duration/60)) : 0;
        const sessionData = {mode:'bubble_pop',level:currentLevel,wpm,accuracy,duration_seconds:duration,keys_pressed:totalPops,errors:totalMisses,error_keys:errorKeys,score,speed_multiplier:speedMultiplier};
        const result = TypePetsData.saveSession(sessionData);
        if (result.milestone_rewards && result.milestone_rewards.length > 0) {
            for (const reward of result.milestone_rewards) {
                earnedMilestones.add(reward.id);
                showToast(`${reward.name} earned for your pet! 🎉`, 'achievement', 5000);
            }
            renderLevelPanel();
        }
    }

    function loadWeakKeys() {
        const data = TypePetsData.getWeakness();
        weakKeys = {};
        if (data.weak_keys) { data.weak_keys.forEach(([key, count]) => { weakKeys[key] = count; }); }
    }

    function gameOver() {
        gameRunning = false; paused = false; stopLoop(); pauseBtn.disabled = true;
        const duration = Math.round(activeMs/1000);
        const accuracy = totalPops+totalMisses>0 ? Math.round((totalPops/(totalPops+totalMisses))*100) : 0;
        const isNewBest = score > personalBest;
        if (isNewBest) { personalBest=score; TypePetsData.saveBubblePersonalBest(score); bestDisplay.textContent=personalBest; }
        document.getElementById('finalScore').textContent = score;
        document.getElementById('finalCombo').textContent = maxCombo;
        document.getElementById('finalAccuracy').textContent = accuracy+'%';
        const goTitle = document.getElementById('gameOverTitle');
        const goSub = document.getElementById('gameOverSubtitle');
        if (isNewBest) {
            document.getElementById('finalScore').classList.add('new-best');
            goTitle.textContent='New Record!';goSub.textContent=`Score: ${personalBest}`;
            spawnConfetti(80);if(window.sound) window.sound.celebration();
        } else {
            document.getElementById('finalScore').classList.remove('new-best');
            goTitle.textContent='Game Over';goSub.textContent=`Best: ${personalBest}`;
        }
        gameOverOverlay.classList.remove('hidden');
        const wpm = duration>0 ? Math.round(totalPops/(duration/60)) : 0;
        const sessionData = {mode:'bubble_pop',level:isFreePlay?freePlayLevel:currentLevel,wpm,accuracy,duration_seconds:duration,keys_pressed:totalPops,errors:totalMisses,error_keys:errorKeys,score,speed_multiplier:speedMultiplier};
        const result = TypePetsData.saveSession(sessionData);
        if (result.milestone_rewards && result.milestone_rewards.length > 0) {
            for (const reward of result.milestone_rewards) {
                earnedMilestones.add(reward.id);
                showToast(`${reward.name} earned for your pet! 🎉`, 'achievement', 5000);
            }
            renderLevelPanel();
        }
        checkAchievements(sessionData);
    }

    drawBackground(0);
    loadProgress();
    document.addEventListener('click', () => { if (gameRunning && !paused) gameInput.focus(); });
})();
