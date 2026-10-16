import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';
import {
  checkPassport, buildLeaveByPlan, addMonthsIso, addDaysIso, passportRuleFor, passportRequirementText,
  PASSPORT_RULES, PASSPORT_PROCESSING, ALL_WATCHED_RULES, LEAVE_BY_DESTINATIONS, DESTINATION_COUNTRY_MAP, COUNTRY_NAMES,
  PASSPORT_URGENT_URL,
} from '../src/data/leaveByRules.js';
import { collectWatchUrls } from '../src/ruleWatcher.js';
import { renderPassportBlocks } from '../src/passportPage.js';
import { renderPassportResult } from '../passport-ui.js';

// Addendum G task G5 (ROADMAP step 91): the passport check and the standalone /passport page, behind ENABLE_PASSPORT_CHECK ("false").
// "Today" is always passed in, so none of these tests depend on the clock.

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ctx = { waitUntil: () => {} };
const req = (path, init) => new Request('https://sparkfare.com' + path, init);
const TODAY = '2026-10-16';
const BANNED = /\b(book|booking|booked|secured?|protect(ing|ion|s)?|safe(ly|ty)?|vetted|guarantee[ds]?|hurry|last chance|countdown)\b|don't miss/i;

const DEP = '2026-12-20';
const RET = '2027-01-02';
const chk = (destination, month, year, extra = {}) =>
  checkPassport({ destination, departureDate: DEP, returnDate: RET, expiryMonth: month, expiryYear: year, today: TODAY, ...extra });

test('there is one rule for each of the 34 destination countries, each quoting its State Department page with a date', () => {
  const countries = new Set(Object.values(DESTINATION_COUNTRY_MAP));
  assert.equal(PASSPORT_RULES.length, 34);
  assert.deepEqual([...new Set(PASSPORT_RULES.map((r) => r.country))].sort(), [...countries].sort());
  for (const r of PASSPORT_RULES) {
    assert.match(r.sourceUrl, /^https:\/\/travel\.state\.gov\/en\/international-travel\/travel-advisories\/[a-z-]+\.html$/, r.id);
    assert.ok(r.quote && r.quote.length > 20, `${r.id} has its quote`);
    assert.match(r.pageDate, /^[A-Z][a-z]+ \d{2}, \d{4}$/, `${r.id} has the page's own date`);
    assert.equal(r.asOf, '2026-10-16');
    assert.equal(r.title, 'Passport rule: ' + COUNTRY_NAMES[r.country]);
  }
});

test('each rule\'s number appears in the quote it rests on', () => {
  const words = { 1: /one month/i, 3: /3 months/i, 6: /(6|six) months/i };
  for (const r of PASSPORT_RULES) {
    if (r.months != null) assert.match(r.quote, words[r.months], `${r.id} (${r.months} months)`);
    if (r.days != null) assert.match(r.quote, new RegExp(r.days + ' days'), r.id);
    if (r.kind === 'at_entry') assert.match(r.quote, /valid at the time of entry/i, r.id);
    if (r.kind === 'stay') assert.match(r.quote, /(entire stay|intended stay|period of the stay|duration of your stay)/i, r.id);
  }
  const by = (k) => PASSPORT_RULES.filter((r) => r.kind === k).length;
  assert.deepEqual([by('entry'), by('departure'), by('at_entry'), by('stay'), by('check')], [13, 11, 5, 4, 1]);
  assert.equal(PASSPORT_RULES.filter((r) => r.status === 'held').map((r) => r.country).join(), 'EG');
});

test('date arithmetic keeps the day, or the last day of a shorter month, and works across leap years', () => {
  assert.equal(addMonthsIso('2026-12-20', 6), '2027-06-20');
  assert.equal(addMonthsIso('2026-08-31', 6), '2027-02-28');
  assert.equal(addMonthsIso('2027-08-31', 6), '2028-02-29');
  assert.equal(addMonthsIso('2026-11-30', 3), '2027-02-28');
  assert.equal(addDaysIso('2027-01-02', 30), '2027-02-01');
  assert.equal(addMonthsIso('nope', 6), null);
});

test('entry rules count from the day you arrive: the expiry month is read as its FIRST day, so June 2027 is not enough for June 20', () => {
  const june = chk('Bali, Indonesia', 6, 2027);
  assert.equal(june.result, 'renew');
  assert.equal(june.requiredBy, '2027-06-20');
  assert.equal(june.expiryFirstDay, '2027-06-01');
  assert.equal(chk('Bali, Indonesia', 7, 2027).result, 'fine');
  assert.equal(chk('Bali, Indonesia', 4, 2027).result, 'renew');
});

