/**
 * TypePets — leaderboard. Server: functions/api/leaderboard.js. The link to the
 * player's row lives in the player's data (data.js `leaderboard`), so a save code carries it.
 *
 * - Joining is optional. A kid builds a name from two word lists ("Cosmic" + "Pancake"); nobody
 *   types anything that ends up on the board. Rows show that name, the pet as it's dressed and the
 *   XP. Their own row is marked "You", and pinned under the top 25 when it's further down.
 * - The board adds up the last 7 days: today (UTC) and the 6 days before it. It moves on one day
 *   at 00:00 UTC, so each day's XP stays on the board for a full week and nobody drops off all at
 *   once. Each day's XP is worked out from the sessions this computer already keeps
 *   (TypePetsData.getPracticeXp), so it's the same XP the pet got and the same on every computer
 *   a save code links.
 * - Every page that loads this file sends the XP a moment after it changes (and when the page
 *   opens, if it changed elsewhere). Offline is fine: it goes up later. Nothing is sent for
 *   players who haven't joined.
 * - A row the player's data stopped pointing at (data.js queues it, e.g. after loading a backup
 *   from before joining) is taken off the board from here, so no row is ever stuck on it.
 * - A row the server no longer has (left on another computer, or unused for months) is noted on
 *   this browser and treated as not joined. The link in the data is only cleared here when no
 *   save code is linked; otherwise the save code brings the change, so it can't look like a
 *   conflict.
 * - The page (pages/leaderboard.html) calls mountPage(). This file needs js/data.js and
 *   js/wardrobe.js.
 */
