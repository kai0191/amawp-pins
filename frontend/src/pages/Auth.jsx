import { useRef, useState } from 'preact/hooks';
import { Logo, Spinner } from '../components.jsx';
import { api } from '../lib/api.js';
import { useStore, setState, navigate, toast } from '../lib/store.js';

export function AuthPage({ mode }) {
  const s = useStore();
  const isSignup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitted = useRef(false);

  if (s.user && !submitted.current) { setTimeout(() => navigate('/app'), 0); return null; }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (isSignup && !agree) { setError('Please accept the terms and privacy policy.'); return; }
    setBusy(true);
    submitted.current = true;
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const user = isSignup ? await api.signup({ email, password, name, timezone }) : await api.login({ email, password });
      setState({ user });
      toast(isSignup ? 'Welcome to Tackly! Let’s make your first pin.' : 'Welcome back!', 'ok');
      navigate(isSignup ? '/app/design' : '/app');
    } catch (err) {
      submitted.current = false;
      setError(err.message);
    } finally { setBusy(false); }
  }

  const pinterestUrl = s.mode === 'remote' && s.health?.pinterestConfigured ? api.pinterestLoginUrl() : null;

  return (
    <div class="auth-wrap">
      <div class="auth-card stack lg">
        <div class="center"><Logo /></div>
        <div class="card stack" style={{ padding: 28 }}>
          <div>
            <h2 style={{ fontSize: 26, marginBottom: 4 }}>{isSignup ? 'Create your free account' : 'Welcome back'}</h2>
            <p class="muted small" style={{ margin: 0 }}>{isSignup ? 'Free forever for 1 Pinterest account. No credit card.' : 'Sign in to design and schedule your pins.'}</p>
          </div>
          {s.mode === 'demo' && (
            <div class="notice warn small">
              <b>Demo mode:</b> the Tackly server is not connected yet, so your account and pins are saved only in this browser and nothing is posted to Pinterest.
            </div>
          )}
          {pinterestUrl && (
            <>
              <a class="btn ghost block" href={pinterestUrl}>Continue with Pinterest</a>
              <div class="or">or with email</div>
            </>
          )}
          <form class="stack" onSubmit={submit}>
            {isSignup && (
              <label class="field">Your name
                <input type="text" value={name} onInput={(e) => setName(e.target.value)} autocomplete="name" placeholder="Alex" />
              </label>
            )}
            <label class="field">Email
              <input type="email" required value={email} onInput={(e) => setEmail(e.target.value)} autocomplete="email" placeholder="you@example.com" />
            </label>
            <label class="field">Password
              <input type="password" required minLength={s.mode === 'demo' ? 0 : 8} value={password} onInput={(e) => setPassword(e.target.value)}
                autocomplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'At least 8 characters' : '••••••••'} />
            </label>
            {isSignup && (
              <label class="check small">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I agree to the <a href="#/terms" target="_blank">terms</a> and <a href="#/privacy" target="_blank">privacy policy</a>.</span>
              </label>
            )}
            {error && <div class="notice danger small" role="alert">{error}</div>}
            <button class="btn primary block lg" type="submit" disabled={busy}>
              {busy ? <Spinner /> : isSignup ? 'Create free account' : 'Sign in'}
            </button>
          </form>
        </div>
        <p class="center small muted">
          {isSignup ? <>Already have an account? <a href="#/login">Sign in</a></> : <>New to Tackly? <a href="#/signup">Create a free account</a></>}
        </p>
      </div>
    </div>
  );
}