test('departure rules count from the day you leave the country (the back date)', () => {
  assert.equal(chk('Madrid, Spain', 4, 2027).result, 'renew', 'April 1 is before April 2');
  assert.equal(chk('Madrid, Spain', 5, 2027).result, 'fine');
  assert.equal(chk('Madrid, Spain', 4, 2027).requiredBy, '2027-04-02');
});

test('South Africa counts days, not months', () => {
  assert.equal(chk('Cape Town, South Africa', 2, 2027).result, 'fine', 'Feb 1 is exactly 30 days after Jan 2');
  assert.equal(chk('Cape Town, South Africa', 1, 2027).result, 'renew');
  assert.equal(chk('Cape Town, South Africa', 1, 2027).requiredBy, '2027-02-01');
});

test('"valid at entry" compares with the leaving date, "valid for the stay" with the back date, and Brazil needs one month', () => {
  assert.equal(chk('Tulum, Mexico', 12, 2026).result, 'renew', 'Dec 1 is before Dec 20');
  assert.equal(chk('Tulum, Mexico', 1, 2027).result, 'fine');
  assert.equal(chk('Tokyo, Japan', 1, 2027).result, 'renew', 'Jan 1 is before the back date Jan 2');
  assert.equal(chk('Tokyo, Japan', 2, 2027).result, 'fine');
  assert.equal(chk('Rio de Janeiro, Brazil', 1, 2027).result, 'renew', 'needs to reach Jan 20');
  assert.equal(chk('Rio de Janeiro, Brazil', 2, 2027).result, 'fine');
});

test('a recommendation is shown but never decides the verdict', () => {
  const italy = chk('Amalfi Coast, Italy', 5, 2027);
  assert.equal(italy.result, 'fine');
  assert.equal(italy.rule.recommendation, 'The page recommends 6 months of validity.');
  const colombia = chk('Bogota, Colombia', 2, 2027);
  assert.equal(colombia.result, 'fine');
  assert.match(colombia.rule.recommendation, /recommends 6 months/);
  assert.equal(chk('Tokyo, Japan', 2, 2027).rule.recommendation, null);
});

test('a rule that is held or unclear never produces a verdict', () => {
  const egypt = chk('Luxor, Egypt', 1, 2035);
  assert.equal(egypt.result, 'check');
  assert.equal(egypt.headline, 'Check the official page.');
  assert.equal(egypt.heldNotice, 'Check the official page:');
  assert.equal(egypt.rule, null);
  const held = chk('Bali, Indonesia', 1, 2035, { overrides: { 'passport-ID': { status: 'held' } } });
  assert.equal(held.result, 'check');
  assert.equal(held.heldNotice, 'This changed recently. Check the official page:');
  const confirmed = chk('Bali, Indonesia', 7, 2027, { overrides: { 'passport-ID': { status: 'confirmed', asOf: '2026-10-25' } } });
  assert.equal(confirmed.result, 'fine');
  assert.equal(confirmed.rule.asOf, '2026-10-25');
});

test('renew: the suggested date is the leaving date minus the routine time, labeled a suggestion, with the processing page as its source', () => {
  const r = chk('Bali, Indonesia', 4, 2027);
  assert.equal(r.renew.actByDate, '2026-11-08', 'Dec 20 minus 6 weeks');
  assert.equal(r.renew.actByText, 'Suggested by 2026-11-08');
  assert.equal(r.renew.note, 'Routine service takes 4-6 weeks plus mailing. Expedited takes 2-3 weeks.');
  assert.equal(r.renew.pastDue, false);
  assert.equal(r.renew.urgentUrl, null);
  assert.equal(r.renew.processing.sourceUrl, 'https://travel.state.gov/en/passports/apply/help/processing-time.html');
  assert.equal(PASSPORT_PROCESSING.quote, 'Routine processing takes 4-6 weeks. Expedited processing takes 2-3 weeks.');
  // too late for the routine time: point to the official fastest route, and say nothing about appointments
  const late = checkPassport({ destination: 'Bali, Indonesia', departureDate: '2026-11-10', returnDate: '2026-11-20', expiryMonth: 1, expiryYear: 2027, today: TODAY });
  assert.equal(late.result, 'renew');
  assert.equal(late.renew.pastDue, true);
  assert.equal(late.renew.urgentUrl, PASSPORT_URGENT_URL);
  assert.equal(late.renew.urgentNote, "Here's the fastest official route now.");
  assert.doesNotMatch(JSON.stringify(late), /appointment|availab/i);
  // an expired passport is a renewal too
  assert.equal(chk('Bali, Indonesia', 3, 2025).result, 'renew');
});

