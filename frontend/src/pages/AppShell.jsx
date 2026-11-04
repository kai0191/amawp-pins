import { Logo, Icon, ThemeToggle } from '../components.jsx';
import { useStore } from '../lib/store.js';
import { Dashboard } from './Dashboard.jsx';
import { Designer } from './Designer.jsx';
import { Bulk } from './Bulk.jsx';
import { Schedule } from './Schedule.jsx';
import { Accounts } from './Accounts.jsx';
import { Settings } from './Settings.jsx';
import { Seo } from './Seo.jsx';
import { Integrations } from './Integrations.jsx';
import { Owner } from './Owner.jsx';
import { DAILY_PIN_LIMIT } from '../../../shared/limits.js';

const NAV = [
  ['/app', 'home', 'Home'],
  ['/app/design', 'design', 'Design'],
  ['/app/bulk', 'layers', 'Bulk'],
  ['/app/schedule', 'calendar', 'Schedule'],
  ['/app/seo', 'chart', 'Pinterest SEO'],
  ['/app/integrations', 'sparkle', 'Canva & AI'],
  ['/app/accounts', 'link', 'Accounts'],
  ['/app/settings', 'settings', 'Settings'],
];
const MOBILE = [['/app', 'home', 'Home'], ['/app/design', 'design', 'Design'], ['/app/schedule', 'calendar', 'Schedule'], ['/app/seo', 'chart', 'SEO']];

const TITLES = {
  '/app': 'Home', '/app/design': 'Pin designer', '/app/bulk': 'Bulk create', '/app/schedule': 'Schedule', '/app/seo': 'Pinterest SEO',
  '/app/integrations': 'Canva & AI assistants', '/app/accounts': 'Pinterest account', '/app/settings': 'Settings', '/app/owner': 'Owner stats',
};

export function AppShell({ route }) {
  const s = useStore();
  const p = route.path;
  const pages = {
    '/app/design': <Designer query={route.query} />, '/app/bulk': <Bulk query={route.query} />, '/app/schedule': <Schedule query={route.query} />,
    '/app/seo': <Seo query={route.query} />, '/app/integrations': <Integrations query={route.query} />, '/app/accounts': <Accounts query={route.query} />,
    '/app/settings': <Settings />, '/app/owner': <Owner />,
  };
  const content = pages[p] || <Dashboard />;
  const home = s.home?.mode === 'engine' ? 'Your Cloudflare engine' : 'This browser';
  return (
    <div class="app">
      <aside class="sidebar">
        <Logo />
        {NAV.map(([href, icon, label]) => (
          <a key={href} class={`nav-item ${p === href ? 'active' : ''}`} href={`#${href}`}><span class="ni"><Icon name={icon} /></span>{label}</a>
        ))}
        <div class="spacer" />
        <div class="plan-box stack" style={{ gap: 6 }}>
          <div class="row between"><b>Free</b><span class="chip ok">Active</span></div>
          <span class="muted tiny">Data home: {home}</span>
          <span class="muted tiny">Safety limit: {DAILY_PIN_LIMIT} pins / day per account</span>
          <a class="small" href="#/app/settings">Data & privacy</a>
        </div>
        <div class="row" style={{ padding: '10px 4px 0' }}>
          <span class="tiny muted grow">{s.profile?.name ? `Hi, ${s.profile.name}` : 'Tackly by AMAWP'}</span>
          <ThemeToggle />
        </div>
      </aside>
      <div class="main">
        {!s.relay && (
          <div class="demo-banner"><span class="chip warn">Preview</span><span>The Tackly server is not reachable, so Pinterest posting and keyword research are paused. Designing, saving and planning all work.</span></div>
        )}
        {s.relay && s.health && !s.health.pinterestConfigured && (
          <div class="demo-banner"><span class="chip warn">Setup</span><span>Pinterest connection is not switched on for this server yet. You can still design and plan pins with a preview account.</span></div>
        )}
        {s.engineError && (
          <div class="demo-banner" style={{ background: 'var(--danger-soft)' }}><span class="chip danger">Engine offline</span><span>Your Cloudflare engine did not answer: {s.engineError}. <a href="#/app/settings">Check Data home</a>.</span></div>
        )}
        {s.home?.mode !== 'engine' && s.relay && p === '/app/schedule' && (
          <div class="demo-banner"><span class="chip">Browser mode</span><span>Scheduled pins post while Tackly is open in a tab. <a href="#/app/settings">Connect your free Cloudflare engine</a> to post 24/7.</span></div>
        )}
        <div class="topbar">
          <h1>{TITLES[p] || 'Tackly'}</h1>
          <div class="grow" />
          <a class="btn primary sm" href="#/app/design"><Icon name="plus" size={16} /> New pin</a>
        </div>
        <main class="page">{content}</main>
      </div>
      <nav class="bottom-nav" aria-label="App">
        {MOBILE.map(([href, icon, label]) => (
          <a key={href} class={p === href ? 'active' : ''} href={`#${href}`}><span class="ni"><Icon name={icon} size={20} /></span>{label}</a>
        ))}
        <a class={['/app/settings', '/app/integrations', '/app/accounts', '/app/bulk'].includes(p) ? 'active' : ''} href="#/app/settings"><span class="ni"><Icon name="settings" size={20} /></span>More</a>
      </nav>
    </div>
  );
}
