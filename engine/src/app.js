// Tackly engine: the user's OWN Worker on their own Cloudflare account. Stores their pins, images and
// Pinterest connection, posts on schedule, and exposes an MCP server for AI assistants.
import * as core from './core.js';
import { ensureSchema, getSetting, setSetting } from './db.js';
import { handleMcp } from './mcp.js';
import { RelayError } from './relay.js';

export const VERSION = '2.0.0';

function cors(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,Mcp-Session-Id,Mcp-Protocol-Version',
    'Access-Control-Max-Age': '86400', Vary: 'Origin',
  };
}
const json = (d, status = 200) => Response.json(d, { status });

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function authorized(request, env, pathKey) {
  if (!env.ENGINE_KEY || env.ENGINE_KEY.length < 12) return false;
  const h = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return safeEqual(h, env.ENGINE_KEY) || (pathKey != null && safeEqual(pathKey, env.ENGINE_KEY));
}

const mask = (k) => (k ? `${k.slice(0, 3)}••••${k.slice(-4)}` : '');

const R = [];
const route = (method, path, fn) => {
  const keys = [];
  const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}/?$`);
  R.push({ method, re, keys, fn });
};
const body = async (req) => { try { return await req.json(); } catch { throw new core.EngineError(400, 'Invalid JSON body', 'BAD_JSON'); } };

route('GET', '/api/info', async (req, env) => json({
  version: VERSION, overview: await core.overview(env), accounts: await core.listAccounts(env),
  profile: await getSetting(env, 'profile', {}), relay: env.RELAY_URL || (await getSetting(env, 'relay_url', '')) || null,
}));
route('PUT', '/api/settings', async (req, env) => {
  const b = await body(req);
  if (b.profile) await setSetting(env, 'profile', b.profile);
  if (typeof b.relayUrl === 'string' && /^https?:\/\/[^\s]+$/.test(b.relayUrl)) await setSetting(env, 'relay_url', b.relayUrl.replace(/\/+$/, ''));
  return json({ profile: await getSetting(env, 'profile', {}) });
});
route('GET', '/api/ai-settings', async (req, env) => {
  const a = await getSetting(env, 'ai', {});
  return json({ ai: { ...a, textKey: mask(a.textKey), imageKey: mask(a.imageKey), textKeySet: !!a.textKey, imageKeySet: !!a.imageKey } });
});
route('PUT', '/api/ai-settings', async (req, env) => {
  const b = await body(req);
  const a = await getSetting(env, 'ai', {});
  for (const k of ['textBaseUrl', 'textModel', 'imageBaseUrl', 'imageModel']) if (k in b) a[k] = String(b[k] || '').slice(0, 300);
  for (const k of ['textKey', 'imageKey']) if (k in b && !String(b[k] || '').includes('••••')) { if (b[k]) a[k] = String(b[k]).slice(0, 500); else delete a[k]; }
  await setSetting(env, 'ai', a);
  return json({ ai: { ...a, textKey: mask(a.textKey), imageKey: mask(a.imageKey), textKeySet: !!a.textKey, imageKeySet: !!a.imageKey } });
});
route('GET', '/api/accounts', async (req, env) => json({ accounts: await core.listAccounts(env) }));
route('POST', '/api/accounts', async (req, env) => json({ id: await core.addAccount(env, await body(req)) }, 201));
route('DELETE', '/api/accounts/:id', async (req, env, p) => { await core.removeAccount(env, p.id); return json({ ok: true }); });
route('GET', '/api/accounts/:id/boards', async (req, env, p) => json({ boards: await core.boards(env, p.id) }));
route('POST', '/api/accounts/:id/boards', async (req, env, p) => json({ board: await core.createBoard(env, p.id, await body(req)) }, 201));
route('GET', '/api/accounts/:id/quota', async (req, env, p) => json({ quota: await core.quota(env, p.id) }));
route('GET', '/api/pins', async (req, env) => json({ pins: await core.listPins(env, { status: new URL(req.url).searchParams.get('status') }) }));
route('POST', '/api/pins', async (req, env) => json({ pin: await core.createPin(env, await body(req)) }, 201));
route('POST', '/api/pins/auto-schedule', async (req, env) => json(await core.autoSchedule(env, await body(req))));
route('PATCH', '/api/pins/:id', async (req, env, p) => json({ pin: await core.updatePin(env, p.id, await body(req)) }));
route('DELETE', '/api/pins/:id', async (req, env, p) => { await core.deletePin(env, p.id); return json({ ok: true }); });
route('POST', '/api/pins/:id/image', async (req, env, p) => json({ pin: await core.setPinImage(env, p.id, await body(req)) }));
route('POST', '/api/pins/:id/post-now', async (req, env, p) => { const r = await core.postNow(env, p.id); return json(r, r.result.status === 'posted' ? 200 : 502); });
route('GET', '/api/pins/:id/stats', async (req, env, p) => json({ stats: await core.stats(env, p.id) }));
route('GET', '/api/log', async (req, env) => json({ log: await core.postLog(env) }));
route('POST', '/api/ai/text', async (req, env) => { const b = await body(req); return json(await core.aiText(env, b.task, b.input)); });
route('POST', '/api/keywords', async (req, env) => json(await core.keywords(env, (await body(req)).seed)));
route('POST', '/api/run-due', async (req, env) => json({ results: await core.runDue(env) }));

export async function handle(request, env) {
  const c = cors(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
  const url = new URL(request.url);
  let res;
  try {
    if (url.pathname === '/' || url.pathname === '/api/health') {
      res = json({ ok: true, name: 'Tackly engine', engine: true, version: VERSION, keySet: !!(env.ENGINE_KEY && env.ENGINE_KEY.length >= 12), relay: !!env.RELAY_URL });
    } else {
      const mcp = url.pathname.match(/^\/mcp(?:\/([^/]+))?\/?$/);
      if (!authorized(request, env, mcp ? mcp[1] ?? null : null)) {
        res = json({ error: env.ENGINE_KEY ? 'Wrong engine key.' : 'Set the ENGINE_KEY secret (12+ characters) on your engine first.', code: 'UNAUTHORIZED' }, 401);
      } else {
        await ensureSchema(env);
        if (mcp) res = await handleMcp(request, env);
        else {
          const r = R.find((x) => x.method === request.method && x.re.test(url.pathname));
          if (!r) throw new core.EngineError(404, 'Not found', 'NOT_FOUND');
          const m = url.pathname.match(r.re);
          res = await r.fn(request, env, Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])));
        }
      }
    }
  } catch (e) {
    if (e instanceof core.EngineError || e instanceof RelayError) res = json({ error: e.message, code: e.code, ...(e.extra || e.data || {}) }, e.status || 500);
    else { console.error(e && e.stack ? e.stack : e); res = json({ error: 'Engine error. Please try again.', code: 'INTERNAL' }, 500); }
  }
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(c)) out.headers.set(k, v);
  return out;
}

export async function scheduled(env) {
  if (!env.ENGINE_KEY) return [];
  await ensureSchema(env);
  return core.runDue(env);
}
