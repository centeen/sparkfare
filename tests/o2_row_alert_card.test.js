// Addendum O, O2 (D-046, G107): the end-of-row alert card. The script (/row-alert-card.js) runs here against a small fake DOM so every
// rule of "where and when it renders" is checked; the layout itself was verified in a real browser (see the PR). Server side: the flag route,
// the new source tag and a real signup that stores it, on a real in-memory SQLite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import worker from '../src/index.js';
import { computeSignupSource, SIGNUP_SOURCES } from '../src/growth.js';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const SCRIPT = read('row-alert-card.js');

// ---------- a very small DOM: only what the script uses -----------------------------------------------------------------------

class Node_ {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.style = {}; this.className = ''; this.id = ''; this.text = ''; this.parentNode = null; this.listeners = {}; this.value = ''; }
  get classList() { const self = this; return { contains: (c) => self.className.split(/\s+/).includes(c) }; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.text = String(v); this.children = []; }
  setAttribute(k, v) { this.attrs[k] = v; if (k === 'id') this.id = v; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  walk(fn) { fn(this); this.children.forEach((c) => c.walk(fn)); }
}
class Text_ extends Node_ { constructor(t) { super('#text'); this.text = t; } }

function makeDom({ sections = [], origin = 'MIA', optionText = 'MIA — Miami', cols = 4 }) {
  const root = new Node_('html');
  const board = new Node_('div'); board.id = 'board-sections'; root.appendChild(board);
  const grids = [];
  for (const [title, count] of sections) {
    const h = new Node_('p'); h.className = 'section-heading'; h.text = title; board.appendChild(h);
    const sub = new Node_('p'); sub.className = 'section-sub'; sub.text = 'sub'; board.appendChild(sub);
    const g = new Node_('div'); g.className = 'grid';
    for (let i = 0; i < count; i++) g.appendChild(new Node_('div'));
    board.appendChild(g); grids.push(g);
  }
  const select = new Node_('select'); select.id = 'origin-select'; select.value = origin;
  select.options = [{ value: origin, text: optionText }]; select.selectedIndex = 0; root.appendChild(select);
  const doc = {
    readyState: 'loading', addEventListener() {},
    getElementById: (id) => { let f = null; root.walk((n) => { if (n.id === id) f = n; }); return f; },
    querySelectorAll: (sel) => { const out = []; if (sel === '[data-row-alert-card]') root.walk((n) => { if ('data-row-alert-card' in n.attrs) out.push(n); }); return out; },
    createElement: (t) => new Node_(t), createTextNode: (t) => new Text_(t),
  };
  return { doc, root, board, grids, state: { cols } };
}

function load({ dom, flag = true, cache = undefined, fetchImpl = null }) {
  const calls = [];
  const store = {};
  if (cache !== undefined) store.sparkfare_row_card_status = JSON.stringify(cache);
  const win = {
    document: dom.doc,
    sessionStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    fetch: fetchImpl || (async (url) => { calls.push(url); return { ok: true, json: async () => ({ enabled: flag }) }; }),
    getComputedStyle: () => ({ gridTemplateColumns: Array.from({ length: dom.state.cols }, () => '240px').join(' ') }),
    addEventListener() {}, MutationObserver: undefined,
  };
  const sandbox = { window: win, document: dom.doc, setTimeout, clearTimeout, Date, JSON, Promise, String, Math, Array, Object };
  vm.runInNewContext(SCRIPT, sandbox);
  return { api: win.sparkfareRowAlertCard, win, calls, store };
}

const cardsIn = (dom) => dom.doc.querySelectorAll('[data-row-alert-card]');

// ---------- pure helpers --------------------------------------------------------------------------------------------------------

test('emptyTracks counts the empty slots in the last row, and none when the row is full or the grid is one column', () => {
  const { api } = load({ dom: makeDom({}) });
  assert.equal(api.emptyTracks(4, 2), 2);
  assert.equal(api.emptyTracks(4, 7), 1);
  assert.equal(api.emptyTracks(4, 4), 0);
  assert.equal(api.emptyTracks(4, 8), 0);
  assert.equal(api.emptyTracks(4, 1), 3);
  assert.equal(api.emptyTracks(1, 5), 0); // one column: nothing to fill
  assert.equal(api.emptyTracks(4, 0), 0); // no cards: a different empty state
  assert.equal(api.emptyTracks(0, 3), 0);
});

