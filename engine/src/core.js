// Engine business logic, shared by the REST API (used by the Tackly web app) and the MCP server (used by AI assistants).
import { PIN_COLS, rid, getSetting } from './db.js';
import { relay, relayGet, RelayError } from './relay.js';
import { autoSchedule as planSchedule, backoffMs, MAX_ATTEMPTS } from './shared/scheduler.js';
import { checkDailyLimit, DAILY_PIN_LIMIT, MAX_PINTEREST_ACCOUNTS, MAX_STORED_PINS } from './shared/limits.js';
import { isValidTimeZone } from './shared/tz.js';
import { buildPrompt, parseJsonLoose, POLLINATIONS_TEXT } from './shared/prompts.js';

export class EngineError extends Error {
  constructor(status, message, code, extra) { super(message); this.status = status; this.code = code || 'ERROR'; this.extra = extra; }
}
const s = (v, max = 1000) => (v == null || v === '' ? null : String(v).slice(0, max));
export const imageKey = (id) => `img:${id}`;
const MAX_AHEAD = 365 * 86400000;

export async function tz(env) {
  const st = await getSetting(env, 'profile', {});
  return isValidTimeZone(st.timezone) ? st.timezone : 'UTC';
}

// ---------- accounts ----------
export async function listAccounts(env) {
  const { results } = await env.DB.prepare('SELECT id, username, profile_image, status, created_at FROM accounts ORDER BY created_at').all();
  return results || [];
}
export async function getAccount(env, id) {
  const a = id
    ? await env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first()
    : await env.DB.prepare('SELECT * FROM accounts ORDER BY created_at LIMIT 1').first();
  if (!a) throw new EngineError(400, 'No Pinterest account is connected. Connect one in the Tackly app (Accounts).', 'NO_ACCOUNT');
  return a;
}
export async function addAccount(env, { sealed, username, profile_image }) {
  if (!sealed) throw new EngineError(400, 'Missing Pinterest connection.', 'BAD_REQUEST');
  const existing = await env.DB.prepare('SELECT id FROM accounts WHERE username = ?').bind(username || '').first();
  if (existing) {
    await env.DB.prepare("UPDATE accounts SET sealed = ?, profile_image = ?, status = 'active' WHERE id = ?").bind(sealed, s(profile_image, 500), existing.id).run();
    return existing.id;
  }
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM accounts').first()).n;
  if (n >= MAX_PINTEREST_ACCOUNTS) throw new EngineError(400, `A workspace can connect ${MAX_PINTEREST_ACCOUNTS} Pinterest account. Disconnect the current one first.`, 'ACCOUNT_LIMIT');
  const id = rid('pa_');
  await env.DB.prepare("INSERT INTO accounts (id, username, profile_image, sealed, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)")
    .bind(id, s(username, 100), s(profile_image, 500), sealed, Date.now()).run();
  return id;
}
export async function removeAccount(env, id) {
  await env.DB.prepare("UPDATE pins SET status = 'draft', next_attempt_at = NULL WHERE account_id = ? AND status IN ('scheduled','failed')").bind(id).run();
  await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(id).run();
}
export async function boards(env, accountId) {
  const a = await getAccount(env, accountId);
  return (await relay(env, '/api/relay/boards', {}, { account: a })).boards;
}
export async function createBoard(env, accountId, { name, description, secret }) {
  const a = await getAccount(env, accountId);
  return (await relay(env, '/api/relay/boards/create', { name, description, secret }, { account: a })).board;
}
export async function quota(env, accountId) {
  const a = await getAccount(env, accountId);
  return (await relay(env, '/api/relay/quota', {}, { account: a })).quota;
}

// ---------- pins ----------
export async function getPin(env, id) {
  const p = await env.DB.prepare(`SELECT ${PIN_COLS} FROM pins WHERE id = ?`).bind(id).first();
  if (!p) throw new EngineError(404, 'Pin not found.', 'NOT_FOUND');
  return p;
}
export async function listPins(env, { status, limit = 2000 } = {}) {
  let sql = `SELECT ${PIN_COLS} FROM pins`;
  const args = [];
  if (status) { sql += ' WHERE status = ?'; args.push(status); }
  sql += ' ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT ?';
  args.push(Math.min(+limit || 2000, 5000));
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return results || [];
}

