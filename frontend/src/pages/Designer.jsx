import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon, Spinner } from '../components.jsx';
import { api } from '../lib/api.js';
import { toast, pref, setPref, navigate } from '../lib/store.js';
import { brandKit } from '../lib/data.js';
import { TEMPLATES, CATEGORIES, FIELD_LABELS, templateById, newDesign, switchTemplate } from '../designer/templates.js';
import { PALETTES, FONT_PAIRS } from '../designer/styles.js';
import { renderDesign, drawDesign, ensureFonts, canvasToBlob, thumbnailDataUrl, jpegBase64 } from '../designer/render.js';
import { PublishDialog } from './PublishDialog.jsx';
import { ImagePicker } from './ImagePicker.jsx';

const MULTILINE = new Set(['items', 'leftItems', 'rightItems', 'body']);

export function applyBrand(design, brand) {
  if (!brand) return design;
  const d = { ...design, text: { ...design.text } };
  if (brand.website) d.text.website = brand.website;
  if (brand.paletteId) d.paletteId = brand.paletteId;
  if (brand.fontPairId) d.fontPairId = brand.fontPairId;
  if (brand.accent) d.paletteOverride = { ...(d.paletteOverride || {}), accent: brand.accent };
  return d;
}

function TemplateThumb({ tpl, design, active, onClick }) {
  const ref = useRef();
  useEffect(() => {
    const d = { ...switchTemplate(design, tpl.id), images: [], showPlaceholderHint: false };
    renderDesign(ref.current, d);
  }, [tpl.id, design.paletteId, design.fontPairId, JSON.stringify(design.paletteOverride || {})]);
  return (
    <button type="button" class={`tpl ${active ? 'active' : ''}`} onClick={onClick} aria-label={`Template: ${tpl.name}`} data-template={tpl.id}>
      <canvas ref={ref} width="1000" height="1500" />
      <span class="tname">{tpl.name}</span>
    </button>
  );
}

