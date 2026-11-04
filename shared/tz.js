// Small, dependency-free timezone helpers built on Intl (works in browsers and Workers).
const dtfCache = new Map();
function dtf(tz) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export function zonedParts(utcMs, tz) {
  const out = {};
  for (const p of dtf(tz).formatToParts(new Date(utcMs))) out[p.type] = p.value;
  return {
    year: +out.year, month: +out.month, day: +out.day,
    hour: +out.hour % 24, minute: +out.minute, second: +out.second, weekday: out.weekday,
  };
}

export function tzOffsetMs(utcMs, tz) {
  const p = zonedParts(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in `tz` -> UTC epoch ms. */
export function zonedToUtc(year, month, day, hour = 0, minute = 0, second = 0, tz = 'UTC') {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const off1 = tzOffsetMs(guess, tz);
  let res = guess - off1;
  const off2 = tzOffsetMs(res, tz);
  if (off2 !== off1) res = guess - off2;
  return res;
}

export function ymd(utcMs, tz) {
  const p = zonedParts(utcMs, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function addDaysYmd(ymdStr, n) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function isValidTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
