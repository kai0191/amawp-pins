import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, userTz } from '../lib/store.js';
import { refreshMe, loadAccounts } from '../lib/data.js';
import { fmtDateTime, relative } from '../lib/time.js';
import { seasonsToPinNow, RANKING_TIPS } from '../../../shared/seo.js';
import { DAILY_PIN_LIMIT } from '../../../shared/limits.js';

export function Dashboard() {
  const s = useStore();
  const tz = userTz();
  const [next, setNext] = useState(null);
  const [quota, setQuota] = useState(null);
  useEffect(() => {
    refreshMe().catch(() => {});
    api.pins().then((p) => setNext(p.filter((x) => x.status === 'scheduled').sort((a, b) => a.scheduled_at - b.scheduled_at).slice(0, 5))).catch(() => setNext([]));
    loadAccounts().then((a) => a[0] && api.quota(a[0].id)).then((q) => q && setQuota(q)).catch(() => {});
  }, []);
  const o = s.overview || {};
  const seasons = seasonsToPinNow().slice(0, 3);
  const tip = RANKING_TIPS[new Date().getDate() % RANKING_TIPS.length];
  const steps = [
    ['Connect your Pinterest account', o.accounts > 0, '#/app/accounts'],
    ['Set up your brand kit', !!(s.profile?.brandKit?.website || s.profile?.brandKit?.logo), '#/app/settings'],
    ['Find keywords for your niche', !!localStorage.getItem('tackly.pref.seoKeywords'), '#/app/seo'],
    ['Design your first pin', (o.drafts || 0) + (o.scheduled || 0) + (o.posted || 0) > 0, '#/app/design'],
    ['Schedule a week of pins', (o.scheduled || 0) >= 7 || (o.posted || 0) >= 7, '#/app/schedule'],
  ];
  const done = steps.filter((x) => x[1]).length;
  return (
    <div class="stack lg">
      <div>
        <h2 style={{ marginBottom: 4 }}>{s.profile?.name ? `Hi ${s.profile.name} 👋` : 'Welcome to Tackly 👋'}</h2>
        <p class="muted" style={{ margin: 0 }}>Design pins people search for, then let Tackly post them at natural times.</p>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="n">{o.scheduled || 0}</div><div class="l">Scheduled</div></div>
        <div class="stat"><div class="n">{o.posted || 0}</div><div class="l">Posted</div></div>
        <div class="stat"><div class="n">{o.drafts || 0}</div><div class="l">Drafts</div></div>
        <div class="stat"><div class="n">{quota ? `${quota.used}/${quota.limit}` : `0/${DAILY_PIN_LIMIT}`}</div><div class="l">Published in last 24h</div></div>
      </div>
      {o.needs_render > 0 && <div class="notice">🤖 {o.needs_render} AI-designed pin{o.needs_render > 1 ? 's are' : ' is'} waiting to be rendered. <a href="#/app/schedule?view=drafts">Render now</a></div>}
      <div class="quick">
        <a href="#/app/design"><div class="ico">🎨</div><b>Design a pin</b><div class="small muted">21 premium templates, all free</div></a>
        <a href="#/app/seo"><div class="ico">🔎</div><b>Keyword research</b><div class="small muted">Find what people search on Pinterest</div></a>
        <a href="#/app/bulk"><div class="ico">⚡</div><b>Bulk create</b><div class="small muted">Links, CSV or Canva exports → pins</div></a>
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
      <div class="grid-2" style={{ alignItems: 'start' }}>
        <div class="card stack">
          <h3 style={{ margin: 0 }}>Pin these now 📅</h3>
          <p class="small muted" style={{ margin: 0 }}>Pinterest users search 1–3 months ahead. These seasons are open right now:</p>
          {seasons.map((x) => (
            <div key={x.name} class="stack" style={{ gap: 4 }}>
              <div class="row between"><b>{x.name}</b><span class={`chip ${x.urgency === 'last call' ? 'danger' : x.urgency === 'now' ? 'warn' : 'primary'}`}>{x.daysUntil} days</span></div>
              <div class="row" style={{ gap: 6 }}>{x.keywords.map((k) => <a key={k} class="chip" href={`#/app/seo?q=${encodeURIComponent(k)}`}>{k}</a>)}</div>
            </div>
          ))}
        </div>
        <div class="card stack">
          <h3 style={{ margin: 0 }}>Today’s Pinterest SEO tip 💡</h3>
          <b>{tip[0]}</b>
          <p class="muted small" style={{ margin: 0 }}>{tip[1]}</p>
          <a class="small" href="#/app/seo?tab=secrets">See all ranking tips →</a>
        </div>
      </div>
    </div>
  );
}
