/**
 * Article Typing Mode — TypePets
 * Character-by-character inline typing with typewriter sounds.
 * Extras: race your ghost (your best pace), read-aloud of the next word,
 * classroom links (?article=ID&min=M), touch keyboards.
 * All data via TypePetsData (localStorage).
 */

(function() {
    'use strict';

    const articles = ARTICLES; // from articles-data.js
    const IDLE_LIMIT_MS = 30000; // a pause longer than this doesn't count as practice time

    let currentArticle = null;
    let currentCategory = 'all';
    let completedArticles = TypePetsData.getCompletedArticles();

    let chars = [];
    let charEls = [];
    let charIndex = 0;
    let errorCount = 0;
    let correctCount = 0;
    let totalKeystrokes = 0;
    let errorKeys = {};
    let finished = false;
    let hasError = false;
    let previousBest = null;
    const clock = new ActiveClock({ idleMs: IDLE_LIMIT_MS });

    let wpmHistory = [];
    let wpmUpdateInterval = null;
    let fastInterval = null;

    let typewriterEnabled = true;
    let audioCtx = null;

    let ghost = null;          // { wpm, cps, idx }
    let ghostEnabled = true;
    let classMode = null;      // { minutes, clock, keys, correct, errors, activeSeconds, ended, lastArticleId }
    let touchCtl = null;
    let touchUsed = false;

    const articleGrid = document.getElementById('articleGrid');
    const listView = document.getElementById('articleListView');
    const typingView = document.getElementById('typingView');
    const textDisplay = document.getElementById('articleTextDisplay');
    const typingArea = document.getElementById('articleTypingArea');
    const touchInput = document.getElementById('touchInput');

    function $(id) { return document.getElementById(id); }

    // ─── Typewriter sounds ────────────────────────────────────

    function ensureAudioCtx() {
        if (!audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return null;
            try { audioCtx = new AudioCtx(); } catch (e) { return null; }
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function playClack(type) {
        // Respect both this page's typewriter switch and the site-wide mute
        if (!typewriterEnabled || (window.sound && window.sound.enabled === false)) return;
        const ctx = ensureAudioCtx();
        if (!ctx) return;
        const t = ctx.currentTime;

        if (type === 'ding') {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type='sine'; osc.frequency.setValueAtTime(2200,t); osc.frequency.exponentialRampToValueAtTime(1800,t+0.15);
            gain.gain.setValueAtTime(0.12,t); gain.gain.exponentialRampToValueAtTime(0.001,t+0.3);
            osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t+0.3);
            return;
        }

        let freq, q, noiseVol, noiseDur, oscFreq, oscVol;
        const pitchRand = (Math.random()-0.5)*100;
        switch (type) {
            case 'correct': freq=800+pitchRand;q=3;noiseVol=0.08;noiseDur=0.025;oscFreq=1100+pitchRand;oscVol=0.03;break;
            case 'wrong': freq=400+pitchRand*0.5;q=2;noiseVol=0.12;noiseDur=0.04;oscFreq=300+pitchRand*0.5;oscVol=0.06;break;
            case 'space': freq=600+pitchRand;q=1.5;noiseVol=0.10;noiseDur=0.035;oscFreq=500+pitchRand;oscVol=0.04;break;
            default: freq=800+pitchRand;q=3;noiseVol=0.08;noiseDur=0.025;oscFreq=1100+pitchRand;oscVol=0.03;
        }

        const bufferSize = Math.floor(ctx.sampleRate*noiseDur);
        const buffer = ctx.createBuffer(1,bufferSize,ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1)*Math.exp(-i/(bufferSize*0.15));
        const noise = ctx.createBufferSource(); noise.buffer = buffer;
        const filter = ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.setValueAtTime(freq,t); filter.Q.setValueAtTime(q,t);
        const nGain = ctx.createGain(); nGain.gain.setValueAtTime(noiseVol,t); nGain.gain.exponentialRampToValueAtTime(0.001,t+noiseDur+0.01);
        noise.connect(filter); filter.connect(nGain); nGain.connect(ctx.destination); noise.start(t); noise.stop(t+noiseDur+0.015);

        const osc = ctx.createOscillator(); const oscGain = ctx.createGain();
        osc.type='sine'; osc.frequency.setValueAtTime(oscFreq,t); osc.frequency.exponentialRampToValueAtTime(oscFreq*0.5,t+0.02);
        oscGain.gain.setValueAtTime(oscVol,t); oscGain.gain.exponentialRampToValueAtTime(0.001,t+0.025);
        osc.connect(oscGain); oscGain.connect(ctx.destination); osc.start(t); osc.stop(t+0.03);
    }

    window.toggleTypewriterSound = function() {
        typewriterEnabled = !typewriterEnabled;
        const btn = $('typewriterSoundBtn');
        btn.textContent = typewriterEnabled ? '🔊' : '🔇';
        btn.blur();
    };

    // ─── Read-aloud (next word) ───────────────────────────────

    function speechOn() {
        return !!(window.speech && window.speech.supported && window.speech.isOn(false));
    }

    function updateSpeechButton() {
        const btn = $('speechBtn');
        if (!window.speech || !window.speech.supported) { btn.classList.add('hidden'); return; }
        const on = speechOn();
        btn.classList.remove('hidden');
        btn.classList.toggle('off', !on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.title = on ? 'Reading the next word out loud (click to stop)' : 'Read the next word out loud';
    }

    window.toggleArticleSpeech = function(btn) {
        if (btn && btn.blur) btn.blur();
        if (!window.speech || !window.speech.supported) return;
        const on = !speechOn();
        window.speech.setOn(on);
        updateSpeechButton();
        if (on) {
            if (window.sound && window.sound.enabled === false) showToast('🔇 Sound is off. Turn it on (🔊) to hear the words.', 'info');
            else speakWordAt(wordStart(charIndex));
        }
        focusTyping();
    };

    function wordStart(idx) {
        let i = Math.min(idx, chars.length);
        while (i > 0 && chars[i - 1] !== ' ' && chars[i - 1] !== '\n') i--;
        return i;
    }

    function speakWordAt(start) {
        if (!speechOn() || start >= chars.length) return;
        let end = start;
        while (end < chars.length && chars[end] !== ' ' && chars[end] !== '\n') end++;
        const word = chars.slice(start, end).join('');
        if (word) window.speech.say(word);
    }

    // Say each word as the cursor reaches its first letter
    function maybeSpeakNextWord() {
        if (charIndex >= chars.length) return;
        const prev = chars[charIndex - 1];
        if (charIndex === 0 || prev === ' ' || prev === '\n') speakWordAt(charIndex);
    }

    // ─── Article list ─────────────────────────────────────────

    function renderArticleGrid() {
        completedArticles = TypePetsData.getCompletedArticles();
        const filtered = currentCategory === 'all' ? articles : articles.filter(a => a.category === currentCategory);
        if (filtered.length === 0) {
            articleGrid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">No articles in this category.</p>';
            return;
        }
        articleGrid.innerHTML = filtered.map(a => {
            const isCompleted = completedArticles.includes(a.id);
            const best = TypePetsData.getArticleBest(a.id);
            const preview = a.content.substring(0,100)+(a.content.length>100?'...':'');
            const bestTag = best && best.best_wpm > 0 ? `<span class="article-best-mark">👻 best ${best.best_wpm} WPM</span>` : '';
            return `
                <div class="article-card" onclick="openArticle(${a.id})">
                    <div class="article-card-title">${a.title}</div>
                    <div class="article-card-meta">
                        <span class="article-meta-tag category">${a.category.replace('-', ' ')}</span>
                        <span class="article-meta-tag difficulty-${a.difficulty}">${a.difficulty}</span>
                    </div>
                    <div class="article-card-preview">${preview}</div>
                    <div class="article-card-footer">
                        <span>${a.word_count} words</span>
                        <span class="article-card-marks">${bestTag}${isCompleted ? '<span class="article-completed-mark">✓ done</span>' : ''}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.filterCategory = function(cat) {
        currentCategory = cat;
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.category === cat));
        renderArticleGrid();
    };

    // ─── Typing view ──────────────────────────────────────────

    window.openArticle = function(id) {
        currentArticle = articles.find(a => a.id === id);
        if (!currentArticle) return;

        previousBest = TypePetsData.getArticleBest(id);

        listView.style.display = 'none';
        typingView.style.display = 'block';

        $('typingTitle').textContent = currentArticle.title;
        $('typingCategory').textContent = currentArticle.category.replace('-', ' ');
        $('typingWordCount').textContent = currentArticle.word_count + ' words';

        chars = currentArticle.content.split('');
        charIndex = 0; errorCount = 0; correctCount = 0; totalKeystrokes = 0; errorKeys = {};
        finished = false; hasError = false; wpmHistory = [];
        clock.reset();

        $('typingResult').classList.add('hidden');
        $('typingWpm').textContent = '0';
        $('typingAccuracy').textContent = '100';
        $('typingTime').textContent = '0:00';
        $('capsBanner').classList.add('hidden');
        $('imeBanner').classList.add('hidden');
        clearSparkline();
        renderCharacters();
        setupGhost();
        updateSpeechButton();
        focusTyping();
        window.scrollTo(0, 0);

        if (wpmUpdateInterval) clearInterval(wpmUpdateInterval);
        wpmUpdateInterval = setInterval(updateLiveStats, 2000);
        if (fastInterval) clearInterval(fastInterval);
        fastInterval = setInterval(tickGhost, 100);
        maybeSpeakNextWord();
    };

    function escapeChar(ch) {
        if (ch === '<') return '&lt;';
        if (ch === '>') return '&gt;';
        if (ch === '&') return '&amp;';
        if (ch === '"') return '&quot;';
        return ch;
    }

    function displayFor(ch) {
        if (ch === '\n') return '↵<br>';
        return escapeChar(ch);
    }

    function renderCharacters() {
        let html = '';
        for (let i = 0; i < chars.length; i++) {
            const cls = i === 0 ? 'char-current' : 'char-upcoming';
            html += `<span class="${cls}" data-idx="${i}">${displayFor(chars[i])}</span>`;
        }
        textDisplay.innerHTML = html;
        textDisplay.scrollTop = 0;
        charEls = Array.from(textDisplay.querySelectorAll('span[data-idx]'));
    }

    function updateCharClass(idx, cls, wrongChar) {
        const el = charEls[idx];
        if (!el) return;
        const ghostHere = !!(ghost && ghostEnabled && ghost.idx === idx);
        el.className = cls + (ghostHere ? ' char-ghost' : '');
        const display = displayFor(chars[idx]);
        if (cls === 'char-error' && wrongChar) {
            let wrongDisplay = escapeChar(wrongChar);
            if (wrongChar === ' ') wrongDisplay = '␣';
            else if (wrongChar === '\n') wrongDisplay = '↵';
            el.innerHTML = `${display}<span class="error-char">${wrongDisplay}</span>`;
        } else { el.innerHTML = display; }
    }

    // ─── Keyboard + touch input ───────────────────────────────

    function isSummaryOpen() {
        return $('classSummaryOverlay').classList.contains('active');
    }

    function updateCapsBanner(e) {
        if (!e || typeof e.getModifierState !== 'function') return;
        $('capsBanner').classList.toggle('hidden', !TypingUtils.isCapsLockOn(e));
    }

    function handleKeydown(e) {
        updateCapsBanner(e);
        if (finished || !currentArticle || isSummaryOpen()) return;
        const fromTouch = e.target === touchInput;
        const k = TypingUtils.classifyKey(e);
        switch (k.kind) {
            case 'ime':
                // Phone keyboards send these too — their letters arrive through the hidden input instead
                if (!fromTouch) $('imeBanner').classList.remove('hidden');
                return;
            case 'shortcut':
            case 'capslock':
                return;
            case 'ignore':
                if (e.key === 'Backspace') e.preventDefault();
                return;
            case 'repeat':
                e.preventDefault(); // held keys don't count
                return;
            case 'capslock-letter':
                e.preventDefault();
                $('capsBanner').classList.remove('hidden');
                return;
        }
        e.preventDefault();
        $('imeBanner').classList.add('hidden');
        // Enter only counts where the text really has a line break
        if (k.kind === 'enter' && chars[charIndex] !== '\n') return;
        if (touchCtl) touchCtl.noteHandled(k.char);
        typeChar(k.char);
    }

    typingArea.addEventListener('keydown', handleKeydown);
    typingArea.addEventListener('keyup', updateCapsBanner);
    textDisplay.addEventListener('paste', (e) => e.preventDefault());

    // Nothing focused (e.g. after clicking the page background)? Send keys to the article anyway.
    document.addEventListener('keydown', (e) => {
        if (typingView.style.display === 'none' || finished || e.defaultPrevented) return;
        const active = document.activeElement;
        if (active && active !== document.body && active !== document.documentElement) return;
        textDisplay.focus();
        handleKeydown(e);
    });

    touchCtl = TypingUtils.attachTouchInput(touchInput, {
        onChar: (ch) => {
            if (finished || !currentArticle || isSummaryOpen()) return;
            if (ch === '\n' && chars[charIndex] !== '\n') return;
            typeChar(ch);
        },
        tapTargets: [typingArea],
        onFocusChange: (focused) => {
            if (focused) touchUsed = true;
            $('tapHint').classList.toggle('hidden', focused || !TypingUtils.prefersTouch());
        },
    });
    $('tapHint').classList.toggle('hidden', !TypingUtils.prefersTouch());

    // Phones/tablets: focus the hidden input (opens the on-screen keyboard) — but only inside a
    // tap/click, otherwise the input looks focused while no keyboard shows up.
    function focusTyping() {
        const touchFirst = touchUsed || TypingUtils.prefersTouch();
        if (!touchFirst) { textDisplay.focus({ preventScroll: true }); return; }
        let gesture = true;
        try { if (navigator.userActivation) gesture = navigator.userActivation.isActive; } catch (e) { /* ignore */ }
        if (gesture) touchCtl.focus();
    }

    function typeChar(typed) {
        if (finished || charIndex >= chars.length) return;
        clock.tick();
        if (classMode && !classMode.ended) classMode.clock.tick();
        totalKeystrokes++;
        const expected = chars[charIndex];
        if (typed === expected) {
            correctCount++;
            updateCharClass(charIndex, 'char-correct', null);
            hasError = false;
            if (expected === ' ') playClack('space');
            else if (['\n','.','!','?'].includes(expected)) playClack('ding');
            else playClack('correct');
            charIndex++;
            if (charIndex < chars.length) {
                updateCharClass(charIndex, 'char-current', null);
                scrollToCurrentChar();
                maybeSpeakNextWord();
            }
            if (charIndex >= chars.length) finishArticle();
        } else {
            errorCount++; hasError = true;
            // Remember the key the kid was aiming for — that's the one to practice
            const missed = expected === '\n' ? 'enter' : expected.toLowerCase();
            errorKeys[missed] = (errorKeys[missed] || 0) + 1;
            updateCharClass(charIndex, 'char-error', typed);
            playClack('wrong');
        }
    }

    function scrollToCurrentChar() {
        const el = charEls[charIndex];
        if (!el) return;
        const containerRect = textDisplay.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const relativeTop = elRect.top - containerRect.top;
        if (relativeTop > containerRect.height * 0.7 || relativeTop < 0) {
            textDisplay.scrollTop += relativeTop - containerRect.height * 0.3;
        }
    }

    // ─── Ghost: race your past self ───────────────────────────

    function setupGhost() {
        ghost = null;
        const best = previousBest && previousBest.attempts > 0 ? previousBest.best_wpm : 0;
        if (best > 0) {
            // best_wpm = (chars / 5) per minute → characters per second
            ghost = { wpm: best, cps: (best * 5) / 60, idx: -1 };
            $('ghostBar').classList.remove('hidden');
            $('ghostToggle').textContent = ghostEnabled ? 'Hide ghost' : 'Show ghost';
            $('ghostStatus').textContent = `Your best: ${best} WPM. Start typing to race!`;
        } else {
            $('ghostBar').classList.add('hidden');
        }
    }

    function moveGhostMark(newIdx) {
        const old = charEls[ghost.idx];
        if (old) old.classList.remove('char-ghost');
        ghost.idx = newIdx;
        const el = charEls[newIdx];
        if (el && ghostEnabled) el.classList.add('char-ghost');
    }

    function tickGhost() {
        if (!ghost || finished || !clock.started) return;
        const idx = Math.min(chars.length, Math.floor(clock.seconds() * ghost.cps));
        if (idx !== ghost.idx) moveGhostMark(idx);
        const lead = charIndex - idx;
        const status = $('ghostStatus');
        if (idx >= chars.length) status.textContent = 'Your ghost finished — keep going, you can still do it!';
        else if (lead > 0) status.textContent = `You're ${lead} letter${lead === 1 ? '' : 's'} ahead!`;
        else if (lead < 0) status.textContent = `Your ghost is ${-lead} letter${lead === -1 ? '' : 's'} ahead.`;
        else status.textContent = 'Neck and neck!';
    }

    window.toggleGhost = function(btn) {
        ghostEnabled = !ghostEnabled;
        if (btn) { btn.textContent = ghostEnabled ? 'Hide ghost' : 'Show ghost'; btn.blur(); }
        if (ghost) {
            const el = charEls[ghost.idx];
            if (el) el.classList.toggle('char-ghost', ghostEnabled);
        }
        $('ghostStatus').classList.toggle('hidden', !ghostEnabled);
        focusTyping();
    };

    function ghostResultText(mySeconds) {
        if (!ghost) return '';
        const ghostSeconds = chars.length / ghost.cps;
        const diff = Math.round(ghostSeconds - mySeconds);
        if (diff >= 1) return `👻 Beat your ghost by ${diff}s!`;
        if (diff <= -1) return `👻 Your ghost won by ${-diff}s. Race it again!`;
        return '👻 Photo finish with your ghost!';
    }

    // ─── Live stats ───────────────────────────────────────────

    function updateLiveStats() {
        if (!clock.started || finished) return;
        const elapsed = clock.seconds();
        const wpm = elapsed >= 3 ? TypingUtils.calcWpm(correctCount, elapsed) : 0;
        const accuracy = TypingUtils.calcAccuracy(correctCount, correctCount + errorCount);
        $('typingWpm').textContent = wpm;
        $('typingAccuracy').textContent = accuracy;
        $('typingTime').textContent = TypingUtils.formatTime(elapsed);
        wpmHistory.push({time:elapsed, wpm});
        const cutoff = elapsed-30;
        wpmHistory = wpmHistory.filter(p => p.time >= cutoff);
        drawSparkline();
    }

    function drawSparkline() {
        const svg = $('wpmSparkline');
        if (!svg || wpmHistory.length < 2) return;
        const w=100,h=28,padding=2;
        const values = wpmHistory.map(p => p.wpm);
        const maxVal = Math.max(...values,10), minVal = Math.min(...values,0);
        const range = maxVal-minVal||1;
        const points = values.map((v,i) => {
            const x = padding+(i/(values.length-1))*(w-padding*2);
            const y = h-padding-((v-minVal)/range)*(h-padding*2);
            return `${x},${y}`;
        });
        svg.innerHTML = `<polyline points="${points.join(' ')}" fill="none" stroke="#4A90D9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${points[points.length-1].split(',')[0]}" cy="${points[points.length-1].split(',')[1]}" r="2.5" fill="#4A90D9"/>`;
    }

    function clearSparkline() {
        const svg = $('wpmSparkline');
        if (svg) svg.innerHTML = '';
    }

    function stopTimers() {
        if (wpmUpdateInterval) { clearInterval(wpmUpdateInterval); wpmUpdateInterval = null; }
        if (fastInterval) { clearInterval(fastInterval); fastInterval = null; }
    }

    function showResultLine(id, text) {
        const el = $(id);
        el.textContent = text || '';
        el.classList.toggle('hidden', !text);
    }

    function finishArticle() {
        finished = true;
        const elapsed = clock.seconds();
        clock.stop();
        stopTimers();
        if (ghost) moveGhostMark(-1);
        const wpm = TypingUtils.calcWpm(correctCount, elapsed);
        const accuracy = TypingUtils.calcAccuracy(correctCount, correctCount + errorCount);
        const timeText = TypingUtils.formatTime(elapsed);
        $('typingWpm').textContent = wpm;
        $('typingAccuracy').textContent = accuracy;
        $('typingTime').textContent = timeText;
        $('resultWpm').textContent = wpm;
        $('resultAccuracy').textContent = accuracy+'%';
        $('resultTime').textContent = timeText;

        const resultPbBadge = $('resultPbBadge');
        const resultWpmPrev = $('resultWpmPrev');
        if (previousBest && previousBest.attempts > 0) {
            const diff = wpm - previousBest.best_wpm;
            if (diff > 0) { resultWpmPrev.textContent = `↑ +${Math.round(diff)} from best`; resultWpmPrev.className = 'result-stat-prev improved'; }
            else if (diff < 0) { resultWpmPrev.textContent = `↓ ${Math.round(diff)} from best`; resultWpmPrev.className = 'result-stat-prev declined'; }
            else { resultWpmPrev.textContent = 'Matched your best!'; resultWpmPrev.className = 'result-stat-prev'; }
            if (wpm > previousBest.best_wpm) { resultPbBadge.classList.remove('hidden'); $('resultTitle').textContent = 'New Personal Best!'; }
            else { resultPbBadge.classList.add('hidden'); $('resultTitle').textContent = 'Complete!'; }
        } else {
            resultWpmPrev.textContent = 'First attempt!'; resultWpmPrev.className = 'result-stat-prev';
            resultPbBadge.classList.add('hidden'); $('resultTitle').textContent = 'Complete!';
        }
        showResultLine('ghostResult', ghostEnabled ? ghostResultText(elapsed) : '');

        TypePetsData.markArticleCompleted(currentArticle.id);
        TypePetsData.updateArticleBest(currentArticle.id, wpm, accuracy, Math.round(elapsed));

        const sessionData = {
            mode: 'article', level: currentArticle.id, wpm, accuracy,
            duration_seconds: Math.round(elapsed), keys_pressed: totalKeystrokes,
            errors: errorCount, error_keys: errorKeys, chars_correct: correctCount,
            inline_rewards: true
        };
        const result = TypePetsData.saveSession(sessionData) || {};
        checkAchievements(sessionData);

        const xp = typeof result.xp_earned === 'number' ? result.xp_earned : 0;
        const food = typeof result.food_earned === 'number' ? result.food_earned : 0;
        showResultLine('resultReward', xp > 0 ? `+${xp} XP for your pet!` + (food > 0 ? ` 🍎 +${food} food` : '') : '');
        const goal = result.daily_goal;
        let goalText = '';
        if (goal && typeof goal.goal_minutes === 'number' && goal.goal_minutes > 0) {
            const mins = Math.min(Math.floor(goal.minutes_today || 0), goal.goal_minutes);
            goalText = goal.just_completed ? '🎯 Daily goal complete! Awesome!' : `🎯 Daily goal: ${mins} of ${goal.goal_minutes} minutes`;
        }
        showResultLine('resultGoal', goalText);

        const certLink = $('certLink');
        certLink.href = `report.html?cert=article&id=${currentArticle.id}`;
        certLink.classList.remove('hidden');

        if (classMode && !classMode.ended) {
            classMode.keys += totalKeystrokes;
            classMode.correct += correctCount;
            classMode.errors += errorCount;
            classMode.activeSeconds += elapsed;
            classMode.lastArticleId = currentArticle.id;
            showResultLine('resultClass', '⏱ Class time is still running. Try it again or pick another article!');
        } else {
            showResultLine('resultClass', '');
        }

        $('typingResult').classList.remove('hidden');
        $('typingResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (window.speech && speechOn()) window.speech.say('Great job!');
        if (window.sound) window.sound.levelUp();
        if (window.maybeDonatePrompt) window.maybeDonatePrompt();
    }

    window.backToList = function() {
        typingView.style.display = 'none'; listView.style.display = 'block';
        stopTimers();
        if (window.speech) window.speech.cancel();
        if (touchCtl && touchCtl.isFocused()) touchInput.blur();
        renderArticleGrid();
    };

    window.retryArticle = function() {
        if (currentArticle) openArticle(currentArticle.id);
    };

    // ─── Classroom links: articles.html?article=ID&min=M ──────

    function classTotals() {
        const cm = classMode;
        const inProgress = currentArticle && !finished && clock.started && typingView.style.display !== 'none';
        const keys = cm.keys + (inProgress ? totalKeystrokes : 0);
        const correct = cm.correct + (inProgress ? correctCount : 0);
        const errors = cm.errors + (inProgress ? errorCount : 0);
        const active = cm.activeSeconds + (inProgress ? clock.seconds() : 0);
        return {
            keys,
            wpm: TypingUtils.calcWpm(correct, active),
            accuracy: TypingUtils.calcAccuracy(correct, correct + errors),
        };
    }

    function updateClassTimer() {
        const el = $('classTimer');
        if (!classMode) { el.classList.add('hidden'); return; }
        el.classList.remove('hidden');
        if (classMode.ended) {
            el.textContent = '✅ Class time done';
            el.classList.remove('urgent');
            return;
        }
        const total = classMode.minutes * 60;
        if (!classMode.clock.started) {
            el.textContent = `⏱ ${TypingUtils.formatTime(total)} · starts when you type`;
            return;
        }
        const left = Math.max(0, total - classMode.clock.seconds());
        el.textContent = `⏱ ${TypingUtils.formatTime(Math.ceil(left))} left`;
        el.classList.toggle('urgent', left <= 30);
        if (left <= 0) endClassSession();
    }

    function endClassSession() {
        if (!classMode || classMode.ended) return;
        const totals = classTotals();
        classMode.ended = true;
        classMode.clock.stop();
        clock.hold();
        updateClassTimer();

        const article = currentArticle || articles.find(a => a.id === classMode.lastArticleId);
        $('classSummarySub').textContent = article ? article.title : '';
        $('classKeys').textContent = totals.keys;
        $('classWpm').textContent = totals.wpm;
        $('classAccuracy').textContent = totals.accuracy + '%';
        $('classTime').textContent = TypingUtils.formatTime(classMode.minutes * 60);

        const certId = article && TypePetsData.getCompletedArticles().includes(article.id) ? article.id : classMode.lastArticleId;
        const cert = $('classCertLink');
        if (certId) cert.href = `report.html?cert=article&id=${certId}`;
        cert.classList.toggle('hidden', !certId);
        $('classCertNote').classList.toggle('hidden', !!certId);

        $('classSummaryOverlay').classList.add('active');
        if (touchCtl && touchCtl.isFocused()) touchInput.blur();
        if (window.sound) window.sound.celebration();
        if (window.speech && speechOn()) window.speech.say("Time's up! Great practice!");
    }

    window.keepPracticing = function() {
        $('classSummaryOverlay').classList.remove('active');
        clock.release();
        if (typingView.style.display !== 'none' && !finished) focusTyping();
    };

    function applyClassLink() {
        const params = TypingUtils.parseClassParams(window.location.search, {
            idParam: 'article',
            isValidId: n => articles.some(a => a.id === n),
        });
        if (params.invalid.length) {
            showToast('🤔 Part of that class link didn’t work, so we skipped it.', 'error', 4000);
        }
        if (params.minutes !== null) {
            classMode = {
                minutes: params.minutes,
                clock: new ActiveClock(),
                keys: 0, correct: 0, errors: 0, activeSeconds: 0,
                ended: false, lastArticleId: null,
            };
            setInterval(updateClassTimer, 250);
        }
        if (params.id !== null) openArticle(params.id);
        if (params.id === null && params.minutes === null) return;

        const article = params.id !== null ? articles.find(a => a.id === params.id) : null;
        const mins = classMode ? `${classMode.minutes} minute${classMode.minutes === 1 ? '' : 's'}` : '';
        let text;
        if (article && classMode) text = `🎓 Class practice: "${article.title}" for ${mins}. The timer starts when you type!`;
        else if (article) text = `🎓 Your teacher picked "${article.title}".`;
        else text = `🎓 Class practice for ${mins}. Pick an article. The timer starts when you type!`;
        $('classBannerText').textContent = text;
        $('classBanner').classList.remove('hidden');
        updateClassTimer();
    }

    renderArticleGrid();
    updateSpeechButton();
    applyClassLink();
})();
