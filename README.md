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
- 👨‍👩‍👧 **Profiles & backup** — Up to 4 kids per browser, with a Pet Passport save code for backup/restore
- 🏫 **Classroom links** — `pages/training.html?stage=N&min=M` / `pages/articles.html?article=ID&min=M` open a lesson with a countdown timer
- 🎓 **Certificates & report** — Printable certificates and a parent/teacher progress report
- 💬 **Feedback** — Kid-friendly feedback form (💬 in the nav, or `/feedback.html`) with a private inbox at `/admin/feedback.html`
- 🔒 **Privacy** — All progress in localStorage; the only thing ever sent is feedback someone chooses to submit (no names, no IPs)
- 🌙 **Dark Mode** — Easy on the eyes for longer sessions

## Tech Stack

- Pure HTML/CSS/JS (no framework)
- localStorage for all progress data
- One Cloudflare Pages Function (`functions/api/feedback.js`) + a Cloudflare D1 database, for feedback only
- Responsive design (desktop, tablet, mobile)
- Hosted on Cloudflare Pages

## Development

```bash
# Local preview
python3 -m http.server 5007
# or
npx serve .
```

A plain static server has no `/api/feedback`, so the feedback form shows "couldn't send". To run the feedback API locally (with a throwaway local D1 database):

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
│   ├── dashboard.html  # Stats, achievements, Pet Passport backup
│   └── report.html     # Printable parent/teacher report & certificates
├── 404.html            # Friendly not-found page (served with 404 status by Pages)
├── feedback.html       # Standalone feedback form (linked from footers)
├── admin/
│   └── feedback.html   # Private feedback inbox (needs FEEDBACK_ADMIN_TOKEN)
├── functions/
│   └── api/feedback.js # Pages Function: POST feedback, admin list/update/delete (D1)
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
├── js/                 # App JavaScript
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
