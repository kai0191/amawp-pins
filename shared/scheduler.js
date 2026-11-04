// Auto-scheduler: spreads pins over days with natural, randomised times.
// Shared by the Worker (server-side auto-schedule) and the browser (preview + demo mode).
import { zonedToUtc, ymd, addDaysYmd } from './tz.js';
import { DAILY_PIN_LIMIT, MIN_GAP_MINUTES } from './limits.js';

export const PRESETS = {
  us_peak: {
    id: 'us_peak',
    label: 'Best US peak times',
    timezone: 'America/New_York',
    // Pinterest engagement peaks: lunch break and evenings, Eastern time.
    windows: [[12, 15], [19, 23]],
  },
  all_day: { id: 'all_day', label: 'All day (8am–10pm)', windows: [[8, 22]] },
  evenings: { id: 'evenings', label: 'Evenings (6pm–11pm)', windows: [[18, 23]] },
};

/** Deterministic PRNG for tests; pass Math.random in production. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

export function normalizeLink(link) {
  if (!link) return '';
  try {
    const u = new URL(link);
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch {
    return String(link).trim().toLowerCase();
  }
}

/**
 * Interleave pins so pins sharing the same link are as far apart as possible.
 */
export function interleaveByLink(pins) {
  const groups = new Map();
  for (const p of pins) {
    const k = normalizeLink(p.link) || `__nolink_${p.id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const lists = [...groups.values()].sort((a, b) => b.length - a.length);
  const out = [];
  let added = true;
  for (let round = 0; added; round++) {
    added = false;
    for (const l of lists) if (round < l.length) { out.push(l[round]); added = true; }
  }
  return out;
}

/** Times (UTC ms) for one local day, spread across the windows with random minutes and seconds. */
export function dayTimes(dayYmd, count, windows, tz, rng, { minGapMin = 20, avoid = [] } = {}) {
  if (count <= 0) return [];
  const [y, m, d] = dayYmd.split('-').map(Number);
  const spans = windows
    .map(([s, e]) => [Math.max(0, s) * 60, Math.min(24, e) * 60])
    .filter(([s, e]) => e > s);
  const total = spans.reduce((a, [s, e]) => a + (e - s), 0);
  if (!total) return [];
  const seg = total / count;
  const times = [];
  for (let i = 0; i < count; i++) {
    let placed = null;
    for (let attempt = 0; attempt < 12 && placed === null; attempt++) {
      // random point inside the i-th segment, keeping a margin so neighbours never collide
      const margin = Math.min(seg * 0.15, 10);
      const offset = i * seg + margin + rng() * Math.max(1, seg - 2 * margin);
      let rem = offset, minuteOfDay = spans[0][0];
      for (const [s, e] of spans) {
        if (rem <= e - s) { minuteOfDay = s + rem; break; }
        rem -= e - s;
      }
      let minuteInt = Math.floor(minuteOfDay);
      if (minuteInt % 15 === 0) minuteInt += randInt(rng, 1, 7); // avoid round :00/:15/:30/:45 slots
      const hh = Math.floor(minuteInt / 60), mm = minuteInt % 60;
      if (hh >= 24) continue;
      const t = zonedToUtc(y, m, d, hh, mm, randInt(rng, 0, 59), tz);
      const clash = [...times, ...avoid].some((x) => Math.abs(x - t) < minGapMin * 60000);
      if (!clash) placed = t;
    }
    if (placed !== null) times.push(placed);
  }
  return times.sort((a, b) => a - b);
}

/**
 * Auto-schedule pins.
 * @param pins [{id, link, boardIds?: string[], boardId?: string}]
 * @param opts {timezone, minPerDay, maxPerDay, windows, startDate?(YYYY-MM-DD), now?, existing?: number[], minGapMin?, maxDays?}
 * @returns [{id, scheduledAt (ms), boardId, day}]
 */
export function autoSchedule(pins, opts, rng = Math.random) {
  const tz = opts.timezone || 'UTC';
  const now = opts.now ?? Date.now();
  // Hard cap: never plan more than DAILY_PIN_LIMIT pins per account per day.
  const minPer = Math.max(1, Math.min(opts.minPerDay ?? 3, DAILY_PIN_LIMIT));
  const maxPer = Math.max(minPer, Math.min(opts.maxPerDay ?? minPer, DAILY_PIN_LIMIT));
  const windows = opts.windows?.length ? opts.windows : PRESETS.all_day.windows;
  const existing = [...(opts.existing || [])];
  const maxDays = opts.maxDays ?? 365;
  const queue = interleaveByLink(pins);
  const linkLastDay = new Map();   // link -> last day index used
  const linkBoards = new Map();    // link -> Map(boardId -> use count)
  const result = [];
  let day = opts.startDate || ymd(now, tz);
  for (let di = 0; queue.length && di < maxDays; di++, day = addDaysYmd(day, 1)) {
    const already = existing.filter((t) => ymd(t, tz) === day).length;
    const wanted = Math.min(randInt(rng, minPer, maxPer), DAILY_PIN_LIMIT - already);
    if (wanted <= 0) continue;
    const times = dayTimes(day, wanted, windows, tz, rng, { minGapMin: Math.max(MIN_GAP_MINUTES, opts.minGapMin ?? 20), avoid: existing })
      .filter((t) => t > now + 5 * 60000);
    const usedToday = new Set();
    for (const t of times) {
      // first pin whose link was not posted today or yesterday (anti-spam spacing)
      let idx = queue.findIndex((p) => {
        const k = normalizeLink(p.link);
        if (!k) return true;
        if (usedToday.has(k)) return false;
        const last = linkLastDay.get(k);
        return last === undefined || di - last >= 2;
      });
      if (idx === -1) idx = queue.findIndex((p) => !usedToday.has(normalizeLink(p.link)) || !normalizeLink(p.link));
      if (idx === -1) break;
      const [pin] = queue.splice(idx, 1);
      const k = normalizeLink(pin.link);
      if (k) { usedToday.add(k); linkLastDay.set(k, di); }
      result.push({ id: pin.id, scheduledAt: t, boardId: pickBoard(pin, k, linkBoards), day });
      existing.push(t);
    }
  }
  return result;
}

function pickBoard(pin, linkKey, linkBoards) {
  const boards = pin.boardIds?.length ? pin.boardIds : pin.boardId ? [pin.boardId] : [];
  if (!boards.length) return pin.boardId || null;
  if (!linkKey) return boards[0];
  if (!linkBoards.has(linkKey)) linkBoards.set(linkKey, new Map());
  const used = linkBoards.get(linkKey);
  let best = boards[0], bestN = Infinity;
  for (const b of boards) {
    const n = used.get(b) || 0;
    if (n < bestN) { best = b; bestN = n; }
  }
  used.set(best, bestN + 1);
  return best;
}

/** Retry backoff for failed posts: 5m, 15m, 45m, 2h15m, ... capped at 12h, with jitter. */
export function backoffMs(attempts, rng = Math.random) {
  const base = 5 * 60000 * Math.pow(3, Math.max(0, attempts - 1));
  const capped = Math.min(base, 12 * 3600000);
  return Math.round(capped * (0.85 + rng() * 0.3));
}

export const MAX_ATTEMPTS = 5;
