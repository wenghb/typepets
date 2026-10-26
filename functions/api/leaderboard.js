/**
 * TypePets — leaderboard API (Cloudflare Pages Function, served at /api/leaderboard)
 *
 * Players who join are ranked by the XP they earned from practice in the last DAYS days: today
 * (UTC) and the days before it. The window moves on one day at 00:00 UTC, so each day's XP
 * stays on the board for a full DAYS days. (It used to be a calendar week that started over on
 * Monday, which took a kid who joined on Sunday off the board the next day.) Nobody types
 * anything that ends up on the board: a kid builds their leaderboard name from two word lists
 * below ("Cosmic" + "Pancake"), and a row shows only that name, the pet's stage and look
 * (wardrobe item ids) and the XP.
 *
 * Every call is a POST with a JSON body:
 *
 *   { action: 'words' }                              → 200 { ok, first: [{ label, words }], second: [...] }
 *   { action: 'names' }                              → 200 { ok, names: [3 free names] }
 *   { action: 'check', name }                        → 200 { ok, free }
 *   { action: 'join', name, species, look, days }    → 201 { ok, id, token, name }
 *                                                      409 { error: 'name_taken' }
 *   { action: 'update', id, token, name?, species, look, days } → 200 { ok, name }
 *                                                      409 { error: 'name_taken' } (rename only)
 *   { action: 'board', id? }                         → 200 { ok, from, to, next_day_at, rows, you, known? }
 *   { action: 'leave', id, token }                   → 200 { ok }
 *
 * `days` is { 'YYYY-MM-DD' (a UTC day): xp }. The browser works it out from the sessions it
 * already keeps, so it is the same on every computer a save code links. Any day still on the
 * board takes updates (progress made offline can land up to DAYS days later). A day's XP only
 * ever goes up. Pages from before the switch sent weekly `scores` instead; those are ignored.
 *
 * An unknown `id` answers 404 { error: 'not_found' } (the player left, or the name expired);
 * a wrong token answers 403. Housekeeping (on every join and now and then on updates) deletes
 * players nobody updated for RETENTION_DAYS, and days that have left the board.
 *
 * Binding: FEEDBACK_DB (D1), shared with feedback and save codes; tables are created on first use.
 *
 * Privacy: no IP address, cookie, player name, pet name or free text is stored. The id and
 * token are random and only tie a browser to its own row.
 *
 * Honesty: the server can't watch anyone type, so a determined grown-up with developer tools
 * could send made-up XP. XP_MAX keeps out absurd numbers; a row can be removed by hand (see
 * README "Leaderboard").
 */

import { json, readBodyCapped, sameOrigin } from '../_lib/http.js';

