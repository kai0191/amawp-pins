import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import './styles.css';
import { initApi, api } from './lib/api.js';
import { useStore, setState, useRoute, navigate } from './lib/store.js';
import { setToken } from './lib/config.js';
import { Toasts, Spinner } from './components.jsx';
import { Landing } from './pages/Landing.jsx';
import { AuthPage } from './pages/Auth.jsx';
import { Legal } from './pages/Legal.jsx';
import { AppShell } from './pages/AppShell.jsx';
import { Upgrade } from './pages/Upgrade.jsx';

try {
  const t = localStorage.getItem('tackly.theme');
  if (t) document.documentElement.dataset.theme = t;
} catch { /* ignore */ }

function App() {
  const s = useStore();
  const route = useRoute();

  useEffect(() => {
    (async () => {
      // "Continue with Pinterest" returns here with a session token.
      const m = location.hash.match(/^#\/auth\?token=([^&]+)/);
      if (m) { setToken(decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname + location.search + '#/app'); }
      const res = await initApi();
      let user = null;
      try { user = await api.me(); } catch { /* ignore */ }
      setState({ mode: res.mode, health: res.health, attempted: res.attempted, user, ready: true });
      if (m) navigate('/app');
    })();
  }, []);

  if (!s.ready) {
    return <div class="auth-wrap"><div class="row muted"><Spinner /> Loading Tackly…</div></div>;
  }
  const p = route.path;
  if (p === '/' || p === '') return <Landing />;
  if (p === '/login' || p === '/signup') return <AuthPage mode={p.slice(1)} />;
  if (p === '/privacy' || p === '/terms' || p === '/data-deletion') return <Legal page={p.slice(1)} />;
  if (p === '/upgrade') return s.user ? <AppShell route={{ ...route, path: '/upgrade' }} page={<Upgrade query={route.query} />} /> : <Upgrade query={route.query} standalone />;
  if (p.startsWith('/app')) {
    if (!s.user) { setTimeout(() => navigate('/login'), 0); return null; }
    return <AppShell route={route} />;
  }
  return <Landing />;
}

function Root() {
  return <><App /><Toasts /></>;
}

render(<Root />, document.getElementById('app'));
