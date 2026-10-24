import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { buildLeaveByPlan, LEAVE_BY_RULES, ALL_WATCHED_RULES } from '../src/data/leaveByRules.js';
import {
  normalizePageText, hashText, isChallengePage, collectWatchUrls, runRuleWatcher, getRuleOverrides,
  confirmRule, keepRuleHeld, listRulesForAdmin, ruleWatcherEnabled, rulesAdminPageHtml, RULE_WATCHER,
} from '../src/ruleWatcher.js';

// Addendum G task G2 (ROADMAP step 88): the rule watcher. Runs on a real in-memory SQLite behind a D1-shaped wrapper.

function makeDb() {
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, params) => ({
    run: async () => { raw.prepare(sql).run(...params); return { success: true }; },
    first: async () => raw.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...params) }),
  });
  return { raw, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}

const LONG = 'Rule text. '.repeat(40); // longer than MIN_TEXT_LENGTH
const page = (body) => `<html><head><title>x</title><script>var a=1</script></head><body><nav>menu one</nav><main>${body}</main><footer>footer ${Math.random()}</footer></body></html>`;

// A page fetcher backed by a map: url -> html | Error | {status}
function pages(map) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const v = map[url] ?? map['*'];
    if (v instanceof Error) throw v;
    if (v && typeof v === 'object' && v.status) return new Response('', { status: v.status });
    return new Response(v, { status: 200 });
  };
  impl.calls = calls;
  return impl;
}

function stubResend() {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('resend.com')) { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ id: 'w-id' }), { status: 200 }); }
    return new Response('{}', { status: 200 });
  };
  return { sent, restore: () => { globalThis.fetch = original; } };
}

const noSleep = async () => {};
const T0 = new Date('2026-10-19T09:00:00Z');
const USPS = 'https://www.usps.com/manage/hold-mail.htm';
const baseline = () => pages({ '*': page(LONG + 'version one') });

test('page text: scripts, menus and footers do not count, so a changed footer is not a changed rule', async () => {
  const a = normalizePageText(page('Passport rule. Six months.'));
  const b = normalizePageText(page('Passport rule. Six months.'));
  assert.equal(a, b, 'the footer contains a random number but is stripped');
  assert.ok(!/menu one|var a/.test(a));
  assert.equal(await hashText(a), await hashText(b));
  assert.notEqual(await hashText(a), await hashText(normalizePageText(page('Passport rule. Three months.'))));
});

test('a bot-check page is recognised', () => {
  assert.ok(isChallengePage('travel.state.gov Performing security verification This website uses a security service'));
  assert.ok(isChallengePage('Just a moment...'));
  assert.ok(!isChallengePage('Must have 6 months validity beyond your arrival date.'));
});

