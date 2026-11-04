// MCP (Model Context Protocol) server over Streamable HTTP (JSON responses), so Claude, Codex, Cursor,
// ChatGPT and other AI assistants can research, design and schedule pins in the user's own workspace.
import * as core from './core.js';
import { getSetting } from './db.js';
import { scorePin, seasonsToPinNow, RANKING_TIPS } from './shared/seo.js';
import { TEMPLATE_META, PALETTE_IDS, FONT_PAIR_IDS } from './shared/templates-meta.js';
import { pollinationsImageUrl } from './shared/prompts.js';
import { DAILY_PIN_LIMIT, MIN_GAP_MINUTES } from './shared/limits.js';
import { PRESETS } from './shared/scheduler.js';

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

const pinFields = {
  title: str('Pin title, max 100 chars, main keyword first'),
  description: str('Pin description, 200-500 chars, keyword-rich natural sentences, no hashtags'),
  link: str('Destination https URL (the blog post or product page)'),
  alt_text: str('Alt text describing the image'),
  board_id: str('Pinterest board id (from list_boards)'),
  board_name: str('Board name (optional, for display)'),
  keyword: str('Main target keyword (used for SEO scoring)'),
  schedule_at: str('Optional ISO 8601 time to schedule, e.g. 2026-12-01T19:30:00Z. Omit to save as a draft.'),
};

export const TOOLS = [
  { name: 'get_status', description: `Workspace overview: connected Pinterest account, pin counts, today's publish quota and safety limits (max ${DAILY_PIN_LIMIT} pins per account per 24h, ${MIN_GAP_MINUTES} min apart).`, inputSchema: obj({}) },
  { name: 'list_boards', description: 'List the Pinterest boards of the connected account.', inputSchema: obj({}) },
  { name: 'create_board', description: 'Create a Pinterest board. Use keyword-first names like "Small Kitchen Ideas".', inputSchema: obj({ name: str('Board name'), description: str('Keyword-rich board description') }, ['name']) },
  { name: 'keyword_research', description: 'Pinterest keyword research for a seed topic: ranked long-tail keyword ideas with search intent, merged from Pinterest (when available), Google and Bing autocomplete.', inputSchema: obj({ seed: str('Seed topic, e.g. "fall decor"') }, ['seed']) },
  { name: 'seasonal_ideas', description: 'Pinterest seasonal moments whose search window is open right now, with suggested keywords. Pinterest users search 1-3 months ahead.', inputSchema: obj({}) },
  { name: 'pinterest_seo_tips', description: 'Proven Pinterest ranking practices to apply when creating pins.', inputSchema: obj({}) },
  { name: 'seo_score_pin', description: 'Score a pin for Pinterest search (0-100) with specific fixes. Run this before scheduling and improve until 85+.', inputSchema: obj({ ...pinFields, secondary_keywords: { type: 'array', items: { type: 'string' } }, headline: str('Text shown on the pin image') }, ['title', 'description']) },
  { name: 'write_pin_copy', description: 'Write an SEO title, description, alt text and board ideas with AI (free Pollinations AI, or the user\'s own AI key).', inputSchema: obj({ topic: str('What the pin is about'), keywords: str('Main keyword first, then related keywords, comma separated'), link: str('Destination URL'), board: str('Board name') }, ['topic']) },
  { name: 'page_info', description: 'Read a blog post or product page: its title, description, images (to use on pins) and whether Rich Pins meta tags are present.', inputSchema: obj({ url: str('Public https URL') }, ['url']) },
  { name: 'generate_image_url', description: 'Create a free AI image URL (Pollinations) for a vertical 1000x1500 pin. Use it as image_url or as a template image.', inputSchema: obj({ prompt: str('Vivid description of the photo, no text in image') }, ['prompt']) },
  { name: 'list_templates', description: 'List Tackly pin templates (id, text fields, number of images), colour palettes and font pairings for create_design_pin.', inputSchema: obj({}) },
  { name: 'create_design_pin', description: 'Create a pin from a Tackly template (headline, list items, images, palette, fonts). The Tackly web app renders it to a 1000x1500 image the next time it is opened; until then it cannot post.', inputSchema: obj({ template_id: str('Template id from list_templates'), text: { type: 'object', description: 'Template text fields, e.g. {"kicker":"","headline":"","items":["a","b"]}' }, images: { type: 'array', items: { type: 'string' }, description: 'Image URLs for the template image slots' }, palette_id: str('Palette id'), font_pair_id: str('Font pairing id'), ...pinFields }, ['template_id', 'text']) },
  { name: 'create_image_pin', description: 'Create a pin from a finished image URL (e.g. a Canva export hosted online or an AI image URL). Ready to post immediately.', inputSchema: obj({ image_url: str('Public https image URL, ideally 1000x1500'), ...pinFields }, ['image_url', 'title']) },
  { name: 'list_pins', description: 'List pins in the workspace.', inputSchema: obj({ status: str('draft | scheduled | posted | failed', { enum: ['draft', 'scheduled', 'posted', 'failed'] }), limit: { type: 'number' } }) },
  { name: 'update_pin', description: 'Edit a pin (title, description, link, alt text, board, keyword) or (re)schedule it.', inputSchema: obj({ pin_id: str('Pin id'), ...pinFields, status: str('draft or scheduled', { enum: ['draft', 'scheduled'] }) }, ['pin_id']) },
  { name: 'auto_schedule', description: `Spread draft pins over the coming days at natural random times (max ${DAILY_PIN_LIMIT}/day). Rotates boards and never posts the same link twice in a day.`, inputSchema: obj({ pin_ids: { type: 'array', items: { type: 'string' }, description: 'Omit to schedule all drafts' }, per_day_min: { type: 'number' }, per_day_max: { type: 'number' }, preset: str('us_peak | all_day | evenings', { enum: Object.keys(PRESETS) }), board_ids: { type: 'array', items: { type: 'string' } }, start_date: str('YYYY-MM-DD') }) },
  { name: 'publish_now', description: 'Publish a pin to Pinterest now (respects the daily safety limit and spacing).', inputSchema: obj({ pin_id: str('Pin id') }, ['pin_id']) },
  { name: 'delete_pin', description: 'Delete a pin from the workspace (does not delete it from Pinterest).', inputSchema: obj({ pin_id: str('Pin id') }, ['pin_id']) },
  { name: 'pin_stats', description: 'Pinterest analytics for a posted pin: impressions, saves, pin clicks, outbound clicks.', inputSchema: obj({ pin_id: str('Pin id') }, ['pin_id']) },
];

