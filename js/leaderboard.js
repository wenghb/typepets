/**
 * TypePets — weekly leaderboard. Server: functions/api/leaderboard.js. The link to the
 * player's row lives in the player's data (data.js `leaderboard`), so a save code carries it.
 *
 * - Joining is optional. A kid picks one of three made-up names ("Speedy Otter"); nobody types
 *   anything that ends up on the board. Rows show that name, the pet as it's dressed and the
 *   week's XP. Their own row is marked "You", and pinned under the top 25 when it's further down.
 * - Weeks start Monday 00:00 UTC. The week's XP is worked out from the sessions this computer
 *   already keeps (TypePetsData.getPracticeXp), so it's the same XP the pet got and the same on
 *   every computer a save code links.
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
    const WEEK_MS = 7 * 86400000;
    const GRACE_MS = 48 * 3600000;             // last week still takes updates this long (functions/api/leaderboard.js)
    const PUSH_DELAY_MS = 1500;
    const RETRY_MS = 60000;
    const RETRY_MAX_MS = 10 * 60000;
    const TIMEOUT_MS = 15000;
    const XP_MAX = 1000000;                    // the server refuses more in a week
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

    function plural(n, word) {
        return `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
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

    // ─── Weeks and what gets sent ────────────────────────────

    /** Monday (UTC) of the week holding `ms`, as YYYY-MM-DD. Same rule as the server. */
    function weekOf(ms) {
        const d = new Date(ms);
        const back = (d.getUTCDay() + 6) % 7;
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
    }

    function weekStartMs(week) {
        return Date.parse(week + 'T00:00:00Z');
    }

    /** This week's practice XP (from the sessions on this computer). */
    function weekXp() {
        const start = weekStartMs(weekOf(Date.now()));
        return TypePetsData.getPracticeXp(start, start + WEEK_MS);
    }

    /** { species, look, scores }: the pet as it looks now, and XP for the weeks the server still takes. */
    function snapshot() {
        const now = Date.now();
        const week = weekOf(now);
        const start = weekStartMs(week);
        const scores = {};
        scores[week] = Math.min(XP_MAX, TypePetsData.getPracticeXp(start, start + WEEK_MS));
        if (now - start < GRACE_MS) {
            const last = weekOf(start - 1);
            scores[last] = Math.min(XP_MAX, TypePetsData.getPracticeXp(weekStartMs(last), start));
        }
        const pet = TypePetsData.getPet();
        const look = TypePetsWardrobe.resolveLook(pet, TypePetsWardrobe.getProgress());
        return { species: pet.species, look, scores };
    }

    function fingerprint(link, snap) {
        return JSON.stringify([link.name, snap.species, snap.look, snap.scores]);
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

    async function suggestNames() {
        const res = await call({ action: 'names' });
        if (res.status === 200 && Array.isArray(res.body.names)) {
            if (res.body.names.length) return { ok: true, names: res.body.names };
            return { ok: false, error: 'Lots of names are taken right now. Try "Other names" again in a moment.' };
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
        const res = await call({ action: 'board', week: 'this', id: link ? link.id : undefined });
        if (res.status === 200 && res.body.ok && Array.isArray(res.body.rows)) return { ok: true, board: res.body, askedId: link ? link.id : null };
        const hint = res.status === 0 ? 'Check the internet connection and try again.' : 'Try again in a little while.';
        return { ok: false, error: `Couldn't load the leaderboard. ${hint}` };
    }

    // ─── Page ────────────────────────────────────────────────

    function untilText(iso) {
        const ms = Date.parse(iso) - Date.now();
        if (!isFinite(ms)) return '';
        if (ms <= 60000) return 'New week starts in a minute';
        const min = Math.floor(ms / 60000);
        if (min < 60) return `New week starts in ${plural(min, 'minute')}`;
        const h = Math.floor(min / 60);
        if (h < 24) return `New week starts in ${plural(h, 'hour')}`;
        return `New week starts in ${plural(Math.floor(h / 24), 'day')}`;
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
     * Name picker: three suggestions (the first one picked), "Other names", and a button.
     * onPick(name) resolves to { ok, error?, taken? }; a taken name loads new suggestions.
     */
    function namePicker(host, actionText, onPick, onCancel) {
        const box = el('div', 'lb-picker');
        const choices = el('div', 'lb-choices');
        choices.setAttribute('role', 'radiogroup');
        choices.setAttribute('aria-label', 'Leaderboard name');
        const err = el('p', 'lb-error');
        err.setAttribute('role', 'alert');
        const actions = el('div', 'lb-actions');
        const go = button('btn btn-primary lb-go', actionText);
        const more = button('btn btn-secondary lb-more', '🎲 Other names');
        let picked = null;
        let busy = false;

        function setBusy(on, label) {
            busy = on;
            go.textContent = on && label ? label : actionText;
            box.classList.toggle('is-busy', on);
            go.setAttribute('aria-busy', on ? 'true' : 'false');
        }

        function select(name) {
            picked = name;
            choices.querySelectorAll('.lb-choice').forEach((b) => {
                const on = b.dataset.name === name;
                b.setAttribute('aria-checked', on ? 'true' : 'false');
                b.tabIndex = on ? 0 : -1;
            });
        }

        async function refill() {
            if (busy) return;
            setBusy(true);
            err.textContent = '';
            choices.replaceChildren(el('span', 'lb-choices-loading', 'Finding names…'));
            const res = await suggestNames();
            setBusy(false);
            choices.replaceChildren();
            if (!res.ok) {
                picked = null;
                err.textContent = res.error;
                return;
            }
            res.names.forEach((name) => {
                const b = button('lb-choice', name, () => select(name));
                b.dataset.name = name;
                b.setAttribute('role', 'radio');
                choices.appendChild(b);
            });
            select(res.names[0]);
        }

        // Arrow keys move between the names, like any radio group
        choices.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
            const all = [...choices.querySelectorAll('.lb-choice')];
            const i = all.findIndex((b) => b.dataset.name === picked);
            if (i < 0) return;
            e.preventDefault();
            const next = all[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? all.length - 1 : 1)) % all.length];
            select(next.dataset.name);
            next.focus();
        });

        go.addEventListener('click', async () => {
            if (busy) return;
            if (!picked) { refill(); return; }
            setBusy(true, 'Saving…');
            err.textContent = '';
            const res = await onPick(picked);
            setBusy(false);
            if (res.ok || !box.isConnected) return;
            err.textContent = res.error;
            if (res.taken) {
                await refill();
                err.textContent = res.error;
            }
        });

        actions.appendChild(go);
        actions.appendChild(more);
        more.addEventListener('click', refill);
        if (onCancel) actions.appendChild(button('btn btn-secondary lb-cancel', 'Cancel', onCancel));
        box.appendChild(choices);
        box.appendChild(actions);
        box.appendChild(err);
        host.appendChild(box);
        refill();
        return box;
    }

    function mountPage(root) {
        const meCard = root.querySelector('#lbMe');
        const list = root.querySelector('#lbList');
        const pinned = root.querySelector('#lbPinned');
        const state = root.querySelector('#lbState');
        const resetEl = root.querySelector('#lbReset');
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
            const title = el('h2', 'lb-me-title', 'Join the weekly leaderboard');
            title.tabIndex = -1;
            text.appendChild(title);
            const xp = weekXp();
            text.appendChild(el('p', 'lb-me-sub',
                `Pick a leaderboard name. Other players see that name, ${petName()} and your XP this week, never your real name.`));
            if (xp > 0) text.appendChild(el('p', 'lb-me-xp', `You've earned ${fmt(xp)} XP this week already.`));
            top.appendChild(text);
            meCard.appendChild(top);
            if (note) {
                const n = el('p', 'lb-note', note);
                n.setAttribute('role', 'status');
                meCard.appendChild(n);
            }
            namePicker(meCard, 'Join', async (name) => {
                const res = await join(name);
                if (res.ok) {
                    if (typeof window.showToast === 'function') window.showToast('🏆 You joined the leaderboard!', 'success', 4000);
                    board = null;
                    renderMe('title');
                    loadAndDraw();
                }
                return res;
            });
            return title;
        }

        function updateStats() {
            if (!stats) return;
            const you = board && board.you;
            const xp = Math.max(weekXp(), you ? you.xp : 0);
            stats.sub.textContent = xp > 0 ? `${fmt(xp)} XP this week` : "Practice anything to get on this week's board.";
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
                const step = el('p', 'lb-me-sub lb-me-step', 'Pick a new name:');
                step.tabIndex = -1;
                meCard.appendChild(step);
                nodes.step = step;
                namePicker(meCard, 'Use this name', async (name) => {
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
                }, () => { meMode = 'view'; renderMe('change'); });
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
            resetEl.textContent = untilText(board.next_week_at);
            resetEl.title = 'Starts ' + new Date(board.next_week_at).toLocaleString();
            if (!board.rows.length) {
                showState('empty', 'Nobody is on the board yet this week. Practice anything to be the first!', 'Start practicing');
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
        weekOf: weekOf,
        weekXp: weekXp,
        sync: sync,
        mountPage: mountPage
    };
})();
