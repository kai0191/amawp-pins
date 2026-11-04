import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeEnv, call, signupUser } from './helpers.js';
import { encryptString } from '../src/lib/crypto.js';
import { runDuePins } from '../src/poster.js';
import worker from '../src/index.js';

const IMG = 'A'.repeat(400);

async function addAccount(env, userId, pid = 'pin_user_1') {
  const id = `pa_${pid}`;
  await env.DB.prepare(
    `INSERT INTO pinterest_accounts (id, user_id, pinterest_user_id, username, access_token_enc, refresh_token_enc, access_expires_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  ).bind(id, userId, pid, 'tester', await encryptString('access-token-1', env.ENC_KEY), await encryptString('refresh-1', env.ENC_KEY),
    Date.now() + 20 * 86400000, Date.now()).run();
  return id;
}

let env;
beforeEach(() => { env = makeEnv(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('auth', () => {
  it('signs up, logs in and reads /api/me', async () => {
    const s = await signupUser(env, 'a@example.com');
    expect(s.token).toBeTruthy();
    expect(s.user.plan.id).toBe('free');
    const row = await env.DB.prepare('SELECT password_hash FROM users WHERE email = ?').bind('a@example.com').first();
    expect(row.password_hash.startsWith('pbkdf2$100000$')).toBe(true);
    const l = await call(env, 'POST', '/api/auth/login', { body: { email: 'A@example.com', password: 'password123' } });
    expect(l.status).toBe(200);
    const me = await call(env, 'GET', '/api/me', { token: l.data.token });
    expect(me.data.user.email).toBe('a@example.com');
  });

  it('rejects duplicates, weak passwords and bad tokens', async () => {
    await signupUser(env, 'dup@example.com');
    expect((await call(env, 'POST', '/api/auth/signup', { body: { email: 'dup@example.com', password: 'password123' } })).status).toBe(409);
    expect((await call(env, 'POST', '/api/auth/signup', { body: { email: 'x@example.com', password: 'short' } })).status).toBe(400);
    expect((await call(env, 'GET', '/api/me', { token: 'bad.token.here' })).status).toBe(401);
  });

  it('rate-limits repeated failed logins', async () => {
    await signupUser(env, 'rl@example.com');
    let last;
    for (let i = 0; i < 11; i++) {
      last = await call(env, 'POST', '/api/auth/login', { body: { email: 'rl@example.com', password: 'wrong-password' } });
    }
    expect(last.status).toBe(429);
    expect(last.data.code).toBe('RATE_LIMITED');
  });
});

describe('plan limits', () => {
  it('lets a free user start one Pinterest connection', async () => {
    const { token } = await signupUser(env);
    const r = await call(env, 'POST', '/api/pinterest/connect', { token });
    expect(r.status).toBe(200);
    expect(r.data.url).toContain('https://www.pinterest.com/oauth/');
    expect(r.data.url).toContain('pins%3Awrite');
    expect(r.data.url).toContain(encodeURIComponent('https://api.test/api/pinterest/callback'));
  });

  it('blocks a second account on the free plan with PLAN_LIMIT', async () => {
    const { token, user } = await signupUser(env);
    await addAccount(env, user.id);
    const r = await call(env, 'POST', '/api/pinterest/connect', { token });
    expect(r.status).toBe(402);
    expect(r.data.code).toBe('PLAN_LIMIT');
    expect(r.data.upgrade).toBe(true);
  });

  it('allows more accounts once the plan row is upgraded (no code change)', async () => {
    const { token, user } = await signupUser(env);
    await addAccount(env, user.id);
    await env.DB.prepare("UPDATE users SET plan_id = 'pro' WHERE id = ?").bind(user.id).run();
    expect((await call(env, 'POST', '/api/pinterest/connect', { token })).status).toBe(200);
  });

  it('records waitlist demand', async () => {
    const { token } = await signupUser(env);
    const r = await call(env, 'POST', '/api/waitlist', { token, body: { features: ['more_accounts', 'ai_pins'], note: 'need 3 accounts' } });
    expect(r.status).toBe(200);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM waitlist').first();
    expect(n.n).toBe(2);
  });

  it('OAuth callback stores tokens encrypted and enforces the limit again', async () => {
    const { token, user } = await signupUser(env);
    const { url } = (await call(env, 'POST', '/api/pinterest/connect', { token })).data;
    const state = new URL(url).searchParams.get('state');
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      if (String(u).includes('/oauth/token')) {
        return Response.json({ access_token: 'pina_ACCESS', refresh_token: 'pinr_REFRESH', expires_in: 2592000, refresh_token_expires_in: 31536000, scope: 'pins:write' });
      }
      if (String(u).includes('/user_account')) return Response.json({ id: '999', username: 'amawp' });
      return new Response('not found', { status: 404 });
    }));
    const cb = await call(env, 'GET', `/api/pinterest/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(cb.status).toBe(302);
    expect(cb.res.headers.get('Location')).toContain('#/app/accounts?connected=1');
    const row = await env.DB.prepare('SELECT * FROM pinterest_accounts WHERE user_id = ?').bind(user.id).first();
    expect(row.username).toBe('amawp');
    expect(row.access_token_enc).not.toContain('pina_ACCESS');
    expect(row.refresh_token_enc).not.toContain('pinr_REFRESH');
  });
});

