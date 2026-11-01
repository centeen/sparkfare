// Guard P5 (2026-11-01): recording email click events is fail-closed behind ENABLE_EMAIL_CLICK_RECORDING (default off). With it off, a signed
// email.clicked webhook is accepted (200) but writes nothing: no email_click event, no last_clicked_at. The reactivation button still counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Webhook } from 'standardwebhooks';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { handleRequest } from '../src/index.js';
import { handleClick, markClickedByEmail, clickRecordingEnabled } from '../src/clickSignal.js';
import { careEmailEnabled } from '../src/careEmail.js';
import { _resetSendingGuardForTests } from '../src/email.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const SECRET = 'whsec_dGVzdHNlY3JldA==';
const clicked = { type: 'email.clicked', created_at: new Date().toISOString(), data: { email_id: 'e1', to: ['r@example.com'], click: { link: 'https://sparkfare.com/x' } } };

function setup(extra = {}) {
  const db = makeSqliteD1(MIGRATIONS);
  _resetSendingGuardForTests();
  db.raw.prepare("INSERT INTO users (id, email, verified_email, is_subscribed, created_at) VALUES ('u1', 'r@example.com', 1, 1, datetime('now', '-200 days'))").run();
  return { db, env: { DB: db, RESEND_WEBHOOK_SECRET: SECRET, UNSUBSCRIBE_SECRET: 'sec', APP_URL: 'https://sparkfare.com', ...extra } };
}
async function post(env, event) {
  const payload = JSON.stringify(event); const wh = new Webhook(SECRET); const ts = new Date(); const pending = [];
  const res = await handleRequest(new Request('http://localhost/api/webhooks/resend', { method: 'POST',
    headers: { 'svix-id': 'msg_p5', 'svix-timestamp': String(Math.floor(ts.getTime() / 1000)), 'svix-signature': wh.sign('msg_p5', ts, payload) }, body: payload }), env, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  return res;
}
const clicks = (db) => db.raw.prepare("SELECT count(*) AS n FROM events WHERE event_type = 'email_click'").get().n;
const lastClick = (db) => db.raw.prepare("SELECT last_clicked_at AS t FROM users WHERE email = 'r@example.com'").get().t;

test('flag off (default, or any value but "true"): the click webhook answers 200 and records nothing', async () => {
  for (const extra of [{}, { ENABLE_EMAIL_CLICK_RECORDING: 'false' }, { ENABLE_EMAIL_CLICK_RECORDING: 'TRUE' }, { ENABLE_EMAIL_CLICK_RECORDING: '1' }]) {
    const { db, env } = setup(extra);
    assert.equal((await post(env, clicked)).status, 200);
    assert.equal(clicks(db), 0);
    assert.equal(lastClick(db), null);
  }
});

test('flag on: the click is recorded as before (event and last_clicked_at)', async () => {
  const { db, env } = setup({ ENABLE_EMAIL_CLICK_RECORDING: 'true' });
  assert.equal((await post(env, clicked)).status, 200);
  assert.equal(clicks(db), 1);
  assert.ok(lastClick(db));
});

test('handleClick itself is closed when off, and reports why', async () => {
  const { db, env } = setup();
  const out = await handleClick(env, clicked);
  assert.equal(out.updated, 0);
  assert.match(out.skipped, /ENABLE_EMAIL_CLICK_RECORDING off/);
  assert.equal(clicks(db), 0);
  assert.equal(clickRecordingEnabled({ ENABLE_EMAIL_CLICK_RECORDING: 'true' }), true);
  assert.equal(clickRecordingEnabled({}), false);
});

test('the reactivation button still records a click with the flag off', async () => {
  const { db, env } = setup();
  await markClickedByEmail(env, 'r@example.com');
  assert.ok(lastClick(db));
});

test('the care email needs the flag as well as its own flags', () => {
  const base = { ENABLE_CARE_EMAIL: 'true', ENABLE_SIGNED_PREFS: 'true', UNSUBSCRIBE_SECRET: 'sec' };
  assert.equal(careEmailEnabled(base), false);
  assert.equal(careEmailEnabled({ ...base, ENABLE_EMAIL_CLICK_RECORDING: 'true' }), true);
});

test('wrangler.jsonc ships the flag off', () => {
  assert.match(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), /"ENABLE_EMAIL_CLICK_RECORDING":\s*"false"/);
});

// ---- P6: a recorded click never stores the URL, its query or a token --------------------------------------------------------------------------
import { linkKind } from '../src/clickSignal.js';

test('P6: linkKind keeps a category only', () => {
  assert.equal(linkKind('https://sparkfare.com/api/unsubscribe?token=abc.def&email=a%40b.c'), 'unsubscribe');
  assert.equal(linkKind('https://sparkfare.com/api/reactivate?token=SECRET'), 'reactivate');
  assert.equal(linkKind('https://sparkfare.com/prefs?token=SECRET'), 'prefs');
  assert.equal(linkKind('https://sparkfare.com/api/verify?token=SECRET'), 'verify');
  assert.equal(linkKind('https://sparkfare.com/out/yesim?src=email&trip=T123&sub_id=S9'), 'out:yesim');
  assert.equal(linkKind('https://sparkfare.com/go/safetywing'), 'go:safetywing');
  assert.equal(linkKind('https://sparkfare.com/'), 'site:home');
  assert.equal(linkKind('https://sparkfare.com/flight/JFK/Lisbon%2C%20Portugal?utm_source=x'), 'site:flight');
  assert.equal(linkKind('https://www.aviasales.com/search/JFK1011LIS?marker=314524.T123&x=y'), 'external:www.aviasales.com');
  assert.equal(linkKind('not a url'), 'unknown');
  assert.equal(linkKind(undefined), 'unknown');
  assert.equal(linkKind('https://sparkfare.com/out/' + 'a'.repeat(80)), 'site:out');
});

test('P6: with recording on, the stored event has no URL, query or token anywhere', async () => {
  const { db, env } = setup({ ENABLE_EMAIL_CLICK_RECORDING: 'true' });
  const withToken = { ...clicked, data: { ...clicked.data, click: { link: 'https://sparkfare.com/api/unsubscribe?token=TOPSECRET.TOKEN&email=r%40example.com&sub_id=S9' } } };
  assert.equal((await post(env, withToken)).status, 200);
  const rows = db.raw.prepare("SELECT * FROM events WHERE event_type = 'email_click'").all();
  assert.equal(rows.length, 1);
  const dump = JSON.stringify(rows);
  assert.ok(!/TOPSECRET|token=|sub_id=|https?:\/\/|%40|@/.test(dump), dump);
  assert.equal(JSON.parse(rows[0].meta).link_kind, 'unsubscribe');
  assert.ok(!('link' in JSON.parse(rows[0].meta)));
});
