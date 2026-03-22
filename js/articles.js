/**
 * Article Typing Mode — TypePets
 * Character-by-character inline typing with typewriter sounds.
 * All data via TypePetsData (localStorage).
 */

(function() {
    'use strict';

    let articles = ARTICLES; // from articles-data.js
    let currentArticle = null;
    let currentCategory = 'all';
    let completedArticles = TypePetsData.getCompletedArticles();

    let chars = [];
    let charIndex = 0;
    let errorCount = 0;
    let correctCount = 0;
    let totalKeystrokes = 0;
    let startTime = null;
    let finished = false;
    let hasError = false;
    let previousBest = null;

    let wpmHistory = [];
    let wpmUpdateInterval = null;

    let typewriterEnabled = true;
    let audioCtx = null;

    const articleGrid = document.getElementById('articleGrid');
    const listView = document.getElementById('articleListView');
    const typingView = document.getElementById('typingView');
    const textDisplay = document.getElementById('articleTextDisplay');

    function ensureAudioCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function playClack(type) {
        if (!typewriterEnabled) return;
        const ctx = ensureAudioCtx();
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
        document.getElementById('typewriterSoundBtn').textContent = typewriterEnabled ? '🔊' : '🔇';
    };

    function renderArticleGrid() {
        completedArticles = TypePetsData.getCompletedArticles();
        const filtered = currentCategory === 'all' ? articles : articles.filter(a => a.category === currentCategory);
        if (filtered.length === 0) {
            articleGrid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">No articles in this category.</p>';
            return;
        }
        articleGrid.innerHTML = filtered.map(a => {
            const isCompleted = completedArticles.includes(a.id);
            const preview = a.content.substring(0,100)+(a.content.length>100?'...':'');
            return `
                <div class="article-card" onclick="openArticle(${a.id})">
                    <div class="article-card-title">${a.title}</div>
                    <div class="article-card-meta">
                        <span class="article-meta-tag category">${a.category}</span>
                        <span class="article-meta-tag difficulty-${a.difficulty}">${a.difficulty}</span>
                    </div>
                    <div class="article-card-preview">${preview}</div>
                    <div class="article-card-footer">
                        <span>${a.word_count} words</span>
                        ${isCompleted ? '<span class="article-completed-mark">✓ done</span>' : ''}
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

    window.openArticle = function(id) {
        currentArticle = articles.find(a => a.id === id);
        if (!currentArticle) return;

        previousBest = TypePetsData.getArticleBest(id);

        listView.style.display = 'none';
        typingView.style.display = 'block';

        document.getElementById('typingTitle').textContent = currentArticle.title;
        document.getElementById('typingCategory').textContent = currentArticle.category;
        document.getElementById('typingWordCount').textContent = currentArticle.word_count + ' words';

        chars = currentArticle.content.split('');
        charIndex = 0; errorCount = 0; correctCount = 0; totalKeystrokes = 0;
        startTime = null; finished = false; hasError = false; wpmHistory = [];

        document.getElementById('typingResult').classList.add('hidden');
        document.getElementById('typingWpm').textContent = '0';
        document.getElementById('typingAccuracy').textContent = '100';
        document.getElementById('typingTime').textContent = '0:00';
        clearSparkline();
        renderCharacters();
        textDisplay.focus();

        if (wpmUpdateInterval) clearInterval(wpmUpdateInterval);
        wpmUpdateInterval = setInterval(updateLiveStats, 2000);
    };

    function renderCharacters() {
        let html = '';
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            let cls = i === 0 ? 'char-current' : 'char-upcoming';
            let display = ch;
            if (ch === '<') display = '&lt;';
            else if (ch === '>') display = '&gt;';
            else if (ch === '&') display = '&amp;';
            html += `<span class="${cls}" data-idx="${i}">${display}</span>`;
        }
        textDisplay.innerHTML = html;
    }

    function updateCharClass(idx, cls, wrongChar) {
        const el = textDisplay.querySelector(`span[data-idx="${idx}"]`);
        if (!el) return;
        const ch = chars[idx];
        let display = ch;
        if (ch === '<') display = '&lt;';
        else if (ch === '>') display = '&gt;';
        else if (ch === '&') display = '&amp;';
        if (cls === 'char-error' && wrongChar) {
            let wrongDisplay = wrongChar;
            if (wrongChar === '<') wrongDisplay = '&lt;';
            else if (wrongChar === '>') wrongDisplay = '&gt;';
            else if (wrongChar === '&') wrongDisplay = '&amp;';
            el.className = cls;
            el.innerHTML = `${display}<span class="error-char">${wrongDisplay}</span>`;
        } else { el.className = cls; el.innerHTML = display; }
    }

    textDisplay.addEventListener('keydown', (e) => {
        if (finished) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Tab' || e.key === 'Escape') return;
        if (e.key === 'Backspace') { e.preventDefault(); return; }
        if (e.key.length !== 1 && e.key !== 'Enter') return;
        e.preventDefault();
        if (charIndex >= chars.length) return;
        if (!startTime) startTime = Date.now();
        totalKeystrokes++;
        const expected = chars[charIndex];
        let typed = e.key;
        if (e.key === 'Enter' && expected === '\n') typed = '\n';
        if (typed === expected) {
            correctCount++;
            updateCharClass(charIndex, 'char-correct', null);
            hasError = false;
            if (expected === ' ') playClack('space');
            else if (['\n','.','.','!','?'].includes(expected)) playClack('ding');
            else playClack('correct');
            charIndex++;
            if (charIndex < chars.length) { updateCharClass(charIndex, 'char-current', null); scrollToCurrentChar(); }
            if (charIndex >= chars.length) finishArticle();
        } else {
            errorCount++; hasError = true;
            updateCharClass(charIndex, 'char-error', typed);
            playClack('wrong');
        }
    });

    textDisplay.addEventListener('paste', (e) => e.preventDefault());

    function scrollToCurrentChar() {
        const el = textDisplay.querySelector('.char-current');
        if (!el) return;
        const containerRect = textDisplay.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const relativeTop = elRect.top - containerRect.top;
        if (relativeTop > containerRect.height * 0.7 || relativeTop < 0) {
            textDisplay.scrollTop += relativeTop - containerRect.height * 0.3;
        }
    }

    function updateLiveStats() {
        if (!startTime || finished) return;
        const elapsed = (Date.now()-startTime)/1000;
        const elapsedMin = elapsed/60;
        const wpm = elapsedMin>0 ? Math.round((correctCount/5)/elapsedMin) : 0;
        const total = correctCount+errorCount;
        const accuracy = total>0 ? Math.round((correctCount/total)*100) : 100;
        document.getElementById('typingWpm').textContent = wpm;
        document.getElementById('typingAccuracy').textContent = accuracy;
        const mins = Math.floor(elapsed/60);
        const secs = Math.floor(elapsed%60);
        document.getElementById('typingTime').textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
        wpmHistory.push({time:elapsed, wpm});
        const cutoff = elapsed-30;
        wpmHistory = wpmHistory.filter(p => p.time >= cutoff);
        drawSparkline();
    }

    function drawSparkline() {
        const svg = document.getElementById('wpmSparkline');
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
        const svg = document.getElementById('wpmSparkline');
        if (svg) svg.innerHTML = '';
    }

    function finishArticle() {
        finished = true;
        if (wpmUpdateInterval) clearInterval(wpmUpdateInterval);
        const elapsed = startTime ? (Date.now()-startTime)/1000 : 0;
        const elapsedMin = elapsed/60;
        const wpm = elapsedMin>0 ? Math.round((correctCount/5)/elapsedMin) : 0;
        const total = correctCount+errorCount;
        const accuracy = total>0 ? Math.round((correctCount/total)*100) : 100;
        const mins = Math.floor(elapsed/60);
        const secs = Math.floor(elapsed%60);
        document.getElementById('typingWpm').textContent = wpm;
        document.getElementById('typingAccuracy').textContent = accuracy;
        document.getElementById('typingTime').textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
        document.getElementById('resultWpm').textContent = wpm;
        document.getElementById('resultAccuracy').textContent = accuracy+'%';
        document.getElementById('resultTime').textContent = `${mins}:${secs.toString().padStart(2,'0')}`;

        const resultPbBadge = document.getElementById('resultPbBadge');
        const resultWpmPrev = document.getElementById('resultWpmPrev');
        if (previousBest && previousBest.attempts > 0) {
            const diff = wpm - previousBest.best_wpm;
            if (diff > 0) { resultWpmPrev.textContent = `↑ +${Math.round(diff)} from best`; resultWpmPrev.className = 'result-stat-prev improved'; }
            else if (diff < 0) { resultWpmPrev.textContent = `↓ ${Math.round(diff)} from best`; resultWpmPrev.className = 'result-stat-prev declined'; }
            else { resultWpmPrev.textContent = 'Matched your best!'; resultWpmPrev.className = 'result-stat-prev'; }
            if (wpm > previousBest.best_wpm) { resultPbBadge.classList.remove('hidden'); document.getElementById('resultTitle').textContent = 'New Personal Best!'; }
            else { resultPbBadge.classList.add('hidden'); document.getElementById('resultTitle').textContent = 'Complete!'; }
        } else {
            resultWpmPrev.textContent = 'First attempt!'; resultWpmPrev.className = 'result-stat-prev';
            resultPbBadge.classList.add('hidden'); document.getElementById('resultTitle').textContent = 'Complete!';
        }
        document.getElementById('typingResult').classList.remove('hidden');

        TypePetsData.markArticleCompleted(currentArticle.id);
        TypePetsData.updateArticleBest(currentArticle.id, wpm, accuracy, Math.round(elapsed));

        const sessionData = {mode:'article',level:currentArticle.id,wpm,accuracy,duration_seconds:Math.round(elapsed),keys_pressed:totalKeystrokes,errors:errorCount,error_keys:{}};
        TypePetsData.saveSession(sessionData);
        checkAchievements(sessionData);
        if (window.sound) window.sound.levelUp();
    }

    window.backToList = function() {
        typingView.style.display = 'none'; listView.style.display = 'block';
        if (wpmUpdateInterval) clearInterval(wpmUpdateInterval);
        renderArticleGrid();
    };

    window.retryArticle = function() {
        if (currentArticle) openArticle(currentArticle.id);
    };

    renderArticleGrid();
})();
