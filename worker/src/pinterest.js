// Pinterest API v5 client: OAuth, token refresh, boards, pins, analytics.
import { decryptString, encryptString } from './lib/crypto.js';
import { encKey } from './lib/secrets.js';
import { HttpError } from './lib/http.js';

export const SCOPES = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'];
// Optional extra scopes (e.g. "ads:read" unlocks Pinterest's own keyword/trend data) via the PINTEREST_EXTRA_SCOPES var.
export function scopes(env) {
  const extra = String(env.PINTEREST_EXTRA_SCOPES || '').split(',').map((x) => x.trim()).filter(Boolean);
  return [...new Set([...SCOPES, ...extra])];
}
const OAUTH_URL = 'https://www.pinterest.com/oauth/';
const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';

export function apiBase(env) {
  return env.PINTEREST_SANDBOX === 'true' ? 'https://api-sandbox.pinterest.com/v5' : 'https://api.pinterest.com/v5';
}

export function pinterestConfigured(env) {
  return !!(env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET);
}

export function redirectUri(request, env) {
  if (env.PINTEREST_REDIRECT_URI) return env.PINTEREST_REDIRECT_URI;
  const u = new URL(request.url);
  return `${u.origin}/api/pinterest/callback`;
}

export function authorizeUrl(env, redirect, state) {
  const p = new URLSearchParams({
    client_id: env.PINTEREST_APP_ID,
    redirect_uri: redirect,
    response_type: 'code',
    scope: scopes(env).join(','),
    state,
  });
  return `${OAUTH_URL}?${p}`;
}

async function tokenRequest(env, params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.PINTEREST_APP_ID}:${env.PINTEREST_APP_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `Pinterest token error: ${data.message || res.status}`, 'PINTEREST_TOKEN');
  return data;
}

export function exchangeCode(env, code, redirect) {
  return tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri: redirect, continuous_refresh: 'true' });
}

export function refreshToken(env, refresh) {
  return tokenRequest(env, { grant_type: 'refresh_token', refresh_token: refresh, continuous_refresh: 'true' });
}

export async function pinterestFetch(env, token, path, init = {}) {
  const res = await fetch(apiBase(env) + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || `Pinterest API error ${res.status}`);
    err.status = res.status;
    err.retryAfter = +(res.headers.get('Retry-After') || 0);
    throw err;
  }
  return data;
}

// ---- Sealed tokens ----
// Pinterest tokens never get stored on AMAWP's Cloudflare. They are sealed (AES-GCM with ENC_KEY) and handed to
// the user's own storage (their browser or their own engine). Only this relay can open them, so tokens issued to
// the AMAWP Pinterest app can only be used through the relay, which enforces the daily safety limit.
export async function seal(env, data) {
  return encryptString(JSON.stringify({ v: 1, ...data }), await encKey(env));
}
export async function unseal(env, sealed) {
  if (!sealed || typeof sealed !== 'string' || sealed.length > 8000) throw new HttpError(401, 'Pinterest connection missing. Please reconnect Pinterest.', 'NO_CONNECTION');
  try {
    const d = JSON.parse(await decryptString(sealed, await encKey(env)));
    if (!d.a || !d.uid) throw new Error('bad');
    return d;
  } catch {
    throw new HttpError(401, 'Pinterest connection is invalid or expired. Please reconnect Pinterest.', 'BAD_CONNECTION');
  }
}

/** Opens a sealed connection, refreshing the access token when it is close to expiry. Returns {conn, sealed (new or null)}. */
export async function openConnection(env, sealed, { force = false } = {}) {
  const conn = await unseal(env, sealed);
  const soon = Date.now() + 24 * 3600 * 1000;
  if (!force && (!conn.ae || conn.ae > soon)) return { conn, sealed: null };
  if (!conn.r) return { conn, sealed: null };
  const t = await refreshToken(env, conn.r);
  const now = Date.now();
  const next = {
    ...conn, a: t.access_token, r: t.refresh_token || conn.r,
    ae: t.expires_in ? now + t.expires_in * 1000 : null,
    re: t.refresh_token_expires_in ? now + t.refresh_token_expires_in * 1000 : conn.re,
  };
  delete next.v;
  return { conn: next, sealed: await seal(env, next) };
}

/** Run fn(token) with a sealed connection, refreshing once on 401. Returns {result, conn, sealed}. */
export async function withSealed(env, sealed, fn) {
  let { conn, sealed: newSealed } = await openConnection(env, sealed);
  try {
    return { result: await fn(conn.a), conn, sealed: newSealed };
  } catch (e) {
    if (e.status === 401 && conn.r) {
      ({ conn, sealed: newSealed } = await openConnection(env, newSealed || sealed, { force: true }));
      return { result: await fn(conn.a), conn, sealed: newSealed };
    }
    throw e;
  }
}

export async function listBoards(env, token) {
  const boards = [];
  let bookmark = '';
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ page_size: '100' });
    if (bookmark) q.set('bookmark', bookmark);
    const data = await pinterestFetch(env, token, `/boards?${q}`);
    for (const b of data.items || []) boards.push({ id: b.id, name: b.name, privacy: b.privacy, pin_count: b.pin_count });
    bookmark = data.bookmark;
    if (!bookmark) break;
  }
  return boards;
}

export function createBoard(env, token, { name, description, privacy = 'PUBLIC' }) {
  return pinterestFetch(env, token, '/boards', {
    method: 'POST',
    body: JSON.stringify({ name, description: description || undefined, privacy }),
  });
}

export function createPin(env, token, { boardId, title, description, link, altText, imageBase64, imageUrl, contentType = 'image/jpeg' }) {
  const body = {
    board_id: boardId,
    media_source: imageBase64
      ? { source_type: 'image_base64', content_type: contentType, data: imageBase64 }
      : { source_type: 'image_url', url: imageUrl },
  };
  if (title) body.title = title.slice(0, 100);
  if (description) body.description = description.slice(0, 800);
  if (link) body.link = link.slice(0, 2048);
  if (altText) body.alt_text = altText.slice(0, 500);
  return pinterestFetch(env, token, '/pins', { method: 'POST', body: JSON.stringify(body) });
}

export function pinAnalytics(env, token, pinId, startDate, endDate) {
  const q = new URLSearchParams({
    start_date: startDate, end_date: endDate,
    metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK',
  });
  return pinterestFetch(env, token, `/pins/${encodeURIComponent(pinId)}/analytics?${q}`);
}

export function suggestedTerms(env, token, term) {
  return pinterestFetch(env, token, `/terms/suggested?term=${encodeURIComponent(term)}&limit=10`);
}
export function relatedTerms(env, token, term) {
  return pinterestFetch(env, token, `/terms/related?terms=${encodeURIComponent(term)}`);
}
export function trendingKeywords(env, token, region = 'US', type = 'growing') {
  return pinterestFetch(env, token, `/trends/keywords/${encodeURIComponent(region)}/top/${encodeURIComponent(type)}?limit=50`);
}

export function userAccount(env, token) {
  return pinterestFetch(env, token, '/user_account');
}
