// Pinterest API v5 client: OAuth, token refresh, boards, pins, analytics.
import { decryptString, encryptString } from './lib/crypto.js';
import { encKey } from './lib/secrets.js';
import { HttpError } from './lib/http.js';

export const SCOPES = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'];
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
    scope: SCOPES.join(','),
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

/** Returns a valid access token for an account row, refreshing (and saving) when it is close to expiry. */
export async function accessTokenFor(env, account, { force = false } = {}) {
  const key = await encKey(env);
  const soon = Date.now() + 24 * 3600 * 1000;
  if (!force && (!account.access_expires_at || account.access_expires_at > soon)) {
    return decryptString(account.access_token_enc, key);
  }
  if (!account.refresh_token_enc) return decryptString(account.access_token_enc, key);
  const refresh = await decryptString(account.refresh_token_enc, key);
  const t = await refreshToken(env, refresh);
  const now = Date.now();
  const update = {
    access: await encryptString(t.access_token, key),
    refresh: t.refresh_token ? await encryptString(t.refresh_token, key) : account.refresh_token_enc,
    accessExp: t.expires_in ? now + t.expires_in * 1000 : null,
    refreshExp: t.refresh_token_expires_in ? now + t.refresh_token_expires_in * 1000 : account.refresh_expires_at,
  };
  await env.DB.prepare(
    `UPDATE pinterest_accounts SET access_token_enc=?, refresh_token_enc=?, access_expires_at=?, refresh_expires_at=?, status='active' WHERE id=?`,
  ).bind(update.access, update.refresh, update.accessExp, update.refreshExp, account.id).run();
  Object.assign(account, {
    access_token_enc: update.access, refresh_token_enc: update.refresh,
    access_expires_at: update.accessExp, refresh_expires_at: update.refreshExp,
  });
  return t.access_token;
}

/** Calls the API, refreshing the token once on 401. */
export async function withAccount(env, account, fn) {
  let token = await accessTokenFor(env, account);
  try {
    return await fn(token);
  } catch (e) {
    if (e.status === 401 && account.refresh_token_enc) {
      token = await accessTokenFor(env, account, { force: true });
      return fn(token);
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

export function createPin(env, token, { boardId, title, description, link, altText, imageBase64, contentType = 'image/jpeg' }) {
  const body = {
    board_id: boardId,
    media_source: { source_type: 'image_base64', content_type: contentType, data: imageBase64 },
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

export function userAccount(env, token) {
  return pinterestFetch(env, token, '/user_account');
}
