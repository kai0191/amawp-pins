// WebCrypto helpers: PBKDF2 password hashing, HS256 JWT, AES-GCM secret encryption.
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return unb64(s);
}

export function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
export function randomId(prefix = '') {
  return prefix + b64url(randomBytes(12));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

// Cloudflare Workers caps PBKDF2 at 100k iterations.
export const PBKDF2_ITERATIONS = 100000;

export async function hashPassword(password, iterations = PBKDF2_ITERATIONS) {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(hash)}`;
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, iter, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2' || !saltB64 || !hashB64) return false;
  const hash = await pbkdf2(password, unb64(saltB64), parseInt(iter, 10));
  return timingSafeEqual(hash, unb64(hashB64));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signJwt(payload, secret, ttlSeconds = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + ttlSeconds, ...payload };
  const data = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(body)))}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) return null;
  const [h, p, s] = token.split('.');
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(s), enc.encode(`${h}.${p}`));
  } catch { return null; }
  if (!ok) return null;
  try {
    const header = JSON.parse(dec.decode(unb64url(h)));
    if (header.alg !== 'HS256') return null;
    const payload = JSON.parse(dec.decode(unb64url(p)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

const aesCache = new Map();
async function aesKey(secret) {
  if (aesCache.has(secret)) return aesCache.get(secret);
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
  aesCache.set(secret, key);
  return key;
}

export async function encryptString(plain, secret) {
  if (plain == null) return null;
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(String(plain)));
  return `v1.${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

export async function decryptString(blob, secret) {
  if (!blob) return null;
  const [v, ivB64, ctB64] = blob.split('.');
  if (v !== 'v1') throw new Error('Unknown ciphertext version');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB64) }, await aesKey(secret), unb64(ctB64));
  return dec.decode(pt);
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}
