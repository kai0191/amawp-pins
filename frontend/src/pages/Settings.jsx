import { useEffect, useState } from 'preact/hooks';
import { Spinner, Icon } from '../components.jsx';
import { api, testEngine, initApi } from '../lib/api.js';
import { ldb } from '../lib/localdb.js';
import { useStore, setState, toast, pref, setPref, userTz } from '../lib/store.js';
import { setDataHome, ENGINE_DEPLOY_URL, REPO_URL } from '../lib/config.js';
import { fileToDataUrl } from '../lib/images.js';
import { refreshMe, saveProfile, resetAccountCaches } from '../lib/data.js';
import { PALETTES, FONT_PAIRS } from '../designer/styles.js';
import { download } from './Seo.jsx';

const COMMON_TZ = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'UTC'];

function Section({ title, desc, children, id }) {
  return (
    <div class="card stack" id={id}>
      <div><h3 style={{ margin: 0 }}>{title}</h3>{desc && <p class="muted small" style={{ margin: '4px 0 0' }}>{desc}</p>}</div>
      {children}
    </div>
  );
}

function randomKey() {
  const a = new Uint8Array(18); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
}

function DataHome() {
  const s = useStore();
  const engine = s.home?.mode === 'engine';
  const [url, setUrl] = useState(s.home?.url || '');
  const [key, setKey] = useState(s.home?.key || '');
  const [suggested] = useState(randomKey());
  const [busy, setBusy] = useState('');
  const [moved, setMoved] = useState(null);

  async function connectEngine() {
    setBusy('test');
    try {
      const u = url.trim().replace(/\/+$/, '');
      await testEngine(u, key.trim());
      const localData = await (await import('../lib/api.js')).api.exportAll().catch(() => null);
      setDataHome({ mode: 'engine', url: u, key: key.trim() });
      const res = await initApi();
      setState({ home: res.home, engineError: res.engineError });
      resetAccountCaches();
      // Save the relay address + profile into the engine so it can post on its own.
      await saveProfile({ ...(s.profile || {}) }).catch(() => {});
      // Move a browser-connected Pinterest account to the engine.
      for (const a of await ldb.all('accounts').catch(() => [])) if (!a.demo) await api.addAccount(a).catch(() => {});
      await refreshMe().catch(() => {});
      toast('Connected to your Cloudflare engine ✓', 'ok');
      if (localData && localData.pins?.filter((p) => p.status !== 'posted').length) setMoved({ data: localData, count: localData.pins.filter((p) => p.status !== 'posted').length });
    } catch (e) { toast(`Could not connect: ${e.message}`, 'error', 8000); } finally { setBusy(''); }
  }
  async function moveData() {
    setBusy('move');
    try { const n = await api.importAll(moved.data); toast(`${n} pins copied to your engine ✓`, 'ok'); setMoved(null); refreshMe(); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  }
  async function useBrowser() {
    if (!confirm('Switch back to storing data in this browser? Your engine keeps its data; you can reconnect any time.')) return;
    setDataHome({ mode: 'local' });
    const res = await initApi();
    setState({ home: res.home, engineError: null });
    resetAccountCaches(); refreshMe().catch(() => {});
    toast('Now using this browser');
  }

  return (
    <Section id="data-home" title="Data home: where your pins live" desc="Tackly does not keep your pins, images or Pinterest login on our servers. You choose where they live.">
      <div class="grid-2">
        <div class={`card flat stack ${!engine ? '' : ''}`} style={{ borderColor: !engine ? 'var(--primary)' : undefined, borderWidth: !engine ? 2 : 1 }}>
          <div class="row between"><b>This browser</b>{!engine && <span class="chip primary">In use</span>}</div>
          <p class="small muted" style={{ margin: 0 }}>Zero setup. Pins are saved privately in this browser. Scheduled pins post while Tackly is open in a tab. Use Export to back up.</p>
          {engine && <button class="btn sm ghost" onClick={useBrowser}>Use this browser instead</button>}
        </div>
        <div class="card flat stack" style={{ borderColor: engine ? 'var(--primary)' : undefined, borderWidth: engine ? 2 : 1 }}>
          <div class="row between"><b>Your own Cloudflare (recommended)</b>{engine ? <span class="chip primary">In use</span> : <span class="chip ok">Free</span>}</div>
          <p class="small muted" style={{ margin: 0 }}>Your private Tackly engine on your free Cloudflare account: posts 24/7 even when this app is closed, syncs across devices, and lets Claude, Codex or ChatGPT work with your pins.</p>
        </div>
      </div>
      {!engine && (
        <div class="stack">
          <b>Set up your engine (about 5 minutes, free)</b>
          <ol class="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Create a free account at <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener">cloudflare.com</a> (no card needed) and a free <a href="https://github.com/signup" target="_blank" rel="noopener">GitHub</a> account.</li>
            <li>Click <b>Deploy to Cloudflare</b> below. Cloudflare copies the engine to your account and creates its free database and storage.</li>
            <li>When it asks for <span class="kbd">ENGINE_KEY</span>, paste this private key (or your own, 12+ characters): <span class="kbd">{suggested}</span> <button class="link-btn small" onClick={() => { navigator.clipboard?.writeText(suggested); setKey(suggested); toast('Key copied ✓', 'ok'); }}>copy</button></li>
            <li>After it deploys, copy your engine address (looks like <span class="kbd">https://tackly-engine.yourname.workers.dev</span>) and paste it below with the same key.</li>
          </ol>
          <div class="row">
            <a class="btn primary" href={ENGINE_DEPLOY_URL} target="_blank" rel="noopener">☁️ Deploy to Cloudflare</a>
            <a class="small" href={`${REPO_URL}/blob/main/docs/ENGINE.md`} target="_blank" rel="noopener">Step-by-step guide (with a no-GitHub option)</a>
          </div>
        </div>
      )}
      <div class="grid-2">
        <label class="field">Engine address<input type="url" value={url} onInput={(e) => setUrl(e.target.value)} placeholder="https://tackly-engine.yourname.workers.dev" /></label>
        <label class="field">Engine key<input type="password" value={key} onInput={(e) => setKey(e.target.value)} placeholder="Your ENGINE_KEY" /></label>
      </div>
      <div class="row">
        <button class="btn" disabled={!!busy || !url || key.length < 12} onClick={connectEngine}>{busy === 'test' ? <Spinner /> : engine ? 'Update engine connection' : 'Connect my engine'}</button>
        {engine && <span class="small muted">Connected to {s.home.url}</span>}
      </div>
      {moved && (
        <div class="notice row between"><span>You have {moved.count} pins in this browser. Copy them to your engine?</span>
          <button class="btn sm primary" disabled={busy === 'move'} onClick={moveData}>{busy === 'move' ? <Spinner /> : 'Copy to engine'}</button></div>
      )}
      <p class="tiny faint" style={{ margin: 0 }}>Your engine key is stored only in this browser. Keep it private; anyone with it can manage your engine.</p>
    </Section>
  );
}

export function Settings() {
  const s = useStore();
  const p = s.profile || {};
  const bk = p.brandKit || {};
  const [name, setName] = useState(p.name || '');
  const [tz, setTz] = useState(userTz());
  const [website, setWebsite] = useState(bk.website || '');
  const [logo, setLogo] = useState(bk.logo || '');
  const [paletteId, setPaletteId] = useState(bk.paletteId || 'blush');
  const [fontPairId, setFontPairId] = useState(bk.fontPairId || 'modern');
  const [accent, setAccent] = useState(bk.accent || '');
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState({ textBaseUrl: '', textKey: '', textModel: '', imageBaseUrl: '', imageKey: '', imageModel: '' });
  const [aiSaving, setAiSaving] = useState(false);
  const [keys, setKeys] = useState(pref('stockKeys', {}));

  useEffect(() => { api.getAiSettings().then((a) => setAi((x) => ({ ...x, ...(a || {}) }))).catch(() => {}); }, [s.home?.mode]);

  async function saveAll() {
    setSaving(true);
    try { await saveProfile({ name, timezone: tz, brandKit: { website, logo, paletteId, fontPairId, accent: accent || undefined } }); toast('Saved ✓', 'ok'); }
    catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  }
  async function saveAi() {
    setAiSaving(true);
    try {
      const body = { textBaseUrl: ai.textBaseUrl, textModel: ai.textModel, imageBaseUrl: ai.imageBaseUrl, imageModel: ai.imageModel };
      if (ai.textKey && !String(ai.textKey).includes('••••')) body.textKey = ai.textKey;
      if (ai.imageKey && !String(ai.imageKey).includes('••••')) body.imageKey = ai.imageKey;
      for (const f of ['textBaseUrl', 'imageBaseUrl']) if (body[f] && !/^https:\/\//i.test(body[f])) throw new Error('Base URLs must start with https://');
      setAi({ ...ai, ...(await api.putAiSettings(body)) });
      toast('AI settings saved ✓', 'ok');
    } catch (e) { toast(e.message, 'error'); } finally { setAiSaving(false); }
  }
  async function exportData() { download(`tackly-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await api.exportAll()), 'application/json'); }
  async function importData(file) {
    try { const n = await api.importAll(JSON.parse(await file.text())); toast(`${n} pins imported ✓`, 'ok'); refreshMe(); }
    catch (e) { toast(e.message || 'Import failed', 'error'); }
  }
  async function wipe() {
    if (prompt('This deletes all Tackly data in this browser (pins, images, Pinterest connection, settings). Type DELETE to confirm.') !== 'DELETE') return;
    try { await api.wipe(); localStorage.clear(); toast('All local data deleted.'); setTimeout(() => location.reload(), 600); } catch (e) { toast(e.message, 'error'); }
  }
  const keyVal = (k) => (ai[k] && String(ai[k]).includes('••••') ? '' : ai[k] || '');
  const keyPh = (k) => (ai[`${k}Set`] || (ai[k] && String(ai[k]).includes('••••')) ? 'saved: type to replace' : 'sk-…');

  return (
    <div class="stack lg" style={{ maxWidth: 900 }}>
      <div class="row mobile-links" style={{ gap: 8 }}>
        <a class="btn sm ghost" href="#/app/bulk">Bulk create</a>
        <a class="btn sm ghost" href="#/app/integrations">Canva & AI</a>
        <a class="btn sm ghost" href="#/app/accounts">Pinterest account</a>
      </div>
      <DataHome />
      <Section title="Profile & brand kit" desc="Applied to new pins and bulk batches. Saved in your data home.">
        <div class="grid-2">
          <label class="field">Your name (optional)<input type="text" value={name} onInput={(e) => setName(e.target.value)} /></label>
          <label class="field">Timezone
            <select value={tz} onChange={(e) => setTz(e.target.value)}>
              {[...new Set([tz, Intl.DateTimeFormat().resolvedOptions().timeZone, ...COMMON_TZ])].map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label class="field">Website / handle shown on pins<input type="text" value={website} onInput={(e) => setWebsite(e.target.value)} placeholder="yourwebsite.com" /></label>
          <div class="field">Logo (transparent PNG works best)
            <div class="row">
              {logo && <img src={logo} alt="Logo" style={{ height: 44, width: 'auto', background: 'var(--surface-2)', borderRadius: 8, padding: 4 }} />}
              <label class="btn sm ghost"><Icon name="upload" size={16} /> Upload logo<input type="file" accept="image/*" class="sr-only" onChange={async (e) => { const f = e.target.files[0]; if (f) setLogo(await fileToDataUrl(f, 400)); }} /></label>
              {logo && <button class="link-btn small" onClick={() => setLogo('')}>Remove</button>}
            </div>
          </div>
          <label class="field">Default palette<select value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>{PALETTES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label class="field">Default fonts<select value={fontPairId} onChange={(e) => setFontPairId(e.target.value)}>{FONT_PAIRS.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.heading.family})</option>)}</select></label>
          <label class="field">Brand accent colour (optional)
            <div class="row nowrap"><input type="color" value={accent || '#5847eb'} onInput={(e) => setAccent(e.target.value)} style={{ height: 42, width: 60, padding: 4 }} />{accent && <button class="link-btn small" onClick={() => setAccent('')}>Use palette colour</button>}</div>
          </label>
        </div>
        <div><button class="btn primary" disabled={saving} onClick={saveAll}>{saving ? <Spinner /> : 'Save profile & brand kit'}</button></div>
      </Section>

      <Section title="AI providers" desc={`Free AI (Pollinations.ai) works with no setup. For better results, add any OpenAI-compatible provider (OpenAI, OpenRouter, Groq, Together…). Keys are saved only in your data home (${s.home?.mode === 'engine' ? 'your engine' : 'this browser'}).`}>
        <div class="grid-3">
          <label class="field">Text base URL<input type="url" placeholder="https://api.openai.com/v1" value={ai.textBaseUrl || ''} onInput={(e) => setAi({ ...ai, textBaseUrl: e.target.value })} /></label>
          <label class="field">Text API key<input type="password" placeholder={keyPh('textKey')} value={keyVal('textKey')} onInput={(e) => setAi({ ...ai, textKey: e.target.value })} /></label>
          <label class="field">Text model<input type="text" placeholder="gpt-4o-mini" value={ai.textModel || ''} onInput={(e) => setAi({ ...ai, textModel: e.target.value })} /></label>
          <label class="field">Image base URL<input type="url" placeholder="https://api.openai.com/v1" value={ai.imageBaseUrl || ''} onInput={(e) => setAi({ ...ai, imageBaseUrl: e.target.value })} /></label>
          <label class="field">Image API key<input type="password" placeholder={keyPh('imageKey')} value={keyVal('imageKey')} onInput={(e) => setAi({ ...ai, imageKey: e.target.value })} /></label>
          <label class="field">Image model<input type="text" placeholder="gpt-image-1" value={ai.imageModel || ''} onInput={(e) => setAi({ ...ai, imageModel: e.target.value })} /></label>
        </div>
        <div class="row">
          <button class="btn" disabled={aiSaving} onClick={saveAi}>{aiSaving ? <Spinner /> : 'Save AI settings'}</button>
          <button class="btn ghost" onClick={async () => { setAi({ ...ai, ...(await api.putAiSettings({ textKey: '', imageKey: '', textBaseUrl: '', imageBaseUrl: '' })) }); toast('Using free AI again'); }}>Use free AI only</button>
        </div>
      </Section>

      <Section title="Stock photo keys (optional)" desc="Openverse works without a key. Free keys from these sites add millions more photos. Stored only in this browser.">
        <div class="grid-3">
          {[['unsplash', 'Unsplash access key', 'https://unsplash.com/developers'], ['pexels', 'Pexels API key', 'https://www.pexels.com/api/'], ['pixabay', 'Pixabay API key', 'https://pixabay.com/api/docs/']].map(([k, l, href]) => (
            <label class="field" key={k}><span>{l} · <a href={href} target="_blank" rel="noopener">get free key</a></span><input type="password" value={keys[k] || ''} onInput={(e) => setKeys({ ...keys, [k]: e.target.value })} /></label>
          ))}
        </div>
        <div><button class="btn" onClick={() => { setPref('stockKeys', keys); toast('Stock keys saved in this browser ✓', 'ok'); }}>Save stock keys</button></div>
      </Section>

      <Section title="Backup & privacy" desc="Your data is yours. Download a backup any time, move it between browsers, or delete it.">
        <div class="row">
          <button class="btn ghost" onClick={exportData}><Icon name="download" size={16} /> Export backup</button>
          <label class="btn ghost"><Icon name="upload" size={16} /> Import backup<input type="file" accept="application/json,.json" class="sr-only" onChange={(e) => e.target.files[0] && importData(e.target.files[0])} /></label>
          {s.home?.mode !== 'engine' && <button class="btn danger" onClick={wipe}><Icon name="trash" size={16} /> Delete all data in this browser</button>}
          <a class="small" href="#/data-deletion">How deletion works</a>
        </div>
      </Section>
      <div class="row small muted"><a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a> · <a href="#/app/owner">Owner stats</a></div>
    </div>
  );
}
