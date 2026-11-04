# Tackly by AMAWP

**Free Pinterest pin designer + scheduler.** Premium 2:3 pin templates, a brand kit, free AI copy and images,
bulk creation and natural auto-scheduling. Free forever for one Pinterest account.

- Live site: <https://kai0191.github.io/amawp-pins/>
- Owner setup (click by click): [docs/SETUP.md](docs/SETUP.md)
- Competitor research: [docs/competitors.md](docs/competitors.md)

## Features

- **Pin designer:** 18 free templates plus 3 Pro previews, all 1000×1500: photo + headline, blog classic, centre card, checklist,
  numbered steps, before/after, this-vs-that, top 3, cheat sheet, 2/3/4-photo collages, quote, big number,
  product spotlight, recipe card, infographic and big listicle. Also 12 palettes, 11 Google Font pairings, overlay/zoom/position/filter
  controls and PNG export, all rendered on a canvas in the browser.
- **Images:** upload, image link, free stock search (Openverse, no key; optional Unsplash/Pexels/Pixabay keys), and
  free AI images via Pollinations.ai, or your own OpenAI-compatible image API.
- **AI copy:** titles, keyword-rich descriptions (no hashtags), alt text, headline ideas, list items and board ideas.
  Uses free Pollinations by default, or your own OpenAI-compatible base URL, key and model (encrypted server-side).
- **Bulk mode:** paste `Title | link | image` lines or a CSV and generate many pins with rotating templates and palettes.
- **Scheduler:** calendar with drag-to-reschedule, a queue, drafts, post now, retries with backoff, failure reasons,
  a post log and Pinterest pin stats.
- **Auto-schedule:** pins-per-day range and active hours, or the "Best US peak times" preset. Times are random and
  natural, and the same link is spread across different boards and days.
- **Freemium-ready:** a `plans` table, server-side account limits, an upgrade screen with a waitlist that measures
  demand, and an owner dashboard.

## Architecture (free tiers only)

| Part | Tech |
|---|---|
| Website | Preact + Vite static SPA → GitHub Pages (`.github/workflows/deploy.yml`) |
| API | Cloudflare Worker (`worker/`), no framework |
| Database | Cloudflare D1 (`worker/migrations/`) |
| Pin images | Cloudflare KV (base64, deleted after posting) |
| Posting | Cron Trigger every 5 minutes → Pinterest API v5 `media_source.image_base64` |
| Auth | Email + password (PBKDF2-SHA256, 100k iterations), HS256 JWT, D1-based rate limits, "Continue with Pinterest" |
| Secrets | Pinterest tokens and AI keys encrypted with AES-256-GCM (`ENC_KEY`) |

Shared logic used by both the browser and the Worker lives in `shared/`: plans, the scheduler, timezones and AI prompts.

**Demo mode:** if the Worker is not deployed (no Cloudflare secrets yet), the site still deploys and runs fully in the
browser with a clear "Demo mode" banner. The deploy workflow skips the Worker step without failing.

## Develop

```bash
npm install
npm test                 # Worker tests: plan limits, crypto, scheduler, poster, API
npm run dev              # website on http://localhost:5173/amawp-pins/ (demo mode)
cp worker/.dev.vars.example worker/.dev.vars
npx wrangler d1 migrations apply DB --local --config worker/wrangler.toml
npm run worker:dev       # API on http://localhost:8787
```

Open the site with `?api=http://localhost:8787` to use the local API, or `?api=demo` to force demo mode
(`?api=reset` clears the override).

Tackly is an independent product by AMAWP and is not affiliated with Pinterest, Inc.
