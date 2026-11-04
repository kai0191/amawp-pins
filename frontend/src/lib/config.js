// Runtime configuration.
// VITE_API_BASE = the Tackly relay (AMAWP's Worker). It is baked in by the deploy workflow.
// Override for testing with ?api=https://relay.example.workers.dev, ?api=none (no relay) or ?api=reset.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const LS_API = 'tackly.apiBase';
const LS_HOME = 'tackly.dataHome';

function initialRelay() {
  try {
    const fromQs = new URLSearchParams(location.search).get('api');
    if (fromQs) {
      if (fromQs === 'reset') localStorage.removeItem(LS_API);
      else localStorage.setItem(LS_API, fromQs === 'demo' ? 'none' : fromQs);
    }
    const saved = localStorage.getItem(LS_API);
    if (saved) return saved === 'none' ? '' : saved.replace(/\/+$/, '');
  } catch { /* storage blocked or not in a browser */ }
  return String(env.VITE_API_BASE || '').replace(/\/+$/, '');
}

let relayBase = initialRelay();
export const getRelayBase = () => relayBase;
export const setRelayBase = (v) => { relayBase = v; };

/** Where the user's data lives: { mode: 'local' } or { mode: 'engine', url, key }. */
export function getDataHome() {
  try { return JSON.parse(localStorage.getItem(LS_HOME)) || { mode: 'local' }; } catch { return { mode: 'local' }; }
}
export function setDataHome(h) {
  try { localStorage.setItem(LS_HOME, JSON.stringify(h)); } catch { /* ignore */ }
}

export const APP_NAME = 'Tackly';
export const BRAND = 'AMAWP';
// Set the repository variable CONTACT_EMAIL (see docs/SETUP.md) to show a contact email on legal pages.
export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL || '';
export const REPO_URL = 'https://github.com/kai0191/amawp-pins';
export const SITE_URL = 'https://kai0191.github.io/amawp-pins/';
export const ENGINE_DEPLOY_URL = `https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(`${REPO_URL}/tree/main/engine`)}`;
