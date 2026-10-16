import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import worker from '../src/index.js';
import {
  buildLeaveByPlan, LEAVE_BY_RULES, LEAVE_BY_DESTINATIONS, DESTINATION_COUNTRY_MAP, COUNTRY_SLUGS, COUNTRY_NAMES,
  stateDeptCountryUrl, depthForDays,
} from '../src/data/leaveByRules.js';

// Addendum G task G3 (ROADMAP step 89): the plan page, the rules it runs in the browser, and the entry points. All behind
// ENABLE_LEAVE_BY_PLAN, which ships "false".

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ctx = { waitUntil: () => {} };
const req = (path, init) => new Request('https://sparkfare.com' + path, init);
const BANNED = /\b(book|booking|booked|secured?|protect(ing|ion|s)?|safe(ly|ty)?|vetted|guarantee[ds]?|hurry|last chance|countdown)\b|don't miss/i;

const DEPART = '2026-12-20';
const plan = (destination, days, answers = {}, extra = {}) => {
  const back = new Date(new Date(DEPART).getTime() + days * 86400000).toISOString().slice(0, 10);
  return buildLeaveByPlan({ destination, today: '2026-10-16', departureDate: DEPART, returnDate: back, answers, ...extra });
};
const nonNoteItems = (p) => p.items.filter((i) => i.kind !== 'passport' && i.kind !== 'note');

test('the browser copy of the rules is byte-for-byte the Worker copy (run scripts/sync-leave-by-rules.js after editing)', () => {
  assert.equal(read('leave-by-rules.js'), read('src/data/leaveByRules.js'));
});

test('the destination list is the 40 in sparkfare_destinations.json, each with a country and a State Department page', () => {
  const d = JSON.parse(read('sparkfare_destinations.json'));
  const names = Array.isArray(d) ? d.map((x) => x.display_name || x.name) : Object.keys(d);
  assert.deepEqual(LEAVE_BY_DESTINATIONS, names);
  for (const n of names) {
    const code = DESTINATION_COUNTRY_MAP[n];
    assert.ok(code, `${n} has a country`);
    assert.ok(COUNTRY_SLUGS[code], `${code} has a State Department page slug`);
    assert.ok(COUNTRY_NAMES[code], `${code} has a name`);
    assert.match(stateDeptCountryUrl(code), /^https:\/\/travel\.state\.gov\/en\/international-travel\/travel-advisories\/[a-z-]+\.html$/);
  }
});

test('ETIAS appears for exactly the 14 destinations in the 30 ETIAS countries, as a note with no date', () => {
  const expected = ['Amalfi Coast, Italy', 'Algarve, Portugal', 'Lisbon, Portugal', 'Athens, Greece', 'Thessaloniki, Greece', 'Larnaca, Cyprus', 'Madrid, Spain',
    'Mallorca, Spain', 'Dubrovnik, Croatia', 'Prague, Czechia', 'Budapest, Hungary', 'Sofia / Borovets, Bulgaria', 'Krakow, Poland', 'Bucharest, Romania'];
  const has = LEAVE_BY_DESTINATIONS.filter((d) => plan(d, 8).items.some((i) => i.id === 'etias'));
  assert.deepEqual([...has].sort(), [...expected].sort());
  const e = plan('Madrid, Spain', 8).items.find((i) => i.id === 'etias');
  assert.equal(e.status, 'not_yet_required');
  assert.equal(e.actByDate, null);
  assert.equal(e.why, 'Not required yet; the EU has not set a start date.');
});

test('the Bali levy rule states no amount, and no rule anywhere quotes an unconfirmed figure', () => {
  const bali = plan('Bali, Indonesia', 8).items.find((i) => i.id === 'bali-levy');
  assert.ok(bali);
  assert.doesNotMatch(JSON.stringify(LEAVE_BY_RULES), /150[,.]?000|IDR/);
  assert.match(bali.why, /tourist levy/);
});