const trimPin = (p) => p && ({
  id: p.id, status: p.status, title: p.title, board_id: p.board_id, board_name: p.board_name, link: p.link, keyword: p.keyword,
  scheduled_at: p.scheduled_at ? new Date(p.scheduled_at).toISOString() : null, posted_at: p.posted_at ? new Date(p.posted_at).toISOString() : null,
  pinterest_pin_id: p.pinterest_pin_id, last_error: p.last_error, needs_render: !!p.design_json, template_id: p.template_id,
});

async function callTool(env, name, a = {}) {
  switch (name) {
    case 'get_status': {
      const accounts = await core.listAccounts(env);
      let quota = null;
      if (accounts.length) { try { quota = await core.quota(env, accounts[0].id); } catch (e) { quota = { error: e.message }; } }
      return { accounts: accounts.map((x) => ({ id: x.id, username: x.username, status: x.status })), quota, pins: await core.overview(env), timezone: await core.tz(env), limits: { pinsPerDay: DAILY_PIN_LIMIT, minGapMinutes: MIN_GAP_MINUTES } };
    }
    case 'list_boards': return { boards: await core.boards(env) };
    case 'create_board': return { board: await core.createBoard(env, null, a) };
    case 'keyword_research': return core.keywords(env, a.seed);
    case 'seasonal_ideas': return { seasons: seasonsToPinNow().map((x) => ({ name: x.name, peak: new Date(x.peak).toISOString().slice(0, 10), daysUntil: x.daysUntil, urgency: x.urgency, keywords: x.keywords })) };
    case 'pinterest_seo_tips': return { tips: RANKING_TIPS.map(([t, d]) => `${t}: ${d}`) };
    case 'seo_score_pin': return scorePin({ title: a.title, description: a.description, altText: a.alt_text, link: a.link, keyword: a.keyword, secondary: a.secondary_keywords, boardName: a.board_name, headline: a.headline });
    case 'write_pin_copy': {
      const r = await core.aiText(env, 'pin_copy', { topic: a.topic, keywords: a.keywords, link: a.link, board: a.board });
      return r.data || { text: r.text };
    }
    case 'page_info': return core.pageInfo(env, a.url);
    case 'generate_image_url': return { image_url: pollinationsImageUrl(`${a.prompt}, vertical pinterest photo, no text`, { width: 1000, height: 1500 }), note: 'Free AI image; open the URL once to generate it.' };
    case 'list_templates': return { templates: TEMPLATE_META, palettes: PALETTE_IDS, font_pairs: FONT_PAIR_IDS, note: 'Use create_design_pin. List fields (items, leftItems, rightItems) take arrays or newline-separated text.' };
    case 'create_design_pin': {
      const t = TEMPLATE_META.find((x) => x.id === a.template_id);
      if (!t) throw new core.EngineError(400, `Unknown template_id. Use one of: ${TEMPLATE_META.map((x) => x.id).join(', ')}`, 'BAD_TEMPLATE');
      const brand = (await getSetting(env, 'profile', {})).brandKit || {};
      const design = {
        templateId: t.id, text: { website: brand.website || '', ...(a.text || {}) }, images: (a.images || []).slice(0, 4),
        paletteId: PALETTE_IDS.includes(a.palette_id) ? a.palette_id : brand.paletteId || 'blush',
        fontPairId: FONT_PAIR_IDS.includes(a.font_pair_id) ? a.font_pair_id : brand.fontPairId || 'modern',
        overlay: 0.35, textScale: 1, imageFocus: 0.5, imageZoom: 1, showLogo: true,
      };
      const pin = await core.createPin(env, { design, templateId: t.id, title: a.title || a.text?.headline, description: a.description, link: a.link, altText: a.alt_text, boardId: a.board_id, boardName: a.board_name, keyword: a.keyword, scheduledAt: a.schedule_at, source: 'ai' });
      return { pin: trimPin(pin), next_step: 'Open the Tackly app (Schedule page) once to render AI designs into images; scheduled design pins post after rendering.' };
    }
    case 'create_image_pin': return { pin: trimPin(await core.createPin(env, { imageUrl: a.image_url, title: a.title, description: a.description, link: a.link, altText: a.alt_text, boardId: a.board_id, boardName: a.board_name, keyword: a.keyword, scheduledAt: a.schedule_at, source: 'ai' })) };
    case 'list_pins': return { pins: (await core.listPins(env, { status: a.status, limit: a.limit || 100 })).map(trimPin) };
    case 'update_pin': {
      const patch = { ...a };
      delete patch.pin_id;
      if ('schedule_at' in a) { patch.scheduled_at = a.schedule_at; delete patch.schedule_at; if (!a.status) patch.status = 'scheduled'; }
      return { pin: trimPin(await core.updatePin(env, a.pin_id, patch)) };
    }
    case 'auto_schedule': {
      const preset = PRESETS[a.preset] || PRESETS.us_peak;
      const r = await core.autoSchedule(env, { ...a, windows: preset.windows, timezone: preset.timezone });
      return { scheduled: r.scheduled, skipped: r.skipped, first_times: r.plan.slice(0, 10).map((x) => new Date(x.scheduledAt).toISOString()) };
    }
    case 'publish_now': { const r = await core.postNow(env, a.pin_id); return { result: r.result, pin: trimPin(r.pin) }; }
    case 'delete_pin': await core.deletePin(env, a.pin_id); return { deleted: true };
    case 'pin_stats': return { stats: await core.stats(env, a.pin_id) };
    default: throw new core.EngineError(400, `Unknown tool: ${name}`, 'UNKNOWN_TOOL');
  }
}

