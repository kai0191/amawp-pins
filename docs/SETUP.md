# Tackly setup guide (no coding needed)

The website already works in **demo mode** (everything is saved in the visitor's browser and nothing is posted to Pinterest).
These steps switch on the real backend so people can sign up, connect Pinterest and schedule pins.
Everything here is on free plans. You never need a credit card.

Total time: about 20 minutes.

> **Never paste a key or secret into a file in the repository, an issue or a chat.** Secrets only go into the
> GitHub "Secrets" page (step 3). They are hidden there and cannot be read back.

---

## Step 1: Turn on GitHub Pages (1 minute)

The deploy workflow tries to do this for you. If the website link does not open, do it by hand:

1. Open <https://github.com/kai0191/amawp-pins/settings/pages>.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. That's it. Your website address is **<https://kai0191.github.io/amawp-pins/>**.

---

## Step 2: Make a Cloudflare API token (5 minutes)

1. Sign in at <https://dash.cloudflare.com>.
2. Top right, click your **profile icon → My Profile**.
3. In the left menu click **API Tokens**, then the blue **Create Token** button.
4. Find the **Edit Cloudflare Workers** template and click **Use template**.
5. Under **Permissions**, click **+ Add more** and add these rows, so the list includes:
   - Account → **Workers Scripts** → Edit (already there)
   - Account → **Workers KV Storage** → Edit (already there)
   - Account → **D1** → **Edit** ← *add this one, the template does not include it*
6. Under **Account Resources**: choose **Include → your account**.
7. Under **Zone Resources**: choose **Include → All zones** (the template needs this; Tackly does not change your sites).
8. Click **Continue to summary → Create Token**.
9. **Copy the token now** (it is shown only once). Keep this browser tab open for step 3.

### Find your Cloudflare Account ID

1. Go back to <https://dash.cloudflare.com> and click **Workers & Pages** in the left menu.
2. On the right side you will see **Account ID**. Click the copy icon next to it.

---

## Step 3: Add the secrets to GitHub (5 minutes)

1. Open <https://github.com/kai0191/amawp-pins/settings/secrets/actions>.
2. Click **New repository secret** for each row below. Type the **Name** exactly as shown and paste the value.

| Name | Value | Needed? |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | The token from step 2 | **Required** |
| `CLOUDFLARE_ACCOUNT_ID` | The Account ID from step 2 | **Required** |
| `PINTEREST_APP_ID` | Your Pinterest app's **App ID** (step 4) | Required for Pinterest |
| `PINTEREST_APP_SECRET` | Your Pinterest app's **App secret key** (step 4) | Required for Pinterest |
| `JWT_SECRET` | Any long random text, 40+ characters (use a password generator) | Recommended |
| `ENC_KEY` | A *different* long random text, 40+ characters | Recommended |

About `JWT_SECRET` and `ENC_KEY`: if you skip them, the server creates strong random ones by itself and keeps them
in your Cloudflare storage. If you do set them, **never change `ENC_KEY` later**, because the saved Pinterest
connections are locked with it and users would have to reconnect.

### Optional settings (the "Variables" tab, not secrets)

On the same page, click the **Variables** tab → **New repository variable**:

| Name | Value | What it does |
|---|---|---|
| `OWNER_EMAIL` | The email you sign up to Tackly with | Unlocks the **Owner** dashboard (users, connections, pins posted, waitlist) for you only |
| `CONTACT_EMAIL` | A support email address | Shown on the privacy, terms and data-deletion pages |
| `PINTEREST_SANDBOX` | `true` or `false` | Use `true` only while your Pinterest app has **Trial** access (see step 5) |

---

## Step 4: Deploy, then add the redirect URI in Pinterest (5 minutes)

1. Open <https://github.com/kai0191/amawp-pins/actions/workflows/deploy.yml> and click **Run workflow → Run workflow**.
2. Wait about 2 minutes until it shows a green tick. Click the run and scroll down to the **summary**. It shows:
   - your **Worker URL**, for example `https://tackly-api.YOUR-NAME.workers.dev`
   - the exact **redirect URI** to copy: `https://tackly-api.YOUR-NAME.workers.dev/api/pinterest/callback`
3. Open <https://developers.pinterest.com/apps/> and click your **AMAWP** app.
4. Find **Redirect URIs** (in the app's **Configure** section), paste the redirect URI from the summary, and click
   **Add**, then **Save**.
5. On the same page, copy the **App ID** and **App secret key**. If you have not yet added them in step 3, add them
   now, then run the workflow again (step 4.1).

Pinterest asks for these links during app review. They are already live:

- Website: <https://kai0191.github.io/amawp-pins/>
- Privacy policy: <https://kai0191.github.io/amawp-pins/#/privacy>
- Terms: <https://kai0191.github.io/amawp-pins/#/terms>
- Data deletion: <https://kai0191.github.io/amawp-pins/#/data-deletion>

---

## Step 5: Pinterest Trial vs Standard access

New Pinterest apps start with **Trial** access. With Trial access Pinterest only lets the app create pins in its
*sandbox*, and only the app owner can use it.

- **If your app shows Trial:** set the variable `PINTEREST_SANDBOX` to `true` (step 3) and run the workflow again.
  Pins are then created in Pinterest's sandbox (only visible to you), which is fine for testing.
- **To get Standard access** (so anyone can use Tackly and pins are public):
  1. Open your app on <https://developers.pinterest.com/apps/>.
  2. Click **Upgrade access** (or **Request standard access**).
  3. Pinterest asks for a short **screen recording**: sign in to Tackly, click **Accounts → Connect Pinterest**,
     approve, then design a pin and click **Save & schedule → Post now**, and show it on Pinterest.
  4. Fill in the form (use the website, privacy policy and data-deletion links above) and submit.
  5. When approved, set `PINTEREST_SANDBOX` to `false` (or delete the variable) and run the workflow again.

Since your AMAWP app is already approved for standard access, you can keep `PINTEREST_SANDBOX` unset.

---

## Step 6: Test it

1. Open <https://kai0191.github.io/amawp-pins/>. The yellow "Demo mode" banner should be gone.
2. Click **Start free** and sign up with the email you put in `OWNER_EMAIL`.
3. Go to **Accounts → Connect Pinterest** and approve.
4. Design a pin, click **Save & schedule**, pick a board and choose **Post now**. Check it on Pinterest.
5. Click **Owner** in the left menu to see users, connections, pins posted and the paid-plan waitlist.

---

## Free-plan limits (good to know)

Everything runs on free plans. These are the limits that matter, all far above what a new product needs:

| Service | Free limit | What uses it |
|---|---|---|
| Cloudflare Workers | 100,000 requests/day | Every page action |
| Cloudflare D1 | 5 GB, 5 million reads/day, 100,000 writes/day | Users, pins, schedules |
| Cloudflare KV | 1 GB, 1,000 writes/day | Pin images waiting to be posted (about 500 new pins a day) |
| Cron Triggers | 5 per account | Tackly uses 1 (every 5 minutes) |
| GitHub Pages + Actions | Free for public repositories | Website + deploys |

If you already have 5 cron triggers on your Cloudflare account, the deploy fails with a cron error. Remove an
unused one in **Workers & Pages → (worker) → Settings → Triggers**.

## Turning on paid plans later

Plans live in the `plans` table in D1 (Cloudflare → **Storage & Databases → D1 → tackly-db → Console**).
The free plan row says `max_accounts = 1`. The `pro` and `agency` rows are ready but switched off (`active = 0`).
To give one user Pro now, open the **Owner** dashboard and change their plan in the users table.

## Troubleshooting

- **Deploy is green but the site still says Demo mode:** open the latest Deploy run, check the summary shows a
  Worker URL. If it says "Backend not deployed yet", the Cloudflare secrets are missing or misspelled.
- **"Pinterest is not connected on this server yet":** `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET` are missing.
  Add them and run the workflow again.
- **Pinterest says the redirect URI is invalid:** the URI in the Pinterest app must match the one in the deploy
  summary exactly, including `/api/pinterest/callback`.
- **Error mentioning D1 permission:** the Cloudflare token is missing the **D1 → Edit** permission (step 2.5).
