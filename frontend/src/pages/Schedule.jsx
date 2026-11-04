import { useEffect, useMemo, useState } from 'preact/hooks';
import { Icon, Spinner, Modal, StatusChip } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, toast, userTz, pref, setPref } from '../lib/store.js';
import { useBoards, useAccounts, refreshMe } from '../lib/data.js';
import { autoSchedule as planSchedule, PRESETS } from '../../../shared/scheduler.js';
import { ymd, zonedParts, zonedToUtc, addDaysYmd } from '../../../shared/tz.js';
import { fmtDateTime, fmtTime, fmtDay, toLocalInput, fromLocalInput, relative } from '../lib/time.js';
import { AccountBoardPicker } from './PublishDialog.jsx';
import { DAILY_PIN_LIMIT } from '../../../shared/limits.js';
import { renderDesign, jpegBase64, thumbnailDataUrl } from '../designer/render.js';
import { brandKit } from '../lib/data.js';

let renderingNow = false;
/** Render AI-created template designs (from MCP) into real pin images. */
async function renderPending(pins, onProgress) {
  if (renderingNow) return 0;
  renderingNow = true;
  try {
  const todo = pins.filter((p) => p.design_json);
  let done = 0;
  for (const p of todo) {
    try {
      const design = JSON.parse(p.design_json);
      const c = document.createElement('canvas');
      await renderDesign(c, design, { logo: brandKit().logo });
      await api.setPinImage(p.id, { image: jpegBase64(c, 0.9), thumb: thumbnailDataUrl(c) });
      done++; onProgress && onProgress(done, todo.length);
    } catch (e) { console.warn('render failed', p.id, e); }
  }
  return done;
  } finally { renderingNow = false; }
}

