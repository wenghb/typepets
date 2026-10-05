/**
 * TypePets — feedback API (Cloudflare Pages Function, served at /api/feedback)
 *
 *   POST   /api/feedback            public: store one piece of feedback
 *   GET    /api/feedback            admin:  list feedback + summary counts
 *   PATCH  /api/feedback            admin:  { id, status } → new | done | archived
 *   DELETE /api/feedback?id=N       admin:  remove one row for good
 *
 * Bindings (Cloudflare dashboard → Pages project → Settings):
 *   FEEDBACK_DB           D1 database. The table is created on first use.
 *   FEEDBACK_ADMIN_TOKEN  secret; admin calls send `Authorization: Bearer <token>`.
 *
 * Privacy: no IP address, cookie or player name is stored. Email addresses and
 * phone numbers typed into the message are redacted before saving; the only
 * contact detail kept is the optional reply email a grown-up enters.
 */

const CATEGORIES = ['bug', 'idea', 'difficulty', 'love', 'other'];
const STATUSES = ['new', 'done', 'archived'];
const MAX_BODY_BYTES = 8 * 1024;
const MAX_MESSAGE = 1000;
const MAX_CONTACT = 120;
const MIN_FILL_MS = 600;           // faster than this (or no timing at all) is a bot
const FLOOD_WINDOW_MIN = 10;
const FLOOD_MAX = 60;              // site-wide cap per window, protects the database from floods
const LIST_DEFAULT = 200;
const LIST_MAX = 500;

