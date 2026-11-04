import { useEffect, useMemo, useState } from 'preact/hooks';
import { Icon, Spinner } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, toast, navigate, pref, setPref } from '../lib/store.js';
import { loadAccounts } from '../lib/data.js';
import { scorePin, SEASONS, seasonsToPinNow, RANKING_TIPS, rankKeywords } from '../../../shared/seo.js';

export function SeoScore({ input, compact }) {
  const r = useMemo(() => scorePin(input), [JSON.stringify(input)]);
  const color = r.score >= 85 ? 'var(--ok)' : r.score >= 70 ? 'var(--primary)' : r.score >= 50 ? 'var(--warn)' : 'var(--danger)';
  const failing = r.checks.filter((c) => !c.ok).sort((a, b) => b.weight - a.weight);
  return (
    <div class="stack" style={{ gap: 8 }} data-testid="seo-score">
      <div class="row nowrap">
        <div style={{ width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18, color, border: `4px solid ${color}`, flex: 'none' }}>{r.score}</div>
        <div><b>Pinterest SEO: {r.grade}</b><div class="small muted">{failing.length ? `${failing.length} improvement${failing.length > 1 ? 's' : ''} available` : 'Everything checks out. Great pin!'}</div></div>
      </div>
      {(compact ? failing.slice(0, 3) : r.checks).map((c) => (
        <div key={c.id} class="small row nowrap" style={{ alignItems: 'flex-start' }}>
          <span style={{ color: c.ok ? 'var(--ok)' : 'var(--warn)', fontWeight: 800, width: 16 }}>{c.ok ? '✓' : '!'}</span>
          <span class="grow">{c.ok ? c.label : <><b>{c.label}.</b> <span class="muted">{c.fix}</span></>}</span>
        </div>
      ))}
    </div>
  );
}

