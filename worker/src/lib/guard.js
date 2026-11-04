// Abuse protection helpers: per-IP rate limits, quotas, stats and SSRF-safe URL checks.
import { HttpError } from './http.js';
import { randomId } from './crypto.js';

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'local';
}

/** Fixed-window rate limit stored in D1. Throws 429 when exceeded. */
export async function rateLimit(env, key, limit, windowSec) {
  const win = Math.floor(Date.now() / (windowSec * 1000));
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`,
  ).bind(key, win).first();
  if (row && row.count > limit) throw new HttpError(429, 'Too many requests. Please wait a few minutes and try again.', 'RATE_LIMITED');
}

export async function bumpStat(env, metric, n = 1) {
  const day = new Date().toISOString().slice(0, 10);
  try {
    await env.DB.prepare(
      'INSERT INTO daily_stats (day, metric, n) VALUES (?, ?, ?) ON CONFLICT(day, metric) DO UPDATE SET n = daily_stats.n + excluded.n',
    ).bind(day, metric, n).run();
  } catch { /* stats must never break the request */ }
}

export async function accountHash(env, pinterestUserId, salt) {
  const data = new TextEncoder().encode(`${salt}|${pinterestUserId}`);
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Check + reserve a publish slot. Returns the reservation id. */
export async function reserveSlot(env, acct, { limit, gapMinutes, now = Date.now() }) {
  const { results } = await env.DB.prepare('SELECT at FROM post_quota WHERE acct = ? AND at > ? ORDER BY at ASC')
    .bind(acct, now - 86400000).all();
  const times = (results || []).map((r) => r.at);
  if (times.length >= limit) {
    const nextAt = times[0] + 86400000;
    throw new HttpError(429, `Daily safety limit reached: ${limit} pins per 24 hours for this Pinterest account. Next slot opens ${new Date(nextAt).toISOString()}.`, 'DAILY_LIMIT', { nextAt, used: times.length, limit });
  }
  const last = times[times.length - 1];
  if (last && now - last < gapMinutes * 60000) {
    const nextAt = last + gapMinutes * 60000;
    throw new HttpError(429, `Please space pins at least ${gapMinutes} minutes apart on one account. Try again in ${Math.ceil((nextAt - now) / 60000)} min.`, 'TOO_SOON', { nextAt, used: times.length, limit });
  }
  const id = randomId('q_');
  await env.DB.prepare('INSERT INTO post_quota (id, acct, at) VALUES (?, ?, ?)').bind(id, acct, now).run();
  return { id, used: times.length + 1, limit };
}

export async function releaseSlot(env, id) {
  await env.DB.prepare('DELETE FROM post_quota WHERE id = ?').bind(id).run();
}

export async function quotaFor(env, acct, limit, now = Date.now()) {
  const { results } = await env.DB.prepare('SELECT at FROM post_quota WHERE acct = ? AND at > ? ORDER BY at ASC')
    .bind(acct, now - 86400000).all();
  const times = (results || []).map((r) => r.at);
  return { used: times.length, limit, remaining: Math.max(0, limit - times.length), nextAt: times.length >= limit ? times[0] + 86400000 : null };
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|\[?f[cd]|metadata\.google)/i;
/** Only allow public http(s) URLs (no private IPs, no credentials, no odd ports). */
export function safePublicUrl(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch { throw new HttpError(400, 'That is not a valid link.', 'BAD_URL'); }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || PRIVATE_HOST.test(u.hostname) || (u.port && !['80', '443'].includes(u.port))) {
    throw new HttpError(400, 'Only public http(s) links are allowed.', 'BAD_URL');
  }
  return u;
}