/** Auto-schedule settings form, used here and in Bulk mode. */
export function AutoScheduleForm({ tz, accountId, defaultBoardId, onSubmit, busy, count, submitLabel, pinsForPreview }) {
  const saved = pref('autoSchedule', { preset: 'us_peak', minPerDay: 3, maxPerDay: 6, start: 9, end: 21 });
  const [preset, setPreset] = useState(saved.preset);
  const [minPerDay, setMin] = useState(saved.minPerDay);
  const [maxPerDay, setMax] = useState(saved.maxPerDay);
  const [start, setStart] = useState(saved.start);
  const [end, setEnd] = useState(saved.end);
  const [startDate, setStartDate] = useState(ymd(Date.now(), tz));
  const [boardSel, setBoardSel] = useState([]);
  const [preview, setPreview] = useState(null);
  const { boards } = useBoards(accountId);

  useEffect(() => { if (defaultBoardId && !boardSel.length) setBoardSel([defaultBoardId]); }, [defaultBoardId]);

  const custom = preset === 'custom';
  const p = PRESETS[preset];
  const windows = custom ? [[+start, +end]] : p.windows;
  const zone = custom || !p.timezone ? tz : p.timezone;

  function opts() {
    setPref('autoSchedule', { preset, minPerDay: +minPerDay, maxPerDay: +maxPerDay, start: +start, end: +end });
    const boardIds = boardSel.length ? boardSel : defaultBoardId ? [defaultBoardId] : [];
    const boardNames = Object.fromEntries((boards || []).filter((b) => boardIds.includes(b.id)).map((b) => [b.id, b.name]));
    return { minPerDay: +minPerDay, maxPerDay: Math.max(+minPerDay, +maxPerDay), windows, timezone: zone, startDate, boardIds, boardNames };
  }

  function doPreview() {
    const o = opts();
    const pins = pinsForPreview || Array.from({ length: count || 10 }, (_, i) => ({ id: `x${i}`, link: '' }));
    const plan = planSchedule(pins.map((x) => ({ ...x, boardIds: o.boardIds })), o);
    setPreview(plan.slice(0, 40));
  }

  return (
    <div class="card flat stack" style={{ background: 'var(--surface-2)' }}>
      <div class="row between"><b>Auto-schedule</b><span class="chip primary">Natural random times</span></div>
      <div class="grid-3">
        <label class="field">Timing
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {Object.values(PRESETS).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            <option value="custom">Custom hours</option>
          </select>
        </label>
        <label class="field">Pins per day (min)<input type="number" min="1" max={DAILY_PIN_LIMIT} value={minPerDay} onInput={(e) => setMin(e.target.value)} /></label>
        <label class="field">Pins per day (max)<input type="number" min="1" max={DAILY_PIN_LIMIT} value={maxPerDay} onInput={(e) => setMax(e.target.value)} /></label>
      </div>
      {custom && (
        <div class="grid-3">
          <label class="field">Active from (hour)<input type="number" min="0" max="23" value={start} onInput={(e) => setStart(e.target.value)} /></label>
          <label class="field">Active until (hour)<input type="number" min="1" max="24" value={end} onInput={(e) => setEnd(e.target.value)} /></label>
          <label class="field">Start date<input type="date" value={startDate} onInput={(e) => setStartDate(e.target.value)} /></label>
        </div>
      )}
      <p class="tiny faint" style={{ margin: 0 }}>Safety: max {DAILY_PIN_LIMIT} pins per account per day, never the same link twice in a day, random natural times.</p>
      {!custom && (
        <div class="grid-2">
          <label class="field">Start date<input type="date" value={startDate} onInput={(e) => setStartDate(e.target.value)} /></label>
          <div class="small muted" style={{ alignSelf: 'end' }}>{p.windows.map(([a, b]) => `${a}:00–${b}:00`).join(' and ')} {p.timezone ? `(${p.timezone.replace('_', ' ')})` : `(${tz})`}</div>
        </div>
      )}
      {boards && boards.length > 1 && (
        <div class="stack" style={{ gap: 6 }}>
          <span class="field">Spread across boards (the same link never repeats on a board back-to-back)</span>
          <div class="row" style={{ gap: 6 }}>
            {boards.map((b) => (
              <button key={b.id} type="button" class={`chip ${boardSel.includes(b.id) ? 'primary' : ''}`} style={{ cursor: 'pointer', border: 0 }}
                onClick={() => setBoardSel((sel) => sel.includes(b.id) ? sel.filter((x) => x !== b.id) : [...sel, b.id])}>
                {boardSel.includes(b.id) ? '✓ ' : ''}{b.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div class="row">
        <button class="btn ghost sm" type="button" onClick={doPreview}>Preview times</button>
        <button class="btn primary" type="button" disabled={busy || !count} onClick={() => onSubmit(opts())}>{busy ? <Spinner /> : <><Icon name="shuffle" size={16} /> {submitLabel || `Auto-schedule ${count} pins`}</>}</button>
      </div>
      {preview && (
        <div class="small" style={{ maxHeight: 180, overflowY: 'auto' }}>
          {preview.length ? preview.map((x, i) => <div key={i} class="muted">{fmtDateTime(x.scheduledAt, tz)}</div>) : <span class="muted">No slots found. Widen the hours.</span>}
        </div>
      )}
    </div>
  );
}

function PinEditor({ pin, tz, onClose, onChanged }) {
  const [title, setTitle] = useState(pin.title || '');
  const [description, setDescription] = useState(pin.description || '');
  const [link, setLink] = useState(pin.link || '');
  const [altText, setAltText] = useState(pin.alt_text || '');
  const [accountId, setAccountId] = useState(pin.account_id);
  const [boardId, setBoardId] = useState(pin.board_id);
  const [boardName, setBoardName] = useState(pin.board_name);
  const [at, setAt] = useState(toLocalInput(pin.scheduled_at || Date.now() + 3600000, tz));
  const [busy, setBusy] = useState('');
  const [stats, setStats] = useState(null);
  const posted = pin.status === 'posted';

  async function act(kind) {
    setBusy(kind);
    try {
      if (kind === 'save' || kind === 'schedule') {
        const scheduledAt = fromLocalInput(at, tz);
        if (kind === 'schedule' && scheduledAt < Date.now()) throw new Error('Pick a time in the future.');
        await api.updatePin(pin.id, { title, description, link, altText, accountId, boardId, boardName, scheduledAt, status: kind === 'schedule' || pin.status === 'scheduled' || pin.status === 'failed' ? 'scheduled' : 'draft' });
        toast('Pin saved ✓', 'ok');
      } else if (kind === 'now') {
        await api.updatePin(pin.id, { title, description, link, altText, accountId, boardId, boardName, status: 'draft' });
        const r = await api.postNow(pin.id);
        if (r.result?.status === 'posted') toast('Posted ✓', 'ok'); else toast(`Not posted: ${r.result?.error || 'error'}`, 'error', 7000);
      } else if (kind === 'delete') {
        if (!confirm('Delete this pin?')) { setBusy(''); return; }
        await api.deletePin(pin.id);
        toast('Pin deleted');
      } else if (kind === 'draft') {
        await api.updatePin(pin.id, { status: 'draft' });
        toast('Moved to drafts');
      } else if (kind === 'stats') {
        const r = await api.pinStats(pin.id);
        setStats(r.stats || {});
        setBusy(''); return;
      }
      onChanged(); onClose();
    } catch (e) { toast(e.message, 'error', 6000); } finally { setBusy(''); }
  }

  return (
    <Modal title={posted ? 'Posted pin' : 'Edit pin'} onClose={onClose} wide>
      <div class="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        {pin.thumb && <img src={pin.thumb} alt="" style={{ width: 150, borderRadius: 14, boxShadow: 'var(--shadow)' }} />}
        <div class="stack grow" style={{ minWidth: 260 }}>
          <div class="row"><StatusChip status={pin.status} />{pin.scheduled_at && <span class="small muted">{fmtDateTime(pin.scheduled_at, tz)}</span>}</div>
          {pin.last_error && <div class="notice danger small"><b>Last error:</b> {pin.last_error}</div>}
          {posted ? (
            <div class="stack">
              <b>{pin.title}</b>
              <span class="small muted">{pin.board_name}</span>
              {pin.pinterest_pin_id && <a class="btn sm ghost" target="_blank" rel="noopener" href={`https://www.pinterest.com/pin/${pin.pinterest_pin_id}/`}>View on Pinterest ↗</a>}
              <button class="btn sm" disabled={!!busy} onClick={() => act('stats')}>{busy === 'stats' ? <Spinner /> : <><Icon name="chart" size={16} /> Load stats</>}</button>
              {stats && (
                <div class="grid-2">
                  {['IMPRESSION', 'SAVE', 'PIN_CLICK', 'OUTBOUND_CLICK'].map((k) => (
                    <div key={k} class="stat"><div class="n">{stats[k] ?? 0}</div><div class="l">{k.replace('_', ' ').toLowerCase()}</div></div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <label class="field">Title<input type="text" maxLength={100} value={title} onInput={(e) => setTitle(e.target.value)} /></label>
              <label class="field">Description<textarea rows={3} maxLength={800} value={description} onInput={(e) => setDescription(e.target.value)} /></label>
              <div class="grid-2">
                <label class="field">Link<input type="url" value={link} onInput={(e) => setLink(e.target.value)} /></label>
                <label class="field">Alt text<input type="text" value={altText} onInput={(e) => setAltText(e.target.value)} /></label>
              </div>
              <AccountBoardPicker accountId={accountId} setAccountId={setAccountId} boardId={boardId} setBoardId={setBoardId} setBoardName={setBoardName} />
              <label class="field">Date and time ({tz})<input type="datetime-local" value={at} onInput={(e) => setAt(e.target.value)} /></label>
              <div class="row">
                <button class="btn primary" disabled={!!busy} onClick={() => act('schedule')}>{busy === 'schedule' ? <Spinner /> : pin.status === 'scheduled' ? 'Save & reschedule' : 'Schedule'}</button>
                <button class="btn" disabled={!!busy} onClick={() => act('now')}>{busy === 'now' ? <Spinner /> : <><Icon name="send" size={16} /> Post now</>}</button>
                {pin.status === 'scheduled' && <button class="btn ghost" disabled={!!busy} onClick={() => act('draft')}>Unschedule</button>}
                <button class="btn danger" disabled={!!busy} onClick={() => act('delete')}><Icon name="trash" size={16} /> Delete</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Calendar({ pins, tz, onOpen, onMove }) {
  const today = ymd(Date.now(), tz);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [dropDay, setDropDay] = useState(null);
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sunday
  const startDay = addDaysYmd(first, -firstDow);
  const days = Array.from({ length: 42 }, (_, i) => addDaysYmd(startDay, i));
  const byDay = useMemo(() => {
    const map = {};
    for (const p of pins) if (p.scheduled_at || p.posted_at) {
      const d = ymd(p.status === 'posted' ? p.posted_at || p.scheduled_at : p.scheduled_at, tz);
      (map[d] ||= []).push(p);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => (a.scheduled_at || 0) - (b.scheduled_at || 0));
    return map;
  }, [pins, tz]);
  const shift = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); };
  const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
  return (
    <div class="stack">
      <div class="row between">
        <div class="row"><button class="btn sm ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button><b style={{ minWidth: 150, textAlign: 'center' }}>{label}</b><button class="btn sm ghost" onClick={() => shift(1)} aria-label="Next month">›</button></div>
        <button class="btn sm ghost" onClick={() => setMonth(today.slice(0, 7))}>Today</button>
      </div>
      <div class="cal">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} class="dow">{d}</div>)}
        {days.map((d) => (
          <div key={d} class={`day ${d.slice(0, 7) !== month ? 'other' : ''} ${d === today ? 'today' : ''} ${dropDay === d ? 'drop' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDropDay(d); }} onDragLeave={() => setDropDay(null)}
            onDrop={(e) => { e.preventDefault(); setDropDay(null); const id = e.dataTransfer.getData('text/plain'); if (id) onMove(id, d); }}>
            <span class="dnum">{+d.slice(8)}</span>
            {(byDay[d] || []).slice(0, 4).map((p) => (
              <button key={p.id} type="button" class={`cal-pin ${p.status}`} draggable={p.status !== 'posted'} title={`${p.title || 'Untitled'} · ${fmtTime(p.scheduled_at || p.posted_at, tz)}`}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)} onClick={() => onOpen(p)}>
                {p.thumb ? <img src={p.thumb} alt="" /> : null}
                <span class="t">{fmtTime(p.scheduled_at || p.posted_at, tz)} {p.title}</span>
              </button>
            ))}
            {(byDay[d] || []).length > 4 && <span class="tiny muted">+{byDay[d].length - 4} more</span>}
          </div>
        ))}
      </div>
      <p class="tiny faint" style={{ margin: 0 }}>Drag a pin to another day to reschedule it (keeps its time). Tap a pin to edit, post now or delete.</p>
    </div>
  );
}

export function Schedule({ query }) {
  const s = useStore();
  const tz = userTz();
  const [rendering, setRendering] = useState(null);
  const [view, setView] = useState(query?.view || pref('scheduleView', 'calendar'));
  const [pins, setPins] = useState(null);
  const [log, setLog] = useState([]);
  const [editing, setEditing] = useState(null);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = useState(null);
  const [boardId, setBoardId] = useState(null);

  const load = async () => {
    let list = [];
    try { list = await api.pins(); setPins(list); } catch (e) { toast(e.message, 'error'); setPins([]); }
    if (list.some((p) => p.design_json) && !renderingNow) {
      setRendering({ done: 0, n: list.filter((p) => p.design_json).length });
      const n = await renderPending(list, (done, total) => setRendering({ done, n: total }));
      setRendering(null);
      if (n) { toast(`${n} AI-designed pin${n > 1 ? 's' : ''} rendered ✓`, 'ok'); setPins(await api.pins()); }
    }
    api.log().then(setLog).catch(() => {});
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => setPref('scheduleView', view), [view]);
  useEffect(() => { if (accounts?.length && !accountId) setAccountId(accounts[0].id); }, [accounts]);

  const scheduled = (pins || []).filter((p) => p.status === 'scheduled' || p.status === 'posting').sort((a, b) => a.scheduled_at - b.scheduled_at);
  const failed = (pins || []).filter((p) => p.status === 'failed');
  const drafts = (pins || []).filter((p) => p.status === 'draft');
  const posted = (pins || []).filter((p) => p.status === 'posted').sort((a, b) => (b.posted_at || 0) - (a.posted_at || 0));

  async function move(id, day) {
    const p = pins.find((x) => x.id === id);
    if (!p) return;
    const parts = zonedParts(p.scheduled_at || Date.now(), tz);
    const [yy, mm, dd] = day.split('-').map(Number);
    const t = zonedToUtc(yy, mm, dd, parts.hour, parts.minute, parts.second, tz);
    if (t < Date.now()) { toast('That time is in the past. Pick a later day.', 'error'); return; }
    try {
      await api.updatePin(id, { scheduledAt: t, ...(p.status === 'draft' ? { status: 'scheduled' } : {}) });
      toast(`Moved to ${fmtDateTime(t, tz)}`, 'ok');
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function autoSchedule(opts) {
    setBusy(true);
    try {
      const r = await api.autoSchedule({ ...opts, pinIds: sel, accountId });
      toast(`${r.scheduled} pins scheduled${r.skipped?.length ? `, ${r.skipped.length} skipped (need account/board)` : ''} ✓`, 'ok');
      setSel([]); await load(); refreshMe().catch(() => {});
      setView('queue');
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }

  const groups = useMemo(() => {
    const g = {};
    for (const p of scheduled) (g[ymd(p.scheduled_at, tz)] ||= []).push(p);
    return Object.entries(g);
  }, [pins, tz]);

  return (
    <div class="stack lg">
      <div class="row between">
        <div class="tabs" role="tablist" style={{ marginBottom: 0, flex: '0 1 560px' }}>
          {[['calendar', 'Calendar'], ['queue', `Queue (${scheduled.length})`], ['drafts', `Drafts (${drafts.length})`], ['posted', `Posted (${posted.length})`]].map(([k, l]) => (
            <button key={k} class={view === k ? 'active' : ''} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        <div class="row">
          <button class="btn sm ghost" onClick={load}>Refresh</button>
        </div>
      </div>

      {rendering && <div class="notice row"><Spinner /> Rendering AI-designed pins: {rendering.done} / {rendering.n}</div>}
      {failed.length > 0 && (
        <div class="card stack" style={{ borderColor: 'var(--danger)' }}>
          <b>{failed.length} pin{failed.length > 1 ? 's' : ''} failed to post</b>
          {failed.map((p) => (
            <div key={p.id} class="row between small">
              <span class="grow"><b>{p.title || 'Untitled'}</b> · <span class="muted">{p.last_error}</span></span>
              <button class="btn sm" onClick={() => setEditing(p)}>Fix & retry</button>
            </div>
          ))}
        </div>
      )}

      {pins === null ? <div class="skeleton" style={{ height: 400 }} /> : (
        <>
          {view === 'calendar' && <Calendar pins={pins.filter((p) => p.status !== 'draft')} tz={tz} onOpen={setEditing} onMove={move} />}

          {view === 'queue' && (scheduled.length ? groups.map(([day, list]) => (
            <div class="queue-day" key={day}>
              <h4>{fmtDay(list[0].scheduled_at, tz)}</h4>
              {list.map((p) => (
                <div class="qitem" key={p.id}>
                  {p.thumb ? <img src={p.thumb} alt="" /> : <div class="skeleton" style={{ width: 54, height: 81 }} />}
                  <div class="meta">
                    <div class="title">{p.title || 'Untitled pin'}</div>
                    <div class="small muted">{fmtTime(p.scheduled_at, tz)} · {relative(p.scheduled_at)} · {p.board_name || 'No board'}</div>
                    {p.last_error && <div class="small" style={{ color: 'var(--warn)' }}>Retrying: {p.last_error}</div>}
                  </div>
                  <div class="actions">
                    <StatusChip status={p.status} />
                    <button class="btn sm ghost" onClick={() => setEditing(p)}>Edit</button>
                  </div>
                </div>
              ))}
            </div>
          )) : <div class="empty card"><div class="ico">🗓️</div><p>No pins scheduled yet.</p><a class="btn primary" href="#/app/design">Design a pin</a></div>)}

          {view === 'drafts' && (
            <div class="stack lg">
              {drafts.length ? (
                <>
                  <div class="row between">
                    <span class="muted small">Select drafts, then auto-schedule them with natural times.</span>
                    <div class="row">
                      <button class="btn sm ghost" onClick={() => setSel(drafts.map((d) => d.id))}>Select all</button>
                      <button class="btn sm ghost" onClick={() => setSel([])}>Clear</button>
                    </div>
                  </div>
                  <div class="draft-grid">
                    {drafts.map((p) => (
                      <button type="button" key={p.id} class={`draft ${sel.includes(p.id) ? 'sel' : ''}`} onClick={() => setSel((x) => x.includes(p.id) ? x.filter((i) => i !== p.id) : [...x, p.id])}>
                        <span class="tick">✓</span>
                        {p.thumb ? <img src={p.thumb} alt="" /> : <div class="skeleton" style={{ aspectRatio: '2/3' }} />}
                        <div class="cap">{p.title || 'Untitled'}</div>
                      </button>
                    ))}
                  </div>
                  <AccountBoardPicker accountId={accountId} setAccountId={setAccountId} boardId={boardId} setBoardId={setBoardId} />
                  <AutoScheduleForm tz={tz} accountId={accountId} defaultBoardId={boardId} busy={busy} count={sel.length}
                    pinsForPreview={drafts.filter((d) => sel.includes(d.id)).map((d) => ({ id: d.id, link: d.link }))} onSubmit={autoSchedule} />
                  {sel.length === 1 && <button class="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setEditing(drafts.find((d) => d.id === sel[0]))}>Edit selected draft</button>}
                </>
              ) : <div class="empty card"><div class="ico">📝</div><p>No drafts. Save pins as drafts from the designer or bulk mode to auto-schedule them here.</p></div>}
            </div>
          )}

          {view === 'posted' && (
            <div class="grid-2" style={{ alignItems: 'start' }}>
              <div class="stack">
                <h3>Posted pins</h3>
                {posted.length ? posted.slice(0, 100).map((p) => (
                  <div class="qitem" key={p.id}>
                    {p.thumb ? <img src={p.thumb} alt="" /> : null}
                    <div class="meta"><div class="title">{p.title || 'Untitled'}</div><div class="small muted">{fmtDateTime(p.posted_at, tz)} · {p.board_name}</div></div>
                    <div class="actions"><button class="btn sm ghost" onClick={() => setEditing(p)}>Details & stats</button></div>
                  </div>
                )) : <p class="muted">Nothing posted yet.</p>}
              </div>
              <div class="stack">
                <h3>Post log</h3>
                <div class="card pad-sm" style={{ maxHeight: 520, overflowY: 'auto' }}>
                  {log.length ? log.map((l, i) => (
                    <div key={i} class="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span class={`chip ${l.ok ? 'ok' : 'danger'}`}>{l.ok ? 'OK' : 'Error'}</span> <span class="muted">{fmtDateTime(l.at, tz)}</span>
                      <div>{l.title ? <b>{l.title}: </b> : null}{l.message}</div>
                    </div>
                  )) : <p class="muted small">No posting activity yet.</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {editing && <PinEditor pin={editing} tz={tz} onClose={() => setEditing(null)} onChanged={load} />}
    </div>
  );
}
