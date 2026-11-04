import { zonedParts, zonedToUtc } from '../../../shared/tz.js';

const pad = (n) => String(n).padStart(2, '0');

export function toLocalInput(ms, tz) {
  const p = zonedParts(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
export function fromLocalInput(str, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(str || '');
  if (!m) return null;
  return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], 0, tz);
}
export function fmtDateTime(ms, tz, opts = {}) {
  if (!ms) return '';
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...opts }).format(new Date(ms));
}
export function fmtTime(ms, tz) {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
}
export function fmtDay(ms, tz) {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(ms));
}
export function relative(ms) {
  const d = ms - Date.now();
  const abs = Math.abs(d);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 3600000) return rtf.format(Math.round(d / 60000), 'minute');
  if (abs < 86400000) return rtf.format(Math.round(d / 3600000), 'hour');
  return rtf.format(Math.round(d / 86400000), 'day');
}
export function nextRoundedSlot(tz, minutesAhead = 60) {
  return toLocalInput(Date.now() + minutesAhead * 60000, tz);
}
