import { useState } from 'preact/hooks';
import { Spinner, Icon } from '../components.jsx';
import { api } from '../lib/api.js';
import { toast, useStore, pref } from '../lib/store.js';
import { fileToDataUrl, loadImage, searchStock, STOCK_PROVIDERS } from '../lib/images.js';
import { stockKeys } from '../lib/data.js';

/** Upload / URL / stock search / AI image generation. Calls onPick(src). */
export function ImagePicker({ onPick, topic }) {
  const st = useStore();
  const amawp = st.health?.amawpImages;
  const [tab, setTab] = useState('stock');
  const [postUrl, setPostUrl] = useState(pref('lastLink', ''));
  const [postImgs, setPostImgs] = useState([]);
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState(amawp ? 'amawp' : 'openverse');
  const [query, setQuery] = useState(topic ? String(topic).split(' ').slice(0, 4).join(' ') : '');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState('');

  async function search(e) {
    e && e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      if (provider === 'amawp') setResults((await api.relay.images(query.trim())).results || []);
      else setResults(await searchStock(provider, query.trim(), stockKeys()));
    }
    catch (err) { toast(err.message, 'error'); setResults([]); } finally { setBusy(false); }
  }

  async function pick(src) {
    setBusy(true);
    try { await loadImage(src); onPick(src); }
    catch { toast('That image could not be loaded. Try another one.', 'error'); }
    finally { setBusy(false); }
  }

  async function fromPost(e) {
    e && e.preventDefault();
    if (!api.relay) { toast('Reading a post needs the Tackly server.', 'error'); return; }
    setBusy(true);
    try {
      const info = await api.relay.pageInfo(postUrl.trim());
      setPostImgs(info.images || []);
      if (!info.images?.length) toast('No usable images found on that page.', 'error');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function suggestPrompt() {
    setBusy(true);
    try {
      const r = await api.aiText('image_prompt', { topic: topic || query || 'cozy home' });
      setPrompt(String(r.text || '').replace(/^["']|["']$/g, '').trim().slice(0, 400));
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }

  async function generate() {
    if (!prompt.trim()) { toast('Describe the image first.', 'error'); return; }
    setBusy(true);
    try {
      const r = await api.aiImage(prompt.trim());
      const src = r.b64 ? `data:image/png;base64,${r.b64}` : r.url;
      await loadImage(src);
      onPick(src);
      toast('AI image added ✓', 'ok');
    } catch (e) { toast(e.message || 'Image generation failed. Try again.', 'error'); } finally { setBusy(false); }
  }

  return (
    <div class="stack">
      <div class="tabs" role="tablist">
        {[['stock', 'Free photos'], ['post', 'From post'], ['ai', 'AI'], ['upload', 'Upload'], ['url', 'Link']].map(([k, l]) => (
          <button key={k} type="button" class={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'upload' && (
        <label class="btn block ghost" style={{ padding: 22 }}>
          <Icon name="upload" /> Choose an image from your device
          <input type="file" accept="image/*" class="sr-only" onChange={async (e) => {
            const f = e.target.files[0]; if (!f) return;
            try { onPick(await fileToDataUrl(f)); } catch (err) { toast(err.message, 'error'); }
            e.target.value = '';
          }} />
        </label>
      )}
      {tab === 'url' && (
        <form class="row nowrap" onSubmit={(e) => { e.preventDefault(); if (url) pick(url.trim()); }}>
          <input type="url" placeholder="https://…/photo.jpg" value={url} onInput={(e) => setUrl(e.target.value)} />
          <button class="btn sm primary" disabled={busy}>Use</button>
        </form>
      )}
      {tab === 'stock' && (
        <>
          <form class="row nowrap" onSubmit={search}>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ maxWidth: 130 }} aria-label="Stock provider">
              {amawp && <option value="amawp">{amawp.name}</option>}
              {STOCK_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.id === 'openverse' ? 'Openverse' : p.name}</option>)}
            </select>
            <input type="search" placeholder="Search free photos" value={query} onInput={(e) => setQuery(e.target.value)} />
            <button class="btn sm primary" disabled={busy} aria-label="Search">{busy ? <Spinner /> : <Icon name="search" size={16} />}</button>
          </form>
          {provider !== 'openverse' && provider !== 'amawp' && !stockKeys()[provider] && <div class="notice small">Add your free {provider} key in <a href="#/app/settings">Settings</a> (stored only in this browser).</div>}
          {results.length > 0 && (
            <div class="stock-grid">
              {results.map((r) => (
                <button key={r.id} type="button" title={r.credit} onClick={() => pick(r.full || r.thumb)}>
                  <img src={r.thumb} alt={r.credit} loading="lazy" />
                </button>
              ))}
            </div>
          )}
          {results.length > 0 && <p class="tiny faint" style={{ margin: 0 }}>Check each image’s licence before use. Hover an image to see its credit.</p>}
        </>
      )}
      {tab === 'post' && (
        <div class="stack">
          <form class="row nowrap" onSubmit={fromPost}>
            <input type="url" placeholder="https://yourblog.com/your-post" value={postUrl} onInput={(e) => setPostUrl(e.target.value)} aria-label="Post URL" />
            <button class="btn sm primary" disabled={busy}>{busy ? <Spinner /> : 'Get images'}</button>
          </form>
          {postImgs.length > 0 && (
            <div class="stock-grid">
              {postImgs.map((src) => <button key={src} type="button" onClick={() => pick(src)}><img src={src} alt="" loading="lazy" referrerpolicy="no-referrer" /></button>)}
            </div>
          )}
          <p class="tiny faint" style={{ margin: 0 }}>Uses the featured image and photos from your own blog post: the most on-brand, copyright-safe option.</p>
        </div>
      )}
      {tab === 'ai' && (
        <div class="stack">
          <textarea rows={3} placeholder="e.g. cozy reading nook with warm lights, autumn, soft film photo" value={prompt} onInput={(e) => setPrompt(e.target.value)} />
          <div class="row">
            <button class="btn sm" type="button" disabled={busy} onClick={suggestPrompt}><Icon name="sparkle" size={16} /> Suggest prompt</button>
            <button class="btn sm primary" type="button" disabled={busy} onClick={generate}>{busy ? <><Spinner /> Generating…</> : 'Generate image'}</button>
          </div>
          <p class="tiny faint" style={{ margin: 0 }}>Free AI images by Pollinations.ai (can take 10–30 seconds). Add your own image API in Settings for other models.</p>
        </div>
      )}
    </div>
  );
}