test('every result carries the US-passport statement with the country named', () => {
  for (const [d, m, y] of [['Bali, Indonesia', 7, 2027], ['Bali, Indonesia', 4, 2027], ['Luxor, Egypt', 1, 2030]]) {
    const r = chk(d, m, y);
    assert.equal(r.disclaimer, 'Based on a US passport. Check the State Department page for ' + COUNTRY_NAMES[DESTINATION_COUNTRY_MAP[d]] + ' before you travel.');
    assert.match(r.countryUrl, /travel\.state\.gov/);
  }
});

test('a Tel Aviv origin gets the general State Department link and no verdict', () => {
  const r = chk('Bali, Indonesia', 7, 2027, { origin: 'TLV' });
  assert.equal(r.result, 'hidden');
  assert.equal(r.headline, null);
  assert.equal(r.generalUrl, 'https://travel.state.gov');
  assert.equal(chk('Bali, Indonesia', 7, 2027, { origin: 'tlv' }).result, 'hidden');
  assert.equal(chk('Bali, Indonesia', 7, 2027, { origin: 'JFK' }).result, 'fine');
});

test('bad input is refused without throwing, and the expiry is never echoed back as free text', () => {
  for (const [m, y] of [[0, 2027], [13, 2027], ['x', 2027], [5, 1999], [5, 2101], [5.5, 2027], ['', ''], [null, 2027]]) {
    const r = chk('Bali, Indonesia', m, y);
    assert.equal(r.ok, false, `${m}/${y}`);
    assert.equal(r.error, 'expiry');
  }
  assert.equal(checkPassport({ destination: 'Bali, Indonesia', departureDate: RET, returnDate: DEP, expiryMonth: 5, expiryYear: 2028, today: TODAY }).error, 'dates');
  assert.equal(checkPassport({ destination: 'Bali, Indonesia', expiryMonth: 5, expiryYear: 2028 }).error, 'dates');
  assert.equal(chk('Not a place', 5, 2030).result, 'check', 'an unknown destination falls back to the official page');
});

test('inside the plan: only when the flag is on and an expiry was given', () => {
  const base = { destination: 'Bali, Indonesia', today: TODAY, departureDate: DEP, returnDate: RET, answers: {} };
  assert.equal(buildLeaveByPlan({ ...base, passportExpiry: { month: 7, year: 2027 } }).passport, null, 'flag off');
  assert.equal(buildLeaveByPlan({ ...base, passportCheckEnabled: true }).passport, null, 'no expiry given');
  const on = buildLeaveByPlan({ ...base, passportCheckEnabled: true, passportExpiry: { month: 7, year: 2027 } });
  assert.equal(on.passport.result, 'fine');
  assert.equal(buildLeaveByPlan({ ...base, passportCheckEnabled: true, passportExpiry: { month: 7, year: 2027 }, origin: 'TLV' }).passport.result, 'hidden');
});

