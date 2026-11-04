import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, userTz } from '../lib/store.js';
import { refreshMe } from '../lib/data.js';
import { fmtDateTime, relative } from '../lib/time.js';

export function Dashboard() {
  const s = useStore();
  const u = s.user;
  const tz = userTz(u);
  const [next, setNext] = useState(null);
  useEffect(() => {
    refreshMe().catch(() => {});
    api.pins().then((p) => setNext(p.filter((x) => x.status === 'scheduled').sort((a, b) => a.scheduled_at - b.scheduled_at).slice(0, 5))).catch(() => setNext([]));
  }, []);
  const usage = u?.usage || {};
  const steps = [
    ['Connect your Pinterest account', usage.accounts > 0, '#/app/accounts'],
    ['Set up your brand kit', !!u?.settings?.brandKit?.website || !!u?.settings?.brandKit?.logo, '#/app/settings'],
    ['Design your first pin', (usage.drafts || 0) + (usage.scheduled || 0) + (usage.posted || 0) > 0, '#/app/design'],
    ['Schedule a week of pins', (usage.scheduled || 0) >= 7 || (usage.posted || 0) >= 7, '#/app/schedule'],
  ];
  const done = steps.filter((x) => x[1]).length;
  return (
    <div class="stack lg">
      <div>
        <h2 style={{ marginBottom: 4 }}>Hi {u?.name || 'there'} 👋</h2>
        <p class="muted" style={{ margin: 0 }}>Here’s your Pinterest at a glance.</p>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="n">{usage.scheduled || 0}</div><div class="l">Scheduled</div></div>
        <div class="stat"><div class="n">{usage.posted || 0}</div><div class="l">Posted</div></div>
        <div class="stat"><div class="n">{usage.drafts || 0}</div><div class="l">Drafts</div></div>
        <div class="stat"><div class="n" style={{ color: usage.failed ? 'var(--danger)' : undefined }}>{usage.failed || 0}</div><div class="l">Need attention</div></div>
      </div>
      <div class="quick">
        <a href="#/app/design"><div class="ico">🎨</div><b>Design a pin</b><div class="small muted">Pick from 18 premium templates</div></a>
        <a href="#/app/bulk"><div class="ico">⚡</div><b>Bulk create</b><div class="small muted">Turn a list of links into pins</div></a>
        <a href="#/app/schedule?view=drafts"><div class="ico">🗓️</div><b>Auto-schedule</b><div class="small muted">Spread drafts over natural times</div></a>
      </div>
      <div class="grid-2" style={{ alignItems: 'start' }}>
        <div class="card stack">
          <div class="row between"><h3 style={{ margin: 0 }}>Getting started</h3><span class="chip primary">{done}/{steps.length}</span></div>
          {steps.map(([label, ok, href]) => (
            <a key={label} href={href} class="row nowrap" style={{ color: 'var(--text)', textDecoration: 'none' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', background: ok ? 'var(--ok)' : 'var(--surface-2)', color: '#fff', flex: 'none' }}>{ok ? <Icon name="check" size={14} /> : ''}</span>
              <span class="grow" style={{ textDecoration: ok ? 'line-through' : 'none', color: ok ? 'var(--muted)' : undefined }}>{label}</span>
              <span class="faint">›</span>
            </a>
          ))}
        </div>
        <div class="card stack">
          <div class="row between"><h3 style={{ margin: 0 }}>Up next</h3><a class="small" href="#/app/schedule?view=queue">View queue</a></div>
          {next === null ? <div class="skeleton" style={{ height: 120 }} /> : next.length ? next.map((p) => (
            <div key={p.id} class="row nowrap">
              {p.thumb && <img src={p.thumb} alt="" style={{ width: 34, height: 51, borderRadius: 6, objectFit: 'cover' }} />}
              <div class="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'Untitled pin'}</div>
                <div class="small muted">{fmtDateTime(p.scheduled_at, tz)} · {relative(p.scheduled_at)}</div>
              </div>
            </div>
          )) : <p class="muted small" style={{ margin: 0 }}>Nothing scheduled yet. <a href="#/app/design">Design a pin</a> to get started.</p>}
        </div>
      </div>
    </div>
  );
}
