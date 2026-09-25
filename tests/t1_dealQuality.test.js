import test from 'node:test';
import assert from 'node:assert';
import { dealQuality } from '../src/dealQuality.js';

test('T1: dealQuality flags normal eligible deal', () => {
  const observations = [];
  for (let i = 1; i <= 15; i++) {
    observations.push({
      date: `2026-09-${i.toString().padStart(2, '0')}`,
      price: 300
    });
  }
  const ticket = { price: 200, found_at: '2026-09-15T12:00:00Z' };
  const now = new Date('2026-09-16T12:00:00Z');
  
  const dq = dealQuality(observations, ticket, now);
  assert.equal(dq.eligible, true);
  assert.equal(dq.is_rare_find, true);
  assert.equal(dq.baseline, 300);
});

test('T1: dealQuality rejects short history (too few points)', () => {
  const observations = [];
  for (let i = 1; i <= 5; i++) { // only 5 points
    observations.push({
      date: `2026-09-${i.toString().padStart(2, '0')}`,
      price: 300
    });
  }
  const ticket = { price: 200, found_at: '2026-09-15T12:00:00Z' };
  const now = new Date('2026-09-16T12:00:00Z');
  
  const dq = dealQuality(observations, ticket, now);
  assert.equal(dq.eligible, false);
  assert.ok(dq.reasons.some(r => r.includes('Insufficient observations')));
});

test('T1: dealQuality rejects short span', () => {
  const observations = [];
  for (let i = 1; i <= 15; i++) {
    observations.push({
      date: `2026-09-01`, // same date
      price: 300
    });
  }
  const ticket = { price: 200, found_at: '2026-09-15T12:00:00Z' };
  const now = new Date('2026-09-16T12:00:00Z');
  
  const dq = dealQuality(observations, ticket, now);
  assert.equal(dq.eligible, false);
  assert.ok(dq.reasons.some(r => r.includes('History span too short')));
});

test('T1: dealQuality rejects stale price', () => {
  const observations = [];
  for (let i = 1; i <= 15; i++) {
    observations.push({
      date: `2026-09-${i.toString().padStart(2, '0')}`,
      price: 300
    });
  }
  // Found 3 days ago (72 hours)
  const ticket = { price: 200, found_at: '2026-09-13T12:00:00Z' };
  const now = new Date('2026-09-16T12:00:00Z');
  
  const dq = dealQuality(observations, ticket, now);
  assert.equal(dq.eligible, false);
  assert.ok(dq.reasons.some(r => r.includes('Price older than')));
});

// Fix (2026-09-25): expires_at (Travelpayouts' own raw fare-quote TTL, often ~1 hour on real
// data) used to be an unconditional hard exclusion the instant it passed, bypassing the far more
// lenient 48h found_at staleness grace every other record gets. Since dealQuality() is re-run at
// actual send time (hours after the real fetch), this was silently disqualifying nearly every
// JFK record from the daily digest email -- see the CLAUDE.md entry for the full investigation.
// expires_at no longer independently disqualifies a record; eligibility is judged uniformly by
// the found_at/48h staleness check regardless of whether expires_at is present.
test('T1: a past expires_at no longer disqualifies a deal on its own -- eligibility is judged by found_at staleness', () => {
  const observations = [];
  for (let i = 1; i <= 15; i++) {
    observations.push({
      date: `2026-09-${i.toString().padStart(2, '0')}`,
      price: 300
    });
  }
  // expires_at is in the past, but found_at is fresh (1 hour old, well under the 48h cutoff) --
  // this is the exact real-world shape of the bug: Travelpayouts' short fare-quote TTL passing
  // long before the record is genuinely stale by the product's own 48h reference-price standard.
  const ticket = { price: 200, found_at: '2026-09-16T11:00:00Z', expires_at: '2026-09-16T12:00:00Z' };
  const now = new Date('2026-09-16T14:00:00Z'); // 2 hours after found_at, 2 hours past expires_at

  const dq = dealQuality(observations, ticket, now);
  assert.equal(dq.eligible, true);
  assert.ok(!dq.reasons.some(r => r.includes('expired')));
});

test('T1: dealQuality still rejects a genuinely stale price (>48h old), expires_at or not', () => {
  const observations = [];
  for (let i = 1; i <= 15; i++) {
    observations.push({
      date: `2026-09-${i.toString().padStart(2, '0')}`,
      price: 300
    });
  }
  // found_at is 72 hours old -- past the 48h staleness cutoff -- with an expires_at present too,
  // confirming expires_at's presence doesn't accidentally mask a real staleness rejection either.
  const ticket = { price: 200, found_at: '2026-09-13T12:00:00Z', expires_at: '2026-09-13T13:00:00Z' };
  const now = new Date('2026-09-16T12:00:00Z');

  const dq = dealQuality(observations, ticket, now);
  assert.equal(dq.eligible, false);
  assert.ok(dq.reasons.some(r => r.includes('Price older than')));
});

test('T1: dealQuality rejects if missing found_at and expires_at', () => {
  const observations = [];
  for (let i = 1; i <= 15; i++) {
    observations.push({
      date: `2026-09-${i.toString().padStart(2, '0')}`,
      price: 300
    });
  }
  const ticket = { price: 200 };
  const now = new Date('2026-09-16T12:00:00Z');
  
  const dq = dealQuality(observations, ticket, now);
  assert.equal(dq.eligible, false);
  assert.ok(dq.reasons.some(r => r.includes('Missing found_at timestamp')));
});