// Friendly words for 7–12 year olds, in groups for the name picker: a name is one word from
// FIRST_WORDS and one from SECOND_WORDS ("Cosmic Pancake"). Kids build their own name from
// them, so every word has to be kind on its own and next to any other. Changing a word renames
// nobody (names are stored whole), but a removed word can no longer be picked.
const FIRST_WORDS = [
    { label: 'Fast and strong', words: [
        'Speedy', 'Swift', 'Quick', 'Rapid', 'Turbo', 'Zippy', 'Nimble', 'Dashing', 'Snappy',
        'Mighty', 'Super', 'Bold', 'Brave', 'Daring', 'Fearless', 'Plucky', 'Sturdy', 'Steady',
        'Noble', 'Royal', 'Grand', 'Trusty', 'Busy', 'Epic', 'Heroic'
    ] },
    { label: 'Happy and kind', words: [
        'Happy', 'Jolly', 'Merry', 'Cheery', 'Joyful', 'Peppy', 'Perky', 'Lively', 'Eager', 'Kind',
        'Friendly', 'Gentle', 'Helpful', 'Polite', 'Patient', 'Calm', 'Peaceful', 'Mellow',
        'Quiet', 'Wise', 'Clever', 'Witty', 'Curious', 'Lucky', 'Hearty', 'Chirpy', 'Sunny'
    ] },
    { label: 'Silly and cozy', words: [
        'Silly', 'Giggly', 'Wiggly', 'Bouncy', 'Hoppy', 'Jumpy', 'Bubbly', 'Playful', 'Groovy',
        'Jazzy', 'Snazzy', 'Spiffy', 'Nifty', 'Dapper', 'Fancy', 'Crafty', 'Cozy', 'Comfy',
        'Cuddly', 'Fluffy', 'Fuzzy', 'Sleepy', 'Tiny', 'Tidy', 'Spotty', 'Dreamy', 'Wobbly',
        'Squishy'
    ] },
    { label: 'Sparkly', words: [
        'Shiny', 'Sparkly', 'Glittery', 'Gleaming', 'Glowing', 'Dazzling', 'Brilliant', 'Radiant',
        'Bright', 'Vivid', 'Splendid', 'Marvelous', 'Magic', 'Cosmic', 'Starry', 'Stellar',
        'Twinkly', 'Snowy', 'Frosty', 'Misty', 'Breezy', 'Graceful', 'Mystic', 'Lunar'
    ] },
    { label: 'Colors', words: [
        'Golden', 'Rosy', 'Amber', 'Aqua', 'Coral', 'Crimson', 'Emerald', 'Indigo', 'Jade',
        'Lavender', 'Lilac', 'Lime', 'Minty', 'Ruby', 'Sapphire', 'Scarlet', 'Silver', 'Teal',
        'Violet', 'Copper', 'Rainbow', 'Pastel', 'Neon'
    ] }
];
const SECOND_WORDS = [
    { label: 'Cute critters', words: [
        'Bunny', 'Kitten', 'Puppy', 'Corgi', 'Hamster', 'Gerbil', 'Hedgehog', 'Chinchilla',
        'Ferret', 'Pony', 'Duckling', 'Goose', 'Alpaca', 'Llama', 'Otter', 'Panda', 'Koala',
        'Sloth', 'Quokka', 'Capybara', 'Raccoon', 'Squirrel', 'Chipmunk', 'Beaver', 'Badger',
        'Meerkat', 'Lemur', 'Wombat', 'Platypus', 'Mongoose', 'Bear'
    ] },
    { label: 'Wild animals', words: [
        'Tiger', 'Lion', 'Cheetah', 'Jaguar', 'Lynx', 'Ocelot', 'Wolf', 'Fox', 'Moose', 'Bison',
        'Yak', 'Zebra', 'Giraffe', 'Hippo', 'Rhino', 'Elephant', 'Camel', 'Kangaroo', 'Gecko',
        'Iguana', 'Frog', 'Newt', 'Salamander', 'Tadpole', 'Tortoise', 'Turtle', 'Panther',
        'Leopard', 'Gorilla'
    ] },
    { label: 'Sea creatures', words: [
        'Dolphin', 'Orca', 'Whale', 'Narwhal', 'Seal', 'Walrus', 'Manatee', 'Octopus', 'Jellyfish',
        'Starfish', 'Seahorse', 'Crab', 'Lobster', 'Stingray', 'Axolotl', 'Shark', 'Squid',
        'Clownfish', 'Pufferfish'
    ] },
    { label: 'Birds and bugs', words: [
        'Penguin', 'Puffin', 'Owl', 'Robin', 'Parrot', 'Toucan', 'Flamingo', 'Peacock', 'Falcon',
        'Eagle', 'Raven', 'Swan', 'Pelican', 'Kingfisher', 'Hummingbird', 'Bee', 'Ladybug',
        'Butterfly', 'Firefly', 'Cricket', 'Dragonfly', 'Beetle'
    ] },
    { label: 'Yummy food', words: [
        'Muffin', 'Cupcake', 'Pancake', 'Waffle', 'Noodle', 'Pickle', 'Dumpling', 'Pretzel',
        'Taco', 'Biscuit', 'Cookie', 'Mango', 'Peach', 'Kiwi', 'Coconut', 'Popcorn', 'Bagel',
        'Acorn', 'Donut', 'Sundae', 'Smoothie', 'Brownie', 'Burrito', 'Pudding', 'Sprinkle',
        'Croissant', 'Mochi', 'Churro', 'Blueberry', 'Cherry', 'Lemon', 'Melon'
    ] },
    { label: 'Space and magic', words: [
        'Comet', 'Rocket', 'Meteor', 'Planet', 'Snowflake', 'Unicorn', 'Dragon', 'Dino', 'Yeti',
        'Phoenix', 'Galaxy', 'Nebula', 'Astronaut', 'Moon', 'Star', 'Wizard', 'Knight', 'Ninja',
        'Pirate', 'Robot', 'Mermaid', 'Fairy', 'Griffin', 'Pegasus', 'Volcano', 'Tornado'
    ] }
];
const ADJECTIVES = FIRST_WORDS.flatMap((g) => g.words);
const NOUNS = SECOND_WORDS.flatMap((g) => g.words);
const ADJECTIVE_SET = new Set(ADJECTIVES);
const NOUN_SET = new Set(NOUNS);

