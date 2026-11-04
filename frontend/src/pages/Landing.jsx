import { useEffect, useRef } from 'preact/hooks';
import { Logo, ThemeToggle } from '../components.jsx';
import { useStore } from '../lib/store.js';
import { newDesign, TEMPLATES } from '../designer/templates.js';
import { renderDesign } from '../designer/render.js';

export const FAQ = [
  ['Is Tackly really free?', 'Yes. The free plan includes 1 Pinterest account, every free template, the brand kit, AI text and images, bulk creation and unlimited scheduling. No credit card. Paid plans will add more accounts and extras later. Everything free today stays free.'],
  ['Do I need design skills?', 'No. Pick a template, swap the text and image, choose a colour palette and font pairing, and you are done. Every template is built at Pinterest’s recommended 1000 × 1500 (2:3) size.'],
  ['How does the free AI work?', 'By default Tackly uses Pollinations.ai, a free and open AI service, to write titles, descriptions and alt text and to create images. If you prefer, add your own OpenAI-compatible API key in Settings. Keys are encrypted on our server and never shown back in full.'],
  ['Will auto-scheduling look spammy?', 'No. Auto-schedule spreads pins across your active hours with natural, random minutes instead of fixed slots. It keeps the same link off the same day and rotates it across different boards.'],
  ['Is this an official Pinterest product?', 'No. Tackly is an independent tool made by AMAWP. It connects to your account through Pinterest’s official API and only uses the permissions you approve. You can disconnect at any time.'],
  ['What happens to my data?', 'We store only what is needed to design and post your pins. Pinterest tokens are encrypted. You can export or permanently delete your data at any time from Settings. See our privacy policy for details.'],
  ['Where are the images stored?', 'Pin images are kept in short-term storage only until they are posted, then deleted. Pinterest receives the image directly, so nothing has to be hosted on a public website.'],
];

const FEATURES = [
  ['✦', 'Premium pin templates', '18 polished 2:3 templates: photo headlines, checklists, steps, before/after, top 3, cheat sheets, collages, recipes, infographics and more.'],
  ['◎', 'Brand kit', 'Save your logo, website, colours and fonts once. Every pin stays on brand automatically.'],
  ['✧', 'Free AI copy + images', 'Keyword-rich titles, descriptions, alt text and board ideas, plus AI images. Free by default, or bring your own key.'],
  ['⌕', 'Free stock photos', 'Search millions of openly licensed images with no key, or connect your own Unsplash, Pexels or Pixabay key.'],
  ['▦', 'Bulk mode', 'Paste a list of URLs and titles or a CSV and get dozens of on-brand pins from one template in seconds.'],
  ['◷', 'Smart auto-schedule', 'Choose pins per day and active hours, or use the US peak-times preset. Times look natural, never robotic.'],
  ['⇄', 'Anti-spam spreading', 'The same link is spread across different boards and days automatically, the way Pinterest likes it.'],
  ['▤', 'Calendar + queue', 'Drag pins to reschedule, edit, post now, retry failures and see a full post log.'],
  ['⛨', 'Private and secure', 'Encrypted tokens, hashed passwords and one-click data deletion. Built on Cloudflare’s global network.'],
];

function HeroArt() {
  const refs = [useRef(), useRef(), useRef()];
  useEffect(() => {
    const picks = [
      { ...newDesign('checklist'), paletteId: 'sage', fontPairId: 'friendly' },
      { ...newDesign('hero-overlay'), paletteId: 'peach', fontPairId: 'editorial' },
      { ...newDesign('big-stat'), paletteId: 'midnight', fontPairId: 'modern' },
    ];
    picks.forEach((d, i) => refs[i].current && renderDesign(refs[i].current, { ...d, showPlaceholderHint: false }));
  }, []);
  return (
    <div class="hero-art" aria-hidden="true">
      {refs.map((r, i) => <canvas key={i} ref={r} width="1000" height="1500" />)}
    </div>
  );
}

