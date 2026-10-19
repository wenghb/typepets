/**
 * TypePets — weekly leaderboard API (Cloudflare Pages Function, served at /api/leaderboard)
 *
 * Players who join are ranked by the XP they earned from practice this week. Weeks start on
 * Monday at 00:00 UTC. Nobody types anything that ends up on the board: a leaderboard name is
 * two words from the lists below ("Speedy Otter"), picked from suggestions, and a row shows
 * only that name, the pet's stage and look (wardrobe item ids) and the week's XP.
 *
 * Every call is a POST with a JSON body:
 *
 *   { action: 'names' }                              → 200 { ok, names: [3 free names] }
 *   { action: 'join', name, species, look, scores }  → 201 { ok, id, token, name }
 *                                                      409 { error: 'name_taken' }
 *   { action: 'update', id, token, name?, species, look, scores } → 200 { ok, name }
 *                                                      409 { error: 'name_taken' } (rename only)
 *   { action: 'board', week: 'this' | 'last', id? }  → 200 { ok, week, next_week_at, last_final_at, rows, you, known? }
 *   { action: 'leave', id, token }                   → 200 { ok }
 *
 * `scores` is { 'YYYY-MM-DD' (a week's Monday): xp }. The browser works it out from the
 * sessions it already keeps, so it is the same on every computer a save code links. Only
 * this week counts, plus last week for WEEK_GRACE_HOURS after it ends (progress made offline
 * on Sunday can still land). A week's XP only ever goes up.
 *
 * An unknown `id` answers 404 { error: 'not_found' } (the player left, or the name expired);
 * a wrong token answers 403. Housekeeping (on every join and now and then on updates) deletes
 * players nobody updated for RETENTION_DAYS, and weeks older than last week.
 *
 * Binding: FEEDBACK_DB (D1), shared with feedback and save codes; tables are created on first use.
 *
 * Practice bots: while few kids are on this week's board, friendly bots fill it up to BOT_FILL
 * rows, so a new player has someone to pass. They're named "Robo <animal>", marked as bots on
 * the page, aren't stored anywhere, and "practice" through the week on a schedule seeded by the
 * week, so everyone sees the same numbers. Each real player on the board sends one bot away.
 *
 * Privacy: no IP address, cookie, player name, pet name or free text is stored. The id and
 * token are random and only tie a browser to its own row.
 *
 * Honesty: the server can't watch anyone type, so a determined grown-up with developer tools
 * could send made-up XP. XP_MAX keeps out absurd numbers; a row can be removed by hand (see
 * README "Leaderboard").
 */

import { json, readBodyCapped, sameOrigin } from '../_lib/http.js';

