# Tackly owner setup (no coding needed)

Tackly has three parts:

| Part | Where it runs | Stores user data? |
|---|---|---|
| **Website** | GitHub Pages: <https://kai0191.github.io/amawp-pins/> | No (users' data stays in their own browser) |
| **Relay** (`worker/`) | **Your** Cloudflare (free) | **No.** Only anonymous safety counters (salted hash + timestamps, deleted after 2 days) and daily totals |
| **Engine** (`engine/`, optional) | **Each user's own** Cloudflare (free) | Yes, but in *their* account, not yours |

The relay holds your Pinterest app secret, handles "Connect Pinterest", and enforces the safety limit:
**max 10 pins per Pinterest account in any 24 hours, at least 10 minutes apart.** Users cannot bypass it: their
Pinterest tokens are sealed (encrypted) with your key, so they only work through your relay.

> **Never paste a key or secret into a file, an issue or a chat.** Secrets only go into GitHub's **Secrets** page.
> They are hidden there and cannot be read back. A secret scanner runs on every push and blocks accidental leaks.

Total time: about 20 minutes.

---

## Step 1: Turn on GitHub Pages (1 minute, required once)

1. Open <https://github.com/kai0191/amawp-pins/settings/pages>.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open <https://github.com/kai0191/amawp-pins/actions/workflows/deploy.yml> → **Run workflow → Run workflow**.
4. After about 2 minutes your site is live at **<https://kai0191.github.io/amawp-pins/>** (it works in preview mode until step 4).

---

## Step 2: Make a Cloudflare API token (5 minutes)

1. Sign in at <https://dash.cloudflare.com>.
2. Top right: **profile icon → My Profile → API Tokens → Create Token**.
3. Find **Edit Cloudflare Workers** and click **Use template**.
4. Under **Permissions** click **+ Add more** so the list includes:
   - Account → **Workers Scripts** → Edit (already there)
   - Account → **Workers KV Storage** → Edit (already there)
   - Account → **D1** → **Edit** ← *add this one*
5. **Account Resources:** Include → your account. **Zone Resources:** Include → All zones.
6. **Continue to summary → Create Token**. **Copy the token now** (shown only once).
7. Your **Account ID**: dashboard home → **Workers & Pages** → right side, **Account ID** → copy.

---

## Step 3: Add secrets to GitHub (5 minutes)

Open <https://github.com/kai0191/amawp-pins/settings/secrets/actions> → **New repository secret** for each:

| Name | Value | Needed? |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Token from step 2 | **Required** |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from step 2 | **Required** |
| `PINTEREST_APP_ID` | Pinterest app **App ID** (step 5) | **Required** for Pinterest |
| `PINTEREST_APP_SECRET` | Pinterest app **App secret key** (step 5) | **Required** for Pinterest |
| `ENC_KEY` | Long random text, 40+ characters (use a password generator) | Strongly recommended |
| `JWT_SECRET` | A *different* long random text, 40+ characters | Strongly recommended |
| `ADMIN_KEY` | Another long random text (20+ characters) | To see owner stats in the app |
| `AMAWP_IMAGE_API_URL` | Your own free image API address (see below) | Optional |
| `AMAWP_IMAGE_API_KEY` | That API's key, if it needs one | Optional |

**Never change `ENC_KEY` later.** Every user's saved Pinterest connection is sealed with it; changing it means
everyone must reconnect Pinterest. If you skip `ENC_KEY`/`JWT_SECRET`, the relay creates strong random ones itself.

### Optional variables (the **Variables** tab on the same page)

| Name | Value | What it does |
|---|---|---|
| `CONTACT_EMAIL` | Support email | Shown on privacy, terms and data-deletion pages |
| `AMAWP_IMAGE_NAME` | e.g. `AMAWP free images` | Name of your image library in the app |
| `PINTEREST_SANDBOX` | `true` / `false` | `true` only while your Pinterest app has **Trial** access |
| `PINTEREST_EXTRA_SCOPES` | `ads:read` | Unlocks Pinterest's own keyword + trends data, **only if your Pinterest app is approved for `ads:read`**. Leave empty otherwise |

