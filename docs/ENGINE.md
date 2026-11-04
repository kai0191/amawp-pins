# Your own Tackly engine (free, on your Cloudflare account)

Tackly does not store your pins on AMAWP's servers. By default they stay in your browser. The **Tackly engine** is a
small program that runs on **your own free Cloudflare account** and gives you:

- **24/7 posting:** scheduled pins post even when Tackly is closed.
- **Sync:** the same pins on your laptop and phone.
- **AI assistants:** connect Claude, ChatGPT, Codex, Cursor and more (MCP).
- **Your data in your account:** pins, images and your Pinterest connection live in your Cloudflare. Delete them any time.

It uses Cloudflare's free plan: 1 Worker, 1 D1 database, 1 KV namespace and 1 of your 5 free cron triggers.
No credit card needed.

---

## Option A: one-click deploy (recommended, about 5 minutes)

You need a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and a free [GitHub account](https://github.com/signup).

1. In Tackly, open **Settings → Data home** and copy the suggested **engine key** (or make up your own: 12+ random characters).
2. Click **Deploy to Cloudflare** in that section (or use
   [this link](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fkai0191%2Famawp-pins%2Ftree%2Fmain%2Fengine)).
3. Sign in to Cloudflare and GitHub when asked. Cloudflare copies the engine into a new repository in your GitHub
   account and creates the database and storage automatically.
4. When it asks for **ENGINE_KEY**, paste your engine key.
5. Click **Deploy**. When it finishes, copy your engine address, which looks like
   `https://tackly-engine.YOUR-NAME.workers.dev`.
6. Back in Tackly → **Settings → Data home**, paste the address and the key, then click **Connect my engine**.
   Tackly offers to copy the pins already in your browser to the engine.
7. Go to **Accounts** and connect Pinterest again. The connection is now stored in your engine.

## Option B: no GitHub (paste the code in the Cloudflare dashboard)

1. Download the engine file: <https://kai0191.github.io/amawp-pins/engine/tackly-engine.js>.
2. In the [Cloudflare dashboard](https://dash.cloudflare.com) open **Workers & Pages → Create → Create Worker**, name it
   `tackly-engine`, click **Deploy**, then **Edit code**. Delete the sample code, paste the whole downloaded file, and click **Deploy**.
3. **Storage & Databases → D1 → Create database**, name it `tackly-engine-db`.
4. **Storage & Databases → KV → Create namespace**, name it `tackly-engine-kv`.
5. Open your worker → **Settings → Bindings → Add**:
   - **D1 database**: variable name `DB`, database `tackly-engine-db`.
   - **KV namespace**: variable name `KV`, namespace `tackly-engine-kv`.
6. **Settings → Variables and Secrets → Add**: type **Secret**, name `ENGINE_KEY`, value = your engine key.
7. **Settings → Trigger events → Add → Cron triggers**: `*/5 * * * *` (every 5 minutes).
8. Copy the worker address from the top of the page and connect it in Tackly (step 6 above).

The engine creates its tables by itself the first time it runs.

---

## Good to know

- **Keep your engine key private.** Anyone with it can manage your engine. Tackly saves it only in your browser.
- **Safety limit:** your engine publishes through the Tackly relay, which allows at most **10 pins per Pinterest
  account in any 24 hours**, at least 10 minutes apart. Extra pins wait for the next safe slot automatically.
- **Updating:** with option A, Cloudflare redeploys when the copy in your GitHub account changes. You can sync it
  with the original repository from GitHub ("Sync fork"). With option B, paste the latest file again.
- **Deleting:** remove the worker, the `tackly-engine-db` database and the KV namespace in the Cloudflare dashboard.
- **AI assistants:** see [MCP.md](MCP.md).
