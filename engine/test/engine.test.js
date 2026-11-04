import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { D1Shim, KVShim } from '../../worker/test/helpers.js';
import { handle, scheduled } from '../src/app.js';
import { _resetSchemaMemo } from '../src/db.js';
import { DAILY_PIN_LIMIT } from '../src/shared/limits.js';

const KEY = 'my-engine-key-123456';
let env;
beforeEach(() => { _resetSchemaMemo(); env = { DB: new D1Shim(null), KV: new KVShim(), ENGINE_KEY: KEY, RELAY_URL: 'https://relay.test' }; });
afterEach(() => vi.unstubAllGlobals());

async function call(method, path, body, { key = KEY } = {}) {
  const res = await handle(new Request(`https://engine.test${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), env);
  let data = null; try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}
const relayOk = () => vi.fn(async (u, init) => {
  const b = init && init.body ? JSON.parse(init.body) : {};
  if (String(u).endsWith('/api/relay/pins')) return Response.json({ id: 'pin123', quota: { used: 1, limit: 10 }, sealed: b.sealed + '-r' });
  if (String(u).endsWith('/api/relay/boards')) return Response.json({ boards: [{ id: 'b1', name: 'Recipes' }] });
  return Response.json({});
});
const tomorrowAt = (h) => { const d = new Date(Date.now() + 86400000); d.setUTCHours(h, 7, 0, 0); return d.getTime(); };

describe('engine auth', () => {
  it('requires the engine key', async () => {
    expect((await call('GET', '/api/info', null, { key: null })).status).toBe(401);
    expect((await call('GET', '/api/info', null, { key: 'wrong-key-000000000' })).status).toBe(401);
    expect((await call('GET', '/api/info')).status).toBe(200);
    expect((await call('GET', '/api/health', null, { key: null })).data.engine).toBe(true);
  });
  it('refuses to run without a strong key', async () => {
    env.ENGINE_KEY = 'short';
    expect((await call('GET', '/api/info', null, { key: 'short' })).status).toBe(401);
  });
});

describe('pins + daily safety limit', () => {
  it(`never schedules more than ${DAILY_PIN_LIMIT} pins per account per day`, async () => {
    await call('POST', '/api/accounts', { sealed: 'S1', username: 'amawp' });
    for (let i = 0; i < DAILY_PIN_LIMIT; i++) {
      const r = await call('POST', '/api/pins', { image: 'A'.repeat(200), title: `p${i}`, boardId: 'b1', scheduledAt: tomorrowAt(8 + i) });
      expect(r.status).toBe(201);
    }
    const over = await call('POST', '/api/pins', { image: 'A'.repeat(200), title: 'too many', boardId: 'b1', scheduledAt: tomorrowAt(22) });
    expect(over.status).toBe(400);
    expect(over.data.code).toBe('DAILY_LIMIT');
    // storing many drafts is fine
    for (let i = 0; i < 15; i++) expect((await call('POST', '/api/pins', { image: 'A'.repeat(200), title: `d${i}` })).status).toBe(201);
  });

  it('auto-schedule caps each day at the limit', async () => {
    await call('POST', '/api/accounts', { sealed: 'S1', username: 'amawp' });
    for (let i = 0; i < 30; i++) await call('POST', '/api/pins', { image: 'A'.repeat(200), title: `d${i}`, link: `https://x.com/${i % 6}` });
    const r = await call('POST', '/api/pins/auto-schedule', { minPerDay: 10, maxPerDay: 50, boardIds: ['b1', 'b2'], windows: [[8, 22]] });
    expect(r.data.scheduled).toBe(30);
    const perDay = {};
    for (const p of r.data.plan) perDay[p.day] = (perDay[p.day] || 0) + 1;
    expect(Math.max(...Object.values(perDay))).toBeLessThanOrEqual(DAILY_PIN_LIMIT);
  });

  it('cron posts due pins through the relay and saves refreshed tokens', async () => {
    await call('POST', '/api/accounts', { sealed: 'S1', username: 'amawp' });
    const { data } = await call('POST', '/api/pins', { image: 'A'.repeat(200), title: 'due', boardId: 'b1', scheduledAt: Date.now() + 60000 });
    const f = relayOk(); vi.stubGlobal('fetch', f);
    await env.DB.prepare('UPDATE pins SET next_attempt_at = ? WHERE id = ?').bind(Date.now() - 1000, data.pin.id).run();
    const out = await scheduled(env);
    expect(out[0].status).toBe('posted');
    const sent = JSON.parse(f.mock.calls[0][1].body);
    expect(sent.sealed).toBe('S1');
    expect(sent.image_base64).toBe('A'.repeat(200));
    expect((await env.DB.prepare('SELECT sealed FROM accounts').first()).sealed).toBe('S1-r');
    expect(await env.KV.get(`img:${data.pin.id}`)).toBeNull();
  });

  it('waits for the next safe slot when the relay says the daily limit is reached', async () => {
    await call('POST', '/api/accounts', { sealed: 'S1', username: 'amawp' });
    const { data } = await call('POST', '/api/pins', { image: 'A'.repeat(200), boardId: 'b1', scheduledAt: Date.now() + 60000 });
    await env.DB.prepare('UPDATE pins SET next_attempt_at = ? WHERE id = ?').bind(Date.now() - 1000, data.pin.id).run();
    const nextAt = Date.now() + 5 * 3600000;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'limit', code: 'DAILY_LIMIT', nextAt }, { status: 429 })));
    await scheduled(env);
    const pin = await env.DB.prepare('SELECT * FROM pins WHERE id = ?').bind(data.pin.id).first();
    expect(pin.status).toBe('scheduled');
    expect(pin.attempts).toBe(0);
    expect(pin.next_attempt_at).toBeGreaterThan(nextAt);
  });
});

