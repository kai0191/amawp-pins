import { useEffect, useState } from 'preact/hooks';
import { Modal, Spinner, Icon } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, toast, navigate, userTz, pref, setPref } from '../lib/store.js';
import { useAccounts, useBoards, refreshMe } from '../lib/data.js';
import { fromLocalInput, nextRoundedSlot } from '../lib/time.js';

/** Account + board picker with inline "create board". */
export function AccountBoardPicker({ accountId, setAccountId, boardId, setBoardId, setBoardName }) {
  const { accounts } = useAccounts();
  const { boards, error, loading, reload } = useBoards(accountId);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (accounts && accounts.length && !accountId) setAccountId(accounts[0].id);
  }, [accounts]);
  useEffect(() => {
    if (boards && boards.length && !boards.find((b) => b.id === boardId)) {
      const last = pref('lastBoard', null);
      const pick = boards.find((b) => b.id === last) || boards[0];
      setBoardId(pick.id); setBoardName && setBoardName(pick.name);
    }
  }, [boards]);

  if (accounts && !accounts.length) {
    return (
      <div class="notice warn small">
        No Pinterest account connected yet. You can save pins as drafts now and <a href="#/app/accounts">connect Pinterest</a> later.
      </div>
    );
  }
  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const b = await api.createBoard(accountId, { name: newName.trim() });
      reload(true);
      setBoardId(b.id); setBoardName && setBoardName(b.name); setNewName('');
      toast(`Board “${b.name}” created`, 'ok');
    } catch (e) { toast(e.message, 'error'); } finally { setCreating(false); }
  }
  return (
    <div class="grid-2">
      <label class="field">Pinterest account
        <select value={accountId || ''} onChange={(e) => setAccountId(e.target.value)}>
          {(accounts || []).map((a) => <option key={a.id} value={a.id}>@{a.username || 'account'}</option>)}
        </select>
      </label>
      <label class="field">Board {loading && <Spinner />}
        <select value={boardId || ''} onChange={(e) => {
          setBoardId(e.target.value); setPref('lastBoard', e.target.value);
          const b = (boards || []).find((x) => x.id === e.target.value); setBoardName && setBoardName(b ? b.name : '');
        }}>
          {!boards?.length && <option value="">No boards yet</option>}
          {(boards || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      {error && <div class="notice danger small" style={{ gridColumn: '1 / -1' }}>{error}</div>}
      <div class="row nowrap" style={{ gridColumn: '1 / -1' }}>
        <input type="text" placeholder="New board name" value={newName} onInput={(e) => setNewName(e.target.value)} />
        <button class="btn sm" type="button" disabled={creating || !newName.trim() || !accountId} onClick={create}>{creating ? <Spinner /> : 'Create board'}</button>
      </div>
    </div>
  );
}

/**
 * Publish one pin: AI copy, account/board, and post now / schedule / save draft.
 * props: getImage() -> {image (base64 jpeg), thumb}, defaults {title, link, headline, topic}, templateId
 */
export function PublishDialog({ onClose, getImage, defaults = {}, templateId }) {
  const s = useStore();
  const tz = userTz(s.user);
  const [title, setTitle] = useState(defaults.title || '');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState(defaults.link || pref('lastLink', ''));
  const [altText, setAltText] = useState('');
  const [keywords, setKeywords] = useState('');
  const [accountId, setAccountId] = useState(null);
  const [boardId, setBoardId] = useState(null);
  const [boardName, setBoardName] = useState('');
  const [when, setWhen] = useState('schedule');
  const [at, setAt] = useState(nextRoundedSlot(tz, 90));
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [boardIdeas, setBoardIdeas] = useState([]);

  async function writeWithAi() {
    setAiBusy(true);
    try {
      const r = await api.aiText('pin_copy', { topic: defaults.topic || title || defaults.headline, headline: defaults.headline, link, board: boardName, keywords });
      const d = r.data || {};
      if (!d.title && !d.description) throw new Error('The AI reply was not in the expected format. Please try again.');
      if (d.title) setTitle(String(d.title).slice(0, 100));
      if (d.description) setDescription(String(d.description).slice(0, 800));
      if (d.alt_text) setAltText(String(d.alt_text).slice(0, 500));
      if (Array.isArray(d.boards)) setBoardIdeas(d.boards.slice(0, 3));
      toast(`Copy written with ${r.provider === 'custom' ? 'your AI provider' : 'free AI (Pollinations)'}`, 'ok');
    } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(false); }
  }

  async function submit() {
    setBusy(true);
    try {
      if (link) setPref('lastLink', link);
      const { image, thumb } = await getImage();
      const scheduledAt = when === 'schedule' ? fromLocalInput(at, tz) : null;
      if (when === 'schedule' && (!scheduledAt || scheduledAt < Date.now() + 60000)) throw new Error('Pick a time in the future.');
      if (when !== 'draft' && (!accountId || !boardId)) throw new Error('Choose a Pinterest account and a board, or save as a draft.');
      const pin = await api.createPin({
        image, thumb, title, description, link, altText, templateId, accountId, boardId, boardName,
        status: when === 'schedule' ? 'scheduled' : 'draft', scheduledAt,
      });
      if (when === 'now') {
        const r = await api.postNow(pin.id);
        if (r.result?.status === 'posted') toast(s.mode === 'demo' ? 'Demo: pin marked as posted (nothing sent to Pinterest).' : 'Posted to Pinterest! 🎉', 'ok');
        else toast(`Could not post yet: ${r.result?.error || 'unknown error'}`, 'error', 7000);
      } else {
        toast(when === 'schedule' ? 'Pin scheduled ✓' : 'Saved to drafts. Auto-schedule it from the Schedule page.', 'ok');
      }
      refreshMe().catch(() => {});
      onClose(true);
    } catch (e) { toast(e.message, 'error', 6000); } finally { setBusy(false); }
  }

  return (
    <Modal title="Save & schedule pin" onClose={() => onClose(false)} wide
      footer={<>
        <button class="btn ghost" onClick={() => onClose(false)}>Cancel</button>
        <button class="btn primary" disabled={busy} onClick={submit}>
          {busy ? <Spinner /> : when === 'now' ? <><Icon name="send" size={16} /> Post now</> : when === 'schedule' ? <><Icon name="clock" size={16} /> Schedule pin</> : 'Save draft'}
        </button>
      </>}>
      <div class="stack">
        <div class="row between">
          <span class="muted small">Pinterest SEO copy</span>
          <button class="btn sm" disabled={aiBusy} onClick={writeWithAi}>{aiBusy ? <Spinner /> : <><Icon name="sparkle" size={16} /> Write with AI</>}</button>
        </div>
        <label class="field">Title <span class="faint tiny">{title.length}/100</span>
          <input type="text" maxLength={100} value={title} onInput={(e) => setTitle(e.target.value)} placeholder="Keyword-rich pin title" />
        </label>
        <label class="field">Description <span class="faint tiny">{description.length}/800</span>
          <textarea rows={4} maxLength={800} value={description} onInput={(e) => setDescription(e.target.value)} placeholder="Describe the pin naturally with keywords people search for" />
        </label>
        <div class="grid-2">
          <label class="field">Destination link
            <input type="url" value={link} onInput={(e) => setLink(e.target.value)} placeholder="https://yourwebsite.com/post" />
          </label>
          <label class="field">Keywords for AI (optional)
            <input type="text" value={keywords} onInput={(e) => setKeywords(e.target.value)} placeholder="fall decor, cozy living room" />
          </label>
        </div>
        <label class="field">Alt text (accessibility)
          <input type="text" maxLength={500} value={altText} onInput={(e) => setAltText(e.target.value)} placeholder="Describe the image for screen readers" />
        </label>
        <div class="divider" />
        <AccountBoardPicker accountId={accountId} setAccountId={setAccountId} boardId={boardId} setBoardId={setBoardId} setBoardName={setBoardName} />
        {boardIdeas.length > 0 && <div class="small muted">AI board ideas: {boardIdeas.map((b) => <span key={b} class="chip" style={{ marginRight: 6 }}>{b}</span>)}</div>}
        <div class="divider" />
        <div class="tabs" role="tablist">
          {[['schedule', 'Schedule'], ['now', 'Post now'], ['draft', 'Save as draft']].map(([k, l]) => (
            <button key={k} class={when === k ? 'active' : ''} onClick={() => setWhen(k)} type="button">{l}</button>
          ))}
        </div>
        {when === 'schedule' && (
          <label class="field">Date and time ({tz})
            <input type="datetime-local" value={at} onInput={(e) => setAt(e.target.value)} />
          </label>
        )}
        {when === 'draft' && <p class="small muted" style={{ margin: 0 }}>Drafts can be auto-scheduled in bulk with natural, spread-out times on the <a href="#/app/schedule" onClick={() => onClose(false)}>Schedule</a> page.</p>}
        {when === 'now' && s.mode === 'demo' && <p class="small muted" style={{ margin: 0 }}>Demo mode: the pin will be marked as posted but nothing is sent to Pinterest.</p>}
      </div>
    </Modal>
  );
}

export function goSchedule() { navigate('/app/schedule'); }
