// Addendum J3 C6: on phones the signup sits after the third fare card; elsewhere it stays above the airport bar.
// Runs the page's real releaseSignup()/placeSignup() against a tiny fake DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const start = html.indexOf('const PHONE_MQ');
const end = html.indexOf('function renderWithSort');
assert.ok(start > 0 && end > start, 'the C6 helpers are in index.html');
const code = html.slice(start, end);

class Node_ {
  constructor(name, cls = []) { this.name = name; this.parent = null; this.kids = []; this.classList = new Set(cls); this.classList.add = (c) => Set.prototype.add.call(this.classList, c); this.classList.remove = (c) => Set.prototype.delete.call(this.classList, c); this.classList.contains = (c) => Set.prototype.has.call(this.classList, c); }
  get parentNode() { return this.parent; }
  get nextElementSibling() { const i = this.parent.kids.indexOf(this); return this.parent.kids[i + 1] || null; }
  append(c) { c.detach(); c.parent = this; this.kids.push(c); return c; }
  detach() { if (this.parent) this.parent.kids.splice(this.parent.kids.indexOf(this), 1); this.parent = null; }
  insertBefore(n, ref) { n.detach(); n.parent = this; this.kids.splice(this.kids.indexOf(ref), 0, n); }
  after(n) { n.detach(); n.parent = this.parent; this.parent.kids.splice(this.parent.kids.indexOf(this) + 1, 0, n); }
}

function world({ phone, cards }) {
  const main = new Node_('main');
  const panel = main.append(new Node_('signup', ['signup-panel']));
  const bar = main.append(new Node_('bar', ['origin-bar']));
  const heroSec = main.append(new Node_('hero-section'));
  const boardSec = main.append(new Node_('board-sections'));
  const hero = cards > 0 ? heroSec.append(new Node_('hero', ['hero', 'ticket'])) : null;
  const grid = boardSec.append(new Node_('grid'));
  const list = [];
  for (let i = 1; i < cards; i++) list.push(grid.append(new Node_('card' + (i + 1), ['card'])));
  const document = {
    querySelector(sel) {
      if (sel === '.signup-panel') return panel;
      if (sel === '.origin-bar') return bar;
      if (sel === '#hero-section .hero.ticket') return hero;
      return null;
    },
    querySelectorAll(sel) { assert.equal(sel, '#board-sections .card'); return list; },
  };
  const window = { matchMedia: () => ({ matches: phone, addEventListener() {} }) };
  const ctx = vm.createContext({ document, window });
  vm.runInContext(code.replace('const PHONE_MQ = window.matchMedia', 'var PHONE_MQ = window.matchMedia'), ctx);
  return { ctx, main, panel, bar, hero, list, run: (fn) => vm.runInContext(fn + '()', ctx) };
}

test('phone, 12 cards: the signup follows the third card (the hero counts as the first) and spans the grid row', () => {
  const w = world({ phone: true, cards: 12 });
  w.run('placeSignup');
  assert.equal(w.panel.parent, w.list[0].parent, 'it sits in the grid, after the 3rd card');
  assert.equal(w.panel.parent.kids.indexOf(w.panel), 2);
  assert.ok(w.panel.classList.contains('signup-in-grid'));
});

test('phone, running it again does not move or duplicate the form', () => {
  const w = world({ phone: true, cards: 12 });
  w.run('placeSignup'); w.run('placeSignup');
  assert.equal(w.panel.parent.kids.filter((k) => k === w.panel).length, 1);
  assert.equal(w.panel.parent.kids.indexOf(w.panel), 2);
});

test('phone, only the hero: the signup goes right after the hero, not in a grid', () => {
  const w = world({ phone: true, cards: 1 });
  w.run('placeSignup');
  assert.equal(w.hero.nextElementSibling, w.panel);
  assert.ok(!w.panel.classList.contains('signup-in-grid'));
});

test('phone, no cards: the signup stays above the airport bar', () => {
  const w = world({ phone: true, cards: 0 });
  w.run('placeSignup');
  assert.equal(w.panel.nextElementSibling, w.bar);
});

test('wider than a phone: the signup stays above the airport bar, and releaseSignup puts it back', () => {
  const w = world({ phone: false, cards: 12 });
  w.run('placeSignup');
  assert.equal(w.panel.nextElementSibling, w.bar);
  const p = world({ phone: true, cards: 12 });
  p.run('placeSignup');
  p.run('releaseSignup');
  assert.equal(p.panel.nextElementSibling, p.bar);
  assert.ok(!p.panel.classList.contains('signup-in-grid'));
});

test('the board can never delete the form: it is released before every rewrite and placed after the render', () => {
  assert.match(html, /function renderWithSort\(sortKey\) \{\n  if \(!currentRenderData\) return;\n  releaseSignup\(\);/);
  assert.match(html, /function showOriginNotLiveYet\(origin\) \{\n  releaseSignup\(\);/);
  assert.match(html, /\} catch \(err\) \{\n    releaseSignup\(\);\n    document\.getElementById\('board-sections'\)/);
  assert.match(html, /link\.addEventListener\('click', trackBookingClick\);\n  \}\);\n\n  placeSignup\(\);\n\}/);
  assert.match(html, /max-width: 767px/);
});
