// Pin templates (1000x1500). Each template draws with the helper toolkit from render.js.
// All templates are free.
import { hexA } from './render.js';

const P = 70; // outer padding

export const FIELD_LABELS = {
  kicker: 'Small label', headline: 'Headline', subhead: 'Subheading', body: 'Body text', cta: 'Button / call to action',
  items: 'List items (one per line)', number: 'Big number', label: 'Number label', author: 'Author / source',
  price: 'Price', meta1: 'Detail 1', meta2: 'Detail 2', meta3: 'Detail 3', leftLabel: 'Left title', rightLabel: 'Right title',
  leftItems: 'Left points (one per line)', rightItems: 'Right points (one per line)', brandName: 'Masthead / brand',
};

const T = [];
const add = (t) => T.push({ tier: 'free', imageSlots: 0, ...t });

// 1. Photo + headline
add({
  id: 'hero-overlay', name: 'Photo + Headline', category: 'Photo', imageSlots: 1,
  fields: ['kicker', 'headline', 'subhead'],
  defaults: { kicker: 'New on the blog', headline: '15 Cozy Fall Decor Ideas on a Budget', subhead: 'Simple swaps that make any room feel warm' },
  draw(h) {
    const { t, pal, design } = h;
    h.cover(0, 0, 0, 1000, 1500);
    h.gradient(450, 1500, '#000000', 0, Math.min(0.92, 0.45 + (design.overlay ?? 0.35)));
    const sub = h.text(t.subhead, P, 1225, 860, 110, { font: 'body', max: 38, color: 'rgba(255,255,255,0.92)', valign: 'top' });
    const head = h.text(t.headline, P, 820, 860, 390, { max: 118, color: '#fff', valign: 'bottom', shadow: true });
    if (t.kicker) h.pill(t.kicker, P, head.top - 84, { bg: pal.accent, color: pal.accentText, size: 24 });
    void sub;
    h.footer(1420, { color: 'rgba(255,255,255,0.9)' });
  },
});

// 2. Blog classic split
add({
  id: 'split-band', name: 'Blog Classic', category: 'Photo', imageSlots: 1,
  fields: ['kicker', 'headline', 'subhead'],
  defaults: { kicker: 'Easy weeknight dinner', headline: 'One-Pan Lemon Garlic Chicken', subhead: 'Ready in 30 minutes · 5 ingredients' },
  draw(h) {
    const { t, pal } = h;
    h.cover(0, 0, 0, 1000, 880);
    h.fill(pal.bg, 0, 860, 1000, 640);
    h.rect(0, 840, 1000, 40, 0, pal.accent);
    h.text(t.kicker, P, 935, 860, 50, { font: 'body', weight: 700, max: 30, color: pal.accent, align: 'center', upper: true });
    h.text(t.headline, P, 1000, 860, 260, { max: 104, align: 'center', valign: 'middle' });
    h.text(t.subhead, P, 1285, 860, 70, { font: 'body', max: 34, color: pal.muted, align: 'center' });
    h.footer(1420);
  },
});

// 3. Framed card
add({
  id: 'framed-card', name: 'Center Card', category: 'Photo', imageSlots: 1,
  fields: ['kicker', 'headline', 'subhead', 'cta'],
  defaults: { kicker: 'The ultimate guide', headline: 'How to Start a Vegetable Garden', subhead: 'Everything beginners need to know', cta: 'Read more' },
  draw(h) {
    const { t, pal, design } = h;
    h.cover(0, 0, 0, 1000, 1500);
    h.fill(hexA('#000000', Math.min(0.6, (design.overlay ?? 0.35) * 0.7)));
    h.rect(100, 370, 800, 760, 36, pal.surface, { shadow: true });
    h.text(t.kicker, 160, 430, 680, 50, { font: 'body', weight: 700, max: 28, color: pal.accent, align: 'center', upper: true });
    const head = h.text(t.headline, 160, 500, 680, 330, { max: 96, align: 'center', valign: 'middle' });
    h.rect(440, head.bottom + 34, 120, 6, 3, pal.accent);
    h.text(t.subhead, 160, head.bottom + 70, 680, 110, { font: 'body', max: 34, color: pal.muted, align: 'center' });
    if (t.cta) h.pill(t.cta, 500, 1030, { align: 'center', size: 26 });
    h.footer(1300, { color: '#fff' });
  },
});

