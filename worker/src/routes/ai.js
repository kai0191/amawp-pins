import { HttpError, json, readJson } from '../lib/http.js';
import { requireUser, rateLimit } from '../lib/auth.js';
import { loadAiSettings } from './auth.js';
import { buildPrompt, parseJsonLoose, POLLINATIONS_TEXT, pollinationsImageUrl } from '../../../shared/prompts.js';

async function chat(base, key, model, prompt) {
  const res = await fetch(`${base.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.8 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `AI provider error: ${(data.error && data.error.message) || res.status}`, 'AI_ERROR');
  return data.choices?.[0]?.message?.content || '';
}

export async function pollinationsText(prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  const res = await fetch(`${POLLINATIONS_TEXT}/${encodeURIComponent(prompt)}?model=openai&seed=${seed}`);
  if (res.ok) return res.text();
  // fallback: Pollinations' OpenAI-compatible endpoint
  const res2 = await fetch(`${POLLINATIONS_TEXT}/openai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: prompt }], seed }),
  });
  const data = await res2.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  if (res2.ok && text) return text;
  throw new HttpError(502, `Free AI is busy right now (${res.status}). Please try again in a minute.`, 'AI_BUSY');
}

export async function aiText(request, env) {
  const user = await requireUser(request, env);
  await rateLimit(env, `ai:${user.id}`, 60, 3600);
  const body = await readJson(request);
  let prompt;
  try { prompt = buildPrompt(body.task, body.input || {}); } catch (e) { throw new HttpError(400, e.message, 'BAD_TASK'); }
  const s = await loadAiSettings(env, user);
  const own = s.textBaseUrl && s.textKey;
  const text = own ? await chat(s.textBaseUrl, s.textKey, s.textModel || 'gpt-4o-mini', prompt) : await pollinationsText(prompt);
  return json({ text, data: parseJsonLoose(text), provider: own ? 'custom' : 'pollinations' });
}

export async function aiImage(request, env) {
  const user = await requireUser(request, env);
  await rateLimit(env, `aiimg:${user.id}`, 40, 3600);
  const body = await readJson(request);
  const prompt = String(body.prompt || '').slice(0, 1000);
  if (!prompt) throw new HttpError(400, 'Describe the image you want.', 'NO_PROMPT');
  const s = await loadAiSettings(env, user);
  if (!(s.imageBaseUrl && s.imageKey)) {
    return json({ url: pollinationsImageUrl(prompt, { width: 1000, height: 1500 }), provider: 'pollinations' });
  }
  const res = await fetch(`${s.imageBaseUrl.replace(/\/+$/, '')}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.imageKey}` },
    body: JSON.stringify({ model: s.imageModel || 'gpt-image-1', prompt, n: 1, size: body.size || '1024x1536' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `Image provider error: ${(data.error && data.error.message) || res.status}`, 'AI_ERROR');
  const item = data.data?.[0] || {};
  if (item.b64_json) return json({ b64: item.b64_json, provider: 'custom' });
  if (item.url) return json({ url: item.url, provider: 'custom' });
  throw new HttpError(502, 'Image provider returned no image.', 'AI_ERROR');
}

/** Authenticated image proxy so the browser can draw any image on a canvas (CORS-safe). */
export async function imageProxy(request, env) {
  await requireUser(request, env);
  const target = new URL(request.url).searchParams.get('url') || '';
  if (!/^https?:\/\//i.test(target)) throw new HttpError(400, 'Bad image URL.', 'BAD_URL');
  const res = await fetch(target, { headers: { 'User-Agent': 'TacklyImageProxy/1.0' }, cf: { cacheTtl: 86400, cacheEverything: true } });
  const type = res.headers.get('Content-Type') || '';
  if (!res.ok || !type.startsWith('image/')) throw new HttpError(502, 'Could not load that image.', 'BAD_IMAGE');
  const len = +(res.headers.get('Content-Length') || 0);
  if (len > 15 * 1024 * 1024) throw new HttpError(413, 'Image is too large.', 'TOO_LARGE');
  return new Response(res.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' } });
}
