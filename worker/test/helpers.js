// Test helpers: a real-SQL D1 stand-in built on node:sqlite, and an in-memory KV.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handle } from '../src/app.js';
import { _resetSecretMemo } from '../src/lib/secrets.js';

const norm = (args) => args.map((a) => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : a));
const plain = (row) => (row ? { ...row } : null);

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, norm(args)); }
  async first(col) {
    const row = plain(this.db.prepare(this.sql).get(...this.args));
    return col && row ? row[col] : row;
  }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args).map(plain), success: true }; }
  async run() {
    const s = this.db.prepare(this.sql);
    if (/\breturning\b/i.test(this.sql)) {
      const results = s.all(...this.args).map(plain);
      return { results, success: true, meta: { changes: results.length } };
    }
    const r = s.run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}

export class D1Shim {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    const sql = readFileSync(fileURLToPath(new URL('../migrations/0001_init.sql', import.meta.url)), 'utf8');
    this.db.exec(sql);
  }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; }
  async exec(sql) { this.db.exec(sql); }
}

export class KVShim {
  constructor() { this.map = new Map(); this.writes = 0; }
  async get(k) { return this.map.has(k) ? this.map.get(k) : null; }
  async put(k, v) { this.writes++; this.map.set(k, v); }
  async delete(k) { this.writes++; this.map.delete(k); }
}

export function makeEnv(overrides = {}) {
  _resetSecretMemo();
  return {
    DB: new D1Shim(), KV: new KVShim(),
    JWT_SECRET: 'test-jwt-secret', ENC_KEY: 'test-enc-key',
    PINTEREST_APP_ID: 'app123', PINTEREST_APP_SECRET: 'secret456',
    APP_URL: 'https://example.github.io/amawp-pins/', OWNER_EMAIL: 'owner@example.com',
    PINTEREST_SANDBOX: 'false',
    ...overrides,
  };
}

export async function call(env, method, path, { body, token, headers = {} } = {}) {
  const req = new Request(`https://api.test${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json', 'CF-Connecting-IP': headers.ip || '1.2.3.4',
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const res = await handle(req, env, { waitUntil() {} });
  let data = null;
  try { data = await res.clone().json(); } catch { /* redirect or empty */ }
  return { status: res.status, data, res };
}

export async function signupUser(env, email = 'user@example.com', password = 'password123') {
  const r = await call(env, 'POST', '/api/auth/signup', { body: { email, password, timezone: 'America/New_York' }, headers: { ip: `ip-${email}` } });
  if (r.status !== 201) throw new Error(`signup failed ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
}
