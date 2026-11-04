import { useState } from 'preact/hooks';
import { Spinner, Logo } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, toast } from '../lib/store.js';
import { WAITLIST_FEATURES } from '../../../shared/plans.js';

export function Upgrade({ query = {}, standalone }) {
  const s = useStore();
  const [features, setFeatures] = useState(query.reason === 'accounts' ? ['more_accounts'] : []);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(s.user?.email || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!features.length) { toast('Pick at least one feature you want.', 'error'); return; }
    setBusy(true);
    try { await api.waitlist({ features, note, email }); setDone(true); toast('Thanks! You’re on the waitlist 🎉', 'ok'); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  const body = (
    <div class="stack lg" style={{ maxWidth: 820, margin: standalone ? '0 auto' : undefined }}>
      {query.reason === 'accounts' && (
        <div class="notice">Your free plan includes <b>1 Pinterest account</b>. More accounts are coming soon with a paid plan.</div>
      )}
      <div class="card stack">
        <span class="chip primary" style={{ alignSelf: 'flex-start' }}>Coming soon</span>
        <h2 style={{ margin: 0 }}>Tackly Pro</h2>
        <p class="muted" style={{ margin: 0 }}>We’re building paid plans based on what you ask for. Tell us what you need and we’ll let you know first, with an early-supporter discount.</p>
        <div class="grid-2">
          <div class="price-card"><h3>Free <span class="chip ok">Your plan</span></h3><ul><li>1 Pinterest account</li><li>Unlimited scheduling</li><li>18 templates + brand kit</li><li>Free AI text & images</li><li>Bulk + auto-schedule</li></ul></div>
          <div class="price-card featured"><h3>Pro <span class="badge-pro">SOON</span></h3><ul><li>Up to 5 Pinterest accounts</li><li>One-click AI-generated pins</li><li>Pro templates</li><li>Priority posting</li><li>Everything in Free</li></ul></div>
        </div>
      </div>
      <form class="card stack" onSubmit={submit}>
        <h3 style={{ margin: 0 }}>Join the waitlist</h3>
        {done ? <div class="notice ok">You’re on the list. Thank you! We’ll email you when Pro launches.</div> : (
          <>
            <div class="field">What would you pay for?</div>
            <div class="grid-2">
              {WAITLIST_FEATURES.map((f) => (
                <label key={f.id} class="check card flat pad-sm" style={{ borderRadius: 12 }}>
                  <input type="checkbox" checked={features.includes(f.id)} onChange={(e) => setFeatures((x) => e.target.checked ? [...x, f.id] : x.filter((i) => i !== f.id))} />
                  {f.label}
                </label>
              ))}
            </div>
            {!s.user && <label class="field">Email<input type="email" required value={email} onInput={(e) => setEmail(e.target.value)} /></label>}
            <label class="field">Anything else? (optional)<textarea rows={3} value={note} onInput={(e) => setNote(e.target.value)} placeholder="e.g. I manage 4 client accounts and need team access" /></label>
            <button class="btn primary" disabled={busy}>{busy ? <Spinner /> : 'Join the waitlist'}</button>
          </>
        )}
      </form>
    </div>
  );
  if (!standalone) return body;
  return <div class="auth-wrap" style={{ display: 'block', paddingTop: 40 }}><div class="center" style={{ marginBottom: 24 }}><Logo /></div>{body}</div>;
}
