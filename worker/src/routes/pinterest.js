import { HttpError, json, readJson, str } from '../lib/http.js';
import { encryptString, randomId, signJwt, verifyJwt } from '../lib/crypto.js';
import { encKey, jwtSecret } from '../lib/secrets.js';
import { requireUser, getPlan, issueToken } from '../lib/auth.js';
import { checkCanConnect } from '../../../shared/plans.js';
import {
  authorizeUrl, exchangeCode, userAccount, redirectUri, pinterestConfigured,
  listBoards, createBoard, withAccount, SCOPES,
} from '../pinterest.js';

function appUrl(env, hash) {
  const base = (env.APP_URL || '/').replace(/#.*$/, '');
  return `${base}${base.endsWith('/') ? '' : '/'}#${hash}`;
}

function requireConfigured(env) {
  if (!pinterestConfigured(env)) {
    throw new HttpError(503, 'Pinterest is not connected on this server yet (missing PINTEREST_APP_ID / PINTEREST_APP_SECRET).', 'PINTEREST_NOT_CONFIGURED');
  }
}

async function accountCount(env, userId) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM pinterest_accounts WHERE user_id = ?').bind(userId).first();
  return r ? r.n : 0;
}

/** POST /api/pinterest/connect -> { url } or 402 PLAN_LIMIT */
export async function connect(request, env) {
  const user = await requireUser(request, env);
  const plan = await getPlan(env, user.plan_id);
  const check = checkCanConnect(plan, await accountCount(env, user.id));
  if (!check.ok) throw new HttpError(402, check.message, check.code, { upgrade: true, plan: plan.id });
  requireConfigured(env);
  const state = await signJwt({ typ: 'oauth', mode: 'connect', uid: user.id, n: randomId() }, await jwtSecret(env), 900);
  return json({ url: authorizeUrl(env, redirectUri(request, env), state) });
}

/** GET /api/pinterest/login -> redirect to Pinterest ("Continue with Pinterest") */
export async function loginStart(request, env) {
  requireConfigured(env);
  const state = await signJwt({ typ: 'oauth', mode: 'login', n: randomId() }, await jwtSecret(env), 900);
  return Response.redirect(authorizeUrl(env, redirectUri(request, env), state), 302);
}

