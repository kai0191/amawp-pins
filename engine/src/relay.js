// Calls the Tackly relay (AMAWP's server), which holds the Pinterest app secret and enforces the
// 10 pins / 24 h safety limit. Whenever the relay returns a refreshed sealed token, we save it.
export class RelayError extends Error {
  constructor(message, status, code, data) { super(message); this.status = status; this.code = code; this.data = data || {}; }
}

import { getSetting } from './db.js';

// The relay URL comes from the RELAY_URL var, or is saved automatically by the Tackly app when it connects.
export async function relayBase(env) {
  const v = env.RELAY_URL || (await getSetting(env, 'relay_url', ''));
  return String(v || '').replace(/\/+$/, '');
}

export async function relay(env, path, body, { account } = {}) {
  const base = await relayBase(env);
  if (!base) throw new RelayError('Open the Tackly app once while connected to this engine so it can save the relay address.', 500, 'NO_RELAY');
  const payload = account ? { ...body, sealed: account.sealed } : body;
  let res;
  try {
    res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'TacklyEngine/2' }, body: JSON.stringify(payload) });
  } catch {
    throw new RelayError('Could not reach the Tackly relay. Try again in a minute.', 503, 'RELAY_DOWN');
  }
  const data = await res.json().catch(() => ({}));
  if (data && data.sealed && account) {
    await env.DB.prepare('UPDATE accounts SET sealed = ? WHERE id = ?').bind(data.sealed, account.id).run();
    account.sealed = data.sealed;
  }
  if (!res.ok) throw new RelayError(data.error || `Relay error ${res.status}`, res.status, data.code, data);
  return data;
}

export async function relayGet(env, path) {
  const res = await fetch((await relayBase(env)) + path, { headers: { 'User-Agent': 'TacklyEngine/2' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RelayError(data.error || `Relay error ${res.status}`, res.status, data.code, data);
  return data;
}
