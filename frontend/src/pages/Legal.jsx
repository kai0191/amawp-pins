import { Logo, ThemeToggle } from '../components.jsx';
import { SiteFooter } from './Landing.jsx';
import { CONTACT_EMAIL, REPO_URL } from '../lib/config.js';

const UPDATED = '4 November 2026';
const contact = (
  <>{CONTACT_EMAIL && <>email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or </>}open an issue on our <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener">GitHub page</a></>
);

function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p class="muted">Last updated: {UPDATED}</p>
      <p>Tackly is a free Pinterest pin designer, SEO toolkit and scheduler made by AMAWP. It is built so that <b>we do not store your content or account data on our servers</b>.</p>
      <h2>Where your data lives</h2>
      <ul>
        <li><b>This browser (default):</b> your pins, images, brand kit, settings, AI keys and sealed Pinterest connection are saved in your browser’s storage (IndexedDB). We cannot see them.</li>
        <li><b>Your own Cloudflare engine (optional):</b> if you connect one, the same data is stored in your own Cloudflare account. You control it and can delete it at any time.</li>
      </ul>
      <h2>What our server (the Tackly relay) processes</h2>
      <ul>
        <li><b>Pinterest connection:</b> when you connect Pinterest, our relay exchanges the login code for tokens and immediately returns them to you <i>encrypted</i> (AES-256-GCM). The relay keeps no copy. When you publish or load boards, your browser or engine sends the encrypted token; the relay uses it for that single request.</li>
        <li><b>Safety-limit counters:</b> to protect accounts from spam flags, the relay counts pins published per Pinterest account in the last 24 hours. It stores only a salted one-way hash of the Pinterest account ID and the time of each publish, deleted after 2 days.</li>
        <li><b>Abuse prevention:</b> short-lived per-IP request counters (reset daily) and daily aggregate totals (for example “pins published today”) with no personal data.</li>
        <li><b>Helper lookups:</b> keyword research sends your keyword to Google and Bing suggestion services (and Pinterest when connected); “From post” and the Rich Pins check fetch the public web page you enter. Results are cached briefly and contain no personal data.</li>
      </ul>
      <h2>How we use Pinterest data</h2>
      <p>With the permissions you approve (boards:read, boards:write, pins:read, pins:write, user_accounts:read) Tackly shows your boards, creates boards you ask for, publishes the pins you create or schedule, and shows stats for pins you posted with Tackly. We never sell or share Pinterest data or use it for advertising.</p>
      <h2>AI features</h2>
      <p>Text you send to AI tools (topics, headlines, keywords) goes to Pollinations.ai by default or to the AI provider you configure. Don’t include personal or sensitive information in prompts. AI assistants you connect over MCP act on your behalf in your own engine.</p>
      <h2>Hosting and cookies</h2>
      <p>The website is hosted on GitHub Pages and the relay on Cloudflare; both process technical data such as IP addresses under their own terms. We use no advertising or analytics cookies.</p>
      <h2>Your choices</h2>
      <p>Export or delete your data any time in Settings. Disconnect Pinterest in Tackly or revoke access in Pinterest settings. See <a href="#/data-deletion">data deletion</a>.</p>
      <h2>Children</h2>
      <p>Tackly is not intended for children under 16.</p>
      <h2>Contact</h2>
      <p>For privacy questions, {contact}.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p class="muted">Last updated: {UPDATED}</p>
      <p>By using Tackly you agree to these terms. If you do not agree, please do not use the service.</p>
      <h2>The service</h2>
      <p>Tackly lets you research, design and schedule pins for your own Pinterest account, free of charge. It is provided "as is".</p>
      <h2>Your account</h2>
      <ul>
        <li>You are responsible for your account and for keeping your password safe.</li>
        <li>You must follow Pinterest’s Terms of Service, Community Guidelines and Developer Guidelines when publishing content through Tackly.</li>
        <li>Only connect Pinterest accounts that you own or are authorised to manage.</li>
      </ul>
      <h2>Your content</h2>
      <p>You keep all rights to the content you create. You grant us only the permission needed to store, process and publish it to Pinterest on your instructions. You confirm you have the rights to every image, logo and text you use, including stock and AI-generated images (check each image’s licence).</p>
      <h2>Acceptable use</h2>
      <p>Do not use Tackly for spam, misleading links, malware, illegal content, harassment, or to get around Pinterest’s rate limits or rules. We may suspend accounts that abuse the service.</p>
      <h2>Availability and liability</h2>
      <p>We work hard to post every pin on time but cannot guarantee it: Pinterest or other providers may be unavailable or may reject content. To the extent permitted by law, AMAWP is not liable for indirect or consequential losses.</p>
      <h2>Fair use and safety limits</h2>
      <p>To protect Pinterest accounts and our Pinterest developer access, Tackly publishes at most 10 pins per Pinterest account in any 24 hours, spaced apart. Attempts to bypass these limits or to use Tackly for spam lead to blocked access.</p>
      <h2>Your own engine</h2>
      <p>If you deploy the optional Tackly engine, it runs in your own Cloudflare account under Cloudflare's terms, and you are responsible for that account.</p>
      <h2>Not affiliated with Pinterest</h2>
      <p>Tackly is an independent product and is not affiliated with, endorsed or sponsored by Pinterest, Inc.</p>
      <h2>Changes and contact</h2>
      <p>We may update these terms and will post the new date above. Questions? {contact}.</p>
    </>
  );
}

function DataDeletion() {
  return (
    <>
      <h1>Data Deletion</h1>
      <p class="muted">Last updated: {UPDATED}</p>
      <p>Tackly does not keep your content on our servers, so you are always in control of deletion.</p>
      <h2>Data in your browser</h2>
      <ol>
        <li>Open Tackly → <b>Settings</b>.</li>
        <li>Under <b>Backup & privacy</b>, click <b>Delete all data in this browser</b> and confirm.</li>
      </ol>
      <p>This removes your pins, images, brand kit, AI keys and the encrypted Pinterest connection from this browser. Clearing your browser’s site data does the same.</p>
      <h2>Data in your own Cloudflare engine</h2>
      <p>Your engine runs in your Cloudflare account. Delete it in the Cloudflare dashboard: <b>Workers & Pages → tackly-engine → Settings → Delete</b>, then delete the <b>tackly-engine-db</b> database (Storage & Databases → D1) and its KV namespace.</p>
      <h2>Disconnect Pinterest</h2>
      <p>Click <b>Disconnect</b> on the Accounts page, and revoke Tackly’s access in Pinterest: <i>Settings → Security and logins → Apps</i>, or at <a href="https://www.pinterest.com/settings/security" target="_blank" rel="noopener">pinterest.com/settings/security</a>. Pins already published stay on Pinterest until you delete them there.</p>
      <h2>Data on our relay</h2>
      <p>The relay keeps only anonymous safety counters (a salted hash of the Pinterest account ID with publish times), deleted automatically after 2 days. To have them removed sooner, {contact}.</p>
    </>
  );
}

export function Legal({ page }) {
  return (
    <div>
      <header class="site-nav"><div class="inner"><Logo /><nav><ThemeToggle /><a class="btn primary sm" href="#/signup">Start free</a></nav></div></header>
      <article class="legal">
        {page === 'privacy' ? <Privacy /> : page === 'terms' ? <Terms /> : <DataDeletion />}
      </article>
      <SiteFooter />
    </div>
  );
}