test('depth: Short is the passport item plus at most three others; the entry step comes first when there is one', () => {
  for (const days of [2, 5, 8, 10]) {
    for (const d of ['Tokyo, Japan', 'Phuket, Thailand', 'Bali, Indonesia', 'Madrid, Spain']) {
      const p = plan(d, days, { pet_home: 'yes', keeper: 'no', driving: 'yes', airport_parking: 'yes' });
      assert.equal(p.depth, 'short');
      assert.equal(p.items[0].id, 'passport-check', 'the passport item is first');
      assert.ok(nonNoteItems(p).length <= 3, `${d} ${days}d shows ${nonNoteItems(p).length} items`);
    }
  }
  const thailand = plan('Phuket, Thailand', 8, { pet_home: 'yes', keeper: 'no' });
  assert.ok(thailand.items.some((i) => i.id === 'thailand-arrival-card'), 'the entry step makes the cut');
});

test('depth: Standard adds the mail hold, STEP and phone and data; Long adds forwarding and drops the 30-day hold', () => {
  const standard = plan('Tokyo, Japan', 12, { keeper: 'no' });
  assert.equal(standard.depth, 'standard');
  for (const id of ['usps-hold-mail', 'step', 'destination-phone-data', 'home-water-shutoff', 'home-checkin']) {
    assert.ok(standard.items.some((i) => i.id === id), `Standard has ${id}`);
  }
  assert.ok(nonNoteItems(standard).length > 3);
  const long = plan('Tokyo, Japan', 35, { keeper: 'no' });
  assert.equal(long.depth, 'long');
  assert.ok(long.items.some((i) => i.id === 'usps-forwarding'));
  assert.ok(!long.items.some((i) => i.id === 'usps-hold-mail'), 'Hold Mail stops at 30 days');
  assert.equal(depthForDays(10), 'short');
  assert.equal(depthForDays(11), 'standard');
  assert.equal(depthForDays(29), 'standard');
  assert.equal(depthForDays(30), 'long');
});

test('the four yes/no answers switch their items on and off', () => {
  const id = (p, x) => p.items.some((i) => i.id === x);
  const base = plan('Tokyo, Japan', 14, { pet_home: 'no', keeper: 'no', driving: 'no', airport_parking: 'no' });
  assert.ok(!id(base, 'home-pets') && !id(base, 'idp') && !id(base, 'home-airport-parking') && !id(base, 'home-keeper-handoff'));
  assert.ok(id(base, 'home-checkin'));
  const all = plan('Tokyo, Japan', 14, { pet_home: 'yes', keeper: 'yes', driving: 'yes', airport_parking: 'yes' });
  assert.ok(id(all, 'home-pets') && id(all, 'idp') && id(all, 'home-airport-parking') && id(all, 'home-keeper-handoff'));
  assert.ok(!id(all, 'home-checkin'), 'someone already checks in, so the ask-someone item is replaced by the handoff sheet');
  assert.equal(all.items.find((i) => i.id === 'home-keeper-handoff').internalUrl, '/blog/one-page-home-handoff-sheet');
});

test('items are ordered: passport first, then dated items by act-by date, then the undated ones', () => {
  const p = plan('Phuket, Thailand', 14, { pet_home: 'yes', keeper: 'no', driving: 'yes', airport_parking: 'yes' });
  assert.equal(p.items[0].id, 'passport-check');
  const rest = p.items.slice(1);
  const firstUndated = rest.findIndex((i) => !i.actByDate);
  const dated = firstUndated === -1 ? rest : rest.slice(0, firstUndated);
  assert.ok(dated.length >= 4);
  assert.ok(rest.slice(Math.max(firstUndated, 0)).every((i) => firstUndated === -1 || !i.actByDate), 'no dated item after an undated one');
  const dates = dated.map((i) => i.actByDate);
  assert.deepEqual(dates, [...dates].sort());
});

