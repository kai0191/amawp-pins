// Fails if anything that looks like a real secret is committed. Runs in CI on every push.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  ['OpenAI-style key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/],
  ['Pinterest token', /\bpin[ar]_[A-Za-z0-9._-]{20,}/],
  ['Pollinations secret key', /\bsk_[A-Za-z0-9]{20,}/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Hard-coded secret', /\b(?:PINTEREST_APP_SECRET|ENC_KEY|JWT_SECRET|ADMIN_KEY|ENGINE_KEY|CLOUDFLARE_API_TOKEN|AMAWP_IMAGE_API_KEY)\s*=\s*["']?[A-Za-z0-9+/_-]{16,}/],
];
const ALLOW = [/local-dev-/, /test-/, /my-engine-key-123456/, /admin-key-0123456789abcdef/];
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter((f) => f && !/\.(png|jpe?g|webp|ico|woff2?|lock)$/i.test(f) && f !== 'package-lock.json');
const hits = [];
for (const f of files) {
  let text = '';
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    for (const [name, re] of PATTERNS) {
      const m = line.match(re);
      if (m && !ALLOW.some((a) => a.test(line))) hits.push(`${f}:${i + 1}  ${name}: ${m[0].slice(0, 12)}…`);
    }
  });
}
for (const f of files) if (/(^|\/)\.dev\.vars$|(^|\/)\.env(\.|$)(?!example)/.test(f)) hits.push(`${f}: secrets file must not be committed`);
if (hits.length) { console.error('Possible secrets found:\n' + hits.join('\n')); process.exit(1); }
console.log(`No secrets found in ${files.length} tracked files.`);
