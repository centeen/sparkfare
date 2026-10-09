import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The homepage trust line said "over 480 active routes from 13 major hubs". All three parts were
// wrong: 12 origins are marketed (TLV is the unmarketed design-partner origin), 12 x 40 is exactly
// 480 rather than "over" it, and only about half of those routes have a current price on any given
// day, so "live"/"active" overclaimed. This ties the sentence to the real origin list and
// destination count so it cannot drift when either changes.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const trustLine = () => {
  const m = html.match(/<p class="trust-signal"[^>]*>([^<]*)<\/p>/);
  assert.ok(m, 'expected the homepage trust-signal line');
  return m[1];
};

// Origins a visitor can pick, minus TLV (in the dropdown for the design-partner relationship but
// deliberately never marketed: see CLAUDE.md "Decisions locked").
function marketedOrigins() {
  const select = html.match(/<select id="origin-select">([\s\S]*?)<\/select>/);
  assert.ok(select, 'expected the origin selector');
  const all = [...select[1].matchAll(/<option value="([A-Z]{3})"/g)].map((m) => m[1]);
  assert.ok(all.includes('JFK'));
  return all.filter((o) => o !== 'TLV');
}

test('homepage trust line states the real hub count and route count', () => {
  const line = trustLine();
  const hubs = marketedOrigins().length;
  const destinations = Object.keys(
    JSON.parse(fs.readFileSync(path.join(root, 'sparkfare_destinations.json'), 'utf8'))
  ).length;

  assert.equal(hubs, 15, 'the plan says 15 marketed origins');
  assert.ok(line.includes(`from ${hubs} major hubs`), `hub count wrong in: ${line}`);
  assert.ok(line.includes(`for ${hubs * destinations} routes`), `route count wrong in: ${line}`);
});

test('homepage trust line does not overclaim: no "over N", no "live", no "active"', () => {
  const line = trustLine();
  assert.doesNotMatch(line, /\bover\s+\d/i, '15 x 40 is exactly 600, not "over" it');
  assert.doesNotMatch(line, /\blive\b/i, 'free-tier prices are daily-delayed, not live');
  assert.doesNotMatch(line, /\bactive\b/i, 'only about half of routes have a current price on a given day');
});

test('homepage trust line says routes without enough history are marked Building history', () => {
  // DEN, PHX and LAS (added Oct 7) and any route under the history minimum show as Building history, not as a price or deal.
  // The board already labels them that way; the line must say so rather than imply every route is priced.
  assert.match(trustLine(), /Building history/);
  assert.match(html, /Building history/i);
});

test('TLV is never mentioned in the marketing line', () => {
  assert.doesNotMatch(trustLine(), /TLV|Tel Aviv|13/);
});