test('the city is the one the origin selector shows', () => {
  const { api } = load({ dom: makeDom({}) });
  assert.equal(api.cityOf('MIA — Miami', 'MIA'), 'Miami');
  assert.equal(api.cityOf('JFK — New York', 'JFK'), 'New York');
  assert.equal(api.cityOf('no dash here', 'ATL'), 'ATL');
  assert.equal(api.cityOf('', 'ATL'), 'ATL');
});

test('the copy is exactly what the Design Council approved (D-046)', () => {
  const { api } = load({ dom: makeDom({}) });
  const c = api.COPY;
  assert.equal(c.before + c.link + c.middle + 'Miami' + c.after, "That's every real deal from Miami today.");
  assert.equal(c.body, 'Get the next one by email.');
  assert.equal(c.note, 'One daily digest.'); // "Unsubscribe anytime." only once every triggered email has a visible unsubscribe link
  assert.equal(c.placeholder, 'name@email.com');
  assert.equal(c.button, 'Create alert');
  assert.equal(c.watch, 'Or watch one route (sign-in needed)');
  assert.equal(c.methodHref, '/how-it-works#deal-rule');
  assert.equal(c.watchHref, '/watchlists');
  assert.equal(c.source, 'home_row');
});

test('the card copy contains none of the banned words or pressure', () => {
  const { api } = load({ dom: makeDom({}) });
  const all = Object.values(api.COPY).join(' ');
  for (const re of [/\bonly\b/i, /\bbook/i, /\bsecured?\b/i, /hurry/i, /\bleft\b/i, /\bjust \d/i, /countdown/i, /\bsave\b/i, /\d+%/, /\$\d/, /instantly/i, /last chance/i]) assert.doesNotMatch(all, re, String(re));
});

// ---------- where and when it renders -------------------------------------------------------------------------------------------

test('a short row in "Today\'s deals" gets the card, spanning exactly the empty tracks', async () => {
  const dom = makeDom({ sections: [["Today's deals", 2], ['Worth a look', 5]], cols: 4 });
  const { api, win } = load({ dom });
  await api.sync(win);
  const cards = cardsIn(dom);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].parentNode, dom.grids[0]);
  assert.equal(cards[0].style.gridColumn, 'span 2');
  assert.equal(cards[0].tag, 'aside');
  assert.equal(cards[0].getAttribute('aria-labelledby'), 'row-alert-title');
  assert.equal(dom.grids[1].children.length, 5); // "Worth a look" has gaps too, and gets nothing
});

test('one empty track gives a one-track card; a full row, no cards, or one column gives none', async () => {
  for (const [count, cols, want] of [[7, 4, 'span 1'], [4, 4, null], [8, 4, null], [0, 4, null], [3, 1, null]]) {
    const dom = makeDom({ sections: [["Today's deals", count]], cols });
    const { api, win } = load({ dom });
    await api.sync(win);
    const cards = cardsIn(dom);
    assert.equal(cards.length, want ? 1 : 0, `${count} cards in ${cols} columns`);
    if (want) assert.equal(cards[0].style.gridColumn, want);
  }
});

test('with no "Today\'s deals" section (no deals today) there is no card, whatever the other sections look like', async () => {
  const dom = makeDom({ sections: [['On the board', 3], ['Building history', 1]], cols: 4 });
  const { api, win } = load({ dom });
  await api.sync(win);
  assert.equal(cardsIn(dom).length, 0);
});

test('the card text carries the selected city, the basis link, the form, the note and the watch link', async () => {
  const dom = makeDom({ sections: [["Today's deals", 2]], origin: 'JFK', optionText: 'JFK — New York' });
  const { api, win } = load({ dom });
  await api.sync(win);
  const card = cardsIn(dom)[0];
  assert.equal(card.children[0].textContent, "That's every real deal from New York today.");
  assert.equal(card.children[0].children.find((c) => c.tag === 'a').getAttribute('href'), '/how-it-works#deal-rule');
  const texts = []; const attrs = [];
  card.walk((n) => { if (n.text) texts.push(n.text); attrs.push(n); });
  assert.ok(texts.includes('Get the next one by email.'));
  assert.ok(texts.includes('One daily digest.'));
  assert.ok(texts.includes('Create alert'));
  assert.ok(texts.includes('Or watch one route (sign-in needed)'));
  const input = attrs.find((n) => n.tag === 'input');
  assert.equal(input.getAttribute('placeholder'), 'name@email.com');
  assert.equal(input.getAttribute('type'), 'email');
  assert.equal(input.getAttribute('aria-describedby'), 'row-alert-note');
  const label = attrs.find((n) => n.tag === 'label');
  assert.equal(label.getAttribute('for'), input.id); // a real label stays in the DOM for screen readers
  assert.equal(attrs.find((n) => n.tag === 'p' && n.id === 'row-alert-note').text, 'One daily digest.');
  assert.equal(attrs.find((n) => n.tag === 'a' && n.className === 'row-alert-watch').getAttribute('href'), '/watchlists');
  // no photo, price or deal marker of any kind
  for (const n of attrs) assert.ok(!['img', 'svg'].includes(n.tag));
  assert.doesNotMatch(card.textContent, /\$|%|Deal\b/);
});

