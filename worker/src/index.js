// Tackly by AMAWP: API Worker entry (Cloudflare Workers free plan + D1 + KV + Cron).
// Only the default export lives here: the Workers runtime rejects other named exports.
import { handle } from './app.js';
import { runDuePins } from './poster.js';

export default {
  fetch: handle,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDuePins(env).then((r) => { if (r.length) console.log('cron posted', JSON.stringify(r)); }));
  },
};