// 4. Checklist
add({
  id: 'checklist', name: 'Checklist', category: 'List', imageSlots: 1,
  fields: ['kicker', 'headline', 'items'],
  defaults: {
    kicker: 'Free printable', headline: 'Moving Day Checklist',
    items: ['Book movers 6 weeks out', 'Declutter room by room', 'Order packing supplies', 'Update your address', 'Pack an essentials box', 'Take meter photos'],
  },
  draw(h) {
    const { t, pal, items } = h;
    h.cover(0, 0, 0, 1000, 500);
    h.gradient(0, 500, '#000000', 0.15, 0.65);
    h.text(t.kicker, P, 200, 860, 44, { font: 'body', weight: 700, max: 28, color: '#fff', upper: true, align: 'center' });
    h.text(t.headline, P, 250, 860, 220, { max: 100, color: '#fff', align: 'center', valign: 'middle', shadow: true });
    h.rect(P, 470, 860, 900, 32, pal.surface, { shadow: true });
    const list = items.slice(0, 8);
    h.rows(list.length, 510, 1330, (i, y, rh) => {
      const sz = Math.min(56, rh * 0.55);
      h.check(P + 50, y + (rh - sz) / 2, sz, pal.accent, pal.accentText);
      h.text(list[i], P + 50 + sz + 30, y, 860 - 130 - sz, rh, { font: 'body', weight: 600, max: 40, valign: 'middle' });
    });
    h.footer(1430);
  },
});

// 5. Numbered steps
add({
  id: 'numbered-steps', name: 'Numbered Steps', category: 'List',
  fields: ['kicker', 'headline', 'items'],
  defaults: {
    kicker: 'Step by step', headline: 'How to Make Cold Brew at Home',
    items: ['Coarsely grind 1 cup of beans', 'Add 4 cups of cold water', 'Stir and steep for 12–18 hours', 'Strain through a fine filter', 'Dilute 1:1 and serve over ice'],
  },
  draw(h) {
    const { t, pal, items } = h;
    h.circle(930, 120, 220, hexA(pal.accent, 0.12));
    h.circle(60, 1400, 180, hexA(pal.accent, 0.10));
    h.text(t.kicker, P, 100, 860, 44, { font: 'body', weight: 700, max: 28, color: pal.accent, upper: true });
    h.text(t.headline, P, 150, 860, 280, { max: 100, valign: 'middle' });
    const list = items.slice(0, 7);
    h.rows(list.length, 470, 1350, (i, y, rh) => {
      const r = Math.min(46, rh * 0.36);
      h.numberBadge(i + 1, P + r, y + rh / 2, r, pal.accent, pal.accentText);
      if (i < list.length - 1) h.rect(P + r - 3, y + rh / 2 + r + 6, 6, rh - 2 * r - 12, 3, hexA(pal.accent, 0.3));
      h.text(list[i], P + 2 * r + 34, y, 860 - 2 * r - 34, rh, { font: 'body', weight: 600, max: 42, valign: 'middle' });
    });
    h.footer(1430);
  },
});

// 6. Before / after
add({
  id: 'before-after', name: 'Before & After', category: 'Compare', imageSlots: 2,
  fields: ['headline', 'leftLabel', 'rightLabel'],
  defaults: { headline: 'Our $300 Bathroom Makeover', leftLabel: 'Before', rightLabel: 'After' },
  draw(h) {
    const { t, pal } = h;
    h.cover(0, 0, 0, 1000, 700);
    h.cover(1, 0, 800, 1000, 700);
    h.pill(t.leftLabel || 'Before', 50, 50, { bg: '#ffffff', color: '#111', size: 26 });
    h.pill(t.rightLabel || 'After', 50, 1330, { bg: pal.accent, color: pal.accentText, size: 26 });
    h.rect(60, 600, 880, 300, 30, pal.surface, { shadow: true });
    h.text(t.headline, 110, 625, 780, 220, { max: 86, align: 'center', valign: 'middle' });
    h.footer(870, { size: 24 });
  },
});

