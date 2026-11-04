// Build-time SEO: JSON-LD (SoftwareApplication + FAQPage) and crawlable static content,
// generated from the FAQ in pages/Landing.jsx so they never go out of date.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function seoHead(siteUrl) {
  const src = readFileSync(fileURLToPath(new URL('./src/pages/Landing.jsx', import.meta.url)), 'utf8');
  const limits = readFileSync(fileURLToPath(new URL('../shared/limits.js', import.meta.url)), 'utf8');
  const DAILY_PIN_LIMIT = +(limits.match(/DAILY_PIN_LIMIT = (\d+)/) || [])[1] || 10;
  const m = src.match(/export const FAQ = \[([\s\S]*?)\n\];/);
  // eslint-disable-next-line no-new-func
  const FAQ = new Function('DAILY_PIN_LIMIT', `return [${m[1]}];`)(DAILY_PIN_LIMIT);
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Tackly by AMAWP', applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web', url: siteUrl,
      description: 'Free Pinterest pin designer, Pinterest SEO toolkit (keyword research, pin SEO score, seasonal planner) and safe auto-scheduler with Canva and AI assistant (MCP) integrations.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: 'AMAWP' },
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const head = `<link rel="canonical" href="${siteUrl}" />\n    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  const body = `<div id="seo-static" style="max-width:820px;margin:40px auto;padding:0 20px;font-family:system-ui,sans-serif;line-height:1.6">
      <h1>Tackly by AMAWP: free Pinterest pin designer, SEO toolkit and scheduler</h1>
      <p>Design scroll-stopping Pinterest pins with 21 free templates, research Pinterest keywords, score every pin for Pinterest SEO, upload Canva designs, connect AI assistants like Claude and ChatGPT over MCP, and auto-schedule pins safely at natural times.</p>
      <h2>Features</h2><ul><li>Pinterest keyword research with long-tail ideas and search intent</li><li>Pin SEO score with fixes for titles, descriptions, alt text and boards</li><li>Seasonal Pinterest planner and Rich Pins checker</li><li>21 premium 1000x1500 pin templates, brand kit and PNG export</li><li>Free AI titles, descriptions and images, free stock photos and images from your blog post</li><li>Bulk pin creation from links, keywords, CSV or Canva exports</li><li>Auto-scheduling with a safe limit of ${DAILY_PIN_LIMIT} pins per day per account</li><li>Your data stays in your browser or your own Cloudflare account</li></ul>
      <h2>Frequently asked questions</h2>${FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}
    </div>`;
  return { head, body };
}
