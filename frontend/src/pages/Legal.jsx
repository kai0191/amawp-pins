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
      <p>Tackly ("we", "us") is a Pinterest pin designer and scheduler operated by AMAWP. This policy explains what we collect, why, and the choices you have.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your email address, name and a securely hashed password (PBKDF2). We never store your password in plain text.</li>
        <li><b>Pinterest connection:</b> when you connect Pinterest, we receive an access token and refresh token, your Pinterest username, profile image and account ID. Tokens are encrypted with AES-256-GCM before being stored.</li>
        <li><b>Your content:</b> pin titles, descriptions, links, alt text, chosen boards, schedule times, small preview thumbnails and your brand kit (logo, colours, fonts, website).</li>
        <li><b>Pin images:</b> the final pin image is stored temporarily until it is posted to Pinterest, then deleted automatically.</li>
        <li><b>Optional API keys:</b> if you add your own AI provider key, it is encrypted and never shown back in full. Stock photo keys (Unsplash, Pexels, Pixabay) stay in your browser only.</li>
        <li><b>Operational data:</b> a log of posting attempts (success or error message) and basic rate-limiting counters to prevent abuse.</li>
      </ul>
      <h2>How we use Pinterest data</h2>
      <p>We use the Pinterest permissions you approve (boards:read, boards:write, pins:read, pins:write, user_accounts:read) only to: show your boards, create a board when you ask, publish pins you created or scheduled, and show basic stats for pins you posted with Tackly. We do not sell Pinterest data, use it for advertising, or share it with anyone else.</p>
      <h2>AI features</h2>
      <p>When you use AI writing or image tools, the text you type (for example a topic or headline) is sent to the AI provider: Pollinations.ai by default, or the provider you configured. Do not include personal or sensitive information in AI prompts.</p>
      <h2>Where data is stored</h2>
      <p>Data is stored on Cloudflare (Workers, D1 database and KV storage). The website is hosted on GitHub Pages. Both providers process data under their own privacy and security terms.</p>
      <h2>Cookies and tracking</h2>
      <p>We do not use advertising or analytics cookies. Your sign-in token and preferences are kept in your browser’s local storage.</p>
      <h2>Retention and deletion</h2>
      <p>We keep your data while your account is active. You can disconnect Pinterest at any time (this deletes the stored tokens) and you can permanently delete your account and all data from <b>Settings → Delete account</b>. See our <a href="#/data-deletion">data deletion page</a>.</p>
      <h2>Your rights</h2>
      <p>You can access, export, correct or delete your data at any time from Settings, or contact us. If you are in the EU/UK you also have rights under GDPR, including the right to complain to your local data protection authority.</p>
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
      <p>Tackly lets you design Pinterest pins and schedule them to your own Pinterest account. The free plan is provided "as is" and may change. We will give reasonable notice before removing a free feature.</p>
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
      <p>We work hard to post every pin on time but cannot guarantee it: Pinterest or other providers may be unavailable or may reject content. To the extent permitted by law, AMAWP is not liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the last 12 months (zero on the free plan).</p>
      <h2>Paid plans</h2>
      <p>Paid plans are not available yet. When they launch, prices and terms will be shown clearly before you pay.</p>
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
      <p>You can delete your Tackly data at any time. Deletion is permanent and cannot be undone.</p>
      <h2>Delete everything (recommended)</h2>
      <ol>
        <li>Sign in to Tackly.</li>
        <li>Open <b>Settings</b>.</li>
        <li>Scroll to <b>Delete account</b> and confirm.</li>
      </ol>
      <p>This immediately deletes your account, connected Pinterest tokens, brand kit, AI keys, scheduled and draft pins, pin images, waitlist entries and post log. Pins already published on Pinterest stay on Pinterest; delete them there if you wish.</p>
      <h2>Only disconnect Pinterest</h2>
      <p>Go to <b>Accounts</b> and click <b>Disconnect</b>. Your encrypted Pinterest tokens are deleted and scheduled pins for that account move back to drafts. You can also revoke Tackly’s access from Pinterest: <i>Settings → Security and logins → Apps</i>, or at <a href="https://www.pinterest.com/settings/security" target="_blank" rel="noopener">pinterest.com/settings/security</a>.</p>
      <h2>Can’t sign in?</h2>
      <p>Ask us to delete your data: {contact}. Tell us the email address you signed up with. We will confirm deletion within 30 days.</p>
      <h2>Export first</h2>
      <p>You can download a copy of your data from <b>Settings → Export my data</b> before deleting.</p>
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
