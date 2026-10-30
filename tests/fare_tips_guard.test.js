import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderDailyDigest } from '../src/emailTemplates/dailyDigest.js';

const tips = JSON.parse(fs.readFileSync(new URL('../content/fare_tips.json', import.meta.url), 'utf8'));
const tip = (id) => tips.find((t) => t.id === id);

test('Guard ruling, condition 12: the DOT tips say the airline chooses and scope the rule to airlines', () => {
  const t = tip('dot-24h').body;
  assert.match(t, /airline chooses which/);
  assert.match(t, /written for airlines/);
  assert.match(t, /without a penalty/);
  assert.doesNotMatch(t, /full refund/);
  const r = tip('dot-refund');
  assert.match(r.body, /significant change/);
  assert.match(r.body, /who handles refunds/);
  assert.match(r.link, /^https:\/\/www\.transportation\.gov\//);
});

test('Guard ruling: no absolute claim about who can fix a booking or what an airline "has to" do', () => {
  assert.doesNotMatch(tip('direct-vs-ota').body, /can only fix/);
  assert.doesNotMatch(tip('min-connection').body + tip('min-connection').title, /generally has to|protected/);
});

test('an https tip link is used as written; a path link still goes through the site with tracking', () => {
  const base = { origin: 'JFK', deals: [], user: { id: 'u' }, now: new Date('2026-10-29T12:00:00Z'), edition: 0 };
  const cfg = (link) => ({ appUrl: 'https://sparkfare.com', destinations: {}, awayMode: null, tips: [{ id: 'x', title: 'T', body: 'B.', link, linkText: 'Go' }] });
  const ext = renderDailyDigest({ ...base, config: cfg('https://www.transportation.gov/x') });
  assert.ok(ext.html.includes('href="https://www.transportation.gov/x"') && ext.text.includes('https://www.transportation.gov/x'));
  assert.ok(!/transportation\.gov\/x\?utm/.test(ext.html));
  const own = renderDailyDigest({ ...base, config: cfg('/watchlists') });
  assert.ok(own.html.includes('https://sparkfare.com/watchlists?'));
});
