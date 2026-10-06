/**
 * TypePets — save codes API (Cloudflare Pages Function, served at /api/save)
 *
 * A save code such as TIGER-427-MOON keeps one player's progress online, so a kid can pick it
 * up on another computer (school Chromebooks often wipe browser data). Every call is a POST
 * with a JSON body, so a code never sits in a URL, a log line or the browser history:
 *
 *   { action: 'create', data }                → 201 { ok, code, token, rev, updated_at }
 *   { action: 'load', code, rev?, token? }    → 200 { ok, code, token, rev, updated_at, data? }
 *                                               (data is left out when `rev` is already current)
 *   { action: 'update', code, rev, data, token? } → 200 { ok, rev, updated_at }
 *                                               409 { error: 'conflict', rev, updated_at } when
 *                                               another computer saved since `rev`
 *   { action: 'delete', code, token? }        → 200 { ok }
 *
 * A code that doesn't exist answers 404 { error: 'not_found' }; a word that isn't on the list
 * answers 400 { error: 'unknown_word', word, suggestion? } so a typo can be fixed on the spot.
 * An update always names the revision it replaces, so nothing is overwritten unseen.
 *
 * Binding: FEEDBACK_DB (D1). The save tables share the feedback database, so there is no extra
 * dashboard setup; they are created on first use.
 *
 * Privacy: no IP address, cookie, player name or device ID is stored. The player's name is
 * blanked (the browser leaves it out too) and a pet name that looks like an email address or
 * phone number is dropped. Codes nobody opened or saved for RETENTION_DAYS are deleted.
 *
 * Guessing: 258 words × 900 numbers × 258 words ≈ 60 million codes. A computer that already
 * uses a code holds its `token` (handed out by create and load) and is never slowed down.
 * Every other request that names a code counts as a guess, site-wide; past GUESS_MAX per
 * GUESS_WINDOW_MIN they are told to wait (429). That caps anyone walking the code space at
 * ~15,000 guesses a day without ever blocking kids whose computers are already linked.
 */

import { json, cleanText, looksPersonal, readBodyCapped, sameOrigin } from '../_lib/http.js';

