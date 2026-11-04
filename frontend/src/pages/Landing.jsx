import { useEffect, useRef } from 'preact/hooks';
import { Logo, ThemeToggle } from '../components.jsx';
import { newDesign, TEMPLATES } from '../designer/templates.js';
import { renderDesign } from '../designer/render.js';
import { RANKING_TIPS } from '../../../shared/seo.js';
import { DAILY_PIN_LIMIT } from '../../../shared/limits.js';

export const FAQ = [
  ['Is Tackly really free?', 'Yes. Every feature is free: the pin designer and all templates, keyword research, the SEO checker, AI writing and images, bulk creation, Canva uploads, auto-scheduling and AI-assistant (MCP) access. No credit card, no trial.'],
  ['What is the best way to get more Pinterest traffic?', 'Treat Pinterest like a search engine. Research what people search, put that keyword in your pin title, description, board name and the text on the image, publish fresh designs consistently, and plan seasonal content 60–90 days early. Tackly guides every step.'],
  ['How does Pinterest keyword research work in Tackly?', 'Type a topic and Tackly gathers real search suggestions (from Pinterest when available, plus Google and Bing) and AI ideas, then ranks long-tail keywords by demand, relevance and intent. Save them, export them for Canva, or turn them into pins in bulk.'],
  ['Can I use Canva with Tackly?', 'Yes, with Canva Free or Pro. Design in Canva using the Pinterest Pin size, download your pages (Canva gives a .zip for many pages) and upload them to Tackly. AI writes the SEO titles and descriptions, and Tackly schedules them safely. Canva Pro users can export our keyword CSV into Canva Bulk Create.'],
  ['Can Claude, ChatGPT or Codex create pins for me?', 'Yes. Tackly includes an MCP server, the open standard AI assistants use to connect to tools. Connect Claude, ChatGPT (developer mode), Codex, Cursor or any MCP client and ask it to research keywords, design pins with Tackly templates, write SEO copy and schedule them.'],
  ['Where is my data stored?', 'Not on our servers. By default everything stays in your own browser. For 24/7 posting you can connect your own free Cloudflare account in a few clicks. Your pins, images and Pinterest login then live in your account, not ours.'],
  ['Why only 10 pins per day?', `Pinterest rewards steady, fresh pinning and can flag bursts as spam. Tackly publishes at most ${DAILY_PIN_LIMIT} pins per Pinterest account per 24 hours, at natural random times, so your account stays healthy. You can store and schedule thousands of pins; they simply wait for the next safe slot.`],
  ['Is it safe to connect my Pinterest account?', 'Tackly uses Pinterest’s official API and only the permissions it needs: read boards, create boards you ask for, publish your pins and read their stats. Your login is encrypted, and you can disconnect any time in Tackly or in Pinterest settings.'],
  ['What are the free AI images like?', 'Free AI images come from Pollinations.ai and work well for backgrounds and lifestyle shots. When you want real photos, use free stock photos, the images from your own blog post, your own uploads or your own AI provider key.'],
  ['What size should Pinterest pins be?', 'Use a 2:3 vertical ratio, 1000 × 1500 pixels. Every Tackly template is built at that size, and the designer exports high-quality PNGs.'],
  ['Is Tackly an official Pinterest product?', 'No. Tackly is an independent tool by AMAWP that connects through Pinterest’s official API. Pinterest is a trademark of Pinterest, Inc.'],
  ['Do I need design skills?', 'No. Pick a template, add your headline and image, choose a palette and font pairing, and you are done. Save your brand kit once and every pin stays on brand.'],
];

