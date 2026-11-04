import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeEnv, call } from './helpers.js';
import { seal } from '../src/pinterest.js';
import { safePublicUrl } from '../src/lib/guard.js';
import { DAILY_PIN_LIMIT, MIN_GAP_MINUTES } from '../../shared/limits.js';

let env;
beforeEach(() => { env = makeEnv(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const sealedFor = (uid = 'pin_user_1', extra = {}) => seal(env, { a: 'access-1', r: 'refresh-1', ae: Date.now() + 20 * 86400000, uid, ...extra });
const okPin = () => vi.fn(async (u, init) => {
  if (String(u).endsWith('/pins')) return Response.json({ id: String(Math.random()).slice(2, 10) }, { status: 201 });
  return Response.json({});
});

describe('relay stores no user data', () => {
  it('health says so and leaks no secrets', async () => {
    const r = await call(env, 'GET', '/api/health');
    expect(r.data.storesUserData).toBe(false);
    expect(r.data.limits.dailyPins).toBe(10);
    expect(JSON.stringify(r.data)).not.toContain('secret456');
  });

  it('OAuth callback returns a sealed token in the URL fragment and writes nothing but a stat', async () => {
    const { data } = await call(env, 'POST', '/api/pinterest/connect');
    expect(data.url).toContain('pins%3Awrite');
    const state = new URL(data.url).searchParams.get('state');
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      if (String(u).includes('/oauth/token')) return Response.json({ access_token: 'pina_ACCESS', refresh_token: 'pinr_REFRESH', expires_in: 2592000 });
      return Response.json({ id: '999', username: 'amawp' });
    }));
    const cb = await call(env, 'GET', `/api/pinterest/callback?code=abc&state=${encodeURIComponent(state)}`);
    const loc = cb.res.headers.get('Location');
    expect(loc).toContain('#/connected?sealed=');
    expect(loc).not.toContain('pina_ACCESS');
    const tables = ['post_quota', 'rate_limits', 'daily_stats'];
    const dump = JSON.stringify(await Promise.all(tables.map((t) => env.DB.prepare(`SELECT * FROM ${t}`).all())));
    expect(dump).not.toContain('pina_ACCESS');
    expect(dump).not.toContain('amawp');
  });

  it('rejects tampered sealed tokens', async () => {
    const s = await sealedFor();
    const bad = s.slice(0, -6) + 'AAAAAA';
    const r = await call(env, 'POST', '/api/relay/boards', { body: { sealed: bad } });
    expect(r.status).toBe(401);
  });
});

describe('daily safety limit (enforced by the relay)', () => {
  it(`allows ${DAILY_PIN_LIMIT} pins per account per 24h and blocks the next`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let t = Date.UTC(2026, 10, 5, 12, 0, 0);
    vi.setSystemTime(t);
    vi.stubGlobal('fetch', okPin());
    const sealed = await sealedFor();
    for (let i = 0; i < DAILY_PIN_LIMIT; i++) {
      const r = await call(env, 'POST', '/api/relay/pins', { body: { sealed, board_id: 'b1', image_base64: 'A'.repeat(200), title: `p${i}` }, headers: { ip: `ip${i}` } });
      expect(r.status).toBe(200);
      t += (MIN_GAP_MINUTES + 1) * 60000; vi.setSystemTime(t);
    }
    const blocked = await call(env, 'POST', '/api/relay/pins', { body: { sealed, board_id: 'b1', image_base64: 'A'.repeat(200) } });
    expect(blocked.status).toBe(429);
    expect(blocked.data.code).toBe('DAILY_LIMIT');
    // a different Pinterest account is not affected
    const other = await call(env, 'POST', '/api/relay/pins', { body: { sealed: await sealedFor('someone_else'), board_id: 'b1', image_base64: 'A'.repeat(200) } });
    expect(other.status).toBe(200);
    // 24h after the first pin, a slot opens again
    vi.setSystemTime(Date.UTC(2026, 10, 6, 12, 1, 0));
    const again = await call(env, 'POST', '/api/relay/pins', { body: { sealed, board_id: 'b1', image_base64: 'A'.repeat(200) } });
    expect(again.status).toBe(200);
  });

  it('enforces spacing between pins on one account', async () => {
    vi.stubGlobal('fetch', okPin());
    const sealed = await sealedFor();
    expect((await call(env, 'POST', '/api/relay/pins', { body: { sealed, board_id: 'b', image_base64: 'A'.repeat(200) } })).status).toBe(200);
    const r = await call(env, 'POST', '/api/relay/pins', { body: { sealed, board_id: 'b', image_base64: 'A'.repeat(200) } });
    expect(r.status).toBe(429);
    expect(r.data.code).toBe('TOO_SOON');
  });

  it('does not count failed posts against the limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Invalid board' }, { status: 400 })));
    const sealed = await sealedFor();
    const r = await call(env, 'POST', '/api/relay/pins', { body: { sealed, board_id: 'b', image_base64: 'A'.repeat(200) } });
    expect(r.status).toBe(400);
    expect(r.data.error).toContain('Invalid board');
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM post_quota').first()).n).toBe(0);
  });

  it('refreshes an expiring token and returns a new sealed blob', async () => {
    const sealed = await sealedFor('u9', { ae: Date.now() + 1000 });
    vi.stubGlobal('fetch', vi.fn(async (u, init) => {
      if (String(u).includes('/oauth/token')) return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 2592000 });
      expect(init.headers.Authorization).toBe('Bearer new-access');
      return Response.json({ items: [{ id: 'b1', name: 'Recipes' }] });
    }));
    const r = await call(env, 'POST', '/api/relay/boards', { body: { sealed } });
    expect(r.data.boards[0].name).toBe('Recipes');
    expect(r.data.sealed).toBeTruthy();
    expect(r.data.sealed).not.toEqual(sealed);
  });
});

describe('guards', () => {
  it('blocks private and odd URLs (SSRF)', () => {
    for (const bad of ['http://localhost/x', 'http://127.0.0.1/', 'http://10.0.0.1/', 'http://192.168.1.1/', 'ftp://x.com/', 'http://user:pw@x.com/', 'http://x.com:8080/']) {
      expect(() => safePublicUrl(bad)).toThrow();
    }
    expect(safePublicUrl('https://example.com/post').hostname).toBe('example.com');
  });

  it('keyword research merges free sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      const q = new URL(u).searchParams.get('q') || new URL(u).searchParams.get('query');
      return Response.json([q, [`${q} for small spaces`, `${q} on a budget`]]);
    }));
    const r = await call(env, 'POST', '/api/keywords', { body: { seed: 'kitchen decor' } });
    expect(r.status).toBe(200);
    expect(r.data.keywords.length).toBeGreaterThan(5);
    expect(r.data.keywords[0].sources.length).toBeGreaterThan(0);
  });

  it('owner stats need the admin key', async () => {
    expect((await call(env, 'GET', '/api/admin/stats')).status).toBe(403);
    const ok = await call(env, 'GET', '/api/admin/stats', { headers: { Authorization: `Bearer ${env.ADMIN_KEY}` } });
    expect(ok.status).toBe(200);
  });
});