const TypePetsLeaderboard = (function() {
    'use strict';

    const API = '/api/leaderboard';
    const SENT_KEY = 'typepets_lb_sent';       // localStorage: { [row id]: fingerprint the server last took }
    const GONE_KEY = 'typepets_lb_gone';       // localStorage: ids of rows the server no longer has
    const RETIRED_KEY = 'typepets_lb_retired'; // localStorage, written by data.js: [{ id, token }] to take off the board
    const DAY_MS = 86400000;
    const DAYS = 7;                            // days the board adds up (functions/api/leaderboard.js has the same)
    const LAST_DAYS = `the last ${DAYS} days`;
    const PUSH_DELAY_MS = 1500;
    const RETRY_MS = 60000;
    const RETRY_MAX_MS = 10 * 60000;
    const TIMEOUT_MS = 15000;
    const XP_MAX = 1000000;                    // the server refuses more in a day
    const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const EXPIRED_NOTE = 'Your leaderboard name was removed or has expired. Pick a name to join again.';

    let pushTimer = null;
    let retryTimer = null;
    let retryDelay = RETRY_MS;
    let inflight = null;
    let again = false;
    let flushing = false;
    let trouble = null;                        // null | 'offline' | 'server': why the last send didn't go up
    const listeners = [];

    // ─── Small helpers ───────────────────────────────────────

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function button(className, text, onClick) {
        const b = el('button', className, text);
        b.type = 'button';
        if (onClick) b.addEventListener('click', onClick);
        return b;
    }

    function fmt(n) {
        return Number(n || 0).toLocaleString('en-US');
    }

    function readJson(key, fallback) {
        try {
            const v = JSON.parse(localStorage.getItem(key) || 'null');
            return v === null ? fallback : v;
        } catch (e) { return fallback; }
    }

    function writeJson(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore: only saves a request */ }
    }

    function readSent() {
        const v = readJson(SENT_KEY, {});
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    }

    function writeSent(id, fingerprint) {
        const all = readSent();
        if (fingerprint) all[id] = fingerprint; else delete all[id];
        writeJson(SENT_KEY, all);
    }

    function goneIds() {
        const v = readJson(GONE_KEY, []);
        return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    }

    /** This player's row, unless the server told this browser it's gone. */
    function activeLink() {
        const link = TypePetsData.getLeaderboardLink();
        return link && !goneIds().includes(link.id) ? link : null;
    }

    // ─── Days and what gets sent ─────────────────────────────

    /** The UTC day holding `ms`, as YYYY-MM-DD. Same rule as the server. */
    function dayOf(ms) {
        return new Date(ms).toISOString().slice(0, 10);
    }

    /** Start (ms) of each day on the board now, oldest first, ending with today. */
    function boardDays() {
        const today = Date.parse(dayOf(Date.now()) + 'T00:00:00Z');
        const starts = [];
        for (let i = DAYS - 1; i >= 0; i--) starts.push(today - i * DAY_MS);
        return starts;
    }

    /** Practice XP from the days on the board now (from the sessions on this computer). */
    function recentXp() {
        const starts = boardDays();
        return TypePetsData.getPracticeXp(starts[0], starts[starts.length - 1] + DAY_MS);
    }

    /** { species, look, days }: the pet as it looks now, and each board day's XP. */
    function snapshot() {
        const days = {};
        // Every day is sent, even at 0 XP: the list moves on daily, so a visit each day says
        // the player is still around
        for (const start of boardDays()) {
            days[dayOf(start)] = Math.min(XP_MAX, TypePetsData.getPracticeXp(start, start + DAY_MS));
        }
        const pet = TypePetsData.getPet();
        const look = TypePetsWardrobe.resolveLook(pet, TypePetsWardrobe.getProgress());
        return { species: pet.species, look, days };
    }

    function fingerprint(link, snap) {
        return JSON.stringify([link.name, snap.species, snap.look, snap.days]);
    }

    // ─── Server calls ────────────────────────────────────────

    /** POST to /api/leaderboard. Always resolves to { status, body }; status 0 = no answer. */
    async function call(payload) {
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store',
                signal: ctrl ? ctrl.signal : undefined
            });
            let body = null;
            try { body = await res.json(); } catch (e) { body = null; }
            return { status: res.status, body: body && typeof body === 'object' ? body : {} };
        } catch (e) {
            return { status: 0, body: {} };
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    /** Worth trying again later: no answer, too busy, or a server hiccup (not "not set up"). */
    function retryable(res) {
        return res.status === 0 || res.status === 429 || (res.status >= 500 && res.body.error !== 'not_configured');
    }

    function errorMessage(res) {
        if (res.status === 0) return "Couldn't reach TypePets. Check the internet connection and try again.";
        if (res.status === 429) return 'Lots of players are joining right now. Try again in a few minutes.';
        return 'Something went wrong on our side. Try again in a little while.';
    }

    function notify() {
        listeners.forEach((fn) => { try { fn(); } catch (e) { console.error('TypePets: leaderboard listener failed', e); } });
    }

    /** The server no longer has this row (left on another computer, or expired). */
    function forget(link) {
        writeSent(link.id, null);
        writeJson(GONE_KEY, goneIds().filter((id) => id !== link.id).concat(link.id).slice(-20));
        // With a save code the data is shared: its next sync brings the removal (or a new row)
        if (!TypePetsData.getCloudLink().code) TypePetsData.setLeaderboardLink(null);
    }

    /** Send this player's XP and look if they changed. Resolves to 'off' | 'same' | 'sent' | 'gone' | 'retry' | 'rejected'. */
    async function pushOnce() {
        const link = activeLink();
        if (!link) return 'off';
        const snap = snapshot();
        const fp = fingerprint(link, snap);
        if (readSent()[link.id] === fp) return 'same';
        const res = await call({ action: 'update', id: link.id, token: link.token, ...snap });
        if (res.status === 200 && res.body.ok) {
            writeSent(link.id, fp);
            return 'sent';
        }
        if (res.status === 404 || res.status === 403) {
            forget(link);
            return 'gone';
        }
        trouble = res.status === 0 ? 'offline' : 'server';
        if (retryable(res)) return 'retry';
        console.warn('TypePets: the leaderboard refused an update', res.status, res.body.error);
        return 'rejected';
    }

    /** Push now (shared by everyone who asks while one is running). */
    function sync() {
        if (inflight) { again = true; return inflight; }
        clearTimeout(pushTimer);
        inflight = (async () => {
            let result;
            do {
                again = false;
                result = await pushOnce();
            } while (again);
            clearTimeout(retryTimer);
            if (result === 'retry') {
                retryTimer = setTimeout(() => sync(), retryDelay);
                retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
            } else {
                retryDelay = RETRY_MS;
                if (result !== 'rejected') trouble = null;
            }
            return result;
        })().finally(() => {
            inflight = null;
            notify();
        });
        return inflight;
    }

    function schedulePush(delay) {
        if (!activeLink()) return;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(() => sync(), delay === undefined ? PUSH_DELAY_MS : delay);
    }

    /** Take rows off the board that this browser's players no longer point at (queued by data.js). */
    async function flushRetired() {
        if (flushing) return;
        flushing = true;
        try {
            const queued = readJson(RETIRED_KEY, []);
            if (!Array.isArray(queued)) return;
            const current = TypePetsData.getLeaderboardLink();
            for (const row of queued) {
                if (!row || typeof row.id !== 'string' || typeof row.token !== 'string') continue;
                if (current && current.id === row.id) continue; // back in use (e.g. restored again)
                const res = await call({ action: 'leave', id: row.id, token: row.token });
                if (retryable(res)) continue; // stays queued for the next page
                const left = readJson(RETIRED_KEY, []);
                writeJson(RETIRED_KEY, (Array.isArray(left) ? left : []).filter((x) => !x || x.id !== row.id));
                writeSent(row.id, null);
            }
        } finally {
            flushing = false;
        }
    }

    let wordLists = null;   // { first, second } once loaded: the same for everyone, so asked once per page

    /** The two word lists names are built from, grouped (functions/api/leaderboard.js). */
    async function loadWords() {
        if (wordLists) return { ok: true, lists: wordLists };
        const res = await call({ action: 'words' });
        const ok = (list) => Array.isArray(list) && list.length && list.every((g) => g && typeof g.label === 'string' && Array.isArray(g.words) && g.words.length);
        if (res.status === 200 && ok(res.body.first) && ok(res.body.second)) {
            wordLists = { first: res.body.first, second: res.body.second };
            return { ok: true, lists: wordLists };
        }
        return { ok: false, error: errorMessage(res) };
    }

    async function suggestNames() {
        const res = await call({ action: 'names' });
        if (res.status === 200 && Array.isArray(res.body.names)) {
            if (res.body.names.length) return { ok: true, names: res.body.names };
            return { ok: false, error: 'Lots of names are taken right now. Try again in a moment.' };
        }
        return { ok: false, error: errorMessage(res) };
    }

    async function join(name) {
        if (activeLink()) return { ok: true };
        const snap = snapshot();
        const res = await call({ action: 'join', name, ...snap });
        if (res.status === 201 && res.body.ok) {
            const saved = TypePetsData.setLeaderboardLink({
                id: res.body.id, token: res.body.token, name: res.body.name, joined_at: new Date().toISOString()
            });
            if (!saved.ok) {
                // Nothing on this computer points at the new row, so take it straight back off
                await call({ action: 'leave', id: res.body.id, token: res.body.token });
                return { ok: false, error: "Couldn't save on this computer. Check that the browser allows saving, then try again." };
            }
            writeSent(saved.link.id, fingerprint(saved.link, snap));
            return { ok: true };
        }
        if (res.status === 409) return { ok: false, taken: true, error: 'Someone just took that name. Pick another one.' };
        return { ok: false, error: errorMessage(res) };
    }

    async function rename(name) {
        const link = activeLink();
        if (!link) return { ok: false, gone: true, error: EXPIRED_NOTE };
        const snap = snapshot();
        const res = await call({ action: 'update', id: link.id, token: link.token, name, ...snap });
        if (res.status === 200 && res.body.ok) {
            const saved = TypePetsData.setLeaderboardLink({ ...link, name: res.body.name });
            if (!saved.ok) return { ok: false, error: "Couldn't save on this computer. Check that the browser allows saving, then try again." };
            writeSent(saved.link.id, fingerprint(saved.link, snap));
            return { ok: true };
        }
        if (res.status === 409) return { ok: false, taken: true, error: 'Someone just took that name. Pick another one.' };
        if (res.status === 404 || res.status === 403) {
            forget(link);
            return { ok: false, gone: true, error: EXPIRED_NOTE };
        }
        return { ok: false, error: errorMessage(res) };
    }

    async function leave() {
        const link = TypePetsData.getLeaderboardLink();
        if (!link) return { ok: true };
        const res = await call({ action: 'leave', id: link.id, token: link.token });
        if (!(res.status === 200 && res.body.ok) && res.status !== 404 && res.status !== 403) {
            return { ok: false, error: errorMessage(res) };
        }
        writeSent(link.id, null);
        writeJson(GONE_KEY, goneIds().filter((id) => id !== link.id));
        TypePetsData.setLeaderboardLink(null);
        return { ok: true };
    }

    async function loadBoard() {
        const link = activeLink();
        const res = await call({ action: 'board', id: link ? link.id : undefined });
        if (res.status === 200 && res.body.ok && Array.isArray(res.body.rows)) return { ok: true, board: res.body, askedId: link ? link.id : null };
        const hint = res.status === 0 ? 'Check the internet connection and try again.' : 'Try again in a little while.';
        return { ok: false, error: `Couldn't load the leaderboard. ${hint}` };
    }

    // ─── Page ────────────────────────────────────────────────

    /** "Tuesday, Oct 20" for a YYYY-MM-DD board day (a UTC day). */
    function dayLabel(day) {
        const ms = Date.parse(day + 'T00:00:00Z');
        if (!isFinite(ms)) return '';
        return new Date(ms).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }

    function avatar(species, look, size) {
        const wrap = el('span', 'lb-avatar');
        wrap.innerHTML = TypePetsWardrobe.lookAvatarHTML(species, look, size);
        return wrap;
    }

    function rankCell(rank) {
        const cell = el('span', 'lb-rank');
        if (MEDALS[rank]) {
            cell.classList.add('lb-rank-medal');
            cell.textContent = MEDALS[rank];
            cell.setAttribute('role', 'img');
            cell.setAttribute('aria-label', `Number ${rank}`);
        } else {
            cell.textContent = `#${rank}`;
        }
        return cell;
    }

    function rowEl(r) {
        const li = el('li', 'lb-row');
        if (r.you) li.classList.add('lb-row-you');
        if (r.rank <= 3) li.classList.add('lb-row-top', `lb-row-top${r.rank}`);
        li.appendChild(rankCell(r.rank));
        li.appendChild(avatar(r.species, r.look, 44));
        const name = el('span', 'lb-name');
        name.appendChild(el('span', 'lb-name-text', r.name));
        if (r.you) name.appendChild(el('span', 'lb-you-tag', 'You'));
        li.appendChild(name);
        li.appendChild(el('span', 'lb-xp', `${fmt(r.xp)} XP`));
        return li;
    }

    /**
     * Name builder: the name is a first word and a second word from the server's lists
     * ("Cosmic" + "Pancake"). Each word is a button that opens its list, grouped ("Colors",
     * "Yummy food"…); picking the first word moves on to the second. "Surprise me" picks a free
     * pair. Whether the name is free is checked as it changes. Nothing is typed.
     * opts: { verb ('Join as'), current (the name now, when renaming), onPick(name) → { ok, error?, taken? }, onCancel? }
     */
    function namePicker(host, opts) {
        const box = el('div', 'lb-picker');
        const build = el('div', 'lb-build');
        const slots = [button('lb-slot'), button('lb-slot')];
        const surprise = button('btn btn-secondary lb-surprise', '🎲 Surprise me');
        const status = el('p', 'lb-availability');
        status.setAttribute('role', 'status');
        const panel = el('div', 'lb-words');
        panel.hidden = true;
        const actions = el('div', 'lb-actions');
        const go = button('btn btn-primary lb-go');
        const err = el('p', 'lb-error');
        err.setAttribute('role', 'alert');
        const picked = ['', ''];
        let lists = null;          // { first, second } from the server
        let open = -1;             // which word's list is showing
        let free = null;           // null = not known yet
        let checkSeq = 0;
        let busy = false;

        const SLOT_HINT = ['Pick your first word', 'Pick your second word'];
        const name = () => picked.join(' ');

        function groupsFor(i) { return lists ? (i === 0 ? lists.first : lists.second) : []; }

        function renderSlots() {
            slots.forEach((b, i) => {
                b.replaceChildren(el('span', 'lb-slot-word', picked[i] || '…'), el('span', 'lb-slot-caret', '▾'));
                b.setAttribute('aria-expanded', open === i ? 'true' : 'false');
                b.setAttribute('aria-label', `${i === 0 ? 'First' : 'Second'} word: ${picked[i] || 'none'}. Change it`);
                b.classList.toggle('is-open', open === i);
            });
            const unchanged = opts.current && name() === opts.current;
            go.textContent = picked[0] && picked[1] && !unchanged ? `${opts.verb} ${name()}` : (unchanged ? 'Change name' : opts.verb);
        }

        function renderStatus() {
            status.className = 'lb-availability';
            if (opts.current && name() === opts.current) {
                status.textContent = "That's your name now. Change a word to pick a new one.";
            } else if (free === true) {
                status.classList.add('is-free');
                status.textContent = '✓ Nobody has this name yet';
            } else if (free === false) {
                status.classList.add('is-taken');
                status.textContent = 'Someone already has this name. Change a word.';
            } else {
                status.textContent = '';
            }
        }

        async function checkFree() {
            const mine = ++checkSeq;
            free = null;
            renderStatus();
            if (!picked[0] || !picked[1] || (opts.current && name() === opts.current)) return;
            const res = await call({ action: 'check', name: name() });
            if (mine !== checkSeq) return;
            free = res.status === 200 && res.body.ok ? !!res.body.free : null; // unknown: the join answer decides
            renderStatus();
        }

        function showList(i, group) {
            open = i;
            renderSlots();
            if (i < 0) { panel.hidden = true; return; }
            const groups = groupsFor(i);
            const current = group !== undefined ? group : Math.max(0, groups.findIndex((g) => g.words.includes(picked[i])));
            panel.hidden = false;
            const title = el('p', 'lb-words-title', SLOT_HINT[i]);
            const chips = el('div', 'lb-groups');
            chips.setAttribute('role', 'group');
            chips.setAttribute('aria-label', `${i === 0 ? 'First' : 'Second'} word groups`);
            groups.forEach((g, gi) => {
                const chip = button('lb-group', g.label, () => showList(i, gi));
                chip.setAttribute('aria-pressed', gi === current ? 'true' : 'false');
                chips.appendChild(chip);
            });
            const grid = el('div', 'lb-word-grid');
            grid.setAttribute('role', 'group');
            grid.setAttribute('aria-label', groups[current] ? groups[current].label : SLOT_HINT[i]);
            (groups[current] ? groups[current].words : []).forEach((w) => {
                const b = button('lb-word', w, () => {
                    picked[i] = w;
                    err.textContent = '';
                    checkFree();
                    // The first word leads on to the second; the second closes the list
                    showList(i === 0 ? 1 : -1);
                    if (i === 0) focusFirstWord(); else slots[1].focus();
                });
                b.setAttribute('aria-pressed', w === picked[i] ? 'true' : 'false');
                grid.appendChild(b);
            });
            panel.replaceChildren(title, chips, grid);
        }

        function focusFirstWord() {
            const on = panel.querySelector('.lb-word[aria-pressed="true"]') || panel.querySelector('.lb-word');
            if (on) on.focus();
        }

        async function surpriseMe() {
            if (busy) return;
            busy = true;
            err.textContent = '';
            const res = await suggestNames();
            busy = false;
            if (!res.ok) { err.textContent = res.error; return; }
            const parts = res.names[0].split(' ');
            picked[0] = parts[0];
            picked[1] = parts[1];
            showList(-1);
            free = true; // the server only suggests free names
            checkSeq++;
            renderStatus();
        }

        async function start() {
            slots.forEach((b) => { b.disabled = true; });
            status.textContent = 'Getting words…';
            const [words, names] = await Promise.all([
                lists ? null : loadWords(),
                opts.current ? null : suggestNames()
            ]);
            slots.forEach((b) => { b.disabled = false; });
            if (words && !words.ok) {
                status.textContent = '';
                err.replaceChildren(document.createTextNode(words.error + ' '), button('lb-link', 'Try again', () => { err.textContent = ''; start(); }));
                return;
            }
            if (words) lists = words.lists;
            if (opts.current) {
                const parts = opts.current.split(' ');
                picked[0] = parts[0];
                picked[1] = parts[1];
            } else if (names && names.ok) {
                const parts = names.names[0].split(' ');
                picked[0] = parts[0];
                picked[1] = parts[1];
                free = true;
            } else {
                // No suggestion: start from any two words and check them
                picked[0] = lists.first[0].words[0];
                picked[1] = lists.second[0].words[0];
                checkFree();
            }
            renderSlots();
            renderStatus();
        }

        slots.forEach((b, i) => b.addEventListener('click', () => {
            if (!lists) return;
            showList(open === i ? -1 : i);
            if (open === i) focusFirstWord();
        }));
        surprise.addEventListener('click', surpriseMe);

        go.addEventListener('click', async () => {
            if (busy || !picked[0] || !picked[1]) return;
            if (opts.current && name() === opts.current) { err.textContent = "That's already your name. Change a word first."; return; }
            if (free === false) { err.textContent = 'Someone already has this name. Change a word first.'; return; }
            busy = true;
            go.textContent = 'Saving…';
            go.setAttribute('aria-busy', 'true');
            err.textContent = '';
            const res = await opts.onPick(name());
            busy = false;
            go.setAttribute('aria-busy', 'false');
            if (!box.isConnected) return;
            renderSlots();
            if (res.ok) return;
            err.textContent = res.error;
            if (res.taken) { free = false; checkSeq++; renderStatus(); }
        });

        build.appendChild(slots[0]);
        build.appendChild(slots[1]);
        build.appendChild(surprise);
        actions.appendChild(go);
        if (opts.onCancel) actions.appendChild(button('btn btn-secondary lb-cancel', 'Cancel', opts.onCancel));
        box.appendChild(build);
        box.appendChild(status);
        box.appendChild(panel);
        box.appendChild(actions);
        box.appendChild(err);
        host.appendChild(box);
        renderSlots();
        start();
        return box;
    }

    function mountPage(root) {
        const meCard = root.querySelector('#lbMe');
        const list = root.querySelector('#lbList');
        const pinned = root.querySelector('#lbPinned');
        const state = root.querySelector('#lbState');
        const windowEl = root.querySelector('#lbWindow');
        let board = null;        // the last board the server sent
        let loading = 0;         // load counter: only the newest answer is drawn
        let meMode = 'view';     // view | rename | leave
        let shownKey = null;     // what your card shows: 'join' or 'joined:<id>:<name>'
        let stats = null;        // { sub, rank, warn }: the parts of your card that update in place

        function petName() {
            const pet = TypePetsData.getPet();
            return pet.name && pet.name !== 'Unnamed' ? pet.name : 'your pet';
        }

        function ownAvatar() {
            const phone = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
            const wrap = el('span', 'lb-avatar lb-avatar-big');
            wrap.innerHTML = TypePetsWardrobe.avatarHTML(TypePetsData.getPet(), phone ? 64 : 84);
            return wrap;
        }

        function focusLater(node) {
            if (node) requestAnimationFrame(() => node.focus());
        }

        // ── Your card ──

        function renderJoin(note) {
            meCard.className = 'lb-card lb-me lb-me-join';
            meCard.replaceChildren();
            stats = null;
            const top = el('div', 'lb-me-top');
            top.appendChild(ownAvatar());
            const text = el('div', 'lb-me-text');
            const title = el('h2', 'lb-me-title', 'Join the leaderboard');
            title.tabIndex = -1;
            text.appendChild(title);
            const xp = recentXp();
            text.appendChild(el('p', 'lb-me-sub',
                `Make your leaderboard name from two words. Other players see that name, ${petName()} and your XP from ${LAST_DAYS}, never your real name.`));
            if (xp > 0) text.appendChild(el('p', 'lb-me-xp', `You've earned ${fmt(xp)} XP in ${LAST_DAYS} already.`));
            top.appendChild(text);
            meCard.appendChild(top);
            if (note) {
                const n = el('p', 'lb-note', note);
                n.setAttribute('role', 'status');
                meCard.appendChild(n);
            }
            namePicker(meCard, { verb: 'Join as', onPick: async (name) => {
                const res = await join(name);
                if (res.ok) {
                    if (typeof window.showToast === 'function') window.showToast('🏆 You joined the leaderboard!', 'success', 4000);
                    board = null;
                    renderMe('title');
                    loadAndDraw();
                }
                return res;
            } });
            return title;
        }

        function updateStats() {
            if (!stats) return;
            const you = board && board.you;
            const xp = Math.max(recentXp(), you ? you.xp : 0);
            stats.sub.textContent = xp > 0 ? `${fmt(xp)} XP in ${LAST_DAYS}` : 'Practice anything to get on the board.';
            stats.rank.hidden = !you;
            if (you) stats.rank.textContent = `#${fmt(you.rank)}`;
            stats.warn.hidden = !trouble;
            if (trouble === 'offline') stats.warn.textContent = "Couldn't send your newest XP yet. It goes up by itself once the internet is back.";
            else if (trouble) stats.warn.textContent = "Couldn't send your newest XP yet. TypePets will try again in a little while.";
        }

        function renderJoined(link) {
            meCard.className = 'lb-card lb-me lb-me-joined';
            meCard.replaceChildren();
            const top = el('div', 'lb-me-top');
            top.appendChild(ownAvatar());
            const text = el('div', 'lb-me-text');
            const title = el('h2', 'lb-me-title');
            title.tabIndex = -1;
            title.appendChild(document.createTextNode("You're "));
            title.appendChild(el('span', 'lb-me-name', link.name));
            text.appendChild(title);
            stats = { sub: el('p', 'lb-me-sub'), rank: el('p', 'lb-me-xp'), warn: el('p', 'lb-note lb-note-warn') };
            stats.warn.setAttribute('role', 'status');
            text.appendChild(stats.sub);
            text.appendChild(stats.rank);
            top.appendChild(text);
            meCard.appendChild(top);
            meCard.appendChild(stats.warn);
            updateStats();
            const nodes = { title };

            if (meMode === 'rename') {
                const step = el('p', 'lb-me-sub lb-me-step', 'Change one word or both:');
                step.tabIndex = -1;
                meCard.appendChild(step);
                nodes.step = step;
                namePicker(meCard, { verb: 'Change to', current: link.name, onPick: async (name) => {
                    const res = await rename(name);
                    if (res.ok) {
                        meMode = 'view';
                        renderMe('change');
                        loadAndDraw();
                    } else if (res.gone) {
                        meMode = 'view';
                        renderMe('title', res.error);
                    }
                    return res;
                }, onCancel: () => { meMode = 'view'; renderMe('change'); } });
                return nodes;
            }

            if (meMode === 'leave') {
                const box = el('div', 'lb-confirm');
                const ask = el('p', 'lb-confirm-text',
                    `Leave the leaderboard? ${link.name} and your XP come off the board on every computer. You can join again any time.`);
                ask.tabIndex = -1;
                box.appendChild(ask);
                nodes.ask = ask;
                const err = el('p', 'lb-error');
                err.setAttribute('role', 'alert');
                const actions = el('div', 'lb-actions');
                const yes = button('btn btn-danger', 'Leave', async () => {
                    yes.disabled = true;
                    err.textContent = '';
                    const res = await leave();
                    yes.disabled = false;
                    if (!res.ok) { err.textContent = res.error; return; }
                    meMode = 'view';
                    board = null;
                    renderMe('title');
                    loadAndDraw();
                });
                actions.appendChild(yes);
                actions.appendChild(button('btn btn-secondary', 'Stay', () => { meMode = 'view'; renderMe('leave'); }));
                box.appendChild(actions);
                box.appendChild(err);
                meCard.appendChild(box);
                return nodes;
            }

            const links = el('div', 'lb-me-links');
            nodes.change = button('lb-link', '✏️ Change name', () => { meMode = 'rename'; renderMe('step'); });
            nodes.leave = button('lb-link lb-link-quiet', 'Leave the leaderboard', () => { meMode = 'leave'; renderMe('ask'); });
            links.appendChild(nodes.change);
            links.appendChild(nodes.leave);
            meCard.appendChild(links);
            return nodes;
        }

        /** Draw your card from scratch; `focus` names the part to move keyboard focus to. */
        function renderMe(focus, note) {
            const link = activeLink();
            shownKey = link ? `joined:${link.id}:${link.name}` : 'join';
            if (link) {
                const nodes = renderJoined(link);
                if (focus) focusLater(nodes[focus] || nodes.title);
            } else {
                meMode = 'view';
                const title = renderJoin(note);
                if (focus) focusLater(title);
            }
        }

        /** After a send or a board load: update the numbers in place, redraw only when you joined, left or were renamed elsewhere. */
        function refreshMe() {
            const link = activeLink();
            const key = link ? `joined:${link.id}:${link.name}` : 'join';
            if (key === shownKey) { updateStats(); return; }
            const wasJoined = !!shownKey && shownKey.indexOf('joined:') === 0;
            const hadFocus = meCard.contains(document.activeElement);
            meMode = 'view';
            renderMe(hadFocus ? 'title' : null, !link && wasJoined ? EXPIRED_NOTE : null);
        }

        // ── The board ──

        function showState(kind, text, actionText, onAction) {
            state.hidden = false;
            state.className = `lb-state lb-state-${kind}`;
            state.replaceChildren(el('p', 'lb-state-text', text));
            if (actionText) {
                if (onAction) state.appendChild(button('btn btn-secondary', actionText, onAction));
                else {
                    const a = el('a', 'btn btn-primary', actionText);
                    a.href = 'home.html';
                    state.appendChild(a);
                }
            }
        }

        function drawBoard() {
            list.replaceChildren();
            pinned.replaceChildren();
            pinned.hidden = true;
            state.hidden = true;
            windowEl.textContent = `XP from ${LAST_DAYS}`;
            const since = dayLabel(board.from);
            windowEl.title = since ? `Counts XP from ${since} to today. Every day the oldest day drops off.` : '';
            if (!board.rows.length) {
                showState('empty', `Nobody has earned XP in ${LAST_DAYS}. Practice anything to be the first!`, 'Start practicing');
                return;
            }
            board.rows.forEach((r) => list.appendChild(rowEl(r)));
            const you = board.you;
            if (you && !board.rows.some((r) => r.you)) {
                pinned.hidden = false;
                pinned.appendChild(el('li', 'lb-gap', '···'));
                pinned.appendChild(rowEl({ ...you, you: true }));
            }
        }

        async function loadAndDraw() {
            const mine = ++loading;
            state.hidden = false;
            state.className = 'lb-state lb-state-loading';
            state.replaceChildren(el('p', 'lb-state-text', 'Loading the board…'));
            list.setAttribute('aria-busy', 'true');
            // Your newest XP goes up first, so the board you see includes it
            await sync();
            const res = await loadBoard();
            if (mine !== loading) return;
            list.setAttribute('aria-busy', 'false');
            if (!res.ok) {
                list.replaceChildren();
                pinned.replaceChildren();
                pinned.hidden = true;
                showState('error', res.error, 'Try again', loadAndDraw);
                return;
            }
            board = res.board;
            // A row removed on the server (left elsewhere, expired, taken down) without anything
            // to send from here yet: notice it now
            const link = activeLink();
            if (link && link.id === res.askedId && board.known === false) forget(link);
            drawBoard();
            refreshMe();
        }

        listeners.push(refreshMe);
        renderMe();
        loadAndDraw();
    }

    // ─── Start ───────────────────────────────────────────────

    function start() {
        TypePetsData.onSaved(() => schedulePush());
        window.addEventListener('online', () => { schedulePush(0); flushRetired(); });
        // Progress made on a page without this file (or on another computer) goes up now
        if (!/\/leaderboard(\.html)?$/.test(location.pathname)) schedulePush(PUSH_DELAY_MS);
        setTimeout(flushRetired, PUSH_DELAY_MS);
    }

    start();

    return {
        dayOf: dayOf,
        recentXp: recentXp,
        sync: sync,
        mountPage: mountPage
    };
})();