const INSTRUCTIONS = `Tackly connects you to the user's Pinterest workspace. Good workflow: get_status -> keyword_research / seasonal_ideas ->
page_info (for the user's post) -> write_pin_copy -> create_design_pin or create_image_pin (several fresh designs per URL) -> seo_score_pin
(aim for 85+) -> auto_schedule. Respect the safety limit: at most ${DAILY_PIN_LIMIT} pins per account per day, never spam the same link.`;

export async function handleMcp(request, env) {
  if (request.method === 'GET') return new Response('Tackly MCP endpoint. Use POST (Streamable HTTP).', { status: 405, headers: { Allow: 'POST' } });
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  let msg;
  try { msg = await request.json(); } catch { return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 }); }
  const handleOne = async (m) => {
    const { id, method, params = {} } = m || {};
    if (id === undefined || id === null) return null; // notification
    try {
      if (method === 'initialize') {
        return { jsonrpc: '2.0', id, result: { protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'tackly', version: '2.0.0' }, instructions: INSTRUCTIONS } };
      }
      if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
      if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
      if (method === 'tools/call') {
        try {
          const data = await callTool(env, params.name, params.arguments || {});
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data } };
        } catch (e) {
          return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: e.message || String(e) }] } };
        }
      }
      if (method === 'resources/list') return { jsonrpc: '2.0', id, result: { resources: [] } };
      if (method === 'prompts/list') return { jsonrpc: '2.0', id, result: { prompts: [] } };
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    } catch (e) {
      return { jsonrpc: '2.0', id, error: { code: -32603, message: e.message } };
    }
  };
  if (Array.isArray(msg)) {
    const out = (await Promise.all(msg.map(handleOne))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const r = await handleOne(msg);
  return r ? Response.json(r) : new Response(null, { status: 202 });
}
