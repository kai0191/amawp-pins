import { useState } from 'preact/hooks';
import { Icon } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, toast, pref } from '../lib/store.js';
import { download } from './Seo.jsx';

function Copy({ text, label = 'Copy' }) {
  return <button class="btn sm ghost" onClick={() => { navigator.clipboard?.writeText(text).then(() => toast('Copied ✓', 'ok')).catch(() => toast('Copy failed: select and copy manually.', 'error')); }}>{label}</button>;
}
function Code({ children }) {
  return <pre style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 12, overflowX: 'auto', fontSize: 12.5, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{children}</pre>;
}

function Canva() {
  const kws = pref('seoKeywords', []);
  const csvText = ['Title,Keyword,Website', ...(kws.length ? kws : ['small kitchen ideas', 'fall decor ideas', 'easy dinner recipes']).slice(0, 50)
    .map((k) => `"${k.replace(/\b\w/g, (m) => m.toUpperCase())}","${k}","${(pref('designDraft', {})?.text?.website) || 'yourwebsite.com'}"`)].join('\n');
  return (
    <div class="stack lg">
      <div class="card stack">
        <div class="row between"><h3 style={{ margin: 0 }}>Use Canva with Tackly</h3><span class="chip primary">Works with Canva Free & Pro</span></div>
        <p class="muted" style={{ margin: 0 }}>Love designing in Canva? Keep doing it. Tackly adds what Canva doesn’t have for Pinterest: keyword research, SEO titles and descriptions, an SEO score, anti-spam auto-scheduling and a calendar.</p>
        <div class="grid-3">
          <div class="feature"><div class="ico">🔎</div><b>Keywords first</b><p>Find what people search, then design pins around those exact phrases.</p></div>
          <div class="feature"><div class="ico">✍️</div><b>SEO copy for every pin</b><p>AI writes keyword-rich titles, descriptions and alt text for each Canva design.</p></div>
          <div class="feature"><div class="ico">🗓️</div><b>Safe auto-scheduling</b><p>Upload 100 designs at once; Tackly spreads them at natural times, max 10 a day.</p></div>
        </div>
      </div>

      <div class="grid-2" style={{ alignItems: 'start' }}>
        <div class="card stack">
          <span class="chip" style={{ alignSelf: 'flex-start' }}>Canva Free</span>
          <h3 style={{ margin: 0 }}>Design → upload → schedule</h3>
          <ol class="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>In Canva, search the template type <b>“Pinterest Pin”</b> (1000 × 1500 px).</li>
            <li>Put your <b>main keyword in the headline</b> on the image (Pinterest reads the text on pins).</li>
            <li>Make <b>several different designs</b> for the same blog post. Fresh pins rank better.</li>
            <li>Click <b>Share → Download → PNG</b>. For many pages Canva gives you a <b>.zip</b>, which Tackly can open directly.</li>
            <li>In Tackly open <a href="#/app/bulk?mode=upload">Bulk → Upload finished pins</a>, drop the PNGs or the .zip, add the link, and let AI write the SEO copy.</li>
            <li>Click <b>Auto-schedule</b>. Done.</li>
          </ol>
          <a class="btn primary" href="#/app/bulk?mode=upload"><Icon name="upload" size={16} /> Upload Canva designs</a>
        </div>
        <div class="card stack">
          <span class="chip primary" style={{ alignSelf: 'flex-start' }}>Canva Pro & Teams</span>
          <h3 style={{ margin: 0 }}>Make 50 pins in 10 minutes</h3>
          <ol class="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Do keyword research in <a href="#/app/seo">Pinterest SEO</a> and save your keywords.</li>
            <li>Download the <b>CSV for Canva Bulk Create</b> below (one row per keyword).</li>
            <li>In Canva: <b>Apps → Bulk Create → Upload data</b>, then connect the <b>Title</b> column to your headline text box. Canva makes one page per keyword.</li>
            <li>Use your <b>Brand Kit</b> for fonts and colours, <b>Magic Resize</b> for other sizes, and <b>Background Remover</b> for product photos.</li>
            <li>Download all pages as PNG (.zip) and upload the zip in <a href="#/app/bulk?mode=upload">Bulk</a>. Tackly matches each file to its keyword by order or file name.</li>
          </ol>
          <div class="row"><button class="btn" onClick={() => download('tackly-canva-bulk-create.csv', csvText)}><Icon name="download" size={16} /> CSV for Canva Bulk Create</button><span class="small muted">{kws.length ? `${Math.min(50, kws.length)} saved keywords` : 'sample keywords (save your own in SEO)'}</span></div>
        </div>
      </div>
      <div class="card stack small">
        <b>Good to know</b>
        <ul class="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Tackly schedules your Canva designs whichever Canva plan you use, with Pinterest SEO built in.</li>
          <li>Tackly never asks for your Canva password. You simply export from Canva and upload here.</li>
          <li>Prefer to stay in Tackly? The built-in designer has 21 Pinterest templates with brand kit, AI images and free stock photos.</li>
        </ul>
      </div>
    </div>
  );
}