function TemplateStrip() {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const palettes = ['blush', 'ocean', 'terracotta', 'lavender', 'forest', 'lemon', 'ink', 'berry'];
    const fonts = ['modern', 'elegant', 'bold', 'classic', 'retro', 'grotesk', 'fraunces', 'impact'];
    [...el.querySelectorAll('canvas')].forEach((c, i) => {
      const t = TEMPLATES.filter((x) => x.tier === 'free')[i];
      renderDesign(c, { ...newDesign(t.id), paletteId: palettes[i % 8], fontPairId: fonts[i % 8], showPlaceholderHint: false });
    });
  }, []);
  const n = Math.min(8, TEMPLATES.filter((x) => x.tier === 'free').length);
  return (
    <div ref={ref} class="bulk-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', marginTop: 30 }}>
      {Array.from({ length: n }, (_, i) => <canvas key={i} width="1000" height="1500" />)}
    </div>
  );
}

export function Landing() {
  const s = useStore();
  const appLink = s.user ? '#/app' : '#/signup';
  return (
    <div>
      <header class="site-nav">
        <div class="inner">
          <Logo />
          <nav>
            <a class="plain" href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features').scrollIntoView({ behavior: 'smooth' }); }}>Features</a>
            <a class="plain" href="#compare" onClick={(e) => { e.preventDefault(); document.getElementById('compare').scrollIntoView({ behavior: 'smooth' }); }}>Compare</a>
            <a class="plain" href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' }); }}>Pricing</a>
            <ThemeToggle />
            {s.user ? <a class="btn primary sm" href="#/app">Open app</a> : <>
              <a class="plain" href="#/login">Sign in</a>
              <a class="btn primary sm" href="#/signup">Start free</a>
            </>}
          </nav>
        </div>
      </header>

      <section class="hero">
        <div class="blob" style={{ width: 420, height: 420, background: 'var(--primary)', left: -120, top: -60 }} />
        <div class="blob" style={{ width: 360, height: 360, background: 'var(--accent)', right: -80, top: 120 }} />
        <div class="container hero-grid">
          <div>
            <div class="eyebrow">Free Pinterest pin designer + scheduler</div>
            <h1 class="display">Design scroll-stopping pins. <em>Schedule them free.</em></h1>
            <p class="lead">Tackly gives you premium pin templates, free AI copy and images, bulk creation and smart auto-scheduling in one simple tool, free forever for one Pinterest account.</p>
            <div class="row" style={{ marginTop: 26 }}>
              <a class="btn primary lg" href={appLink}>Create your first pin, free</a>
              <a class="btn ghost lg" href="#/app/design" onClick={(e) => { if (!s.user) { e.preventDefault(); location.hash = '/signup'; } }}>Try the designer</a>
            </div>
            <div class="trust"><span>No credit card</span><span>Unlimited scheduled pins</span><span>Free AI built in</span></div>
          </div>
          <HeroArt />
        </div>
      </section>

      <section class="section alt" id="features">
        <div class="container">
          <div class="eyebrow">Everything in the free plan</div>
          <h2>The pin studio other tools charge for</h2>
          <p class="muted" style={{ maxWidth: 640 }}>Most schedulers give you a few posts a month for free and send you to another app to design. Tackly gives you the whole workflow: design, write, schedule and post.</p>
          <div class="feature-grid">
            {FEATURES.map(([ico, t, d]) => (
              <div class="feature" key={t}><div class="ico">{ico}</div><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
          <TemplateStrip />
        </div>
      </section>

      <section class="section" id="compare">
        <div class="container">
          <div class="eyebrow">Free plan vs free plan</div>
          <h2>More free than the big names</h2>
          <div class="table-wrap">
            <table class="compare">
              <thead><tr><th>Free plan includes</th><th class="us">Tackly</th><th>Tailwind Free</th><th>Buffer Free</th><th>Pinterest native</th></tr></thead>
              <tbody>
                <tr><td>Scheduled pins</td><td class="us">Unlimited</td><td>~5 / month</td><td>10 queued per channel</td><td>~10 queued</td></tr>
                <tr><td>Pin designer + templates</td><td class="us">18 premium templates</td><td>Limited</td><td>—</td><td>—</td></tr>
                <tr><td>Brand kit</td><td class="us">✓</td><td>Paid</td><td>—</td><td>—</td></tr>
                <tr><td>AI titles, descriptions, alt text</td><td class="us">✓ Free</td><td>5 credits / month</td><td>Limited</td><td>—</td></tr>
                <tr><td>AI image generation</td><td class="us">✓ Free</td><td>—</td><td>—</td><td>—</td></tr>
                <tr><td>Bulk create from CSV / URLs</td><td class="us">✓</td><td>Paid</td><td>—</td><td>—</td></tr>
                <tr><td>Auto-schedule with natural times</td><td class="us">✓</td><td>Paid</td><td>Fixed slots</td><td>—</td></tr>
                <tr><td>Same-link spreading across boards</td><td class="us">✓</td><td>Paid</td><td>—</td><td>—</td></tr>
              </tbody>
            </table>
          </div>
          <p class="tiny faint" style={{ marginTop: 10 }}>Competitor details are from their public pricing information as of November 2026 and may change. Tailwind, Buffer and Pinterest are trademarks of their owners; Tackly is not affiliated with them.</p>
        </div>
      </section>

      <section class="section alt" id="pricing">
        <div class="container">
          <div class="eyebrow">Pricing</div>
          <h2>Start free. Upgrade only if you need more accounts.</h2>
          <div class="pricing">
            <div class="price-card featured">
              <span class="chip primary">Available now</span>
              <h3 style={{ marginTop: 12 }}>Free</h3>
              <div class="price">$0</div>
              <div class="muted small">forever</div>
              <ul>
                <li>1 Pinterest account</li><li>Unlimited scheduled pins</li><li>18 premium templates</li>
                <li>Brand kit</li><li>Free AI text + images</li><li>Bulk mode + auto-schedule</li>
              </ul>
              <a class="btn primary block" href={appLink}>Get started free</a>
            </div>
            <div class="price-card">
              <span class="chip">Coming soon</span>
              <h3 style={{ marginTop: 12 }}>Pro</h3>
              <div class="price">TBA</div>
              <div class="muted small">based on demand</div>
              <ul><li>Up to 5 Pinterest accounts</li><li>One-click AI-generated pins</li><li>Pro templates</li><li>Everything in Free</li></ul>
              <a class="btn ghost block" href="#/upgrade">Join the waitlist</a>
            </div>
            <div class="price-card">
              <span class="chip">Coming soon</span>
              <h3 style={{ marginTop: 12 }}>Agency</h3>
              <div class="price">TBA</div>
              <div class="muted small">for teams</div>
              <ul><li>25 Pinterest accounts</li><li>Team members</li><li>Deeper analytics</li><li>Everything in Pro</li></ul>
              <a class="btn ghost block" href="#/upgrade">Join the waitlist</a>
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="faq">
        <div class="container" style={{ maxWidth: 820 }}>
          <div class="eyebrow">FAQ</div>
          <h2>Questions, answered</h2>
          <div class="faq">
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>

      <section class="container">
        <div class="cta-band">
          <h2 style={{ color: '#fff' }}>Your next 30 days of pins, done this afternoon.</h2>
          <p style={{ opacity: 0.9 }}>Free forever for one Pinterest account. No credit card.</p>
          <a class="btn lg" href={appLink}>Start free with Tackly</a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer class="site-footer">
      <div class="container cols">
        <div class="stack" style={{ gap: 8 }}>
          <Logo />
          <span class="small">A free Pinterest pin designer and scheduler by AMAWP.</span>
          <span class="tiny faint">Not affiliated with or endorsed by Pinterest. Pinterest is a trademark of Pinterest, Inc.</span>
        </div>
        <div class="row" style={{ gap: 20, alignItems: 'flex-start' }}>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
          <a href="#/data-deletion">Data deletion</a>
          <a href="#/upgrade">Waitlist</a>
        </div>
      </div>
      <div class="container tiny faint" style={{ marginTop: 20 }}>© {new Date().getFullYear()} AMAWP. All rights reserved.</div>
    </footer>
  );
}
