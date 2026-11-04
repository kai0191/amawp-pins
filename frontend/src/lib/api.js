// API client. "remote" talks to the Cloudflare Worker; "demo" keeps everything in this browser
// so the app is fully usable before the backend is connected (nothing is posted to Pinterest).
import { getApiBase, setApiBase, getToken, setToken } from './config.js';
import { buildPrompt, parseJsonLoose, POLLINATIONS_TEXT, pollinationsImageUrl } from '../../../shared/prompts.js';
import { autoSchedule as planSchedule } from '../../../shared/scheduler.js';
import { PLANS, checkCanConnect } from '../../../shared/plans.js';

export class ApiError extends Error {
  constructor(message, status, code, data) { super(message); this.status = status; this.code = code; this.data = data; }
}

// ---------------- direct free AI (used in demo mode and as a fallback) ----------------
export async function pollinationsText(prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  const res = await fetch(`${POLLINATIONS_TEXT}/${encodeURIComponent(prompt)}?model=openai&seed=${seed}`);
  if (!res.ok) throw new ApiError(`Free AI is busy (${res.status}). Please try again in a minute.`, res.status, 'AI_BUSY');
  return res.text();
}

async function directAiText(task, input) {
  const text = await pollinationsText(buildPrompt(task, input));
  return { text, data: parseJsonLoose(text), provider: 'pollinations' };
}

// ---------------- remote ----------------
function remoteApi(base) {
  async function req(method, path, body, { auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError('Cannot reach the Tackly server. Check your connection and try again.', 0, 'NETWORK');
    }
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      if (res.status === 401 && auth) setToken(null);
      throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status, data && data.code, data);
    }
    return data;
  }
  return {
    mode: 'remote', base,
    health: () => req('GET', '/api/health', null, { auth: false }),
    async signup(b) { const d = await req('POST', '/api/auth/signup', b, { auth: false }); setToken(d.token); return d.user; },
    async login(b) { const d = await req('POST', '/api/auth/login', b, { auth: false }); setToken(d.token); return d.user; },
    async me() { if (!getToken()) return null; try { return (await req('GET', '/api/me')).user; } catch (e) { if (e.status === 401) return null; throw e; } },
    pinterestLoginUrl: () => `${base}/api/pinterest/login`,
    logout: () => setToken(null),
    updateSettings: async (s) => (await req('PUT', '/api/me/settings', s)).user,
    changePassword: (b) => req('POST', '/api/me/password', b),
    deleteMe: async () => { await req('DELETE', '/api/me'); setToken(null); },
    exportMe: () => req('GET', '/api/me/export'),
    getAiSettings: async () => (await req('GET', '/api/ai/settings')).ai,
    putAiSettings: async (b) => (await req('PUT', '/api/ai/settings', b)).ai,
    async aiText(task, input) {
      try { return await req('POST', '/api/ai/text', { task, input }); }
      catch (e) { if (e.code === 'AI_ERROR' || e.status === 429) throw e; return directAiText(task, input); }
    },
    aiImage: (prompt) => req('POST', '/api/ai/image', { prompt }),
    accounts: async () => (await req('GET', '/api/accounts')).accounts,
    connectPinterest: async () => (await req('POST', '/api/pinterest/connect')).url,
    removeAccount: (id) => req('DELETE', `/api/accounts/${id}`),
    boards: async (id) => (await req('GET', `/api/accounts/${id}/boards`)).boards,
    createBoard: async (id, b) => (await req('POST', `/api/accounts/${id}/boards`, b)).board,
    pins: async () => (await req('GET', '/api/pins')).pins,
    createPin: async (b) => (await req('POST', '/api/pins', b)).pin,
    updatePin: async (id, b) => (await req('PATCH', `/api/pins/${id}`, b)).pin,
    deletePin: (id) => req('DELETE', `/api/pins/${id}`),
    async postNow(id) {
      try { return await req('POST', `/api/pins/${id}/post-now`); }
      catch (e) { if (e.data && e.data.pin) return e.data; throw e; }
    },
    autoSchedule: (b) => req('POST', '/api/pins/auto-schedule', b),
    pinStats: (id) => req('GET', `/api/pins/${id}/stats`),
    log: async () => (await req('GET', '/api/log')).log,
    waitlist: (b) => req('POST', '/api/waitlist', b, { auth: !!getToken() }),
    admin: () => req('GET', '/api/admin/overview'),
    setUserPlan: (id, planId) => req('PUT', `/api/admin/users/${id}/plan`, { planId }),
  };
}

