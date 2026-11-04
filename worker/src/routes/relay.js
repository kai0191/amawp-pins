// Pinterest OAuth + relay. Stateless: nothing about the user is stored except anonymous quota counters.
import { HttpError, json, readJson, str } from '../lib/http.js';
import { randomId, signJwt, verifyJwt } from '../lib/crypto.js';
import { jwtSecret } from '../lib/secrets.js';
import { clientIp, rateLimit, bumpStat, accountHash, reserveSlot, releaseSlot, quotaFor, safePublicUrl } from '../lib/guard.js';
import {
  authorizeUrl, exchangeCode, userAccount, redirectUri, pinterestConfigured, listBoards, createBoard, createPin,
  pinAnalytics, withSealed, seal, unseal, scopes,
} from '../pinterest.js';
import { DAILY_PIN_LIMIT, MIN_GAP_MINUTES } from '../../../shared/limits.js';

function appUrl(env, hash) {
  const base = (env.APP_URL || '/').replace(/#.*$/, '');
  return `${base}${base.endsWith('/') ? '' : '/'}#${hash}`;
}
function requireConfigured(env) {
  if (!pinterestConfigured(env)) {
    throw new HttpError(503, 'Pinterest is not switched on for this Tackly server yet.', 'PINTEREST_NOT_CONFIGURED');
  }
}
async function acctOf(env, conn) {
  return accountHash(env, conn.uid, await jwtSecret(env));
}

/** POST /api/pinterest/connect -> { url } */
export async function connect(request, env) {
  requireConfigured(env);
  await rateLimit(env, `connect:${clientIp(request)}`, 20, 3600);
  const state = await signJwt({ typ: 'oauth', n: randomId() }, await jwtSecret(env), 900);
  return json({ url: authorizeUrl(env, redirectUri(request, env), state) });
}

/** GET /api/pinterest/callback -> redirects back to the app with a sealed connection in the URL fragment. */
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
  const now = Date.now();
  const sealed = await seal(env, {
    a: tokens.access_token, r: tokens.refresh_token || null,
    ae: tokens.expires_in ? now + tokens.expires_in * 1000 : null,
    re: tokens.refresh_token_expires_in ? now + tokens.refresh_token_expires_in * 1000 : null,
    uid: String(profile.id || profile.username), sc: tokens.scope || scopes(env).join(','),
  });
  await bumpStat(env, 'connects');
  const q = new URLSearchParams({ sealed, u: profile.username || '', img: profile.profile_image || '' });
  return Response.redirect(appUrl(env, `/connected?${q}`), 302);
}

async function body(request) {
  const b = await readJson(request, 9 * 1024 * 1024);
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Bad request', 'BAD_JSON');
  return b;
}
const out = (data, sealed) => json(sealed ? { ...data, sealed } : data);
const pinterestError = (e, what) => {
  if (e instanceof HttpError) return e;
  return new HttpError(e.status && e.status < 500 ? e.status : 502, `${what}: ${e.message}`, 'PINTEREST_ERROR', { pinterestStatus: e.status || null });
};

/** POST /api/relay/account {sealed} */
export async function account(request, env) {
  requireConfigured(env);
  const b = await body(request);
  await rateLimit(env, `relay:${clientIp(request)}`, 600, 3600);
  try {
    const r = await withSealed(env, b.sealed, (t) => userAccount(env, t));
    const quota = await quotaFor(env, await acctOf(env, r.conn), DAILY_PIN_LIMIT);
    return out({ username: r.result.username, profile_image: r.result.profile_image, quota }, r.sealed);
  } catch (e) { throw pinterestError(e, 'Could not reach your Pinterest account'); }
}

export async function boards(request, env) {
  requireConfigured(env);
  const b = await body(request);
  await rateLimit(env, `relay:${clientIp(request)}`, 600, 3600);
  try {
    const r = await withSealed(env, b.sealed, (t) => listBoards(env, t));
    return out({ boards: r.result }, r.sealed);
  } catch (e) { throw pinterestError(e, 'Could not load boards'); }
}

export async function newBoard(request, env) {
  requireConfigured(env);
  const b = await body(request);
  await rateLimit(env, `board:${clientIp(request)}`, 30, 3600);
  const name = str(b.name, 180);
  if (!name) throw new HttpError(400, 'Board name is required.', 'BAD_NAME');
  try {
    const r = await withSealed(env, b.sealed, (t) => createBoard(env, t, { name, description: str(b.description, 500), privacy: b.secret ? 'SECRET' : 'PUBLIC' }));
    return out({ board: { id: r.result.id, name: r.result.name, privacy: r.result.privacy } }, r.sealed);
  } catch (e) { throw pinterestError(e, 'Could not create board'); }
}

export async function quota(request, env) {
  const b = await body(request);
  const conn = await unseal(env, b.sealed);
  return json({ quota: await quotaFor(env, await acctOf(env, conn), DAILY_PIN_LIMIT) });
}

/** POST /api/relay/pins: publish one pin, enforcing the per-account daily limit and spacing. */
export async function publish(request, env) {
  requireConfigured(env);
  const b = await body(request);
  await rateLimit(env, `pub:${clientIp(request)}`, 120, 3600);
  const image = String(b.image_base64 || '').replace(/^data:image\/\w+;base64,/, '');
  let imageUrl = null;
  if (!image) imageUrl = safePublicUrl(b.image_url).toString();
  if (image && image.length > 8 * 1024 * 1024) throw new HttpError(413, 'Pin image is too large.', 'TOO_LARGE');
  if (!b.board_id) throw new HttpError(400, 'Choose a board.', 'NO_BOARD');
  if (b.link) safePublicUrl(b.link);
  const conn = await unseal(env, b.sealed);
  const acct = await acctOf(env, conn);
  const slot = await reserveSlot(env, acct, { limit: DAILY_PIN_LIMIT, gapMinutes: MIN_GAP_MINUTES });
  try {
    const r = await withSealed(env, b.sealed, (t) => createPin(env, t, {
      boardId: String(b.board_id), title: str(b.title, 100), description: str(b.description, 800),
      link: str(b.link, 2048), altText: str(b.alt_text, 500), imageBase64: image || null, imageUrl,
      contentType: /^image\/(png|jpeg|webp)$/.test(b.content_type || '') ? b.content_type : 'image/jpeg',
    }));
    await bumpStat(env, 'pins');
    return out({ id: r.result && r.result.id ? String(r.result.id) : null, quota: { used: slot.used, limit: slot.limit } }, r.sealed);
  } catch (e) {
    await releaseSlot(env, slot.id);
    await bumpStat(env, 'pin_errors');
    throw pinterestError(e, 'Pinterest did not accept this pin');
  }
}

export async function analytics(request, env) {
  requireConfigured(env);
  const b = await body(request);
  await rateLimit(env, `relay:${clientIp(request)}`, 600, 3600);
  const d = (x) => new Date(x).toISOString().slice(0, 10);
  const start = d(Math.max(+b.since || 0, Date.now() - 89 * 86400000));
  try {
    const r = await withSealed(env, b.sealed, (t) => pinAnalytics(env, t, String(b.pin_id), start, d(Date.now())));
    const all = (r.result && r.result.all) || {};
    return out({ stats: all.lifetime_metrics || all.summary_metrics || {} }, r.sealed);
  } catch (e) { throw pinterestError(e, 'Stats are not available for this pin yet'); }
}

export { seal };
