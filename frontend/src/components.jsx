import { useEffect, useState } from 'preact/hooks';
import { useStore } from './lib/store.js';

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  design: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z',
  layers: 'm12 2 10 5-10 5L2 7zm-10 10 10 5 10-5M2 17l10 5 10-5',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 11 5-5 4 4 3-3 4 4M15.5 9.5h.01',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  x: 'M18 6 6 18M6 6l12 12',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
  upload: 'M12 21V9m0 0-4 4m4-4 4 4M4 3h16',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.3-4.3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4l3 2',
  trash: 'M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14',
  check: 'M20 6 9 17l-5-5',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  plus: 'M12 5v14M5 12h14',
  shuffle: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
};

export function Icon({ name, size = 18, stroke = 2, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke}
      stroke-linecap="round" stroke-linejoin="round" style={style} aria-hidden="true">
      <path d={ICONS[name] || ''} />
    </svg>
  );
}

export function Logo({ small }) {
  return (
    <a class="logo" href="#/" aria-label="Tackly by AMAWP home">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#5847EB" />
            <stop offset="1" stop-color="#FF7A59" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <path d="M11 8h10l-2 6 3 3H10l3-3z" fill="#fff" />
        <path d="M16 17v8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" />
      </svg>
      <span>Tackly{!small && <small>by AMAWP</small>}</span>
    </a>
  );
}

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose && onClose();
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div class={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="modal-head">
          <h2>{title}</h2>
          {onClose && <button class="btn icon ghost" onClick={onClose} aria-label="Close"><Icon name="x" /></button>}
        </div>
        {children}
        {footer && <div class="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Toasts() {
  const s = useStore();
  return (
    <div class="toasts" aria-live="polite">
      {s.toasts.map((t) => <div key={t.id} class={`toast ${t.kind}`}>{t.message}</div>)}
    </div>
  );
}

export function Spinner() { return <span class="spinner" aria-label="Loading" />; }

export function StatusChip({ status, error }) {
  const map = { draft: ['', 'Draft'], scheduled: ['primary', 'Scheduled'], posting: ['warn', 'Posting…'], posted: ['ok', 'Posted'], failed: ['danger', 'Failed'] };
  const [cls, label] = map[status] || ['', status];
  return <span class={`chip ${cls}`} title={error || ''}>{label}</span>;
}

export function ThemeToggle() {
  const cur = document.documentElement.dataset.theme;
  const [isDark, setDark] = useState(cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <button class="btn icon ghost" aria-label="Toggle dark mode" title="Toggle dark mode" onClick={() => {
      const next = isDark ? 'light' : 'dark';
      setDark(!isDark);
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('tackly.theme', next); } catch { /* ignore */ }
      dispatchEvent(new Event('themechange'));
    }}>
      <Icon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}
