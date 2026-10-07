// Outbound clicks now record a coarse bot / human / none class from the User-Agent (never the raw
// string), and the dashboard counts leave flagged bots out. Background: 261 anonymous clicks, 11 to 20 a
// day across all 14 partners, with 3 real users, most likely crawlers following partner links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker, { computeKPIs } from '../src/index.js';
import { classifyUserAgent } from '../src/botClass.js';

const ctx = { waitUntil: (p) => p };

function makeD1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, params) => ({
    run: async () => { db.prepare(sql).run(...params); return { success: true }; },
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
  });
  return { raw: db, prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
}

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  pinterestApp: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 [Pinterest/Android]',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  googleSmartphone: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  ahrefs: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  gpt: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)',
  slack: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  headless: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36',
  curl: 'curl/8.21.0',
  python: 'python-requests/2.32.3',
  goHttp: 'Go-http-client/2.0',
};

test('classifyUserAgent: crawlers, preview fetchers and libraries are bots; real browsers are human; the rest is none', () => {
  for (const k of ['googlebot', 'googleSmartphone', 'bingbot', 'ahrefs', 'gpt', 'slack', 'facebook', 'headless', 'curl', 'python', 'goHttp']) {
    assert.equal(classifyUserAgent(UA[k]), 'bot', k);
  }
  for (const k of ['chrome', 'iphone', 'firefox', 'edge', 'pinterestApp']) {
    assert.equal(classifyUserAgent(UA[k]), 'human', k);
  }
  for (const v of [undefined, null, '', '   ', 'MyApp/1.0', 'SomeClient']) assert.equal(classifyUserAgent(v), 'none', JSON.stringify(v));
});

function clickReq(path, ua) {
  return new Request(`https://sparkfare.com${path}`, { redirect: 'manual', headers: ua === undefined ? {} : { 'User-Agent': ua } });
}

test('/out/<partner>: the class is stored with the slot, the raw User-Agent is not, and the redirect still happens', async () => {
  const DB = makeD1();
  for (const [name, ua, want] of [['chrome', UA.chrome, 'human'], ['googlebot', UA.googlebot, 'bot'], ['none', undefined, 'none']]) {
    const res = await worker.fetch(clickReq(`/out/bounce?trip_id=t-${name}&slot=2`, ua), { DB }, ctx);
    assert.equal(res.status, 302, `${name} still redirects`);
    const row = DB.raw.prepare("SELECT meta FROM events WHERE event_type='outbound_click' AND sub_id = ?").get(`t-${name}`);
    const meta = JSON.parse(row.meta);
    assert.equal(meta.ua_class, want, name);
    assert.equal(meta.slot, '2');
    assert.ok(!row.meta.includes('Mozilla') && !row.meta.includes('Googlebot') && !row.meta.toLowerCase().includes('curl'), 'the raw User-Agent must not be stored');
  }
});

test('/go/<partner> (the legacy path in the blog posts) is classified the same way', async () => {
  const DB = makeD1();
  const res = await worker.fetch(clickReq('/go/wise', UA.bingbot), { DB }, ctx);
  assert.equal(res.status, 302);
  assert.equal(JSON.parse(DB.raw.prepare("SELECT meta FROM events WHERE event_type='outbound_click'").get().meta).ua_class, 'bot');
});

test('/out/aviasales records the class too (through logEvent)', async () => {
  const DB = makeD1();
  const target = 'https://www.aviasales.com/search/JFK0511LIS1218?marker=314524';
  const pending = [];
  const res = await worker.fetch(clickReq(`/out/aviasales?trip_id=t9&slot=flight&url=${encodeURIComponent(target)}`, UA.iphone), { DB }, { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  assert.equal(res.status, 302);
  const meta = JSON.parse(DB.raw.prepare("SELECT meta FROM events WHERE event_type='outbound_click' AND partner='aviasales'").get().meta);
  assert.deepEqual(meta, { ua_class: 'human', slot: 'flight' });
});

test('computeKPIs leaves flagged bots out of outbound_clicks and reports them separately; old rows with no class still count', async () => {
  const DB = makeD1();
  DB.raw.exec("CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, anon_id TEXT, origin TEXT, route TEXT, partner TEXT, sub_id TEXT, source TEXT, meta TEXT, ts TEXT DEFAULT (datetime('now')))");
  const ins = DB.raw.prepare("INSERT INTO events (id, event_type, partner, meta) VALUES (?, 'outbound_click', ?, ?)");
  ins.run('1', 'wise', JSON.stringify({ ua_class: 'human' }));
  ins.run('2', 'wise', JSON.stringify({ ua_class: 'bot' }));
  ins.run('3', 'wise', JSON.stringify({ ua_class: 'bot', slot: '2' }));
  ins.run('4', 'wise', null); // a click logged before this change: class unknown, so it still counts
  ins.run('5', 'wise', JSON.stringify({ ua_class: 'none' }));
  const k = await computeKPIs({ DB });
  assert.equal(k.outbound_clicks.reduce((n, r) => n + r.clicks, 0), 3, 'human + legacy + none');
  assert.equal(k.bot_outbound_clicks.reduce((n, r) => n + r.clicks, 0), 2);
});