// 7. Versus
add({
  id: 'versus', name: 'This vs That', category: 'Compare', imageSlots: 2,
  fields: ['headline', 'leftLabel', 'leftItems', 'rightLabel', 'rightItems'],
  defaults: {
    headline: 'Air Fryer vs Oven: Which Wins?', leftLabel: 'Air fryer', rightLabel: 'Oven',
    leftItems: ['Crispier results', 'Heats up in 2 min', 'Uses less energy'], rightItems: ['Bigger batches', 'Even baking', 'No extra gadget'],
  },
  draw(h) {
    const { t, pal } = h;
    h.fill(pal.accent, 0, 0, 1000, 300);
    h.text(t.headline, P, 40, 860, 220, { max: 90, color: pal.accentText, align: 'center', valign: 'middle' });
    const col = (i, x, label, list) => {
      h.cover(i, x, 340, 410, 420, 28);
      h.text(label, x, 790, 410, 70, { max: 52, align: 'center', valign: 'middle' });
      const pts = String(list || '').split('\n').filter(Boolean).slice(0, 5);
      h.rows(pts.length, 880, 1330, (k, y, rh) => {
        h.circle(x + 18, y + rh / 2, 9, pal.accent);
        h.text(pts[k], x + 42, y, 368, rh, { font: 'body', weight: 600, max: 34, valign: 'middle' });
      });
    };
    col(0, 60, t.leftLabel, Array.isArray(t.leftItems) ? t.leftItems.join('\n') : t.leftItems);
    col(1, 530, t.rightLabel, Array.isArray(t.rightItems) ? t.rightItems.join('\n') : t.rightItems);
    h.circle(500, 560, 62, pal.text);
    h.text('VS', 440, 520, 120, 80, { max: 50, color: pal.bg, align: 'center', valign: 'middle', upper: true });
    h.footer(1430);
  },
});

// 8. Top 3
add({
  id: 'top-three', name: 'Top 3', category: 'List', imageSlots: 3,
  fields: ['kicker', 'headline', 'items'],
  defaults: { kicker: 'Tested & loved', headline: 'Top 3 Carry-On Bags for 2026', items: ['Featherweight Roller — best overall', 'Weekender Duffel — best for road trips', 'Underseat Pack — best budget pick'] },
  draw(h) {
    const { t, pal, items } = h;
    h.text(t.kicker, P, 70, 860, 44, { font: 'body', weight: 700, max: 28, color: pal.accent, upper: true, align: 'center' });
    h.text(t.headline, P, 120, 860, 230, { max: 92, align: 'center', valign: 'middle' });
    const list = items.slice(0, 3);
    while (list.length < 3) list.push('');
    h.rows(3, 390, 1360, (i, y, rh) => {
      h.rect(P, y, 860, rh, 30, pal.surface, { shadow: true });
      h.cover(i, P + 20, y + 20, rh - 40, rh - 40, 22);
      const x = P + rh;
      h.text(`#${i + 1}`, x, y + 30, 200, 90, { max: 80, color: pal.accent });
      const [a, b] = h.splitItem(list[i]);
      const top = h.text(a, x, y + 120, 860 - rh - 30, rh - 210 + 60, { font: 'body', weight: 800, max: 40 });
      h.text(b, x, top.bottom + 6, 860 - rh - 30, 80, { font: 'body', max: 30, color: pal.muted });
    }, 28);
    h.footer(1432);
  },
});

// 9. Cheat sheet
add({
  id: 'cheat-sheet', name: 'Cheat Sheet', category: 'Info',
  fields: ['kicker', 'headline', 'items'],
  defaults: {
    kicker: 'Save this', headline: 'Baking Substitutes Cheat Sheet',
    items: ['1 egg: 1 tbsp flax + 3 tbsp water', 'Buttermilk: milk + 1 tbsp lemon', 'Brown sugar: sugar + molasses', 'Cake flour: flour + cornstarch', 'Butter: equal coconut oil', 'Sour cream: Greek yogurt', 'Self-rising: flour + baking powder', 'Corn syrup: honey'],
  },
  draw(h) {
    const { t, pal, items } = h;
    h.fill(pal.accent, 0, 0, 1000, 340);
    h.text(t.kicker, P, 50, 860, 44, { font: 'body', weight: 700, max: 26, color: hexA(pal.accentText, 0.85), upper: true, align: 'center' });
    h.text(t.headline, P, 100, 860, 210, { max: 88, color: pal.accentText, align: 'center', valign: 'middle' });
    const list = items.slice(0, 10);
    const rowsN = Math.ceil(list.length / 2);
    h.rows(rowsN, 380, 1370, (r, y, rh) => {
      for (let c = 0; c < 2; c++) {
        const it = list[r * 2 + c];
        if (!it) continue;
        const x = P + c * 440;
        h.rect(x, y, 420, rh, 24, pal.surface, { shadow: true });
        h.rect(x, y, 12, rh, 6, pal.accent);
        const [a, b] = h.splitItem(it);
        const top = h.text(a, x + 36, y + 22, 360, b ? rh * 0.42 : rh - 44, { font: 'body', weight: 800, max: 36, valign: b ? 'bottom' : 'middle' });
        if (b) h.text(b, x + 36, top.bottom + 8, 360, rh - (top.bottom - y) - 26, { font: 'body', max: 28, color: pal.muted });
      }
    }, 22);
    h.footer(1435);
  },
});