### Your own free image library (optional)

Set `AMAWP_IMAGE_API_URL` to any image search API that returns JSON. Use `{q}` and `{page}` where the search
words and page number go, e.g. `https://images.example.com/search?query={q}&page={page}` (otherwise Tackly adds
`?q=…&page=…`). Tackly understands the usual formats (`results`, `images`, `hits`, `photos`, `data` lists with
`url`/`src`/`full` + `thumb`/`thumbnail`). The key stays on Cloudflare and is never sent to browsers. The library
then shows up first in every image picker as **AMAWP free images**.

---

## Step 4: Deploy the relay and add the Pinterest redirect URI

1. Actions → **Deploy → Run workflow**. Wait for the green tick (about 3 minutes).
2. Open the run and scroll to the **summary**. It shows your relay URL and the exact **redirect URI**, like
   `https://tackly-api.YOUR-NAME.workers.dev/api/pinterest/callback`.
3. Open <https://developers.pinterest.com/apps/> → your **AMAWP** app → **Redirect URIs** → paste it → **Add → Save**.

Links Pinterest asks for in app review (already live after step 1):

- Website: <https://kai0191.github.io/amawp-pins/>
- Privacy policy: <https://kai0191.github.io/amawp-pins/#/privacy>
- Terms: <https://kai0191.github.io/amawp-pins/#/terms>
- Data deletion: <https://kai0191.github.io/amawp-pins/#/data-deletion>

## Step 5: Pinterest Trial vs Standard access

- **Trial:** set the variable `PINTEREST_SANDBOX` to `true` and run Deploy again. Pins go to Pinterest's sandbox
  (visible only to you).
- **Standard** (public pins for everyone): on your app page click **Upgrade access**, record a short video
  (open Tackly → Accounts → Connect Pinterest → approve → design a pin → Save & schedule → Post now → show it on
  Pinterest), fill in the form with the links above, and submit. When approved, set `PINTEREST_SANDBOX` to `false`.

Your AMAWP app is already approved, so you can leave `PINTEREST_SANDBOX` unset.

## Step 6: Test

1. Open the site; the "Preview" banner should be gone.
2. **Accounts → Connect Pinterest**, approve, design a pin, **Save & schedule → Post now**, then check Pinterest.
3. **Settings → Owner stats**: enter `ADMIN_KEY` to see daily connects, pins published and errors (totals only).

---

## Free-plan limits on your Cloudflare (relay only)

| Service | Free limit | Relay usage |
|---|---|---|
| Workers | 100,000 requests/day | Connect, boards, publish, keyword lookups |
| D1 | 5 GB, 100,000 writes/day | ~2 small writes per published pin; counters auto-deleted |
| Cron | 5 per account | 1 (daily cleanup) |

Because users' pins, images and schedules live in their own browsers or their own Cloudflare engines, your usage
stays tiny even with many users. The 10-pins-a-day limit also caps relay traffic per Pinterest account.

## Users' own engines

Users set up their own engine from **Settings → Data home** (one-click "Deploy to Cloudflare"). Guides:
[ENGINE.md](ENGINE.md) and [MCP.md](MCP.md). You do nothing for this.

## Troubleshooting

- **Site still shows "Preview":** the Deploy summary must show a relay URL. If it says "Backend not deployed yet",
  the Cloudflare secrets are missing or misspelled.
- **"Pinterest connection is not switched on":** add `PINTEREST_APP_ID` and `PINTEREST_APP_SECRET`, then deploy again.
- **Pinterest says the redirect URI is invalid:** it must exactly match the one in the Deploy summary.
- **Error about D1 permission:** the Cloudflare token is missing **D1 → Edit**.
- **Deploy fails with a cron error:** you already use 5 cron triggers on your Cloudflare account; remove an unused one.
