import { useState } from 'preact/hooks';
import { Spinner } from '../components.jsx';
import { api } from '../lib/api.js';
import { toast } from '../lib/store.js';

// Owner-only aggregate stats from the relay. Users' content is never stored there, so these are totals only.
export function Owner() {
  const [key, setKey] = useState(() => { try { return sessionStorage.getItem('tackly.ownerKey') || ''; } catch { return ''; } });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load(e) {
    e && e.preventDefault();
    if (!api.relay) { toast('The Tackly server is not reachable.', 'error'); return; }
    setBusy(true);
    try { setData(await api.relay.ownerStats(key)); try { sessionStorage.setItem('tackly.ownerKey', key); } catch { /* ignore */ } }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }
  const byDay = {};
  for (const r of data?.days || []) (byDay[r.day] ||= {})[r.metric] = r.n;
  const total = (m) => (data?.days || []).filter((r) => r.metric === m).reduce((a, r) => a + r.n, 0);
  return (
    <div class="stack lg" style={{ maxWidth: 900 }}>
      <form class="card stack" onSubmit={load}>
        <h3 style={{ margin: 0 }}>Owner stats</h3>
        <p class="small muted" style={{ margin: 0 }}>Aggregate totals from your relay (no user data is stored). Enter the ADMIN_KEY secret you set in GitHub.</p>
        <div class="row nowrap"><input type="password" value={key} onInput={(e) => setKey(e.target.value)} placeholder="Owner key" /><button class="btn primary" disabled={busy}>{busy ? <Spinner /> : 'Load'}</button></div>
      </form>
      {data && (
        <>
          <div class="stat-grid">
            <div class="stat"><div class="n">{data.activeAccounts24h}</div><div class="l">Accounts that posted (24h)</div></div>
            <div class="stat"><div class="n">{total('pins')}</div><div class="l">Pins published (30 days)</div></div>
            <div class="stat"><div class="n">{total('connects')}</div><div class="l">Pinterest connects (30 days)</div></div>
            <div class="stat"><div class="n">{total('pin_errors')}</div><div class="l">Rejected by Pinterest (30 days)</div></div>
          </div>
          <div class="card">
            <table class="data"><thead><tr><th>Day</th><th>Connects</th><th>Pins</th><th>Errors</th></tr></thead>
              <tbody>{Object.entries(byDay).map(([d, m]) => <tr key={d}><td>{d}</td><td>{m.connects || 0}</td><td>{m.pins || 0}</td><td>{m.pin_errors || 0}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