test('the server never accepts an expiry: the plan API ignores it', async () => {
  const env = { ENABLE_LEAVE_BY_PLAN: 'true', ENABLE_PASSPORT_CHECK: 'true' };
  const body = JSON.stringify({ destination: 'Bali, Indonesia', departureDate: DEP, returnDate: RET, today: TODAY, answers: {}, passportExpiry: { month: 7, year: 2027 }, passportCheckEnabled: true });
  const res = await worker.fetch(req('/api/leave-by-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }), env, ctx);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).plan.passport, null);
});

// ---- routes and the page ----

function envWith(extra = {}) {
  const page = read('passport.html');
  return { ASSETS: { fetch: async (r) => (String(r.url).endsWith('passport.html') ? new Response(page) : new Response('', { status: 404 })) }, ...extra };
}

test('flag off: /passport and its status route answer 404', async () => {
  for (const env of [envWith({ ENABLE_PASSPORT_CHECK: 'false' }), envWith({}), envWith({ ENABLE_PASSPORT_CHECK: 'yes' })]) {
    assert.equal((await worker.fetch(req('/passport'), env, ctx)).status, 404);
    assert.equal((await worker.fetch(req('/api/passport-check/status'), env, ctx)).status, 404);
  }
  assert.match(read('wrangler.jsonc'), /"ENABLE_PASSPORT_CHECK":\s*"false"/);
  assert.match(read('wrangler.jsonc'), /"\/passport",/);
});

test('flag on: /passport has one block per destination, the processing times, a canonical and no noindex', async () => {
  const res = await worker.fetch(req('/passport?expiry=2027-07&leave=2026-12-20'), envWith({ ENABLE_PASSPORT_CHECK: 'true' }), ctx);
  assert.equal(res.status, 200);
  const html = await res.text();
  for (const d of LEAVE_BY_DESTINATIONS) assert.ok(html.includes(`<h3>${d.replace(/&/g, '&amp;')}</h3>`) || html.includes(`<h3>${d}</h3>`), d);
  assert.equal([...html.matchAll(/<section class="dest"/g)].length, 41, '40 destinations plus the processing times');
  assert.match(html, /Routine processing takes 4-6 weeks\. Expedited processing takes 2-3 weeks\./);
  assert.match(html, /<link rel="canonical" href="https:\/\/sparkfare\.com\/passport"/);
  assert.doesNotMatch(html, /noindex/);
  assert.doesNotMatch(html, /2027-07|2026-12-20/, 'nothing from the query string is reflected');
  assert.doesNotMatch(html, /<!--PASSPORT_BLOCKS-->/);
});

test('the blocks quote the page, say when it was checked, escape their text, and Egypt just points to the official page', () => {
  const blocks = renderPassportBlocks();
  assert.match(blocks, /<blockquote>Must have 6 months validity beyond your arrival date\. 2 blank pages required for entry\.<\/blockquote>/);
  assert.match(blocks, /Page last updated July 09, 2026\. Checked on 2026-10-16\./);
  assert.match(blocks, /Valid for 6 months after the day you arrive\./);
  assert.match(blocks, /Valid for 30 days after the day you leave the country\./);
  const egypt = blocks.slice(blocks.indexOf('id="luxor-egypt"'), blocks.indexOf('id="tbilisi-georgia"'));
  assert.match(egypt, /Check the official page/);
  assert.doesNotMatch(egypt, /<blockquote>/);
  assert.doesNotMatch(blocks, /<script|onerror|javascript:/i);
  assert.doesNotMatch(blocks.replace(/<[^>]+>/g, ' '), BANNED);
});

test('status routes: the passport route lists only passport rules; the plan status says whether the check is on', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const raw = new DatabaseSync(':memory:');
  const stmt = (sql, p) => ({ run: async () => { raw.prepare(sql).run(...p); return {}; }, first: async () => raw.prepare(sql).get(...p) ?? null, all: async () => ({ results: raw.prepare(sql).all(...p) }) });
  const DB = { prepare: (sql) => ({ ...stmt(sql, []), bind: (...p) => stmt(sql, p) }) };
  const { keepRuleHeld } = await import('../src/ruleWatcher.js');
  const env = envWith({ ENABLE_PASSPORT_CHECK: 'true', ENABLE_LEAVE_BY_PLAN: 'true', ENABLE_RULE_WATCHER: 'true', DB });
  await keepRuleHeld(env, 'passport-ID', 'private note');
  await keepRuleHeld(env, 'usps-hold-mail');
  const p = await (await worker.fetch(req('/api/passport-check/status'), env, ctx)).json();
  assert.deepEqual(p.overrides, { 'passport-ID': { status: 'held', asOf: null } });
  assert.doesNotMatch(JSON.stringify(p), /private note/);
  const plan = await (await worker.fetch(req('/api/leave-by-plan/status'), env, ctx)).json();
  assert.equal(plan.passportCheck, true);
  const off = await (await worker.fetch(req('/api/leave-by-plan/status'), { ...env, ENABLE_PASSPORT_CHECK: 'false' }, ctx)).json();
  assert.equal(off.passportCheck, false);
});

test('the weekly watcher and the admin page cover every passport rule and the processing page', async () => {
  const urls = collectWatchUrls();
  for (const r of PASSPORT_RULES) assert.ok(urls.has(r.sourceUrl) && urls.get(r.sourceUrl).has(r.id), r.id);
  assert.ok(urls.get(PASSPORT_PROCESSING.sourceUrl).has('passport-processing-time'));
  assert.ok(ALL_WATCHED_RULES.length >= 34 + 1 + 15);
  const env = { DB: null, ENABLE_RULE_WATCHER: 'true', ADMIN_SECRET: 's3cret' };
  const res = await worker.fetch(req('/admin/rules/action', { method: 'POST', headers: { Authorization: 'Bearer s3cret' }, body: JSON.stringify({ ruleId: 'passport-ID', action: 'confirm' }) }), env, ctx);
  assert.notEqual(res.status, 400, 'a passport rule id is a known rule (503 here only because there is no database)');
});

test('privacy: no storage written, no request carries an expiry or a date (the plan page sends only its fixed counts), no form', () => {
  for (const f of ['passport.html', 'plan.html', 'passport-ui.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /localStorage\.setItem|sessionStorage|document\.cookie|history\.(push|replace)State|location\.(search|hash|href)\s*=/, f);
    assert.doesNotMatch(src, /<form\b/i, f);
  }
  assert.deepEqual([...read('passport-ui.js').matchAll(/localStorage\.(\w+)\(([^)]*)\)/g)].map((m) => m[1] + m[2]), ["getItem'sparkfare_selected_origin'"]);
  assert.deepEqual([...read('passport.html').matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1]), []);
  assert.deepEqual([...read('passport-ui.js').matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1]), ['/api/passport-check/status']);
  assert.deepEqual([...read('plan.html').matchAll(/fetch\(\s*'([^']+)'/g)].map((m) => m[1]), ['/api/events', '/api/leave-by-plan/status', '/api/plan-reminders/optin']);
  assert.equal(read('leave-by-rules.js'), read('src/data/leaveByRules.js'));
});

test('no passport text uses a word on the Away Mode banned list', () => {
  const strip = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(strip(read('passport.html')), BANNED);
  const ui = read('passport-ui.js');
  for (const m of ui.matchAll(/'([^'\n]{12,})'/g)) assert.doesNotMatch(m[1], BANNED, m[1]);
  for (const r of PASSPORT_RULES) assert.doesNotMatch(passportRequirementText(r) || '', BANNED, r.id);
  for (const h of ['Fine for this trip.', 'Renew before you go.', 'Check the official page.']) assert.doesNotMatch(h, BANNED);
});

// ---- drawing a result (a minimal stand-in for the DOM) ----

class Node_ {
  constructor(tag) { this.tag = tag; this.children = []; this.className = ''; this._text = ''; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  appendChild(c) { this.children.push(c); return c; }
  replaceChildren() { this.children = []; this._text = ''; }
  find(pred, out = []) { if (pred(this)) out.push(this); this.children.forEach((c) => c.find && c.find(pred, out)); return out; }
}

test('drawing a result shows the headline, the page\'s own words, the dates, the sources and the US-passport line', () => {
  globalThis.document = { createElement: (t) => new Node_(t), createTextNode: (t) => { const n = new Node_('#text'); n._text = t; return n; } };
  const box = new Node_('div');
  renderPassportResult(box, chk('Bali, Indonesia', 4, 2027));
  const text = box.textContent;
  assert.match(text, /Renew before you go\./);
  assert.match(text, /Must have 6 months validity beyond your arrival date\./);
  assert.match(text, /Suggested by 2026-11-08/);
  assert.match(text, /Routine service takes 4-6 weeks plus mailing\. Expedited takes 2-3 weeks\./);
  assert.match(text, /Page last updated July 09, 2026\. Checked on 2026-10-16\./);
  assert.match(text, /Page last updated October 05, 2026\./);
  assert.match(text, /Based on a US passport\. Check the State Department page for Indonesia before you travel\./);
  const links = box.find((n) => n.href).map((n) => n.href);
  assert.ok(links.every((h) => /^https:\/\/travel\.state\.gov/.test(h)), links.join());
  assert.ok(box.find((n) => n.tag === 'a').every((n) => n.rel === 'noopener noreferrer'));

  const held = new Node_('div');
  renderPassportResult(held, chk('Luxor, Egypt', 1, 2030));
  assert.match(held.textContent, /Check the official page\./);
  assert.doesNotMatch(held.textContent, /Fine for this trip|Renew before you go/);

  const tlv = new Node_('div');
  renderPassportResult(tlv, chk('Bali, Indonesia', 7, 2027, { origin: 'TLV' }));
  assert.doesNotMatch(tlv.textContent, /Fine for this trip|Renew before you go/);
  assert.match(tlv.textContent, /State Department travel information/);

  const bad = new Node_('div');
  renderPassportResult(bad, chk('Bali, Indonesia', 13, 2027));
  assert.match(bad.textContent, /Choose the month and year your passport expires\./);
  delete globalThis.document;
});

test('the plan page shows the verdict card instead of repeating the generic passport item, and only when the check is on', () => {
  const page = read('plan.html');
  assert.match(page, /i\.id !== 'etias' && !\(plan\.passport && i\.id === 'passport-check'\)/);
  assert.match(page, /<div id="passport-fields" hidden>/);
  assert.match(page, /passportCheckEnabled: passportCheckOn/);
  assert.match(page, /if \(j && j\.passportCheck\)/);
});