const TOOLS = [
  ['keyword_research', 'Pinterest keyword research for any topic'], ['seasonal_ideas', 'What to pin now for upcoming seasons'],
  ['page_info', 'Read your blog post: title, images, Rich Pins check'], ['write_pin_copy', 'SEO title, description, alt text'],
  ['create_design_pin', 'Design pins with Tackly templates'], ['create_image_pin', 'Pins from any image URL (Canva, AI, your blog)'],
  ['generate_image_url', 'Free AI images'], ['seo_score_pin', 'Score pins and fix weak spots'], ['list_boards / create_board', 'Manage boards'],
  ['auto_schedule', 'Spread pins at natural times (max 10/day)'], ['publish_now', 'Publish (safety limits apply)'], ['pin_stats', 'Impressions, saves, clicks'],
];

function Assistants() {
  const s = useStore();
  const engine = s.home?.mode === 'engine' ? api : null;
  const url = engine ? api.mcpUrl : 'https://YOUR-ENGINE.workers.dev/mcp/YOUR-ENGINE-KEY';
  const [client, setClient] = useState('claude');
  const configs = {
    claude: { name: 'Claude (claude.ai & desktop)', steps: [
      'Open Claude → Settings → Connectors → Add custom connector.',
      'Name it “Tackly” and paste your MCP URL below. Leave OAuth empty (the key is inside the URL).',
      'In a chat, enable the Tackly connector and ask for pins.'], code: url },
    claudecode: { name: 'Claude Code', steps: ['Run this once in your terminal:'], code: `claude mcp add --transport http tackly ${url}` },
    codex: { name: 'OpenAI Codex CLI', steps: ['Add this to ~/.codex/config.toml (uses the free mcp-remote bridge, needs Node.js):'], code: `[mcp_servers.tackly]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "${url}"]` },
    cursor: { name: 'Cursor / Windsurf / VS Code', steps: ['Add to your MCP settings JSON (e.g. ~/.cursor/mcp.json):'], code: JSON.stringify({ mcpServers: { tackly: { url } } }, null, 2) },
    chatgpt: { name: 'ChatGPT (developer mode)', steps: ['Settings → Apps & Connectors → Advanced → Developer mode on.', 'Create connector → MCP server URL: paste the URL below, authentication: none.'], code: url },
    other: { name: 'Any other MCP client', steps: ['Streamable HTTP endpoint (POST JSON-RPC). For stdio-only clients use: npx -y mcp-remote <url>'], code: url },
  };
  const c = configs[client];
  return (
    <div class="stack lg">
      <div class="card stack">
        <div class="row between"><h3 style={{ margin: 0 }}>Connect Claude, Codex, ChatGPT or any AI assistant</h3><span class="chip primary">MCP</span></div>
        <p class="muted" style={{ margin: 0 }}>Give your AI assistant Tackly superpowers: it can research keywords, read your blog posts, design pins with Tackly templates, write SEO copy, score pins and schedule them, all inside the safety limits.</p>
        {!engine && (
          <div class="notice warn small">AI assistants connect to <b>your own Tackly engine</b> (free on your Cloudflare account), so they work even when this app is closed and your data stays yours. <a href="#/app/settings">Set up your engine in Settings → Data home</a> (about 5 minutes), then come back here.</div>
        )}
        <div class="tabs" role="tablist">{Object.entries(configs).map(([k, v]) => <button key={k} class={client === k ? 'active' : ''} onClick={() => setClient(k)}>{v.name.split(' (')[0]}</button>)}</div>
        <b>{c.name}</b>
        <ol class="small" style={{ margin: 0, paddingLeft: 18 }}>{c.steps.map((x) => <li key={x}>{x}</li>)}</ol>
        <Code>{c.code}</Code>
        <div class="row"><Copy text={c.code} />{engine && <span class="small muted">Keep this URL private: it contains your engine key.</span>}</div>
      </div>
      <div class="grid-2" style={{ alignItems: 'start' }}>
        <div class="card stack">
          <b>What your AI can do</b>
          {TOOLS.map(([n, d]) => <div key={n} class="small row nowrap"><span class="kbd">{n}</span><span class="muted">{d}</span></div>)}
        </div>
        <div class="card stack">
          <b>Try these prompts</b>
          {[
            'Research Pinterest keywords for “budget bathroom makeover”, pick the best 5 long-tail keywords and explain why.',
            'Read https://myblog.com/post, then create 5 different Tackly design pins for it (different templates and headlines), each with SEO copy scoring 85+, and auto-schedule them over the next week at US peak times.',
            'What should I pin this month for my home decor niche? Use seasonal ideas and keyword research.',
            'Show my scheduled pins and fix any with a weak SEO score.',
          ].map((p) => <div key={p} class="row nowrap small" style={{ alignItems: 'flex-start' }}><span class="grow muted">“{p}”</span><Copy text={p} label="Copy" /></div>)}
          <p class="tiny faint" style={{ margin: 0 }}>Template pins created by AI are rendered into images the next time you open Tackly (Schedule → Drafts).</p>
        </div>
      </div>
    </div>
  );
}

export function Integrations({ query = {} }) {
  const [tab, setTab] = useState(query.tab || 'canva');
  return (
    <div class="stack lg">
      <div class="tabs" role="tablist" style={{ marginBottom: 0, maxWidth: 520 }}>
        <button class={tab === 'canva' ? 'active' : ''} onClick={() => setTab('canva')}>Canva</button>
        <button class={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>AI assistants (MCP)</button>
      </div>
      {tab === 'canva' ? <Canva /> : <Assistants />}
    </div>
  );
}