test('an unverified or held rule shows a notice and a link, never a date, a why line or a partner', () => {
  const brazil = plan('Rio de Janeiro, Brazil', 8);
  for (const id of ['passport-check', 'brazil-evisa']) {
    const i = brazil.items.find((x) => x.id === id);
    assert.ok(i, id);
    assert.equal(i.status, 'held');
    assert.equal(i.heldNotice, 'Check the official page:');
    assert.equal(i.actByDate, null);
    assert.equal(i.actByText, null);
    assert.equal(i.why, null);
    assert.equal(i.quote, null);
    assert.equal(i.partner, null);
    assert.match(i.officialUrl, /^https:\/\//);
  }
  assert.match(brazil.items[0].officialUrl, /travel-advisories\/brazil\.html$/);
});

test('every active rule with a source carries its official link, source, quote and checked date; plain suggestions carry no source line', () => {
  for (const r of LEAVE_BY_RULES) {
    if (r.status === 'active' && !r.isHomeItem) {
      assert.ok(r.officialUrl && r.sourceUrl && r.sourceName, `${r.id} has links and a source name`);
      assert.ok(r.quote, `${r.id} has the quote it rests on`);
      assert.match(r.asOf, /^\d{4}-\d{2}-\d{2}$/, `${r.id} has a checked date`);
    }
    if (r.officialUrl) assert.match(r.officialUrl, /^https:\/\//);
  }
  const p = plan('Phuket, Thailand', 14, { keeper: 'no' });
  for (const i of p.items.filter((x) => x.status === 'active' && !x.isHomeItem)) {
    assert.ok(i.sourceName && i.asOf && i.officialUrl, `${i.id} shows source and checked date`);
  }
});

test('no rule text uses a word on the Away Mode banned list', () => {
  for (const r of LEAVE_BY_RULES) {
    for (const field of ['title', 'why']) {
      if (r[field]) assert.doesNotMatch(r[field], BANNED, `${r.id}.${field}`);
    }
  }
  const page = read('plan.html');
  assert.doesNotMatch(page.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ''), BANNED);
});

test('no travel date reaches a link, an address or storage: the plan items carry none, and the page has no form or storage', () => {
  const p = plan('Bali, Indonesia', 21, { pet_home: 'yes', keeper: 'yes', driving: 'yes', airport_parking: 'yes' }, { returnDate: '2027-01-10' });
  const links = p.items.flatMap((i) => [i.officialUrl, i.sourceUrl, i.internalUrl, i.partner ? `/out/${i.partner.slug}` : null]).filter(Boolean);
  for (const l of links) assert.doesNotMatch(l, /2026|2027|\d{4}-\d{2}-\d{2}/, l);
  const page = read('plan.html');
  assert.doesNotMatch(page, /<form\b/i, 'no <form>: a form could put the dates in the address bar');
  assert.doesNotMatch(page, /localStorage|sessionStorage|document\.cookie|history\.(push|replace)State|location\.(search|hash|href)\s*=/);
  assert.doesNotMatch(page, /fetch\([^)]*(leave-date|back-date|departure|return)/i, 'no request carries the dates');
  // the page's requests: the held-rule list, and the fixed-shape counts of G6 (checked in tests/plan_events.test.js)
  const fetches = [...page.matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(fetches, ['/api/events', '/api/leave-by-plan/status']);
  // the partner link carries a source tag, the rule id and the trip-length bucket only
  assert.match(page, /'\/out\/' \+ encodeURIComponent\(it\.partner\.slug\) \+ '\?src=away-plan&rule=' \+ encodeURIComponent\(it\.id\) \+ '&bucket=' \+ encodeURIComponent\(lastBucket \|\| ''\)/);
});

test('a partner item shows its commission line before the link, with a sponsored link', () => {
  const p = plan('Tokyo, Japan', 12, { keeper: 'no' });
  const phone = p.items.find((i) => i.id === 'destination-phone-data');
  assert.ok(phone.partner.disclosure.startsWith('Sparkfare may earn a commission'));
  const page = read('plan.html');
  assert.ok(page.indexOf("it.partner.disclosure") < page.indexOf("a.href = '/out/'"), 'disclosure is written before the link');
  assert.match(page, /rel = 'sponsored nofollow noopener noreferrer'/);
  for (const i of p.items) assert.ok(!i.partner || ['yesim', 'us-global-mail'].includes(i.partner.slug), 'only live partners');
});

// ---- the Worker routes ----

function envWith(extra = {}) {
  const planHtml = read('plan.html');
  return {
    ASSETS: { fetch: async (r) => (String(r.url).endsWith('plan.html') ? new Response(planHtml, { status: 200 }) : new Response('', { status: 404 })) },
    ...extra,
  };
}

test('flag off: /plan and the status route answer 404', async () => {
  const env = envWith({ ENABLE_LEAVE_BY_PLAN: 'false' });
  assert.equal((await worker.fetch(req('/plan'), env, ctx)).status, 404);
  assert.equal((await worker.fetch(req('/plan?src=nav'), env, ctx)).status, 404);
  assert.equal((await worker.fetch(req('/api/leave-by-plan/status'), env, ctx)).status, 404);
  assert.equal((await worker.fetch(req('/plan'), envWith({}), ctx)).status, 404, 'unset means off');
  assert.equal((await worker.fetch(req('/plan'), envWith({ ENABLE_LEAVE_BY_PLAN: 'yes' }), ctx)).status, 404, 'only "true" turns it on');
});

test('flag on: /plan serves the page and the status route says it is on', async () => {
  const env = envWith({ ENABLE_LEAVE_BY_PLAN: 'true' });
  const page = await worker.fetch(req('/plan?src=home'), env, ctx);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Content-Type'), /text\/html/);
  assert.match(await page.text(), /Leave-by plan/);
  const status = await worker.fetch(req('/api/leave-by-plan/status'), env, ctx);
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { ok: true, enabled: true, passportCheck: false, overrides: {} });
});

test('the status route lists holds and confirmations without reasons, notes or addresses', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, p) => ({ run: async () => { raw.prepare(sql).run(...p); return {}; }, first: async () => raw.prepare(sql).get(...p) ?? null, all: async () => ({ results: raw.prepare(sql).all(...p) }) });
  const DB = { prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
  const { keepRuleHeld, confirmRule } = await import('../src/ruleWatcher.js');
  const env = envWith({ ENABLE_LEAVE_BY_PLAN: 'true', ENABLE_RULE_WATCHER: 'true', DB });
  await keepRuleHeld(env, 'usps-hold-mail', 'private note');
  await confirmRule(env, 'step', '2026-10-20');
  const body = await (await worker.fetch(req('/api/leave-by-plan/status'), env, ctx)).json();
  assert.deepEqual(body.overrides, { 'usps-hold-mail': { status: 'held', asOf: null }, step: { status: 'confirmed', asOf: '2026-10-20' } });
  assert.doesNotMatch(JSON.stringify(body), /private note|usps\.com/);
});

