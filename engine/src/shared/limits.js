// AUTO-COPIED from shared/limits.js by scripts/sync-engine-shared.mjs. Edit the original, not this copy.
// Safety limits that protect the AMAWP Pinterest developer app from spam.
// The relay Worker enforces DAILY_PIN_LIMIT and MIN_GAP_MINUTES for real (users cannot bypass it);
// the app and the engine use the same numbers so the UI never lets people plan more than that.
export const DAILY_PIN_LIMIT = 10;            // pins published per Pinterest account per rolling 24 hours
export const MIN_GAP_MINUTES = 10;            // minimum minutes between two pins on the same account
export const MAX_PINTEREST_ACCOUNTS = 1;      // Pinterest accounts per workspace
export const MAX_STORED_PINS = 5000;          // drafts/scheduled pins a workspace can keep

export function dayKey(ms, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** Count pins per account per local day, excluding `ignoreIds`. */
export function perDayCounts(pins, tz, ignoreIds = []) {
  const ignore = new Set(ignoreIds);
  const m = new Map();
  for (const p of pins) {
    if (ignore.has(p.id)) continue;
    if (!['scheduled', 'posting', 'posted'].includes(p.status)) continue;
    const t = p.status === 'posted' ? p.posted_at || p.scheduled_at : p.scheduled_at;
    if (!t) continue;
    const k = `${p.account_id || ''}|${dayKey(t, tz)}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** Returns an error message if scheduling `pin` at `at` would exceed the daily limit, else null. */
export function checkDailyLimit(pins, { id, accountId, at, tz }) {
  const counts = perDayCounts(pins, tz, [id]);
  const n = counts.get(`${accountId || ''}|${dayKey(at, tz)}`) || 0;
  if (n >= DAILY_PIN_LIMIT) {
    return `That day already has ${DAILY_PIN_LIMIT} pins for this account. To keep accounts safe from spam flags, Tackly publishes at most ${DAILY_PIN_LIMIT} pins per account per day. Pick another day.`;
  }
  return null;
}
