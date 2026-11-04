// Template catalogue (metadata only) so AI assistants (via MCP) can design pins with Tackly templates.
// The drawing code lives in frontend/src/designer/templates.js; a test keeps both lists in sync.
export const TEMPLATE_META = [
  { id: 'hero-overlay', name: 'Photo + Headline', imageSlots: 1, fields: ['kicker', 'headline', 'subhead'] },
  { id: 'split-band', name: 'Blog Classic', imageSlots: 1, fields: ['kicker', 'headline', 'subhead'] },
  { id: 'framed-card', name: 'Center Card', imageSlots: 1, fields: ['kicker', 'headline', 'subhead', 'cta'] },
  { id: 'checklist', name: 'Checklist', imageSlots: 1, fields: ['kicker', 'headline', 'items'] },
  { id: 'numbered-steps', name: 'Numbered Steps', imageSlots: 0, fields: ['kicker', 'headline', 'items'] },
  { id: 'before-after', name: 'Before & After', imageSlots: 2, fields: ['headline', 'leftLabel', 'rightLabel'] },
  { id: 'versus', name: 'This vs That', imageSlots: 2, fields: ['headline', 'leftLabel', 'leftItems', 'rightLabel', 'rightItems'] },
  { id: 'top-three', name: 'Top 3', imageSlots: 3, fields: ['kicker', 'headline', 'items'] },
  { id: 'cheat-sheet', name: 'Cheat Sheet', imageSlots: 0, fields: ['kicker', 'headline', 'items'] },
  { id: 'collage-2', name: 'Collage · 2 photos', imageSlots: 2, fields: ['kicker', 'headline'] },
  { id: 'collage-3', name: 'Collage · 3 photos', imageSlots: 3, fields: ['headline', 'subhead'] },
  { id: 'collage-4', name: 'Collage · 4 photos', imageSlots: 4, fields: ['kicker', 'headline'] },
  { id: 'quote', name: 'Quote', imageSlots: 1, fields: ['headline', 'author'] },
  { id: 'big-stat', name: 'Big Number', imageSlots: 1, fields: ['kicker', 'number', 'label', 'body'] },
  { id: 'product-spotlight', name: 'Product Spotlight', imageSlots: 1, fields: ['kicker', 'headline', 'price', 'items', 'cta'] },
  { id: 'recipe', name: 'Recipe Card', imageSlots: 1, fields: ['headline', 'meta1', 'meta2', 'meta3', 'items'] },
  { id: 'infographic', name: 'Infographic', imageSlots: 0, fields: ['kicker', 'headline', 'items'] },
  { id: 'listicle-number', name: 'Big Listicle', imageSlots: 1, fields: ['number', 'headline', 'cta'] },
  { id: 'magazine', name: 'Magazine Cover', imageSlots: 1, fields: ['brandName', 'kicker', 'headline', 'items'] },
  { id: 'editorial-arch', name: 'Editorial Arch', imageSlots: 1, fields: ['kicker', 'headline', 'subhead'] },
  { id: 'gradient-poster', name: 'Gradient Poster', imageSlots: 0, fields: ['kicker', 'headline', 'subhead', 'cta'] },
];

export const PALETTE_IDS = ['blush', 'sage', 'midnight', 'terracotta', 'ocean', 'lavender', 'lemon', 'mono', 'forest', 'peach', 'berry', 'ink'];
export const FONT_PAIR_IDS = ['modern', 'editorial', 'bold', 'elegant', 'friendly', 'classic', 'impact', 'handmade', 'retro', 'grotesk', 'fraunces'];
