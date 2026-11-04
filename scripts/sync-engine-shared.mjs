// Copies shared/ modules into engine/src/shared so the engine folder is fully self-contained
// (required by Cloudflare's "Deploy to Cloudflare" button). Run: node scripts/sync-engine-shared.mjs [--check]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const check = process.argv.includes('--check');
let stale = [];
for (const f of readdirSync('shared').filter((x) => x.endsWith('.js') && x !== 'plans.js')) {
  const src = `// AUTO-COPIED from shared/${f} by scripts/sync-engine-shared.mjs. Edit the original, not this copy.\n` + readFileSync(`shared/${f}`, 'utf8');
  const dest = `engine/src/shared/${f}`;
  let cur = '';
  try { cur = readFileSync(dest, 'utf8'); } catch { /* new */ }
  if (cur !== src) { stale.push(dest); if (!check) writeFileSync(dest, src); }
}
if (check && stale.length) { console.error('Out of sync, run node scripts/sync-engine-shared.mjs:', stale.join(', ')); process.exit(1); }
console.log(check ? 'engine/src/shared is in sync' : `synced ${stale.length} file(s)`);
