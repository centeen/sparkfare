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

test('T1: dealQuality rejects expired price', () => {
  const observations = [];
  for (let i = 1; i <= 15; i++) {
    observations.push({
      date: `2026-09-${i.toString().padStart(2, '0')}`,
      price: 300
    });
  }
  // Expires in the past
  const ticket = { price: 200, expires_at: '2026-09-15T12:00:00Z' };
  const now = new Date('2026-09-16T12:00:00Z');
  
  const dq = dealQuality(observations, ticket, now);
  assert.equal(dq.eligible, false);
  assert.ok(dq.reasons.some(r => r.includes('Price expired at')));
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
