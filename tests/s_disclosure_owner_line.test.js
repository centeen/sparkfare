import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../disclosure.html', import.meta.url), 'utf8');
const LINE = 'Sparkfare is built and run by Coby Enteen.';

test('disclosure: the approved owner sentence appears once, first in the first paragraph, before the affiliate-programs sentence', () => {
  assert.equal(html.split(LINE).length - 1, 1);
  assert.ok(html.includes(`<p>${LINE} Sparkfare participates in affiliate programs.`));
});
