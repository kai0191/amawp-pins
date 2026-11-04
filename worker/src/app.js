// Tackly relay router (AMAWP's Cloudflare Worker). Stores no user data.
import { corsHeaders, HttpError, json } from './lib/http.js';
import * as relay from './routes/relay.js';
import * as tools from './routes/tools.js';
import { pinterestConfigured } from './pinterest.js';
import { DAILY_PIN_LIMIT, MIN_GAP_MINUTES } from '../../shared/limits.js';

export const VERSION = '2.0.0';

const routes = [
  ['GET', '/api/health', (req, env) => json({
    ok: true, name: 'Tackly relay', version: VERSION, storesUserData: false,
    pinterestConfigured: pinterestConfigured(env), sandbox: env.PINTEREST_SANDBOX === 'true',
    limits: { dailyPins: DAILY_PIN_LIMIT, minGapMinutes: MIN_GAP_MINUTES },
    amawpImages: env.AMAWP_IMAGE_API_URL ? { name: env.AMAWP_IMAGE_NAME || 'AMAWP library' } : null,
  })],
  ['POST', '/api/pinterest/connect', relay.connect],
  ['GET', '/api/pinterest/callback', relay.callback],
  ['POST', '/api/relay/account', relay.account],
  ['POST', '/api/relay/boards', relay.boards],
  ['POST', '/api/relay/boards/create', relay.newBoard],
  ['POST', '/api/relay/pins', relay.publish],
  ['POST', '/api/relay/quota', relay.quota],
  ['POST', '/api/relay/analytics', relay.analytics],
  ['POST', '/api/keywords', tools.keywords],
  ['POST', '/api/trends', tools.trends],
  ['GET', '/api/page-info', tools.pageInfo],
  ['GET', '/api/img', tools.imageProxy],
  ['GET', '/api/images', tools.amawpImages],
  ['GET', '/api/admin/stats', tools.adminStats],
].map(([method, path, handler]) => ({ method, re: new RegExp(`^${path}/?$`), handler }));

export async function handle(request, env, ctx) {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  let res;
  try {
    const route = routes.find((r) => r.method === request.method && r.re.test(url.pathname));
    if (!route) {
      if (url.pathname === '/') res = json({ ok: true, name: 'Tackly relay', storesUserData: false });
      else throw new HttpError(404, 'Not found', 'NOT_FOUND');
    } else {
      res = await route.handler(request, env, {}, ctx);
    }
  } catch (e) {
    if (e instanceof HttpError) res = json({ error: e.message, code: e.code, ...(e.extra || {}) }, e.status);
    else { console.error(e && e.stack ? e.stack : e); res = json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, 500); }
  }
  if (res.status >= 300 && res.status < 400) return res;
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  out.headers.set('X-Content-Type-Options', 'nosniff');
  return out;
}

/** Daily cleanup: drop quota rows older than 2 days and stale rate-limit windows. */
export async function cleanup(env) {
  await env.DB.prepare('DELETE FROM post_quota WHERE at < ?').bind(Date.now() - 2 * 86400000).run();
  await env.DB.prepare('DELETE FROM rate_limits').run();
}
