// K-B8 (ROADMAP step 132, scan E-1): the emails use the Brand v1 palette. Email cannot read CSS variables, so the values live in src/emailTokens.js; this
// file ties them to brand/tokens.css, checks the email builders carry no colour of their own, that gold is only the deal chip, and that the pinned v1
// fixture changed by colour substitutions only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EMAIL_LIGHT, EMAIL_NIGHT } from '../src/emailTokens.js';
import { renderDailyDigest } from '../src/emailTemplates/dailyDigest.js';
import { renderV2Html } from '../src/postClickEmail.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = read('brand/tokens.css');
const light = css.slice(css.indexOf(':root {'), css.indexOf('/* Spacing */'));
const night = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const tok = (block, name) => (block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`)) || [])[1];

test('the email colours equal brand/tokens.css, light and night (on-sage is the card colour: email avoids pure white)', () => {
  const pairs = { paper: 'paper', card: 'card', paperDeep: 'paper-deep', ink: 'ink', ink2: 'ink-2', spark: 'spark', onSpark: 'on-spark', sage: 'sage', line: 'line' };
  for (const [k, name] of Object.entries(pairs)) assert.equal(EMAIL_LIGHT[k].toUpperCase(), tok(light, name).toUpperCase(), `light ${name}`);
  for (const [k, name] of Object.entries({ paper: 'paper', card: 'card', paperDeep: 'paper-deep', ink: 'ink', ink2: 'ink-2', sage: 'sage', onSage: 'on-sage', line: 'line' })) {
    assert.equal(EMAIL_NIGHT[k].toUpperCase(), tok(night, name).toUpperCase(), `night ${name}`);
  }
  assert.equal(EMAIL_LIGHT.onSage.toUpperCase(), tok(light, 'card').toUpperCase());
  assert.notEqual(EMAIL_LIGHT.onSage.toUpperCase(), '#FFFFFF');
});

test('the email builders have no colour of their own: every hex lives in src/emailTokens.js', () => {
  for (const f of ['src/email.js', 'src/emailTemplates/dailyDigest.js', 'src/postClickEmail.js']) {
    const hits = read(f).match(/(?<=[:\s(,"'])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![-\w])/g) || [];
    assert.deepEqual(hits, [], f);
  }
});

test('no amber and no retired palette values anywhere in the emails', () => {
  const retired = /#(?:B8720F|4F7A52|3F6643|EDE6D6|2B2620|6B6255|DCD3BF|E3D9C4|F7F2E7|211F1A|1C1810)\b/i;
  for (const f of ['src/email.js', 'src/emailTemplates/dailyDigest.js', 'src/postClickEmail.js', 'src/emailTokens.js']) assert.doesNotMatch(read(f), retired, f);
  assert.doesNotMatch(read('tests/fixtures/daily_email_v1.json'), retired);
});

test('gold is the deal chip only: the digest uses it once, the post-click email never', () => {
  const digest = read('src/emailTemplates/dailyDigest.js');
  assert.equal((digest.match(/LIGHT\.gold/g) || []).length, 1);
  assert.match(digest, /background:\$\{LIGHT\.gold\};[^`]*\$\{pct\}% BELOW USUAL/);
  assert.doesNotMatch(read('src/postClickEmail.js'), /\bgold\b|\.spark\b|\bspark:/i);
  assert.doesNotMatch(read('src/email.js'), /\bgold\b|\.spark\b|\bonSpark\b/i);
});

test('the v1 fixture changed by colour substitutions only (the one dark-mode text colour aside)', () => {
  const fixture = JSON.parse(read('tests/fixtures/daily_email_v1.json'));
  assert.equal(fixture.subject, 'Sparkfare deals from JFK');
  // every hex in the email is a Brand v1 value
  const allowed = new Set([...Object.values(EMAIL_LIGHT), ...Object.values(EMAIL_NIGHT)].map((v) => v.toUpperCase()));
  for (const h of fixture.html.match(/#[0-9A-Fa-f]{6}\b/g) || []) assert.ok(allowed.has(h.toUpperCase()), h);
  assert.ok(fixture.html.includes(`background: ${EMAIL_NIGHT.paper} !important`));
  assert.ok(fixture.html.includes(`color: ${EMAIL_NIGHT.ink} !important`));
  assert.ok(fixture.html.includes(`background:${EMAIL_LIGHT.paper}`));
});

test('the v2 digest renders in Paper, Ink and Sage: sage link and button with card-coloured text, the deal chip gold with ink text', () => {
  const deal = {
    display_name: 'Tbilisi, Georgia', origin: 'SEA', price: 534, status: 'deal', airline: 'TK', median_baseline: 740,
    booking_link: 'https://www.aviasales.com/search/SEA2310TBS02111?marker=314524',
    departure_at: '2026-10-23T22:35:00-07:00', return_at: '2026-11-02T16:15:00+04:00', found_at: '2026-09-24T09:00:00Z',
    observations: Array.from({ length: 20 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 24) - (20 - i) * 86400000).toISOString().slice(0, 10), price: 740 })),
  };
  const { html } = renderDailyDigest({ origin: 'SEA', deals: [deal], user: { id: 'u1' }, now: new Date('2026-09-24T12:00:00Z'), config: { appUrl: 'https://sparkfare.com', destinations: {}, tips: [] } });
  assert.ok(html.includes(`background:${EMAIL_LIGHT.paper}`));
  assert.ok(html.includes(`color:${EMAIL_LIGHT.onSage}`));
  assert.ok(html.includes(`background:${EMAIL_LIGHT.spark};`) && html.includes(`color:${EMAIL_LIGHT.onSpark};`));
  assert.equal((html.match(new RegExp(EMAIL_LIGHT.spark, 'gi')) || []).length, 1, 'gold appears once');
  assert.ok(html.includes(`color: ${EMAIL_NIGHT.ink} !important`) || html.includes(EMAIL_NIGHT.ink));
});

test('the post-click email has a Sage fare button and a neutral timing chip, with no gold', () => {
  assert.equal(typeof renderV2Html, 'function');
  const src = read('src/postClickEmail.js');
  assert.match(src, /<td style="background:\$\{C\.sage\};border-radius:6px;"><a href="\$\{escapeHtml\(flightHref/);
  assert.match(src, /color:\$\{C\.onSage\};text-decoration:none;">\$\{EMAIL_PRIMARY_BUTTON\}/);
  assert.match(src, /<span style="background:\$\{C\.paperDeep\};color:\$\{C\.ledger\};border:1px solid \$\{C\.line\}/);
  assert.match(src, /<td width="\$\{pct\}%" style="background:\$\{C\.sage\};height:8px/);
});