const ACTIONS = ['words', 'names', 'check', 'join', 'update', 'board', 'leave'];
const SPECIES = ['egg', 'baby', 'kid', 'teen', 'adult', 'master'];
const LOOK_SLOTS = ['color', 'pattern', 'hat', 'face', 'neck', 'place'];   // js/wardrobe.js SLOTS
const LOOK_ID_RE = /^[a-z0-9_]{1,24}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{16,40}$/;
const MAX_BODY_BYTES = 4 * 1024;
const XP_MAX = 1000000;              // far beyond a day of real practice; stops absurd numbers
const DAY_MS = 86400000;
const DAYS = 7;                      // the board adds up today and the 6 days before it (js/leaderboard.js has the same)
const BOARD_SIZE = 25;
const RETENTION_DAYS = 60;           // a player's page sends something every day they visit
const HOUSEKEEPING_ODDS = 50;        // 1 in this many updates also tidies up
const JOIN_WINDOW_MIN = 10;
const JOIN_MAX = 60;                 // site-wide new players per window

const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS lb_players (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        name TEXT NOT NULL UNIQUE,
        species TEXT NOT NULL,
        look TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_lb_players_created ON lb_players (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_lb_players_updated ON lb_players (updated_at)',
    `CREATE TABLE IF NOT EXISTS lb_days (
        player_id TEXT NOT NULL,
        day TEXT NOT NULL,
        xp INTEGER NOT NULL,
        reached_at TEXT NOT NULL,
        PRIMARY KEY (player_id, day)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_lb_days_day ON lb_days (day)',
    // Weekly totals from before the board counted days (2026-10-26). They can't be split into
    // days, and every browser sends its days again on its next visit, so nothing is lost.
    'DROP TABLE IF EXISTS lb_scores'
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

// ─── Days ────────────────────────────────────────────────────

/** The UTC day holding `ms`, as YYYY-MM-DD. js/leaderboard.js has the same rule. */
function dayOf(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}

/** The days on the board now, oldest (`from`) to today (`to`), and when the next day starts. */
function windowNow(now) {
    const today = Date.parse(dayOf(now) + 'T00:00:00Z');
    return {
        from: dayOf(today - (DAYS - 1) * DAY_MS),
        to: dayOf(today),
        next: new Date(today + DAY_MS).toISOString()
    };
}

// ─── Input ───────────────────────────────────────────────────

function randomIndex(n) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
}

function randomId(bytes) {
    const b = new Uint8Array(bytes);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function validName(value) {
    if (typeof value !== 'string') return null;
    const parts = value.split(' ');
    return parts.length === 2 && ADJECTIVE_SET.has(parts[0]) && NOUN_SET.has(parts[1]) ? value : null;
}

/** The pet's look with only known slots and well-formed ids (the browser draws unknown ids as the default). */
function cleanLook(look) {
    const out = {};
    if (!isObject(look)) return out;
    for (const slot of LOOK_SLOTS) {
        if (typeof look[slot] === 'string' && LOOK_ID_RE.test(look[slot])) out[slot] = look[slot];
    }
    return out;
}

/** [{ day, xp }] for the days still on the board, or null when `days` is malformed. */
function cleanDays(days, win) {
    // A page from before the switch sends weekly `scores` and no `days`: its XP waits for a reload
    if (days === undefined) return [];
    if (!isObject(days)) return null;
    const out = [];
    for (const [day, xp] of Object.entries(days)) {
        if (!DAY_RE.test(day)) return null;
        if (!Number.isInteger(xp) || xp < 0 || xp > XP_MAX) return null;
        // Other days (a wrong clock, a stale tab) are left alone, not an error
        if (xp > 0 && day >= win.from && day <= win.to) out.push({ day, xp });
    }
    return out;
}

// ─── Actions ─────────────────────────────────────────────────

/** Three names nobody is using, picked at random. */
async function suggestNames(db) {
    const candidates = new Set();
    while (candidates.size < 12) candidates.add(`${ADJECTIVES[randomIndex(ADJECTIVES.length)]} ${NOUNS[randomIndex(NOUNS.length)]}`);
    const list = [...candidates];
    const taken = await db.prepare(`SELECT name FROM lb_players WHERE name IN (${list.map(() => '?').join(', ')})`)
        .bind(...list).all();
    const used = new Set((taken.results || []).map((r) => r.name));
    return json({ ok: true, names: list.filter((n) => !used.has(n)).slice(0, 3) });
}

/** Whether nobody has this name yet. */
async function checkName(db, body) {
    const name = validName(body.name);
    if (!name) return json({ ok: false, error: 'bad_request' }, 400);
    const row = await db.prepare('SELECT 1 AS yes FROM lb_players WHERE name = ?').bind(name).first();
    return json({ ok: true, free: !row });
}

/** Upserts for a player's days. A player deleted meanwhile (left in another tab) gets no score. */
function dayStatements(db, id, days, now) {
    return days.map((s) => db.prepare(
        `INSERT INTO lb_days (player_id, day, xp, reached_at)
         SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM lb_players WHERE id = ?)
         ON CONFLICT (player_id, day) DO UPDATE SET xp = excluded.xp, reached_at = excluded.reached_at
         WHERE excluded.xp > lb_days.xp`
    ).bind(id, s.day, s.xp, now, id));
}

/** Forget days off the board, players nobody has used for RETENTION_DAYS, and days left without a player. */
async function housekeeping(db, win) {
    const expired = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString();
    await db.batch([
        db.prepare('DELETE FROM lb_days WHERE day < ?').bind(win.from),
        db.prepare('DELETE FROM lb_players WHERE updated_at < ?').bind(expired),
        db.prepare('DELETE FROM lb_days WHERE player_id NOT IN (SELECT id FROM lb_players)')
    ]);
}

function isUniqueError(e) {
    return /UNIQUE/i.test(String(e && e.message));
}

async function join(db, body, win) {
    const name = validName(body.name);
    const species = SPECIES.includes(body.species) ? body.species : null;
    const days = cleanDays(body.days, win);
    if (!name || !species || !days) return json({ ok: false, error: 'bad_request' }, 400);

    const recent = await db.prepare('SELECT COUNT(*) AS n FROM lb_players WHERE created_at > ?')
        .bind(new Date(Date.now() - JOIN_WINDOW_MIN * 60000).toISOString()).first();
    if (recent && recent.n >= JOIN_MAX) return json({ ok: false, error: 'busy' }, 429);

    // Housekeeping rides along with new players (so freed names can be suggested again)
    await housekeeping(db, win);

    const id = randomId(18);
    const token = randomId(18);
    const now = new Date().toISOString();
    try {
        await db.batch([
            db.prepare('INSERT INTO lb_players (id, token, name, species, look, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .bind(id, token, name, species, JSON.stringify(cleanLook(body.look)), now, now),
            ...dayStatements(db, id, days, now)
        ]);
    } catch (e) {
        if (isUniqueError(e)) return json({ ok: false, error: 'name_taken' }, 409);
        throw e;
    }
    return json({ ok: true, id, token, name }, 201);
}

/** The player row for `body.id`, or { error: Response } when it's missing or the token is wrong. */
async function owned(db, body) {
    if (typeof body.id !== 'string' || !ID_RE.test(body.id) || typeof body.token !== 'string') {
        return { error: json({ ok: false, error: 'bad_request' }, 400) };
    }
    const row = await db.prepare('SELECT id, token, name FROM lb_players WHERE id = ?').bind(body.id).first();
    if (!row) return { error: json({ ok: false, error: 'not_found' }, 404) };
    if (row.token !== body.token) return { error: json({ ok: false, error: 'forbidden' }, 403) };
    return { row };
}

async function update(db, body, win) {
    const species = SPECIES.includes(body.species) ? body.species : null;
    const days = cleanDays(body.days, win);
    const rename = body.name !== undefined;
    const name = rename ? validName(body.name) : null;
    if (!species || !days || (rename && !name)) return json({ ok: false, error: 'bad_request' }, 400);

    const found = await owned(db, body);
    if (found.error) return found.error;
    const now = new Date().toISOString();
    const look = JSON.stringify(cleanLook(body.look));
    // Only a rename writes the name, so a background update can't put back the name it read
    const player = rename
        ? db.prepare('UPDATE lb_players SET name = ?, species = ?, look = ?, updated_at = ? WHERE id = ? RETURNING name').bind(name, species, look, now, found.row.id)
        : db.prepare('UPDATE lb_players SET species = ?, look = ?, updated_at = ? WHERE id = ? RETURNING name').bind(species, look, now, found.row.id);
    let results;
    try {
        results = await db.batch([player, ...dayStatements(db, found.row.id, days, now)]);
    } catch (e) {
        if (isUniqueError(e)) return json({ ok: false, error: 'name_taken' }, 409);
        throw e;
    }
    const row = results[0].results && results[0].results[0];
    if (!row) return json({ ok: false, error: 'not_found' }, 404); // left in the meantime
    if (randomIndex(HOUSEKEEPING_ODDS) === 0) await housekeeping(db, win);
    return json({ ok: true, name: row.name });
}

function parseLook(text) {
    try { return cleanLook(JSON.parse(text)); } catch (e) { return {}; }
}

// Each player's XP over the days on the board, ranked. Equal XP shares a rank (1, 2, 2, 4);
// within it, whoever got there first (their newest XP came in earliest) is listed first.
// Returns the top rows plus the asking player's row wherever it is.
const BOARD_SQL = `
    WITH totals AS (
        SELECT d.player_id, SUM(d.xp) AS xp, MAX(d.reached_at) AS reached_at
        FROM lb_days d JOIN lb_players p ON p.id = d.player_id
        WHERE d.day >= ? AND d.day <= ?
        GROUP BY d.player_id
    ), ranked AS (
        SELECT player_id, xp,
               RANK() OVER (ORDER BY xp DESC) AS rank,
               ROW_NUMBER() OVER (ORDER BY xp DESC, reached_at ASC, player_id) AS pos
        FROM totals WHERE xp > 0
    )
    SELECT r.player_id, r.xp, r.rank, r.pos, p.name, p.species, p.look
    FROM ranked r JOIN lb_players p ON p.id = r.player_id
    WHERE r.pos <= ? OR r.player_id = ?
    ORDER BY r.pos`;

async function board(db, body, win) {
    const id = typeof body.id === 'string' && ID_RE.test(body.id) ? body.id : '';
    const [ranked, exists] = await db.batch([
        db.prepare(BOARD_SQL).bind(win.from, win.to, BOARD_SIZE, id),
        db.prepare('SELECT 1 AS yes FROM lb_players WHERE id = ?').bind(id)
    ]);

    const rows = [];
    let you = null;
    for (const r of ranked.results || []) {
        const row = {
            rank: r.rank,
            name: r.name,
            species: SPECIES.includes(r.species) ? r.species : 'egg',
            look: parseLook(r.look),
            xp: r.xp
        };
        const mine = !!id && r.player_id === id;
        if (r.pos <= BOARD_SIZE) rows.push({ ...row, you: mine });
        if (mine) you = row;
    }
    const out = { ok: true, from: win.from, to: win.to, next_day_at: win.next, rows, you };
    // Whether the asking player still has a row, so a page can notice one that was removed
    if (id) out.known = !!(exists.results && exists.results.length);
    return json(out);
}

async function leave(db, body) {
    const found = await owned(db, body);
    if (found.error) return found.error;
    await db.batch([
        db.prepare('DELETE FROM lb_days WHERE player_id = ?').bind(found.row.id),
        db.prepare('DELETE FROM lb_players WHERE id = ?').bind(found.row.id)
    ]);
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
    if (!isObject(body) || !ACTIONS.includes(body.action)) return json({ ok: false, error: 'bad_request' }, 400);

    try {
        await ensureSchema(db);
        const win = windowNow(Date.now());
        if (body.action === 'words') return json({ ok: true, first: FIRST_WORDS, second: SECOND_WORDS });
        if (body.action === 'names') return await suggestNames(db);
        if (body.action === 'check') return await checkName(db, body);
        if (body.action === 'join') return await join(db, body, win);
        if (body.action === 'update') return await update(db, body, win);
        if (body.action === 'board') return await board(db, body, win);
        return await leave(db, body);
    } catch (e) {
        console.error('leaderboard request failed', body.action, e);
        return json({ ok: false, error: 'server' }, 500);
    }
}