export function Designer({ query }) {
  const brand = brandKit();
  const [design, setDesign] = useState(() => {
    const saved = pref('designDraft', null);
    if (query?.template) return applyBrand(newDesign(query.template, brand), brand);
    return saved && saved.templateId ? saved : applyBrand(newDesign('hero-overlay', brand), brand);
  });
  const [cat, setCat] = useState('All');
  const [tab, setTab] = useState('text');
  const [slot, setSlot] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [aiBusy, setAiBusy] = useState('');
  const [ideas, setIdeas] = useState([]);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef();
  const tpl = templateById(design.templateId);

  // persist + render (debounced)
  useEffect(() => {
    setPref('designDraft', { ...design, images: design.images.map((x) => (x && x.startsWith('data:') && x.length > 900000 ? null : x)) });
    let cancelled = false;
    setRendering(true);
    const t = setTimeout(async () => {
      try { await renderDesign(canvasRef.current, design, { logo: brand.logo }); } catch (e) { console.error(e); }
      if (!cancelled) setRendering(false);
    }, 60);
    return () => { cancelled = true; clearTimeout(t); };
  }, [design, brand.logo]);

  // Re-draw once web fonts finish loading the first time
  useEffect(() => { ensureFonts(design).then(() => setDesign((d) => ({ ...d }))); }, [design.fontPairId]);

  const set = (patch) => setDesign((d) => ({ ...d, ...patch }));
  const setText = (k, v) => setDesign((d) => ({ ...d, text: { ...d.text, [k]: v } }));
  const setImage = (i, src) => setDesign((d) => { const images = [...d.images]; images[i] = src; return { ...d, images }; });

  const list = useMemo(() => TEMPLATES.filter((t) => cat === 'All' || t.category === cat), [cat]);

  function chooseTemplate(t) {
    setDesign((d) => switchTemplate(d, t.id));
    setSlot(0);
  }

  async function download() {
    await renderDesign(canvasRef.current, design, { logo: brand.logo });
    try {
      const blob = await canvasToBlob(canvasRef.current, 'image/png');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(design.text.headline || 'pin').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) || 'pin'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('PNG downloaded (1000 × 1500)', 'ok');
    } catch {
      toast('This image blocks downloads (no CORS). Upload it or pick another image.', 'error', 6000);
    }
  }

  async function headlineIdeas() {
    setAiBusy('headline');
    try {
      const r = await api.aiText('headlines', { topic: design.text.headline || design.text.kicker || 'Pinterest tips', count: 6 });
      const arr = Array.isArray(r.data) ? r.data : String(r.text).split('\n').map((x) => x.replace(/^[\d\-.)\s"]+|"$/g, '')).filter(Boolean);
      setIdeas(arr.slice(0, 6));
    } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(''); }
  }
  async function listIdeas(field) {
    setAiBusy(field);
    try {
      const r = await api.aiText('list_items', { topic: design.text.headline, count: field === 'items' ? Math.max(3, (design.text.items || []).length || 5) : 3 });
      const arr = Array.isArray(r.data) ? r.data.map(String) : String(r.text).split('\n').filter(Boolean);
      if (field === 'items') setText('items', arr.slice(0, 8)); else setText(field, arr.slice(0, 4).join('\n'));
    } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(''); }
  }

  async function getImage() {
    await renderDesign(canvasRef.current, design, { logo: brand.logo });
    try {
      return { image: jpegBase64(canvasRef.current, 0.9), thumb: thumbnailDataUrl(canvasRef.current) };
    } catch {
      throw new Error('One of the images blocks export (no CORS). Upload it from your device instead.');
    }
  }

  const textFields = tpl.fields;
  return (
    <div class="designer">
      {/* Templates */}
      <section class="panel" aria-label="Templates">
        <div class="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Templates</h3>
          <span class="faint tiny">{TEMPLATES.length}</span>
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ marginBottom: 12 }} aria-label="Template category">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div class="tpl-grid">
          {list.map((t) => (
            <TemplateThumb key={t.id} tpl={t} design={design} active={t.id === design.templateId}
              onClick={() => chooseTemplate(t)} />
          ))}
        </div>
      </section>

      {/* Stage */}
      <section class="stage" aria-label="Preview">
        <div class="stage-canvas"><canvas ref={canvasRef} width="1000" height="1500" data-testid="pin-canvas" /></div>
        <div class="row" style={{ justifyContent: 'center' }}>
          <span class="chip">{tpl.name}{rendering ? ' · rendering…' : ''}</span>
        </div>
        <div class="row" style={{ justifyContent: 'center' }}>
          <button class="btn ghost" onClick={download}><Icon name="download" size={16} /> Download PNG</button>
          <button class="btn primary" onClick={() => setPublishing(true)}><Icon name="clock" size={16} /> Save & schedule</button>
        </div>
        <div class="row" style={{ justifyContent: 'center' }}>
          <button class="link-btn small" onClick={() => { setDesign(applyBrand(newDesign(design.templateId, brand), brand)); toast('Reset to template defaults'); }}>Reset design</button>
          <span class="faint">·</span>
          <button class="link-btn small" onClick={() => navigate('/app/bulk')}>Make many pins from this template</button>
        </div>
      </section>

      {/* Controls */}
      <section class="panel" aria-label="Customise">
        <div class="tabs" role="tablist">
          {[['text', 'Text'], ['images', 'Images'], ['style', 'Style'], ['brand', 'Brand']].map(([k, l]) => (
            <button key={k} type="button" class={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'text' && (
          <div class="stack">
            {textFields.map((k) => (
              <label class="field" key={k}>
                <span class="row between">{FIELD_LABELS[k] || k}
                  {k === 'headline' && <button type="button" class="link-btn tiny" disabled={!!aiBusy} onClick={headlineIdeas}>{aiBusy === 'headline' ? <Spinner /> : '✨ AI ideas'}</button>}
                  {(k === 'items' || k === 'leftItems' || k === 'rightItems') && <button type="button" class="link-btn tiny" disabled={!!aiBusy} onClick={() => listIdeas(k)}>{aiBusy === k ? <Spinner /> : '✨ AI write'}</button>}
                </span>
                {MULTILINE.has(k) ? (
                  <textarea rows={k === 'body' ? 3 : 5} value={Array.isArray(design.text[k]) ? design.text[k].join('\n') : design.text[k] || ''}
                    onInput={(e) => setText(k, k === 'items' ? e.target.value.split('\n') : e.target.value)} />
                ) : (
                  <input type="text" value={design.text[k] || ''} onInput={(e) => setText(k, e.target.value)} />
                )}
                {k === 'headline' && ideas.length > 0 && (
                  <div class="stack" style={{ gap: 6, marginTop: 6 }}>
                    {ideas.map((x) => <button key={x} type="button" class="btn sm ghost" style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => { setText('headline', x); setIdeas([]); }}>{x}</button>)}
                  </div>
                )}
              </label>
            ))}
            <label class="field">Website / handle
              <input type="text" value={design.text.website || ''} onInput={(e) => setText('website', e.target.value)} />
            </label>
            <label class="field">Text size <span class="faint tiny">{Math.round((design.textScale || 1) * 100)}%</span>
              <input type="range" min="0.6" max="1.3" step="0.05" value={design.textScale || 1} onInput={(e) => set({ textScale: +e.target.value })} />
            </label>
            <label class="check"><input type="checkbox" checked={!!design.uppercase} onChange={(e) => set({ uppercase: e.target.checked })} /> UPPERCASE headlines</label>
          </div>
        )}

        {tab === 'images' && (
          <div class="stack">
            {tpl.imageSlots > 0 ? (
              <>
                <div class="img-slots">
                  {Array.from({ length: tpl.imageSlots }, (_, i) => (
                    <button key={i} type="button" class={`img-slot ${slot === i ? 'active' : ''}`} onClick={() => setSlot(i)}
                      style={design.images[i] ? { backgroundImage: `url("${design.images[i]}")` } : {}} aria-label={`Image slot ${i + 1}`}>
                      {!design.images[i] && `Image ${i + 1}`}
                    </button>
                  ))}
                </div>
                <div class="row between small"><span class="muted">Editing image {slot + 1}</span>
                  {design.images[slot] && <button class="link-btn small" onClick={() => setImage(slot, null)}>Remove</button>}
                </div>
                <ImagePicker topic={design.text.headline} onPick={(src) => { setImage(slot, src); if (slot < tpl.imageSlots - 1 && !design.images[slot + 1]) setSlot(slot + 1); }} />
                <div class="divider" />
                <label class="field">Image position (vertical)<input type="range" min="0" max="1" step="0.02" value={design.imageFocus ?? 0.5} onInput={(e) => set({ imageFocus: +e.target.value })} /></label>
                <label class="field">Zoom<input type="range" min="1" max="2" step="0.02" value={design.imageZoom || 1} onInput={(e) => set({ imageZoom: +e.target.value })} /></label>
                <label class="field">Overlay darkness<input type="range" min="0" max="0.8" step="0.02" value={design.overlay ?? 0.35} onInput={(e) => set({ overlay: +e.target.value })} /></label>
                <label class="field">Photo filter
                  <select value={design.imageFilter || 'none'} onChange={(e) => set({ imageFilter: e.target.value })}>
                    <option value="none">None</option><option value="warm">Warm</option><option value="cool">Cool</option><option value="fade">Soft fade</option>
                  </select>
                </label>
              </>
            ) : <div class="empty"><div class="ico">🖼️</div>This template is text-only. Pick a photo template to add images.</div>}
          </div>
        )}

        {tab === 'style' && (
          <div class="stack">
            <div class="field">Colour palette</div>
            <div class="swatches">
              {PALETTES.map((p) => (
                <button key={p.id} type="button" title={p.name} aria-label={`Palette ${p.name}`} class={`swatch ${design.paletteId === p.id ? 'active' : ''}`}
                  onClick={() => set({ paletteId: p.id, paletteOverride: null })}>
                  <span style={{ background: p.bg }} /><span style={{ background: p.accent }} />
                </button>
              ))}
            </div>
            <div class="grid-2">
              <label class="field">Accent colour<input type="color" value={design.paletteOverride?.accent || PALETTES.find((p) => p.id === design.paletteId)?.accent || '#e4505b'}
                onInput={(e) => set({ paletteOverride: { ...(design.paletteOverride || {}), accent: e.target.value } })} style={{ height: 42, padding: 4 }} /></label>
              <label class="field">Background<input type="color" value={design.paletteOverride?.bg || PALETTES.find((p) => p.id === design.paletteId)?.bg || '#ffffff'}
                onInput={(e) => set({ paletteOverride: { ...(design.paletteOverride || {}), bg: e.target.value } })} style={{ height: 42, padding: 4 }} /></label>
            </div>
            <div class="field">Font pairing</div>
            <div class="font-list">
              {FONT_PAIRS.map((f) => (
                <button key={f.id} type="button" class={`font-opt ${design.fontPairId === f.id ? 'active' : ''}`} onClick={() => set({ fontPairId: f.id })}>
                  <b style={{ fontFamily: `"${f.heading.family}"`, fontWeight: f.heading.weight }}>Aa {f.name}</b>
                  <span>{f.heading.family} + {f.body.family}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'brand' && (
          <div class="stack">
            {brand.logo ? <img src={brand.logo} alt="Your logo" style={{ maxHeight: 60, width: 'auto' }} /> : <p class="muted small">No logo yet.</p>}
            <label class="check"><input type="checkbox" checked={design.showLogo !== false} onChange={(e) => set({ showLogo: e.target.checked })} /> Show my logo on the pin</label>
            <button class="btn" onClick={() => { setDesign((d) => applyBrand(d, brand)); toast('Brand kit applied'); }}>Apply my brand kit</button>
            <a class="btn ghost" href="#/app/settings">Edit brand kit</a>
            <p class="tiny faint">Your brand kit (logo, website, colours, fonts) is saved to your account and applied to new pins and bulk batches.</p>
          </div>
        )}
      </section>

      {publishing && <PublishDialog templateId={design.templateId} getImage={getImage}
        defaults={{ title: design.text.headline, headline: design.text.headline, topic: [design.text.kicker, design.text.headline].filter(Boolean).join(' – ') }}
        onClose={() => setPublishing(false)} />}
    </div>
  );
}

export { drawDesign };