// 10. Collage (2)
add({
  id: 'collage-2', name: 'Collage · 2 photos', category: 'Collage', imageSlots: 2,
  fields: ['kicker', 'headline'],
  defaults: { kicker: 'Small space ideas', headline: '21 Clever Balcony Garden Ideas' },
  draw(h) {
    const { t, pal } = h;
    h.cover(0, 0, 0, 1000, 640);
    h.cover(1, 0, 900, 1000, 600);
    h.fill(pal.bg, 0, 640, 1000, 260);
    h.text(t.kicker, P, 665, 860, 40, { font: 'body', weight: 700, max: 26, color: pal.accent, upper: true, align: 'center' });
    h.text(t.headline, P, 710, 860, 170, { max: 84, align: 'center', valign: 'middle' });
    if (h.t.website) h.pill(h.t.website, 500, 1400, { align: 'center', bg: pal.surface, color: pal.text, size: 22, upper: false });
  },
});

// 11. Collage (3)
add({
  id: 'collage-3', name: 'Collage · 3 photos', category: 'Collage', imageSlots: 3,
  fields: ['headline', 'subhead'],
  defaults: { headline: 'Capsule Wardrobe for Fall', subhead: '10 pieces, 30 outfits' },
  draw(h) {
    const { t, pal } = h;
    const g = 16;
    h.cover(0, g, g, 1000 - 2 * g, 820, 22);
    h.cover(1, g, 820 + 2 * g, (1000 - 3 * g) / 2, 380, 22);
    h.cover(2, 2 * g + (1000 - 3 * g) / 2, 820 + 2 * g, (1000 - 3 * g) / 2, 380, 22);
    h.text(t.headline, P, 1260, 860, 130, { max: 84, align: 'center', valign: 'middle' });
    h.text(t.subhead, P, 1390, 860, 50, { font: 'body', max: 30, color: pal.muted, align: 'center' });
    h.footer(1465, { size: 22, logoH: 34 });
  },
});

// 12. Collage (4)
add({
  id: 'collage-4', name: 'Collage · 4 photos', category: 'Collage', imageSlots: 4,
  fields: ['kicker', 'headline'],
  defaults: { kicker: 'Weekend trip', headline: '48 Hours in Lisbon' },
  draw(h) {
    const { t, pal } = h;
    const g = 12, w = (1000 - g) / 2, hh = (1500 - g) / 2;
    h.cover(0, 0, 0, w, hh); h.cover(1, w + g, 0, w, hh);
    h.cover(2, 0, hh + g, w, hh); h.cover(3, w + g, hh + g, w, hh);
    h.rect(130, 520, 740, 460, 40, pal.surface, { shadow: true });
    h.text(t.kicker, 170, 570, 660, 44, { font: 'body', weight: 700, max: 28, color: pal.accent, upper: true, align: 'center' });
    h.text(t.headline, 170, 625, 660, 250, { max: 96, align: 'center', valign: 'middle' });
    h.footer(925, { size: 24, logoH: 40 });
  },
});

// 13. Quote
add({
  id: 'quote', name: 'Quote', category: 'Text', imageSlots: 1,
  fields: ['headline', 'author'],
  defaults: { headline: 'Small steps every day add up to big results.', author: 'Your daily reminder' },
  draw(h) {
    const { t, pal, design } = h;
    if (h.img(0)) { h.cover(0, 0, 0, 1000, 1500); h.fill(hexA(pal.bg, Math.min(0.92, 0.55 + (design.overlay ?? 0.35)))); }
    h.text('“', P, 140, 860, 300, { max: 360, color: pal.accent, align: 'center', upper: false });
    h.text(t.headline, 110, 430, 780, 640, { max: 96, align: 'center', valign: 'middle', upper: false });
    h.rect(460, 1120, 80, 6, 3, pal.accent);
    h.text(t.author, P, 1160, 860, 60, { font: 'body', weight: 700, max: 32, color: pal.muted, align: 'center', upper: true });
    h.footer(1420);
  },
});