// Friendly words for 7–12 year olds. Every adjective works with every noun, and none of the
// pairs can be read as unkind. Changing a word renames nobody (names are stored whole), but
// a removed word can no longer be picked.
const ADJECTIVES = [
    'Brave', 'Bright', 'Bouncy', 'Breezy', 'Bubbly', 'Calm', 'Cheery', 'Clever', 'Cosmic', 'Cozy',
    'Cuddly', 'Curious', 'Daring', 'Dashing', 'Dreamy', 'Eager', 'Fancy', 'Fearless', 'Fluffy',
    'Friendly', 'Frosty', 'Fuzzy', 'Gentle', 'Giggly', 'Glowing', 'Golden', 'Grand', 'Groovy',
    'Happy', 'Helpful', 'Hoppy', 'Jazzy', 'Jolly', 'Jumpy', 'Kind', 'Lively', 'Lucky', 'Magic',
    'Merry', 'Mighty', 'Misty', 'Nimble', 'Noble', 'Peppy', 'Perky', 'Plucky', 'Polite', 'Quick',
    'Quiet', 'Rapid', 'Rosy', 'Shiny', 'Silly', 'Sleepy', 'Snappy', 'Snowy', 'Sparkly', 'Speedy',
    'Spotty', 'Starry', 'Sunny', 'Super', 'Swift', 'Tiny', 'Turbo', 'Wiggly', 'Witty', 'Zippy',
    'Bold', 'Brilliant', 'Busy', 'Chirpy', 'Comfy', 'Crafty', 'Dapper', 'Dazzling', 'Gleaming',
    'Glittery', 'Graceful', 'Hearty', 'Joyful', 'Marvelous', 'Mellow', 'Nifty', 'Patient', 'Peaceful',
    'Playful', 'Radiant', 'Royal', 'Snazzy', 'Spiffy', 'Splendid', 'Steady', 'Stellar', 'Sturdy',
    'Tidy', 'Trusty', 'Twinkly', 'Vivid', 'Wise'
];
const NOUNS = [
    'Otter', 'Panda', 'Koala', 'Fox', 'Owl', 'Penguin', 'Puffin', 'Dolphin', 'Turtle', 'Tiger',
    'Lion', 'Llama', 'Alpaca', 'Bunny', 'Kitten', 'Puppy', 'Hedgehog', 'Hamster', 'Beaver',
    'Badger', 'Moose', 'Walrus', 'Seal', 'Narwhal', 'Octopus', 'Starfish', 'Seahorse', 'Crab',
    'Gecko', 'Iguana', 'Frog', 'Newt', 'Duckling', 'Goose', 'Swan', 'Robin', 'Parrot', 'Toucan',
    'Flamingo', 'Peacock', 'Falcon', 'Eagle', 'Raven', 'Bee', 'Ladybug', 'Butterfly', 'Firefly',
    'Cricket', 'Pony', 'Unicorn', 'Dragon', 'Dino', 'Yeti', 'Phoenix', 'Zebra', 'Giraffe', 'Hippo',
    'Rhino', 'Elephant', 'Camel', 'Kangaroo', 'Wombat', 'Platypus', 'Sloth', 'Lemur', 'Meerkat',
    'Raccoon', 'Squirrel', 'Chipmunk', 'Cheetah', 'Jaguar', 'Lynx', 'Wolf', 'Bear', 'Yak', 'Bison',
    'Orca', 'Whale', 'Manatee', 'Muffin', 'Cupcake', 'Pancake', 'Waffle', 'Noodle', 'Pickle',
    'Dumpling', 'Pretzel', 'Taco', 'Biscuit', 'Cookie', 'Mango', 'Peach', 'Kiwi', 'Coconut',
    'Popcorn', 'Bagel', 'Comet', 'Rocket', 'Meteor', 'Planet', 'Axolotl', 'Capybara', 'Chinchilla',
    'Corgi', 'Ferret', 'Gerbil', 'Hummingbird', 'Jellyfish', 'Kingfisher', 'Lobster', 'Mongoose',
    'Ocelot', 'Pelican', 'Quokka', 'Salamander', 'Stingray', 'Tadpole', 'Tortoise', 'Snowflake', 'Acorn'
];
const ADJECTIVE_SET = new Set(ADJECTIVES);
const NOUN_SET = new Set(NOUNS);

const ACTIONS = ['names', 'join', 'update', 'board', 'leave'];
const SPECIES = ['egg', 'baby', 'kid', 'teen', 'adult', 'master'];
const LOOK_SLOTS = ['color', 'pattern', 'hat', 'face', 'neck', 'place'];   // js/wardrobe.js SLOTS
const LOOK_ID_RE = /^[a-z0-9_]{1,24}$/;
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{16,40}$/;
const MAX_BODY_BYTES = 4 * 1024;
const XP_MAX = 1000000;              // far beyond a week of real practice; stops absurd numbers
const WEEK_MS = 7 * 86400000;
const WEEK_GRACE_HOURS = 48;         // last week still takes updates this long into the new one
const BOARD_SIZE = 25;
const BOT_FILL = 12;                 // bots fill this week's board up to this many rows
const BOT_XP_MIN = 30;               // a bot's week ends somewhere between these (spread evenly
const BOT_XP_MAX = 700;              // on a log scale): an easy-to-pass crowd for new players
const BOT_WARMUP = [5, 25];          // XP each bot starts the week with, so the board is never bare
const BOT_NAMES = ['Otter', 'Panda', 'Koala', 'Fox', 'Owl', 'Penguin', 'Puffin', 'Turtle', 'Llama',
    'Bunny', 'Hedgehog', 'Hamster', 'Gecko', 'Frog', 'Robin', 'Parrot'];