const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        category TEXT NOT NULL,
        rating INTEGER,
        message TEXT NOT NULL DEFAULT '',
        contact TEXT,
        page TEXT,
        context TEXT,
        status TEXT NOT NULL DEFAULT 'new'
    )`,
    'CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status)'
];

let schemaReady = false;

async function ensureSchema(db) {
    if (schemaReady) return;
    await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    schemaReady = true;
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex'
        }
    });
}

function getDb(env) {
    return env && env.FEEDBACK_DB ? env.FEEDBACK_DB : null;
}

function notConfigured() {
    return json({ ok: false, error: 'not_configured' }, 503);
}

// ─── Input cleaning ──────────────────────────────────────────

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Any run of digits with phone-style separators; it counts as a number when it holds 7+ digits
// (catches US, UK, AU, EU layouts alike — a rare long score or date is an acceptable casualty)
const NUMBER_RUN_RE = /\+?\(?\d[\d ().-]{5,}\d/g;

function cleanText(value, max) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/\r\n?/g, '\n')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, max);
}

/** Kids sometimes type their email or phone number into the message — never store it. */
function redactPersonalInfo(text) {
    return text
        .replace(EMAIL_RE, '[email removed]')
        .replace(NUMBER_RUN_RE, (m) => (m.replace(/\D/g, '').length >= 7 ? '[number removed]' : m));
}

function cleanContact(value) {
    const v = cleanText(value, MAX_CONTACT);
    if (!v) return null;
    const m = v.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i);
    return m ? v : undefined; // undefined = present but invalid
}

/** Same page, one key: Pages serves /pages/home.html as /pages/home, and /blog/x/index.html as /blog/x/ */
function cleanPage(value) {
    const v = cleanText(value, 200);
    if (!/^\/[\w\-./]*$/.test(v)) return null;
    return v.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
}

function num(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

function shortStr(value, max) {
    return typeof value === 'string' && value ? value.slice(0, max) : undefined;
}

/** Only keep the anonymous fields we asked for, with sane bounds. */
function cleanContext(raw, request) {
    const c = raw && typeof raw === 'object' ? raw : {};
    const out = {
        ua: shortStr(request.headers.get('User-Agent') || '', 300),
        lang: shortStr(c.lang, 20),
        screen: /^\d{2,5}x\d{2,5}$/.test(c.screen || '') ? c.screen : undefined,
        viewport: /^\d{2,5}x\d{2,5}$/.test(c.viewport || '') ? c.viewport : undefined,
        theme: c.theme === 'dark' || c.theme === 'light' ? c.theme : undefined,
        touch: typeof c.touch === 'boolean' ? c.touch : undefined,
        country: shortStr(request.cf && request.cf.country, 2)
    };
    const p = c.progress && typeof c.progress === 'object' ? c.progress : null;
    if (p) {
        out.progress = {
            sessions: num(p.sessions, 0, 1e6),
            avg_wpm: num(p.avg_wpm, 0, 500),
            avg_accuracy: num(p.avg_accuracy, 0, 100),
            training_stage: num(p.training_stage, 0, 99),
            bubble_level: num(p.bubble_level, 0, 99),
            articles: num(p.articles, 0, 999),
            pet_level: num(p.pet_level, 0, 99)
        };
    }
    return JSON.stringify(out);
}

/** Read at most `max` bytes of the body (Content-Length can be absent with chunked uploads). */
async function readBodyCapped(request, max) {
    if (!request.body) return '';
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
    return new TextDecoder().decode(bytes);
}

function sameOrigin(request) {
    const origin = request.headers.get('Origin');
    if (!origin) return true; // non-browser clients; the JSON content type still blocks plain HTML form posts
    try {
        return new URL(origin).host === new URL(request.url).host;
    } catch (e) {
        return false;
    }
}

// ─── Admin auth ──────────────────────────────────────────────

async function isAdmin(request, env) {
    const expected = env && env.FEEDBACK_ADMIN_TOKEN;
    if (!expected) return false;
    const header = request.headers.get('Authorization') || '';
    const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!given) return false;
    const enc = new TextEncoder();
    // Hash both sides so the comparison is constant-time and length-independent
    const [a, b] = await Promise.all([
        crypto.subtle.digest('SHA-256', enc.encode(given)),
        crypto.subtle.digest('SHA-256', enc.encode(expected))
    ]);
    return crypto.subtle.timingSafeEqual(a, b);
}

async function requireAdmin(context) {
    const { request, env } = context;
    if (!env || !env.FEEDBACK_ADMIN_TOKEN) return json({ ok: false, error: 'admin_not_configured' }, 503);
    if (!(await isAdmin(request, env))) return json({ ok: false, error: 'unauthorized' }, 401);
    if (!getDb(env)) return notConfigured();
    return null;
}

// ─── Public: submit ──────────────────────────────────────────

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = getDb(env);
    if (!db) return notConfigured();

    if (!sameOrigin(request)) return json({ ok: false, error: 'forbidden' }, 403);
    if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
        return json({ ok: false, error: 'bad_request' }, 415);
    }
    const declared = Number(request.headers.get('Content-Length') || 0);
    if (declared > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, 413);

    let body;
    try {
        const text = await readBodyCapped(request, MAX_BODY_BYTES);
        if (text === null) return json({ ok: false, error: 'too_large' }, 413);
        body = JSON.parse(text);
    } catch (e) {
        return json({ ok: false, error: 'bad_request' }, 400);
    }
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_request' }, 400);

    // Honeypot / too-fast submissions: pretend it worked, store nothing
    if (body.website || !(Number(body.elapsed_ms) >= MIN_FILL_MS)) {
        return json({ ok: true });
    }

    const category = CATEGORIES.includes(body.category) ? body.category : 'other';
    const rating = Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
    const message = redactPersonalInfo(cleanText(body.message, MAX_MESSAGE));
    const contact = cleanContact(body.contact);
    if (contact === undefined) return json({ ok: false, error: 'bad_contact' }, 400);
    if (!message && rating === null) return json({ ok: false, error: 'empty' }, 400);

    try {
        await ensureSchema(db);
        const since = new Date(Date.now() - FLOOD_WINDOW_MIN * 60000).toISOString();
        const recent = await db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE created_at > ?').bind(since).first();
        if (recent && recent.n >= FLOOD_MAX) return json({ ok: false, error: 'busy' }, 429);

        await db.prepare(
            'INSERT INTO feedback (created_at, category, rating, message, contact, page, context) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
            new Date().toISOString(),
            category,
            rating,
            message,
            contact,
            cleanPage(body.page),
            cleanContext(body.context, request)
        ).run();
    } catch (e) {
        console.error('feedback insert failed', e);
        return json({ ok: false, error: 'server' }, 500);
    }
    return json({ ok: true }, 201);
}

// ─── Admin: list + summary ───────────────────────────────────

export async function onRequestGet(context) {
    const denied = await requireAdmin(context);
    if (denied) return denied;
    const db = getDb(context.env);
    const url = new URL(context.request.url);

    const where = [];
    const args = [];
    const status = url.searchParams.get('status') || 'open';
    if (status === 'open') {
        where.push("status != 'archived'");
    } else if (STATUSES.includes(status)) {
        where.push('status = ?');
        args.push(status);
    } // 'all' → no filter
    const category = url.searchParams.get('category');
    if (CATEGORIES.includes(category)) {
        where.push('category = ?');
        args.push(category);
    }
    const before = parseInt(url.searchParams.get('before'), 10);
    if (before > 0) {
        where.push('id < ?');
        args.push(before);
    }
    const limit = Math.min(LIST_MAX, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || LIST_DEFAULT));
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    try {
        await ensureSchema(db);
        const [items, byCategory, byStatus, byRating, byPage, week] = await db.batch([
            db.prepare(`SELECT * FROM feedback ${whereSql} ORDER BY id DESC LIMIT ?`).bind(...args, limit + 1),
            db.prepare("SELECT category AS k, COUNT(*) AS n FROM feedback WHERE status != 'archived' GROUP BY category"),
            db.prepare('SELECT status AS k, COUNT(*) AS n FROM feedback GROUP BY status'),
            db.prepare("SELECT rating AS k, COUNT(*) AS n FROM feedback WHERE rating IS NOT NULL AND status != 'archived' GROUP BY rating"),
            db.prepare("SELECT page AS k, COUNT(*) AS n FROM feedback WHERE status != 'archived' GROUP BY page ORDER BY n DESC LIMIT 10"),
            db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE created_at > ?').bind(weekAgo)
        ]);
        const rows = items.results || [];
        const hasMore = rows.length > limit;
        const toMap = (r) => Object.fromEntries((r.results || []).map((x) => [x.k === null ? '(unknown)' : x.k, x.n]));
        return json({
            ok: true,
            items: rows.slice(0, limit).map((r) => {
                let ctx = null;
                try { ctx = r.context ? JSON.parse(r.context) : null; } catch (e) { /* ignore */ }
                return { ...r, context: ctx };
            }),
            has_more: hasMore,
            summary: {
                by_category: toMap(byCategory),
                by_status: toMap(byStatus),
                by_rating: toMap(byRating),
                by_page: (byPage.results || []).map((x) => ({ page: x.k || '(unknown)', count: x.n })),
                last_7_days: (week.results && week.results[0] && week.results[0].n) || 0
            }
        });
    } catch (e) {
        console.error('feedback list failed', e);
        return json({ ok: false, error: 'server' }, 500);
    }
}

// ─── Admin: change status ────────────────────────────────────

export async function onRequestPatch(context) {
    const denied = await requireAdmin(context);
    if (denied) return denied;
    const db = getDb(context.env);
    let body;
    try { body = await context.request.json(); } catch (e) { body = null; }
    const id = body && Number.isInteger(body.id) ? body.id : 0;
    if (id <= 0 || !STATUSES.includes(body.status)) return json({ ok: false, error: 'bad_request' }, 400);
    try {
        await ensureSchema(db);
        const r = await db.prepare('UPDATE feedback SET status = ? WHERE id = ?').bind(body.status, id).run();
        if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: 'not_found' }, 404);
    } catch (e) {
        console.error('feedback update failed', e);
        return json({ ok: false, error: 'server' }, 500);
    }
    return json({ ok: true });
}

// ─── Admin: delete ───────────────────────────────────────────

export async function onRequestDelete(context) {
    const denied = await requireAdmin(context);
    if (denied) return denied;
    const db = getDb(context.env);
    const id = parseInt(new URL(context.request.url).searchParams.get('id'), 10);
    if (!(id > 0)) return json({ ok: false, error: 'bad_request' }, 400);
    try {
        await ensureSchema(db);
        const r = await db.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run();
        if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: 'not_found' }, 404);
    } catch (e) {
        console.error('feedback delete failed', e);
        return json({ ok: false, error: 'server' }, 500);
    }
    return json({ ok: true });
}
