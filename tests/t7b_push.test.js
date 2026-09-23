import { unstable_dev } from 'wrangler';
import assert from 'assert';
import { describe, it, before, after } from 'node:test';

describe('T7b Web Push API', () => {
  let worker;

  before(async () => {
    worker = await unstable_dev('src/index.js', {
      experimental: { disableExperimentalWarning: true },
      vars: {
        ENABLE_T7B_PUSH: 'true',
        VAPID_PUBLIC_KEY: 'test-public-key',
        VAPID_PRIVATE_KEY: 'test-private-key'
      },
    });
  });

  after(async () => {
    if (worker) await worker.stop();
  });

  it('serves VAPID public key', async () => {
    const res = await worker.fetch('/api/push/vapid-public-key');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.publicKey, 'test-public-key');
  });

  it('rejects subscribe without auth', async () => {
    const res = await worker.fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'test', auth: 'test' }
      })
    });
    assert.strictEqual(res.status, 401);
  });
});