const FEATURES = [
  ['✦', '21 premium pin templates', 'Photo headlines, checklists, numbered steps, before/after, this-vs-that, top 3, cheat sheets, collages, recipes, infographics, quotes, magazine covers and more.'],
  ['⌕', 'Pinterest keyword research', 'Long-tail keyword ideas ranked by demand, relevance and intent, with Pinterest Trends when available.'],
  ['◎', 'Pin SEO score', 'Every pin gets a 0–100 Pinterest SEO score with exact fixes for title, description, alt text, link, board and on-image text.'],
  ['✧', 'Free AI copy & images', 'Keyword-rich titles, descriptions, alt text, headlines and board ideas, plus AI images. Free by default, or use your own AI key.'],
  ['▣', 'Images your way', 'Free stock photos, the featured image from your blog post, uploads, links or AI. Pick what looks best.'],
  ['▦', 'Bulk + Canva upload', 'Turn a list of links or keywords into dozens of pins, or upload a Canva .zip and let AI write the SEO copy.'],
  ['◷', 'Natural auto-schedule', 'Choose pins per day and active hours or the US peak-times preset. Random human-like times, never robotic slots.'],
  ['⇄', 'Anti-spam by design', `Max ${DAILY_PIN_LIMIT} pins a day per account, spaced out, and the same link never twice a day: what Pinterest likes.`],
  ['⛨', 'Your data, your account', 'No sign-up wall. Pins live in your browser or your own free Cloudflare. We keep nothing.'],
];

const STEPS = [
  ['Research', 'Find the exact phrases people type into Pinterest for your topic.'],
  ['Design', 'Create fresh 1000×1500 pins in Tackly or upload your Canva designs.'],
  ['Optimise', 'AI writes the copy; the SEO score shows what to fix before you post.'],
  ['Schedule', 'Auto-schedule at natural times. Tackly posts steadily, safely and on time.'],
];

function HeroArt() {
  const refs = [useRef(), useRef(), useRef()];
  useEffect(() => {
    const picks = [
      { ...newDesign('checklist'), paletteId: 'sage', fontPairId: 'friendly' },
      { ...newDesign('hero-overlay'), paletteId: 'peach', fontPairId: 'editorial' },
      { ...newDesign('infographic'), paletteId: 'midnight', fontPairId: 'modern' },
    ];
    picks.forEach((d, i) => refs[i].current && renderDesign(refs[i].current, { ...d, showPlaceholderHint: false }));
  }, []);
  return <div class="hero-art" aria-hidden="true">{refs.map((r, i) => <canvas key={i} ref={r} width="1000" height="1500" />)}</div>;
}

function TemplateStrip() {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const palettes = ['blush', 'ocean', 'terracotta', 'lavender', 'forest', 'lemon', 'ink', 'berry'];
    const fonts = ['modern', 'elegant', 'bold', 'classic', 'retro', 'grotesk', 'fraunces', 'impact'];
    const list = ['split-band', 'numbered-steps', 'before-after', 'top-three', 'recipe', 'magazine', 'collage-4', 'gradient-poster'];
    [...el.querySelectorAll('canvas')].forEach((c, i) => renderDesign(c, { ...newDesign(list[i]), paletteId: palettes[i], fontPairId: fonts[i], showPlaceholderHint: false }));
  }, []);
  return (
    <div ref={ref} class="bulk-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', marginTop: 30 }}>
      {Array.from({ length: 8 }, (_, i) => <canvas key={i} width="1000" height="1500" aria-label="Pin template example" />)}
    </div>
  );
}

const scrollTo = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

