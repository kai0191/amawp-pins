// Curated palettes and Google Font pairings for pin designs.
export const PALETTES = [
  { id: 'blush', name: 'Blush', bg: '#FFF4F1', surface: '#FFFFFF', text: '#2B1B17', muted: '#7A5C55', accent: '#E4505B', accent2: '#F7B9A8', accentText: '#FFFFFF' },
  { id: 'sage', name: 'Sage', bg: '#EFF3EB', surface: '#FFFFFF', text: '#1F2A1F', muted: '#5E6B5A', accent: '#4F7A55', accent2: '#C9D8C0', accentText: '#FFFFFF' },
  { id: 'midnight', name: 'Midnight', bg: '#0F172A', surface: '#1E293B', text: '#F8FAFC', muted: '#A5B4CB', accent: '#FBBF24', accent2: '#334155', accentText: '#0F172A' },
  { id: 'terracotta', name: 'Terracotta', bg: '#FBF0E7', surface: '#FFFFFF', text: '#3B2418', muted: '#866451', accent: '#C8553D', accent2: '#F0C9A9', accentText: '#FFFFFF' },
  { id: 'ocean', name: 'Ocean', bg: '#E9F3F7', surface: '#FFFFFF', text: '#0B2B3C', muted: '#4D6B7B', accent: '#1479A8', accent2: '#A9D6EA', accentText: '#FFFFFF' },
  { id: 'lavender', name: 'Lavender', bg: '#F4F0FB', surface: '#FFFFFF', text: '#2A1F3D', muted: '#6E6185', accent: '#7C5CC4', accent2: '#D8CCF2', accentText: '#FFFFFF' },
  { id: 'lemon', name: 'Lemon', bg: '#FFF9E3', surface: '#FFFFFF', text: '#2B2610', muted: '#6F6740', accent: '#F2C200', accent2: '#FFE98A', accentText: '#2B2610' },
  { id: 'mono', name: 'Mono', bg: '#FFFFFF', surface: '#F4F4F4', text: '#111111', muted: '#5C5C5C', accent: '#111111', accent2: '#E5E5E5', accentText: '#FFFFFF' },
  { id: 'forest', name: 'Forest', bg: '#10231B', surface: '#1A3329', text: '#F2EFE6', muted: '#B5C2B4', accent: '#D9B26F', accent2: '#2C4A3D', accentText: '#10231B' },
  { id: 'peach', name: 'Peach', bg: '#FFE9DF', surface: '#FFFFFF', text: '#4A2C21', muted: '#8A6153', accent: '#FF6F4D', accent2: '#FFC7B2', accentText: '#FFFFFF' },
  { id: 'berry', name: 'Berry', bg: '#2D0F24', surface: '#431935', text: '#FFE8F3', muted: '#E3AFC9', accent: '#FF4D8D', accent2: '#5E2149', accentText: '#FFFFFF' },
  { id: 'ink', name: 'Cream & Ink', bg: '#F6F1E7', surface: '#FFFFFF', text: '#1D1B16', muted: '#6B655A', accent: '#2F4B7C', accent2: '#D8CFBD', accentText: '#FFFFFF' },
];

export const FONT_PAIRS = [
  { id: 'modern', name: 'Modern', heading: { family: 'Montserrat', weight: 800 }, body: { family: 'Inter', weight: 400, bold: 700 } },
  { id: 'editorial', name: 'Editorial', heading: { family: 'Playfair Display', weight: 700 }, body: { family: 'Lato', weight: 400, bold: 700 } },
  { id: 'bold', name: 'Bold', heading: { family: 'Anton', weight: 400 }, body: { family: 'Inter', weight: 400, bold: 700 } },
  { id: 'elegant', name: 'Elegant', heading: { family: 'DM Serif Display', weight: 400 }, body: { family: 'DM Sans', weight: 400, bold: 700 } },
  { id: 'friendly', name: 'Friendly', heading: { family: 'Poppins', weight: 700 }, body: { family: 'Poppins', weight: 400, bold: 600 } },
  { id: 'classic', name: 'Classic', heading: { family: 'Libre Baskerville', weight: 700 }, body: { family: 'Source Sans 3', weight: 400, bold: 700 } },
  { id: 'impact', name: 'Impact', heading: { family: 'Bebas Neue', weight: 400 }, body: { family: 'Montserrat', weight: 400, bold: 700 } },
  { id: 'handmade', name: 'Handmade', heading: { family: 'Caveat', weight: 700 }, body: { family: 'Nunito', weight: 400, bold: 800 } },
  { id: 'retro', name: 'Retro', heading: { family: 'Abril Fatface', weight: 400 }, body: { family: 'Work Sans', weight: 400, bold: 600 } },
  { id: 'grotesk', name: 'Grotesk', heading: { family: 'Space Grotesk', weight: 700 }, body: { family: 'Space Grotesk', weight: 400, bold: 600 } },
  { id: 'fraunces', name: 'Soft serif', heading: { family: 'Fraunces', weight: 800 }, body: { family: 'Inter', weight: 400, bold: 600 } },
];

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  [
    'Inter:wght@400;500;600;700;800',
    'Montserrat:wght@400;600;700;800;900',
    'Playfair+Display:wght@600;700;800',
    'Lato:wght@400;700',
    'Anton',
    'DM+Serif+Display',
    'DM+Sans:wght@400;500;700',
    'Poppins:wght@400;600;700;800',
    'Libre+Baskerville:wght@400;700',
    'Source+Sans+3:wght@400;600;700',
    'Bebas+Neue',
    'Caveat:wght@600;700',
    'Nunito:wght@400;700;800',
    'Abril+Fatface',
    'Work+Sans:wght@400;600;700',
    'Space+Grotesk:wght@400;600;700',
    'Fraunces:wght@600;800',
  ].map((f) => `family=${f}`).join('&') + '&display=swap';

export const paletteById = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];
export const fontPairById = (id) => FONT_PAIRS.find((f) => f.id === id) || FONT_PAIRS[0];