async function enforceLimit(env, id, accountId, at) {
  const { results } = await env.DB.prepare(`SELECT id, account_id, status, scheduled_at, posted_at FROM pins
    WHERE status IN ('scheduled','posting','posted') AND COALESCE(scheduled_at, posted_at) BETWEEN ? AND ?`).bind(at - 2 * 86400000, at + 2 * 86400000).all();
  const msg = checkDailyLimit(results || [], { id, accountId, at, tz: await tz(env) });
  if (msg) throw new EngineError(400, msg, 'DAILY_LIMIT');
}

function checkTime(t) {
  if (t == null || t === '') return null;
  const n = typeof t === 'number' ? t : Date.parse(t);
  if (!Number.isFinite(n)) throw new EngineError(400, 'Invalid date/time. Use ISO 8601, e.g. 2026-12-01T18:30:00Z.', 'BAD_TIME');
  if (n > Date.now() + MAX_AHEAD) throw new EngineError(400, 'You can schedule up to a year ahead.', 'TOO_FAR');
  return n;
}

/**
 * Create a pin. One of: image (base64), image_url (public URL), or design (template JSON, rendered later by the web app).
 */
export async function createPin(env, b) {
  const count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM pins WHERE status != ?').bind('posted').first()).n;
  if (count >= MAX_STORED_PINS) throw new EngineError(400, `You have ${MAX_STORED_PINS} unposted pins. Delete some first.`, 'TOO_MANY');
  const image = String(b.image || '').replace(/^data:image\/\w+;base64,/, '');
  const imageUrl = s(b.image_url || b.imageUrl, 2048);
  const design = b.design ? (typeof b.design === 'string' ? b.design : JSON.stringify(b.design)) : null;
  if (!image && !imageUrl && !design) throw new EngineError(400, 'Give an image, an image_url or a template design.', 'NO_IMAGE');
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) throw new EngineError(400, 'image_url must be a public https link.', 'BAD_URL');
  if (design && design.length > 200000) throw new EngineError(413, 'Design is too large.', 'TOO_LARGE');
  const accountId = b.accountId || b.account_id || (await env.DB.prepare('SELECT id FROM accounts ORDER BY created_at LIMIT 1').first())?.id || null;
  const scheduledAt = checkTime(b.scheduledAt ?? b.scheduled_at);
  const needsRender = !!design && !image && !imageUrl;
  let status = b.status === 'scheduled' || scheduledAt ? 'scheduled' : 'draft';
  const boardId = s(b.boardId || b.board_id, 64);
  if (status === 'scheduled') {
    if (!accountId || !boardId || !scheduledAt) throw new EngineError(400, 'To schedule a pin, give a board and a time (and connect Pinterest).', 'INCOMPLETE');
    await enforceLimit(env, null, accountId, scheduledAt);
  }
  const id = rid('p_');
  const now = Date.now();
  if (image) {
    if (image.length > 8 * 1024 * 1024) throw new EngineError(413, 'Image too large.', 'TOO_LARGE');
    await env.KV.put(imageKey(id), image);
  }
  await env.DB.prepare(`INSERT INTO pins (id, account_id, board_id, board_name, title, description, link, alt_text, keyword, template_id, batch_id, thumb,
      image_url, design_json, source, status, scheduled_at, next_attempt_at, attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`).bind(
    id, accountId, boardId, s(b.boardName || b.board_name, 180), s(b.title, 100), s(b.description, 800), s(b.link, 2048),
    s(b.altText || b.alt_text, 500), s(b.keyword, 120), s(b.templateId || b.template_id, 64), s(b.batchId || b.batch_id, 64),
    s(b.thumb, 120000), imageUrl, design, s(b.source, 30) || (needsRender ? 'ai' : 'app'), status, scheduledAt,
    status === 'scheduled' ? scheduledAt : null, now, now,
  ).run();
  return getPin(env, id);
}

