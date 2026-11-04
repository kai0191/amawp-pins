// Data layer.
// - relay: AMAWP's Worker. Pinterest login, publishing (with the 10/day safety limit), keyword research, page info.
//          It stores NO user data.
// - store: where the user's own data lives. "local" = this browser (IndexedDB). "engine" = the user's own Cloudflare Worker.
import { getRelayBase, setRelayBase, getDataHome } from './config.js';
import { ldb } from './localdb.js';
import { buildPrompt, parseJsonLoose, POLLINATIONS_TEXT, pollinationsImageUrl } from '../../../shared/prompts.js';
import { autoSchedule as planSchedule, backoffMs, MAX_ATTEMPTS } from '../../../shared/scheduler.js';
import { checkDailyLimit, MAX_PINTEREST_ACCOUNTS, MAX_STORED_PINS } from '../../../shared/limits.js';

export class ApiError extends Error {
  constructor(message, status, code, data) { super(message); this.status = status; this.code = code; this.data = data || {}; }
}

async function http(base, method, path, body, headers = {}) {
  let res;
  try {
    res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Network problem. Check your connection and try again.', 0, 'NETWORK');
  }
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status, data && data.code, data);
  return data;
}

// ---------------- free AI (direct from the browser) ----------------
export async function pollinationsText(prompt) {
  const res = await fetch(`${POLLINATIONS_TEXT}/${encodeURIComponent(prompt)}?model=openai&seed=${Math.floor(Math.random() * 1e9)}`);
  if (!res.ok) throw new ApiError(`Free AI is busy (${res.status}). Please try again in a minute.`, res.status, 'AI_BUSY');
  return res.text();
}
async function aiWith(settings, task, input) {
  const prompt = buildPrompt(task, input);
  if (settings && settings.textBaseUrl && settings.textKey && !String(settings.textKey).includes('••••')) {
    const r = await fetch(`${settings.textBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.textKey}` },
      body: JSON.stringify({ model: settings.textModel || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(d.error?.message || `AI provider error ${r.status}`, r.status, 'AI_ERROR');
    const text = d.choices?.[0]?.message?.content || '';
    return { text, data: parseJsonLoose(text), provider: 'custom' };
  }
  const text = await pollinationsText(prompt);
  return { text, data: parseJsonLoose(text), provider: 'pollinations' };
}
async function imageWith(settings, prompt) {
  if (settings && settings.imageBaseUrl && settings.imageKey && !String(settings.imageKey).includes('••••')) {
    const r = await fetch(`${settings.imageBaseUrl.replace(/\/+$/, '')}/images/generations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.imageKey}` },
      body: JSON.stringify({ model: settings.imageModel || 'gpt-image-1', prompt, n: 1, size: '1024x1536' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(d.error?.message || `Image provider error ${r.status}`, r.status, 'AI_ERROR');
    const it = d.data?.[0] || {};
    if (it.b64_json) return { b64: it.b64_json, provider: 'custom' };
    if (it.url) return { url: it.url, provider: 'custom' };
    throw new ApiError('The image provider returned no image.', 502);
  }
  return { url: pollinationsImageUrl(prompt), provider: 'pollinations' };
}

// ---------------- relay client ----------------
function relayClient(base) {
  const post = (path, body) => http(base, 'POST', path, body);
  return {
    base,
    health: () => http(base, 'GET', '/api/health'),
    connectUrl: async () => (await post('/api/pinterest/connect')).url,
    account: (sealed) => post('/api/relay/account', { sealed }),
    boards: (sealed) => post('/api/relay/boards', { sealed }),
    createBoard: (sealed, b) => post('/api/relay/boards/create', { sealed, ...b }),
    publish: (sealed, b) => post('/api/relay/pins', { sealed, ...b }),
    quota: (sealed) => post('/api/relay/quota', { sealed }),
    analytics: (sealed, b) => post('/api/relay/analytics', { sealed, ...b }),
    keywords: (seed, sealed) => post('/api/keywords', { seed, sealed }),
    trends: (sealed, region) => post('/api/trends', { sealed, region }),
    pageInfo: (url) => http(base, 'GET', `/api/page-info?url=${encodeURIComponent(url)}`),
    images: (q, page = 1) => http(base, 'GET', `/api/images?q=${encodeURIComponent(q)}&page=${page}`),
    imgProxyUrl: (url) => `${base}/api/img?url=${encodeURIComponent(url)}`,
    ownerStats: (key) => http(base, 'GET', '/api/admin/stats', null, { Authorization: `Bearer ${key}` }),
  };
}

const uid = (p) => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => Date.now();

// ---------------- local (browser) store ----------------
function localStore(relay, health) {
  const preview = !relay || !health?.pinterestConfigured;
  async function allPins() { return (await ldb.all('pins')).sort((a, b) => (b.scheduled_at || b.created_at) - (a.scheduled_at || a.created_at)); }
  async function getPin(id) { const p = await ldb.get('pins', id); if (!p) throw new ApiError('Pin not found.', 404); return p; }
  async function getAccount(id) {
    const list = await ldb.all('accounts');
    const a = id ? list.find((x) => x.id === id) : list[0];
    if (!a) throw new ApiError('Connect a Pinterest account first (Accounts).', 400, 'NO_ACCOUNT');
    return a;
  }
  async function viaRelay(account, fn) {
    if (account.demo) throw new ApiError('Preview account: connect real Pinterest when the Tackly server is live.', 400, 'PREVIEW');
    const r = await fn(account.sealed);
    if (r && r.sealed) { account.sealed = r.sealed; await ldb.put('accounts', account); }
    return r;
  }
  async function log(pin, ok, message) { await ldb.put('log', { id: uid('l_'), at: now(), ok: ok ? 1 : 0, message, pin_id: pin.id, title: pin.title }); }
  async function limitCheck(pin, at) {
    const tz = (await ldb.getSetting('profile', {})).timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const msg = checkDailyLimit(await ldb.all('pins'), { id: pin.id, accountId: pin.account_id, at, tz });
    if (msg) throw new ApiError(msg, 400, 'DAILY_LIMIT');
  }

  async function publish(pin) {
    const account = await getAccount(pin.account_id);
    if (pin.design_json) throw new ApiError('This AI design still needs rendering. Open Schedule to render it.', 400, 'NEEDS_RENDER');
    if (account.demo) {
      Object.assign(pin, { status: 'posted', posted_at: now(), last_error: null });
      await ldb.put('pins', pin); await log(pin, true, 'Preview: marked as posted (nothing was sent to Pinterest).');
      return { status: 'posted' };
    }
    const image = await ldb.getImage(pin.id);
    try {
      const r = await viaRelay(account, (sealed) => relay.publish(sealed, {
        board_id: pin.board_id, title: pin.title, description: pin.description, link: pin.link, alt_text: pin.alt_text,
        ...(image ? { image_base64: image, content_type: 'image/jpeg' } : { image_url: pin.image_url }),
      }));
      Object.assign(pin, { status: 'posted', posted_at: now(), pinterest_pin_id: r.id || null, last_error: null });
      await ldb.put('pins', pin); await ldb.delImage(pin.id);
      await log(pin, true, `Posted${r.id ? ` as pin ${r.id}` : ''}${r.quota ? ` (${r.quota.used}/${r.quota.limit} in 24h)` : ''}`);
      return { status: 'posted', pinterestPinId: r.id };
    } catch (e) {
      if (e.code === 'DAILY_LIMIT' || e.code === 'TOO_SOON') {
        Object.assign(pin, { status: 'scheduled', next_attempt_at: (e.data.nextAt || now() + 900000) + 120000, scheduled_at: pin.scheduled_at || now(), last_error: `Waiting for a safe slot: ${e.message}` });
        await ldb.put('pins', pin);
        return { status: 'scheduled', error: e.message };
      }
      const attempts = (pin.attempts || 0) + 1;
      const permanent = e.status >= 400 && e.status < 500 && ![408, 429].includes(e.status);
      if (permanent || attempts >= MAX_ATTEMPTS) Object.assign(pin, { status: 'failed', attempts, last_error: e.message });
      else Object.assign(pin, { status: 'scheduled', attempts, last_error: e.message, next_attempt_at: now() + backoffMs(attempts) });
      await ldb.put('pins', pin); await log(pin, false, e.message);
      return { status: pin.status, error: e.message };
    }
  }

  let running = false;
  async function runDue() {
    if (running) return [];
    running = true;
    try {
      // Only one tab posts at a time.
      const lock = +localStorage.getItem('tackly.runner') || 0;
      if (now() - lock < 50000 && sessionStorage.getItem('tackly.runnerOwner') !== '1') return [];
      localStorage.setItem('tackly.runner', String(now())); sessionStorage.setItem('tackly.runnerOwner', '1');
      const due = (await ldb.all('pins')).filter((p) => p.status === 'scheduled' && !p.design_json && (p.next_attempt_at || p.scheduled_at) <= now())
        .sort((a, b) => (a.next_attempt_at || a.scheduled_at) - (b.next_attempt_at || b.scheduled_at));
      const out = [];
      if (due[0]) out.push(await publish(due[0])); // one per minute keeps spacing natural
      return out;
    } finally { running = false; }
  }

  return {
    mode: 'local', preview,
    async info() {
      const pins = await ldb.all('pins');
      const c = (s) => pins.filter((p) => p.status === s).length;
      return { overview: { drafts: c('draft'), scheduled: c('scheduled'), posted: c('posted'), failed: c('failed'), needs_render: pins.filter((p) => p.design_json).length, accounts: (await ldb.all('accounts')).length }, profile: await ldb.getSetting('profile', {}) };
    },
    getProfile: () => ldb.getSetting('profile', {}),
    async saveProfile(p) { await ldb.setSetting('profile', p); return p; },
    getAiSettings: () => ldb.getSetting('ai', {}),
    async putAiSettings(b) { const cur = await ldb.getSetting('ai', {}); const next = { ...cur, ...b }; for (const k of ['textKey', 'imageKey']) if (k in b && !b[k]) delete next[k]; await ldb.setSetting('ai', next); return next; },
    accounts: () => ldb.all('accounts'),
    async addAccount({ sealed, username, profile_image, demo }) {
      const list = await ldb.all('accounts');
      const same = list.find((a) => a.username === username);
      if (same) { Object.assign(same, { sealed, profile_image, status: 'active' }); await ldb.put('accounts', same); return same.id; }
      if (list.length >= MAX_PINTEREST_ACCOUNTS) throw new ApiError(`A workspace can connect ${MAX_PINTEREST_ACCOUNTS} Pinterest account. Disconnect the current one first.`, 400, 'ACCOUNT_LIMIT');
      const a = { id: uid('pa_'), username, profile_image, sealed, demo: !!demo, status: demo ? 'preview' : 'active', created_at: now() };
      await ldb.put('accounts', a);
      return a.id;
    },
    async removeAccount(id) {
      for (const p of await ldb.all('pins')) if (p.account_id === id && ['scheduled', 'failed'].includes(p.status)) await ldb.put('pins', { ...p, status: 'draft' });
      await ldb.del('accounts', id);
    },
    async boards(id) {
      const a = await getAccount(id);
      if (a.demo) return a.boards || [];
      return (await viaRelay(a, (s) => relay.boards(s))).boards;
    },
    async createBoard(id, b) {
      const a = await getAccount(id);
      if (a.demo) { const board = { id: uid('b_'), name: b.name }; a.boards = [...(a.boards || []), board]; await ldb.put('accounts', a); return board; }
      return (await viaRelay(a, (s) => relay.createBoard(s, b))).board;
    },
    async quota(id) { const a = await getAccount(id); if (a.demo) return null; return (await viaRelay(a, (s) => relay.quota(s))).quota; },
    pins: allPins,
    async createPin(b) {
      const pins = await ldb.all('pins');
      if (pins.filter((p) => p.status !== 'posted').length >= MAX_STORED_PINS) throw new ApiError(`You have ${MAX_STORED_PINS} unposted pins. Delete some first.`, 400);
      const accounts = await ldb.all('accounts');
      const pin = {
        id: uid('p_'), account_id: b.accountId || accounts[0]?.id || null, board_id: b.boardId || null, board_name: b.boardName || null,
        title: b.title || '', description: b.description || '', link: b.link || '', alt_text: b.altText || '', keyword: b.keyword || '',
        template_id: b.templateId || null, batch_id: b.batchId || null, thumb: b.thumb || null, image_url: b.imageUrl || null,
        design_json: b.design ? JSON.stringify(b.design) : null, source: b.source || 'app',
        status: b.status === 'scheduled' ? 'scheduled' : 'draft', scheduled_at: b.scheduledAt || null, next_attempt_at: b.scheduledAt || null,
        attempts: 0, last_error: null, created_at: now(), updated_at: now(),
      };
      if (pin.status === 'scheduled') {
        if (!pin.account_id || !pin.board_id || !pin.scheduled_at) throw new ApiError('To schedule a pin, choose an account, a board and a time.', 400);
        await limitCheck(pin, pin.scheduled_at);
      }
      if (b.image) await ldb.setImage(pin.id, String(b.image).replace(/^data:image\/\w+;base64,/, ''));
      await ldb.put('pins', pin);
      return pin;
    },
    async updatePin(id, b) {
      const p = await getPin(id);
      if (p.status === 'posted') throw new ApiError('This pin is already posted.', 409);
      const map = { title: 'title', description: 'description', link: 'link', altText: 'alt_text', boardId: 'board_id', boardName: 'board_name', accountId: 'account_id', scheduledAt: 'scheduled_at', status: 'status', keyword: 'keyword' };
      const prev = { ...p };
      for (const [k, col] of Object.entries(map)) if (k in b) p[col] = b[k];
      if ('scheduledAt' in b && !('status' in b) && p.status !== 'draft') p.status = 'scheduled';
      if (p.status === 'scheduled') {
        if (!p.account_id || !p.board_id || !p.scheduled_at) throw new ApiError('To schedule a pin, choose an account, a board and a time.', 400);
        if (prev.status !== 'scheduled' || prev.scheduled_at !== p.scheduled_at) await limitCheck(p, p.scheduled_at);
        p.next_attempt_at = p.scheduled_at; p.attempts = 0;
      }
      p.updated_at = now(); p.last_error = null;
      await ldb.put('pins', p);
      return p;
    },
    async setPinImage(id, { image, thumb }) {
      const p = await getPin(id);
      await ldb.setImage(id, String(image).replace(/^data:image\/\w+;base64,/, ''));
      Object.assign(p, { thumb, design_json: null, updated_at: now() });
      await ldb.put('pins', p);
      return p;
    },
    async deletePin(id) { await ldb.del('pins', id); await ldb.delImage(id); },
    async postNow(id) {
      const p = await getPin(id);
      if (!p.account_id || !p.board_id) throw new ApiError('Choose a Pinterest account and board first.', 400);
      const result = await publish(p);
      return { result, pin: await getPin(id) };
    },
    async autoSchedule(b) {
      const all = await ldb.all('pins');
      const ids = new Set(b.pinIds);
      const pins = all.filter((p) => ids.has(p.id));
      const accounts = await ldb.all('accounts');
      const acc = b.accountId || accounts[0]?.id;
      const existing = all.filter((p) => ['scheduled', 'posted'].includes(p.status) && !ids.has(p.id) && p.account_id === acc).map((p) => p.scheduled_at || p.posted_at).filter(Boolean);
      const plan = planSchedule(pins.map((p) => ({ id: p.id, link: p.link, boardIds: b.boardIds?.length ? b.boardIds : p.board_id ? [p.board_id] : [] })),
        { timezone: b.timezone, minPerDay: b.minPerDay, maxPerDay: b.maxPerDay, windows: b.windows, startDate: b.startDate, existing });
      let n = 0; const skipped = [];
      for (const it of plan) {
        const p = pins.find((x) => x.id === it.id);
        if (!acc || !it.boardId) { skipped.push(p.id); continue; }
        Object.assign(p, { status: 'scheduled', scheduled_at: it.scheduledAt, next_attempt_at: it.scheduledAt, board_id: it.boardId, board_name: b.boardNames?.[it.boardId] || p.board_name, account_id: acc, attempts: 0, last_error: null });
        await ldb.put('pins', p); n++;
      }
      return { scheduled: n, skipped, plan };
    },
    async pinStats(id) {
      const p = await getPin(id);
      if (!p.pinterest_pin_id) throw new ApiError('Stats are available for pins posted to Pinterest.', 400);
      const a = await getAccount(p.account_id);
      return { stats: (await viaRelay(a, (s) => relay.analytics(s, { pin_id: p.pinterest_pin_id, since: p.posted_at }))).stats };
    },
    log: async () => (await ldb.all('log')).sort((a, b) => b.at - a.at).slice(0, 200),
    aiText: async (task, input) => aiWith(await ldb.getSetting('ai', {}), task, input),
    aiImage: async (prompt) => imageWith(await ldb.getSetting('ai', {}), prompt),
    async keywords(seed) {
      if (!relay) throw new ApiError('Keyword research needs the Tackly server.', 503);
      const a = (await ldb.all('accounts'))[0];
      const r = await relay.keywords(seed, a && !a.demo ? a.sealed : undefined);
      if (r.sealed && a) { a.sealed = r.sealed; await ldb.put('accounts', a); }
      return r;
    },
    async trends(region) { const a = await getAccount(); return viaRelay(a, (s) => relay.trends(s, region)); },
    runDue,
    async exportAll() {
      const pins = await ldb.all('pins');
      const images = {};
      for (const p of pins) { const im = await ldb.getImage(p.id); if (im) images[p.id] = im; }
      return { version: 2, exportedAt: new Date().toISOString(), profile: await ldb.getSetting('profile', {}), pins, images, log: await ldb.all('log') };
    },
    async importAll(d) {
      if (!d || !Array.isArray(d.pins)) throw new ApiError('That file is not a Tackly backup.', 400);
      if (d.profile) await ldb.setSetting('profile', d.profile);
      for (const p of d.pins) await ldb.put('pins', p);
      for (const [k, v] of Object.entries(d.images || {})) await ldb.setImage(k, v);
      return d.pins.length;
    },
    wipe: () => ldb.wipe(),
    getImage: (id) => ldb.getImage(id),
  };
}

// ---------------- engine store (user's own Cloudflare) ----------------
function engineStore(home, relay) {
  const base = home.url.replace(/\/+$/, '');
  const h = { Authorization: `Bearer ${home.key}` };
  const e = (method, path, body) => http(base, method, path, body, h);
  return {
    mode: 'engine', preview: false, base, mcpUrl: `${base}/mcp/${home.key}`,
    info: () => e('GET', '/api/info'),
    async getProfile() { return (await e('GET', '/api/info')).profile || {}; },
    async saveProfile(profile) { return (await e('PUT', '/api/settings', { profile, ...(relay ? { relayUrl: relay.base } : {}) })).profile; },
    async getAiSettings() { return (await e('GET', '/api/ai-settings')).ai; },
    async putAiSettings(b) { return (await e('PUT', '/api/ai-settings', b)).ai; },
    accounts: async () => (await e('GET', '/api/accounts')).accounts,
    addAccount: async (b) => (await e('POST', '/api/accounts', b)).id,
    removeAccount: (id) => e('DELETE', `/api/accounts/${id}`),
    boards: async (id) => (await e('GET', `/api/accounts/${id}/boards`)).boards,
    createBoard: async (id, b) => (await e('POST', `/api/accounts/${id}/boards`, b)).board,
    quota: async (id) => (await e('GET', `/api/accounts/${id}/quota`)).quota,
    pins: async () => (await e('GET', '/api/pins')).pins,
    createPin: async (b) => (await e('POST', '/api/pins', b)).pin,
    updatePin: async (id, b) => (await e('PATCH', `/api/pins/${id}`, b)).pin,
    setPinImage: async (id, b) => (await e('POST', `/api/pins/${id}/image`, b)).pin,
    deletePin: (id) => e('DELETE', `/api/pins/${id}`),
    async postNow(id) { try { return await e('POST', `/api/pins/${id}/post-now`); } catch (err) { if (err.data && err.data.pin) return err.data; throw err; } },
    autoSchedule: (b) => e('POST', '/api/pins/auto-schedule', b),
    pinStats: (id) => e('GET', `/api/pins/${id}/stats`),
    log: async () => (await e('GET', '/api/log')).log,
    async aiText(task, input) { try { return await e('POST', '/api/ai/text', { task, input }); } catch (err) { if (err.code === 'AI_ERROR') throw err; return aiWith({}, task, input); } },
    aiImage: async (prompt) => imageWith({}, prompt),
    keywords: (seed) => e('POST', '/api/keywords', { seed }),
    async trends() { throw new ApiError('Pinterest Trends is available in browser mode for now.', 400); },
    runDue: async () => [],
    exportAll: async () => ({ version: 2, exportedAt: new Date().toISOString(), profile: (await e('GET', '/api/info')).profile, pins: (await e('GET', '/api/pins')).pins, images: {} }),
    async importAll(d) {
      let n = 0;
      for (const p of d.pins || []) {
        if (p.status === 'posted') continue;
        const image = d.images?.[p.id];
        if (!image && !p.image_url && !p.design_json) continue;
        await e('POST', '/api/pins', { image, imageUrl: p.image_url, design: p.design_json, title: p.title, description: p.description, link: p.link, altText: p.alt_text, keyword: p.keyword, boardId: p.board_id, boardName: p.board_name, thumb: p.thumb, templateId: p.template_id });
        n++;
      }
      return n;
    },
    wipe: async () => { throw new ApiError('Delete your engine data from your Cloudflare dashboard (Workers & Pages > tackly-engine).', 400); },
    getImage: async () => null,
  };
}

// ---------------- bootstrap ----------------
let current = null;
let relayC = null;
let lastHealth = null;
export const api = new Proxy({}, { get: (_, k) => (k === 'relay' ? relayC : current[k]) });

export async function testEngine(url, key) {
  const base = url.replace(/\/+$/, '');
  const health = await http(base, 'GET', '/api/health');
  if (!health.engine) throw new ApiError('That URL is not a Tackly engine.', 400);
  await http(base, 'GET', '/api/info', null, { Authorization: `Bearer ${key}` });
  return health;
}

export async function initApi() {
  const base = getRelayBase();
  let health = null;
  if (base) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`${base}/api/health`, { signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) health = await r.json();
    } catch { /* relay unreachable */ }
  }
  lastHealth = health;
  relayC = health ? relayClient(base) : null;
  if (!health) setRelayBase('');
  const home = getDataHome();
  let engineError = null;
  if (home.mode === 'engine' && home.url && home.key) {
    current = engineStore(home, relayC);
    try { await current.info(); } catch (e) { engineError = e.message; }
  } else {
    current = localStore(relayC, health);
  }
  return { relay: !!relayC, health, home, engineError };
}

export function useLocalStoreNow() {
  current = localStore(relayC, lastHealth);
}
