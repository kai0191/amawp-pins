import { useEffect, useState } from 'preact/hooks';

// Tiny global store with a hook.
const state = { ready: false, relay: false, health: null, home: { mode: 'local' }, engineError: null, profile: {}, overview: {}, toasts: [] };
const subs = new Set();

export function getState() { return state; }
export function setState(patch) {
  Object.assign(state, typeof patch === 'function' ? patch(state) : patch);
  subs.forEach((f) => f());
}
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  return state;
}

let toastId = 0;
export function toast(message, kind = 'info', ms = 4200) {
  const id = ++toastId;
  setState((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

// ---- hash router ----
function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => {
    const f = () => { setR(parseHash()); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}
export function navigate(path) {
  if (location.hash !== `#${path}`) location.hash = path;
  window.scrollTo(0, 0);
}

// ---- small persistent prefs (per browser) ----
export function pref(key, fallback) {
  try { const v = localStorage.getItem(`tackly.pref.${key}`); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function setPref(key, v) {
  try { localStorage.setItem(`tackly.pref.${key}`, JSON.stringify(v)); } catch { /* ignore */ }
}

export function userTz() {
  return state.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