function csv(rows) {
  return rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
export function download(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const titleCase = (s) => s.replace(/\b\w/g, (m) => m.toUpperCase());

function Research({ initial }) {
  const s = useStore();
  const [seed, setSeed] = useState(initial || '');
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const [sel, setSel] = useState([]);
  const [trends, setTrends] = useState(null);
  const saved = pref('seoKeywords', []);

  async function run(e) {
    e && e.preventDefault();
    if (seed.trim().length < 2) return;
    setBusy('kw'); setSel([]);
    try {
      let data = { keywords: [], pinterest: { available: false } };
      if (s.relay) data = await api.keywords(seed.trim());
      // Add AI keyword ideas (free) so research still works if autocomplete is thin.
      let ai = [];
      try { const r = await api.aiText('keywords', { topic: seed.trim(), count: 20 }); ai = Array.isArray(r.data) ? r.data.map(String) : []; } catch { /* optional */ }
      const merged = rankKeywords(seed.trim(), [
        ...[...new Set(data.keywords.map((k) => k.keyword))].length ? [{ source: 'search', items: data.keywords.map((k) => k.keyword) }] : [],
        { source: 'ai', items: ai },
      ]).map((k) => {
        const orig = data.keywords.find((x) => x.keyword === k.keyword);
        return orig ? { ...k, sources: [...new Set([...orig.sources, ...(k.sources.includes('ai') ? ['ai'] : [])])], score: Math.max(k.score, orig.score) } : k;
      });
      setRes({ ...data, keywords: merged.slice(0, 60) });
      if (!merged.length) toast('No ideas found. Try a broader topic.', 'error');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  }
  useEffect(() => { if (initial) run(); }, [initial]);

  async function loadTrends() {
    setBusy('tr');
    try { const r = await api.trends('US'); setTrends(r.trends || []); }
    catch (e) { setTrends({ error: e.message }); } finally { setBusy(''); }
  }

  const list = res?.keywords || [];
  const chosen = sel.length ? sel : list.slice(0, 10).map((k) => k.keyword);
  const max = Math.max(1, ...list.map((k) => k.score));
  return (
    <div class="stack lg">
      <form class="card stack" onSubmit={run}>
        <h3 style={{ margin: 0 }}>Pinterest keyword research</h3>
        <p class="small muted" style={{ margin: 0 }}>Type your niche or post topic. Tackly mines real search suggestions{s.relay ? ' (Pinterest when available, Google and Bing)' : ''} plus AI ideas, then ranks long-tail keywords by demand and relevance.</p>
        <div class="row nowrap">
          <input type="search" value={seed} onInput={(e) => setSeed(e.target.value)} placeholder="e.g. small kitchen decor" aria-label="Seed keyword" />
          <button class="btn primary" disabled={!!busy}>{busy === 'kw' ? <Spinner /> : <><Icon name="search" size={16} /> Research</>}</button>
        </div>
        {res && <div class="small muted">{res.pinterest?.available ? `✓ Includes ${res.pinterest.count} Pinterest search terms.` : res.pinterest?.reason || (s.relay ? 'Connect Pinterest to include Pinterest’s own search terms when available.' : 'Search suggestions need the Tackly server; showing AI ideas.')}</div>}
      </form>
      {list.length > 0 && (
        <div class="card stack">
          <div class="row between">
            <b>{list.length} keyword ideas</b>
            <div class="row" style={{ gap: 6 }}>
              <button class="btn sm ghost" onClick={() => { setPref('seoKeywords', [...new Set([...chosen, ...saved])].slice(0, 200)); toast(`${chosen.length} keywords saved to your list`, 'ok'); }}>Save to my list</button>
              <button class="btn sm ghost" onClick={() => download('tackly-keywords-for-canva.csv', csv([['Title', 'Keyword'], ...chosen.map((k) => [titleCase(k), k])]))}>CSV for Canva</button>
              <button class="btn sm primary" onClick={() => { setPref('bulkInput', chosen.map((k) => titleCase(k)).join('\n')); navigate('/app/bulk'); }}>Make pins from {sel.length ? 'selected' : 'top 10'}</button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th style={{ width: 30 }} /><th>Keyword</th><th>Intent</th><th>Strength</th><th>Sources</th></tr></thead>
              <tbody>
                {list.map((k) => (
                  <tr key={k.keyword}>
                    <td><input type="checkbox" aria-label={`Select ${k.keyword}`} checked={sel.includes(k.keyword)} onChange={(e) => setSel((x) => e.target.checked ? [...x, k.keyword] : x.filter((i) => i !== k.keyword))} /></td>
                    <td><b>{k.keyword}</b>{k.longTail && <span class="chip ok" style={{ marginLeft: 6 }}>long-tail</span>}</td>
                    <td><span class="chip">{k.intent}</span></td>
                    <td style={{ minWidth: 90 }}><div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)' }}><div style={{ width: `${(k.score / max) * 100}%`, height: '100%', borderRadius: 3, background: 'var(--primary)' }} /></div></td>
                    <td class="small muted">{k.sources.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="tiny faint" style={{ margin: 0 }}>Tip: pick 1 main keyword per pin and 2–3 related long-tail keywords for the description. Long-tail phrases are easier to rank for.</p>
        </div>
      )}
      {saved.length > 0 && (
        <div class="card stack">
          <div class="row between"><b>My keyword list ({saved.length})</b><button class="link-btn small" onClick={() => { setPref('seoKeywords', []); toast('List cleared'); setSeed(seed + ''); }}>Clear</button></div>
          <div class="row" style={{ gap: 6 }}>{saved.slice(0, 80).map((k) => <span key={k} class="chip">{k}</span>)}</div>
        </div>
      )}
      <div class="card stack">
        <div class="row between"><b>Pinterest Trends (US)</b><button class="btn sm ghost" disabled={!!busy} onClick={loadTrends}>{busy === 'tr' ? <Spinner /> : 'Load trending keywords'}</button></div>
        {trends && (trends.error ? <p class="small muted" style={{ margin: 0 }}>{trends.error}</p> : (
          <div class="row" style={{ gap: 6 }}>{trends.map((t) => <button key={t.keyword} class="chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => { setSeed(t.keyword); }}>{t.keyword}{t.pct_growth_wow ? ` ↑${t.pct_growth_wow}%` : ''}</button>)}</div>
        ))}
        {!trends && <p class="small muted" style={{ margin: 0 }}>Pinterest’s own trending searches (needs the Pinterest app’s ads:read permission).</p>}
      </div>
    </div>
  );
}

function Checker() {
  const kw = pref('seoKeywords', [])[0] || '';
  const [f, setF] = useState({ keyword: kw, secondary: '', title: '', description: '', altText: '', link: '', boardName: '', headline: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div class="grid-2" style={{ alignItems: 'start' }}>
      <div class="card stack">
        <h3 style={{ margin: 0 }}>Pin SEO checker</h3>
        <label class="field">Main keyword<input type="text" value={f.keyword} onInput={set('keyword')} placeholder="small kitchen ideas" /></label>
        <label class="field">Related keywords (comma separated)<input type="text" value={f.secondary} onInput={set('secondary')} placeholder="tiny kitchen storage, apartment kitchen" /></label>
        <label class="field">Pin title<input type="text" value={f.title} onInput={set('title')} /></label>
        <label class="field">Description<textarea rows={4} value={f.description} onInput={set('description')} /></label>
        <label class="field">Text on the image (headline)<input type="text" value={f.headline} onInput={set('headline')} /></label>
        <div class="grid-2">
          <label class="field">Board name<input type="text" value={f.boardName} onInput={set('boardName')} /></label>
          <label class="field">Link<input type="url" value={f.link} onInput={set('link')} /></label>
        </div>
        <label class="field">Alt text<input type="text" value={f.altText} onInput={set('altText')} /></label>
      </div>
      <div class="card"><SeoScore input={{ ...f, secondary: f.secondary.split(',').map((x) => x.trim()).filter(Boolean) }} /></div>
    </div>
  );
}

function Seasonal() {
  const open = seasonsToPinNow();
  const now = Date.now();
  return (
    <div class="stack lg">
      <div class="card stack">
        <h3 style={{ margin: 0 }}>Pin these now</h3>
        {open.length ? open.map((x) => (
          <div key={x.name} class="row between">
            <span><b>{x.name}</b> <span class="small muted">peaks {new Date(x.peak).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></span>
            <span class="row" style={{ gap: 6 }}>{x.keywords.map((k) => <a key={k} class="chip" href={`#/app/seo?q=${encodeURIComponent(k)}`}>{k}</a>)}</span>
          </div>
        )) : <p class="muted">No season is in its window right now: a great time for evergreen content.</p>}
      </div>
      <div class="card stack">
        <h3 style={{ margin: 0 }}>Year planner</h3>
        <p class="small muted" style={{ margin: 0 }}>Start pinning when the window opens (lead days before the peak). Pinterest needs time to index and test your pins.</p>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Moment</th><th>Peak</th><th>Start pinning</th><th>Keywords</th></tr></thead>
            <tbody>{SEASONS.map((x) => {
              const peak = new Date(Date.UTC(new Date(now).getUTCFullYear(), x.month - 1, x.day));
              const start = new Date(peak.getTime() - x.lead * 86400000);
              return <tr key={x.name}><td><b>{x.name}</b></td><td>{peak.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td><td>{start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td><td class="small muted">{x.keywords.join(', ')}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RichPins() {
  const s = useStore();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState(null);
  async function check(e) {
    e.preventDefault();
    if (!s.relay) { toast('This check needs the Tackly server.', 'error'); return; }
    setBusy(true);
    try { setR(await api.relay.pageInfo(url.trim())); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <div class="grid-2" style={{ alignItems: 'start' }}>
      <form class="card stack" onSubmit={check}>
        <h3 style={{ margin: 0 }}>Rich Pins & page check</h3>
        <p class="small muted" style={{ margin: 0 }}>Rich Pins show your page title and description on every pin from your site. Pinterest reads them from Open Graph meta tags.</p>
        <div class="row nowrap"><input type="url" required placeholder="https://yourblog.com/post" value={url} onInput={(e) => setUrl(e.target.value)} /><button class="btn primary" disabled={busy}>{busy ? <Spinner /> : 'Check'}</button></div>
        {r && (
          <div class="stack">
            <div class={`notice ${r.richPins.ready ? 'ok' : 'warn'}`}>{r.richPins.ready ? '✓ This page has the tags Rich Pins need.' : 'Missing tags: Rich Pins will not show for this page.'}</div>
            {Object.entries(r.richPins.checks).map(([k, v]) => <div key={k} class="small row between"><span class="kbd">{k}</span><span>{v === true ? '✓' : v === false ? '✗ missing' : v || '—'}</span></div>)}
            <div class="small"><b>Title:</b> {r.title}</div>
            {r.images?.length > 0 && <div class="small muted">{r.images.length} images found on this page. Use them in the designer (Images → From post).</div>}
          </div>
        )}
      </form>
      <div class="card stack small">
        <h3 style={{ margin: 0 }}>Turn on Rich Pins (one time)</h3>
        <ol style={{ margin: 0, paddingLeft: 18 }} class="muted">
          <li>Make sure your pages have <span class="kbd">og:title</span>, <span class="kbd">og:description</span> and <span class="kbd">og:image</span>. WordPress SEO plugins (Yoast, Rank Math) add them automatically.</li>
          <li>Claim your website in Pinterest: Settings → Claimed accounts → Websites → Claim.</li>
          <li>Pin any page from your site. Pinterest switches Rich Pins on automatically once it finds the tags.</li>
        </ol>
      </div>
    </div>
  );
}

function Boards() {
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState([]);
  async function go(e) {
    e.preventDefault();
    setBusy(true);
    try { const r = await api.aiText('board_seo', { topic, count: 6 }); setIdeas(Array.isArray(r.data) ? r.data : []); if (!Array.isArray(r.data)) toast('AI reply was not in the expected format. Try again.', 'error'); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  async function create(b) {
    try {
      const acc = (await loadAccounts())[0];
      if (!acc) { toast('Connect Pinterest first.', 'error'); return; }
      await api.createBoard(acc.id, { name: b.name, description: b.description });
      toast(`Board “${b.name}” created ✓`, 'ok');
    } catch (err) { toast(err.message, 'error'); }
  }
  return (
    <div class="stack lg">
      <form class="card stack" onSubmit={go}>
        <h3 style={{ margin: 0 }}>Keyword-rich board ideas</h3>
        <p class="small muted" style={{ margin: 0 }}>Board names and descriptions tell Pinterest what your pins are about. Name boards after real searches.</p>
        <div class="row nowrap"><input type="text" required value={topic} onInput={(e) => setTopic(e.target.value)} placeholder="e.g. vegan meal prep" /><button class="btn primary" disabled={busy}>{busy ? <Spinner /> : '✨ Suggest boards'}</button></div>
      </form>
      {ideas.map((b) => (
        <div key={b.name} class="card stack" style={{ gap: 6 }}>
          <div class="row between"><b>{b.name}</b><button class="btn sm" onClick={() => create(b)}>Create on Pinterest</button></div>
          <p class="small muted" style={{ margin: 0 }}>{b.description}</p>
        </div>
      ))}
    </div>
  );
}

function Secrets() {
  return (
    <div class="grid-2" style={{ alignItems: 'start' }}>
      {RANKING_TIPS.map(([t, d], i) => (
        <div key={t} class="card stack" style={{ gap: 6 }}><span class="chip primary" style={{ alignSelf: 'flex-start' }}>#{i + 1}</span><b>{t}</b><p class="small muted" style={{ margin: 0 }}>{d}</p></div>
      ))}
    </div>
  );
}

export function Seo({ query = {} }) {
  const [tab, setTab] = useState(query.tab || 'research');
  useEffect(() => { if (query.q) setTab('research'); if (query.tab) setTab(query.tab); }, [query.q, query.tab]);
  const tabs = [['research', 'Keywords'], ['checker', 'Pin checker'], ['seasonal', 'Seasons'], ['rich', 'Rich Pins'], ['boards', 'Boards'], ['secrets', 'Ranking tips']];
  return (
    <div class="stack lg">
      <div class="tabs" role="tablist" style={{ marginBottom: 0 }}>
        {tabs.map(([k, l]) => <button key={k} class={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'research' && <Research initial={query.q} />}
      {tab === 'checker' && <Checker />}
      {tab === 'seasonal' && <Seasonal />}
      {tab === 'rich' && <RichPins />}
      {tab === 'boards' && <Boards />}
      {tab === 'secrets' && <Secrets />}
    </div>
  );
}
