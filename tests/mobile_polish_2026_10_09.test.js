// Mobile polish from the Oct 9 phone-QA pass (375px). Static CSS checks: these rules are what the fixes are.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const away = fs.readFileSync(new URL('../away-mode.html', import.meta.url), 'utf8');

// Body of the first rule whose selector is exactly `selector` (no comma list, no pseudo-class), found without regex escapes.
function rule(css, selector) {
  let from = 0;
  for (;;) {
    const at = css.indexOf(`${selector} {`, from);
    if (at === -1) return '';
    const before = css[at - 1];
    if (at === 0 || before === '\n' || before === ' ' || before === '}') {
      return css.slice(at + selector.length + 2, css.indexOf('}', at));
    }
    from = at + 1;
  }
}

test('Away Mode "View" buttons are 44px tall, not just 44px of invisible hit area', () => {
  const body = rule(away, '.partner-link');
  assert.match(body, /min-height:\s*44px/);
  assert.match(body, /display:\s*inline-flex/);
});

test('#signup-form keeps a margin above it when a Get Deal Alerts link scrolls to it', () => {
  assert.match(rule(index, '#signup-form'), /scroll-margin-top:\s*(1[6-9]|[2-9]\d)px/);
});

test('lazy card photos paint a placeholder tone while loading', () => {
  assert.match(rule(index, '.card-photo'), /background:\s*var\(--card-hover\)/);
});