// 14. Big stat
add({
  id: 'big-stat', name: 'Big Number', category: 'Info', imageSlots: 1,
  fields: ['kicker', 'number', 'label', 'body'],
  defaults: { kicker: 'Did you know?', number: '80%', label: 'of Pinterest users discover new brands here', body: 'Show up where people plan their purchases.' },
  draw(h) {
    const { t, pal } = h;
    h.circle(500, 520, 380, hexA(pal.accent, 0.12));
    h.text(t.kicker, P, 110, 860, 50, { font: 'body', weight: 700, max: 32, color: pal.accent, upper: true, align: 'center' });
    h.text(t.number, P, 220, 860, 420, { max: 380, color: pal.accent, align: 'center', valign: 'middle', upper: false });
    h.text(t.label, P, 660, 860, 220, { max: 64, align: 'center', valign: 'top' });
    h.text(t.body, 120, 890, 760, 130, { font: 'body', max: 34, color: pal.muted, align: 'center' });
    h.cover(0, P, 1060, 860, 300, 30);
    h.footer(1430);
  },
});

// 15. Product spotlight
add({
  id: 'product-spotlight', name: 'Product Spotlight', category: 'Shop', imageSlots: 1,
  fields: ['kicker', 'headline', 'price', 'items', 'cta'],
  defaults: { kicker: 'Editor’s pick', headline: 'Linen Throw Blanket', price: '$49', items: ['Stonewashed soft linen', '6 earthy colours', 'Machine washable'], cta: 'Shop now' },
  draw(h) {
    const { t, pal, items } = h;
    h.circle(500, 520, 360, pal.accent2);
    h.text(t.kicker, P, 70, 860, 46, { font: 'body', weight: 700, max: 28, color: pal.accent, upper: true, align: 'center' });
    h.cover(0, 200, 190, 600, 640, 40);
    if (t.price) h.pill(t.price, 790, 760, { align: 'center', size: 40, font: 'heading', upper: false });
    h.text(t.headline, P, 880, 860, 200, { max: 92, align: 'center', valign: 'middle' });
    const list = items.slice(0, 3);
    h.rows(list.length, 1100, 1300, (i, y, rh) => {
      h.text(`✓  ${list[i]}`, P, y, 860, rh, { font: 'body', weight: 600, max: 34, align: 'center', valign: 'middle', color: pal.muted });
    });
    if (t.cta) h.pill(t.cta, 500, 1330, { align: 'center', size: 30, bg: pal.text, color: pal.bg });
    h.footer(1460, { size: 22, logoH: 34 });
  },
});

// 16. Recipe card
add({
  id: 'recipe', name: 'Recipe Card', category: 'Food', imageSlots: 1,
  fields: ['headline', 'meta1', 'meta2', 'meta3', 'items'],
  defaults: {
    headline: 'Creamy Tuscan Pasta', meta1: 'Prep 10 min', meta2: 'Cook 20 min', meta3: 'Serves 4',
    items: ['Penne pasta', 'Sun-dried tomatoes', 'Baby spinach', 'Garlic', 'Heavy cream', 'Parmesan'],
  },
  draw(h) {
    const { t, pal, items } = h;
    h.cover(0, 0, 0, 1000, 760);
    h.rect(50, 640, 900, 800, 40, pal.surface, { shadow: true });
    const head = h.text(t.headline, 100, 690, 800, 190, { max: 92, align: 'center', valign: 'middle' });
    const metas = [t.meta1, t.meta2, t.meta3].filter(Boolean);
    let x = 500, widths = [];
    // measure by drawing off-screen-ish then center
    const tmp = metas.map(() => 0);
    void tmp; void x; void widths;
    const total = metas.length;
    metas.forEach((m, i) => {
      const cx = 100 + (800 / total) * (i + 0.5);
      h.pill(m, cx, head.bottom + 26, { align: 'center', bg: hexA(pal.accent, 0.12), color: pal.accent, size: 22, upper: false });
    });
    h.text('Ingredients', 100, head.bottom + 120, 800, 50, { font: 'body', weight: 800, max: 30, color: pal.accent, upper: true });
    const list = items.slice(0, 10);
    const half = Math.ceil(list.length / 2);
    for (let c = 0; c < 2; c++) {
      const part = list.slice(c * half, (c + 1) * half);
      h.rows(part.length, head.bottom + 185, 1330, (i, y, rh) => {
        h.circle(118 + c * 410, y + rh / 2, 8, pal.accent);
        h.text(part[i], 140 + c * 410, y, 360, rh, { font: 'body', max: 32, valign: 'middle' });
      });
    }
    h.footer(1395, { size: 24, logoH: 36 });
  },
});

