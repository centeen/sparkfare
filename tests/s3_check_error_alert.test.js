// S3 (D-067 follow-up, owner approved 2026-11-01): /check shows its alert card after every result except the two where the route is not one
// Sparkfare tracks ("We don't track X yet", "We don't cover X yet"). It runs the page's real render() against stub elements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../check.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start > 0, `function ${name} not found in check.html`);
  let depth = 0;
  let i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }
  return html.slice(start, i + 1);
}

function runRender(result, req = { origin: 'JFK', dest: 'Bali, Indonesia' }) {
  const els = {};
  const el = (id) => (els[id] ||= { id, hidden: undefined, textContent: '', replaceChildren() {}, appendChild() {}, classList: { add() {}, remove() {} }, setAttribute() {}, style: {}, href: '' });
  const ctx = {
    $: el,
    setText: (e, t) => { e.textContent = t; },
    money: (n) => '$' + n,
    document: { createElement: () => el('x' + Math.random()) },
    verdictChipHTML: () => '',
    igniteSparkOnce: () => {},
    renderVerdict: () => {},
    renderStats: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(`${extractFunction('render')}\nrender(${JSON.stringify(result)}, ${JSON.stringify(req)});`, ctx);
  return els['alert-card'].hidden;
}

test('S3: the alert card is hidden when the destination is not tracked', () => {
  assert.equal(runRender({ status: 'unsupported_destination' }), true);
});

test('S3: the alert card is hidden when the home airport is not covered', () => {
  assert.equal(runRender({ status: 'unsupported_origin' }), true);
});

test('S3: the alert card is still shown for a tracked route with no price or too little history yet', () => {
  assert.equal(runRender({ status: 'no_data' }), false);
  assert.equal(runRender({ status: 'not_enough_history', n: 3, span_days: 4, min_points: 10, min_span_days: 14 }), false);
});

test('S3: the card text itself is unchanged', () => {
  assert.ok(html.includes('Want a heads-up when fares from your home airport drop?'));
  assert.ok(html.includes('Get deal alerts'));
});