test('route pages: the plan line and the nav link appear only when the flag is on, and never inside a deal card', async () => {
  const assets = {
    fetch: async (r) => {
      const u = String(r.url);
      if (u.includes('sparkfare_ranked_deals')) {
        const obs = Array(15).fill(0).map((_, i) => ({ price: 350 + (14 - i) * 5, date: new Date(Date.now() - (14 - i) * 86400000).toISOString() }));
        return { ok: true, json: async () => ({ deals: [{ origin: 'JFK', display_name: 'Lisbon, Portugal', price: 350, observations: obs }] }), text: async () => '{}' };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    },
  };
  const off = await (await worker.fetch(req('/flight/JFK/Lisbon, Portugal'), { ASSETS: assets, ENABLE_LEAVE_BY_PLAN: 'false' }, ctx)).text();
  assert.doesNotMatch(off, /Make your leave-by plan|\/plan\?/);
  const on = await (await worker.fetch(req('/flight/JFK/Lisbon, Portugal'), { ASSETS: assets, ENABLE_LEAVE_BY_PLAN: 'true' }, ctx)).text();
  assert.match(on, /Leaving the country\? <a href="\/plan\?src=route">Make your leave-by plan<\/a>/);
  assert.match(on, /<a href="\/plan\?src=nav">Leave-by plan<\/a>/);
  assert.equal([...on.matchAll(/href="\/plan\?/g)].length, 2);
});

// ---- the entry points ----

test('home page and /away-mode: the plan blocks are hidden by default, outside the deal board, and load the entry script', () => {
  const home = read('index.html');
  const block = home.indexOf('data-plan-entry');
  assert.ok(block > 0);
  assert.match(home.slice(block - 40, block + 60), /data-plan-entry hidden/);
  assert.ok(block > home.indexOf('class="directory-promo"'), 'after the board and its promo');
  assert.ok(block < home.indexOf('<footer>'));
  assert.match(home, /<script src="\/plan-entry\.js" defer><\/script>/);
  assert.doesNotMatch(home.slice(home.indexOf('<div id="board-sections">'), home.indexOf('class="directory-promo"')), /data-plan-entry/, 'not in a deal card');
  const away = read('away-mode.html');
  assert.match(away, /<div class="card" data-plan-entry hidden>/);
  assert.ok(away.indexOf('data-plan-entry') < away.indexOf('<h1>Away Mode</h1>'), 'at the top of /away-mode');
  assert.match(away, /<script src="\/plan-entry\.js" defer><\/script>/);
  // never in the digest or an alert email
  for (const f of ['src/email.js', 'src/emailTemplates/dailyDigest.js']) assert.doesNotMatch(read(f), /\/plan\?|leave-by plan/i, f);
});

function runEntryScript({ status, cached = null }) {
  const calls = [];
  const blocks = [{ hidden: true }, { hidden: true }];
  const links = [{ getAttribute: () => '/check', parentNode: null }];
  const nav = {
    children: [],
    querySelector(sel) { if (sel.includes('/plan')) return this.children.find((c) => /^\/plan/.test(c.href || '')) || null; if (sel.includes('/check')) return links[0]; return null; },
    insertBefore(n) { this.children.push(n); },
    appendChild(n) { this.children.push(n); },
  };
  links[0].parentNode = nav;
  links[0].nextSibling = null;
  const store = new Map(cached ? [['sparkfare_plan_status', JSON.stringify(cached)]] : []);
  const sandbox = {
    document: {
      querySelector: () => nav,
      querySelectorAll: () => blocks,
      createElement: () => ({}),
    },
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    fetch: async (url) => { calls.push(url); return { ok: status !== 404, json: async () => ({ enabled: status === 200 }) }; },
    Date, JSON, Promise, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(read('plan-entry.js'), sandbox);
  return new Promise((resolve) => setTimeout(() => resolve({ calls, blocks, nav, store }), 20));
}

test('plan-entry.js: flag off changes nothing and remembers it; flag on un-hides the blocks and adds one nav link', async () => {
  const off = await runEntryScript({ status: 404 });
  assert.deepEqual(off.calls, ['/api/leave-by-plan/status']);
  assert.ok(off.blocks.every((b) => b.hidden === true));
  assert.equal(off.nav.children.length, 0);
  assert.equal(JSON.parse(off.store.get('sparkfare_plan_status')).enabled, false);

  const on = await runEntryScript({ status: 200 });
  assert.ok(on.blocks.every((b) => b.hidden === false));
  assert.equal(on.nav.children.length, 1);
  assert.equal(on.nav.children[0].href, '/plan?src=nav');
  assert.equal(on.nav.children[0].textContent, 'Leave-by plan');

  const remembered = await runEntryScript({ status: 404, cached: { enabled: true, t: Date.now() } });
  assert.deepEqual(remembered.calls, [], 'a fresh remembered answer means no request');
  assert.ok(remembered.blocks.every((b) => b.hidden === false));
  const stale = await runEntryScript({ status: 404, cached: { enabled: true, t: Date.now() - 11 * 60 * 1000 } });
  assert.deepEqual(stale.calls, ['/api/leave-by-plan/status'], 'after ten minutes it asks again');
});

test('the flag ships off and /plan is routed to the Worker', () => {
  assert.match(read('wrangler.jsonc'), /"ENABLE_LEAVE_BY_PLAN":\s*"false"/);
  assert.match(read('wrangler.jsonc'), /"\/plan",/);
});