export async function updatePin(env, id, b) {
  const pin = await getPin(env, id);
  if (pin.status === 'posted' || pin.status === 'posting') throw new EngineError(409, 'This pin is already posted.', 'ALREADY_POSTED');
  const next = { ...pin };
  const map = { title: ['title', 100], description: ['description', 800], link: ['link', 2048], altText: ['alt_text', 500], alt_text: ['alt_text', 500],
    boardId: ['board_id', 64], board_id: ['board_id', 64], boardName: ['board_name', 180], board_name: ['board_name', 180], keyword: ['keyword', 120] };
  for (const [k, [col, max]] of Object.entries(map)) if (k in b) next[col] = s(b[k], max);
  if ('accountId' in b || 'account_id' in b) next.account_id = b.accountId || b.account_id || null;
  if ('scheduledAt' in b || 'scheduled_at' in b) next.scheduled_at = checkTime(b.scheduledAt ?? b.scheduled_at);
  if ('status' in b) {
    if (!['draft', 'scheduled'].includes(b.status)) throw new EngineError(400, 'Status must be draft or scheduled.', 'BAD_STATUS');
    next.status = b.status;
  } else if (('scheduledAt' in b || 'scheduled_at' in b) && next.scheduled_at && pin.status !== 'draft') next.status = 'scheduled';
  if (next.status === 'scheduled') {
    if (!next.account_id || !next.board_id || !next.scheduled_at) throw new EngineError(400, 'To schedule a pin, give a board and a time.', 'INCOMPLETE');
    if (next.scheduled_at !== pin.scheduled_at || pin.status !== 'scheduled') await enforceLimit(env, id, next.account_id, next.scheduled_at);
    next.next_attempt_at = next.scheduled_at;
    next.attempts = 0; next.last_error = null;
  } else next.next_attempt_at = null;
  await env.DB.prepare(`UPDATE pins SET account_id=?, board_id=?, board_name=?, title=?, description=?, link=?, alt_text=?, keyword=?, status=?,
     scheduled_at=?, next_attempt_at=?, attempts=?, last_error=?, updated_at=? WHERE id=?`).bind(
    next.account_id, next.board_id, next.board_name, next.title, next.description, next.link, next.alt_text, next.keyword, next.status,
    next.scheduled_at, next.next_attempt_at, next.attempts, next.last_error, Date.now(), id).run();
  return getPin(env, id);
}

/** Save the rendered image for a design pin (the web app renders AI-created template designs). */
export async function setPinImage(env, id, { image, thumb }) {
  const pin = await getPin(env, id);
  const img = String(image || '').replace(/^data:image\/\w+;base64,/, '');
  if (!img) throw new EngineError(400, 'Missing image.', 'NO_IMAGE');
  await env.KV.put(imageKey(id), img);
  await env.DB.prepare('UPDATE pins SET thumb = ?, design_json = NULL, updated_at = ? WHERE id = ?').bind(s(thumb, 120000), Date.now(), pin.id).run();
  return getPin(env, id);
}

export async function deletePin(env, id) {
  await getPin(env, id);
  await env.DB.prepare('DELETE FROM pins WHERE id = ?').bind(id).run();
  await env.KV.delete(imageKey(id));
}