// Everyday wardrobe items only (js/wardrobe.js ids), so bots look like they're just getting started
const BOT_LOOKS = {
    color: ['classic', 'bubblegum', 'sky', 'mint', 'lemon', 'grape', 'tangerine', 'cherry', 'cocoa', 'snow'],
    pattern: ['none', 'none', 'belly', 'spots'],
    hat: ['none', 'none', 'party', 'beanie'],
    face: ['none', 'none', 'none', 'round'],
    neck: ['none', 'none', 'bell', 'bandana'],
    place: ['meadow', 'meadow', 'beach', 'sea']
};
const BOT_SPECIES = ['egg', 'baby', 'baby', 'kid', 'kid', 'teen'];
const RETENTION_DAYS = 60;           // a player's page sends something at least weekly while they visit
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
    `CREATE TABLE IF NOT EXISTS lb_scores (
        player_id TEXT NOT NULL,
        week TEXT NOT NULL,
        xp INTEGER NOT NULL,
        reached_at TEXT NOT NULL,
        PRIMARY KEY (player_id, week)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_lb_scores_week ON lb_scores (week, xp DESC, reached_at)'
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

// ─── Weeks ───────────────────────────────────────────────────

/** Monday (UTC) of the week holding `ms`, as YYYY-MM-DD. js/leaderboard.js has the same rule. */
function weekOf(ms) {
    const d = new Date(ms);
    const back = (d.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

function weeksNow(now) {
    const current = weekOf(now);
    const start = Date.parse(current + 'T00:00:00Z');
    return {
        current,
        last: weekOf(start - 1),
        lastOpen: now - start < WEEK_GRACE_HOURS * 3600000,
        lastFinal: new Date(start + WEEK_GRACE_HOURS * 3600000).toISOString(),
        next: new Date(start + WEEK_MS).toISOString()
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

/** [{ week, xp }] for the weeks that may still change, or null when `scores` is malformed. */
function cleanScores(scores, weeks) {
    if (!isObject(scores)) return null;
    const out = [];
    for (const [week, xp] of Object.entries(scores)) {
        if (!WEEK_RE.test(week)) return null;
        if (!Number.isInteger(xp) || xp < 0 || xp > XP_MAX) return null;
        // Other weeks (a wrong clock, a stale tab) are left alone, not an error
        if (xp > 0 && (week === weeks.current || (week === weeks.last && weeks.lastOpen))) out.push({ week, xp });
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

/** Upserts for a player's weeks. A player deleted meanwhile (left in another tab) gets no score. */
function scoreStatements(db, id, scores, now) {
    return scores.map((s) => db.prepare(
        `INSERT INTO lb_scores (player_id, week, xp, reached_at)
         SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM lb_players WHERE id = ?)
         ON CONFLICT (player_id, week) DO UPDATE SET xp = excluded.xp, reached_at = excluded.reached_at
         WHERE excluded.xp > lb_scores.xp`
    ).bind(id, s.week, s.xp, now, id));
}

/** Forget old weeks, players nobody has used for RETENTION_DAYS, and scores left without a player. */
async function housekeeping(db, weeks) {
    const expired = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
    await db.batch([
        db.prepare('DELETE FROM lb_scores WHERE week < ?').bind(weeks.last),
        db.prepare('DELETE FROM lb_players WHERE updated_at < ?').bind(expired),
        db.prepare('DELETE FROM lb_scores WHERE player_id NOT IN (SELECT id FROM lb_players)')
    ]);
}

function isUniqueError(e) {
    return /UNIQUE/i.test(String(e && e.message));
}

async function join(db, body, weeks) {
    const name = validName(body.name);
    const species = SPECIES.includes(body.species) ? body.species : null;
    const scores = cleanScores(body.scores, weeks);
    if (!name || !species || !scores) return json({ ok: false, error: 'bad_request' }, 400);

    const recent = await db.prepare('SELECT COUNT(*) AS n FROM lb_players WHERE created_at > ?')
        .bind(new Date(Date.now() - JOIN_WINDOW_MIN * 60000).toISOString()).first();
    if (recent && recent.n >= JOIN_MAX) return json({ ok: false, error: 'busy' }, 429);

    // Housekeeping rides along with new players (so freed names can be suggested again)
    await housekeeping(db, weeks);

    const id = randomId(18);
    const token = randomId(18);
    const now = new Date().toISOString();
    try {
        await db.batch([
            db.prepare('INSERT INTO lb_players (id, token, name, species, look, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .bind(id, token, name, species, JSON.stringify(cleanLook(body.look)), now, now),
            ...scoreStatements(db, id, scores, now)
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

async function update(db, body, weeks) {
    const species = SPECIES.includes(body.species) ? body.species : null;
    const scores = cleanScores(body.scores, weeks);
    const rename = body.name !== undefined;
    const name = rename ? validName(body.name) : null;
    if (!species || !scores || (rename && !name)) return json({ ok: false, error: 'bad_request' }, 400);

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
        results = await db.batch([player, ...scoreStatements(db, found.row.id, scores, now)]);
    } catch (e) {
        if (isUniqueError(e)) return json({ ok: false, error: 'name_taken' }, 409);
        throw e;
    }
    const row = results[0].results && results[0].results[0];
    if (!row) return json({ ok: false, error: 'not_found' }, 404); // left in the meantime
    if (randomIndex(HOUSEKEEPING_ODDS) === 0) await housekeeping(db, weeks);
    return json({ ok: true, name: row.name });
}

function parseLook(text) {
    try { return cleanLook(JSON.parse(text)); } catch (e) { return {}; }
}

/** A repeatable random number generator (mulberry32) seeded by a string. */
function seededRandom(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return function() {
        h = (h + 0x6D2B79F5) | 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * This week's practice bots as they stand at `now`. Every draw comes from the week's seed in a
 * fixed order, so a bot is the same all week and on every computer; only how far into the week
 * it is changes their XP. Each bot starts with a small warm-up and practices once on some days,
 * at a random time of day.
 */
function practiceBots(week, now, count) {
    const rand = seededRandom('typepets-bots-' + week);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const names = BOT_NAMES.slice();
    for (let i = names.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [names[i], names[j]] = [names[j], names[i]];
    }
    const daysIn = (now - Date.parse(week + 'T00:00:00Z')) / 86400000;
    const bots = [];
    for (let i = 0; i < BOT_FILL; i++) {
        const target = BOT_XP_MIN * Math.pow(BOT_XP_MAX / BOT_XP_MIN, rand());
        const warmup = BOT_WARMUP[0] + rand() * (BOT_WARMUP[1] - BOT_WARMUP[0]);
        const sessions = [];
        for (let day = 0; day < 7; day++) {
            const at = day + rand();                // any time of day: kids are in every time zone
            const weight = 0.5 + rand();
            if (rand() < 0.65) sessions.push({ at, weight });
        }
        if (!sessions.length) sessions.push({ at: 3.6, weight: 1 });
        const total = sessions.reduce((sum, x) => sum + x.weight, 0);
        const done = sessions.filter((x) => x.at <= daysIn).reduce((sum, x) => sum + x.weight, 0);
        const look = {};
        for (const slot of LOOK_SLOTS) look[slot] = pick(BOT_LOOKS[slot]);
        bots.push({ name: 'Robo ' + names[i], species: pick(BOT_SPECIES), look, xp: Math.round(warmup + target * done / total), bot: true });
    }
    return bots.slice(0, count);
}

async function board(db, body, weeks) {
    const week = body.week === 'last' ? weeks.last : weeks.current;
    const id = typeof body.id === 'string' && ID_RE.test(body.id) ? body.id : '';
    const [top, count, mine, exists] = await db.batch([
        db.prepare(
            `SELECT s.player_id, s.xp, p.name, p.species, p.look
             FROM lb_scores s JOIN lb_players p ON p.id = s.player_id
             WHERE s.week = ? AND s.xp > 0
             ORDER BY s.xp DESC, s.reached_at ASC LIMIT ?`
        ).bind(week, BOARD_SIZE),
        db.prepare('SELECT COUNT(*) AS n FROM lb_scores s JOIN lb_players p ON p.id = s.player_id WHERE s.week = ? AND s.xp > 0').bind(week),
        db.prepare(
            `SELECT s.xp, p.name, p.species, p.look,
                    (SELECT COUNT(*) FROM lb_scores o JOIN lb_players q ON q.id = o.player_id
                     WHERE o.week = s.week AND o.xp > s.xp) + 1 AS rank
             FROM lb_scores s JOIN lb_players p ON p.id = s.player_id
             WHERE s.week = ? AND s.player_id = ? AND s.xp > 0`
        ).bind(week, id),
        db.prepare('SELECT 1 AS yes FROM lb_players WHERE id = ?').bind(id)
    ]);

    const players = (top.results || []).map((r) => ({
        name: r.name,
        species: SPECIES.includes(r.species) ? r.species : 'egg',
        look: parseLook(r.look),
        xp: r.xp,
        you: !!id && r.player_id === id
    }));
    const real = count.results && count.results[0] ? count.results[0].n : 0;
    const bots = week === weeks.current
        ? practiceBots(week, Date.now(), Math.max(0, BOT_FILL - real)).filter((b) => b.xp > 0)
        : [];

    // Highest XP first; on equal XP, players before bots (and players in the order they got
    // there). Equal XP shares a rank (1, 2, 2, 4).
    const sorted = players.concat(bots).sort((a, b) => b.xp - a.xp || (a.bot ? 1 : 0) - (b.bot ? 1 : 0)).slice(0, BOARD_SIZE);
    const rows = [];
    for (const r of sorted) {
        const prev = rows[rows.length - 1];
        rows.push({ ...r, rank: prev && prev.xp === r.xp ? prev.rank : rows.length + 1 });
    }
    const m = mine.results && mine.results[0];
    const you = m ? {
        rank: m.rank + bots.filter((b) => b.xp > m.xp).length,
        name: m.name, species: m.species, look: parseLook(m.look), xp: m.xp
    } : null;
    const out = { ok: true, week, next_week_at: weeks.next, last_final_at: weeks.lastFinal, rows, you };
    // Whether the asking player still has a row, so a page can notice one that was removed
    if (id) out.known = !!(exists.results && exists.results.length);
    return json(out);
}

async function leave(db, body) {
    const found = await owned(db, body);
    if (found.error) return found.error;
    await db.batch([
        db.prepare('DELETE FROM lb_scores WHERE player_id = ?').bind(found.row.id),
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
        const weeks = weeksNow(Date.now());
        if (body.action === 'names') return await suggestNames(db);
        if (body.action === 'join') return await join(db, body, weeks);
        if (body.action === 'update') return await update(db, body, weeks);
        if (body.action === 'board') return await board(db, body, weeks);
        return await leave(db, body);
    } catch (e) {
        console.error('leaderboard request failed', body.action, e);
        return json({ ok: false, error: 'server' }, 500);
    }
}
