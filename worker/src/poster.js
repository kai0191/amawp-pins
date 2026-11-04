// Posts due pins to Pinterest. Runs from the Cron Trigger and from "Post now".
import { randomId } from './lib/crypto.js';
import { createPin, withAccount } from './pinterest.js';
import { backoffMs, MAX_ATTEMPTS } from '../../shared/scheduler.js';

const BATCH = 10;            // pins per cron run (keeps us far under Pinterest rate limits)
const PER_ACCOUNT = 3;       // max pins per account per run
const STALE_LOCK_MS = 15 * 60000;
export const IMAGE_TTL_SECONDS = 200 * 24 * 3600;

export const imageKey = (pinId) => `img:${pinId}`;

async function log(env, pin, ok, message) {
  await env.DB.prepare('INSERT INTO post_log (id, pin_id, user_id, at, ok, message) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(randomId('log_'), pin.id, pin.user_id, Date.now(), ok ? 1 : 0, String(message || '').slice(0, 500)).run();
}

function friendlyError(e) {
  const s = e.status;
  if (s === 401) return 'Pinterest rejected the login. Please reconnect your Pinterest account.';
  if (s === 403) return `Pinterest refused this pin (403): ${e.message}`;
  if (s === 404) return 'The board was not found. It may have been deleted on Pinterest.';
  if (s === 429) return 'Pinterest rate limit reached. We will retry automatically.';
  if (s >= 500) return `Pinterest is having trouble (${s}). We will retry automatically.`;
  return e.message || 'Unknown error';
}

/** Post one pin that is already locked (status = 'posting'). Returns the updated status info. */
export async function postPin(env, pin) {
  const now = Date.now();
  const fail = async (message, permanent, retryAfterSec = 0) => {
    const attempts = (pin.attempts || 0) + 1;
    if (permanent || attempts >= MAX_ATTEMPTS) {
      await env.DB.prepare(`UPDATE pins SET status='failed', attempts=?, last_error=?, locked_at=NULL, updated_at=? WHERE id=?`)
        .bind(attempts, message, now, pin.id).run();
      await log(env, pin, false, message);
      return { status: 'failed', error: message };
    }
    const next = now + Math.max(backoffMs(attempts), retryAfterSec * 1000);
    await env.DB.prepare(`UPDATE pins SET status='scheduled', attempts=?, last_error=?, next_attempt_at=?, locked_at=NULL, updated_at=? WHERE id=?`)
      .bind(attempts, message, next, now, pin.id).run();
    await log(env, pin, false, `${message} (retry ${attempts}/${MAX_ATTEMPTS - 1})`);
    return { status: 'scheduled', error: message, nextAttemptAt: next };
  };

  const account = await env.DB.prepare('SELECT * FROM pinterest_accounts WHERE id = ? AND user_id = ?')
    .bind(pin.account_id, pin.user_id).first();
  if (!account) return fail('No connected Pinterest account for this pin.', true);
  if (!pin.board_id) return fail('Pick a board for this pin.', true);
  const image = await env.KV.get(imageKey(pin.id));
  if (!image) return fail('The pin image has expired or is missing. Please re-create the pin.', true);

  try {
    const res = await withAccount(env, account, (token) => createPin(env, token, {
      boardId: pin.board_id, title: pin.title, description: pin.description,
      link: pin.link, altText: pin.alt_text, imageBase64: image, contentType: 'image/jpeg',
    }));
    await env.DB.prepare(`UPDATE pins SET status='posted', posted_at=?, pinterest_pin_id=?, last_error=NULL, locked_at=NULL, updated_at=? WHERE id=?`)
      .bind(now, res && res.id ? String(res.id) : null, now, pin.id).run();
    await env.KV.delete(imageKey(pin.id));
    await log(env, pin, true, `Posted${res && res.id ? ` as pin ${res.id}` : ''}`);
    return { status: 'posted', pinterestPinId: res && res.id };
  } catch (e) {
    const s = e.status;
    if (s === 401) {
      await env.DB.prepare(`UPDATE pinterest_accounts SET status='reconnect' WHERE id=?`).bind(account.id).run();
      return fail(friendlyError(e), true);
    }
    const permanent = s >= 400 && s < 500 && s !== 408 && s !== 429;
    return fail(friendlyError(e), permanent, e.retryAfter || (s === 429 ? 900 : 0));
  }
}

/** Atomically claim a pin for posting. */
export async function lockPin(env, pinId, { allowDraft = false } = {}) {
  const now = Date.now();
  const statuses = allowDraft ? "('scheduled','draft','failed')" : "('scheduled')";
  const r = await env.DB.prepare(`UPDATE pins SET status='posting', locked_at=? WHERE id=? AND status IN ${statuses}`)
    .bind(now, pinId).run();
  return (r.meta?.changes ?? r.changes ?? 0) > 0;
}

export async function runDuePins(env, now = Date.now()) {
  await env.DB.prepare(`UPDATE pins SET status='scheduled', locked_at=NULL WHERE status='posting' AND locked_at < ?`)
    .bind(now - STALE_LOCK_MS).run();
  const { results } = await env.DB.prepare(
    `SELECT * FROM pins WHERE status='scheduled' AND next_attempt_at <= ? ORDER BY next_attempt_at ASC LIMIT ?`,
  ).bind(now, BATCH * 3).all();
  const perAccount = new Map();
  const out = [];
  for (const pin of results || []) {
    if (out.length >= BATCH) break;
    const n = perAccount.get(pin.account_id) || 0;
    if (n >= PER_ACCOUNT) continue;
    if (!(await lockPin(env, pin.id))) continue;
    perAccount.set(pin.account_id, n + 1);
    out.push({ id: pin.id, ...(await postPin(env, pin)) });
  }
  return out;
}
