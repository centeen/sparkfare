// The "as of" label on a cached fare used to read "Prices as of <time>", but the time is when Sparkfare retrieved
// the data (`found_at` is set from the feed's `fetched_at`, and /v1/prices/cheap returns no per-ticket
// observation time). The fare itself can be older. The wording now says what the time is. This guards against the
// old phrasing coming back on the surfaces that carry a fetch time. (Decision log, 2026-10-10.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const SURFACES = [
  ['index.html', 'homepage hero and cards'],
  ['src/emailTemplates/dailyDigest.js', 'digest email template'],
  ['src/pinterest.js', 'Pinterest pin description'],
  ['src/digestArchive.js', 'digest archive note'],
];

for (const [file, label] of SURFACES) {
  test(`${label} does not label a fetch time "as of"`, () => {
    const src = read(file);
    assert.doesNotMatch(src, /Prices? as of|["'`]As of \$\{/, `${file} still labels a fetch time "as of"`);
    assert.doesNotMatch(src, /shown as of when we saw it/);
  });
}

test('share card and PTO watch email say the data was retrieved', () => {
  const index = read('src/index.js');
  assert.match(index, /Fare data retrieved \$\{generatedAt\}/);
  assert.doesNotMatch(index, /As of \$\{generatedAt\}/);
  const email = read('src/email.js');
  assert.match(email, /search data retrieved \$\{seenDate\}/);
  assert.doesNotMatch(email, /search data as of \$\{seenDate\}/);
});

test('the homepage hero says the fare itself may be older; the digest says so too', () => {
  assert.match(read('index.html'), /Fare data retrieved \$\{new Date\(topPick\.found_at[^}]+\}[^<]*The fare itself may be older\./);
  const digest = read('src/emailTemplates/dailyDigest.js');
  assert.ok((digest.match(/The fare itself may be older/g) || []).length >= 2, 'html and text hero lines');
});
