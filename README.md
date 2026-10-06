# TypePets 🐾

**Learn typing the fun way.**

Free online typing practice for kids ages 7–12. Finger training, bubble pop games, article typing, and a virtual pet that evolves as you improve.

🔗 **Live:** [typepets.com](https://typepets.com)

## Features

- ⌨️ **Finger Training** — 8-stage program from home row to full keyboard with color-coded keys
- 🫧 **Bubble Pop** — 20 levels of typing fun, from single letters to full words
- 📖 **Read & Type** — Practice with real articles about science, animals, and space
- 🐾 **Pet Evolution** — Grow a virtual pet from egg through 6 evolution stages
- 🎯 **Smart Difficulty** — Auto-adjusts to focus on weak keys
- 📊 **Dashboard** — Speed charts, accuracy heatmaps, and achievement badges
- 👨‍👩‍👧 **Profiles & save codes** — Up to 4 kids per browser. A short save code (`TIGER-427-MOON`) carries a player's progress to any computer and keeps it in sync; a Pet Passport backup file is the offline option
- 🏫 **Classroom links** — `pages/training.html?stage=N&min=M` / `pages/articles.html?article=ID&min=M` open a lesson with a countdown timer
- 🎓 **Certificates & report** — Printable certificates and a parent/teacher progress report
- 💬 **Feedback** — Kid-friendly feedback form (💬 in the nav, or `/feedback.html`) with a private inbox at `/admin/feedback.html`
- 🔒 **Privacy** — All progress in localStorage; the only things ever sent are feedback someone chooses to submit and, for players who get a save code, their progress without their name (no names, no IPs)
- 🌙 **Dark Mode** — Easy on the eyes for longer sessions

## Tech Stack

- Pure HTML/CSS/JS (no framework)
- localStorage for all progress data
- Two Cloudflare Pages Functions (`functions/api/feedback.js`, `functions/api/save.js`) + a Cloudflare D1 database, for feedback and save codes only
- Responsive design (desktop, tablet, mobile)
- Hosted on Cloudflare Pages

## Development

```bash
# Local preview
python3 -m http.server 5007
# or
npx serve .
```

A plain static server has no `/api/*`, so the feedback form shows "couldn't send" and save codes can't be made. To run both APIs locally (with a throwaway local D1 database):

```bash
npx wrangler pages dev . --d1 FEEDBACK_DB --binding FEEDBACK_ADMIN_TOKEN=dev-token
```

Then open http://localhost:8788 and use `dev-token` on `/admin/feedback.html`.

## Deployment

Deployed automatically by Cloudflare Pages via its GitHub integration — there is no build step or deploy script.

1. Preview locally (see above).
2. If you changed anything in `css/` or `js/`, run `python3 scripts/version-assets.py` (see below).
3. Commit and push / merge to `main`.
4. Cloudflare Pages picks up the push and publishes the repo root to [typepets.com](https://typepets.com). The "Cloudflare Pages" check on the commit shows the deploy status.

Pushes to other branches get a preview deployment on `*.typepets.pages.dev`.

### Cache busting for CSS and JS

Cloudflare tells browsers to cache CSS and JS for 4 hours, but HTML is revalidated on every visit. So every local `<link>`/`<script>` in the HTML carries a content hash, e.g. `../css/style.css?v=9d3e6722`. When a file changes, its URL changes and visitors get the new version on their next page load; unchanged files stay cached.

```bash
python3 scripts/version-assets.py          # restamp every HTML page after editing css/ or js/
python3 scripts/version-assets.py --check  # exits 1 if a stamp is stale
```

New pages need nothing special: link the files normally and run the script.

Notes:
- `_routes.json` limits Pages Functions to `/api/*`, so every other URL is served as a plain static file (no Function invocations, real 404s).
- `_redirects` holds a few short-link redirects (`/app`, `/play`, `/pages/`). There is intentionally **no** SPA catch-all (`/* /index.html 200`): every page is a real file, so unknown URLs get a real 404 from `404.html` instead of a "soft 404" homepage.
- Pages serves `404.html` with a 404 status for any missing URL, at any depth, so it only uses absolute paths (`/css/...`, `/img/...`).
- Production branch, build settings (none; output dir = root), and the custom domain are configured in the Cloudflare dashboard, not in this repo.

## Save codes

A kid presses **Get my save code** on the Stats page and gets a short code like `TIGER-427-MOON` (word, 3 digits, word). Typing it on the Home page (or the Stats page) of any computer loads that player's progress there. From then on, every linked computer saves to the code by itself about a second after each change, and checks it whenever a page opens:

- Newer progress from another computer, nothing unsaved here → it's loaded and the page reloads, but only if the kid hasn't typed or clicked on the page yet. Otherwise a small banner offers it ("Load it" / "Not now"); nothing pops up or reloads mid-game.
- Changes here only → they're sent up. Each save names the revision it replaces, and the browser notes what it sent, so a save whose reply got lost is recognised instead of looking like a conflict.
- Both changed → the kid picks which to keep (this computer or the save code). The prompt opens by itself only on Home and Stats; elsewhere it's the banner. Its choices ignore keys for a moment, so a key still held from typing can't pick. Nothing is merged or overwritten silently, and nothing is sent until they choose.
- Offline or server trouble never blocks play; progress stays local and goes up later.

The code is linked per player (`cloud` in that player's data, see `js/data.js`); `js/cloud-save.js` does the syncing and draws the UI; `functions/api/save.js` stores one row per code in D1 with a revision number for conflict checks. The player menu (top right, on every page) has "Load a code", which opens the load dialog right there, and shows this player's code or a link to get one. The Stats page has the full panel, a new player sees a "Played on another computer?" box on Home, and players without a code get a nudge on Home after a couple of sessions.

Privacy rules (the privacy policy describes these, so keep them in sync):
- The player's name is never stored: the browser leaves it out and the server blanks it again. A pet name that looks like an email or phone number is dropped. Because of that, a code typed in on a computer where the player still has the default name "Player" is followed by a "What's your name?" prompt; the answer stays on that computer.
- No IP addresses, cookies or device IDs. The code is random and not tied to anyone.
- "Stop saving online" on the Stats page deletes the row immediately. Codes not opened or saved for 12 months are deleted (housekeeping runs whenever a new code is made).
- Anyone who has a code can open and change that progress, like a game password. The words are short and easy to spell for 7–12 year olds, and no two are one typo apart, so a typo is always caught and the right code is suggested.

Guessing: 258 words × 900 numbers × 258 words ≈ 60 million codes. A computer already linked to a code holds a random token for it (from create/load) and is never slowed down. Every other request that names a code (typing a code on a new computer, or anyone guessing) counts as a guess site-wide; past 100 in 10 minutes they get "busy" (429). That caps anyone walking the code space at ~15,000 guesses a day, while linked computers, including "Stop saving online", keep working. The count is written and read in one D1 batch, so a burst of parallel requests can't slip past it.

Size: the server keeps only the known parts of progress (lists capped like the browser caps them) and refuses saves over 320 KB (the busiest possible player is ~200 KB). New codes are capped at 200 and 16 MB per 10 minutes site-wide. These caps stop accidents and floods from a single script. A determined attacker could still keep the guess cap full, which slows down typing codes in on new computers, or slowly grow the database. Adding a Cloudflare rate-limiting rule for `/api/*` (Security → WAF → Rate limiting rules, e.g. 20 requests per minute per IP) stops that at the edge without storing IPs, and is worth doing once save codes are in real use.

Setup: none beyond the feedback setup below. The save tables (`saves`, `save_guesses`) live in the same D1 database as feedback (`FEEDBACK_DB`) and are created on first use.

```bash
npx wrangler d1 execute typepets-feedback --remote --command "SELECT COUNT(*) AS codes, SUM(updated_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')) AS active_this_week FROM saves"
```

## Feedback

Users send feedback from the 💬 button in the app nav (it's in the ☰ menu on phones) or from `/feedback.html`, which the landing page, blog and 404 footers link to. The form has a 1–5 face rating, a topic (broken / idea / too hard or easy / love it / other) and a message. Each message also records the page, the browser and screen size, the country (from Cloudflare), and progress levels (sessions, average WPM and accuracy, training stage, bubble level). That makes it easy to spot patterns like "Bubble level 12 is too hard on Chromebooks".

Privacy rules (the privacy policy describes these, so keep them in sync):
- No player names, save data, IP addresses or cookies are stored.
- Emails and phone numbers that kids type into the message are redacted on the server before saving.
- The optional reply email sits behind the grown-up gate.
- A minimum fill time and a site-wide cap (60 messages per 10 minutes) keep out spam floods. The cap is site-wide, so one determined script could keep it full; if that ever happens, add a Cloudflare rate-limiting rule (Security → WAF → Rate limiting rules) for `POST /api/feedback`, e.g. 5 requests per minute per IP. It works at the edge, so no IP is stored. Rejected requests always get an error status (never a fake success), so a person always sees when their message didn't go through. Don't add a hidden "honeypot" field: browser autofill fills it and real feedback gets thrown away.

### One-time setup (Cloudflare dashboard)

1. **Create the database:** Storage & Databases → D1 → Create database, named e.g. `typepets-feedback` (or run `npx wrangler d1 create typepets-feedback`). The table is created automatically on first use.
2. **Bind it:** Workers & Pages → typepets → Settings → Bindings → Add → D1 database. Set the variable name to `FEEDBACK_DB` and pick `typepets-feedback`. Add it to Production, and to Preview too if preview deployments should accept feedback.
3. **Admin token:** Settings → Variables and Secrets → Add → type *Secret*, name `FEEDBACK_ADMIN_TOKEN`, value a long random string (e.g. `openssl rand -base64 32`). Keep it in your password manager.
4. **Redeploy:** bindings apply to new deployments, so push a commit or use Deployments → Retry deployment.

Until the binding exists, the form politely says it couldn't send, and nothing else on the site is affected.

### Reading feedback

Open https://typepets.com/admin/feedback.html and enter the admin token. The inbox shows totals, the average rating, counts by topic, ratings and page, and each message with its device and progress details. You can mark items done, archive or delete them, search, filter, and export to CSV. The page is static and public, but its data is only served to requests that carry the token.

For ad-hoc questions you can also query D1 directly:

```bash
npx wrangler d1 execute typepets-feedback --remote --command "SELECT category, COUNT(*) AS n, ROUND(AVG(rating), 1) AS avg_rating FROM feedback GROUP BY category"
```

## Structure

```
typepets/
├── index.html          # Landing/marketing page
├── pages/
│   ├── home.html       # App home (progress dashboard)
│   ├── training.html   # Finger training mode
│   ├── bubbles.html    # Bubble pop game
│   ├── articles.html   # Article typing mode
│   ├── pet.html        # Virtual pet
│   ├── dashboard.html  # Stats, achievements, save code + Pet Passport backup
│   └── report.html     # Printable parent/teacher report & certificates
├── 404.html            # Friendly not-found page (served with 404 status by Pages)
├── feedback.html       # Standalone feedback form (linked from footers)
├── admin/
│   └── feedback.html   # Private feedback inbox (needs FEEDBACK_ADMIN_TOKEN)
├── functions/
│   ├── _lib/http.js    # Helpers shared by the Functions (JSON replies, body limits, redaction)
│   ├── api/feedback.js # Pages Function: POST feedback, admin list/update/delete (D1)
│   └── api/save.js     # Pages Function: save codes (create / load / update / delete, D1)
├── favicon.ico
├── img/
│   ├── og-image.png    # 1200×630 social share image
│   ├── favicon.svg, apple-touch-icon.png
│   └── screens/        # Real app screenshots used on the landing page (WebP)
├── blog/
│   ├── index.html      # Blog listing
│   ├── teach-kids-touch-typing/
│   ├── best-free-typing-games-kids-2026/
│   ├── keyboard-finger-placement-guide/
│   ├── dance-mat-typing-alternative/
│   ├── typing-games-no-ads-no-login/
│   ├── chromebook-typing-practice/
│   └── typing-goals-by-grade/
├── css/
│   ├── style.css       # App styles
│   ├── landing.css     # Landing page styles
│   ├── blog.css        # Blog styles
│   ├── keyboard.css    # Keyboard visualization
│   ├── articles.css    # Article mode styles
│   └── pet.css         # Pet page styles
├── js/                 # App JavaScript (data.js = localStorage, cloud-save.js = save code sync)
├── privacy.html
├── terms.html
├── sitemap.xml
├── robots.txt
├── scripts/
│   └── version-assets.py # Stamps CSS/JS links with ?v=<content hash>
├── _routes.json        # Only /api/* runs as a Pages Function
└── _redirects          # Cloudflare Pages redirect rules
```

## Distribution checklist

Places to list TypePets. The owner submits these by hand; tick them off as they go in.

Have ready: a one-line pitch ("Free typing practice for kids 7–12, with finger-technique lessons, games, and a pet that grows as they practice. No login, no ads, progress stays on the device."), the screenshots in `img/screens/`, `img/og-image.png`, the privacy policy URL (https://typepets.com/privacy.html), and a contact email.

- [ ] **Freedom Homeschooling** ([freedomhomeschooling.com](https://www.freedomhomeschooling.com)): free-curriculum directory with a typing/keyboarding section. Suggest TypePets through their contact form.
- [ ] **Homeschool.com**: submit to their homeschool resources listings.
- [ ] **Techie Homeschool Mom**: directory of free tech and typing resources for homeschoolers; send a short pitch.
- [ ] **ISTE EdTech Index**: create a product listing (free, no login, no student data; covers keyboarding/digital literacy).
- [ ] **kidSAFE Seal Program** ([kidsafeseal.com](https://www.kidsafeseal.com)): apply for a kid-friendly/COPPA seal. This is a paid certification, so weigh cost against the trust badge.
- [ ] **Symbaloo**: publish a public "Keyboarding for kids" webmix that includes TypePets, and ask the curators of popular keyboarding webmixes to add it.
- [ ] **Public library "recommended sites for kids" lists**: email children's/teen librarians, starting with your local library system, with the pitch and privacy link.

## License

MIT
