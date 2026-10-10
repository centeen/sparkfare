// ROADMAP step 22e: the /pricing waitlist for Sparkfare Plus. Interest signal only: nothing is sold, no payment
// details are collected, and nothing here changes what data anyone sees. Double opt-in: the signup stores the
// address unverified, emails a signed link, and only the confirm button (a POST) marks it verified, so a mail
// scanner that opens the link cannot verify anyone.
import { escapeHtml } from './emailTemplates/helpers.js';
import { renderSitePage } from './ptoPages.js';

const enc = new TextEncoder();
const PREFIX = 'plus-waitlist-verify:';
// A verification email is re-sent at most this often per address, so the form cannot be used to mail someone repeatedly.
export const RESEND_COOLDOWN_MINUTES = 10;

const b64u = {
  encode(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export function cleanWaitlistEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

// The prefix keeps this token from being accepted anywhere an unsubscribe, reactivate or watch-cancel token is.
export async function signWaitlistToken(email, secret) {
  if (!email || !secret) throw new Error('signWaitlistToken needs an email and a secret');
  const payload = b64u.encode(enc.encode(JSON.stringify({ e: email })));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${PREFIX}${payload}`)));
  return `${payload}.${b64u.encode(sig)}`;
}

export async function verifyWaitlistToken(token, secret) {
  if (!token || !secret || typeof token !== 'string' || token.split('.').length !== 2) return null;
  try {
    const [payload, sigPart] = token.split('.');
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, b64u.decode(sigPart), enc.encode(`${PREFIX}${payload}`));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(b64u.decode(payload)));
    return data && typeof data.e === 'string' ? cleanWaitlistEmail(data.e) : null;
  } catch {
    return null;
  }
}

export async function ensureWaitlistTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS plus_waitlist (
      email TEXT PRIMARY KEY,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_sent_at TEXT,
      verified_at TEXT
    )
  `).run();
}

// ---- pages ---------------------------------------------------------------------------------------------------

export function renderPricingPage({ appUrl }) {
  const body = `    <div class="card">
      <h1>Sparkfare Plus: join the waitlist</h1>
      <p class="sub">Plus is not available yet and nothing is charged. This list tells us whether it is worth building.</p>
      <h2>What it would be</h2>
      <p>A paid plan for the alert and planning tools. The first feature planned is choosing how many days before departure your pre-trip reminders arrive. A founding price of $29 a year, limited to the first 100 members, is the current plan. It is not final, and no payment is taken from this page.</p>
      <h2>What it would not change</h2>
      <p>Deal data and ranking are the same for everyone, free or paid. Sparkfare publishes fare information and sends you to a booking site; it does not sell, book or take payment for travel.</p>
      <form id="waitlist-form" novalidate>
        <label for="wl-email">Email</label>
        <input id="wl-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
        <div class="actions"><button type="submit">Join the waitlist</button></div>
        <p class="muted small">We email one confirmation link. If you do not confirm, you are not on the list. You can leave at any time by replying to that email or any later one.</p>
        <div class="status" id="waitlist-status" role="status" aria-live="polite"></div>
      </form>
    </div>
    <script>
      (function () {
        var form = document.getElementById('waitlist-form');
        var status = document.getElementById('waitlist-status');
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          status.className = 'status';
          status.textContent = 'Sending...';
          fetch('/api/plus-waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: document.getElementById('wl-email').value, source: 'pricing' })
          }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
              if (res.ok && res.j.ok) { status.textContent = 'Check your inbox for a confirmation link.'; form.reset(); }
              else { status.className = 'status error'; status.textContent = (res.j && res.j.error) || 'That did not work. Please try again.'; }
            })
            .catch(function () { status.className = 'status error'; status.textContent = 'That did not work. Please try again.'; });
        });
      })();
    </script>`;
  return renderSitePage({
    title: 'Sparkfare Plus waitlist | Sparkfare',
    description: 'Join the waitlist for Sparkfare Plus. Nothing is charged; deal data is the same for everyone.',
    canonical: `${appUrl}/pricing`,
    robots: 'noindex, follow',
    ogImage: null,
    body,
  });
}

function messagePage({ title, heading, text, confirmAction = null, appUrl }) {
  const form = confirmAction
    ? `<form method="POST" action="${escapeHtml(confirmAction)}"><div class="actions"><button type="submit">Confirm my email</button></div></form>`
    : `<div class="actions"><a class="btn secondary" href="/">Back to Sparkfare</a></div>`;
  return renderSitePage({
    title: `${title} | Sparkfare`,
    description: text,
    canonical: `${appUrl}/pricing`,
    robots: 'noindex, nofollow',
    ogImage: null,
    body: `    <div class="card"><h1>${escapeHtml(heading)}</h1><p class="sub">${escapeHtml(text)}</p>${form}</div>`,
  });
}

export const renderVerifyConfirmPage = ({ token, appUrl }) => messagePage({
  title: 'Confirm your email',
  heading: 'Confirm your email for the Plus waitlist',
  text: 'Press the button to finish joining. Nothing is charged.',
  confirmAction: `/api/plus-waitlist/verify?token=${encodeURIComponent(token)}`,
  appUrl,
});

export const renderVerifiedPage = ({ appUrl }) => messagePage({
  title: 'You are on the list',
  heading: 'You are on the Plus waitlist',
  text: 'Thanks. We will email you once, if and when Plus opens.',
  appUrl,
});

export const renderInvalidLinkPage = ({ appUrl }) => messagePage({
  title: 'Link not valid',
  heading: 'That link is not valid',
  text: 'It may have been copied incompletely. You can join again from the pricing page.',
  appUrl,
});
