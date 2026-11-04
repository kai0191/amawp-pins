// Tackly engine entry. Deploy this to YOUR Cloudflare account (free plan) to keep your pins in your own storage,
// post on schedule even when the app is closed, and connect AI assistants over MCP.
import { handle, scheduled } from './app.js';

export default {
  fetch: handle,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduled(env).then((r) => { if (r.length) console.log('posted', JSON.stringify(r)); }));
  },
};