// 17. Infographic timeline
add({
  id: 'infographic', name: 'Infographic', category: 'Info',
  fields: ['kicker', 'headline', 'items'],
  defaults: {
    kicker: 'Simple guide', headline: 'Your First Week of Pinterest Marketing',
    items: ['Day 1: Set up a business profile', 'Day 2: Create 5 keyword boards', 'Day 3: Design 10 fresh pins', 'Day 4: Schedule pins daily', 'Day 7: Check analytics and repeat'],
  },
  draw(h) {
    const { t, pal, items } = h;
    h.text(t.kicker, P, 80, 860, 44, { font: 'body', weight: 700, max: 28, color: pal.accent, upper: true, align: 'center' });
    h.text(t.headline, P, 130, 860, 260, { max: 90, align: 'center', valign: 'middle' });
    const list = items.slice(0, 6);
    const x = 150;
    h.rect(x - 4, 470, 8, 860, 4, hexA(pal.accent, 0.25));
    h.rows(list.length, 440, 1360, (i, y, rh) => {
      h.numberBadge(i + 1, x, y + rh / 2, Math.min(44, rh * 0.32), pal.accent, pal.accentText);
      h.rect(x + 70, y + 10, 930 - x - 70, rh - 20, 24, pal.surface, { shadow: true });
      const [a, b] = h.splitItem(list[i]);
      const top = h.text(a, x + 100, y + 22, 930 - x - 130, b ? (rh - 44) * 0.45 : rh - 44, { font: 'body', weight: 800, max: 34, valign: b ? 'bottom' : 'middle' });
      if (b) h.text(b, x + 100, top.bottom + 6, 930 - x - 130, rh - (top.bottom - y) - 28, { font: 'body', max: 30, color: pal.muted });
    });
    h.footer(1430);
  },
});

// 18. Listicle number
add({
  id: 'listicle-number', name: 'Big Listicle', category: 'Photo', imageSlots: 1,
  fields: ['number', 'headline', 'cta'],
  defaults: { number: '27', headline: 'Small Kitchen Ideas That Feel Huge', cta: 'See them all' },
  draw(h) {
    const { t, pal, design } = h;
    h.cover(0, 0, 0, 1000, 1500);
    h.fill(hexA('#000000', Math.min(0.75, 0.25 + (design.overlay ?? 0.35))));
    h.text(t.number, P, 230, 860, 520, { max: 520, color: '#fff', align: 'center', valign: 'middle', upper: false, shadow: true });
    h.text(t.headline, P, 760, 860, 380, { max: 100, color: '#fff', align: 'center', valign: 'top', shadow: true });
    if (t.cta) h.pill(t.cta, 500, 1200, { align: 'center', bg: pal.accent, color: pal.accentText, size: 28 });
    h.footer(1420, { color: 'rgba(255,255,255,0.9)' });
  },
});

