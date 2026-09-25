// Writes rendered sample emails to tmp/email-previews/ from the real ranked-deal files.
// Usage: node scripts/preview-email.mjs
import fs from 'node:fs';
import { renderDailyDigest } from '../src/emailTemplates/dailyDigest.js';
import { EMAIL_DEAL_QUALITY_OPTIONS } from '../src/dealQuality.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const destinations = read('content/destinations.json');
const tips = read('content/fare_tips.json');
const jfk = read('sparkfare_ranked_deals.json');
const others = read('sparkfare_ranked_deals_other_origins.json');
const pick = (feed, origin) => [...(feed.deals || []), ...(feed.featured || [])].filter((d) => d.origin === origin);

// Preview at "just after the fetch" so the sample data is inside the freshness window.
const now = new Date(jfk.generated_at || Date.now());
now.setUTCHours(now.getUTCHours() + 1);

const config = {
  appUrl: 'https://sparkfare.com', destinations, tips,
  unsubscribeUrl: 'https://sparkfare.com/api/unsubscribe?email=preview%40example.com',
  postalAddress: '[EMAIL_POSTAL_ADDRESS placeholder]',
  referralUrl: 'https://sparkfare.com/r/ref_preview',
  awayMode: { name: 'SafetyWing', blurb: 'Travel medical insurance built for people leaving home for a while.', href: 'https://sparkfare.com/out/safetywing' },
};

const samples = {
  'light-6-deals': { origin: 'LAX', deals: pick(others, 'LAX').slice(0, 6), user: { id: 'preview' } },
  'one-deal': { origin: 'JFK', deals: pick(jfk, 'JFK').slice(0, 1), user: { id: 'preview' } },
  'no-change-day': { origin: 'SEA', deals: [], user: { id: 'preview' } },
  'archive-mode': { origin: 'LAX', deals: pick(others, 'LAX').slice(0, 6), user: null },
};

fs.mkdirSync(new URL('../tmp/email-previews/', import.meta.url), { recursive: true });
for (const [name, s] of Object.entries(samples)) {
  const out = renderDailyDigest({ origin: s.origin, deals: s.deals, user: s.user, now, config });
  fs.writeFileSync(new URL(`../tmp/email-previews/${name}.html`, import.meta.url), out.html);
  fs.writeFileSync(new URL(`../tmp/email-previews/${name}.txt`, import.meta.url), `Subject: ${out.subject}\nPreheader: ${out.preheader}\n\n${out.text}`);
  console.log(`${name}: ${s.deals.length} deals, subject "${out.subject}" (${out.subject.length} chars), html ${(out.html.length / 1024).toFixed(1)}KB`);
}
console.log('freshness options in use:', EMAIL_DEAL_QUALITY_OPTIONS);
