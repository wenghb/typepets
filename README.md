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
│   └── dashboard.html  # Stats & achievements
├── blog/
│   ├── index.html      # Blog listing
│   ├── teach-kids-touch-typing/
│   ├── best-free-typing-games-kids-2026/
│   └── keyboard-finger-placement-guide/
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
└── robots.txt
```

## License

MIT
