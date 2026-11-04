import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../src/designer/templates.js';
import { PALETTES, FONT_PAIRS } from '../src/designer/styles.js';
import { TEMPLATE_META, PALETTE_IDS, FONT_PAIR_IDS } from '../../shared/templates-meta.js';
import { scorePin, rankKeywords, seasonsToPinNow } from '../../shared/seo.js';
import { checkDailyLimit, DAILY_PIN_LIMIT } from '../../shared/limits.js';
import { titleFromFilename } from '../src/lib/unzip.js';

describe('MCP template catalogue matches the designer', () => {
  it('has the same templates, fields and image slots', () => {
    expect(TEMPLATE_META.map((t) => t.id)).toEqual(TEMPLATES.map((t) => t.id));
    for (const t of TEMPLATES) {
      const m = TEMPLATE_META.find((x) => x.id === t.id);
      expect(m.fields).toEqual(t.fields);
      expect(m.imageSlots).toBe(t.imageSlots);
    }
    expect(PALETTE_IDS).toEqual(PALETTES.map((p) => p.id));
    expect(FONT_PAIR_IDS).toEqual(FONT_PAIRS.map((f) => f.id));
  });
  it('all templates are free', () => {
    expect(TEMPLATES.every((t) => t.tier === 'free')).toBe(true);
    expect(TEMPLATES.length).toBe(21);
  });
});

describe('Pinterest SEO scoring', () => {
  const good = {
    keyword: 'small kitchen ideas', secondary: ['kitchen storage', 'apartment kitchen'],
    title: 'Small Kitchen Ideas: 21 Clever Storage Hacks That Work',
    description: 'Small kitchen ideas that make a tiny space feel bigger. These kitchen storage hacks are perfect for any apartment kitchen, from vertical shelves to hidden drawers and smart organizers. Save this pin for your next weekend project and try one idea today.',
    altText: 'A bright small kitchen with open shelves, hanging rails and white cabinets', link: 'https://example.com/small-kitchen-ideas',
    boardName: 'Small Kitchen Ideas', headline: '21 Small Kitchen Ideas',
  };
  it('rewards a well-optimised pin', () => { expect(scorePin(good).score).toBeGreaterThanOrEqual(90); });
  it('flags weak pins with fixes', () => {
    const r = scorePin({ ...good, title: 'Look at this', description: 'nice #kitchen #home', altText: '', link: 'https://bit.ly/x' });
    expect(r.score).toBeLessThan(50);
    expect(r.checks.find((c) => c.id === 'no_hashtags').ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'link').ok).toBe(false);
  });
  it('ranks keywords from multiple sources', () => {
    const k = rankKeywords('fall decor', [{ source: 'google', items: ['fall decor ideas', 'fall decor living room'] }, { source: 'bing', items: ['fall decor ideas'] }]);
    expect(k[0].keyword).toBe('fall decor ideas');
    expect(k[0].sources).toEqual(['google', 'bing']);
  });
  it('lists open seasons', () => {
    const s = seasonsToPinNow(Date.UTC(2026, 10, 4));
    expect(s.map((x) => x.name)).toContain('Christmas');
  });
});

describe('daily limit helper', () => {
  it('blocks the 11th pin on a day for one account', () => {
    const base = Date.UTC(2026, 10, 10, 12);
    const pins = Array.from({ length: DAILY_PIN_LIMIT }, (_, i) => ({ id: `p${i}`, account_id: 'a', status: 'scheduled', scheduled_at: base + i * 60000 }));
    expect(checkDailyLimit(pins, { id: 'x', accountId: 'a', at: base + 3600000, tz: 'UTC' })).toMatch(/already has/);
    expect(checkDailyLimit(pins, { id: 'x', accountId: 'b', at: base, tz: 'UTC' })).toBeNull();
    expect(checkDailyLimit(pins, { id: 'x', accountId: 'a', at: base + 86400000, tz: 'UTC' })).toBeNull();
  });
});

describe('Canva file names', () => {
  it('turns file names into titles', () => {
    expect(titleFromFilename('fall-decor-ideas_2.png')).toBe('Fall Decor Ideas');
    expect(titleFromFilename('Pinterest Pin (3).png')).toBe('Pinterest Pin');
  });
});
