/**
 * TypePets — save codes: a short code like TIGER-427-MOON that keeps a player's progress
 * online, so it follows a kid to any computer. Server: functions/api/save.js. The link to the
 * code lives in the player's data (data.js `cloud`).
 *
 * - "Get my save code" (Stats page) makes a code. From then on progress is saved online by
 *   itself a moment after every change, and on the next visit if the tab closed first.
 * - Typing the code on another computer loads the progress there and links that computer too.
 * - Every page checks the code once when it opens. Newer progress from another computer is
 *   loaded right away if this computer has nothing unsaved and the kid hasn't started doing
 *   anything on the page yet. Otherwise a small banner offers it, and when both computers
 *   changed the kid picks which one to keep. Nothing is merged, overwritten or dropped silently,
 *   nothing pops up or reloads in the middle of a game, and nothing is sent while a decision waits.
 * - Save codes never hold names: data.js leaves the player's name out, the server blanks it.
 * - Being offline never blocks play. Progress stays on the computer and goes up later.
 */
const TypePetsCloud = (function() {
    'use strict';

    const API = '/api/save';
    const EXAMPLE = 'TIGER-427-MOON';
    const PUSH_DELAY_MS = 1000;
    const RETRY_MS = 60000;
    const TIMEOUT_MS = 15000;
    const CHOICE_GUARD_MS = 700;                  // a prompt's choices ignore input this long after it opens
    const NOTE_KEY = 'typepets_cloud_note';      // sessionStorage: toast to show after a reload
    const RELOADS_KEY = 'typepets_cloud_reloads'; // sessionStorage: guards against reload loops
    // Pages where nothing is running, so a prompt may open by itself when the page opens
    const CALM_PAGE_RE = /\/(home|dashboard)(\.html)?$/;

    let state = 'idle';       // idle | saving | saved | offline | error | waiting
    let waiting = null;       // { kind: 'pull' | 'conflict', found }: newer progress online that needs a decision
    let pushTimer = null;
    let retryTimer = null;
    let pushing = false;
    let pushAgain = false;
    let checking = null;      // the check() in flight, shared by everyone who asks
    let checkFailed = false;  // the last check didn't get an answer, so retries check again
    let interacted = false;   // the kid has typed, clicked or tapped on this page
    let cleanAtOpen = true;   // nothing unsaved when the page opened (before the page's own setup ran)
    let dialogOpen = false;
    let bannerEl = null;
    let formCount = 0;

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

    function toast(message, type, duration) {
        if (typeof window.showToast === 'function') window.showToast(message, type || 'info', duration || 4000);
    }

    function plural(n, word) {
        return `${n} ${word}${n === 1 ? '' : 's'}`;
    }

    /** Same forgiving reading as the server: "tiger 427 moon" and "Tiger427Moon" → TIGER-427-MOON. */
    function normalizeCode(input) {
        const m = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]{2,12})(\d{3})([A-Z]{2,12})$/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
    }

    /** { pet, level, sessions, badges, xp } for a progress blob, or null if it can't be read. */
    function describe(data) {
        const v = TypePetsData.validateBackup(data);
        if (!v.ok) return null;
        const s = v.summary;
        return { pet: s.pet_name, level: s.pet_level, sessions: s.sessions, badges: s.badges, xp: s.xp };
    }

    function describeHere() {
        return describe(TypePetsData.cloudPayload());
    }

    function summaryLine(s) {
        return `${s.pet} · Lv ${s.level} · ${plural(s.sessions, 'session')}`;
    }

    function ago(iso) {
        const t = Date.parse(iso);
        if (!isFinite(t)) return '';
        const min = Math.floor((Date.now() - t) / 60000);
        if (min < 1) return 'just now';
        if (min < 60) return `${plural(min, 'minute')} ago`;
        const h = Math.floor(min / 60);
        if (h < 24) return `${plural(h, 'hour')} ago`;
        return 'on ' + new Date(t).toLocaleDateString();
    }

    function leaveNote(text) {
        try { sessionStorage.setItem(NOTE_KEY, text); } catch (e) { /* ignore */ }
    }

    function showNote() {
        let text = null;
        try {
            text = sessionStorage.getItem(NOTE_KEY);
            sessionStorage.removeItem(NOTE_KEY);
        } catch (e) { /* ignore */ }
        if (text) toast(text, 'success', 5000);
    }

    // ─── Server calls ────────────────────────────────────────

    /** POST to /api/save. Always resolves to { status, body }; status 0 = no answer. */
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

    function errorMessage(res) {
        const err = res.body.error;
        if (res.status === 0) return "Couldn't reach TypePets. Check the internet connection and try again.";
        if (err === 'not_found') return "We couldn't find that save code. Check each word and the numbers.";
        if (err === 'unknown_word') return `“${res.body.word}” isn't one of our save code words.`;
        if (err === 'bad_code') return `A save code looks like ${EXAMPLE}: a word, 3 numbers, then a word.`;
        if (err === 'busy') return 'Lots of saving going on right now. Please try again in a few minutes.';
        if (err === 'too_large') return 'This progress is too big to save online. Use a backup file instead.';
        if (err === 'not_configured') return "Save codes aren't switched on yet. Please try again later.";
        return 'Something went wrong. Please try again in a minute.';
    }

    /** Only our own JSON "not_found" means the code is gone (a missing page is a 404 too). */
    function isGone(res) {
        return res.status === 404 && res.body.error === 'not_found';
    }

    // ─── State ───────────────────────────────────────────────

    function getStatus() {
        const link = TypePetsData.getCloudLink();
        return {
            linked: !!link.code, code: link.code, synced_at: link.synced_at, state: state,
            waiting: waiting ? waiting.kind : null
        };
    }

    function setState(next) {
        state = next;
        try { window.dispatchEvent(new CustomEvent('typepets:cloud', { detail: getStatus() })); } catch (e) { /* ignore */ }
    }

    function forgetGoneCode(code) {
        TypePetsData.setCloudLink(null);
        waiting = null;
        hideBanner();
        setState('idle');
        toast(`Save code ${code} isn't online any more. You can get a new one on the Stats page.`, 'error', 7000);
    }

    /** The server now holds `hash` as revision `rev` of `code`. */
    function recordSynced(code, rev, updatedAt, hash) {
        const link = TypePetsData.getCloudLink();
        if (link.code !== code) return; // relinked meanwhile (another tab)
        TypePetsData.setCloudLink({
            ...link, rev: rev, synced_at: updatedAt, synced_hash: hash,
            pending_rev: null, pending_hashes: []
        });
    }

    // ─── Actions ─────────────────────────────────────────────

    /** Make a new save code holding this player's progress (or return the one already linked). */
    async function create() {
        const link = TypePetsData.getCloudLink();
        if (link.code) return { ok: true, code: link.code };
        const payload = TypePetsData.cloudPayload();
        const res = await call({ action: 'create', data: payload });
        if (res.status !== 201 || !res.body.code) return { ok: false, error: errorMessage(res) };
        TypePetsData.setCloudLink({
            code: res.body.code, token: res.body.token, rev: res.body.rev, synced_at: res.body.updated_at,
            synced_hash: TypePetsData.cloudHash(payload)
        });
        cleanAtOpen = true;
        setState('saved');
        schedulePush(0); // progress may have changed while the code was being made
        return { ok: true, code: res.body.code };
    }

    /** Fetch the progress behind a typed code, without using it yet. */
    async function lookup(input) {
        const code = normalizeCode(input);
        if (!code) return { ok: false, error: `A save code looks like ${EXAMPLE}: a word, 3 numbers, then a word.` };
        const res = await call({ action: 'load', code: code });
        if (res.status !== 200 || !res.body.data) {
            return { ok: false, error: errorMessage(res), suggestion: res.body.suggestion || null };
        }
        const summary = describe(res.body.data);
        if (!summary) return { ok: false, error: "That save code's progress couldn't be opened." };
        return {
            ok: true, code: res.body.code || code, token: res.body.token, rev: res.body.rev,
            updated_at: res.body.updated_at, data: res.body.data, summary: summary
        };
    }

    /** Replace this player's progress with a looked-up code's and link it, then reload the page. */
    function use(found, note) {
        const res = TypePetsData.applyCloudData(found.data, {
            code: found.code, token: found.token, rev: found.rev, synced_at: found.updated_at
        });
        if (!res.ok) {
            return { ok: false, error: res.error === 'storage' ? "Couldn't save. This browser's storage is full or blocked." : "That progress couldn't be loaded." };
        }
        waiting = null;
        leaveNote(note || `☁️ ${found.summary.pet} is here! Progress loaded from ${found.code}.`);
        location.reload();
        return { ok: true };
    }

    /** Delete the online copy and unlink. Progress stays on this computer. */
    async function stop() {
        const link = TypePetsData.getCloudLink();
        if (!link.code) return { ok: true };
        const res = await call({ action: 'delete', code: link.code, token: link.token });
        if (res.status !== 200 && !isGone(res)) return { ok: false, error: errorMessage(res) };
        TypePetsData.setCloudLink(null);
        waiting = null;
        hideBanner();
        setState('idle');
        return { ok: true };
    }

    // ─── Sync ────────────────────────────────────────────────

    function schedulePush(delay) {
        if (!TypePetsData.getCloudLink().code) return;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(push, delay === undefined ? PUSH_DELAY_MS : delay);
    }

    /** Try again later: check again if that's what failed, otherwise send what changed. */
    function retryLater() {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => (checkFailed ? check() : schedulePush(0)), RETRY_MS);
    }

    async function push() {
        pushTimer = null;
        if (waiting) return; // never send anything while a decision is waiting
        if (pushing) { pushAgain = true; return; }
        const link = TypePetsData.getCloudLink();
        if (!link.code) return;
        const payload = TypePetsData.cloudPayload();
        const hash = TypePetsData.cloudHash(payload);
        if (hash === link.synced_hash) {
            if (state !== 'saved') setState('saved');
            return;
        }
        pushing = true;
        setState('saving');
        // Note what is being sent, so a save that lands but whose reply is lost is recognised later
        // (keep earlier unconfirmed saves on the same revision: any of them may be the one that landed)
        const earlier = link.pending_rev === link.rev ? link.pending_hashes : [];
        TypePetsData.setCloudLink({ ...link, pending_rev: link.rev, pending_hashes: earlier.concat(hash) });
        const res = await call({ action: 'update', code: link.code, token: link.token, rev: link.rev, data: payload });
        pushing = false;
        if (res.status === 200) {
            recordSynced(link.code, res.body.rev, res.body.updated_at, hash);
            setState('saved');
        } else if (res.status === 409) {
            await check();
        } else if (isGone(res)) {
            forgetGoneCode(link.code);
        } else {
            setState(res.status === 0 ? 'offline' : 'error');
            if (res.status !== 413) retryLater(); // too big won't fix itself; the next change tries again
        }
        if (pushAgain) {
            pushAgain = false;
            schedulePush(0);
        }
    }

    /** Auto-reload at most a few times a minute, whatever happens (never a reload loop). */
    function mayAutoReload() {
        const now = Date.now();
        let recent = [];
        try { recent = JSON.parse(sessionStorage.getItem(RELOADS_KEY) || '[]').filter(t => now - t < 60000); } catch (e) { recent = []; }
        if (recent.length >= 3) return false;
        recent.push(now);
        try { sessionStorage.setItem(RELOADS_KEY, JSON.stringify(recent)); } catch (e) { return false; }
        return true;
    }

    /**
     * Compare with the online copy: send local changes, take newer progress, or ask when both
     * changed. Runs when a page opens, after a save is refused as out of date (409), and when a
     * failed check is retried. Only one runs at a time. opts.ask: open the prompt right away.
     */
    function check(opts) {
        if (!checking) checking = runCheck(opts || {}).finally(() => { checking = null; });
        return checking;
    }

    async function runCheck(opts) {
        const link = TypePetsData.getCloudLink();
        if (!link.code || waiting) return;
        const res = await call({ action: 'load', code: link.code, token: link.token, rev: link.rev });
        if (isGone(res)) { forgetGoneCode(link.code); return; }
        if (res.status !== 200) {
            checkFailed = true;
            setState(res.status === 0 ? 'offline' : 'error');
            retryLater();
            return;
        }
        checkFailed = false;
        const current = TypePetsData.getCloudLink();
        if (current.code !== link.code) return;
        const token = res.body.token || current.token;
        const localHash = TypePetsData.cloudHash();
        const localChanged = localHash !== current.synced_hash;
        const rev = res.body.rev;

        if (rev === current.rev || !res.body.data) {
            if (token !== current.token) TypePetsData.setCloudLink({ ...current, token: token });
            if (localChanged) schedulePush(0); else setState('saved');
            return;
        }
        if (rev < current.rev) {
            // The online copy went back in time (say, a database restore): this computer is ahead
            TypePetsData.setCloudLink({ ...current, token: token, rev: rev, synced_hash: null, pending_rev: null, pending_hashes: [] });
            schedulePush(0);
            return;
        }

        const found = { code: link.code, token: token, rev: rev, updated_at: res.body.updated_at, data: res.body.data, summary: describe(res.body.data) };
        if (!found.summary) { setState('error'); return; }
        const onlineHash = TypePetsData.cloudHash(found.data);
        const ownSave = rev === current.pending_rev + 1 && current.pending_hashes.includes(onlineHash);
        if (ownSave || onlineHash === localHash) {
            // It's this computer's own save (its reply got lost) or the same progress: catch up, send anything newer
            TypePetsData.setCloudLink({ ...current, token: token });
            recordSynced(link.code, rev, found.updated_at, onlineHash);
            if (onlineHash !== localHash) schedulePush(0); else setState('saved');
            return;
        }

        // Another computer saved newer progress
        const quiet = !interacted;
        // Changes this page made while opening (before the kid did anything) are redone after a reload
        if (!localChanged || (cleanAtOpen && quiet)) {
            if (quiet && mayAutoReload()) {
                use(found, `☁️ Loaded your newest progress from ${found.code}.`);
                return;
            }
            waiting = { kind: 'pull', found: found };
            setState('waiting');
            showBanner();
            return;
        }
        waiting = { kind: 'conflict', found: found };
        setState('waiting');
        if (opts.ask || (quiet && CALM_PAGE_RE.test(location.pathname))) askWhichToKeep(); else showBanner();
    }

    /** "This computer": replace exactly the online version the kid saw (a newer one gets a fresh look). */
    async function keepThisComputer() {
        const link = TypePetsData.getCloudLink();
        if (!link.code || !waiting) return { ok: false, error: 'This computer has no save code any more.' };
        const payload = TypePetsData.cloudPayload();
        const hash = TypePetsData.cloudHash(payload);
        const res = await call({ action: 'update', code: link.code, token: link.token, rev: waiting.found.rev, data: payload });
        if (isGone(res)) { forgetGoneCode(link.code); return { ok: false, gone: true }; }
        if (res.status === 409) { waiting = null; return { ok: false, stale: true }; }
        if (res.status !== 200) return { ok: false, error: errorMessage(res) };
        waiting = null;
        hideBanner();
        recordSynced(link.code, res.body.rev, res.body.updated_at, hash);
        setState('saved');
        return { ok: true };
    }

    /** Pick up whatever is waiting: load newer progress, or ask which to keep. */
    function resolve() {
        if (!waiting) return;
        if (waiting.kind === 'pull') use(waiting.found, `☁️ Loaded your newest progress from ${waiting.found.code}.`);
        else askWhichToKeep();
    }

    // ─── UI: banner (never takes focus, so typing in a game can't hit it) ─

    function hideBanner() {
        if (bannerEl) bannerEl.remove();
        bannerEl = null;
    }

    function showBanner() {
        hideBanner();
        if (!waiting) return;
        const w = waiting;
        const bar = el('div', 'savecode-banner');
        bar.setAttribute('role', 'status');
        bar.appendChild(el('span', 'savecode-banner-icon', '☁️'));
        bar.appendChild(el('span', 'savecode-banner-text', w.kind === 'pull'
            ? `Newer progress from your save code ${w.found.code} is waiting.`
            : `This computer and your save code ${w.found.code} both have new progress.`));
        const actions = el('span', 'savecode-banner-actions');
        actions.appendChild(button('btn btn-primary savecode-banner-go', w.kind === 'pull' ? 'Load it' : 'Choose', () => {
            hideBanner();
            resolve();
        }));
        actions.appendChild(button('savecode-banner-later', 'Not now', hideBanner));
        bar.appendChild(actions);
        // Keys pressed while a banner button has focus belong to the banner, not to a game underneath
        bar.addEventListener('keydown', (e) => e.stopPropagation());
        document.body.appendChild(bar);
        bannerEl = bar;
    }

    // ─── UI: which progress to keep ──────────────────────────

    /** Both computers changed: show both and let the kid pick. Closing it just asks again later. */
    function askWhichToKeep() {
        if (!waiting || waiting.kind !== 'conflict' || dialogOpen || typeof window.tpOpenModal !== 'function') return;
        hideBanner();
        const found = waiting.found;
        const here = describeHere();
        dialogOpen = true;
        const m = window.tpOpenModal({
            className: 'savecode-modal',
            label: 'Which progress do you want to keep?',
            onClose: () => { dialogOpen = false; }
        });
        const openedAt = Date.now();
        // A key still held from typing, or a double click, must not pick for the kid
        const settled = () => Date.now() - openedAt > CHOICE_GUARD_MS;

        m.card.appendChild(el('div', 'tp-modal-emoji', '☁️'));
        m.card.appendChild(el('h3', null, 'Which progress do you want to keep?'));
        m.card.appendChild(el('p', 'tp-modal-text', `This computer and your save code ${found.code} both have new progress. Pick one. The other will be replaced.`));

        const choices = el('div', 'savecode-choices');
        function choice(icon, title, s, sub, onPick) {
            const b = button('savecode-choice', null, () => { if (settled()) onPick(); });
            b.appendChild(el('span', 'savecode-choice-icon', icon));
            b.appendChild(el('span', 'savecode-choice-title', title));
            b.appendChild(el('span', 'savecode-choice-line', s ? summaryLine(s) : ''));
            b.appendChild(el('span', 'savecode-choice-sub', sub));
            return b;
        }
        const err = el('div', 'tp-modal-error');
        err.setAttribute('role', 'alert');
        const keepHere = choice('💻', 'This computer', here, here ? `${here.xp} XP` : '', async () => {
            keepHere.disabled = useCode.disabled = true;
            err.textContent = '';
            const r = await keepThisComputer();
            if (r.ok) {
                m.close();
                toast(`☁️ Saved! ${found.code} now has this computer's progress.`, 'success');
            } else if (r.gone) {
                m.close(); // forgetGoneCode already said so
            } else if (r.stale) {
                m.close();
                toast('Your save code just changed again on another computer. Take another look.', 'info', 5000);
                check({ ask: true });
            } else {
                err.textContent = r.error;
                keepHere.disabled = useCode.disabled = false;
            }
        });
        const useCode = choice('☁️', 'Save code', found.summary, `${found.summary.xp} XP · saved ${ago(found.updated_at)}`, () => {
            keepHere.disabled = useCode.disabled = true;
            const r = use(found, `☁️ Loaded ${found.summary.pet} from ${found.code}.`);
            if (!r.ok) { err.textContent = r.error; keepHere.disabled = useCode.disabled = false; }
        });
        choices.appendChild(keepHere);
        choices.appendChild(useCode);
        m.card.appendChild(choices);
        m.card.appendChild(err);
        m.card.appendChild(button('savecode-later', 'Decide later', () => m.close()));
        m.card.focus(); // not a choice: Enter or Space can't pick by accident
    }

    // ─── UI: "Have a save code?" form ────────────────────────

    /**
     * Type a code, see whose progress it is, use it here. Replacing progress this computer
     * already has asks first. opts: { label, button }.
     */
    function mountLoadForm(host, opts) {
        opts = opts || {};
        const buttonText = opts.button || 'Load';
        host.textContent = '';
        const form = el('form', 'savecode-form');
        form.noValidate = true;
        const id = 'savecodeInput' + (++formCount);
        const label = el('label', 'savecode-form-label', opts.label || 'Have a save code?');
        label.htmlFor = id;
        const row = el('div', 'savecode-row');
        const input = el('input', 'tp-input savecode-input');
        input.id = id;
        input.type = 'text';
        input.placeholder = EXAMPLE;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.maxLength = 40;
        input.setAttribute('autocapitalize', 'characters');
        input.setAttribute('autocorrect', 'off');
        const go = el('button', 'btn btn-primary savecode-go', buttonText);
        go.type = 'submit';
        row.appendChild(input);
        row.appendChild(go);
        const msg = el('div', 'savecode-msg');
        msg.setAttribute('role', 'alert');
        const preview = el('div', 'savecode-preview');
        preview.hidden = true;
        form.appendChild(label);
        form.appendChild(row);
        form.appendChild(msg);
        form.appendChild(preview);
        host.appendChild(form);

        let busy = false;
        function setBusy(on) {
            busy = on;
            go.disabled = on;
            go.textContent = on ? 'Looking…' : buttonText;
        }
        function showError(text, suggestion) {
            msg.textContent = text;
            if (suggestion) {
                msg.appendChild(document.createTextNode(' '));
                msg.appendChild(button('savecode-suggest', `Did you mean ${suggestion}?`, () => {
                    input.value = suggestion;
                    submit();
                }));
            }
        }
        function clear() {
            msg.textContent = '';
            preview.hidden = true;
            preview.textContent = '';
        }

        async function submit() {
            if (busy) return;
            clear();
            const typed = normalizeCode(input.value);
            if (typed && typed === TypePetsData.getCloudLink().code) {
                showError('This computer already uses that save code.');
                return;
            }
            setBusy(true);
            const found = await lookup(input.value);
            setBusy(false);
            if (!found.ok) { showError(found.error, found.suggestion); return; }
            input.value = found.code;
            const here = describeHere();
            if (!here || (here.sessions === 0 && here.xp === 0)) {
                const r = use(found);
                if (!r.ok) showError(r.error);
                return;
            }
            const link = TypePetsData.getCloudLink();
            preview.appendChild(el('div', 'savecode-preview-title', `Load ${summaryLine(found.summary)}?`));
            preview.appendChild(el('div', 'savecode-preview-sub',
                `It replaces ${summaryLine(here)} on this computer` +
                (link.code ? `, and this computer stops saving to ${link.code}.` : '.')));
            const actions = el('div', 'savecode-actions');
            const yes = button('btn btn-danger', 'Load it', () => {
                yes.disabled = true;
                const r = use(found);
                if (!r.ok) { yes.disabled = false; showError(r.error); }
            });
            actions.appendChild(yes);
            actions.appendChild(button('btn btn-secondary', 'Cancel', clear));
            preview.appendChild(actions);
            preview.hidden = false;
        }

        form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
        input.addEventListener('input', () => { if (!busy) clear(); });
        return { input: input };
    }

    /** "Load a save code" from the player menu: the same form, in a dialog, on any page. */
    function openLoadDialog() {
        if (typeof window.tpOpenModal !== 'function') return;
        const m = window.tpOpenModal({ className: 'savecode-modal savecode-load-modal', label: 'Load a save code' });
        const prof = TypePetsData.getActiveProfile();
        m.card.appendChild(el('div', 'tp-modal-emoji', '🔑'));
        m.card.appendChild(el('h3', null, 'Load a save code'));
        m.card.appendChild(el('p', 'tp-modal-text', `Played on another computer? Type your save code to bring that pet and progress here, for ${prof.name}.`));
        const host = el('div');
        const form = mountLoadForm(host, { label: 'Your save code' });
        m.card.appendChild(host);
        m.card.appendChild(button('savecode-later', 'Close', () => m.close()));
        setTimeout(() => form.input.focus(), 0);
    }

    // ─── UI: Stats page panel ────────────────────────────────

    function statusText(st) {
        if (st.waiting === 'conflict') return { text: '⚠️ This computer and the save code both have new progress.', tone: 'warn', action: 'Choose which to keep' };
        if (st.waiting === 'pull') return { text: '☁️ Newer progress from another computer is waiting.', tone: 'warn', action: 'Load it' };
        if (st.state === 'saving') return { text: '☁️ Saving…', tone: '' };
        if (st.state === 'offline') return { text: '⚠️ Offline. Progress will go up when the internet is back.', tone: 'warn' };
        if (st.state === 'error') return { text: "⚠️ Couldn't save online just now. Trying again soon.", tone: 'warn' };
        if (st.synced_at) return { text: `✓ Saved online ${ago(st.synced_at)}`, tone: 'ok' };
        return { text: '☁️ Checking…', tone: '' };
    }

    function copyText(text) {
        if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(() => true, () => false);
        }
        return Promise.resolve(false);
    }

    /** The whole save code section on the Stats page: get a code, or show it and its status. */
    function mountPanel(host) {
        let statusEl = null;
        let resolveBtn = null;

        function petName() {
            const pet = TypePetsData.getPet();
            return pet.name && pet.name !== 'Unnamed' ? pet.name : 'your pet';
        }

        function renderStatus() {
            if (!statusEl) return;
            const s = statusText(getStatus());
            statusEl.textContent = s.text;
            statusEl.className = 'savecode-status' + (s.tone ? ' ' + s.tone : '');
            if (resolveBtn) {
                resolveBtn.hidden = !s.action;
                if (s.action) resolveBtn.textContent = s.action;
            }
        }

        function renderUnlinked() {
            const intro = el('p', 'savecode-intro');
            intro.appendChild(document.createTextNode('Get a short code like '));
            intro.appendChild(el('strong', null, EXAMPLE));
            intro.appendChild(document.createTextNode(`, then type it on any computer to keep playing with ${petName()}. Your progress saves online by itself after that.`));
            host.appendChild(intro);
            const err = el('div', 'savecode-msg');
            err.setAttribute('role', 'alert');
            const get = button('btn btn-primary savecode-get', '☁️ Get my save code', async () => {
                get.disabled = true;
                get.textContent = 'Making your code…';
                err.textContent = '';
                const r = await create();
                if (!r.ok) {
                    err.textContent = r.error;
                    get.disabled = false;
                    get.textContent = '☁️ Get my save code';
                    return;
                }
                render(true);
                toast(`☁️ Your save code is ${r.code}. Write it down!`, 'success', 6000);
            });
            host.appendChild(get);
            host.appendChild(err);
            const have = el('div', 'savecode-have');
            mountLoadForm(have, { label: 'Already have a save code?' });
            host.appendChild(have);
        }

        function renderLinked(link, fresh) {
            const ticket = el('div', 'savecode-ticket' + (fresh ? ' fresh' : ''));
            ticket.appendChild(el('div', 'savecode-ticket-label', 'Your save code'));
            const code = el('div', 'savecode-ticket-code', link.code);
            code.setAttribute('aria-label', link.code.split('-').join(' '));
            ticket.appendChild(code);
            const copy = button('btn btn-secondary savecode-copy', '📋 Copy', async () => {
                const ok = await copyText(link.code);
                toast(ok ? 'Save code copied!' : `Your save code is ${link.code}`, ok ? 'success' : 'info');
            });
            ticket.appendChild(copy);
            host.appendChild(ticket);

            const statusRow = el('div', 'savecode-status-row');
            statusEl = el('p', 'savecode-status');
            statusEl.setAttribute('aria-live', 'polite');
            statusRow.appendChild(statusEl);
            resolveBtn = button('btn btn-primary savecode-resolve', '', resolve);
            resolveBtn.hidden = true;
            statusRow.appendChild(resolveBtn);
            host.appendChild(statusRow);

            host.appendChild(el('p', 'savecode-intro',
                `✏️ Write this code down. On another computer, open TypePets and type it on the Home page to keep playing with ${petName()}.`));

            const more = el('details', 'savecode-more');
            more.appendChild(el('summary', null, 'Use a different code or stop saving online'));
            const other = el('div', 'savecode-have');
            mountLoadForm(other, { label: 'Use a different save code' });
            more.appendChild(other);
            const stopRow = el('div', 'savecode-stop-row');
            stopRow.appendChild(button('btn btn-secondary savecode-stop', 'Stop saving online', confirmStop));
            stopRow.appendChild(el('span', null, 'Deletes the online copy. Progress stays on this computer.'));
            more.appendChild(stopRow);
            host.appendChild(more);
            renderStatus();
        }

        function confirmStop() {
            const link = TypePetsData.getCloudLink();
            if (!link.code || typeof window.tpOpenModal !== 'function') return;
            const m = window.tpOpenModal({ className: 'savecode-modal', label: 'Stop saving online?' });
            m.card.appendChild(el('div', 'tp-modal-emoji', '☁️'));
            m.card.appendChild(el('h3', null, 'Stop saving online?'));
            m.card.appendChild(el('p', 'tp-modal-text',
                `The online copy of ${petName()} will be deleted and ${link.code} will stop working on every computer. Progress stays on this computer.`));
            const err = el('div', 'tp-modal-error');
            err.setAttribute('role', 'alert');
            m.card.appendChild(err);
            const actions = el('div', 'tp-modal-actions');
            const del = button('btn btn-danger', 'Delete online copy', async () => {
                del.disabled = true;
                err.textContent = '';
                const r = await stop();
                if (!r.ok) { err.textContent = r.error; del.disabled = false; return; }
                m.close();
                render();
                toast('Online copy deleted. Progress is still on this computer.', 'success');
            });
            actions.appendChild(del);
            actions.appendChild(button('btn btn-secondary', 'Cancel', () => m.close()));
            m.card.appendChild(actions);
            setTimeout(() => del.focus(), 0);
        }

        function render(fresh) {
            host.textContent = '';
            statusEl = null;
            resolveBtn = null;
            const link = TypePetsData.getCloudLink();
            if (link.code) renderLinked(link, fresh); else renderUnlinked();
        }

        let wasLinked = getStatus().linked;
        window.addEventListener('typepets:cloud', (e) => {
            const linkedNow = !!(e.detail && e.detail.linked);
            if (linkedNow !== wasLinked) { wasLinked = linkedNow; render(); } else renderStatus();
        });
        setInterval(renderStatus, 30000); // keep "saved 3 minutes ago" fresh
        render();
    }

    // ─── Start ───────────────────────────────────────────────

    function start() {
        showNote();
        // This runs before the page's own setup, so this is the state the kid left it in
        const link = TypePetsData.getCloudLink();
        cleanAtOpen = !link.code || TypePetsData.cloudHash() === link.synced_hash;
        ['keydown', 'pointerdown', 'touchstart'].forEach((type) => {
            window.addEventListener(type, () => { interacted = true; }, { capture: true, passive: true, once: true });
        });
        TypePetsData.onSaved(() => schedulePush());
        // Back online: retry what failed. Never reloads mid-game: once the kid has done something
        // on the page, newer progress from elsewhere waits behind a banner.
        window.addEventListener('online', () => (checkFailed ? check() : schedulePush(0)));
        if (link.code) check();
    }

    start();

    return {
        EXAMPLE: EXAMPLE,
        getStatus: getStatus,
        normalizeCode: normalizeCode,
        create: create,
        lookup: lookup,
        use: use,
        stop: stop,
        check: check,
        resolve: resolve,
        openLoadDialog: openLoadDialog,
        mountLoadForm: mountLoadForm,
        mountPanel: mountPanel
    };
})();
