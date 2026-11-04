// Tackly relay entry (AMAWP's Cloudflare). Only the default export lives here:
// the Workers runtime rejects other named exports from the entry module.
import { handle, cleanup } from './app.js';

export default {
  fetch: handle,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cleanup(env));
  },
};