// Short, easy to spell for ages 7–12, and no two words one typo apart (so a typo can never
// turn into another valid code, and the closest word is a safe suggestion).
const WORDS = [
    'ANT', 'BEAR', 'BEE', 'BIRD', 'BUNNY', 'CAT', 'CLAM', 'COW', 'CRAB', 'DEER', 'DOG', 'DUCK',
    'EAGLE', 'ELK', 'EMU', 'FISH', 'FOX', 'FROG', 'GOAT', 'GOOSE', 'HEN', 'HIPPO', 'HORSE',
    'KOALA', 'LAMB', 'LION', 'LLAMA', 'MOLE', 'MOUSE', 'NEWT', 'OTTER', 'OWL', 'PANDA', 'PIG',
    'PONY', 'PUPPY', 'SEAL', 'SHARK', 'SHEEP', 'SLOTH', 'SNAIL', 'SNAKE', 'SWAN', 'TIGER', 'TOAD',
    'TURTLE', 'WHALE', 'WOLF', 'WORM', 'YAK', 'ZEBRA', 'BADGER', 'BEAVER', 'CAMEL', 'GECKO',
    'HAWK', 'MOTH', 'ORCA', 'PUFFIN', 'ROBIN', 'SQUID', 'TOUCAN', 'WALRUS', 'PARROT', 'RABBIT',
    'KITTEN', 'MONKEY', 'CHICK', 'LIZARD', 'DRAGON', 'FALCON', 'PIGEON', 'SALMON', 'SPIDER',
    'RAVEN', 'TUNA', 'ACORN', 'BEACH', 'CLOUD', 'COMET', 'CORAL', 'DAISY', 'DUNE', 'EARTH', 'FERN',
    'FIELD', 'FLOWER', 'FOREST', 'FROST', 'HILL', 'ISLAND', 'LAKE', 'LEAF', 'LILY', 'MAPLE',
    'MEADOW', 'MOON', 'MOSS', 'OCEAN', 'PEBBLE', 'PINE', 'PLANET', 'RAIN', 'RAINBOW', 'RIVER',
    'ROCK', 'ROSE', 'SAND', 'SEED', 'SHELL', 'SKY', 'SNOW', 'STAR', 'STONE', 'STORM', 'SUN',
    'TREE', 'TULIP', 'VALLEY', 'WAVE', 'WIND', 'CANYON', 'MARS', 'ORBIT', 'ROCKET', 'JUNGLE',
    'DESERT', 'BREEZE', 'PUDDLE', 'SUNSET', 'GARDEN', 'APPLE', 'BAGEL', 'BANANA', 'BERRY', 'BREAD',
    'CANDY', 'CHERRY', 'COOKIE', 'GRAPE', 'HONEY', 'JAM', 'JELLY', 'KIWI', 'LEMON', 'LIME',
    'MANGO', 'MELON', 'MILK', 'MINT', 'NOODLE', 'OLIVE', 'ORANGE', 'PASTA', 'PEPPER', 'PICKLE',
    'PIZZA', 'PLUM', 'POPCORN', 'RICE', 'SOUP', 'TACO', 'TOAST', 'WAFFLE', 'CHEESE', 'PANCAKE',
    'BUTTER', 'CUPCAKE', 'SUGAR', 'ANCHOR', 'ARROW', 'BALL', 'BALLOON', 'BANJO', 'BASKET', 'BIKE',
    'BOOK', 'BRUSH', 'BUBBLE', 'BUCKET', 'BUTTON', 'CANDLE', 'CANOE', 'CASTLE', 'CLOCK', 'COIN',
    'CRAYON', 'CROWN', 'CUP', 'DRUM', 'FLAG', 'FLUTE', 'GLOBE', 'HELMET', 'KEY', 'KITE', 'LADDER',
    'MAGNET', 'MAP', 'MARBLE', 'PAINT', 'PAPER', 'PIANO', 'PILLOW', 'PUZZLE', 'QUILT', 'RADIO',
    'RING', 'ROBOT', 'SCARF', 'SHOE', 'SPOON', 'SWING', 'TABLE', 'TENT', 'TOWER', 'TRUCK',
    'VIOLIN', 'WAGON', 'WHEEL', 'ZIPPER', 'HAMMER', 'PENCIL', 'RIBBON', 'BLANKET', 'LANTERN',
    'TROPHY', 'TEAPOT', 'IGLOO', 'RED', 'BLUE', 'GREEN', 'GOLD', 'SILVER', 'PURPLE', 'YELLOW',
    'HAPPY', 'LUCKY', 'FUZZY', 'COZY', 'SPEEDY', 'BRAVE', 'TINY', 'SUPER', 'SHINY', 'SPARKLE',
    'BOUNCY', 'FLUFFY', 'BRIGHT', 'CACTUS', 'NINJA', 'PIRATE', 'CIRCUS', 'PUMPKIN', 'SNOWMAN',
    'COWBOY', 'FARMER', 'DINO'
];
const WORD_SET = new Set(WORDS);

const ACTIONS = ['create', 'load', 'update', 'delete'];
const MAX_BODY_BYTES = 320 * 1024;   // the busiest possible player (500 sessions) is ~200 KB
const RETENTION_DAYS = 365;
const TOUCH_AFTER_MS = 86400000;     // a load refreshes `used_at` at most once a day
const CREATE_WINDOW_MIN = 10;
const CREATE_MAX = 200;              // site-wide new codes per window…
const CREATE_BYTES_MAX = 16 * 1024 * 1024; // …and bytes of new codes, so floods can't fill the database
const GUESS_WINDOW_MIN = 10;
const GUESS_MAX = 100;               // site-wide requests per window from computers without a token

// What progress holds (js/data.js getDefaultData); anything else is dropped. Lists are capped
// at what the browser itself keeps.
const DATA_KEYS = ['version', 'user', 'training', 'bubbles', 'pet', 'sessions', 'achievements',
    'streaks', 'activities', 'articles', 'milestones', 'goals'];
const LIST_CAPS = { sessions: 500, activities: 200, achievements: 200, milestones: 50 };

