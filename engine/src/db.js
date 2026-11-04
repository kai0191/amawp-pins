// Engine database (lives in the USER's own Cloudflare D1). Creates its tables on first use, so the engine
// also works when pasted into the Cloudflare dashboard without running migrations.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, username TEXT, profile_image TEXT, sealed TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS pins (
    id TEXT PRIMARY KEY, account_id TEXT, board_id TEXT, board_name TEXT, title TEXT, description TEXT, link TEXT,
    alt_text TEXT, keyword TEXT, template_id TEXT, batch_id TEXT, thumb TEXT, image_url TEXT, design_json TEXT,
    source TEXT, status TEXT NOT NULL DEFAULT 'draft', scheduled_at INTEGER, next_attempt_at INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, posted_at INTEGER, pinterest_pin_id TEXT, locked_at INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_pins_due ON pins (status, next_attempt_at)`,
  `CREATE INDEX IF NOT EXISTS idx_pins_sched ON pins (scheduled_at)`,
  `CREATE TABLE IF NOT EXISTS post_log (id TEXT PRIMARY KEY, pin_id TEXT, at INTEGER NOT NULL, ok INTEGER NOT NULL, message TEXT)`,
];

let ready = null;
export function ensureSchema(env) {
  if (!ready) ready = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { ready = null; throw e; });
  return ready;
}
export function _resetSchemaMemo() { ready = null; }

export async function getSetting(env, k, fallback = null) {
  const r = await env.DB.prepare('SELECT v FROM settings WHERE k = ?').bind(k).first();
  if (!r) return fallback;
  try { return JSON.parse(r.v); } catch { return fallback; }
}
export async function setSetting(env, k, v) {
  await env.DB.prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, JSON.stringify(v)).run();
}

export function rid(prefix) {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return prefix + [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

export const PIN_COLS = `id, account_id, board_id, board_name, title, description, link, alt_text, keyword, template_id, batch_id, thumb,
  image_url, design_json, source, status, scheduled_at, next_attempt_at, attempts, last_error, posted_at, pinterest_pin_id, created_at, updated_at`;