export async function autoSchedule(env, b) {
  let ids = Array.isArray(b.pinIds || b.pin_ids) ? (b.pinIds || b.pin_ids).slice(0, 1000) : [];
  if (!ids.length) ids = (await listPins(env, { status: 'draft' })).map((p) => p.id);
  if (!ids.length) throw new EngineError(400, 'No draft pins to schedule.', 'NO_PINS');
  const zone = isValidTimeZone(b.timezone) ? b.timezone : await tz(env);
  const ph = ids.map(() => '?').join(',');
  const { results: pins } = await env.DB.prepare(`SELECT id, link, board_id, account_id FROM pins WHERE status IN ('draft','failed','scheduled') AND id IN (${ph})`).bind(...ids).all();
  const account = b.accountId || b.account_id || (await env.DB.prepare('SELECT id FROM accounts ORDER BY created_at LIMIT 1').first())?.id;
  const { results: busy } = await env.DB.prepare(`SELECT scheduled_at FROM pins WHERE status IN ('scheduled','posted') AND scheduled_at > ? AND id NOT IN (${ph})`).bind(Date.now() - 86400000, ...ids).all();
  const boardIds = (b.boardIds || b.board_ids || []).filter(Boolean).slice(0, 50);
  const windows = Array.isArray(b.windows) && b.windows.length ? b.windows.map(([a, c]) => [Math.max(0, Math.min(24, +a)), Math.max(0, Math.min(24, +c))]).filter(([a, c]) => c > a) : [[8, 22]];
  const plan = planSchedule(
    (pins || []).map((p) => ({ id: p.id, link: p.link, boardIds: boardIds.length ? boardIds : p.board_id ? [p.board_id] : [] })),
    { timezone: zone, minPerDay: +(b.minPerDay ?? b.per_day_min) || 3, maxPerDay: +(b.maxPerDay ?? b.per_day_max) || 5, windows,
      startDate: typeof (b.startDate || b.start_date) === 'string' ? b.startDate || b.start_date : undefined, existing: (busy || []).map((x) => x.scheduled_at) },
  );
  const names = b.boardNames || {};
  const stmts = []; const skipped = [];
  for (const it of plan) {
    const p = pins.find((x) => x.id === it.id);
    const acc = account || p.account_id;
    if (!acc || !it.boardId) { skipped.push(it.id); continue; }
    stmts.push(env.DB.prepare(`UPDATE pins SET status='scheduled', scheduled_at=?, next_attempt_at=?, board_id=?, board_name=COALESCE(?, board_name), account_id=?, attempts=0, last_error=NULL, updated_at=? WHERE id=?`)
      .bind(it.scheduledAt, it.scheduledAt, it.boardId, names[it.boardId] || null, acc, Date.now(), it.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { scheduled: stmts.length, skipped, plan };
}

async function log(env, pin, ok, message) {
  await env.DB.prepare('INSERT INTO post_log (id, pin_id, at, ok, message) VALUES (?, ?, ?, ?, ?)').bind(rid('l_'), pin.id, Date.now(), ok ? 1 : 0, String(message || '').slice(0, 500)).run();
}

export async function lockPin(env, id, { allowDraft = false } = {}) {
  const st = allowDraft ? "('scheduled','draft','failed')" : "('scheduled')";
  const r = await env.DB.prepare(`UPDATE pins SET status='posting', locked_at=? WHERE id=? AND status IN ${st}`).bind(Date.now(), id).run();
  return (r.meta?.changes ?? 0) > 0;
}

/** Publish a locked pin through the relay. */
export async function postPin(env, pin) {
  const now = Date.now();
  const back = async (status, fields) => {
    const sets = Object.keys(fields).map((k) => `${k}=?`).join(', ');
    await env.DB.prepare(`UPDATE pins SET status=?, ${sets}, locked_at=NULL, updated_at=? WHERE id=?`).bind(status, ...Object.values(fields), now, pin.id).run();
  };
  const fail = async (message, permanent) => {
    const attempts = (pin.attempts || 0) + 1;
    if (permanent || attempts >= MAX_ATTEMPTS) { await back('failed', { attempts, last_error: message }); await log(env, pin, false, message); return { status: 'failed', error: message }; }
    const next = now + backoffMs(attempts);
    await back('scheduled', { attempts, last_error: message, next_attempt_at: next });
    await log(env, pin, false, `${message} (will retry)`);
    return { status: 'scheduled', error: message, nextAttemptAt: next };
  };
  if (pin.design_json) return fail('This pin was designed by AI and still needs rendering. Open the Tackly app once to render it.', false);
  if (!pin.board_id) return fail('Pick a board for this pin.', true);
  let account;
  try { account = await getAccount(env, pin.account_id); } catch { return fail('No Pinterest account connected.', true); }
  const image = await env.KV.get(imageKey(pin.id));
  if (!image && !pin.image_url) return fail('The pin image is missing. Please re-create the pin.', true);
  try {
    const r = await relay(env, '/api/relay/pins', {
      board_id: pin.board_id, title: pin.title, description: pin.description, link: pin.link, alt_text: pin.alt_text,
      ...(image ? { image_base64: image, content_type: 'image/jpeg' } : { image_url: pin.image_url }),
    }, { account });
    await back('posted', { posted_at: now, pinterest_pin_id: r.id || null, last_error: null });
    await env.KV.delete(imageKey(pin.id));
    await log(env, pin, true, `Posted${r.id ? ` as pin ${r.id}` : ''} (${r.quota ? `${r.quota.used}/${r.quota.limit} today` : 'ok'})`);
    return { status: 'posted', pinterestPinId: r.id };
  } catch (e) {
    if (e instanceof RelayError && (e.code === 'DAILY_LIMIT' || e.code === 'TOO_SOON')) {
      // Not an error: wait for the next safe slot without using up a retry.
      const next = (e.data.nextAt || now + 15 * 60000) + Math.floor(Math.random() * 9 + 1) * 60000;
      await back('scheduled', { next_attempt_at: next, last_error: `Waiting for a safe slot: ${e.message}` });
      return { status: 'scheduled', error: e.message, nextAttemptAt: next };
    }
    if (e.status === 401) { await env.DB.prepare("UPDATE accounts SET status='reconnect' WHERE id=?").bind(account.id).run(); return fail('Pinterest login expired. Reconnect your account in the Tackly app.', true); }
    const permanent = e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status);
    return fail(e.message, permanent);
  }
}

export async function postNow(env, id) {
  const pin = await getPin(env, id);
  if (!pin.account_id || !pin.board_id) throw new EngineError(400, 'Choose a board (and connect Pinterest) first.', 'INCOMPLETE');
  if (!(await lockPin(env, id, { allowDraft: true }))) throw new EngineError(409, 'This pin is already posting or posted.', 'LOCKED');
  const result = await postPin(env, { ...pin, attempts: 0 });
  return { result, pin: await getPin(env, id) };
}

export async function runDue(env, now = Date.now()) {
  await env.DB.prepare("UPDATE pins SET status='scheduled', locked_at=NULL WHERE status='posting' AND locked_at < ?").bind(now - 15 * 60000).run();
  const { results } = await env.DB.prepare(`SELECT ${PIN_COLS} FROM pins WHERE status='scheduled' AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT 10`).bind(now).all();
  const seen = new Set(); const out = [];
  for (const p of results || []) {
    if (seen.has(p.account_id)) continue; // one pin per account per run keeps natural spacing
    if (!(await lockPin(env, p.id))) continue;
    seen.add(p.account_id);
    out.push({ id: p.id, ...(await postPin(env, p)) });
  }
  return out;
}

export async function stats(env, id) {
  const pin = await getPin(env, id);
  if (!pin.pinterest_pin_id) throw new EngineError(400, 'This pin has not been posted yet.', 'NOT_POSTED');
  const a = await getAccount(env, pin.account_id);
  return (await relay(env, '/api/relay/analytics', { pin_id: pin.pinterest_pin_id, since: pin.posted_at }, { account: a })).stats;
}

export async function postLog(env) {
  const { results } = await env.DB.prepare('SELECT l.at, l.ok, l.message, l.pin_id, p.title FROM post_log l LEFT JOIN pins p ON p.id = l.pin_id ORDER BY l.at DESC LIMIT 200').all();
  return results || [];
}

export async function overview(env) {
  const c = await env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM pins WHERE status='draft') AS drafts, (SELECT COUNT(*) FROM pins WHERE status='scheduled') AS scheduled,
    (SELECT COUNT(*) FROM pins WHERE status='posted') AS posted, (SELECT COUNT(*) FROM pins WHERE status='failed') AS failed,
    (SELECT COUNT(*) FROM pins WHERE design_json IS NOT NULL) AS needs_render, (SELECT COUNT(*) FROM accounts) AS accounts`).first();
  return { ...c, dailyLimit: DAILY_PIN_LIMIT };
}

// ---------- AI + research ----------
export async function aiText(env, task, input) {
  let prompt;
  try { prompt = buildPrompt(task, input || {}); } catch (e) { throw new EngineError(400, e.message, 'BAD_TASK'); }
  const ai = await getSetting(env, 'ai', {});
  if (ai.textBaseUrl && ai.textKey) {
    const r = await fetch(`${ai.textBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.textKey}` },
      body: JSON.stringify({ model: ai.textModel || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new EngineError(502, `AI provider error: ${d.error?.message || r.status}`, 'AI_ERROR');
    const text = d.choices?.[0]?.message?.content || '';
    return { text, data: parseJsonLoose(text), provider: 'custom' };
  }
  const r = await fetch(`${POLLINATIONS_TEXT}/${encodeURIComponent(prompt)}?model=openai&seed=${Math.floor(Math.random() * 1e9)}`);
  if (!r.ok) throw new EngineError(502, `Free AI is busy (${r.status}). Try again shortly.`, 'AI_BUSY');
  const text = await r.text();
  return { text, data: parseJsonLoose(text), provider: 'pollinations' };
}

export async function keywords(env, seed) {
  let account = null;
  try { account = await getAccount(env); } catch { /* keyword research also works without Pinterest */ }
  return relay(env, '/api/keywords', { seed }, account ? { account } : {});
}

export async function pageInfo(env, url) {
  return relayGet(env, `/api/page-info?url=${encodeURIComponent(url)}`);
}
