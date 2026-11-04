// Secrets come from Worker secrets. If JWT_SECRET / ENC_KEY were not set, a strong random
// value is created once and kept in KV so the app still works safely out of the box.
import { b64url, randomBytes } from './crypto.js';

const memo = {};
async function bootstrap(env, name) {
  if (env[name]) return env[name];
  if (memo[name]) return memo[name];
  const kvKey = `sys:${name}`;
  let v = await env.KV.get(kvKey);
  if (!v) {
    v = b64url(randomBytes(32));
    await env.KV.put(kvKey, v);
  }
  memo[name] = v;
  return v;
}
export const jwtSecret = (env) => bootstrap(env, 'JWT_SECRET');
export const encKey = (env) => bootstrap(env, 'ENC_KEY');
export function _resetSecretMemo() { for (const k of Object.keys(memo)) delete memo[k]; }
