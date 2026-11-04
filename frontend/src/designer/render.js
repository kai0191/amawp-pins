// Canvas rendering engine for 1000x1500 (2:3) Pinterest pins.
import { paletteById, fontPairById } from './styles.js';
import { templateById } from './templates.js';
import { loadImage } from '../lib/images.js';

export const W = 1000;
export const H = 1500;

const fontStr = (weight, size, family) => `${weight} ${Math.round(size)}px "${family}", system-ui, sans-serif`;

export function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function isDark(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width <= maxW) line = test;
      else { out.push(line); line = words[i]; }
    }
    out.push(line);
  }
  return out;
}

function makeHelpers(ctx, design, images) {
  const pal = { ...paletteById(design.paletteId), ...(design.paletteOverride || {}) };
  const pair = fontPairById(design.fontPairId);
  const fonts = {
    heading: design.headingFont ? { family: design.headingFont, weight: design.headingWeight || 700 } : pair.heading,
    body: pair.body,
  };
  const scale = design.textScale || 1;
  const t = design.text || {};
  const upper = !!design.uppercase;

  const h = {
    ctx, pal, fonts, t, design, W, H, dark: isDark(pal.bg),
    items: (t.items || []).filter((x) => String(x).trim()),
    img: (i) => images[i] || null,

    fill(color, x = 0, y = 0, w = W, hh = H) { ctx.fillStyle = color; ctx.fillRect(x, y, w, hh); },

    rect(x, y, w, hh, r, color, { shadow = false, stroke } = {}) {
      ctx.save();
      if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14; }
      roundRectPath(ctx, x, y, w, hh, r);
      if (color) { ctx.fillStyle = color; ctx.fill(); }
      if (stroke) { ctx.shadowColor = 'transparent'; ctx.lineWidth = stroke.width || 3; ctx.strokeStyle = stroke.color; ctx.stroke(); }
      ctx.restore();
    },

    circle(cx, cy, r, color) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); },

    /** Draw an image cover-cropped into a (rounded) box, or a tasteful placeholder. */
    cover(i, x, y, w, hh, r = 0, { shape } = {}) {
      const im = images[i];
      ctx.save();
      if (shape === 'circle') { ctx.beginPath(); ctx.arc(x + w / 2, y + hh / 2, Math.min(w, hh) / 2, 0, Math.PI * 2); ctx.closePath(); }
      else if (shape === 'arch') {
        ctx.beginPath(); ctx.moveTo(x, y + hh); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + hh); ctx.closePath();
      } else roundRectPath(ctx, x, y, w, hh, r);
      ctx.clip();
      if (im && im.width) {
        const fy = design.imageFocus ?? 0.5;
        const zoom = design.imageZoom || 1;
        const s = Math.max(w / im.width, hh / im.height) * zoom;
        const dw = im.width * s, dh = im.height * s;
        ctx.drawImage(im, x + (w - dw) / 2, y + (hh - dh) * fy, dw, dh);
        if (design.imageFilter === 'warm') { ctx.fillStyle = 'rgba(255,170,90,0.12)'; ctx.fillRect(x, y, w, hh); }
        if (design.imageFilter === 'cool') { ctx.fillStyle = 'rgba(80,140,255,0.10)'; ctx.fillRect(x, y, w, hh); }
        if (design.imageFilter === 'fade') { ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x, y, w, hh); }
      } else {
        const g = ctx.createLinearGradient(x, y, x + w, y + hh);
        g.addColorStop(0, pal.accent2);
        g.addColorStop(1, hexA(pal.accent, 0.55));
        ctx.fillStyle = g; ctx.fillRect(x, y, w, hh);
        // soft bokeh shapes so empty slots still look designed
        const seed = (i + 1) * 97;
        for (let k = 0; k < 7; k++) {
          const cx = x + ((seed * (k + 3) * 37) % 1000) / 1000 * w;
          const cy = y + ((seed * (k + 5) * 53) % 1000) / 1000 * hh;
          const rr = Math.min(w, hh) * (0.08 + ((seed * (k + 7)) % 100) / 600);
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.10 + (k % 3) * 0.05})`; ctx.fill();
        }
        if (design.showPlaceholderHint !== false && w > 220 && hh > 160) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = fontStr(600, Math.max(18, Math.min(30, w / 18)), fonts.body.family);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`Image ${i + 1}`, x + w / 2, y + hh / 2);
        }
      }
      ctx.restore();
    },

    gradient(y0, y1, color, a0, a1) {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, hexA(color, a0)); g.addColorStop(1, hexA(color, a1));
      ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
    },

    /**
     * Fit text into a box: finds the biggest size that fits, wraps, aligns. Returns the drawn block's bounds.
     * opts: {font:'heading'|'body', weight, max, min, lh, align, valign, color, upper, maxLines, letter}
     */
    text(str, x, y, w, hh, o = {}) {
      let s = String(str ?? '');
      if (!s.trim()) return { top: y, bottom: y, height: 0, size: 0 };
      const role = o.font === 'body' ? fonts.body : fonts.heading;
      const weight = o.weight || (o.font === 'body' ? fonts.body.weight : fonts.heading.weight);
      if ((o.upper ?? (o.font !== 'body' && upper))) s = s.toUpperCase();
      const lh = o.lh || (o.font === 'body' ? 1.35 : 1.08);
      let max = (o.max || 120) * (o.font === 'body' ? 1 : scale);
      const min = o.min || 16;
      let size = max, lines = [];
      let lo = min, hi = max;
      const fits = (sz) => {
        ctx.font = fontStr(weight, sz, role.family);
        const ls = wrapLines(ctx, s, w);
        const ok = ls.length * sz * lh <= hh && (!o.maxLines || ls.length <= o.maxLines) &&
          ls.every((l) => ctx.measureText(l).width <= w * 1.001);
        return [ok, ls];
      };
      let [ok, ls] = fits(hi);
      if (ok) { size = hi; lines = ls; } else {
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2;
          const [ok2, ls2] = fits(mid);
          if (ok2) { lo = mid; size = mid; lines = ls2; } else hi = mid;
        }
        if (!lines.length) { size = min; ctx.font = fontStr(weight, size, role.family); lines = wrapLines(ctx, s, w); }
      }
      ctx.font = fontStr(weight, size, role.family);
      ctx.fillStyle = o.color || pal.text;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = o.align || 'left';
      const blockH = lines.length * size * lh;
      let top = y;
      if (o.valign === 'middle') top = y + (hh - blockH) / 2;
      if (o.valign === 'bottom') top = y + hh - blockH;
      const ax = o.align === 'center' ? x + w / 2 : o.align === 'right' ? x + w : x;
      if (o.shadow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 3; }
      lines.forEach((l, i) => ctx.fillText(l, ax, top + size * (i * lh + 0.86 + (lh - 1) / 2)));
      if (o.shadow) ctx.restore();
      return { top, bottom: top + blockH, height: blockH, size, lines };
    },

    /** Pill / badge with auto width. */
    pill(str, x, y, o = {}) {
      if (!str) return { w: 0, h: 0 };
      const size = o.size || 26;
      const role = o.font === 'heading' ? fonts.heading : fonts.body;
      const s = o.upper === false ? String(str) : String(str).toUpperCase();
      ctx.font = fontStr(o.weight || role.bold || 700, size, role.family);
      if ('letterSpacing' in ctx) ctx.letterSpacing = o.letter ?? '2px';
      const tw = ctx.measureText(s).width;
      const padX = o.padX ?? size * 0.9, ph = size * 2;
      const pw = tw + padX * 2;
      const px = o.align === 'center' ? x - pw / 2 : o.align === 'right' ? x - pw : x;
      h.rect(px, y, pw, ph, o.radius ?? ph / 2, o.bg ?? pal.accent, { stroke: o.stroke });
      ctx.fillStyle = o.color || pal.accentText;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s, px + pw / 2, y + ph / 2 + 1);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      return { x: px, w: pw, h: ph };
    },

    /** Brand footer: logo + website. */
    footer(y, o = {}) {
      const color = o.color || pal.muted;
      const site = t.website || '';
      const logo = images.logo && design.showLogo !== false ? images.logo : null;
      const cx = o.align === 'left' ? (o.x ?? 70) : W / 2;
      ctx.font = fontStr(fonts.body.bold || 700, o.size || 28, fonts.body.family);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
      const tw = site ? ctx.measureText(site).width : 0;
      const lh = o.logoH || 54;
      const lw = logo ? (logo.width / logo.height) * lh : 0;
      const gap = logo && site ? 16 : 0;
      const total = lw + gap + tw;
      let x0 = o.align === 'left' ? cx : cx - total / 2;
      if (logo) { ctx.drawImage(logo, x0, y - lh / 2, lw, lh); x0 += lw + gap; }
      if (site) { ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(site, x0, y + 1); }
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    },

    check(x, y, size, color, fg) {
      h.rect(x, y, size, size, size * 0.28, color);
      ctx.strokeStyle = fg; ctx.lineWidth = size * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x + size * 0.26, y + size * 0.53); ctx.lineTo(x + size * 0.44, y + size * 0.7); ctx.lineTo(x + size * 0.76, y + size * 0.32); ctx.stroke();
    },

    numberBadge(n, cx, cy, r, bg, fg) {
      h.circle(cx, cy, r, bg);
      ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = fontStr(fonts.heading.weight, r * 1.05, fonts.heading.family);
      ctx.fillText(String(n), cx, cy + r * 0.06);
    },

    /** Evenly lay out N rows in a vertical span; calls fn(i, y, rowH). */
    rows(n, y0, y1, fn, gap = 0) {
      if (!n) return;
      const rh = (y1 - y0 - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) fn(i, y0 + i * (rh + gap), rh);
    },

    splitItem(s) {
      const m = String(s).split(/\s*(?:[:|—–]| - )\s*/);
      return m.length > 1 ? [m[0], m.slice(1).join(' ')] : [String(s), ''];
    },
  };
  return h;
}

const fontLoads = new Map();
export async function ensureFonts(design) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const pair = fontPairById(design.fontPairId);
  const specs = [
    `${pair.heading.weight} 40px "${pair.heading.family}"`,
    `${pair.body.weight} 40px "${pair.body.family}"`,
    `${pair.body.bold || 700} 40px "${pair.body.family}"`,
  ];
  await Promise.all(specs.map((s) => {
    if (!fontLoads.has(s)) fontLoads.set(s, document.fonts.load(s).catch(() => null));
    return fontLoads.get(s);
  }));
}

export async function loadDesignImages(design, logo) {
  const tpl = templateById(design.templateId);
  const n = Math.max(tpl.imageSlots || 0, (design.images || []).length);
  const arr = await Promise.all(Array.from({ length: n }, (_, i) => {
    const src = design.images?.[i];
    return src ? loadImage(src).catch(() => null) : null;
  }));
  if (logo) arr.logo = await loadImage(logo).catch(() => null);
  return arr;
}

/** Synchronous draw (fonts/images already loaded). */
export function drawDesign(canvas, design, images) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const tpl = templateById(design.templateId);
  const h = makeHelpers(ctx, design, images || []);
  h.fill(h.pal.bg);
  tpl.draw(h);
  ctx.restore();
  return canvas;
}

export async function renderDesign(canvas, design, { logo } = {}) {
  await ensureFonts(design);
  const images = await loadDesignImages(design, logo);
  return drawDesign(canvas, design, images);
}

export function canvasToBlob(canvas, type = 'image/png', q = 0.92) {
  return new Promise((res) => canvas.toBlob(res, type, q));
}

export function thumbnailDataUrl(canvas, w = 200) {
  const c = document.createElement('canvas');
  c.width = w; c.height = Math.round((w * H) / W);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}

export function jpegBase64(canvas, q = 0.9) {
  return canvas.toDataURL('image/jpeg', q).split(',')[1];
}
