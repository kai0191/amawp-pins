import { HttpError } from './http.js';
import { verifyJwt, signJwt } from './crypto.js';
import { jwtSecret } from './secrets.js';
import { planFromRow, PLANS } from '../../../shared/plans.js';

export async function issueToken(env, user) {
  return signJwt({ sub: user.id, typ: 'session' }, await jwtSecret(env));
}

export async function optionalUser(request, env) {
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const payload = await verifyJwt(token, await jwtSecret(env));
  if (!payload || payload.typ !== 'session') return null;
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first();
}

export async function requireUser(request, env) {
  const user = await optionalUser(request, env);
  if (!user) throw new HttpError(401, 'Please sign in again.', 'UNAUTHORIZED');
  return user;
}

export function isAdmin(env, user) {
  const owners = (env.OWNER_EMAIL || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return !!user && owners.includes(String(user.email).toLowerCase());
}

export async function getPlan(env, planId) {
  const row = await env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(planId || 'free').first();
  return row ? planFromRow(row) : PLANS[planId] || PLANS.free;
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
  if (row && row.count > limit) {
    throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.', 'RATE_LIMITED');
  }
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'local';
}
