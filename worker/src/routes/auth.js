import { HttpError, json, readJson, str } from '../lib/http.js';
import { hashPassword, verifyPassword, randomId, encryptString, decryptString, maskKey } from '../lib/crypto.js';
import { issueToken, requireUser, isAdmin, getPlan, rateLimit, clientIp } from '../lib/auth.js';
import { encKey } from '../lib/secrets.js';
import { imageKey } from '../poster.js';
import { WAITLIST_FEATURES } from '../../../shared/plans.js';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export async function publicUser(env, user) {
  const plan = await getPlan(env, user.plan_id);
  const counts = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM pinterest_accounts WHERE user_id = ?1) AS accounts,
      (SELECT COUNT(*) FROM pins WHERE user_id = ?1 AND status = 'scheduled') AS scheduled,
      (SELECT COUNT(*) FROM pins WHERE user_id = ?1 AND status = 'posted') AS posted,
      (SELECT COUNT(*) FROM pins WHERE user_id = ?1 AND status = 'failed') AS failed,
      (SELECT COUNT(*) FROM pins WHERE user_id = ?1 AND status = 'draft') AS drafts`,
  ).bind(user.id).first();
  let settings = {};
  try { settings = JSON.parse(user.settings || '{}'); } catch { /* ignore */ }
  return {
    id: user.id, email: user.email, name: user.name, createdAt: user.created_at,
    plan, usage: counts, settings, isAdmin: isAdmin(env, user),
  };
}

export async function signup(request, env) {
  await rateLimit(env, `signup:${clientIp(request)}`, 8, 3600);
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address.', 'BAD_EMAIL');
  if (password.length < 8) throw new HttpError(400, 'Use at least 8 characters for your password.', 'WEAK_PASSWORD');
  if (password.length > 200) throw new HttpError(400, 'Password is too long.', 'BAD_PASSWORD');
  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) throw new HttpError(409, 'An account with this email already exists. Try signing in.', 'EMAIL_TAKEN');
  const now = Date.now();
  const tz = str(body.timezone, 64) || 'UTC';
  const user = {
    id: randomId('u_'), email, name: str(body.name, 80) || email.split('@')[0],
    password_hash: await hashPassword(password), plan_id: 'free',
    settings: JSON.stringify({ timezone: tz }), created_at: now, last_login_at: now,
  };
  await env.DB.prepare(
    'INSERT INTO users (id, email, name, password_hash, plan_id, settings, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(user.id, user.email, user.name, user.password_hash, user.plan_id, user.settings, user.created_at, user.last_login_at).run();
  return json({ token: await issueToken(env, user), user: await publicUser(env, user) }, 201);
}

export async function login(request, env) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  await rateLimit(env, `login:${clientIp(request)}`, 20, 900);
  await rateLimit(env, `login:${email}`, 10, 900);
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  const ok = user && user.password_hash && (await verifyPassword(String(body.password || ''), user.password_hash));
  if (!ok) throw new HttpError(401, 'Wrong email or password.', 'BAD_LOGIN');
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(Date.now(), user.id).run();
  return json({ token: await issueToken(env, user), user: await publicUser(env, user) });
}

export async function me(request, env) {
  const user = await requireUser(request, env);
  return json({ user: await publicUser(env, user) });
}

export async function updateSettings(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request, 1024 * 1024);
  let settings = {};
  try { settings = JSON.parse(user.settings || '{}'); } catch { /* ignore */ }
  const allowed = ['timezone', 'brandKit', 'autoSchedule', 'defaultBoardId', 'defaultAccountId', 'theme'];
  for (const k of allowed) if (k in body) settings[k] = body[k];
  const s = JSON.stringify(settings);
  if (s.length > 600 * 1024) throw new HttpError(413, 'Brand kit is too large. Use a smaller logo image.', 'TOO_LARGE');
  const name = 'name' in body ? str(body.name, 80) : user.name;
  await env.DB.prepare('UPDATE users SET settings = ?, name = ? WHERE id = ?').bind(s, name, user.id).run();
  return json({ user: await publicUser(env, { ...user, settings: s, name }) });
}

export async function changePassword(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  await rateLimit(env, `pw:${user.id}`, 10, 900);
  if (user.password_hash && !(await verifyPassword(String(body.current || ''), user.password_hash))) {
    throw new HttpError(401, 'Current password is wrong.', 'BAD_LOGIN');
  }
  if (String(body.next || '').length < 8) throw new HttpError(400, 'Use at least 8 characters.', 'WEAK_PASSWORD');
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(String(body.next)), user.id).run();
  return json({ ok: true });
}

export async function deleteMe(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(`SELECT id FROM pins WHERE user_id = ? AND status != 'posted'`).bind(user.id).all();
  for (const p of results || []) await env.KV.delete(imageKey(p.id));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pins WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM post_log WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM pinterest_accounts WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM waitlist WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return json({ ok: true, deleted: true });
}

export async function exportMe(request, env) {
  const user = await requireUser(request, env);
  const pins = await env.DB.prepare(
    'SELECT id, title, description, link, board_name, status, scheduled_at, posted_at, pinterest_pin_id FROM pins WHERE user_id = ?',
  ).bind(user.id).all();
  const accounts = await env.DB.prepare('SELECT username, created_at FROM pinterest_accounts WHERE user_id = ?').bind(user.id).all();
  return json({ user: await publicUser(env, user), accounts: accounts.results, pins: pins.results });
}

// ---- Waitlist / feature requests (measures demand for paid plans) ----
export async function joinWaitlist(request, env) {
  const user = await requireUser(request, env).catch(() => null);
  const body = await readJson(request);
  await rateLimit(env, `wl:${clientIp(request)}`, 20, 3600);
  const valid = new Set(WAITLIST_FEATURES.map((f) => f.id));
  const features = (Array.isArray(body.features) ? body.features : [body.feature]).filter((f) => valid.has(f));
  if (!features.length) throw new HttpError(400, 'Pick at least one feature.', 'BAD_FEATURE');
  const email = user ? user.email : String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address.', 'BAD_EMAIL');
  const now = Date.now();
  await env.DB.batch(features.map((f) => env.DB.prepare(
    'INSERT INTO waitlist (id, user_id, email, feature, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(randomId('w_'), user ? user.id : null, email, f, str(body.note, 1000), now)));
  return json({ ok: true });
}

// ---- Bring-your-own AI keys (stored encrypted, never returned in full) ----
const AI_FIELDS = ['textBaseUrl', 'textModel', 'imageBaseUrl', 'imageModel'];
const AI_SECRETS = ['textKey', 'imageKey'];

export async function loadAiSettings(env, user) {
  if (!user.ai_settings_enc) return {};
  try { return JSON.parse(await decryptString(user.ai_settings_enc, await encKey(env))); } catch { return {}; }
}

function maskAi(s) {
  const out = {};
  for (const f of AI_FIELDS) out[f] = s[f] || '';
  for (const f of AI_SECRETS) { out[f] = s[f] ? maskKey(s[f]) : ''; out[`${f}Set`] = !!s[f]; }
  return out;
}

export async function getAiSettings(request, env) {
  const user = await requireUser(request, env);
  return json({ ai: maskAi(await loadAiSettings(env, user)) });
}

export async function putAiSettings(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const cur = await loadAiSettings(env, user);
  for (const f of AI_FIELDS) if (f in body) cur[f] = str(body[f], 300) || '';
  for (const f of AI_SECRETS) {
    if (!(f in body)) continue;
    const v = String(body[f] || '');
    if (!v) delete cur[f];
    else if (!v.includes('••••')) cur[f] = v.slice(0, 500);
  }
  for (const f of ['textBaseUrl', 'imageBaseUrl']) {
    if (cur[f] && !/^https:\/\//i.test(cur[f])) throw new HttpError(400, 'Base URLs must start with https://', 'BAD_URL');
  }
  const blob = await encryptString(JSON.stringify(cur), await encKey(env));
  await env.DB.prepare('UPDATE users SET ai_settings_enc = ? WHERE id = ?').bind(blob, user.id).run();
  return json({ ai: maskAi(cur) });
}
