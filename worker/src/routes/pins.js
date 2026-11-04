import { HttpError, json, readJson, str } from '../lib/http.js';
import { randomId } from '../lib/crypto.js';
import { requireUser } from '../lib/auth.js';
import { imageKey, IMAGE_TTL_SECONDS, lockPin, postPin } from '../poster.js';
import { autoSchedule } from '../../../shared/scheduler.js';
import { isValidTimeZone } from '../../../shared/tz.js';
import { pinAnalytics, withAccount } from '../pinterest.js';

const MAX_AHEAD_MS = 180 * 24 * 3600 * 1000;
const COLS = `id, account_id, board_id, board_name, title, description, link, alt_text, template_id, batch_id, thumb, status,
  scheduled_at, next_attempt_at, attempts, last_error, posted_at, pinterest_pin_id, created_at, updated_at`;

function checkTime(t) {
  if (t == null) return null;
  const n = typeof t === 'number' ? t : Date.parse(t);
  if (!Number.isFinite(n)) throw new HttpError(400, 'Invalid date/time.', 'BAD_TIME');
  if (n > Date.now() + MAX_AHEAD_MS) throw new HttpError(400, 'You can schedule up to 180 days ahead.', 'TOO_FAR');
  return n;
}

async function checkAccount(env, user, accountId) {
  if (!accountId) return null;
  const a = await env.DB.prepare('SELECT id FROM pinterest_accounts WHERE id = ? AND user_id = ?').bind(accountId, user.id).first();
  if (!a) throw new HttpError(400, 'That Pinterest account is not connected.', 'BAD_ACCOUNT');
  return a.id;
}

async function getOwned(env, user, id) {
  const pin = await env.DB.prepare('SELECT * FROM pins WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!pin) throw new HttpError(404, 'Pin not found.', 'NOT_FOUND');
  return pin;
}

export async function listPins(request, env) {
  const user = await requireUser(request, env);
  const u = new URL(request.url);
  const status = u.searchParams.get('status');
  let sql = `SELECT ${COLS} FROM pins WHERE user_id = ?`;
  const args = [user.id];
  if (status) { sql += ' AND status = ?'; args.push(status); }
  sql += ' ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 1000';
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ pins: results || [] });
}

