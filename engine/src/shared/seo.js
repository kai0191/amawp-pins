// AUTO-COPIED from shared/seo.js by scripts/sync-engine-shared.mjs. Edit the original, not this copy.
// Pinterest SEO toolkit: pin scoring, keyword helpers, seasonal planner and ranking tips.
// Shared by the web app and the user's engine (MCP tools).

const STOP = new Set('a an and are as at be by for from how i in is it of on or our the this to with you your my we what why when best top new'.split(' '));

export function words(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
}
export function containsPhrase(text, phrase) {
  if (!phrase) return false;
  const t = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const p = ` ${String(phrase).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  return t.includes(p);
}
function coverage(text, phrase) {
  const w = words(phrase);
  if (!w.length) return 0;
  const set = new Set(words(text));
  return w.filter((x) => set.has(x)).length / w.length;
}

/**
 * Score a pin for Pinterest search (0-100) with concrete fixes.
 * @param p {title, description, altText, link, keyword, secondary: string[], boardName, headline}
 */
export function scorePin(p) {
  const kw = String(p.keyword || '').trim();
  const title = String(p.title || '');
  const desc = String(p.description || '');
  const checks = [];
  const add = (id, weight, ok, label, fix) => checks.push({ id, weight, ok: !!ok, label, fix });

  add('keyword', 6, kw, 'A main keyword is chosen', 'Pick one main keyword people actually search (use Keyword research).');
  add('title_kw', 14, kw && containsPhrase(title, kw), 'Main keyword is in the title', `Put “${kw || 'your keyword'}” in the title, ideally at the start.`);
  add('title_front', 6, kw && title.toLowerCase().slice(0, 40).includes(kw.toLowerCase().split(' ')[0]), 'Keyword appears early in the title', 'Move the keyword into the first 40 characters; Pinterest shows ~40 characters in feeds.');
  add('title_len', 8, title.length >= 30 && title.length <= 100, 'Title is 30–100 characters', title.length < 30 ? 'Make the title longer and more descriptive.' : 'Keep the title under 100 characters.');
  add('desc_len', 10, desc.length >= 200 && desc.length <= 500, 'Description is 200–500 characters', desc.length < 200 ? 'Write 2–3 natural sentences (200–500 characters).' : 'Trim the description to under 500 characters.');
  add('desc_kw', 12, kw && containsPhrase(desc, kw), 'Main keyword is in the description', 'Use the main keyword naturally in the first sentence of the description.');
  add('desc_front', 5, kw && desc.toLowerCase().slice(0, 120).includes(kw.toLowerCase().split(' ')[0]), 'Keyword in the first 120 characters', 'Pinterest weighs the start of the description most. Lead with the keyword.');
  const sec = (p.secondary || []).filter(Boolean);
  const secHits = sec.filter((s) => coverage(`${title} ${desc}`, s) >= 0.99).length;
  add('secondary', 8, sec.length ? secHits >= Math.min(2, sec.length) : false, 'Uses 2+ related keywords', 'Add two related keywords (long-tail variations) to the description.');
  add('no_hashtags', 4, !/#\w/.test(desc), 'No hashtag stuffing', 'Remove hashtags; Pinterest ranks keywords in natural sentences instead.');
  add('no_stuffing', 4, !kw || (desc.toLowerCase().split(kw.toLowerCase()).length - 1) <= 3, 'Keyword not repeated too often', 'Use the main keyword at most 2–3 times.');
  add('cta', 3, /\b(save|click|learn|discover|try|get|read|shop|find|grab|see)\b/i.test(desc), 'Has a soft call to action', 'End with a soft call to action like “Save this pin for later”.');
  add('alt', 6, String(p.altText || '').length >= 40, 'Alt text describes the image', 'Add alt text (40+ characters) describing the image. It helps accessibility and search.');
  let linkOk = false;
  try { const u = new URL(p.link); linkOk = /^https?:$/.test(u.protocol) && !/(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|rebrand\.ly)/i.test(u.hostname); } catch { /* invalid */ }
  add('link', 6, linkOk, 'Links to a full https URL (no shortener)', 'Link straight to your page. Pinterest distrusts URL shorteners.');
  add('board', 4, kw && p.boardName && coverage(p.boardName, kw) >= 0.5, 'Board name matches the keyword', 'Save to a board whose name contains the keyword (e.g. “Small Kitchen Ideas”).');
  add('overlay', 4, kw && p.headline && coverage(p.headline, kw) >= 0.5, 'Text on the image contains the keyword', 'Pinterest reads the text on your image. Put the keyword in the headline on the pin.');

  const total = checks.reduce((a, c) => a + c.weight, 0);
  const got = checks.reduce((a, c) => a + (c.ok ? c.weight : 0), 0);
  const score = Math.round((got / total) * 100);
  const grade = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs work' : 'Weak';
  return { score, grade, checks };
}

/** Query variations used to mine autocomplete suggestions for a seed keyword. */
export function seedQueries(seed) {
  const s = String(seed || '').trim().toLowerCase();
  if (!s) return [];
  return [s, `${s} ideas`, `${s} for beginners`, `how to ${s}`, `easy ${s}`, `${s} aesthetic`, `${s} diy`, `best ${s}`, `${s} tips`, `${s} 2026`];
}

/** Merge suggestion lists from several sources into ranked keyword ideas. */
export function rankKeywords(seed, sources) {
  const map = new Map();
  const seedW = new Set(words(seed));
  for (const { source, items } of sources) {
    (items || []).forEach((raw, i) => {
      const k = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!k || k.length > 80) return;
      const e = map.get(k) || { keyword: k, score: 0, sources: new Set() };
      e.score += Math.max(1, 10 - i) * (source === 'pinterest' ? 2 : 1);
      e.sources.add(source);
      map.set(k, e);
    });
  }
  return [...map.values()]
    .map((e) => {
      const w = words(e.keyword);
      const longTail = w.length >= 3;
      const relevance = w.filter((x) => seedW.has(x)).length / Math.max(1, seedW.size);
      const score = Math.round(e.score * (1 + e.sources.size * 0.5) * (0.5 + relevance) * (longTail ? 1.2 : 1));
      return {
        keyword: e.keyword, score, sources: [...e.sources], longTail,
        intent: /\b(how|diy|tutorial|step|guide|tips)\b/.test(e.keyword) ? 'how-to' : /\b(ideas|inspo|inspiration|aesthetic)\b/.test(e.keyword) ? 'ideas'
          : /\b(buy|best|shop|gift|deal|cheap|under)\b/.test(e.keyword) ? 'buying' : 'general',
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Seasonal Pinterest moments. Pinterest users start searching 1–3 months before the date. */
export const SEASONS = [
  { name: 'New Year & goals', month: 1, day: 1, lead: 60, keywords: ['new year goals', 'vision board ideas', 'healthy meal prep', 'home organization'] },
  { name: 'Valentine’s Day', month: 2, day: 14, lead: 60, keywords: ['valentines day ideas', 'valentines gifts for him', 'valentines nails', 'date night ideas'] },
  { name: 'Spring cleaning', month: 3, day: 20, lead: 60, keywords: ['spring cleaning checklist', 'spring decor', 'garden planning', 'spring outfits'] },
  { name: 'Easter', month: 4, day: 5, lead: 60, keywords: ['easter crafts', 'easter brunch recipes', 'easter basket ideas'] },
  { name: 'Mother’s Day', month: 5, day: 10, lead: 60, keywords: ['mothers day gifts', 'mothers day brunch', 'diy mothers day'] },
  { name: 'Summer & travel', month: 6, day: 21, lead: 75, keywords: ['summer outfits', 'road trip ideas', 'summer recipes', 'packing list'] },
  { name: 'Back to school', month: 8, day: 15, lead: 75, keywords: ['back to school outfits', 'lunch box ideas', 'dorm room ideas', 'classroom decor'] },
  { name: 'Fall & Halloween', month: 10, day: 31, lead: 90, keywords: ['fall decor', 'halloween costumes', 'pumpkin recipes', 'fall nails'] },
  { name: 'Thanksgiving', month: 11, day: 26, lead: 75, keywords: ['thanksgiving recipes', 'thanksgiving table decor', 'friendsgiving ideas'] },
  { name: 'Black Friday & gifts', month: 11, day: 27, lead: 75, keywords: ['gift guide', 'gifts for her', 'gifts for him', 'stocking stuffers'] },
  { name: 'Christmas', month: 12, day: 25, lead: 100, keywords: ['christmas decor', 'christmas cookies', 'christmas gift ideas', 'christmas nails'] },
];

/** Seasons to pin for now: those whose search window is open (peak within `lead` days). */
export function seasonsToPinNow(now = Date.now()) {
  const d = new Date(now);
  const out = [];
  for (const s of SEASONS) {
    for (const y of [d.getUTCFullYear(), d.getUTCFullYear() + 1]) {
      const peak = Date.UTC(y, s.month - 1, s.day);
      const days = Math.round((peak - now) / 86400000);
      if (days >= -3 && days <= s.lead) { out.push({ ...s, peak, daysUntil: days, urgency: days < 21 ? 'last call' : days < 45 ? 'now' : 'early' }); break; }
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export const RANKING_TIPS = [
  ['Fresh pins win', 'Pinterest favours new images. Make several different pin designs for the same blog post instead of re-pinning one image.'],
  ['Keywords beat hashtags', 'Pinterest is a visual search engine. Put real search phrases in the title, the first sentence of the description, the board name and the text on the image.'],
  ['Text on the image is read', 'Pinterest reads the words on your pin image. Use the keyword in the headline you place on the pin.'],
  ['Pin consistently, not in bursts', 'A few pins every day ranks better than 50 at once. Tackly caps each account at 10 pins a day and spreads times naturally.'],
  ['First 30 characters matter', 'Feeds show only the start of the title. Lead with the keyword, then the benefit.'],
  ['Keyword-rich boards', 'Name boards after what people search (“Small Kitchen Ideas”, not “My stuff”) and write a 2-sentence board description with keywords.'],
  ['Pin to the most relevant board first', 'The first board a pin is saved to tells Pinterest what it is about.'],
  ['Plan seasons early', 'People search 1–3 months before holidays. Start pinning seasonal content 60–90 days ahead.'],
  ['Claim your website and enable Rich Pins', 'Claim your site in Pinterest settings and add Open Graph tags so Pinterest shows your title and description on every pin from your site.'],
  ['2:3 vertical images', 'Use 1000×1500. Taller images get cut off; square ones get less space in the feed.'],
  ['Alt text helps', 'Describe the image in alt text. It improves accessibility and gives Pinterest more context.'],
  ['Link to the exact page', 'Send people to the specific post or product, never a home page or URL shortener.'],
  ['Same link, different days', 'If you make several pins for one URL, spread them across days and boards. Tackly does this automatically.'],
  ['Engagement in the first hours', 'Pin when your audience is active (US evenings and lunch time) so early saves push the pin further.'],
];