test('syncing again does not duplicate the card, and it follows the width: gone at one column, back at four', async () => {
  const dom = makeDom({ sections: [["Today's deals", 2]], cols: 4 });
  const { api, win } = load({ dom });
  await api.sync(win); await api.sync(win); await api.sync(win);
  assert.equal(cardsIn(dom).length, 1);
  dom.state.cols = 1;
  await api.sync(win);
  assert.equal(cardsIn(dom).length, 0);
  dom.state.cols = 3;
  await api.sync(win);
  assert.equal(cardsIn(dom).length, 1);
  assert.equal(cardsIn(dom)[0].style.gridColumn, 'span 1');
});

// ---------- the flag ------------------------------------------------------------------------------------------------------------------

test('flag off (the default): no card, and the answer is remembered so a visit makes one request at most', async () => {
  const dom = makeDom({ sections: [["Today's deals", 2]] });
  const { api, win, calls, store } = load({ dom, flag: false });
  await api.sync(win); await api.sync(win);
  assert.equal(cardsIn(dom).length, 0);
  assert.deepEqual(calls, ['/api/row-alert-card']);
  assert.equal(JSON.parse(store.sparkfare_row_card_status).enabled, false);
});

test('a failed request, a bad answer or a non-true value all read as off', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('offline'); },
    async () => ({ ok: false, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ enabled: 'true' }) }),
    async () => ({ ok: true, json: async () => null }),
  ]) {
    const dom = makeDom({ sections: [["Today's deals", 2]] });
    const { api, win } = load({ dom, fetchImpl });
    await api.sync(win);
    assert.equal(cardsIn(dom).length, 0);
  }
});

test('a fresh cached "on" is used without a request; a stale cache is not', async () => {
  let dom = makeDom({ sections: [["Today's deals", 2]] });
  let l = load({ dom, cache: { t: Date.now(), enabled: true } });
  await l.api.sync(l.win);
  assert.equal(cardsIn(dom).length, 1);
  assert.equal(l.calls.length, 0);
  dom = makeDom({ sections: [["Today's deals", 2]] });
  l = load({ dom, flag: false, cache: { t: Date.now() - 11 * 60 * 1000, enabled: true } });
  await l.api.sync(l.win);
  assert.equal(cardsIn(dom).length, 0); // the stale "on" was re-asked, and the answer is off
  assert.equal(l.calls.length, 1);
});

// ---------- the form -----------------------------------------------------------------------------------------------------------------

