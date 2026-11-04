import { describe, it, expect } from 'vitest';
import {
  hashPassword, verifyPassword, signJwt, verifyJwt, encryptString, decryptString, maskKey,
} from '../src/lib/crypto.js';

describe('password hashing (PBKDF2)', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const h = await hashPassword('correct horse battery', 1000);
    expect(h.startsWith('pbkdf2$1000$')).toBe(true);
    expect(await verifyPassword('correct horse battery', h)).toBe(true);
    expect(await verifyPassword('wrong password', h)).toBe(false);
  });
  it('uses a random salt each time', async () => {
    expect(await hashPassword('same', 1000)).not.toEqual(await hashPassword('same', 1000));
  });
  it('rejects garbage hashes', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
  });
});

describe('JWT (HS256)', () => {
  it('round-trips a payload', async () => {
    const t = await signJwt({ sub: 'u_1' }, 's3cret');
    expect((await verifyJwt(t, 's3cret')).sub).toBe('u_1');
  });
  it('rejects a wrong secret, tampering and expiry', async () => {
    const t = await signJwt({ sub: 'u_1' }, 's3cret');
    expect(await verifyJwt(t, 'other')).toBeNull();
    const [h, , s] = t.split('.');
    const fake = btoa(JSON.stringify({ sub: 'admin', exp: 9999999999 })).replace(/=+$/, '');
    expect(await verifyJwt(`${h}.${fake}.${s}`, 's3cret')).toBeNull();
    const expired = await signJwt({ sub: 'u_1' }, 's3cret', -10);
    expect(await verifyJwt(expired, 's3cret')).toBeNull();
    expect(await verifyJwt('not-a-token', 's3cret')).toBeNull();
  });
});

describe('AES-GCM token encryption', () => {
  it('encrypts and decrypts', async () => {
    const c = await encryptString('pina_refresh_token_value', 'enc-key');
    expect(c).not.toContain('pina_refresh_token_value');
    expect(await decryptString(c, 'enc-key')).toBe('pina_refresh_token_value');
  });
  it('produces different ciphertext each time (random IV)', async () => {
    expect(await encryptString('a', 'k')).not.toEqual(await encryptString('a', 'k'));
  });
  it('fails with the wrong key or tampered data', async () => {
    const c = await encryptString('secret', 'k1');
    await expect(decryptString(c, 'k2')).rejects.toThrow();
    const parts = c.split('.');
    parts[2] = btoa('tampered-ciphertext!');
    await expect(decryptString(parts.join('.'), 'k1')).rejects.toThrow();
  });
  it('masks keys for display', () => {
    expect(maskKey('sk-abcdefghijklmnop')).toBe('sk-••••mnop');
    expect(maskKey('')).toBe('');
  });
});