// ---- Editorial templates ----
add({
  id: 'magazine', name: 'Magazine Cover', category: 'Editorial', imageSlots: 1,
  fields: ['brandName', 'kicker', 'headline', 'items'],
  defaults: { brandName: 'HOME', kicker: 'Autumn issue', headline: 'The Calm Home Edit', items: ['12 reading nooks', 'Paint colours we love', 'Budget lighting'] },
  draw(h) {
    const { t, pal, items } = h;
    h.cover(0, 0, 0, 1000, 1500);
    h.gradient(0, 420, '#000000', 0.45, 0);
    h.gradient(950, 1500, '#000000', 0, 0.7);
    h.text(t.brandName || 'BRAND', 40, 40, 920, 260, { max: 280, color: '#fff', align: 'center', valign: 'middle', upper: true });
    h.text(t.kicker, P, 300, 860, 40, { font: 'body', weight: 700, max: 26, color: pal.accent2, upper: true, align: 'center' });
    items.slice(0, 3).forEach((it, i) => h.text(it, P, 560 + i * 90, 380, 80, { font: 'body', weight: 800, max: 36, color: '#fff', shadow: true }));
    h.text(t.headline, P, 1040, 860, 300, { max: 110, color: '#fff', valign: 'bottom', shadow: true });
    h.footer(1430, { color: 'rgba(255,255,255,0.9)' });
  },
});
add({
  id: 'editorial-arch', name: 'Editorial Arch', category: 'Editorial', imageSlots: 1,
  fields: ['kicker', 'headline', 'subhead'],
  defaults: { kicker: 'Slow living', headline: 'A Gentle Morning Routine', subhead: 'Seven habits for calmer days' },
  draw(h) {
    const { t, pal } = h;
    h.rect(40, 40, 920, 1420, 0, null, { stroke: { color: hexA(pal.text, 0.25), width: 2 } });
    h.cover(0, 200, 140, 600, 760, 0, { shape: 'arch' });
    h.text(t.kicker, P, 1000, 860, 40, { font: 'body', weight: 700, max: 24, color: pal.accent, upper: true, align: 'center' });
    h.text(t.headline, 120, 1050, 760, 220, { max: 96, align: 'center', valign: 'middle', upper: false });
    h.text(t.subhead, 120, 1280, 760, 60, { font: 'body', max: 30, color: pal.muted, align: 'center' });
    h.footer(1400, { size: 22 });
  },
});
add({
  id: 'gradient-poster', name: 'Gradient Poster', category: 'Editorial',
  fields: ['kicker', 'headline', 'subhead', 'cta'],
  defaults: { kicker: 'Free download', headline: 'The 2026 Content Planner', subhead: 'Plan a whole year of pins in one afternoon', cta: 'Get it free' },
  draw(h) {
    const { t, pal, ctx } = h;
    const g = ctx.createLinearGradient(0, 0, 1000, 1500);
    g.addColorStop(0, pal.accent); g.addColorStop(1, pal.text);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1500);
    h.circle(850, 250, 260, 'rgba(255,255,255,0.10)');
    h.circle(150, 1250, 320, 'rgba(255,255,255,0.08)');
    h.pill(t.kicker, 500, 260, { align: 'center', bg: 'rgba(255,255,255,0.18)', color: '#fff', size: 26 });
    h.text(t.headline, P, 380, 860, 560, { max: 140, color: '#fff', align: 'center', valign: 'middle' });
    h.text(t.subhead, 120, 960, 760, 140, { font: 'body', max: 38, color: 'rgba(255,255,255,0.88)', align: 'center' });
    if (t.cta) h.pill(t.cta, 500, 1160, { align: 'center', bg: '#fff', color: pal.text, size: 30 });
    h.footer(1420, { color: 'rgba(255,255,255,0.9)' });
  },
});

export const TEMPLATES = T;
export const CATEGORIES = ['All', ...new Set(T.map((t) => t.category))];
export const templateById = (id) => T.find((t) => t.id === id) || T[0];

export function newDesign(templateId = 'hero-overlay', brand = {}) {
  const tpl = templateById(templateId);
  const text = {};
  for (const [k, v] of Object.entries(tpl.defaults || {})) text[k] = Array.isArray(v) && (k === 'leftItems' || k === 'rightItems') ? v.join('\n') : v;
  text.website = brand.website || 'yourwebsite.com';
  return {
    templateId: tpl.id,
    text,
    images: [],
    paletteId: brand.paletteId || (tpl.id === 'hero-overlay' ? 'blush' : 'blush'),
    fontPairId: brand.fontPairId || 'modern',
    overlay: 0.35,
    textScale: 1,
    imageFocus: 0.5,
    imageZoom: 1,
    imageFilter: 'none',
    uppercase: false,
    showLogo: true,
  };
}

/** Switch template while keeping the user's text and images where possible. */
export function switchTemplate(design, templateId) {
  const tpl = templateById(templateId);
  const fresh = newDesign(templateId);
  const text = { ...fresh.text };
  for (const k of tpl.fields) {
    const v = design.text?.[k];
    if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) text[k] = v;
  }
  text.website = design.text?.website || fresh.text.website;
  return { ...design, templateId, text };
}