test('submitting goes through the homepage signup function with the selected airport and the card\'s own source tag', async () => {
  const dom = makeDom({ sections: [["Today's deals", 2]], origin: 'MIA' });
  const { api, win } = load({ dom });
  const sent = [];
  win.sparkfareHomeSignup = (args) => sent.push(args);
  await api.sync(win);
  const card = cardsIn(dom)[0];
  let form; let input; let status;
  card.walk((n) => { if (n.tag === 'form') form = n; if (n.tag === 'input') input = n; if (n.className === 'status-message') status = n; });
  input.value = '  Name@Email.com ';
  let prevented = false;
  form.listeners.submit[0]({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(sent.length, 1);
  assert.deepEqual({ email: sent[0].email, origin: sent[0].origin, source: sent[0].source }, { email: 'Name@Email.com', origin: 'MIA', source: 'home_row' });
  assert.equal(sent[0].statusEl, status); // messages appear in the card, the same text as the hero form's
  assert.equal(sent[0].form, form);
});

test('the homepage has one signup function used by both forms, which differ only in their source tag', () => {
  const html = read('index.html');
  assert.match(html, /async function submitHomeSignup\(\{ email, origin, source, statusEl, form \}\)/);
  assert.match(html, /window\.sparkfareHomeSignup = submitHomeSignup;/);
  assert.match(html, /source: 'home',\n\s+statusEl: signupStatus,/);
  assert.equal((html.match(/fetch\('\/api\/signup'/g) || []).length, 1); // one endpoint call for both forms
  assert.match(html, /<script src="\/row-alert-card\.js" defer><\/script>/);
  // the same messages for both forms
  for (const m of ['Please complete the required fields before creating your alert.', 'Creating your alert…', 'Check your email to verify, and your first deal alert will follow.']) assert.ok(html.includes(m), m);
});

// ---------- server side -------------------------------------------------------------------------------------------------------------

const get = (env) => worker.fetch(new Request('https://sparkfare.com/api/row-alert-card'), env, { waitUntil() {} });

test('GET /api/row-alert-card answers false by default and only the exact string "true" turns it on', async () => {
  assert.deepEqual(await (await get({})).json(), { enabled: false });
  assert.deepEqual(await (await get({ ENABLE_ROW_ALERT_CARD: 'false' })).json(), { enabled: false });
  assert.deepEqual(await (await get({ ENABLE_ROW_ALERT_CARD: 'TRUE' })).json(), { enabled: false });
  assert.deepEqual(await (await get({ ENABLE_ROW_ALERT_CARD: 'true' })).json(), { enabled: true });
  assert.match(read('wrangler.jsonc'), /"ENABLE_ROW_ALERT_CARD": "true"/);
});

test('home_row is an allowed signup source and a signup from the card stores it; the hero form keeps "home"', async () => {
  assert.ok(SIGNUP_SOURCES.includes('home_row'));
  assert.equal(computeSignupSource({ source: 'home_row' }), 'home_row');
  assert.equal(computeSignupSource({ source: 'HOME_ROW' }), 'home_row');
  const migrations = fs.readdirSync(new URL('../migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
  const DB = makeSqliteD1(migrations);
  const post = (email, source) => worker.fetch(new Request('https://sparkfare.com/api/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: `local_${email}`, email, origin_iata: 'MIA', trip_length: '7-10', subscription_tier: 'free', source }),
  }), { DB }, { waitUntil: (p) => p });
  assert.equal((await post('card@example.test', 'home_row')).status, 200);
  assert.equal((await post('hero@example.test', 'home')).status, 200);
  const row = (e) => DB.raw.prepare('SELECT origin_iata, trip_length, signup_source, verified_email FROM users WHERE email = ?').get(e);
  assert.deepEqual({ ...row('card@example.test') }, { origin_iata: 'MIA', trip_length: '7-10', signup_source: 'home_row', verified_email: 0 });
  assert.equal(row('hero@example.test').signup_source, 'home');
  const ev = DB.raw.prepare("SELECT source FROM events WHERE event_type = 'signup' ORDER BY ts, id").all().map((r) => r.source);
  assert.ok(ev.includes('home_row') && ev.includes('home'));
});

test('the method page has the anchor the card links to, and the deal rule text beside it', () => {
  const html = read('how-it-works.html');
  assert.match(html, /<div class="card" id="deal-rule">\n\s+<h2>2\. Deal Floor &amp; Statistical Volatility<\/h2>/);
  assert.match(html, /at least 15% below its trailing 30-day median/);
  assert.match(html, /at least 10 distinct observation days/);
});

test('the card is styled as plain Ink on the card surface with the action in sage: no gold, photo or price styling', () => {
  const html = read('index.html');
  const css = html.slice(html.indexOf('.row-alert-card {'), html.indexOf('.status-message {', html.indexOf('.row-alert-card {')) > 0 ? html.indexOf('.row-alert-watch {') + 400 : html.length);
  assert.match(css, /\.row-alert-card \{[^}]*background: var\(--card\)[^}]*border-radius: var\(--radius\)[^}]*color: var\(--ink\)/);
  assert.doesNotMatch(css, /--spark|--gold|--amber|#E8B930/i);
  assert.match(css, /\.row-alert-card \.row-alert-form \.field input, \.row-alert-card \.row-alert-form \.field button \{ min-height: 44px; \}/);
});
