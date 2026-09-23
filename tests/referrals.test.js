import test from 'node:test';
import assert from 'node:assert';
import { getEntitlements } from '../src/rewards.js';

test('getEntitlements calculates correctly for 0 referrals', async () => {
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ c: 0 })
        })
      })
    }
  };
  const ents = await getEntitlements(env, 'user-1');
  assert.equal(ents.confirmedReferrals, 0);
  assert.equal(ents.maxOrigins, 1);
  assert.equal(ents.earlyBird, false);
});

test('getEntitlements unlocks tier 1 (Extra Origin) at 1 referral', async () => {
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ c: 1 })
        })
      })
    }
  };
  const ents = await getEntitlements(env, 'user-1');
  assert.equal(ents.confirmedReferrals, 1);
  assert.equal(ents.maxOrigins, 2);
  assert.equal(ents.earlyBird, false);
});

test('getEntitlements unlocks tier 3 (Early Bird) at 3 referrals', async () => {
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ c: 3 })
        })
      })
    }
  };
  const ents = await getEntitlements(env, 'user-1');
  assert.equal(ents.confirmedReferrals, 3);
  assert.equal(ents.maxOrigins, 2);
  assert.equal(ents.earlyBird, true);
  assert.equal(ents.earlyAccessFeatures, false);
});

test('getEntitlements unlocks tier 5 (Early Access) at 5 referrals', async () => {
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ c: 5 })
        })
      })
    }
  };
  const ents = await getEntitlements(env, 'user-1');
  assert.equal(ents.confirmedReferrals, 5);
  assert.equal(ents.earlyBird, true);
  assert.equal(ents.earlyAccessFeatures, true);
  assert.equal(ents.foundingMemberBadge, false);
});

test('getEntitlements unlocks tier 10 (Founding Member) at 10 referrals', async () => {
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ c: 10 })
        })
      })
    }
  };
  const ents = await getEntitlements(env, 'user-1');
  assert.equal(ents.confirmedReferrals, 10);
  assert.equal(ents.earlyBird, true);
  assert.equal(ents.earlyAccessFeatures, true);
  assert.equal(ents.foundingMemberBadge, true);
});
