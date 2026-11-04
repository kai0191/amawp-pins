import { useEffect, useState } from 'preact/hooks';
import { Spinner, Icon } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, setState, toast, navigate, pref, setPref, userTz } from '../lib/store.js';
import { fileToDataUrl } from '../lib/images.js';
import { PALETTES, FONT_PAIRS } from '../designer/styles.js';

const COMMON_TZ = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'UTC'];

function Section({ title, desc, children }) {
  return (
    <div class="card stack">
      <div><h3 style={{ margin: 0 }}>{title}</h3>{desc && <p class="muted small" style={{ margin: '4px 0 0' }}>{desc}</p>}</div>
      {children}
    </div>
  );
}

export function Settings() {
  const s = useStore();
  const u = s.user;
  const bk = u?.settings?.brandKit || {};
  const [name, setName] = useState(u?.name || '');
  const [tz, setTz] = useState(userTz(u));
  const [website, setWebsite] = useState(bk.website || '');
  const [logo, setLogo] = useState(bk.logo || '');
  const [paletteId, setPaletteId] = useState(bk.paletteId || 'blush');
  const [fontPairId, setFontPairId] = useState(bk.fontPairId || 'modern');
  const [accent, setAccent] = useState(bk.accent || '');
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState({ textBaseUrl: '', textKey: '', textModel: '', imageBaseUrl: '', imageKey: '', imageModel: '' });
  const [aiSaving, setAiSaving] = useState(false);
  const [keys, setKeys] = useState(pref('stockKeys', {}));
  const [pw, setPw] = useState({ current: '', next: '' });

  useEffect(() => { api.getAiSettings().then((a) => setAi((x) => ({ ...x, ...a }))).catch(() => {}); }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const user = await api.updateSettings({ name, timezone: tz, brandKit: { website, logo, paletteId, fontPairId, accent: accent || undefined } });
      setState({ user });
      toast('Settings saved ✓', 'ok');
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  }

  async function saveAi() {
    setAiSaving(true);
    try {
      const body = { textBaseUrl: ai.textBaseUrl, textModel: ai.textModel, imageBaseUrl: ai.imageBaseUrl, imageModel: ai.imageModel };
      if (ai.textKey && !ai.textKey.includes('••••')) body.textKey = ai.textKey;
      if (ai.imageKey && !ai.imageKey.includes('••••')) body.imageKey = ai.imageKey;
      setAi(await api.putAiSettings(body));
      toast('AI settings saved (keys are encrypted) ✓', 'ok');
    } catch (e) { toast(e.message, 'error'); } finally { setAiSaving(false); }
  }

  async function exportData() {
    const d = await api.exportMe();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
    a.download = 'tackly-my-data.json'; a.click();
  }

  async function deleteAccount() {
    if (prompt('This permanently deletes your account, Pinterest connection and all pins. Type DELETE to confirm.') !== 'DELETE') return;
    try { await api.deleteMe(); setState({ user: null }); toast('Your account and data were deleted.'); navigate('/'); }
    catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div class="stack lg" style={{ maxWidth: 860 }}>
      <Section title="Profile" desc="Times you pick are in this timezone.">
        <div class="grid-2">
          <label class="field">Name<input type="text" value={name} onInput={(e) => setName(e.target.value)} /></label>
          <label class="field">Timezone
            <select value={tz} onChange={(e) => setTz(e.target.value)}>
              {[...new Set([tz, Intl.DateTimeFormat().resolvedOptions().timeZone, ...COMMON_TZ])].map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Brand kit" desc="Applied to new pins and bulk batches. Stored in your account.">
        <div class="grid-2">
          <label class="field">Website / handle shown on pins<input type="text" value={website} onInput={(e) => setWebsite(e.target.value)} placeholder="yourwebsite.com" /></label>
          <div class="field">Logo (PNG with transparent background works best)
            <div class="row">
              {logo && <img src={logo} alt="Logo" style={{ height: 44, width: 'auto', background: 'var(--surface-2)', borderRadius: 8, padding: 4 }} />}
              <label class="btn sm ghost"><Icon name="upload" size={16} /> Upload logo
                <input type="file" accept="image/*" class="sr-only" onChange={async (e) => { const f = e.target.files[0]; if (f) setLogo(await fileToDataUrl(f, 400)); }} />
              </label>
              {logo && <button class="link-btn small" onClick={() => setLogo('')}>Remove</button>}
            </div>
          </div>
          <label class="field">Default palette<select value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>{PALETTES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label class="field">Default fonts<select value={fontPairId} onChange={(e) => setFontPairId(e.target.value)}>{FONT_PAIRS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.heading.family})</option>)}</select></label>
          <label class="field">Brand accent colour (optional)
            <div class="row nowrap"><input type="color" value={accent || '#5847eb'} onInput={(e) => setAccent(e.target.value)} style={{ height: 42, width: 60, padding: 4 }} />
              {accent && <button class="link-btn small" onClick={() => setAccent('')}>Use palette colour</button>}</div>
          </label>
        </div>
        <div><button class="btn primary" disabled={saving} onClick={saveProfile}>{saving ? <Spinner /> : 'Save profile & brand kit'}</button></div>
      </Section>

      <Section title="AI providers" desc="Free AI (Pollinations.ai) works with no setup. Optionally use your own OpenAI-compatible provider. Keys are encrypted on our server and never shown in full.">
        <div class="grid-3">
          <label class="field">Text base URL<input type="url" placeholder="https://api.openai.com/v1" value={ai.textBaseUrl} onInput={(e) => setAi({ ...ai, textBaseUrl: e.target.value })} /></label>
          <label class="field">Text API key<input type="password" placeholder={ai.textKeySet ? ai.textKey : 'sk-…'} value={ai.textKey && ai.textKey.includes('••••') ? '' : ai.textKey} onInput={(e) => setAi({ ...ai, textKey: e.target.value })} /></label>
          <label class="field">Text model<input type="text" placeholder="gpt-4o-mini" value={ai.textModel} onInput={(e) => setAi({ ...ai, textModel: e.target.value })} /></label>
          <label class="field">Image base URL<input type="url" placeholder="https://api.openai.com/v1" value={ai.imageBaseUrl} onInput={(e) => setAi({ ...ai, imageBaseUrl: e.target.value })} /></label>
          <label class="field">Image API key<input type="password" placeholder={ai.imageKeySet ? ai.imageKey : 'sk-…'} value={ai.imageKey && ai.imageKey.includes('••••') ? '' : ai.imageKey} onInput={(e) => setAi({ ...ai, imageKey: e.target.value })} /></label>
          <label class="field">Image model<input type="text" placeholder="gpt-image-1" value={ai.imageModel} onInput={(e) => setAi({ ...ai, imageModel: e.target.value })} /></label>
        </div>
        <div class="row">
          <button class="btn" disabled={aiSaving} onClick={saveAi}>{aiSaving ? <Spinner /> : 'Save AI settings'}</button>
          {(ai.textKeySet || ai.imageKeySet) && <button class="btn ghost" onClick={() => { setAi({ ...ai, textKey: '', imageKey: '' }); api.putAiSettings({ textKey: '', imageKey: '' }).then(setAi).then(() => toast('Keys removed')); }}>Remove my keys</button>}
          <span class="small muted">{ai.textKeySet ? `Text: your key (${ai.textKey})` : 'Text: free Pollinations AI'} · {ai.imageKeySet ? `Images: your key (${ai.imageKey})` : 'Images: free Pollinations AI'}</span>
        </div>
      </Section>

      <Section title="Stock photo keys (optional)" desc="Openverse works without a key. Free keys from these sites add more photos. Stored only in this browser.">
        <div class="grid-3">
          {[['unsplash', 'Unsplash access key'], ['pexels', 'Pexels API key'], ['pixabay', 'Pixabay API key']].map(([k, l]) => (
            <label class="field" key={k}>{l}<input type="password" value={keys[k] || ''} onInput={(e) => setKeys({ ...keys, [k]: e.target.value })} /></label>
          ))}
        </div>
        <div><button class="btn" onClick={() => { setPref('stockKeys', keys); toast('Stock keys saved in this browser ✓', 'ok'); }}>Save stock keys</button></div>
      </Section>

      {s.mode === 'remote' && !String(u?.email || '').endsWith('@pinterest.login') && (
        <Section title="Password">
          <div class="grid-2">
            <label class="field">Current password<input type="password" value={pw.current} onInput={(e) => setPw({ ...pw, current: e.target.value })} /></label>
            <label class="field">New password<input type="password" value={pw.next} onInput={(e) => setPw({ ...pw, next: e.target.value })} /></label>
          </div>
          <div><button class="btn" onClick={async () => { try { await api.changePassword(pw); setPw({ current: '', next: '' }); toast('Password changed ✓', 'ok'); } catch (e) { toast(e.message, 'error'); } }}>Change password</button></div>
        </Section>
      )}

      <Section title="Your data" desc="Download everything we store about you, or delete it permanently.">
        <div class="row">
          <button class="btn ghost" onClick={exportData}><Icon name="download" size={16} /> Export my data</button>
          <button class="btn danger" onClick={deleteAccount}><Icon name="trash" size={16} /> Delete account</button>
          <a class="small" href="#/data-deletion">How deletion works</a>
        </div>
      </Section>

      <div class="row small muted">
        <a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a> · <span>Mode: {s.mode === 'demo' ? 'Demo (browser only)' : 'Connected'}</span>
        <button class="link-btn small" onClick={() => { api.logout(); setState({ user: null }); navigate('/'); }}>Sign out</button>
      </div>
    </div>
  );
}