test('every rule URL is watched once, and the rules that share a page are listed together', () => {
  const map = collectWatchUrls();
  assert.ok(map.has(USPS));
  assert.deepEqual([...map.get(USPS)].sort(), ['usps-forwarding', 'usps-hold-mail']);
  for (const url of map.keys()) assert.match(url, /^https:\/\//);
});

test('the first run only records baselines: nothing is held and no email is sent', async () => {
  const net = stubResend();
  try {
    const DB = makeDb();
    const s = await runRuleWatcher({ DB, RESEND_API_KEY: 'k' }, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
    assert.equal(s.changed, 0);
    assert.equal(s.newlyHeld.length, 0);
    assert.ok(s.baselined > 0);
    assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM rule_status_overrides').get().n, 0);
    assert.equal(net.sent.length, 0);
    // second run, same text: still nothing
    const again = await runRuleWatcher({ DB, RESEND_API_KEY: 'k' }, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
    assert.equal(again.changed, 0);
    assert.equal(net.sent.length, 0);
  } finally { net.restore(); }
});

test('a changed page holds every rule that uses it, shows no date, and sends ONE email for the whole run', async () => {
  const net = stubResend();
  try {
    const DB = makeDb();
    const env = { DB, RESEND_API_KEY: 'k' };
    await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
    const changed = pages({ '*': page(LONG + 'version one'), [USPS]: page(LONG + 'version TWO, the limit is now 14 days') });
    const s = await runRuleWatcher(env, { fetchImpl: changed, now: () => T0, sleep: noSleep });
    assert.equal(s.changed, 1);
    assert.deepEqual([...s.newlyHeld].sort(), ['usps-forwarding', 'usps-hold-mail']);
    assert.equal(net.sent.length, 1, 'one summary email, not one per rule');
    assert.match(net.sent[0].subject, /2 rules held/);
    assert.match(net.sent[0].html, /usps-hold-mail/);
    assert.match(net.sent[0].html, /usps-forwarding/);

    const overrides = await getRuleOverrides(env);
    const plan = buildLeaveByPlan({ destination: 'Tokyo, Japan', today: '2026-10-16', departureDate: '2026-12-20', returnDate: '2026-12-27', tripLengthBucket: '7-10', answers: {}, overrides });
    const held = plan.items.find((i) => i.id === 'usps-hold-mail');
    assert.equal(held.status, 'held');
    assert.equal(held.actByDate, null);
    assert.equal(held.actByText, null);
    assert.equal(held.why, null);
    assert.equal(held.quote, null);
    assert.equal(held.heldNotice, 'This changed recently. Check the official page:');
    assert.equal(held.officialUrl, USPS);
    // the .ics carries nothing for a held rule
    assert.ok(!plan.items.filter((i) => i.status === 'held').some((i) => i.actByDate));
  } finally { net.restore(); }
});

test('running again with the same changed page does not hold again or email again', async () => {
  const net = stubResend();
  try {
    const DB = makeDb();
    const env = { DB, RESEND_API_KEY: 'k' };
    await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
    const changed = pages({ '*': page(LONG + 'version one'), [USPS]: page(LONG + 'version TWO') });
    await runRuleWatcher(env, { fetchImpl: changed, now: () => T0, sleep: noSleep });
    const repeat = await runRuleWatcher(env, { fetchImpl: changed, now: () => T0, sleep: noSleep });
    assert.equal(repeat.changed, 0, 'the new text is the baseline now');
    assert.equal(net.sent.length, 1);
  } finally { net.restore(); }
});

test('a page that fails to load holds its rules only on the third failure in a row', async () => {
  const net = stubResend();
  try {
    const DB = makeDb();
    const env = { DB, RESEND_API_KEY: 'k' };
    await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
    const down = pages({ '*': page(LONG + 'version one'), [USPS]: { status: 503 } });
    for (let i = 1; i < RULE_WATCHER.FAILS_BEFORE_HOLD; i++) {
      const s = await runRuleWatcher(env, { fetchImpl: down, now: () => T0, sleep: noSleep });
      assert.equal(s.newlyHeld.length, 0, `failure ${i} does not hold`);
    }
    assert.equal(net.sent.length, 0);
    const third = await runRuleWatcher(env, { fetchImpl: down, now: () => T0, sleep: noSleep });
    assert.deepEqual([...third.newlyHeld].sort(), ['usps-forwarding', 'usps-hold-mail']);
    assert.equal(net.sent.length, 1);
    assert.match(net.sent[0].html, /3 runs in a row/);
  } finally { net.restore(); }
});

test('a success in between resets the failure count', async () => {
  const DB = makeDb();
  const env = { DB };
  await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
  const down = pages({ '*': page(LONG + 'version one'), [USPS]: new Error('network') });
  await runRuleWatcher(env, { fetchImpl: down, now: () => T0, sleep: noSleep });
  await runRuleWatcher(env, { fetchImpl: down, now: () => T0, sleep: noSleep });
  await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
  const again = await runRuleWatcher(env, { fetchImpl: down, now: () => T0, sleep: noSleep });
  assert.equal(again.newlyHeld.length, 0);
  assert.equal(DB.raw.prepare('SELECT fail_count FROM rule_watch_urls WHERE url = ?').get(USPS).fail_count, 1);
});

const CHALLENGE = '<html><body><h1>Just a moment...</h1>' + 'x '.repeat(200) + '</body></html>';

test('a bot-check page is "cannot check", never a changed rule and never a failure', async () => {
  const DB = makeDb();
  const env = { DB };
  await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
  const blocked = pages({ '*': page(LONG + 'version one'), [USPS]: CHALLENGE });
  const s = await runRuleWatcher(env, { fetchImpl: blocked, now: () => T0, sleep: noSleep });
  assert.equal(s.changed, 0);
  assert.equal(s.failed, 0);
  assert.equal(s.blocked, 1);
  assert.deepEqual(s.cannotCheck, [USPS]);
  assert.equal(s.newlyHeld.length, 0);
});

test('a page that keeps refusing automated visitors never holds a rule, however many weeks it happens', async () => {
  const net = stubResend();
  try {
    const DB = makeDb();
    const env = { DB, RESEND_API_KEY: 'k' };
    await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
    for (const blocked of [CHALLENGE, { status: 403 }, { status: 429 }, { status: 401 }, CHALLENGE, { status: 403 }]) {
      const s = await runRuleWatcher(env, { fetchImpl: pages({ '*': page(LONG + 'version one'), [USPS]: blocked }), now: () => T0, sleep: noSleep });
      assert.equal(s.newlyHeld.length, 0);
    }
    assert.equal(net.sent.length, 0, 'no email when nothing was held');
    assert.equal(DB.raw.prepare('SELECT count(*) AS n FROM rule_status_overrides').get().n, 0);
    assert.equal(DB.raw.prepare('SELECT fail_count FROM rule_watch_urls WHERE url = ?').get(USPS).fail_count, 0);
  } finally { net.restore(); }
});

test('a block neither counts as a failure nor resets the count of real ones', async () => {
  const DB = makeDb();
  const env = { DB };
  await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
  const run = (v) => runRuleWatcher(env, { fetchImpl: pages({ '*': page(LONG + 'version one'), [USPS]: v }), now: () => T0, sleep: noSleep });
  const count = () => DB.raw.prepare('SELECT fail_count FROM rule_watch_urls WHERE url = ?').get(USPS).fail_count;
  await run({ status: 503 });
  await run({ status: 503 });
  const blocked = await run({ status: 403 });
  assert.equal(blocked.newlyHeld.length, 0, 'a block never holds');
  assert.equal(count(), 2, 'the block left the two real failures as they were');
  const third = await run({ status: 503 });
  assert.deepEqual([...third.newlyHeld].sort(), ['usps-forwarding', 'usps-hold-mail'], 'the third real failure still holds');
});

test('after a block ends, the stored baseline is still there, so a real change is still caught', async () => {
  const DB = makeDb();
  const env = { DB };
  await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
  await runRuleWatcher(env, { fetchImpl: pages({ '*': page(LONG + 'version one'), [USPS]: { status: 403 } }), now: () => T0, sleep: noSleep });
  const later = await runRuleWatcher(env, { fetchImpl: pages({ '*': page(LONG + 'version one'), [USPS]: page(LONG + 'new wording') }), now: () => T0, sleep: noSleep });
  assert.equal(later.changed, 1);
  assert.deepEqual([...later.newlyHeld].sort(), ['usps-forwarding', 'usps-hold-mail']);
});

test('a page that was never readable has no baseline and is listed as one that cannot be checked', async () => {
  const DB = makeDb();
  const env = { DB };
  await runRuleWatcher(env, { fetchImpl: pages({ '*': { status: 403 } }), now: () => T0, sleep: noSleep });
  assert.equal(DB.raw.prepare('SELECT count(*) AS n FROM rule_watch_urls WHERE hash IS NOT NULL').get().n, 0);
  const rows = await listRulesForAdmin(env);
  assert.ok(rows.filter((r) => r.officialUrl).every((r) => r.cannotCheck === true));
  assert.ok(rows.filter((r) => !r.officialUrl).every((r) => r.cannotCheck === false), 'a rule with no page is not marked');
  assert.equal(rows.find((r) => r.id === 'usps-hold-mail').lastChecked, null, 'never reports a check that did not happen');
  assert.match(rulesAdminPageHtml(), /Cannot check automatically/);
});

test('real failures and real changes still hold, and the summary email also lists the pages that cannot be checked', async () => {
  const net = stubResend();
  try {
    const DB = makeDb();
    const env = { DB, RESEND_API_KEY: 'k' };
    await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
    const s = await runRuleWatcher(env, {
      fetchImpl: pages({ '*': page(LONG + 'version one'), [USPS]: page(LONG + 'changed'), 'https://tdac.immigration.go.th/arrival-card/': { status: 403 } }),
      now: () => T0, sleep: noSleep,
    });
    assert.deepEqual([...s.newlyHeld].sort(), ['usps-forwarding', 'usps-hold-mail']);
    assert.equal(net.sent.length, 1);
    assert.match(net.sent[0].html, /refuse automated visits/);
    assert.match(net.sent[0].html, /tdac\.immigration\.go\.th/);
    assert.match(net.sent[0].text, /Cannot be checked automatically/);
  } finally { net.restore(); }
});

test('confirming a held rule restores it with the new checked date; keeping it leaves it held', async () => {
  const DB = makeDb();
  const env = { DB };
  await runRuleWatcher(env, { fetchImpl: baseline(), now: () => T0, sleep: noSleep });
  await runRuleWatcher(env, { fetchImpl: pages({ '*': page(LONG + 'version one'), [USPS]: page(LONG + 'changed') }), now: () => T0, sleep: noSleep });

  await keepRuleHeld(env, 'usps-forwarding', 'still reading it');
  await confirmRule(env, 'usps-hold-mail', '2026-10-20');
  const overrides = await getRuleOverrides(env);
  const plan = buildLeaveByPlan({ destination: 'Tokyo, Japan', today: '2026-10-16', departureDate: '2026-12-20', returnDate: '2026-12-27', tripLengthBucket: '7-10', answers: {}, overrides });
  const restored = plan.items.find((i) => i.id === 'usps-hold-mail');
  assert.equal(restored.status, 'active');
  assert.equal(restored.asOf, '2026-10-20');
  assert.ok(restored.actByDate, 'a confirmed rule shows its suggested date again');
  const rows = await listRulesForAdmin(env);
  assert.equal(rows.find((r) => r.id === 'usps-hold-mail').status, 'active');
  assert.equal(rows.find((r) => r.id === 'usps-forwarding').status, 'held');
  assert.equal(rows.find((r) => r.id === 'usps-forwarding').note, 'still reading it');
});

test('confirming a not-yet-required rule puts it back as not-yet-required, never as active', async () => {
  const DB = makeDb();
  await confirmRule({ DB }, 'etias', '2026-10-20');
  const overrides = await getRuleOverrides({ DB });
  const plan = buildLeaveByPlan({ destination: 'Madrid, Spain', today: '2026-10-16', departureDate: '2026-12-20', returnDate: '2026-12-27', tripLengthBucket: '7-10', answers: {}, overrides });
  const etias = plan.items.find((i) => i.id === 'etias');
  assert.equal(etias.status, 'not_yet_required');
  assert.equal(etias.actByDate, null);
});

// ---- the admin routes and the plan API ----

const ENV = (DB, extra = {}) => ({ DB, ADMIN_SECRET: 's3cret', ENABLE_RULE_WATCHER: 'true', ENABLE_LEAVE_BY_PLAN: 'true', ...extra });
const ctx = { waitUntil: () => {} };
const req = (path, init = {}) => new Request('https://sparkfare.com' + path, init);
const auth = { Authorization: 'Bearer s3cret' };

test('flag off: /admin/rules and its data and action routes return 404, and nothing touches the database', async () => {
  const DB = makeDb();
  const env = ENV(DB, { ENABLE_RULE_WATCHER: 'false' });
  assert.equal((await worker.fetch(req('/admin/rules'), env, ctx)).status, 404);
  assert.equal((await worker.fetch(req('/admin/rules/data', { headers: auth }), env, ctx)).status, 404);
  assert.equal((await worker.fetch(req('/admin/rules/action', { method: 'POST', headers: auth, body: '{}' }), env, ctx)).status, 404);
  assert.equal(ruleWatcherEnabled(env), false);
  assert.equal(ruleWatcherEnabled({ ENABLE_RULE_WATCHER: 'yes' }), false, 'only the exact string "true" turns it on');
  assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'rule_%'").get().n, 0);
});

test('admin data and actions need the admin secret in the Authorization header, never in the URL', async () => {
  const env = ENV(makeDb());
  assert.equal((await worker.fetch(req('/admin/rules/data'), env, ctx)).status, 401);
  assert.equal((await worker.fetch(req('/admin/rules/data', { headers: { Authorization: 'Bearer nope' } }), env, ctx)).status, 401);
  assert.equal((await worker.fetch(req('/admin/rules/data?secret=s3cret'), env, ctx)).status, 401);
  assert.equal((await worker.fetch(req('/admin/rules/data?key=s3cret'), env, ctx)).status, 401);
  assert.equal((await worker.fetch(req('/admin/rules/action', { method: 'POST', body: '{"action":"run"}' }), env, ctx)).status, 401);
  const noSecretConfigured = { ...env, ADMIN_SECRET: undefined };
  assert.equal((await worker.fetch(req('/admin/rules/data', { headers: { Authorization: 'Bearer ' } }), noSecretConfigured, ctx)).status, 401);
});

test('/admin/rules is a static shell: no data, no secret, not indexable', async () => {
  const res = await worker.fetch(req('/admin/rules'), ENV(makeDb()), ctx);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('X-Robots-Tag'), /noindex/);
  const html = await res.text();
  assert.match(html, /name="robots" content="noindex/);
  assert.ok(!html.includes('s3cret'));
  assert.ok(!/usps-hold-mail/.test(html), 'no rule data in the shell');
  assert.match(html, /Confirm still correct/);
  assert.match(html, /Keep held/);
});

test('admin: list the rules, confirm one, keep another, reject unknown rules and actions', async () => {
  const DB = makeDb();
  const env = ENV(DB);
  const list = await (await worker.fetch(req('/admin/rules/data', { headers: auth }), env, ctx)).json();
  assert.equal(list.ok, true);
  assert.equal(list.rules.length, ALL_WATCHED_RULES.length, 'the leave-by rules and the passport rules');
  const post = (body) => worker.fetch(req('/admin/rules/action', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env, ctx);
  assert.equal((await post({ ruleId: 'usps-hold-mail', action: 'keep', note: 'checking' })).status, 200);
  assert.equal((await post({ ruleId: 'usps-hold-mail', action: 'confirm' })).status, 200);
  assert.equal((await post({ ruleId: 'no-such-rule', action: 'confirm' })).status, 400);
  assert.equal((await post({ ruleId: 'usps-hold-mail', action: 'explode' })).status, 400);
  assert.equal((await worker.fetch(req('/admin/rules/action', { method: 'POST', headers: auth, body: 'not json' }), env, ctx)).status, 400);
});

test('/api/leave-by-plan shows a watcher hold, and a client cannot send its own overrides to lift it', async () => {
  const DB = makeDb();
  const env = ENV(DB);
  await keepRuleHeld(env, 'usps-hold-mail');
  const body = { destination: 'Tokyo, Japan', today: '2026-10-16', departureDate: '2026-12-20', returnDate: '2026-12-27', tripLengthBucket: '7-10', answers: {} };
  const res = await worker.fetch(req('/api/leave-by-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, overrides: { 'usps-hold-mail': { status: 'confirmed', asOf: '2030-01-01' } } }) }), env, ctx);
  const data = await res.json();
  const item = data.plan.items.find((i) => i.id === 'usps-hold-mail');
  assert.equal(item.status, 'held');
  assert.equal(item.actByDate, null);
  const ics = await worker.fetch(req('/api/leave-by-plan/ics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, overrides: { 'usps-hold-mail': { status: 'confirmed', asOf: '2030-01-01' } } }) }), env, ctx);
  assert.ok(!(await ics.text()).includes('usps-hold-mail'), 'a held rule has no calendar event');
});

test('flag off: the plan API does not read the override table', async () => {
  const sqls = [];
  const exec = { run: async () => ({}), first: async () => null, all: async () => ({ results: [] }) };
  const env = {
    ENABLE_LEAVE_BY_PLAN: 'true',
    ENABLE_RULE_WATCHER: 'false',
    DB: { prepare(sql) { sqls.push(sql); return { ...exec, bind: () => exec }; } },
  };
  const body = JSON.stringify({ destination: 'Tokyo, Japan', today: '2026-10-16', departureDate: '2026-12-20', returnDate: '2026-12-27', tripLengthBucket: '7-10', answers: {} });
  const res = await worker.fetch(req('/api/leave-by-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }), env, ctx);
  assert.equal(res.status, 200);
  assert.ok(!sqls.some((q) => /rule_status_overrides|rule_watch_urls/.test(q)), 'no watcher table is touched while the flag is off');
});

test('the Monday cron runs the watcher only when the flag is on, and the flag ships off', async () => {
  const net = stubResend();
  const originalError = console.error;
  console.error = () => {};
  try {
    const DB = makeDb();
    await worker.scheduled({ cron: '0 9 * * 2' }, { DB, RESEND_API_KEY: 'k', ENABLE_RULE_WATCHER: 'false' });
    assert.equal(DB.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'rule_watch_urls'").get().n, 0, 'off: nothing created');
    await worker.scheduled({ cron: '0 9 * * 2' }, { DB, RESEND_API_KEY: 'k', ENABLE_RULE_WATCHER: 'true' });
    assert.ok(DB.raw.prepare('SELECT COUNT(*) AS n FROM rule_watch_urls').get().n > 0, 'on: it ran and recorded pages');
  } finally { console.error = originalError; net.restore(); }
  const cfg = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(cfg, /"ENABLE_RULE_WATCHER":\s*"false"/);
  assert.match(cfg, /"crons":\s*\["30 3 \* \* \*", "0 8 \* \* \*", "30 9 \* \* \*", "0 9 \* \* 2"\]/, "the watcher added no cron of its own (the 09:30 entry is N8's daily data alert)");
});
