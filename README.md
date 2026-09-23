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
- 🔒 **Privacy** — All data in localStorage, nothing sent anywhere
- 🌙 **Dark Mode** — Easy on the eyes for longer sessions

## Tech Stack

- Pure HTML/CSS/JS (no framework)
- localStorage for all progress data
- Responsive design (desktop, tablet, mobile)
- Hosted on Cloudflare Pages

## Development

```bash
# Local preview
python3 -m http.server 5007
# or
npx serve .
```

## Deployment

Deployed automatically by Cloudflare Pages via its GitHub integration — there is no build step or deploy script.

1. Preview locally (see above).
2. Commit and push / merge to `main`.
3. Cloudflare Pages picks up the push and publishes the repo root to [typepets.com](https://typepets.com). The "Cloudflare Pages" check on the commit shows the deploy status.

Pushes to other branches get a preview deployment on `*.typepets.pages.dev`.

Notes:
- `_redirects` holds a few short-link redirects (`/app`, `/play`, `/pages/`). There is intentionally **no** SPA catch-all (`/* /index.html 200`): every page is a real file, so unknown URLs get a real 404 from `404.html` instead of a "soft 404" homepage.
- Pages serves `404.html` with a 404 status for any missing URL, at any depth, so it only uses absolute paths (`/css/...`, `/img/...`).
- Production branch, build settings (none; output dir = root), and the custom domain are configured in the Cloudflare dashboard, not in this repo.

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
