# Tackly by AMAWP

**Free Pinterest pin designer, Pinterest SEO toolkit and scheduler.** Research keywords, design fresh 2:3 pins
(or upload Canva designs), score every pin for Pinterest SEO, connect AI assistants over MCP, and auto-schedule at
natural times with built-in anti-spam limits.

- Live site: <https://kai0191.github.io/amawp-pins/>
- Owner setup (click by click): [docs/SETUP.md](docs/SETUP.md)
- Users' own engine: [docs/ENGINE.md](docs/ENGINE.md) · AI assistants: [docs/MCP.md](docs/MCP.md)
- Competitor research: [docs/competitors.md](docs/competitors.md)

## Features

- **Pinterest SEO:** keyword research (Pinterest when available, Google and Bing autocomplete, AI), a 0–100 pin SEO
  score with fixes, a seasonal planner, a Rich Pins checker, keyword-rich board ideas and ranking tips.
- **Designer:** 21 templates at 1000×1500, 12 palettes, 11 Google Font pairings, brand kit, PNG export.
- **Images:** free stock photos (Openverse, optional Unsplash/Pexels/Pixabay keys, the optional AMAWP library),
  images from the user's own blog post, uploads, links, and AI (Pollinations or the user's own provider).
- **Bulk:** links, keywords or CSV → many pins; or upload Canva PNGs/.zip and let AI write the SEO copy.
- **Scheduler:** calendar with drag-to-reschedule, queue, drafts, natural auto-schedule, link spreading, retries.
- **Safety:** max **10 pins per Pinterest account per 24 hours**, 10+ minutes apart, enforced server-side.
- **AI assistants (MCP):** Claude, ChatGPT, Codex, Cursor… can research, design (with Tackly templates), score and schedule.
- **Privacy:** no sign-up, no user data on AMAWP's servers.

## Architecture (free tiers only)

| Part | Folder | Runs on | Data |
|---|---|---|---|
| Website (Preact + Vite SPA) | `frontend/` | GitHub Pages | Users' data in their browser (IndexedDB) |
| Relay | `worker/` | AMAWP's Cloudflare Worker + D1 | **No user data**: anonymous quota counters only |
| Engine (optional, per user) | `engine/` | The user's own Cloudflare (Worker + D1 + KV + cron) | That user's pins, images, sealed Pinterest token |
| Shared logic | `shared/` | Browser, relay and engine | Scheduler, limits, SEO, prompts, template catalogue |

Pinterest tokens are **sealed** (AES-256-GCM with the relay's `ENC_KEY`) and stored only in the user's data home.
Only the relay can open them, so every publish goes through the relay's safety limit.

## Develop

```bash
npm install
npm test                                   # relay, engine + MCP, SEO, scheduler, limits, crypto
npm run build && npm run preview           # website (add ?api=none for preview mode)
cp worker/.dev.vars.example worker/.dev.vars
npx wrangler d1 migrations apply DB --local --config worker/wrangler.toml
npm run worker:dev                         # relay on http://localhost:8787  (open the site with ?api=http://localhost:8787)
cd engine && cp .dev.vars.example .dev.vars && npx wrangler@4 dev --port 8788   # a user engine
node scripts/sync-engine-shared.mjs        # after editing shared/, refresh the engine's copy
node scripts/check-secrets.mjs             # the same secret scan CI runs
```

Tackly is an independent product by AMAWP and is not affiliated with Pinterest, Inc. or Canva Pty Ltd.
