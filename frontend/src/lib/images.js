// Image loading (CORS-safe for canvas export), uploads and free stock photo search.
import { getApiBase, getToken } from './config.js';

const cache = new Map();

function tryLoad(src, cors = true) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors && !src.startsWith('data:') && !src.startsWith('blob:')) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

async function viaWorker(src) {
  const base = getApiBase();
  const token = getToken();
  if (!base || !token) throw new Error('no proxy');
  const res = await fetch(`${base}/api/img?url=${encodeURIComponent(src)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('proxy failed');
  return tryLoad(URL.createObjectURL(await res.blob()), false);
}

/** Loads an image so it can be drawn on a canvas and exported (tries direct CORS, our Worker proxy, then wsrv.nl). */
export function loadImage(src) {
  if (!src) return Promise.reject(new Error('no src'));
  if (cache.has(src)) return cache.get(src);
  const p = tryLoad(src)
    .catch(() => viaWorker(src))
    .catch(() => tryLoad(`https://wsrv.nl/?url=${encodeURIComponent(src)}&w=1600&output=jpg`))
    .catch((e) => { cache.delete(src); throw e; });
  cache.set(src, p);
  return p;
}

export function fileToDataUrl(file, maxSide = 1800) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read file'));
    r.onload = async () => {
      try {
        const img = await tryLoad(r.result, false);
        const s = Math.min(1, maxSide / Math.max(img.width, img.height));
        if (s === 1 && file.size < 1.5e6) return resolve(r.result);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9));
      } catch (e) { reject(e); }
    };
    r.readAsDataURL(file);
  });
}

// ---- Stock photo search ----
export const STOCK_PROVIDERS = [
  { id: 'openverse', name: 'Openverse (free, no key)', needsKey: false },
  { id: 'unsplash', name: 'Unsplash', needsKey: true, keyHelp: 'https://unsplash.com/developers' },
  { id: 'pexels', name: 'Pexels', needsKey: true, keyHelp: 'https://www.pexels.com/api/' },
  { id: 'pixabay', name: 'Pixabay', needsKey: true, keyHelp: 'https://pixabay.com/api/docs/' },
];

export async function searchStock(provider, query, keys = {}, page = 1) {
  const q = encodeURIComponent(query);
  if (provider === 'unsplash') {
    if (!keys.unsplash) throw new Error('Add your free Unsplash key in Settings first.');
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${q}&per_page=24&page=${page}&orientation=portrait`, {
      headers: { Authorization: `Client-ID ${keys.unsplash}` },
    });
    if (!r.ok) throw new Error(`Unsplash error ${r.status}`);
    const d = await r.json();
    return d.results.map((x) => ({ id: x.id, thumb: x.urls.small, full: x.urls.regular, credit: `Photo by ${x.user.name} on Unsplash` }));
  }
  if (provider === 'pexels') {
    if (!keys.pexels) throw new Error('Add your free Pexels key in Settings first.');
    const r = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=24&page=${page}&orientation=portrait`, {
      headers: { Authorization: keys.pexels },
    });
    if (!r.ok) throw new Error(`Pexels error ${r.status}`);
    const d = await r.json();
    return d.photos.map((x) => ({ id: x.id, thumb: x.src.medium, full: x.src.large2x, credit: `Photo by ${x.photographer} on Pexels` }));
  }
  if (provider === 'pixabay') {
    if (!keys.pixabay) throw new Error('Add your free Pixabay key in Settings first.');
    const r = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(keys.pixabay)}&q=${q}&per_page=24&page=${page}&orientation=vertical&image_type=photo&safesearch=true`);
    if (!r.ok) throw new Error(`Pixabay error ${r.status}`);
    const d = await r.json();
    return d.hits.map((x) => ({ id: x.id, thumb: x.webformatURL, full: x.largeImageURL, credit: `Image by ${x.user} on Pixabay` }));
  }
  const r = await fetch(`https://api.openverse.org/v1/images/?q=${q}&page_size=24&page=${page}&mature=false`);
  if (!r.ok) throw new Error(`Openverse is busy (${r.status}). Try again in a moment.`);
  const d = await r.json();
  return (d.results || []).map((x) => ({
    id: x.id, thumb: x.thumbnail || x.url, full: x.url,
    credit: `${x.title || 'Image'} by ${x.creator || 'unknown'} (${(x.license || '').toUpperCase()} ${x.license_version || ''})`,
  }));
}
