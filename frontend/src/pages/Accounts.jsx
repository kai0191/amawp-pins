import { useEffect, useState } from 'preact/hooks';
import { Spinner, Icon } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, toast } from '../lib/store.js';
import { loadAccounts, resetAccountCaches, refreshMe } from '../lib/data.js';
import { DAILY_PIN_LIMIT, MIN_GAP_MINUTES, MAX_PINTEREST_ACCOUNTS } from '../../../shared/limits.js';

export function Accounts({ query }) {
  const s = useStore();
  const [accounts, setAccounts] = useState(null);
  const [quotas, setQuotas] = useState({});
  const [busy, setBusy] = useState(false);
  const canConnect = s.relay && s.health?.pinterestConfigured;

  const load = async () => {
    resetAccountCaches();
    try {
      const list = await loadAccounts(true);
      setAccounts(list);
      for (const a of list) if (!a.demo) api.quota(a.id).then((q) => q && setQuotas((x) => ({ ...x, [a.id]: q }))).catch(() => {});
    } catch (e) { toast(e.message, 'error'); setAccounts([]); }
  };
  useEffect(() => { load(); if (query?.error) toast(`Pinterest: ${query.error}`, 'error', 8000); }, []);

  async function connect() {
    setBusy(true);
    try { location.href = await api.relay.connectUrl(); }
    catch (e) { toast(e.message, 'error', 8000); setBusy(false); }
  }
  async function addPreview() {
    try {
      await api.addAccount({ sealed: 'preview', username: 'preview_account', demo: true });
      const a = (await api.accounts())[0];
      for (const n of ['Home Decor Ideas', 'Easy Recipes', 'Travel Tips', 'DIY Projects']) await api.createBoard(a.id, { name: n });
      toast('Preview account added', 'ok'); load(); refreshMe();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function remove(a) {
    if (!confirm(`Disconnect @${a.username}? Scheduled pins move back to drafts. You can also revoke Tackly in Pinterest settings.`)) return;
    try { await api.removeAccount(a.id); toast('Disconnected'); load(); refreshMe(); } catch (e) { toast(e.message, 'error'); }
  }

  const full = accounts && accounts.length >= MAX_PINTEREST_ACCOUNTS;
  return (
    <div class="stack lg" style={{ maxWidth: 820 }}>
      <div class="card stack">
        <div class="row between">
          <div>
            <h3 style={{ margin: 0 }}>Pinterest account</h3>
            <p class="muted small" style={{ margin: 0 }}>Connect {MAX_PINTEREST_ACCOUNTS} Pinterest account to this workspace.</p>
          </div>
          {!full && <button class="btn primary" disabled={busy || !canConnect} onClick={connect}>{busy ? <Spinner /> : <><Icon name="plus" size={16} /> Connect Pinterest</>}</button>}
        </div>
        {accounts === null ? <div class="skeleton" style={{ height: 70 }} /> : accounts.length ? accounts.map((a) => (
          <div key={a.id} class="qitem">
            {a.profile_image ? <img src={a.profile_image} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} /> :
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center', fontWeight: 800, color: 'var(--primary)' }}>{(a.username || '?')[0].toUpperCase()}</div>}
            <div class="meta">
              <div class="title">@{a.username || 'pinterest'}</div>
              <div class="small muted">{a.demo ? 'Preview only: nothing is sent to Pinterest' : quotas[a.id] ? `${quotas[a.id].used} of ${quotas[a.id].limit} pins published in the last 24 hours` : `Connected ${new Date(a.created_at).toLocaleDateString()}`}</div>
            </div>
            <div class="actions">
              {a.status === 'reconnect' ? <button class="btn sm primary" onClick={connect}>Reconnect</button> : <span class={`chip ${a.demo ? 'warn' : 'ok'}`}>{a.demo ? 'Preview' : 'Active'}</span>}
              <button class="btn sm ghost" onClick={() => remove(a)}>Disconnect</button>
            </div>
          </div>
        )) : (
          <div class="empty">
            <div class="ico">📌</div>
            <p>{canConnect ? 'Connect your Pinterest account to publish and schedule pins.' : 'Pinterest connection is not switched on for this server yet.'}</p>
            {!canConnect && <button class="btn" onClick={addPreview}>Add a preview account to try scheduling</button>}
          </div>
        )}
      </div>
      <div class="card stack">
        <h3 style={{ margin: 0 }}>Account safety</h3>
        <ul class="small muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Tackly publishes at most <b>{DAILY_PIN_LIMIT} pins per account in any 24 hours</b>, at least {MIN_GAP_MINUTES} minutes apart, at natural random times. Pinterest rewards steady, fresh pinning and flags bursts as spam.</li>
          <li>You can store thousands of drafts and scheduled pins; extra pins simply wait for the next safe slot.</li>
          <li>Your Pinterest login is sealed (encrypted) and stored only in your data home ({s.home?.mode === 'engine' ? 'your Cloudflare engine' : 'this browser'}). AMAWP’s server keeps no copy.</li>
          <li>Tackly can read your boards, create boards you ask for, publish your pins and read stats for those pins. Revoke access any time in Pinterest → Settings → Security → Apps.</li>
        </ul>
      </div>
    </div>
  );
}
