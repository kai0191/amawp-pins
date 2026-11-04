// Tackly by AMAWP: API Worker (Cloudflare Workers free plan + D1 + KV + Cron).
import { corsHeaders, HttpError, json } from './lib/http.js';
import * as auth from './routes/auth.js';
import * as pinterest from './routes/pinterest.js';
import * as pins from './routes/pins.js';
import * as ai from './routes/ai.js';
import * as admin from './routes/admin.js';
import { pinterestConfigured } from './pinterest.js';
import { PLANS, WAITLIST_FEATURES } from '../../shared/plans.js';

export const VERSION = '1.0.0';

const routes = [
  ['GET', '/api/health', (req, env) => json({
    ok: true, name: 'Tackly API', version: VERSION,
    pinterestConfigured: pinterestConfigured(env), sandbox: env.PINTEREST_SANDBOX === 'true',
    secrets: { jwt: !!env.JWT_SECRET, enc: !!env.ENC_KEY },
  })],
  ['GET', '/api/plans', () => json({ plans: Object.values(PLANS), features: WAITLIST_FEATURES })],
  ['POST', '/api/auth/signup', auth.signup],
  ['POST', '/api/auth/login', auth.login],
  ['GET', '/api/me', auth.me],
  ['DELETE', '/api/me', auth.deleteMe],
  ['GET', '/api/me/export', auth.exportMe],
  ['PUT', '/api/me/settings', auth.updateSettings],
  ['POST', '/api/me/password', auth.changePassword],
  ['GET', '/api/ai/settings', auth.getAiSettings],
  ['PUT', '/api/ai/settings', auth.putAiSettings],
  ['POST', '/api/ai/text', ai.aiText],
  ['POST', '/api/ai/image', ai.aiImage],
  ['GET', '/api/img', ai.imageProxy],
  ['POST', '/api/waitlist', auth.joinWaitlist],
  ['POST', '/api/pinterest/connect', pinterest.connect],
  ['GET', '/api/pinterest/login', pinterest.loginStart],
  ['GET', '/api/pinterest/callback', pinterest.callback],
  ['GET', '/api/accounts', pinterest.listAccounts],
  ['DELETE', '/api/accounts/:id', pinterest.removeAccount],
  ['GET', '/api/accounts/:id/boards', pinterest.boards],
  ['POST', '/api/accounts/:id/boards', pinterest.newBoard],
  ['GET', '/api/pins', pins.listPins],
  ['POST', '/api/pins', pins.createPinRoute],
  ['POST', '/api/pins/auto-schedule', pins.autoScheduleRoute],
  ['PATCH', '/api/pins/:id', pins.updatePin],
  ['DELETE', '/api/pins/:id', pins.deletePin],
  ['POST', '/api/pins/:id/post-now', pins.postNow],
  ['GET', '/api/pins/:id/stats', pins.pinStats],
  ['GET', '/api/log', pins.postLog],
  ['GET', '/api/admin/overview', admin.overview],
  ['PUT', '/api/admin/users/:id/plan', admin.setUserPlan],
].map(([method, path, handler]) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { method, re, keys, handler };
});

export async function handle(request, env, ctx) {
  const cors = corsHeaders(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(request.url);
  let res;
  try {
    const route = routes.find((r) => r.method === request.method && r.re.test(url.pathname));
    if (!route) {
      if (url.pathname === '/' || url.pathname === '') {
        res = json({ ok: true, name: 'Tackly API', docs: 'See docs/SETUP.md in the GitHub repository.' });
      } else {
        throw new HttpError(404, 'Not found', 'NOT_FOUND');
      }
    } else {
      const m = url.pathname.match(route.re);
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      res = await route.handler(request, env, params, ctx);
    }
  } catch (e) {
    if (e instanceof HttpError) {
      res = json({ error: e.message, code: e.code, ...(e.extra || {}) }, e.status);
    } else {
      console.error(e && e.stack ? e.stack : e);
      res = json({ error: 'Something went wrong on our side. Please try again.', code: 'INTERNAL' }, 500);
    }
  }
  if (res.status >= 300 && res.status < 400) return res; // redirects
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}

