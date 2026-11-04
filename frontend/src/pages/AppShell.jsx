import { Logo, Icon, ThemeToggle } from '../components.jsx';
import { useStore, setState, navigate } from '../lib/store.js';
import { api } from '../lib/api.js';
import { Dashboard } from './Dashboard.jsx';
import { Designer } from './Designer.jsx';
import { Bulk } from './Bulk.jsx';
import { Schedule } from './Schedule.jsx';
import { Accounts } from './Accounts.jsx';
import { Settings } from './Settings.jsx';
import { Admin } from './Admin.jsx';

const NAV = [
  ['/app', 'home', 'Home'],
  ['/app/design', 'design', 'Design'],
  ['/app/bulk', 'layers', 'Bulk'],
  ['/app/schedule', 'calendar', 'Schedule'],
  ['/app/accounts', 'link', 'Accounts'],
  ['/app/settings', 'settings', 'Settings'],
];

const TITLES = {
  '/app': 'Home', '/app/design': 'Pin designer', '/app/bulk': 'Bulk create', '/app/schedule': 'Schedule',
  '/app/accounts': 'Pinterest accounts', '/app/settings': 'Settings', '/app/admin': 'Owner dashboard', '/upgrade': 'Upgrade',
};

export function AppShell({ route, page }) {
  const s = useStore();
  const p = route.path;
  const nav = s.user?.isAdmin ? [...NAV, ['/app/admin', 'shield', 'Owner']] : NAV;
  let content = page;
  if (!content) {
    if (p === '/app/design') content = <Designer query={route.query} />;
    else if (p === '/app/bulk') content = <Bulk />;
    else if (p === '/app/schedule') content = <Schedule query={route.query} />;
    else if (p === '/app/accounts') content = <Accounts query={route.query} />;
    else if (p === '/app/settings') content = <Settings />;
    else if (p === '/app/admin') content = <Admin />;
    else content = <Dashboard />;
  }
  return (
    <div class="app">
      <aside class="sidebar">
        <Logo />
        {nav.map(([href, icon, label]) => (
          <a key={href} class={`nav-item ${p === href ? 'active' : ''}`} href={`#${href}`}><span class="ni"><Icon name={icon} /></span>{label}</a>
        ))}
        <div class="spacer" />
        <div class="plan-box stack" style={{ gap: 6 }}>
          <div class="row between"><b>{s.user?.plan?.name || 'Free'} plan</b><span class="chip ok">Active</span></div>
          <span class="muted tiny">{s.user?.usage?.accounts || 0} / {s.user?.plan?.maxAccounts || 1} Pinterest account</span>
          <a class="small" href="#/upgrade">Need more accounts?</a>
        </div>
        <div class="row" style={{ padding: '10px 4px 0' }}>
          <span class="tiny muted grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user?.email}</span>
          <ThemeToggle />
          <button class="btn icon ghost" title="Sign out" aria-label="Sign out" onClick={() => { api.logout(); setState({ user: null }); navigate('/'); }}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <div class="main">
        {s.mode === 'demo' && (
          <div class="demo-banner">
            <span class="chip warn">Demo mode</span>
            <span>The Tackly server is not connected yet. Everything works and is saved in this browser, but nothing is posted to Pinterest.</span>
          </div>
        )}
        {s.mode === 'remote' && s.health && !s.health.pinterestConfigured && (
          <div class="demo-banner"><span class="chip warn">Setup</span><span>The server is live but the Pinterest app keys are not added yet, so connecting Pinterest is disabled.</span></div>
        )}
        <div class="topbar">
          <h1>{TITLES[p] || 'Tackly'}</h1>
          <div class="grow" />
          <span class="mobile-only row" style={{ gap: 6 }}>
            <a class="btn primary sm" href="#/app/design"><Icon name="plus" size={16} /> New pin</a>
          </span>
        </div>
        <main class="page">{content}</main>
      </div>
      <nav class="bottom-nav" aria-label="App">
        {NAV.slice(0, 5).map(([href, icon, label]) => (
          <a key={href} class={p === href ? 'active' : ''} href={`#${href}`}><span class="ni"><Icon name={icon} size={20} /></span>{label}</a>
        ))}
        <a class={p === '/app/settings' ? 'active' : ''} href="#/app/settings"><span class="ni"><Icon name="settings" size={20} /></span>More</a>
      </nav>
    </div>
  );
}