export async function createPinRoute(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request, 9 * 1024 * 1024);
  const image = String(body.image || '').replace(/^data:image\/\w+;base64,/, '');
  if (!image || image.length < 100) throw new HttpError(400, 'Pin image is missing.', 'NO_IMAGE');
  if (image.length > 8 * 1024 * 1024) throw new HttpError(413, 'Pin image is too large.', 'TOO_LARGE');
  const thumb = str(body.thumb, 120000);
  const accountId = await checkAccount(env, user, body.accountId);
  const scheduledAt = checkTime(body.scheduledAt);
  let status = body.status === 'scheduled' ? 'scheduled' : 'draft';
  if (status === 'scheduled' && (!accountId || !body.boardId || !scheduledAt)) {
    throw new HttpError(400, 'To schedule a pin, choose an account, a board and a time.', 'INCOMPLETE');
  }
  const now = Date.now();
  const id = randomId('p_');
  await env.KV.put(imageKey(id), image, { expirationTtl: IMAGE_TTL_SECONDS });
  await env.DB.prepare(
    `INSERT INTO pins (id, user_id, account_id, board_id, board_name, title, description, link, alt_text, template_id, batch_id, thumb,
      status, scheduled_at, next_attempt_at, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).bind(id, user.id, accountId, str(body.boardId, 64), str(body.boardName, 180), str(body.title, 100), str(body.description, 800),
    str(body.link, 2048), str(body.altText, 500), str(body.templateId, 64), str(body.batchId, 64), thumb, status,
    scheduledAt, status === 'scheduled' ? scheduledAt : null, now, now).run();
  const pin = await env.DB.prepare(`SELECT ${COLS} FROM pins WHERE id = ?`).bind(id).first();
  return json({ pin }, 201);
}

export async function updatePin(request, env, { id }) {
  const user = await requireUser(request, env);
  const pin = await getOwned(env, user, id);
  if (pin.status === 'posted' || pin.status === 'posting') throw new HttpError(409, 'This pin is already posted.', 'ALREADY_POSTED');
  const body = await readJson(request);
  const next = { ...pin };
  const map = { title: 100, description: 800, link: 2048, altText: 500, boardId: 64, boardName: 180 };
  const colOf = { altText: 'alt_text', boardId: 'board_id', boardName: 'board_name' };
  for (const [k, max] of Object.entries(map)) if (k in body) next[colOf[k] || k] = str(body[k], max);
  if ('accountId' in body) next.account_id = await checkAccount(env, user, body.accountId);
  if ('scheduledAt' in body) next.scheduled_at = checkTime(body.scheduledAt);
  if ('status' in body) {
    if (!['draft', 'scheduled'].includes(body.status)) throw new HttpError(400, 'Invalid status.', 'BAD_STATUS');
    next.status = body.status;
  } else if ('scheduledAt' in body && next.scheduled_at && pin.status !== 'draft') {
    next.status = 'scheduled';
  }
  if (next.status === 'scheduled') {
    if (!next.account_id || !next.board_id || !next.scheduled_at) {
      throw new HttpError(400, 'To schedule a pin, choose an account, a board and a time.', 'INCOMPLETE');
    }
    next.next_attempt_at = next.scheduled_at;
    if (pin.status === 'failed' || 'scheduledAt' in body) { next.attempts = 0; next.last_error = null; }
  } else {
    next.next_attempt_at = null;
  }
  await env.DB.prepare(
    `UPDATE pins SET account_id=?, board_id=?, board_name=?, title=?, description=?, link=?, alt_text=?, status=?, scheduled_at=?,
     next_attempt_at=?, attempts=?, last_error=?, updated_at=? WHERE id=? AND user_id=?`,
  ).bind(next.account_id, next.board_id, next.board_name, next.title, next.description, next.link, next.alt_text, next.status,
    next.scheduled_at, next.next_attempt_at, next.attempts, next.last_error, Date.now(), id, user.id).run();
  return json({ pin: await env.DB.prepare(`SELECT ${COLS} FROM pins WHERE id = ?`).bind(id).first() });
}

export async function deletePin(request, env, { id }) {
  const user = await requireUser(request, env);
  await getOwned(env, user, id);
  await env.DB.prepare('DELETE FROM pins WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  await env.KV.delete(imageKey(id));
  return json({ ok: true });
}

export async function postNow(request, env, { id }) {
  const user = await requireUser(request, env);
  const pin = await getOwned(env, user, id);
  if (!pin.account_id || !pin.board_id) throw new HttpError(400, 'Choose a Pinterest account and board first.', 'INCOMPLETE');
  if (!(await lockPin(env, id, { allowDraft: true }))) throw new HttpError(409, 'This pin is already posting or posted.', 'LOCKED');
  const result = await postPin(env, { ...pin, attempts: pin.status === 'failed' ? 0 : pin.attempts });
  const fresh = await env.DB.prepare(`SELECT ${COLS} FROM pins WHERE id = ?`).bind(id).first();
  return json({ result, pin: fresh }, result.status === 'posted' ? 200 : 502);
}

export async function autoScheduleRoute(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const ids = Array.isArray(body.pinIds) ? body.pinIds.slice(0, 1000) : [];
  if (!ids.length) throw new HttpError(400, 'Choose some pins to schedule.', 'NO_PINS');
  const tz = isValidTimeZone(body.timezone) ? body.timezone : 'UTC';
  const accountId = await checkAccount(env, user, body.accountId);
  const placeholders = ids.map(() => '?').join(',');
  const { results: pins } = await env.DB.prepare(
    `SELECT id, link, board_id, account_id FROM pins WHERE user_id = ? AND status IN ('draft','failed','scheduled') AND id IN (${placeholders})`,
  ).bind(user.id, ...ids).all();
  const { results: busy } = await env.DB.prepare(
    `SELECT scheduled_at FROM pins WHERE user_id = ? AND status = 'scheduled' AND scheduled_at > ? AND id NOT IN (${placeholders})`,
  ).bind(user.id, Date.now(), ...ids).all();
  const boardIds = Array.isArray(body.boardIds) ? body.boardIds.filter(Boolean).slice(0, 50) : [];
  const boardNames = body.boardNames || {};
  const windows = Array.isArray(body.windows) && body.windows.length
    ? body.windows.map(([s, e]) => [Math.max(0, Math.min(24, +s)), Math.max(0, Math.min(24, +e))]).filter(([s, e]) => e > s)
    : [[8, 22]];
  const plan = autoSchedule(
    pins.map((p) => ({ id: p.id, link: p.link, boardIds: boardIds.length ? boardIds : p.board_id ? [p.board_id] : [] })),
    {
      timezone: tz, minPerDay: +body.minPerDay || 3, maxPerDay: +body.maxPerDay || 5, windows,
      startDate: typeof body.startDate === 'string' ? body.startDate : undefined,
      existing: (busy || []).map((b) => b.scheduled_at),
    },
  );
  const byId = new Map(pins.map((p) => [p.id, p]));
  const now = Date.now();
  const stmts = [];
  const skipped = [];
  for (const s of plan) {
    const p = byId.get(s.id);
    const acc = accountId || p.account_id;
    if (!acc || !s.boardId) { skipped.push(s.id); continue; }
    stmts.push(env.DB.prepare(
      `UPDATE pins SET status='scheduled', scheduled_at=?, next_attempt_at=?, board_id=?, board_name=COALESCE(?, board_name), account_id=?,
       attempts=0, last_error=NULL, updated_at=? WHERE id=? AND user_id=?`,
    ).bind(s.scheduledAt, s.scheduledAt, s.boardId, boardNames[s.boardId] || null, acc, now, s.id, user.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ scheduled: stmts.length, skipped, plan });
}

export async function pinStats(request, env, { id }) {
  const user = await requireUser(request, env);
  const pin = await getOwned(env, user, id);
  if (!pin.pinterest_pin_id) throw new HttpError(400, 'This pin has not been posted yet.', 'NOT_POSTED');
  const account = await env.DB.prepare('SELECT * FROM pinterest_accounts WHERE id = ? AND user_id = ?').bind(pin.account_id, user.id).first();
  if (!account) throw new HttpError(400, 'The Pinterest account for this pin is no longer connected.', 'NO_ACCOUNT');
  const end = new Date();
  const start = new Date(Math.max(pin.posted_at || 0, Date.now() - 89 * 86400000));
  const d = (x) => x.toISOString().slice(0, 10);
  try {
    const data = await withAccount(env, account, (t) => pinAnalytics(env, t, pin.pinterest_pin_id, d(start), d(end)));
    const summary = (data && data.all && data.all.lifetime_metrics) || (data && data.all && data.all.summary_metrics) || {};
    return json({ stats: summary, raw: data });
  } catch (e) {
    throw new HttpError(502, `Pinterest analytics are not available for this pin yet (${e.message}).`, 'NO_STATS');
  }
}

export async function postLog(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    'SELECT l.at, l.ok, l.message, l.pin_id, p.title FROM post_log l LEFT JOIN pins p ON p.id = l.pin_id WHERE l.user_id = ? ORDER BY l.at DESC LIMIT 200',
  ).bind(user.id).all();
  return json({ log: results || [] });
}