describe('MCP server', () => {
  const rpc = (method, params, path = '/mcp') => call('POST', path, { jsonrpc: '2.0', id: 1, method, params });
  it('initializes and lists tools', async () => {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    expect(init.data.result.serverInfo.name).toBe('tackly');
    const tools = await rpc('tools/list', {});
    const names = tools.data.result.tools.map((t) => t.name);
    for (const n of ['keyword_research', 'seo_score_pin', 'create_design_pin', 'auto_schedule', 'publish_now']) expect(names).toContain(n);
  });
  it('accepts the key in the URL path for clients that cannot send headers', async () => {
    const r = await call('POST', `/mcp/${KEY}`, { jsonrpc: '2.0', id: 2, method: 'ping' }, { key: null });
    expect(r.status).toBe(200);
    expect((await call('POST', '/mcp/wrong-key-1234567', { jsonrpc: '2.0', id: 2, method: 'ping' }, { key: null })).status).toBe(401);
  });
  it('creates a template design pin that waits for rendering', async () => {
    const r = await rpc('tools/call', { name: 'create_design_pin', arguments: { template_id: 'checklist', text: { headline: 'Moving Checklist', items: ['Pack', 'Label'] }, title: 'Moving checklist for families' } });
    const out = r.data.result.structuredContent;
    expect(out.pin.needs_render).toBe(true);
    const bad = await rpc('tools/call', { name: 'create_design_pin', arguments: { template_id: 'nope', text: {} } });
    expect(bad.data.result.isError).toBe(true);
  });
  it('scores pin SEO', async () => {
    const r = await rpc('tools/call', { name: 'seo_score_pin', arguments: { title: 'Fall Decor Ideas for Small Living Rooms', description: 'Fall decor ideas that make a small living room feel cozy. ' + 'x'.repeat(200), keyword: 'fall decor ideas' } });
    expect(r.data.result.structuredContent.score).toBeGreaterThan(30);
  });
});
