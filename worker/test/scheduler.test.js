import { describe, it, expect } from 'vitest';
import { autoSchedule, dayTimes, mulberry32, interleaveByLink, backoffMs, PRESETS, normalizeLink } from '../../shared/scheduler.js';
import { zonedParts, zonedToUtc } from '../../shared/tz.js';

const NOW = Date.UTC(2026, 10, 4, 5, 0, 0); // 4 Nov 2026 00:00 New York

describe('timezone helpers', () => {
  it('converts wall-clock time to UTC across DST', () => {
    expect(zonedToUtc(2026, 7, 1, 12, 0, 0, 'America/New_York')).toBe(Date.UTC(2026, 6, 1, 16, 0, 0));
    expect(zonedToUtc(2026, 12, 1, 12, 0, 0, 'America/New_York')).toBe(Date.UTC(2026, 11, 1, 17, 0, 0));
    expect(zonedToUtc(2026, 12, 1, 12, 0, 0, 'Asia/Dhaka')).toBe(Date.UTC(2026, 11, 1, 6, 0, 0));
  });
});

describe('dayTimes', () => {
  it('keeps every time inside the active windows, spaced apart, with natural minutes', () => {
    const rng = mulberry32(42);
    const times = dayTimes('2026-11-10', 6, PRESETS.us_peak.windows, 'America/New_York', rng, { minGapMin: 20 });
    expect(times.length).toBe(6);
    for (const t of times) {
      const p = zonedParts(t, 'America/New_York');
      const inWindow = PRESETS.us_peak.windows.some(([s, e]) => p.hour >= s && p.hour < e);
      expect(inWindow).toBe(true);
      expect(p.minute % 15).not.toBe(0); // never round :00/:15/:30/:45 slots
    }
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(20 * 60000);
  });
  it('gives different times on different days (no fixed identical slots)', () => {
    const rng = mulberry32(7);
    const a = dayTimes('2026-11-10', 4, [[9, 21]], 'UTC', rng).map((t) => t % 86400000);
    const b = dayTimes('2026-11-11', 4, [[9, 21]], 'UTC', rng).map((t) => t % 86400000);
    expect(a).not.toEqual(b);
  });
});

describe('autoSchedule', () => {
  const pins = Array.from({ length: 30 }, (_, i) => ({
    id: `p${i}`, link: `https://site.com/post-${i % 5}`, boardIds: ['b1', 'b2', 'b3'],
  }));
  const opts = { timezone: 'America/New_York', minPerDay: 3, maxPerDay: 5, windows: [[8, 22]], now: NOW, startDate: '2026-11-05' };

  it('schedules every pin within the per-day range', () => {
    const plan = autoSchedule(pins, opts, mulberry32(1));
    expect(plan.length).toBe(30);
    const perDay = {};
    for (const s of plan) perDay[s.day] = (perDay[s.day] || 0) + 1;
    for (const n of Object.values(perDay)) expect(n).toBeLessThanOrEqual(5);
    expect(new Set(plan.map((s) => s.scheduledAt)).size).toBe(30);
  });

  it('never posts the same link twice on the same day', () => {
    const plan = autoSchedule(pins, opts, mulberry32(2));
    const seen = new Set();
    for (const s of plan) {
      const link = normalizeLink(pins.find((p) => p.id === s.id).link);
      const key = `${s.day}|${link}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('rotates boards for the same link', () => {
    const plan = autoSchedule(pins, opts, mulberry32(3));
    const boardsForLink0 = plan.filter((s) => pins.find((p) => p.id === s.id).link.endsWith('post-0')).map((s) => s.boardId);
    expect(new Set(boardsForLink0).size).toBe(3);
  });

  it('never schedules in the past and avoids existing pins', () => {
    const existing = [zonedToUtc(2026, 11, 5, 12, 0, 0, 'America/New_York')];
    const plan = autoSchedule(pins.slice(0, 5), { ...opts, existing, startDate: undefined }, mulberry32(4));
    for (const s of plan) {
      expect(s.scheduledAt).toBeGreaterThan(NOW);
      expect(Math.abs(s.scheduledAt - existing[0])).toBeGreaterThanOrEqual(20 * 60000);
    }
  });

  it('interleaves duplicate links', () => {
    const out = interleaveByLink([
      { id: 1, link: 'a' }, { id: 2, link: 'a' }, { id: 3, link: 'a' }, { id: 4, link: 'b' }, { id: 5, link: 'c' },
    ]);
    expect(out.map((p) => p.link)).toEqual(['a', 'b', 'c', 'a', 'a']);
  });
});

describe('retry backoff', () => {
  it('grows and is capped', () => {
    const r = () => 0.5;
    expect(backoffMs(1, r)).toBe(5 * 60000);
    expect(backoffMs(2, r)).toBe(15 * 60000);
    expect(backoffMs(10, r)).toBe(12 * 3600000);
  });
});