describe('pins + scheduler + cron poster', () => {
  async function setup() {
    const { token, user } = await signupUser(env);
    const accountId = await addAccount(env, user.id);
    return { token, user, accountId };
  }

  it('creates a scheduled pin and stores the image in KV', async () => {
    const { token, accountId } = await setup();
    const r = await call(env, 'POST', '/api/pins', {
      token, body: { image: IMG, title: 'Hello', accountId, boardId: 'b1', status: 'scheduled', scheduledAt: Date.now() + 3600000 },
    });
    expect(r.status).toBe(201);
    expect(await env.KV.get(`img:${r.data.pin.id}`)).toBe(IMG);
  });

  it('auto-schedules drafts across boards', async () => {
    const { token, accountId } = await setup();
    const ids = [];
    for (let i = 0; i < 6; i++) {
      const r = await call(env, 'POST', '/api/pins', { token, body: { image: IMG, title: `P${i}`, link: 'https://x.com/a', accountId } });
      ids.push(r.data.pin.id);
    }
    const r = await call(env, 'POST', '/api/pins/auto-schedule', {
      token, body: { pinIds: ids, minPerDay: 2, maxPerDay: 3, windows: [[9, 21]], timezone: 'America/New_York', boardIds: ['b1', 'b2'] },
    });
    expect(r.status).toBe(200);
    expect(r.data.scheduled).toBe(6);
    const { results } = await env.DB.prepare("SELECT board_id, scheduled_at FROM pins WHERE status='scheduled'").all();
    expect(new Set(results.map((p) => p.board_id))).toEqual(new Set(['b1', 'b2']));
  });

  it('cron posts due pins with image_base64 and marks them posted', async () => {
    const { token, accountId } = await setup();
    const r = await call(env, 'POST', '/api/pins', {
      token, body: { image: IMG, title: 'Due', link: 'https://x.com', accountId, boardId: 'b1', status: 'scheduled', scheduledAt: Date.now() + 1000 },
    });
    const fetchMock = vi.fn(async (u, init) => {
      expect(String(u)).toBe('https://api.pinterest.com/v5/pins');
      const body = JSON.parse(init.body);
      expect(body.media_source).toEqual({ source_type: 'image_base64', content_type: 'image/jpeg', data: IMG });
      expect(init.headers.Authorization).toBe('Bearer access-token-1');
      return Response.json({ id: '12345' }, { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await runDuePins(env, Date.now() + 5000);
    expect(out[0].status).toBe('posted');
    const pin = await env.DB.prepare('SELECT * FROM pins WHERE id = ?').bind(r.data.pin.id).first();
    expect(pin.status).toBe('posted');
    expect(pin.pinterest_pin_id).toBe('12345');
    expect(await env.KV.get(`img:${pin.id}`)).toBeNull();
  });

  it('retries with backoff on Pinterest 5xx/429 and fails permanently on 400', async () => {
    const { token, accountId } = await setup();
    const mk = async (title) => (await call(env, 'POST', '/api/pins', {
      token, body: { image: IMG, title, accountId, boardId: 'b1', status: 'scheduled', scheduledAt: Date.now() + 1000 },
    })).data.pin.id;
    const a = await mk('server-error');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'oops' }, { status: 503 })));
    await runDuePins(env, Date.now() + 5000);
    let pin = await env.DB.prepare('SELECT * FROM pins WHERE id = ?').bind(a).first();
    expect(pin.status).toBe('scheduled');
    expect(pin.attempts).toBe(1);
    expect(pin.next_attempt_at).toBeGreaterThan(Date.now() + 3 * 60000);
    expect(pin.last_error).toMatch(/retry/i);

    const b = await mk('bad-request');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Invalid board' }, { status: 400 })));
    await runDuePins(env, Date.now() + 5000);
    pin = await env.DB.prepare('SELECT * FROM pins WHERE id = ?').bind(b).first();
    expect(pin.status).toBe('failed');
    expect(pin.last_error).toContain('Invalid board');
  });

  it('refreshes an expiring access token before posting', async () => {
    const { token, user } = await signupUser(env, 'r@example.com');
    const accountId = await addAccount(env, user.id, 'pid2');
    await env.DB.prepare('UPDATE pinterest_accounts SET access_expires_at = ? WHERE id = ?').bind(Date.now() + 1000, accountId).run();
    await call(env, 'POST', '/api/pins', {
      token, body: { image: IMG, accountId, boardId: 'b1', status: 'scheduled', scheduledAt: Date.now() + 1000 },
    });
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (u, init) => {
      calls.push(String(u));
      if (String(u).includes('/oauth/token')) {
        expect(String(init.body)).toContain('grant_type=refresh_token');
        return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 2592000 });
      }
      expect(init.headers.Authorization).toBe('Bearer new-access');
      return Response.json({ id: '77' });
    }));
    const out = await runDuePins(env, Date.now() + 5000);
    expect(out[0].status).toBe('posted');
    expect(calls[0]).toContain('/oauth/token');
  });

  it('scheduled() handler runs the poster', async () => {
    let waited;
    await worker.scheduled({}, env, { waitUntil: (p) => { waited = p; } });
    await waited;
    expect(waited).toBeInstanceOf(Promise);
  });
});

