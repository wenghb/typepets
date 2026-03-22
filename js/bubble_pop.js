/**
 * Bubble Pop Game — TypePets
 * Level-based typing game with dual unlock paths, speed control, and pet rewards.
 * All data via TypePetsData (localStorage).
 */

(function() {
    'use strict';

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

    const HOME_ROW = 'asdfjkl'.split('');
    const HOME_WORDS = ['sad','lad','ask','dad','fall','flask','dash','lash','salad','add','all'];
    const ALL_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const SHORT_WORDS = ['the','and','for','are','but','not','you','all','can','her','was','one','our','out','has','his','how','its','may','new','now','old','see','way','who','boy','did','get','let','say','she','too','use','dad','mom','run','fun','big','dog','cat','hat','sun','red','top','hot','cup','map','bed','sit','pen','win','bus','leg','arm','eye'];
    const MEDIUM_WORDS = ['apple','brave','cloud','dream','every','flame','green','heart','jolly','kites','lemon','music','night','ocean','piano','queen','river','smile','tiger','under','water','about','after','again','began','black','bring','carry','dance','earth','final','ghost','happy','light','magic','never','often','paint','quick','round','sleep','tower','video','world','young'];
    const LONG_WORDS = ['amazing','because','captain','dolphin','excited','fantasy','growing','helpful','imagine','journey','kitchen','library','monster','nothing','outside','penguin','quickly','rainbow','special','trouble','unicorn','volcano','weather','explore','awesome','balloon','camping','dancing'];
    const PHRASES = ['the big dog','run and play','look at that','I can type','good morning','come with me','lets go home','nice to meet','how are you','well done now','the sun is up','try your best','keep it going','you did great'];

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

    const LEVEL_PASS_TIME = 60;
    const LEVEL_DESCS = ['Home row','Home row','Home row','Home + words','Home + words','All letters','All letters','All letters','Short words','Short words','Short words','Medium words','Medium words','Medium words','Long words','Long words','Long words','Phrases','Phrases','Phrases'];

    let gameRunning = false, score = 0, lives = 3, combo = 0, maxCombo = 0;
    let currentLevel = 1, isFreePlay = false, maxUnlockedLevel = 1, maxTrainingStage = 0;
    let bubbles = [], particles = [], floatingTexts = [];
    let totalPops = 0, totalMisses = 0, errorKeys = {}, weakKeys = {};
    let personalBest = TypePetsData.getBubblePersonalBest();
    let startTime = 0, frameId = null, lastBubbleTime = 0;
    let freezeActive = false, freezeTimer = 0, levelTimer = 0, levelTimerInterval = null, levelPassed = false;
    let earnedMilestones = new Set();
    let powerUps = { freeze: 0, bomb: 0 };
    let freePlayLevel = 1;

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

    function getWord() {
        let def;
        if (isFreePlay) { const idx = Math.min(freePlayLevel-1, LEVEL_DEFS.length-1); def = LEVEL_DEFS[idx]; }
        else { def = LEVEL_DEFS[currentLevel-1]; }
        if (Object.keys(weakKeys).length > 0 && Math.random() < 0.2) {
            const wk = Object.keys(weakKeys);
            return wk[Math.floor(Math.random() * wk.length)];
        }
        switch (def.content) {
            case 'home_letters': return HOME_ROW[Math.floor(Math.random() * HOME_ROW.length)];
            case 'home_words': return Math.random()<0.4 ? HOME_ROW[Math.floor(Math.random()*HOME_ROW.length)] : HOME_WORDS[Math.floor(Math.random()*HOME_WORDS.length)];
            case 'all_letters': return ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)];
            case 'short_words': return SHORT_WORDS[Math.floor(Math.random()*SHORT_WORDS.length)];
            case 'medium_words': return MEDIUM_WORDS[Math.floor(Math.random()*MEDIUM_WORDS.length)];
            case 'long_words': return LONG_WORDS[Math.floor(Math.random()*LONG_WORDS.length)];
            case 'phrases': return PHRASES[Math.floor(Math.random()*PHRASES.length)];
            default: return ALL_LETTERS[Math.floor(Math.random()*ALL_LETTERS.length)];
        }
    }

    function getLevelParams() {
        if (isFreePlay) { const idx = Math.min(freePlayLevel-1, LEVEL_DEFS.length-1); return LEVEL_DEFS[idx]; }
        return LEVEL_DEFS[currentLevel-1];
    }

    function spawnBubble() {
        const params = getLevelParams();
        const effectiveMaxBubbles = Math.round(params.maxBubbles * speedMultiplier);
        if (bubbles.length >= effectiveMaxBubbles) return;
        const word = getWord();
        const radius = Math.max(28, 16 + word.length * 8);
        const actualRadius = word.length > 8 ? Math.max(45, 10 + word.length * 5) : radius;
        const x = actualRadius + Math.random() * (W - actualRadius * 2);
        const colorScheme = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
        const totalDistance = H + actualRadius * 2;
        const frames = params.riseTime * 60;
        const speed = totalDistance / frames;
        const speedVariation = speed * (0.85 + Math.random() * 0.3);
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

    function missedBubble(index) {
        const b = bubbles[index]; lives--; combo = 0; totalMisses++;
        for (const ch of b.word) { errorKeys[ch]=(errorKeys[ch]||0)+1; weakKeys[ch]=(weakKeys[ch]||0)+1; }
        if (window.sound) window.sound.wrong();
        bubbles.splice(index, 1); updateUI();
        if (lives <= 0) gameOver();
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
        if (powerUps[type] <= 0 || !gameRunning) return;
        powerUps[type]--; updatePowerUpUI();
        if (type === 'freeze') { freezeActive=true; freezeTimer=180; if (window.sound) window.sound.correct(); }
        else if (type === 'bomb') {
            if (window.sound) window.sound.celebration();
            canvasContainer.classList.add('screen-shake');
            setTimeout(() => canvasContainer.classList.remove('screen-shake'), 400);
            while (bubbles.length > 0) {
                const b = bubbles[0];
                for (let i=0;i<6;i++) {const a=Math.random()*Math.PI*2;particles.push({x:b.x,y:b.y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5,radius:1.5+Math.random()*2.5,color:b.color.stroke,life:1,decay:0.025,gravity:0.04});}
                score += b.word.length * 5; totalPops++; bubbles.splice(0,1);
            }
            updateUI();
        }
    };

    function drawBackground() {
        const grad = ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0,'#1A2744');grad.addColorStop(0.4,'#1E3A5F');grad.addColorStop(0.8,'#2A5070');grad.addColorStop(1,'#2A6A70');
        ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
        if (freezeActive) { ctx.fillStyle='rgba(180,220,240,0.10)'; ctx.fillRect(0,0,W,H); }
        ctx.save(); ctx.globalAlpha=0.03;
        for (let i=0;i<4;i++) {const x=100+i*160;const grad2=ctx.createLinearGradient(x,0,x,H);grad2.addColorStop(0,'#ffffff');grad2.addColorStop(1,'transparent');ctx.fillStyle=grad2;ctx.beginPath();ctx.moveTo(x-25,0);ctx.lineTo(x+25,0);ctx.lineTo(x+50+Math.sin(Date.now()/2000+i)*15,H);ctx.lineTo(x-50+Math.sin(Date.now()/2000+i)*15,H);ctx.fill();}
        ctx.restore();
        ctx.save(); ctx.globalAlpha=0.1;
        for (const bb of bgBubbles) {bb.y-=bb.speed;bb.x+=Math.sin(Date.now()/3000+bb.wobble)*0.15;if(bb.y<-10){bb.y=H+10;bb.x=Math.random()*W;}ctx.beginPath();ctx.arc(bb.x,bb.y,bb.r,0,Math.PI*2);ctx.fillStyle='#88BBDD';ctx.fill();}
        ctx.restore();
        ctx.save();ctx.globalAlpha=0.2;ctx.fillStyle='#1A3A50';ctx.beginPath();ctx.moveTo(0,H);
        for(let x=0;x<=W;x+=40){ctx.lineTo(x,H-12-Math.sin(x/60+Date.now()/5000)*6);}
        ctx.lineTo(W,H);ctx.fill();ctx.restore();
        if (!isFreePlay && gameRunning && !levelPassed) {
            const progress = Math.min(levelTimer/LEVEL_PASS_TIME,1);
            ctx.save();ctx.globalAlpha=0.5;ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(20,10,W-40,6);
            ctx.fillStyle=progress>=1?'#68D391':'#4A90D9';ctx.fillRect(20,10,(W-40)*progress,6);ctx.restore();
        }
    }

    function drawBubble(b) {
        ctx.save();const s=Math.min(1,b.scale);b.scale+=0.04;ctx.translate(b.x,b.y);ctx.scale(s,s);const r=b.radius;
        ctx.shadowColor=b.color.stroke;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=b.color.fill;ctx.fill();ctx.strokeStyle=b.color.stroke;ctx.lineWidth=1.5;ctx.stroke();ctx.shadowBlur=0;
        ctx.beginPath();ctx.arc(-r*0.25,-r*0.3,r*0.2,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fill();
        const fontSize=b.word.length===1?r*0.85:Math.min(r*0.55,20);
        ctx.font=`bold ${fontSize}px Fredoka, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=3;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;ctx.fillStyle=b.color.text;
        if(b.word.length>10){const words=b.word.split(' ');if(words.length>1){const lineH=fontSize+2;const startY=-(words.length-1)*lineH/2;words.forEach((w,i)=>ctx.fillText(w,0,startY+i*lineH));}else{ctx.fillText(b.word,0,2);}}else{ctx.fillText(b.word,0,2);}
        if(b.powerUp){ctx.font=`${r*0.35}px sans-serif`;ctx.fillText(b.powerUp==='freeze'?'❄️':'💣',0,-r*0.5);}
        if(b.y<50){ctx.globalAlpha=0.4+Math.sin(Date.now()/100)*0.4;ctx.strokeStyle='#E07070';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r+4,0,Math.PI*2);ctx.stroke();}
        ctx.restore();
    }

    function drawParticles() {
        for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=p.gravity;p.life-=p.decay;if(p.life<=0){particles.splice(i,1);continue;}ctx.save();ctx.globalAlpha=p.life;ctx.beginPath();ctx.arc(p.x,p.y,p.radius*p.life,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.restore();}
    }

    function drawFloatingTexts() {
        for(let i=floatingTexts.length-1;i>=0;i--){const ft=floatingTexts[i];ft.y+=ft.vy;ft.life-=0.015;if(ft.life<=0){floatingTexts.splice(i,1);continue;}ctx.save();ctx.globalAlpha=Math.min(1,ft.life*2);ctx.font=`bold ${ft.size}px Fredoka, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillText(ft.text,ft.x+1,ft.y+1);ctx.fillStyle=ft.color;ctx.fillText(ft.text,ft.x,ft.y);ctx.restore();}
    }

    function gameLoop(timestamp) {
        if (!gameRunning) return;
        ctx.clearRect(0,0,W,H); drawBackground();
        if (freezeActive) { freezeTimer--; if (freezeTimer<=0) freezeActive=false; }
        const params = getLevelParams();
        const effectiveSpawnInterval = params.spawnInterval / speedMultiplier;
        if (timestamp - lastBubbleTime > effectiveSpawnInterval) { spawnBubble(); lastBubbleTime = timestamp; }
        for (let i=bubbles.length-1;i>=0;i--) {
            const b=bubbles[i]; const speedMult=freezeActive?0.15:1;
            b.y -= b.speed*speedMult; b.x += Math.sin(Date.now()/1000+b.wobbleOffset)*b.wobbleAmp*0.25;
            b.x = Math.max(b.radius, Math.min(W-b.radius, b.x));
            if (b.y+b.radius < -10) { missedBubble(i); continue; }
            drawBubble(b);
        }
        drawParticles(); drawFloatingTexts();
        frameId = requestAnimationFrame(gameLoop);
    }

    gameInput.addEventListener('input', () => {
        if (!gameRunning) return;
        const typed = gameInput.value.toLowerCase().trim();
        if (!typed) return;
        let matchIndex = -1, bestY = -Infinity;
        for (let i=0;i<bubbles.length;i++) { if (bubbles[i].word===typed && bubbles[i].y>bestY) { matchIndex=i; bestY=bubbles[i].y; } }
        if (matchIndex >= 0) { popBubble(matchIndex); gameInput.value=''; }
        else {
            const isPartial = bubbles.some(b => b.word.startsWith(typed));
            if (!isPartial && typed.length === 1) {
                const anyMatch = bubbles.some(b => b.word.includes(typed));
                if (!anyMatch) {
                    combo=0; errorKeys[typed]=(errorKeys[typed]||0)+1; weakKeys[typed]=(weakKeys[typed]||0)+1; totalMisses++;
                    gameInput.classList.add('shake'); setTimeout(()=>gameInput.classList.remove('shake'),300);
                    if (window.sound) window.sound.wrong(); updateUI();
                }
                gameInput.value='';
            }
        }
    });

    gameInput.addEventListener('keydown', (e) => {
        if (!gameRunning) return;
        if (e.key==='Escape') gameInput.value='';
        if (e.key==='1') { window.usePowerUp('freeze'); e.preventDefault(); }
        if (e.key==='2') { window.usePowerUp('bomb'); e.preventDefault(); }
    });

    window.startGame = function() {
        score=0;lives=3;combo=0;maxCombo=0;bubbles=[];particles=[];floatingTexts=[];
        totalPops=0;totalMisses=0;errorKeys={};
        powerUps={freeze:1,bomb:0};freezeActive=false;freezeTimer=0;
        levelTimer=0;levelPassed=false;freePlayLevel=1;
        startTime=Date.now();lastBubbleTime=0;gameRunning=true;
        speedMultiplier=parseFloat(speedSlider.value);
        loadWeakKeys();
        startOverlay.classList.add('hidden');gameOverOverlay.classList.add('hidden');levelCompleteOverlay.classList.add('hidden');
        updateUI();updateTimerDisplay();updatePowerUpUI();
        gameInput.value='';gameInput.focus();
        if(levelTimerInterval) clearInterval(levelTimerInterval);
        levelTimerInterval = setInterval(()=>{
            if(!gameRunning) return; levelTimer++; updateTimerDisplay();
            if(!isFreePlay && !levelPassed && levelTimer >= LEVEL_PASS_TIME) { levelPassed=true; onLevelPassed(); }
        }, 1000);
        if(frameId) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(gameLoop);
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
        gameRunning = false;
        if(frameId) cancelAnimationFrame(frameId);
        if(levelTimerInterval) clearInterval(levelTimerInterval);
        levelCompleteOverlay.classList.remove('hidden');
        if (window.sound) window.sound.celebration();
        spawnConfetti(60);
        const duration = Math.round((Date.now()-startTime)/1000);
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
        gameRunning = false;
        if(frameId) cancelAnimationFrame(frameId);
        if(levelTimerInterval) clearInterval(levelTimerInterval);
        const duration = Math.round((Date.now()-startTime)/1000);
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

    drawBackground();
    loadProgress();
    document.addEventListener('click', () => { if (gameRunning) gameInput.focus(); });
})();
