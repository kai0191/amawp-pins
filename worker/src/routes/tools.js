// Free helper tools: keyword research, page info (post images + Rich Pin check), image proxy,
// the AMAWP image library and owner stats. Nothing here stores user data.
import { HttpError, json, readJson } from '../lib/http.js';
import { clientIp, rateLimit, safePublicUrl } from '../lib/guard.js';
import { withSealed, suggestedTerms, relatedTerms, trendingKeywords } from '../pinterest.js';
import { seedQueries, rankKeywords } from '../../../shared/seo.js';

const UA = 'Mozilla/5.0 (compatible; TacklyBot/1.0; +https://kai0191.github.io/amawp-pins/)';

async function cached(key, ttl, fn) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const req = new Request(`https://cache.tackly/${encodeURIComponent(key)}`);
  if (cache) { const hit = await cache.match(req); if (hit) return hit.json(); }
  const data = await fn();
  if (cache) await cache.put(req, new Response(JSON.stringify(data), { headers: { 'Cache-Control': `max-age=${ttl}` } }));
  return data;
}

async function suggest(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) && Array.isArray(d[1]) ? d[1].map(String) : [];
  } catch { return []; }
}

/** POST /api/keywords {seed, sealed?}: Pinterest keyword ideas from several free sources. */
export async function keywords(request, env) {
  await rateLimit(env, `kw:${clientIp(request)}`, 40, 3600);
  const b = await readJson(request);
  const seed = String(b.seed || '').trim().toLowerCase().slice(0, 80);
  if (seed.length < 2) throw new HttpError(400, 'Type a topic or keyword first.', 'NO_SEED');
  const web = await cached(`kw:${seed}`, 86400, async () => {
    const qs = seedQueries(seed);
    const [google, bing] = await Promise.all([
      Promise.all(qs.map((q) => suggest(`https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(q)}`))),
      Promise.all(qs.slice(0, 5).map((q) => suggest(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(q)}`))),
    ]);
    return { google: google.flat(), bing: bing.flat() };
  });
  const sources = [{ source: 'google', items: web.google }, { source: 'bing', items: web.bing }];
  let pinterest = { available: false };
  if (b.sealed) {
    try {
      const r = await withSealed(env, b.sealed, async (t) => {
        const [s, rel] = await Promise.all([suggestedTerms(env, t, seed), relatedTerms(env, t, seed).catch(() => null)]);
        return { s, rel };
      });
      const items = [
        ...((r.result.s && (r.result.s.items || r.result.s)) || []).map((x) => (typeof x === 'string' ? x : x.term)),
        ...((r.result.rel && r.result.rel.related_term_groups) || []).flatMap((g) => g.related_terms || []),
      ].filter(Boolean);
      sources.push({ source: 'pinterest', items });
      pinterest = { available: true, count: items.length };
    } catch (e) {
      pinterest = { available: false, reason: e.status === 403 || e.status === 401 ? 'Pinterest keyword data needs the ads:read permission on the Pinterest app.' : 'Pinterest keyword data is unavailable right now.' };
    }
  }
  return json({ seed, pinterest, keywords: rankKeywords(seed, sources).slice(0, 60) });
}

/** POST /api/trends {sealed, region}: Pinterest's own trending keywords (needs ads:read). */
export async function trends(request, env) {
  await rateLimit(env, `tr:${clientIp(request)}`, 30, 3600);
  const b = await readJson(request);
  const region = /^[A-Z]{2}(\+[A-Z]{2})*$/.test(b.region || '') ? b.region : 'US';
  const type = ['growing', 'monthly', 'yearly', 'seasonal'].includes(b.type) ? b.type : 'growing';
  try {
    const r = await withSealed(env, b.sealed, (t) => trendingKeywords(env, t, region, type));
    return json({ trends: (r.result.trends || []).map((x) => ({ keyword: x.keyword, pct_growth_wow: x.pct_growth_wow, pct_growth_mom: x.pct_growth_mom, pct_growth_yoy: x.pct_growth_yoy })), ...(r.sealed ? { sealed: r.sealed } : {}) });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(e.status === 403 || e.status === 401 ? 403 : 502, 'Pinterest Trends needs the ads:read permission on the Pinterest app. Use keyword research and the seasonal planner meanwhile.', 'NO_TRENDS');
  }
}

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re);
  if (!tag) return null;
  const c = tag[0].match(/content=["']([^"']*)["']/i);
  return c ? c[1].replace(/&amp;/g, '&').trim() : null;
}

/** GET /api/page-info?url=: images from a blog post + Rich Pin readiness. */
export async function pageInfo(request, env) {
  await rateLimit(env, `pi:${clientIp(request)}`, 60, 3600);
  const target = safePublicUrl(new URL(request.url).searchParams.get('url'));
  const data = await cached(`pi:${target}`, 21600, async () => {
    let res;
    try { res = await fetch(target.toString(), { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' }); }
    catch { throw new HttpError(502, 'Could not open that page.', 'FETCH_FAILED'); }
    if (!res.ok || !(res.headers.get('Content-Type') || '').includes('html')) throw new HttpError(502, `That page could not be read (${res.status}).`, 'FETCH_FAILED');
    const reader = res.body.getReader();
    let html = '', total = 0;
    const dec = new TextDecoder();
    while (total < 1500000) { const { done, value } = await reader.read(); if (done) break; total += value.length; html += dec.decode(value, { stream: true }); }
    try { reader.cancel(); } catch { /* ignore */ }
    const abs = (u) => { try { return new URL(u, res.url || target).toString(); } catch { return null; } };
    const og = { title: meta(html, 'og:title'), description: meta(html, 'og:description'), image: meta(html, 'og:image'), type: meta(html, 'og:type'), site: meta(html, 'og:site_name') };
    const images = new Set();
    for (const k of ['og:image', 'twitter:image', 'og:image:url']) { const v = meta(html, k); if (v && abs(v)) images.add(abs(v)); }
    for (const m of html.matchAll(/<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["'][^>]*>/gi)) {
      const src = abs(m[1]);
      if (!src || /\.(svg|gif)(\?|$)/i.test(src) || /(logo|icon|avatar|emoji|pixel|spinner|gravatar)/i.test(src) || src.startsWith('data:')) continue;
      images.add(src);
      if (images.size >= 16) break;
    }
    const title = og.title || (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) || [])[1] || '';
    return {
      url: res.url || target.toString(), title: title.trim(), description: og.description || meta(html, 'description') || '',
      images: [...images],
      richPins: {
        ready: !!(og.title && og.description && og.image),
        checks: { 'og:title': !!og.title, 'og:description': !!og.description, 'og:image': !!og.image, 'og:type': og.type || null, 'og:site_name': og.site || null },
      },
    };
  });
  return json(data);
}

/** GET /api/img?url=: CORS-safe image proxy so the browser can export canvases with remote images. */
export async function imageProxy(request, env) {
  await rateLimit(env, `img:${clientIp(request)}`, 300, 3600);
  const target = safePublicUrl(new URL(request.url).searchParams.get('url'));
  const res = await fetch(target.toString(), { headers: { 'User-Agent': UA }, cf: { cacheTtl: 86400, cacheEverything: true } });
  const type = res.headers.get('Content-Type') || '';
  if (!res.ok || !type.startsWith('image/')) throw new HttpError(502, 'Could not load that image.', 'BAD_IMAGE');
  if (+(res.headers.get('Content-Length') || 0) > 15 * 1024 * 1024) throw new HttpError(413, 'Image is too large.', 'TOO_LARGE');
  return new Response(res.body, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
}

/**
 * GET /api/images?q=: the AMAWP free image library (owner's own image API).
 * Configure with Worker vars/secrets: AMAWP_IMAGE_API_URL (use {q} and {page} placeholders or we append ?q=&page=),
 * optional AMAWP_IMAGE_API_KEY (sent as Bearer; never exposed to browsers) and AMAWP_IMAGE_NAME.
 */
export async function amawpImages(request, env) {
  if (!env.AMAWP_IMAGE_API_URL) throw new HttpError(404, 'The AMAWP image library is not configured.', 'NOT_CONFIGURED');
  await rateLimit(env, `amimg:${clientIp(request)}`, 120, 3600);
  const u = new URL(request.url);
  const q = (u.searchParams.get('q') || '').slice(0, 100);
  const page = Math.max(1, Math.min(50, +u.searchParams.get('page') || 1));
  let api = env.AMAWP_IMAGE_API_URL;
  api = api.includes('{q}') ? api.replace('{q}', encodeURIComponent(q)).replace('{page}', page) : `${api}${api.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}&page=${page}`;
  const res = await fetch(api, { headers: { Accept: 'application/json', ...(env.AMAWP_IMAGE_API_KEY ? { Authorization: `Bearer ${env.AMAWP_IMAGE_API_KEY}` } : {}) } });
  if (!res.ok) throw new HttpError(502, `Image library error (${res.status}).`, 'IMAGE_API');
  const d = await res.json();
  const list = Array.isArray(d) ? d : d.results || d.images || d.hits || d.photos || d.data || d.items || [];
  const pick = (o, ...ks) => { for (const k of ks) { const v = k.split('.').reduce((a, p) => (a ? a[p] : undefined), o); if (typeof v === 'string' && v) return v; } return null; };
  return json({
    name: env.AMAWP_IMAGE_NAME || 'AMAWP library',
    results: list.slice(0, 40).map((x, i) => {
      if (typeof x === 'string') return { id: `a${i}`, thumb: x, full: x, credit: env.AMAWP_IMAGE_NAME || 'AMAWP' };
      const full = pick(x, 'full', 'url', 'src', 'image', 'largeImageURL', 'urls.regular', 'src.large2x', 'download_url');
      return { id: String(x.id ?? i), thumb: pick(x, 'thumb', 'thumbnail', 'preview', 'webformatURL', 'urls.small', 'src.medium') || full, full, credit: pick(x, 'credit', 'author', 'user', 'photographer', 'title') || (env.AMAWP_IMAGE_NAME || 'AMAWP') };
    }).filter((x) => x.full),
  });
}

/** GET /api/admin/stats (Authorization: Bearer ADMIN_KEY): daily aggregate totals only. */
export async function adminStats(request, env) {
  const key = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_KEY || key.length < 16 || key !== env.ADMIN_KEY) {
    await rateLimit(env, `adm:${clientIp(request)}`, 10, 3600);
    throw new HttpError(403, 'Wrong owner key.', 'FORBIDDEN');
  }
  const { results } = await env.DB.prepare('SELECT day, metric, n FROM daily_stats WHERE day >= ? ORDER BY day DESC')
    .bind(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).all();
  const active = await env.DB.prepare('SELECT COUNT(DISTINCT acct) AS n FROM post_quota WHERE at > ?').bind(Date.now() - 86400000).first();
  return json({ days: results || [], activeAccounts24h: active ? active.n : 0 });
}
