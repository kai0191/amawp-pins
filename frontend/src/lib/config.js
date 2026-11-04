// Runtime configuration. The deploy workflow bakes the Worker URL into VITE_API_BASE.
// For testing you can override it with ?api=https://your-worker.workers.dev (remembered) or ?api=demo.
const LS_API = 'tackly.apiBase';
const LS_TOKEN = 'tackly.token';

function initialApi() {
  try {
    const qs = new URLSearchParams(location.search);
    const fromQs = qs.get('api');
    if (fromQs) {
      if (fromQs === 'reset') localStorage.removeItem(LS_API);
      else localStorage.setItem(LS_API, fromQs);
    }
    const saved = localStorage.getItem(LS_API);
    if (saved) return saved === 'demo' ? '' : saved;
  } catch { /* storage blocked */ }
  return (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
}

let apiBase = initialApi();
export const getApiBase = () => apiBase;
export const setApiBase = (v) => { apiBase = v; };

export function getToken() {
  try { return localStorage.getItem(LS_TOKEN); } catch { return null; }
}
export function setToken(t) {
  try { if (t) localStorage.setItem(LS_TOKEN, t); else localStorage.removeItem(LS_TOKEN); } catch { /* ignore */ }
}

export const APP_NAME = 'Tackly';
export const BRAND = 'AMAWP';
// Set the repository variable CONTACT_EMAIL (see docs/SETUP.md) to show a contact email on legal pages.
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';
export const REPO_URL = 'https://github.com/kai0191/amawp-pins';