const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS saves (
        code TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        rev INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        used_at TEXT NOT NULL,
        token TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_saves_created ON saves (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_saves_used ON saves (used_at)',
    'CREATE TABLE IF NOT EXISTS save_guesses (at TEXT NOT NULL)',
    'CREATE INDEX IF NOT EXISTS idx_save_guesses_at ON save_guesses (at)'
];

let schemaReady = false;

async function ensureSchema(db) {
    if (schemaReady) return;
    await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    schemaReady = true;
}

function getDb(env) {
    return env && env.FEEDBACK_DB ? env.FEEDBACK_DB : null;
}

function minutesAgo(min) {
    return new Date(Date.now() - min * 60000).toISOString();
}

// ─── Codes ───────────────────────────────────────────────────

function randomIndex(n) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n; // bias of 2^32 mod n is ~1e-7, irrelevant here
}

function newToken() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

function newCode() {
    return `${WORDS[randomIndex(WORDS.length)]}-${100 + randomIndex(900)}-${WORDS[randomIndex(WORDS.length)]}`;
}

/** "tiger 427 moon", "Tiger-427-Moon" and "TIGER427MOON" all mean TIGER-427-MOON. */
function parseCode(value) {
    if (typeof value !== 'string') return null;
    const m = value.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]{2,12})(\d{3})([A-Z]{2,12})$/);
    return m ? { first: m[1], num: m[2], last: m[3] } : null;
}

function editDistance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}

/** The one list word within two typos of `word`, or null when none (or several) are that close. */
function closestWord(word) {
    let best = null;
    let bestDist = 3;
    let tie = false;
    for (const w of WORDS) {
        const d = editDistance(word, w);
        if (d < bestDist) { best = w; bestDist = d; tie = false; } else if (d === bestDist) tie = true;
    }
    return best && !tie ? best : null;
}

/** { code } for a valid code, otherwise { error: Response } explaining what to fix. */
function checkCode(value) {
    const parts = parseCode(value);
    if (!parts) return { error: json({ ok: false, error: 'bad_code' }, 400) };
    const unknown = [parts.first, parts.last].find((w) => !WORD_SET.has(w));
    if (unknown) {
        const fix = (w) => (WORD_SET.has(w) ? w : closestWord(w));
        const first = fix(parts.first);
        const last = fix(parts.last);
        const suggestion = first && last ? `${first}-${parts.num}-${last}` : undefined;
        return { error: json({ ok: false, error: 'unknown_word', word: unknown, suggestion }, 400) };
    }
    return { code: `${parts.first}-${parts.num}-${parts.last}` };
}

// ─── Progress data ───────────────────────────────────────────

function isObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * The stored copy: the browser's progress blob with only the known parts (key order kept, so
 * the browser can tell its own save apart) and nothing that could name a child.
 */
function cleanData(data) {
    if (!isObject(data) || !isObject(data.pet)) return null;
    const copy = {};
    for (const key of Object.keys(data)) {
        if (!DATA_KEYS.includes(key)) continue; // e.g. this device's `cloud` link and `backup` reminders
        const value = data[key];
        copy[key] = LIST_CAPS[key] && Array.isArray(value) ? value.slice(-LIST_CAPS[key]) : value;
    }
    const petName = cleanText(data.pet.name, 40);
    copy.user = { ...(isObject(data.user) ? data.user : {}), nickname: 'Player' };
    copy.pet = { ...data.pet, name: petName && !looksPersonal(petName) ? petName : 'Unnamed' };
    return JSON.stringify(copy);
}

// ─── Abuse guards ────────────────────────────────────────────

/** Count this request as a guess and say whether the window is full. One batch = one transaction, so bursts can't slip past. */
async function tooManyGuesses(db) {
    const since = minutesAgo(GUESS_WINDOW_MIN);
    const results = await db.batch([
        db.prepare('INSERT INTO save_guesses (at) VALUES (?)').bind(new Date().toISOString()),
        db.prepare('DELETE FROM save_guesses WHERE at < ?').bind(since),
        db.prepare('SELECT COUNT(*) AS n FROM save_guesses WHERE at > ?').bind(since)
    ]);
    const row = results[2].results && results[2].results[0];
    return !!row && row.n > GUESS_MAX;
}