describe('privacy + admin', () => {
  it('deletes all user data on request', async () => {
    const { token, user } = await signupUser(env);
    await addAccount(env, user.id);
    const r = await call(env, 'DELETE', '/api/me', { token });
    expect(r.status).toBe(200);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first()).n).toBe(0);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM pinterest_accounts').first()).n).toBe(0);
  });

  it('admin overview is owner-only', async () => {
    const u = await signupUser(env, 'someone@example.com');
    expect((await call(env, 'GET', '/api/admin/overview', { token: u.token })).status).toBe(403);
    const o = await signupUser(env, 'owner@example.com');
    expect(o.user.isAdmin).toBe(true);
    const r = await call(env, 'GET', '/api/admin/overview', { token: o.token });
    expect(r.status).toBe(200);
    expect(r.data.totals.users).toBe(2);
  });

  it('stores BYO AI keys encrypted and only returns them masked', async () => {
    const { token } = await signupUser(env);
    const r = await call(env, 'PUT', '/api/ai/settings', { token, body: { textBaseUrl: 'https://api.openai.com/v1', textKey: 'sk-verysecretkey1234', textModel: 'gpt-4o-mini' } });
    expect(r.data.ai.textKey).toBe('sk-••••1234');
    const row = await env.DB.prepare('SELECT ai_settings_enc FROM users').first();
    expect(row.ai_settings_enc).not.toContain('verysecret');
    // sending the masked value back keeps the real key
    await call(env, 'PUT', '/api/ai/settings', { token, body: { textKey: 'sk-••••1234', textModel: 'gpt-4.1-mini' } });
    const g = await call(env, 'GET', '/api/ai/settings', { token });
    expect(g.data.ai.textKeySet).toBe(true);
    expect(g.data.ai.textModel).toBe('gpt-4.1-mini');
  });

  it('health endpoint reports configuration without leaking secrets', async () => {
    const r = await call(env, 'GET', '/api/health');
    expect(r.data.pinterestConfigured).toBe(true);
    expect(JSON.stringify(r.data)).not.toContain('secret456');
  });
});
