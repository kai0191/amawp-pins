import { useEffect, useState } from 'preact/hooks';
import { Spinner, Icon } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, toast, navigate } from '../lib/store.js';
import { loadAccounts, resetAccountCaches, refreshMe } from '../lib/data.js';

export function Accounts({ query }) {
  const s = useStore();
  const [accounts, setAccounts] = useState(null);
  const [busy, setBusy] = useState(false);
  const plan = s.user?.plan || { maxAccounts: 1, name: 'Free' };

  const load = async () => {
    resetAccountCaches();
    try { setAccounts(await loadAccounts(true)); } catch (e) { toast(e.message, 'error'); setAccounts([]); }
  };
  useEffect(() => {
    load();
    if (query?.connected) { toast('Pinterest connected ✓', 'ok'); refreshMe().catch(() => {}); }
    if (query?.error) toast(`Pinterest: ${query.error}`, 'error', 8000);
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const url = await api.connectPinterest();
      location.href = url;
    } catch (e) {
      if (e.code === 'PLAN_LIMIT') navigate('/upgrade?reason=accounts');
      else toast(e.message, 'error', 8000);
      setBusy(false);
    }
  }

  async function addDemo() {
    try { await api.addDemoAccount(); toast('Demo account added', 'ok'); load(); refreshMe(); }
    catch (e) { if (e.code === 'PLAN_LIMIT') navigate('/upgrade?reason=accounts'); else toast(e.message, 'error'); }
  }

  async function remove(a) {
    if (!confirm(`Disconnect @${a.username}? Scheduled pins for this account will move back to drafts.`)) return;
    try { await api.removeAccount(a.id); toast('Disconnected'); load(); refreshMe(); } catch (e) { toast(e.message, 'error'); }
  }

  const atLimit = accounts && accounts.length >= plan.maxAccounts;
  return (
    <div class="stack lg" style={{ maxWidth: 820 }}>
      <div class="card stack">
        <div class="row between">
          <div>
            <h3 style={{ margin: 0 }}>Connected Pinterest accounts</h3>
            <p class="muted small" style={{ margin: 0 }}>{plan.name} plan: {accounts ? accounts.length : '…'} of {plan.maxAccounts} used</p>
          </div>
          <button class="btn primary" disabled={busy} onClick={atLimit ? () => navigate('/upgrade?reason=accounts') : connect}>
            {busy ? <Spinner /> : <><Icon name="plus" size={16} /> {atLimit ? 'Add another account' : 'Connect Pinterest'}</>}
          </button>
        </div>
        {accounts === null ? <div class="skeleton" style={{ height: 70 }} /> : accounts.length ? accounts.map((a) => (
          <div key={a.id} class="qitem">
            {a.profile_image ? <img src={a.profile_image} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} /> :
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', fontWeight: 800, color: 'var(--primary)' }}>{(a.username || '?')[0].toUpperCase()}</div>}
            <div class="meta">
              <div class="title">@{a.username || 'pinterest'}</div>
              <div class="small muted">Connected {new Date(a.created_at).toLocaleDateString()}</div>
            </div>
            <div class="actions">
              {a.status === 'reconnect' ? <button class="btn sm primary" onClick={connect}>Reconnect</button> : <span class={`chip ${a.status === 'demo' ? 'warn' : 'ok'}`}>{a.status === 'demo' ? 'Demo' : 'Active'}</span>}
              <button class="btn sm ghost" onClick={() => remove(a)}>Disconnect</button>
            </div>
          </div>
        )) : (
          <div class="empty">
            <div class="ico">📌</div>
            <p>Connect your Pinterest account to post and schedule pins.</p>
            {s.mode === 'demo' && <button class="btn" onClick={addDemo}>Add a demo account to try scheduling</button>}
          </div>
        )}
        {s.mode === 'demo' && <div class="notice warn small">Demo mode: real Pinterest connections need the Tackly server. The owner can switch it on by following docs/SETUP.md.</div>}
      </div>
      <div class="card stack">
        <h3 style={{ margin: 0 }}>What Tackly can do with your account</h3>
        <ul class="small muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Read your boards so you can pick where pins go, and create a new board when you ask.</li>
          <li>Publish the pins you design and schedule, and read stats for pins posted with Tackly.</li>
          <li>Your login tokens are encrypted. Disconnect any time here or in Pinterest settings.</li>
        </ul>
      </div>
    </div>
  );
}
