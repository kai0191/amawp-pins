import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import './styles.css';
import { initApi, api } from './lib/api.js';
import { useStore, setState, useRoute, navigate, toast } from './lib/store.js';
import { refreshMe, resetAccountCaches } from './lib/data.js';
import { Toasts, Spinner } from './components.jsx';
import { Landing } from './pages/Landing.jsx';
import { Legal } from './pages/Legal.jsx';
import { AppShell } from './pages/AppShell.jsx';

try {
  const t = localStorage.getItem('tackly.theme');
  if (t) document.documentElement.dataset.theme = t;
} catch { /* ignore */ }

/** Pinterest returns here (#/connected?sealed=...) after the user approves Tackly. */
async function finishConnect() {
  const m = location.hash.match(/^#\/connected\?(.*)$/);
  if (!m) return false;
  const q = new URLSearchParams(m[1]);
  history.replaceState(null, '', `${location.pathname}${location.search}#/app/accounts`);
  try {
    await api.addAccount({ sealed: q.get('sealed'), username: q.get('u'), profile_image: q.get('img') });
    resetAccountCaches();
    toast(`Pinterest @${q.get('u')} connected ✓`, 'ok');
  } catch (e) { toast(e.message, 'error', 8000); }
  navigate('/app/accounts');
  return true;
}

function App() {
  const s = useStore();
  const route = useRoute();

  useEffect(() => {
    (async () => {
      const res = await initApi();
      setState({ relay: res.relay, health: res.health, home: res.home, engineError: res.engineError });
      try { await refreshMe(); } catch { /* engine offline */ }
      await finishConnect();
      setState({ ready: true });
    })();
    // Browser data home: post due pins while Tackly is open (the engine does this 24/7 on its own).
    const t = setInterval(() => { if (getReady()) api.runDue().catch(() => {}); }, 60000);
    return () => clearInterval(t);
  }, []);

  if (!s.ready) return <div class="auth-wrap"><div class="row muted"><Spinner /> Loading Tackly…</div></div>;
  const p = route.path;
  if (p === '/privacy' || p === '/terms' || p === '/data-deletion') return <Legal page={p.slice(1)} />;
  if (p === '/login' || p === '/signup' || p === '/upgrade') { setTimeout(() => navigate('/app'), 0); return null; }
  if (p.startsWith('/app')) return <AppShell route={route} />;
  return <Landing />;
}
const getReady = () => document.readyState === 'complete';

document.getElementById('seo-static')?.remove();
render(<><App /><Toasts /></>, document.getElementById('app'));
