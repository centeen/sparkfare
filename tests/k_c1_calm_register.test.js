// K-C1: /leave and /away-mode put guidance first and the partners in their own "Who can help" section.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const leave = read('leave.html');
const away = read('away-mode.html');

test('/leave: the Who can help section comes after the guidance lists', () => {
  const open = leave.indexOf('id="open-list"');
  const done = leave.indexOf('id="done-list"');
  const help = leave.indexOf('id="help-block"');
  assert.ok(open > 0 && done > open && help > done, 'help block must follow open and done lists');
  assert.match(leave, /<h2[^>]*>Who can help<\/h2>/);
});

test('/leave: sponsored links are taken out of the guidance items', () => {
  assert.match(leave, /filter\(\(l\) => !\(helpers && l\.sponsored\)\)/);
  assert.match(leave, /helpers\.push\(\{ item, link: l \}\)/);
});

test('/leave: the disclosure sits inside the Who can help section, before its links', () => {
  const block = leave.slice(leave.indexOf('id="help-block"'));
  assert.ok(block.indexOf('Sparkfare may earn a commission') < block.indexOf('id="help-list"'));
});

test('/leave: the done count is a count, never a percentage, and only for trips of a week or more', () => {
  assert.match(leave, /' of ' \+ total \+ ' done'/);
  assert.match(leave, /answers\.length === 'one_two_weeks' \|\| answers\.length === 'month_plus'/);
  assert.doesNotMatch(leave, /% done|\* ?100/);
});

test('/leave: nothing is stored in the browser (the privacy page promises it)', () => {
  assert.doesNotMatch(leave, /localStorage|sessionStorage|document\.cookie/);
});

test('/away-mode: the guidance block comes before the Who can help heading and the partner list', () => {
  const g = away.indexOf('id="guidance-block"');
  const h = away.indexOf('id="help-title"');
  const p = away.indexOf('<div class="partner-list"');
  assert.ok(g > 0 && h > g && p > h, 'guidance, then heading, then partners');
});

test('/away-mode: saved guidance never shows a sponsored link and reads no browser storage', () => {
  const fn = away.slice(away.indexOf('async function showSavedGuidance'), away.indexOf('async function showSavedGuidance') + 3000);
  assert.match(fn, /!l\.sponsored/);
  assert.doesNotMatch(fn, /localStorage|sessionStorage/);
  assert.match(away, /showSavedGuidance\(data\.leave_answers, token\)/);
});

test('/away-mode: the guidance block has an empty state that does not name a partner', () => {
  const block = away.slice(away.indexOf('id="guidance-block"'), away.indexOf('id="help-title"'));
  assert.match(block, /id="guidance-empty"/);
  assert.doesNotMatch(block, /\/out\/|sponsored/);
});