export async function callback(request, env) {
  const url = new URL(request.url);
  const fail = (msg) => Response.redirect(appUrl(env, `/app/accounts?error=${encodeURIComponent(msg)}`), 302);
  if (url.searchParams.get('error')) return fail(url.searchParams.get('error_description') || 'Pinterest access was not granted.');
  const state = await verifyJwt(url.searchParams.get('state'), await jwtSecret(env));
  if (!state || state.typ !== 'oauth') return fail('This Pinterest link expired. Please try again.');
  const code = url.searchParams.get('code');
  if (!code) return fail('Missing authorization code from Pinterest.');
  requireConfigured(env);

  let tokens, profile;
  try {
    tokens = await exchangeCode(env, code, redirectUri(request, env));
    profile = await userAccount(env, tokens.access_token);
  } catch (e) {
    return fail(e.message || 'Could not finish connecting to Pinterest.');
  }
  const pinterestUserId = String(profile.id || profile.username);
  const now = Date.now();
  const key = await encKey(env);

  let userId = state.uid;
  let sessionUser = null;
  if (state.mode === 'login') {
    const existing = await env.DB.prepare(
      'SELECT u.* FROM pinterest_accounts a JOIN users u ON u.id = a.user_id WHERE a.pinterest_user_id = ? ORDER BY a.created_at ASC LIMIT 1',
    ).bind(pinterestUserId).first();
    if (existing) {
      sessionUser = existing;
    } else {
      sessionUser = {
        id: randomId('u_'), email: `${pinterestUserId}@pinterest.login`, name: profile.username || 'Pinterest user',
        settings: JSON.stringify({ loginVia: 'pinterest' }),
      };
      await env.DB.prepare(
        "INSERT INTO users (id, email, name, password_hash, plan_id, settings, created_at, last_login_at) VALUES (?, ?, ?, NULL, 'free', ?, ?, ?)",
      ).bind(sessionUser.id, sessionUser.email, sessionUser.name, sessionUser.settings, now, now).run();
    }
    userId = sessionUser.id;
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return fail('Your session expired. Please sign in again.');
  const already = await env.DB.prepare('SELECT id FROM pinterest_accounts WHERE user_id = ? AND pinterest_user_id = ?')
    .bind(userId, pinterestUserId).first();
  if (!already) {
    // Re-check the plan limit server-side (someone could open two connect tabs).
    const plan = await getPlan(env, user.plan_id);
    if (!checkCanConnect(plan, await accountCount(env, userId)).ok) {
      return Response.redirect(appUrl(env, '/upgrade?reason=accounts'), 302);
    }
  }
  const access = await encryptString(tokens.access_token, key);
  const refresh = tokens.refresh_token ? await encryptString(tokens.refresh_token, key) : null;
  const accessExp = tokens.expires_in ? now + tokens.expires_in * 1000 : null;
  const refreshExp = tokens.refresh_token_expires_in ? now + tokens.refresh_token_expires_in * 1000 : null;
  if (already) {
    await env.DB.prepare(
      `UPDATE pinterest_accounts SET access_token_enc=?, refresh_token_enc=COALESCE(?, refresh_token_enc), access_expires_at=?,
       refresh_expires_at=COALESCE(?, refresh_expires_at), username=?, profile_image=?, scopes=?, status='active' WHERE id=?`,
    ).bind(access, refresh, accessExp, refreshExp, profile.username || null, profile.profile_image || null, tokens.scope || SCOPES.join(','), already.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO pinterest_accounts (id, user_id, pinterest_user_id, username, profile_image, access_token_enc, refresh_token_enc,
       access_expires_at, refresh_expires_at, scopes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    ).bind(randomId('pa_'), userId, pinterestUserId, profile.username || null, profile.profile_image || null, access, refresh,
      accessExp, refreshExp, tokens.scope || SCOPES.join(','), now).run();
  }
  if (sessionUser) {
    return Response.redirect(appUrl(env, `/auth?token=${encodeURIComponent(await issueToken(env, sessionUser))}`), 302);
  }
  return Response.redirect(appUrl(env, '/app/accounts?connected=1'), 302);
}

export async function listAccounts(request, env) {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    'SELECT id, username, profile_image, status, created_at FROM pinterest_accounts WHERE user_id = ? ORDER BY created_at',
  ).bind(user.id).all();
  return json({ accounts: results || [] });
}

async function ownedAccount(env, user, id) {
  const a = await env.DB.prepare('SELECT * FROM pinterest_accounts WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!a) throw new HttpError(404, 'Pinterest account not found.', 'NOT_FOUND');
  return a;
}

export async function removeAccount(request, env, { id }) {
  const user = await requireUser(request, env);
  await ownedAccount(env, user, id);
  await env.DB.batch([
    env.DB.prepare(`UPDATE pins SET status='draft', account_id=NULL WHERE account_id = ? AND user_id = ? AND status IN ('scheduled','failed')`).bind(id, user.id),
    env.DB.prepare('DELETE FROM pinterest_accounts WHERE id = ? AND user_id = ?').bind(id, user.id),
  ]);
  return json({ ok: true });
}

export async function boards(request, env, { id }) {
  const user = await requireUser(request, env);
  const account = await ownedAccount(env, user, id);
  requireConfigured(env);
  try {
    const list = await withAccount(env, account, (t) => listBoards(env, t));
    return json({ boards: list });
  } catch (e) {
    throw new HttpError(e.status === 401 ? 401 : 502, `Could not load boards: ${e.message}`, 'PINTEREST_ERROR');
  }
}

export async function newBoard(request, env, { id }) {
  const user = await requireUser(request, env);
  const account = await ownedAccount(env, user, id);
  requireConfigured(env);
  const body = await readJson(request);
  const name = str(body.name, 180);
  if (!name) throw new HttpError(400, 'Board name is required.', 'BAD_NAME');
  try {
    const b = await withAccount(env, account, (t) => createBoard(env, t, { name, description: str(body.description, 500), privacy: body.secret ? 'SECRET' : 'PUBLIC' }));
    return json({ board: { id: b.id, name: b.name, privacy: b.privacy } }, 201);
  } catch (e) {
    throw new HttpError(502, `Could not create board: ${e.message}`, 'PINTEREST_ERROR');
  }
}