export function Landing() {
  return (
    <div>
      <header class="site-nav">
        <div class="inner">
          <Logo />
          <nav>
            <a class="plain" href="#features" onClick={scrollTo('features')}>Features</a>
            <a class="plain" href="#seo" onClick={scrollTo('seo')}>Pinterest SEO</a>
            <a class="plain" href="#ai" onClick={scrollTo('ai')}>Canva & AI</a>
            <a class="plain" href="#guide" onClick={scrollTo('guide')}>Guide</a>
            <ThemeToggle />
            <a class="btn primary sm" href="#/app">Open Tackly</a>
          </nav>
        </div>
      </header>

      <section class="hero">
        <div class="blob" style={{ width: 420, height: 420, background: 'var(--primary)', left: -120, top: -60 }} />
        <div class="blob" style={{ width: 360, height: 360, background: 'var(--accent)', right: -80, top: 120 }} />
        <div class="container hero-grid">
          <div>
            <div class="eyebrow">Free Pinterest pin designer, SEO toolkit & scheduler</div>
            <h1 class="display">Pins people actually find. <em>Designed, optimised, scheduled.</em></h1>
            <p class="lead">Tackly is the free Pinterest marketing studio: keyword research, premium pin templates, an SEO score for every pin, Canva and AI-assistant integrations, and safe auto-scheduling that grows real traffic.</p>
            <div class="row" style={{ marginTop: 26 }}>
              <a class="btn primary lg" href="#/app/design">Create a pin, free</a>
              <a class="btn ghost lg" href="#/app/seo">Try keyword research</a>
            </div>
            <div class="trust"><span>No sign-up needed</span><span>Your data stays yours</span><span>Works with Canva & Claude</span></div>
          </div>
          <HeroArt />
        </div>
      </section>

      <section class="section alt">
        <div class="container">
          <div class="eyebrow">How it works</div>
          <h2>From keyword to traffic in four steps</h2>
          <div class="feature-grid steps-grid">
            {STEPS.map(([t, d], i) => <div class="feature" key={t}><div class="ico">{i + 1}</div><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </div>
      </section>

      <section class="section" id="features">
        <div class="container">
          <div class="eyebrow">Everything included, free</div>
          <h2>A complete Pinterest studio, not just a scheduler</h2>
          <p class="muted" style={{ maxWidth: 680 }}>Scheduling alone doesn’t bring visitors. Pins rank when they match what people search, look fresh and are published steadily. Tackly is built around that.</p>
          <div class="feature-grid">
            {FEATURES.map(([ico, t, d]) => <div class="feature" key={t}><div class="ico">{ico}</div><h3>{t}</h3><p>{d}</p></div>)}
          </div>
          <TemplateStrip />
        </div>
      </section>

      <section class="section alt" id="seo">
        <div class="container grid-2" style={{ alignItems: 'center', gap: 40 }}>
          <div>
            <div class="eyebrow">Pinterest SEO power</div>
            <h2>Rank pins in Pinterest search</h2>
            <p class="muted">Pinterest is a visual search engine with hundreds of millions of monthly searches. Tackly gives you the SEO tools bloggers and shops use to get found:</p>
            <ul class="muted" style={{ paddingLeft: 18, display: 'grid', gap: 8 }}>
              <li><b>Keyword research:</b> long-tail search phrases ranked by demand and intent.</li>
              <li><b>Pin SEO score:</b> 15 ranking checks with exact fixes before you publish.</li>
              <li><b>Seasonal planner:</b> know what to pin 60–90 days before each holiday peak.</li>
              <li><b>Rich Pins checker:</b> confirm your site sends titles and descriptions to Pinterest.</li>
              <li><b>Board SEO:</b> AI board names and descriptions built around real searches.</li>
            </ul>
            <a class="btn primary" href="#/app/seo">Open the SEO toolkit</a>
          </div>
          <div class="card stack">
            <b>Example SEO checks</b>
            {['Main keyword at the start of the title', 'Keyword in the first sentence of the description', '2+ related long-tail keywords', 'Keyword in the text on the image', 'Board name matches the keyword', 'Alt text describes the image', 'Direct https link (no shorteners)', 'No hashtag stuffing'].map((x) => (
              <div key={x} class="row nowrap small"><span style={{ color: 'var(--ok)', fontWeight: 800 }}>✓</span><span>{x}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section class="section" id="ai">
        <div class="container grid-2" style={{ alignItems: 'start', gap: 40 }}>
          <div class="stack">
            <div class="eyebrow">Canva integration</div>
            <h2>Design in Canva, rank with Tackly</h2>
            <p class="muted">Keep designing in Canva Free or Pro. Upload your PNGs or the .zip Canva exports, and Tackly writes keyword-rich SEO copy for each design and schedules them safely. Canva Pro users can feed Tackly keyword lists straight into Canva Bulk Create.</p>
            <a class="btn ghost" href="#/app/integrations">See the Canva workflow</a>
          </div>
          <div class="stack">
            <div class="eyebrow">AI assistants (MCP)</div>
            <h2>Let Claude, ChatGPT or Codex make pins</h2>
            <p class="muted">Connect any AI assistant that supports MCP. Ask it to read your blog post, research keywords, design several fresh pins with Tackly templates, score them for SEO and schedule them for the week, all within safe daily limits.</p>
            <a class="btn ghost" href="#/app/integrations?tab=ai">Connect an AI assistant</a>
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="container grid-2" style={{ alignItems: 'start', gap: 40 }}>
          <div class="stack">
            <div class="eyebrow">Privacy first</div>
            <h2>Your pins live in your account, not ours</h2>
            <p class="muted">Tackly keeps nothing on our servers. Your pins, images, brand kit and Pinterest login are stored in your own browser, or in your own free Cloudflare account if you want 24/7 posting. Export or delete everything any time.</p>
          </div>
          <div class="stack">
            <div class="eyebrow">Who it’s for</div>
            <h2>Built for people who want Pinterest traffic</h2>
            <ul class="muted" style={{ paddingLeft: 18, display: 'grid', gap: 8, margin: 0 }}>
              <li><b>Bloggers</b> who want steady visits to every post.</li>
              <li><b>Etsy, Shopify and WooCommerce sellers</b> promoting products.</li>
              <li><b>Affiliate marketers</b> building evergreen traffic.</li>
              <li><b>Creators and coaches</b> growing an email list.</li>
              <li><b>Small businesses</b> showing up where people plan purchases.</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="section" id="guide">
        <div class="container" style={{ maxWidth: 860 }}>
          <article class="stack">
            <div class="eyebrow">Free guide</div>
            <h2>How to rank pins on Pinterest in 2026</h2>
            <p class="muted">Pinterest decides which pins to show using what you write (keywords), what your image looks like (freshness and text on the image), and how people react in the first hours. Here is the checklist we built Tackly around:</p>
            {RANKING_TIPS.map(([t, d], i) => (
              <div key={t}>
                <h3 style={{ marginBottom: 4 }}>{i + 1}. {t}</h3>
                <p class="muted" style={{ margin: 0 }}>{d}</p>
              </div>
            ))}
            <h3 style={{ marginTop: 10 }}>A simple weekly Pinterest routine</h3>
            <ol class="muted" style={{ paddingLeft: 18 }}>
              <li>Pick 3–5 keywords with Tackly keyword research (include one seasonal topic).</li>
              <li>Make 2–3 fresh pin designs per blog post or product, each with the keyword in the headline.</li>
              <li>Let AI write the description, then raise the SEO score to 85+.</li>
              <li>Auto-schedule 3–10 pins a day at natural times, spread across relevant boards.</li>
              <li>Check pin stats after 30 days and make new designs for the winners.</li>
            </ol>
            <div><a class="btn primary" href="#/app/seo">Start with keyword research</a></div>
          </article>
        </div>
      </section>

      <section class="section alt" id="faq">
        <div class="container" style={{ maxWidth: 820 }}>
          <div class="eyebrow">FAQ</div>
          <h2>Questions, answered</h2>
          <div class="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </div>
      </section>

      <section class="container" style={{ marginTop: 60 }}>
        <div class="cta-band">
          <h2 style={{ color: '#fff' }}>Your next 30 days of Pinterest, planned this afternoon.</h2>
          <p style={{ opacity: 0.9 }}>Free. No sign-up wall. Your data stays yours.</p>
          <a class="btn lg" href="#/app">Open Tackly</a>
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
          <span class="small">Free Pinterest pin designer, SEO toolkit and scheduler by AMAWP.</span>
          <span class="tiny faint">Not affiliated with or endorsed by Pinterest or Canva. Pinterest is a trademark of Pinterest, Inc. Canva is a trademark of Canva Pty Ltd.</span>
        </div>
        <div class="row" style={{ gap: 20, alignItems: 'flex-start' }}>
          <a href="#/app/seo">Keyword research</a>
          <a href="#/app/integrations">Canva & AI</a>
          <a href="#/privacy">Privacy</a>
          <a href="#/terms">Terms</a>
          <a href="#/data-deletion">Data deletion</a>
        </div>
      </div>
      <div class="container tiny faint" style={{ marginTop: 20 }}>© {new Date().getFullYear()} AMAWP.</div>
    </footer>
  );
}

export const TEMPLATE_COUNT = TEMPLATES.length;