// ---------------- demo (local) ----------------
const LS = 'tackly.demo.v1';
const uid = (p) => p + Math.random().toString(36).slice(2, 10);
function load() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; }
}
function save(s) {
  try { localStorage.setItem(LS, JSON.stringify(s)); }
  catch { throw new ApiError('Browser storage is full. Delete some demo pins and try again.', 507, 'STORAGE_FULL'); }
}

function demoApi() {
  const state = () => {
    const s = load();
    s.pins ||= []; s.accounts ||= []; s.boards ||= {}; s.log ||= []; s.waitlist ||= [];
    return s;
  };
  const publicUser = (s) => s.user && {
    ...s.user, plan: PLANS.free, isAdmin: true, demo: true,
    usage: {
      accounts: s.accounts.length,
      scheduled: s.pins.filter((p) => p.status === 'scheduled').length,
      posted: s.pins.filter((p) => p.status === 'posted').length,
      failed: s.pins.filter((p) => p.status === 'failed').length,
      drafts: s.pins.filter((p) => p.status === 'draft').length,
    },
  };
  const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  function runDue() {
    const s = state();
    let changed = false;
    for (const p of s.pins) {
      if (p.status === 'scheduled' && p.scheduled_at <= Date.now()) {
        Object.assign(p, { status: 'posted', posted_at: Date.now(), pinterest_pin_id: null, last_error: null });
        s.log.unshift({ at: Date.now(), ok: 1, message: 'Demo mode: marked as posted (nothing was sent to Pinterest).', pin_id: p.id, title: p.title });
        changed = true;
      }
    }
    if (changed) save(s);
  }
  if (typeof window !== 'undefined') setInterval(runDue, 30000);

  const api = {
    mode: 'demo', base: '',
    health: async () => ({ ok: true, demo: true, pinterestConfigured: false }),
    async signup({ email, name, timezone }) {
      await delay();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) throw new ApiError('Please enter a valid email address.', 400);
      const s = state();
      s.user = { id: uid('u_'), email: email.toLowerCase(), name: name || email.split('@')[0], createdAt: Date.now(), settings: { timezone } };
      save(s); setToken('demo');
      return publicUser(s);
    },
    async login({ email }) { return api.signup({ email, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); },
    async me() { runDue(); const s = state(); return getToken() === 'demo' && s.user ? publicUser(s) : null; },
    pinterestLoginUrl: () => null,
    logout: () => setToken(null),
    async updateSettings(patch) {
      const s = state();
      if ('name' in patch) s.user.name = patch.name;
      s.user.settings = { ...(s.user.settings || {}), ...patch };
      delete s.user.settings.name;
      save(s); return publicUser(s);
    },
    changePassword: async () => ({ ok: true }),
    async deleteMe() { localStorage.removeItem(LS); setToken(null); },
    exportMe: async () => state(),
    getAiSettings: async () => state().ai || {},
    async putAiSettings(b) { const s = state(); s.ai = { ...(s.ai || {}), ...b }; save(s); return s.ai; },
    async aiText(task, input) {
      const ai = state().ai || {};
      if (ai.textBaseUrl && ai.textKey && !String(ai.textKey).includes('••••')) {
        const r = await fetch(`${ai.textBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.textKey}` },
          body: JSON.stringify({ model: ai.textModel || 'gpt-4o-mini', messages: [{ role: 'user', content: buildPrompt(task, input) }] }),
        });
        const d = await r.json();
        if (!r.ok) throw new ApiError(d.error?.message || 'AI provider error', r.status);
        const text = d.choices?.[0]?.message?.content || '';
        return { text, data: parseJsonLoose(text), provider: 'custom' };
      }
      return directAiText(task, input);
    },
    aiImage: async (prompt) => ({ url: pollinationsImageUrl(prompt), provider: 'pollinations' }),
    accounts: async () => state().accounts,
    async connectPinterest() {
      const s = state();
      const check = checkCanConnect(PLANS.free, s.accounts.length);
      if (!check.ok) throw new ApiError(check.message, 402, 'PLAN_LIMIT', { upgrade: true });
      throw new ApiError('Demo mode: the Pinterest backend is not connected yet, so a real account cannot be linked. You can add a demo account to try scheduling.', 503, 'PINTEREST_NOT_CONFIGURED');
    },
    async addDemoAccount() {
      const s = state();
      const check = checkCanConnect(PLANS.free, s.accounts.length);
      if (!check.ok) throw new ApiError(check.message, 402, 'PLAN_LIMIT', { upgrade: true });
      const a = { id: uid('pa_'), username: 'demo_pinner', status: 'demo', created_at: Date.now() };
      s.accounts.push(a);
      s.boards[a.id] = [
        { id: uid('b_'), name: 'Home Decor Ideas' }, { id: uid('b_'), name: 'Easy Recipes' },
        { id: uid('b_'), name: 'Travel Tips' }, { id: uid('b_'), name: 'DIY Projects' },
      ];
      save(s); return a;
    },
    async removeAccount(id) { const s = state(); s.accounts = s.accounts.filter((a) => a.id !== id); save(s); },
    boards: async (id) => state().boards[id] || [],
    async createBoard(id, { name }) { const s = state(); const b = { id: uid('b_'), name }; (s.boards[id] ||= []).push(b); save(s); return b; },
    pins: async () => { runDue(); return state().pins.slice().sort((a, b) => (b.scheduled_at || b.created_at) - (a.scheduled_at || a.created_at)); },
    async createPin(b) {
      const s = state();
      const now = Date.now();
      if (b.status === 'scheduled' && (!b.accountId || !b.boardId || !b.scheduledAt)) throw new ApiError('To schedule a pin, choose an account, a board and a time.', 400);
      const pin = {
        id: uid('p_'), account_id: b.accountId || null, board_id: b.boardId || null, board_name: b.boardName || null,
        title: b.title || '', description: b.description || '', link: b.link || '', alt_text: b.altText || '',
        template_id: b.templateId, batch_id: b.batchId || null, thumb: b.thumb, status: b.status === 'scheduled' ? 'scheduled' : 'draft',
        scheduled_at: b.scheduledAt || null, attempts: 0, last_error: null, created_at: now, updated_at: now,
      };
      s.pins.push(pin); save(s); return pin;
    },
    async updatePin(id, b) {
      const s = state();
      const p = s.pins.find((x) => x.id === id);
      if (!p) throw new ApiError('Pin not found', 404);
      const map = { title: 'title', description: 'description', link: 'link', altText: 'alt_text', boardId: 'board_id', boardName: 'board_name', accountId: 'account_id', scheduledAt: 'scheduled_at', status: 'status' };
      for (const [k, col] of Object.entries(map)) if (k in b) p[col] = b[k];
      if ('scheduledAt' in b && !('status' in b) && p.status !== 'draft') p.status = 'scheduled';
      if (p.status === 'scheduled' && (!p.account_id || !p.board_id || !p.scheduled_at)) throw new ApiError('To schedule a pin, choose an account, a board and a time.', 400);
      p.updated_at = Date.now(); p.last_error = null;
      save(s); return p;
    },
    async deletePin(id) { const s = state(); s.pins = s.pins.filter((p) => p.id !== id); save(s); },
    async postNow(id) {
      await delay(500);
      const s = state();
      const p = s.pins.find((x) => x.id === id);
      if (!p.account_id || !p.board_id) throw new ApiError('Choose a Pinterest account and board first.', 400);
      Object.assign(p, { status: 'posted', posted_at: Date.now(), last_error: null });
      s.log.unshift({ at: Date.now(), ok: 1, message: 'Demo mode: marked as posted (nothing was sent to Pinterest).', pin_id: p.id, title: p.title });
      save(s);
      return { result: { status: 'posted' }, pin: p };
    },
    async autoSchedule(b) {
      const s = state();
      const ids = new Set(b.pinIds);
      const pins = s.pins.filter((p) => ids.has(p.id));
      const existing = s.pins.filter((p) => p.status === 'scheduled' && !ids.has(p.id)).map((p) => p.scheduled_at);
      const plan = planSchedule(
        pins.map((p) => ({ id: p.id, link: p.link, boardIds: b.boardIds?.length ? b.boardIds : p.board_id ? [p.board_id] : [] })),
        { timezone: b.timezone, minPerDay: b.minPerDay, maxPerDay: b.maxPerDay, windows: b.windows, startDate: b.startDate, existing },
      );
      let n = 0; const skipped = [];
      for (const it of plan) {
        const p = s.pins.find((x) => x.id === it.id);
        const acc = b.accountId || p.account_id;
        if (!acc || !it.boardId) { skipped.push(p.id); continue; }
        Object.assign(p, { status: 'scheduled', scheduled_at: it.scheduledAt, board_id: it.boardId, board_name: b.boardNames?.[it.boardId] || p.board_name, account_id: acc, attempts: 0, last_error: null });
        n++;
      }
      save(s);
      return { scheduled: n, skipped, plan };
    },
    pinStats: async () => { throw new ApiError('Stats are available once your real Pinterest account is connected.', 400); },
    log: async () => state().log,
    async waitlist(b) { const s = state(); s.waitlist.push({ ...b, at: Date.now() }); save(s); return { ok: true }; },
    async admin() {
      const s = state();
      const demand = {};
      for (const w of s.waitlist) for (const f of w.features || []) demand[f] = (demand[f] || 0) + 1;
      return {
        demo: true,
        totals: { users: s.user ? 1 : 0, users_7d: s.user ? 1 : 0, accounts: s.accounts.length, posted: s.pins.filter((p) => p.status === 'posted').length, posted_7d: 0, scheduled: s.pins.filter((p) => p.status === 'scheduled').length, failed: 0, waitlist: s.waitlist.length },
        demand: Object.entries(demand).map(([feature, n]) => ({ feature, n })),
        users: s.user ? [{ ...s.user, plan_id: 'free', accounts: s.accounts.length, posted: 0, scheduled: 0, created_at: s.user.createdAt }] : [],
        waitlist: s.waitlist.flatMap((w) => (w.features || []).map((f) => ({ email: w.email || s.user?.email, feature: f, note: w.note, created_at: w.at }))),
        failures: [], plans: Object.values(PLANS),
      };
    },
    setUserPlan: async () => ({ ok: true }),
  };
  return api;
}

let current = null;
export const api = new Proxy({}, { get: (_, k) => current[k] });

/** Decide remote vs demo. Returns { mode, health }. */
export async function initApi() {
  const base = getApiBase();
  if (base) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`${base}/api/health`, { signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) {
        const health = await r.json();
        current = remoteApi(base);
        return { mode: 'remote', health };
      }
    } catch { /* fall back to demo */ }
  }
  setApiBase('');
  current = demoApi();
  return { mode: 'demo', health: { ok: true, demo: true, pinterestConfigured: false }, attempted: base || null };
}
