import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon, Spinner } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, toast, navigate, pref, setPref, userTz } from '../lib/store.js';
import { fileToDataUrl, loadImage } from '../lib/images.js';
import { unzipImages, titleFromFilename } from '../lib/unzip.js';
import { brandKit, refreshMe } from '../lib/data.js';
import { TEMPLATES, newDesign, templateById } from '../designer/templates.js';
import { PALETTES, FONT_PAIRS } from '../designer/styles.js';
import { renderDesign, thumbnailDataUrl, jpegBase64 } from '../designer/render.js';
import { pollinationsImageUrl } from '../../../shared/prompts.js';
import { applyBrand } from './Designer.jsx';
import { AccountBoardPicker } from './PublishDialog.jsx';
import { AutoScheduleForm } from './Schedule.jsx';

/** Minimal CSV parser (quotes, commas, newlines). */
export function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export function parseBulkInput(text) {
  const t = text.trim();
  if (!t) return [];
  const firstLine = t.split('\n')[0].toLowerCase();
  if (firstLine.includes(',') && /title|headline/.test(firstLine)) {
    const [head, ...rest] = parseCsv(t);
    const idx = (names) => head.findIndex((h) => names.includes(h.trim().toLowerCase()));
    const ci = { title: idx(['title', 'headline']), link: idx(['url', 'link']), image: idx(['image', 'image_url', 'imageurl', 'photo']), description: idx(['description', 'desc']), kicker: idx(['kicker', 'label', 'category']), subhead: idx(['subhead', 'subtitle']) };
    return rest.map((r) => Object.fromEntries(Object.entries(ci).map(([k, i]) => [k, i >= 0 ? (r[i] || '').trim() : ''])));
  }
  return t.split('\n').map((line) => {
    const parts = line.split('|').map((x) => x.trim());
    const out = { title: '', link: '', image: '' };
    for (const p of parts) {
      if (/^https?:\/\/.+\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(p)) out.image = p;
      else if (/^https?:\/\//i.test(p)) out.link = p;
      else if (!out.title) out.title = p;
      else out.subhead = p;
    }
    if (!out.title && out.link) {
      try { out.title = decodeURIComponent(new URL(out.link).pathname.split('/').filter(Boolean).pop() || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); } catch { /* ignore */ }
    }
    return out;
  }).filter((r) => r.title || r.link);
}

const BULK_TEMPLATES = ['split-band', 'hero-overlay', 'framed-card', 'listicle-number', 'collage-2', 'collage-3', 'collage-4', 'quote', 'big-stat'];

const link0 = (u) => /^https?:\/\//.test(u || '');

const SAMPLE = `How to Start a Balcony Garden | https://example.com/balcony-garden
15 Easy Weeknight Dinners | https://example.com/weeknight-dinners
Minimalist Packing List for Europe | https://example.com/packing-list
DIY Wall Art Under $20 | https://example.com/diy-wall-art`;

function Preview({ design, logo, onCanvas }) {
  const ref = useRef();
  useEffect(() => { renderDesign(ref.current, design, { logo }).then(() => onCanvas && onCanvas(ref.current)); }, [JSON.stringify(design)]);
  return <canvas ref={ref} width="1000" height="1500" />;
}

async function toJpeg(src, maxH = 1500) {
  const img = await loadImage(src);
  const sc = Math.min(1, maxH / img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { image: c.toDataURL('image/jpeg', 0.9).split(',')[1], thumb: thumbnailDataUrl(c), ratio: img.width / img.height };
}

export function Bulk({ query = {} }) {
  const s = useStore();
  const brand = brandKit();
  const tz = userTz();
  const [mode, setMode] = useState(query.mode === 'upload' ? 'upload' : 'list');
  const [uploads, setUploads] = useState([]);
  const [uploadLines, setUploadLines] = useState('');
  const [commonLink, setCommonLink] = useState(pref('lastLink', ''));
  // Bulk works with headline-driven templates (list templates need per-pin list items, so use the designer for those).
  const freeTemplates = TEMPLATES.filter((t) => t.tier === 'free' && BULK_TEMPLATES.includes(t.id));
  const [input, setInput] = useState(() => { const v = pref('bulkInput', ''); if (v) setPref('bulkInput', ''); return v; });
  const [tplIds, setTplIds] = useState(['split-band']);
  const [rotatePalettes, setRotatePalettes] = useState(true);
  const [paletteId, setPaletteId] = useState(brand.paletteId || 'blush');
  const [fontPairId, setFontPairId] = useState(brand.fontPairId || 'modern');
  const [imageMode, setImageMode] = useState('ai');
  const [designs, setDesigns] = useState([]);
  const [rows, setRows] = useState([]);
  const canvases = useRef([]);
  const [accountId, setAccountId] = useState(null);
  const [boardId, setBoardId] = useState(null);
  const [boardName, setBoardName] = useState('');
  const [aiCopy, setAiCopy] = useState(true);
  const [progress, setProgress] = useState(null);
  const [saved, setSaved] = useState(null);
  const max = 300;

  async function generate() {
    const parsed = parseBulkInput(input).slice(0, max);
    if (!parsed.length) { toast('Paste at least one line (title | link) or a CSV.', 'error'); return; }
    if (imageMode === 'post') {
      if (!api.relay) { toast('Reading posts needs the Tackly server. Pick another image option.', 'error'); return; }
      setProgress({ i: 0, n: parsed.length, label: 'Finding images in your posts' });
      for (let i = 0; i < parsed.length; i++) {
        setProgress({ i: i + 1, n: parsed.length, label: 'Finding images in your posts' });
        if (parsed[i].image || !parsed[i].link) continue;
        try { const info = await api.relay.pageInfo(parsed[i].link); parsed[i].postImages = info.images || []; } catch { parsed[i].postImages = []; }
      }
      setProgress(null);
    }
    const draftImages = pref('designDraft', {})?.images || [];
    const palettes = rotatePalettes ? PALETTES.map((p) => p.id) : [paletteId];
    const out = parsed.map((r, i) => {
      const tid = tplIds[i % tplIds.length];
      const tpl = templateById(tid);
      let d = applyBrand(newDesign(tid, brand), brand);
      d = { ...d, fontPairId, paletteId: palettes[(palettes.indexOf(paletteId) + i) % palettes.length] };
      // Never carry template sample copy into real pins.
      const num = (r.title.match(/^\s*(\d{1,3})\b/) || [])[1];
      d.text = {
        ...d.text, kicker: r.kicker || '', subhead: r.subhead || '', body: r.description ? r.description.slice(0, 140) : '', cta: '', author: '',
        headline: tid === 'listicle-number' && num ? r.title.replace(/^\s*\d{1,3}\s*/, '') : r.title,
        number: num || d.text.number, label: tid === 'big-stat' ? r.title : d.text.label,
      };
      if (tid === 'big-stat') { d.text.headline = r.title; d.text.number = num || '#1'; }
      const imgs = [];
      for (let k = 0; k < tpl.imageSlots; k++) {
        if (r.image && k === 0) imgs.push(r.image);
        else if (imageMode === 'post' && r.postImages?.length) imgs.push(r.postImages[k % r.postImages.length]);
        else if (imageMode === 'ai' || imageMode === 'post') imgs.push(pollinationsImageUrl(`${r.title}, beautiful pinterest photo, natural light, no text`, { width: 800, height: 1200, seed: 1000 + i * 7 + k }));
        else if (imageMode === 'same') imgs.push(draftImages[k] || null);
        else imgs.push(null);
      }
      d.images = imgs;
      return d;
    });
    canvases.current = [];
    setRows(parsed);
    setDesigns(out);
    setSaved(null);
    toast(`${out.length} pins generated. Review them, then save or auto-schedule.`, 'ok');
  }

  async function saveAll(schedule) {
    if (!designs.length) return;
    if (schedule && (!accountId || !boardId) && !(schedule.boardIds?.length)) { toast('Choose an account and board first.', 'error'); return; }
    const ids = [];
    const batchId = `b_${Date.now().toString(36)}`;
    try {
      for (let i = 0; i < designs.length; i++) {
        setProgress({ i: i + 1, n: designs.length, label: 'Rendering & saving' });
        const c = canvases.current[i] || document.createElement('canvas');
        await renderDesign(c, designs[i], { logo: brand.logo });
        let title = rows[i].title, description = rows[i].description || '', alt = '';
        if (aiCopy) {
          try {
            setProgress({ i: i + 1, n: designs.length, label: 'Writing copy with AI' });
            const r = await api.aiText('pin_copy', { topic: rows[i].title, headline: rows[i].title, link: rows[i].link, board: boardName, keywords: rows[i].keyword || rows[i].title.toLowerCase() });
            if (r.data) { title = r.data.title || title; description = r.data.description || description; alt = r.data.alt_text || ''; }
          } catch { /* keep plain copy */ }
        }
        let image;
        try { image = jpegBase64(c, 0.88); } catch { throw new Error(`Pin ${i + 1}: an image blocks export. Use “AI images” or upload images instead.`); }
        const pin = await api.createPin({
          image, thumb: thumbnailDataUrl(c), title: String(title).slice(0, 100), description: String(description).slice(0, 800), link: rows[i].link,
          altText: alt, templateId: designs[i].templateId, batchId, accountId, boardId, boardName, status: 'draft', keyword: rows[i].keyword || rows[i].title.toLowerCase(),
        });
        ids.push(pin.id);
      }
      if (schedule) {
        setProgress({ i: designs.length, n: designs.length, label: 'Auto-scheduling' });
        const r = await api.autoSchedule({ ...schedule, pinIds: ids, accountId });
        toast(`${r.scheduled} pins auto-scheduled ✓`, 'ok');
      } else {
        toast(`${ids.length} pins saved to drafts ✓`, 'ok');
      }
      setSaved(ids.length);
      refreshMe().catch(() => {});
    } catch (e) {
      toast(`${e.message} (${ids.length} saved before the error)`, 'error', 8000);
    } finally { setProgress(null); }
  }

  async function addFiles(files) {
    const list = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
        try { list.push(...(await unzipImages(f))); } catch (e) { toast(e.message, 'error'); }
      } else if (f.type.startsWith('image/')) list.push(f);
    }
    const items = [];
    for (const f of list.slice(0, max - uploads.length)) items.push({ name: f.name, title: titleFromFilename(f.name), src: await fileToDataUrl(f, 1600) });
    setUploads((u) => [...u, ...items]);
    if (items.length) toast(`${items.length} design${items.length > 1 ? 's' : ''} added`, 'ok');
  }

  async function saveUploads(schedule) {
    if (!uploads.length) return;
    if (schedule && !accountId) { toast('Connect Pinterest and choose a board first.', 'error'); return; }
    const lines = parseBulkInput(uploadLines);
    const ids = [];
    const batchId = `b_${Date.now().toString(36)}`;
    try {
      for (let i = 0; i < uploads.length; i++) {
        const u = uploads[i];
        const line = lines[i] || {};
        const title0 = line.title || u.title;
        const link = line.link || commonLink;
        setProgress({ i: i + 1, n: uploads.length, label: 'Preparing your designs' });
        const { image, thumb, ratio } = await toJpeg(u.src);
        if (i === 0 && Math.abs(ratio - 2 / 3) > 0.08) toast('Tip: Pinterest works best with 2:3 images (1000 × 1500).', 'info', 6000);
        let title = title0, description = '', alt = '';
        if (aiCopy) {
          try {
            setProgress({ i: i + 1, n: uploads.length, label: 'Writing SEO copy with AI' });
            const r = await api.aiText('pin_copy', { topic: title0, headline: title0, link, board: boardName, keywords: title0.toLowerCase() });
            if (r.data) { title = r.data.title || title; description = r.data.description || ''; alt = r.data.alt_text || ''; }
          } catch { /* keep plain copy */ }
        }
        const pin = await api.createPin({ image, thumb, title: String(title).slice(0, 100), description: String(description).slice(0, 800), link, altText: alt, batchId, accountId, boardId, boardName, status: 'draft', source: 'upload', keyword: title0.toLowerCase() });
        ids.push(pin.id);
      }
      if (link0(commonLink)) setPref('lastLink', commonLink);
      if (schedule) {
        const r = await api.autoSchedule({ ...schedule, pinIds: ids, accountId });
        toast(`${r.scheduled} pins auto-scheduled ✓`, 'ok');
      } else toast(`${ids.length} pins saved to drafts ✓`, 'ok');
      setSaved(ids.length); setUploads([]);
      refreshMe().catch(() => {});
    } catch (e) { toast(`${e.message} (${ids.length} saved before the error)`, 'error', 8000); } finally { setProgress(null); }
  }

  const modeTabs = (
    <div class="tabs" role="tablist" style={{ marginBottom: 0, maxWidth: 560 }}>
      <button class={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}>From a list of links / keywords</button>
      <button class={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>Upload finished pins (Canva)</button>
    </div>
  );

  if (mode === 'upload') {
    return (
      <div class="stack lg">
        {modeTabs}
        <div class="card stack">
          <h3 style={{ margin: 0 }}>1. Add your designs</h3>
          <p class="small muted" style={{ margin: 0 }}>Drop PNG/JPG files or the <b>.zip</b> Canva gives you when you download several pages. Up to {max} at a time. <a href="#/app/integrations">Canva guide</a></p>
          <label class="btn ghost block" style={{ padding: 28, borderStyle: 'dashed' }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles([...e.dataTransfer.files]); }}>
            <Icon name="upload" /> Choose images or a .zip (or drag them here)
            <input type="file" multiple accept="image/*,.zip,application/zip" class="sr-only" data-testid="upload-input" onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
          </label>
          {uploads.length > 0 && (
            <div class="bulk-grid">
              {uploads.map((u, i) => (
                <div key={i} class="stack" style={{ gap: 6 }}>
                  <img src={u.src} alt="" style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: 12, boxShadow: 'var(--shadow)' }} />
                  <input type="text" value={u.title} onInput={(e) => setUploads((x) => x.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} aria-label="Pin title" />
                  <button class="link-btn tiny" onClick={() => setUploads((x) => x.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {uploads.length > 0 && (
          <div class="card stack">
            <h3 style={{ margin: 0 }}>2. Links, SEO and schedule</h3>
            <label class="field">Destination link for all pins<input type="url" value={commonLink} onInput={(e) => setCommonLink(e.target.value)} placeholder="https://yourblog.com/post" /></label>
            <label class="field"><span>Or one line per design, in the same order (optional): <span class="kbd">Title | https://link</span></span>
              <textarea rows={3} value={uploadLines} onInput={(e) => setUploadLines(e.target.value)} /></label>
            <AccountBoardPicker accountId={accountId} setAccountId={setAccountId} boardId={boardId} setBoardId={setBoardId} setBoardName={setBoardName} />
            <label class="check"><input type="checkbox" checked={aiCopy} onChange={(e) => setAiCopy(e.target.checked)} /> Write SEO titles, descriptions and alt text with AI for each pin</label>
            {progress && <div class="notice row"><Spinner /> {progress.label}: {progress.i} / {progress.n}</div>}
            <div class="row"><button class="btn ghost" disabled={!!progress} onClick={() => saveUploads(null)}>Save all as drafts</button></div>
            <AutoScheduleForm tz={tz} accountId={accountId} defaultBoardId={boardId} busy={!!progress} count={uploads.length}
              submitLabel={`Save & auto-schedule ${uploads.length} pins`} onSubmit={(o) => saveUploads(o)} />
          </div>
        )}
        {saved != null && <div class="notice ok">{saved} pins saved. <a href="#/app/schedule">Open the schedule →</a></div>}
      </div>
    );
  }

  return (
    <div class="stack lg">
      {modeTabs}
      <div class="card stack">
        <div class="row between">
          <div>
            <h3 style={{ margin: 0 }}>1. Paste your list</h3>
            <p class="muted small" style={{ margin: 0 }}>One pin per line: <span class="kbd">Title | https://link | https://image.jpg</span> (image optional), or paste/upload a CSV with columns <span class="kbd">title, url, image, description</span>. Up to {max} pins per batch.</p>
          </div>
          <div class="row">
            <button class="btn sm ghost" onClick={() => setInput(SAMPLE)}>Use sample</button>
            <label class="btn sm ghost"><Icon name="upload" size={16} /> CSV
              <input type="file" accept=".csv,text/csv" class="sr-only" onChange={async (e) => { const f = e.target.files[0]; if (f) setInput(await f.text()); e.target.value = ''; }} />
            </label>
          </div>
        </div>
        <textarea rows={7} value={input} onInput={(e) => setInput(e.target.value)} placeholder={SAMPLE} aria-label="Bulk input" />
        <p class="small muted" style={{ margin: 0 }}>{parseBulkInput(input).length} pins detected</p>
      </div>

      <div class="card stack">
        <h3 style={{ margin: 0 }}>2. Choose templates and variations</h3>
        <div class="field">Templates (pick 1–4 to rotate)</div>
        <div class="row" style={{ gap: 8 }}>
          {freeTemplates.map((t) => (
            <button key={t.id} type="button" class={`chip ${tplIds.includes(t.id) ? 'primary' : ''}`} style={{ cursor: 'pointer', border: 0 }}
              onClick={() => setTplIds((ids) => ids.includes(t.id) ? (ids.length > 1 ? ids.filter((x) => x !== t.id) : ids) : [...ids, t.id].slice(-4))}>
              {tplIds.includes(t.id) ? '✓ ' : ''}{t.name}
            </button>
          ))}
        </div>
        <div class="grid-3">
          <label class="field">Starting palette
            <select value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>{PALETTES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label class="field">Fonts
            <select value={fontPairId} onChange={(e) => setFontPairId(e.target.value)}>{FONT_PAIRS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label class="field">Images
            <select value={imageMode} onChange={(e) => setImageMode(e.target.value)}>
              <option value="post">Image from each post (falls back to AI)</option>
              <option value="ai">Free AI image per pin (Pollinations)</option>
              <option value="same">Use images from my current design</option>
              <option value="none">Only image links from my list</option>
            </select>
          </label>
        </div>
        <label class="check"><input type="checkbox" checked={rotatePalettes} onChange={(e) => setRotatePalettes(e.target.checked)} /> Rotate colour palettes for variety</label>
        <div class="row"><button class="btn primary" disabled={!!progress} onClick={generate}><Icon name="layers" size={16} /> Generate pins</button>
          {progress && !designs.length && <span class="small muted row"><Spinner /> {progress.label}: {progress.i} / {progress.n}</span>}</div>
      </div>

      {designs.length > 0 && (
        <div class="card stack">
          <div class="row between"><h3 style={{ margin: 0 }}>3. Review {designs.length} pins</h3><span class="muted small">AI images can take a little while to appear.</span></div>
          <div class="bulk-grid">
            {designs.map((d, i) => (
              <div key={i} class="stack" style={{ gap: 6 }}>
                <Preview design={d} logo={brand.logo} onCanvas={(c) => { canvases.current[i] = c; }} />
                <span class="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rows[i]?.title}</span>
              </div>
            ))}
          </div>
          <div class="divider" />
          <h3 style={{ margin: 0 }}>4. Save or auto-schedule</h3>
          <AccountBoardPicker accountId={accountId} setAccountId={setAccountId} boardId={boardId} setBoardId={setBoardId} setBoardName={setBoardName} />
          <label class="check"><input type="checkbox" checked={aiCopy} onChange={(e) => setAiCopy(e.target.checked)} /> Write SEO titles, descriptions and alt text with AI for each pin</label>
          {progress && <div class="notice row"><Spinner /> {progress.label}: {progress.i} / {progress.n}</div>}
          {saved != null && <div class="notice ok">{saved} pins saved. <a href="#/app/schedule">Open the schedule →</a></div>}
          <div class="row">
            <button class="btn ghost" disabled={!!progress} onClick={() => saveAll(null)}>Save all as drafts</button>
          </div>
          <AutoScheduleForm tz={tz} accountId={accountId} defaultBoardId={boardId} busy={!!progress} count={designs.length}
            submitLabel={`Save & auto-schedule ${designs.length} pins`} onSubmit={(opts) => saveAll(opts)} />
          <button class="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/app/design')}>← Back to the designer</button>
        </div>
      )}
    </div>
  );
}
