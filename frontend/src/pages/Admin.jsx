import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useStore, toast } from '../lib/store.js';
import { WAITLIST_FEATURES } from '../../../shared/plans.js';

const label = (id) => WAITLIST_FEATURES.find((f) => f.id === id)?.label || id;
const d = (ms) => (ms ? new Date(ms).toLocaleString() : '—');

export function Admin() {
  const s = useStore();
  const [data, setData] = useState(null);
  const load = () => api.admin().then(setData).catch((e) => { toast(e.message, 'error'); setData({ error: e.message }); });
  useEffect(() => { load(); }, []);
  if (!s.user?.isAdmin) return <div class="empty card">Owner only.</div>;
  if (!data) return <div class="skeleton" style={{ height: 300 }} />;
  if (data.error) return <div class="notice danger">{data.error}</div>;
  const t = data.totals || {};
  const maxDemand = Math.max(1, ...(data.demand || []).map((x) => x.n));
  return (
    <div class="stack lg">
      {data.demo && <div class="notice warn small">Demo mode: these numbers come from this browser only.</div>}
      <div class="stat-grid">
        <div class="stat"><div class="n">{t.users}</div><div class="l">Users ({t.users_7d} this week)</div></div>
        <div class="stat"><div class="n">{t.accounts}</div><div class="l">Pinterest connections</div></div>
        <div class="stat"><div class="n">{t.posted}</div><div class="l">Pins posted ({t.posted_7d} this week)</div></div>
        <div class="stat"><div class="n">{t.waitlist}</div><div class="l">Waitlist requests</div></div>
      </div>
      <div class="grid-2" style={{ alignItems: 'start' }}>
        <div class="card stack">
          <h3 style={{ margin: 0 }}>Paid feature demand</h3>
          {(data.demand || []).length ? data.demand.map((x) => (
            <div key={x.feature} class="stack" style={{ gap: 4 }}>
              <div class="row between small"><span>{label(x.feature)}</span><b>{x.n}</b></div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)' }}><div style={{ width: `${(x.n / maxDemand) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--primary)' }} /></div>
            </div>
          )) : <p class="muted small">No requests yet.</p>}
        </div>
        <div class="card stack">
          <h3 style={{ margin: 0 }}>Queue health</h3>
          <div class="row"><span class="chip primary">{t.scheduled} scheduled</span><span class={`chip ${t.failed ? 'danger' : 'ok'}`}>{t.failed} failed</span></div>
          <h4 class="small faint" style={{ margin: '8px 0 0' }}>Recent posting errors</h4>
          {(data.failures || []).length ? data.failures.slice(0, 10).map((f, i) => <div key={i} class="small"><span class="muted">{d(f.at)} · {f.email}</span><br />{f.message}</div>) : <p class="muted small">None 🎉</p>}
        </div>
      </div>
      <div class="card stack">
        <h3 style={{ margin: 0 }}>Users</h3>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Email</th><th>Plan</th><th>Accounts</th><th>Scheduled</th><th>Posted</th><th>Joined</th><th>Last login</th></tr></thead>
            <tbody>
              {(data.users || []).map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    {data.demo ? u.plan_id : (
                      <select value={u.plan_id} style={{ padding: '4px 8px' }} onChange={async (e) => { try { await api.setUserPlan(u.id, e.target.value); toast('Plan updated'); load(); } catch (err) { toast(err.message, 'error'); } }}>
                        {(data.plans || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td>{u.accounts}</td><td>{u.scheduled}</td><td>{u.posted}</td><td>{d(u.created_at)}</td><td>{d(u.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card stack">
        <h3 style={{ margin: 0 }}>Waitlist & feature requests</h3>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Email</th><th>Feature</th><th>Note</th><th>When</th></tr></thead>
            <tbody>{(data.waitlist || []).map((w, i) => <tr key={i}><td>{w.email}</td><td>{label(w.feature)}</td><td>{w.note}</td><td>{d(w.created_at)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
