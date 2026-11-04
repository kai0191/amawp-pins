import { useEffect, useState } from 'preact/hooks';
import { api } from './api.js';
import { getState, setState, pref } from './store.js';

let accountsCache = null;
const boardsCache = new Map();

export async function loadAccounts(force = false) {
  if (!accountsCache || force) accountsCache = api.accounts().catch((e) => { accountsCache = null; throw e; });
  return accountsCache;
}
export async function loadBoards(accountId, force = false) {
  if (!accountId) return [];
  if (!boardsCache.has(accountId) || force) {
    boardsCache.set(accountId, api.boards(accountId).catch((e) => { boardsCache.delete(accountId); throw e; }));
  }
  return boardsCache.get(accountId);
}
export function resetAccountCaches() { accountsCache = null; boardsCache.clear(); }

export function useAccounts() {
  const [state, set] = useState({ accounts: null, error: null });
  useEffect(() => { loadAccounts().then((a) => set({ accounts: a, error: null })).catch((e) => set({ accounts: [], error: e.message })); }, []);
  return state;
}

export function useBoards(accountId) {
  const [state, set] = useState({ boards: null, error: null, loading: false });
  const reload = (force = true) => {
    if (!accountId) { set({ boards: [], error: null, loading: false }); return; }
    set((s) => ({ ...s, loading: true }));
    loadBoards(accountId, force).then((b) => set({ boards: b, error: null, loading: false })).catch((e) => set({ boards: [], error: e.message, loading: false }));
  };
  useEffect(() => reload(false), [accountId]);
  return { ...state, reload };
}

export function brandKit() {
  return getState().profile?.brandKit || {};
}

/** Reload counts + profile from the data home. */
export async function refreshMe() {
  const info = await api.info();
  setState({ overview: info.overview || {}, profile: info.profile || {} });
  return info;
}

export async function saveProfile(patch) {
  const profile = { ...(getState().profile || {}), ...patch };
  const saved = await api.saveProfile(profile);
  setState({ profile: saved || profile });
  return saved;
}

export function stockKeys() { return pref('stockKeys', {}); }
