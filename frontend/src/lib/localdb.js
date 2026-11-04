// Tiny IndexedDB wrapper: the default "data home" keeps everything in the user's own browser.
const DB_NAME = 'tackly';
const STORES = ['settings', 'accounts', 'pins', 'images', 'log'];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'settings' || s === 'images' ? 'k' : 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const st = t.objectStore(store);
    let out;
    Promise.resolve(fn(st)).then((v) => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage aborted (is the browser storage full?)'));
  });
}
const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const ldb = {
  all: (store) => tx(store, 'readonly', (s) => req2p(s.getAll())),
  get: (store, key) => tx(store, 'readonly', (s) => req2p(s.get(key))),
  put: (store, value) => tx(store, 'readwrite', (s) => { s.put(value); }),
  del: (store, key) => tx(store, 'readwrite', (s) => { s.delete(key); }),
  clear: (store) => tx(store, 'readwrite', (s) => { s.clear(); }),
  async getSetting(k, fallback = null) { const r = await ldb.get('settings', k); return r ? r.v : fallback; },
  setSetting: (k, v) => ldb.put('settings', { k, v }),
  async getImage(id) { const r = await ldb.get('images', id); return r ? r.v : null; },
  setImage: (id, v) => ldb.put('images', { k: id, v }),
  delImage: (id) => ldb.del('images', id),
  async wipe() { for (const s of STORES) await ldb.clear(s); },
};