function notFound() {
    return json({ ok: false, error: 'not_found' }, 404);
}

// ─── Actions ─────────────────────────────────────────────────

async function create(db, body) {
    const data = cleanData(body.data);
    if (!data) return json({ ok: false, error: 'bad_data' }, 400);
    const recent = await db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)), 0) AS bytes FROM saves WHERE created_at > ?')
        .bind(minutesAgo(CREATE_WINDOW_MIN)).first();
    if (recent && (recent.n >= CREATE_MAX || recent.bytes + data.length > CREATE_BYTES_MAX)) {
        return json({ ok: false, error: 'busy' }, 429);
    }

    const now = new Date().toISOString();
    // Housekeeping rides along with new codes: forget codes nobody has used for a year
    const expired = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
    await db.prepare('DELETE FROM saves WHERE used_at < ?').bind(expired).run();

    for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const token = newToken();
        const r = await db.prepare(
            'INSERT OR IGNORE INTO saves (code, data, rev, created_at, updated_at, used_at, token) VALUES (?, ?, 1, ?, ?, ?, ?)'
        ).bind(code, data, now, now, now, token).run();
        if (r.meta && r.meta.changes === 1) return json({ ok: true, code, token, rev: 1, updated_at: now }, 201);
    }
    return json({ ok: false, error: 'server' }, 500);
}

async function load(db, code, row, body) {
    const now = Date.now();
    if (!(now - Date.parse(row.used_at) < TOUCH_AFTER_MS)) {
        await db.prepare('UPDATE saves SET used_at = ? WHERE code = ?').bind(new Date(now).toISOString(), code).run();
    }
    const out = { ok: true, code, token: row.token, rev: row.rev, updated_at: row.updated_at };
    if (body.rev !== row.rev) out.data = JSON.parse(row.data);
    return json(out);
}

async function update(db, code, body) {
    const data = cleanData(body.data);
    if (!data) return json({ ok: false, error: 'bad_data' }, 400);
    if (!Number.isInteger(body.rev)) return json({ ok: false, error: 'bad_request' }, 400);
    const now = new Date().toISOString();
    const saved = await db.prepare(
        'UPDATE saves SET data = ?, rev = rev + 1, updated_at = ?, used_at = ? WHERE code = ? AND rev = ? RETURNING rev, updated_at'
    ).bind(data, now, now, code, body.rev).first();
    if (saved) return json({ ok: true, rev: saved.rev, updated_at: saved.updated_at });
    const current = await db.prepare('SELECT rev, updated_at FROM saves WHERE code = ?').bind(code).first();
    if (!current) return notFound();
    return json({ ok: false, error: 'conflict', rev: current.rev, updated_at: current.updated_at }, 409);
}

async function remove(db, code) {
    const r = await db.prepare('DELETE FROM saves WHERE code = ?').bind(code).run();
    if (!r.meta || r.meta.changes === 0) return notFound();
    return json({ ok: true });
}

// ─── Entry point ─────────────────────────────────────────────

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = getDb(env);
    if (!db) return json({ ok: false, error: 'not_configured' }, 503);

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
    if (!body || typeof body !== 'object' || !ACTIONS.includes(body.action)) {
        return json({ ok: false, error: 'bad_request' }, 400);
    }

    try {
        await ensureSchema(db);
        if (body.action === 'create') return await create(db, body);

        const checked = checkCode(body.code);
        if (checked.error) return checked.error;
        const code = checked.code;
        const row = await db.prepare('SELECT data, rev, updated_at, used_at, token FROM saves WHERE code = ?').bind(code).first();
        const linked = !!row && typeof body.token === 'string' && body.token === row.token;
        if (!linked && await tooManyGuesses(db)) return json({ ok: false, error: 'busy' }, 429);
        if (!row) return notFound();
        if (body.action === 'load') return await load(db, code, row, body);
        if (body.action === 'update') return await update(db, code, body);
        return await remove(db, code);
    } catch (e) {
        console.error('save code request failed', body.action, e);
        return json({ ok: false, error: 'server' }, 500);
    }
}
