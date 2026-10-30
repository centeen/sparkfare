// N12 (Addendum N, ROADMAP step 159): the tracking plan. Every event name the code writes is in src/events/registry.js; logEvent writes only registered names;
// the visitor class and schema version are columns; the bot filter gives the same counts from the column as it did from meta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSqliteD1 } from './helpers/sqliteD1.js';
import { logEvent } from '../src/index.js';
import { EVENT_REGISTRY, isRegistered, missingRequired, uaClassOf } from '../src/events/registry.js';
import { CLIENT_PLAN_EVENTS } from '../src/planEvents.js';
import { runMetric, NOT_BOT } from '../src/metrics/definitions.js';

const MIGRATIONS = fs.readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
const SRC = files(fileURLToPath(new URL('../src/', import.meta.url))).map((f) => [f, fs.readFileSync(f, 'utf8')]);

test('every event name the code writes or reads by name is in the registry', () => {
  const found = new Map();
  const add = (name, file) => { if (!found.has(name)) found.set(name, file); };
  for (const [file, s] of SRC) {
    for (const m of s.matchAll(/event_type\s*[:=]\s*'([a-z_0-9]+)'/g)) add(m[1], file);
    for (const m of s.matchAll(/event_type IN \(([^)]*)\)/g)) for (const n of m[1].matchAll(/'([a-z_0-9]+)'/g)) add(n[1], file);
    for (const m of s.matchAll(/INSERT INTO events[^`;]*?VALUES \([^)]*?'([a-z_0-9]+)'/g)) add(m[1], file);
    for (const m of s.matchAll(/INSERT INTO events \(id, event_type[^)]*\)\s*VALUES\s*\(\?,\s*'([a-z_0-9]+)'/g)) add(m[1], file);
    for (const m of s.matchAll(/\(\?, '([a-z_0-9]+)', \?, \?\)/g)) if (/INSERT INTO events/.test(s.slice(Math.max(0, m.index - 140), m.index))) add(m[1], file);
    const allowed = s.match(/allowedEvents = new Set\(\[([^\]]*)\]\)/);
    if (allowed) for (const n of allowed[1].matchAll(/'([a-z_0-9]+)'/g)) add(n[1], file);
  }
  for (const name of CLIENT_PLAN_EVENTS) add(name, 'src/planEvents.js');
  const missing = [...found].filter(([name]) => !isRegistered(name)).map(([name, file]) => `${name} (${path.basename(file)})`);
  assert.deepEqual(missing, [], `add these to src/events/registry.js: ${missing.join(', ')}`);
  assert.ok(found.size >= 45, `the scan found only ${found.size} names; it has stopped working`);
});

test('every registry entry has a version and a note, and required fields are columns or meta keys', () => {
  const columns = new Set(['user_id', 'anon_id', 'origin', 'route', 'partner', 'sub_id', 'source']);
  for (const [name, e] of Object.entries(EVENT_REGISTRY)) {
    assert.ok(Number.isInteger(e.v) && e.v >= 1, name);
    assert.ok(e.note && e.note.length > 5, name);
    for (const f of e.required) assert.ok(columns.has(f) || f.startsWith('meta.'), `${name}: ${f}`);
  }
});

test('an unregistered name is recorded once as unregistered_event with the name, and the event itself is not written', async () => {
  const db = makeSqliteD1(MIGRATIONS); const env = { DB: db };
  const error = console.error; console.error = () => {};
  try {
    await logEvent(env, { event_type: 'made_up_event_for_test', meta: { x: 1 } });
    await logEvent(env, { event_type: 'made_up_event_for_test', meta: { x: 2 } });
  } finally { console.error = error; }
  const rows = db.raw.prepare('SELECT event_type, meta FROM events').all().map((r) => ({ ...r }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_type, 'unregistered_event');
  assert.equal(JSON.parse(rows[0].meta).name, 'made_up_event_for_test');
});

test('a registered event is written with its schema version and visitor class as columns', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  await logEvent({ DB: db }, { event_type: 'outbound_click', partner: 'bounce', meta: { ua_class: 'bot' } });
  await logEvent({ DB: db }, { event_type: 'signup', meta: { utm: 'x' } });
  const rows = db.raw.prepare('SELECT event_type, ua_class, schema_version FROM events ORDER BY event_type').all().map((r) => ({ ...r }));
  assert.deepEqual(rows, [{ event_type: 'outbound_click', ua_class: 'bot', schema_version: 1 }, { event_type: 'signup', ua_class: null, schema_version: 1 }]);
  assert.equal(uaClassOf({ meta: { ua_class: 'nonsense' } }), null);
});

test('a missing required field still writes the event and lists what was absent', async () => {
  const db = makeSqliteD1(MIGRATIONS);
  await logEvent({ DB: db }, { event_type: 'email_open', meta: {} });
  assert.deepEqual(missingRequired({ event_type: 'outbound_click', meta: {} }), ['partner']);
  assert.deepEqual(JSON.parse(db.raw.prepare('SELECT meta FROM events').get().meta)._missing, ['meta.email_id']);
});

test('the bot filter counts the same from the column, from meta alone, and from a mix', async () => {
  const mk = (rows) => {
    const db = makeSqliteD1(MIGRATIONS);
    for (const [i, r] of rows.entries()) db.raw.prepare('INSERT INTO events (id, event_type, partner, source, meta, ua_class) VALUES (?, ?, ?, ?, ?, ?)').run(`e${i}`, 'outbound_click', r.partner, 'digest', r.meta, r.col ?? null);
    return db;
  };
  const w = { from: new Date(Date.now() - 86400000), to: new Date(Date.now() + 3600000) };
  const metaOnly = mk([{ partner: 'a', meta: '{"ua_class":"human"}' }, { partner: 'a', meta: '{"ua_class":"bot"}' }, { partner: 'b', meta: null }, { partner: 'b', meta: '{"x":1}' }]);
  const colOnly = mk([{ partner: 'a', meta: null, col: 'human' }, { partner: 'a', meta: null, col: 'bot' }, { partner: 'b', meta: null }, { partner: 'b', meta: null }]);
  const mixed = mk([{ partner: 'a', meta: '{"ua_class":"human"}', col: 'human' }, { partner: 'a', meta: '{"ua_class":"bot"}', col: 'bot' }, { partner: 'b', meta: null }, { partner: 'b', meta: '{"x":1}' }]);
  const out = [];
  for (const db of [metaOnly, colOnly, mixed]) out.push(JSON.stringify((await runMetric({ DB: db }, 'partner_clicks_top', w)).map((r) => ({ ...r })).sort((x, y) => String(x.label).localeCompare(String(y.label)))));
  assert.equal(out[0], out[1]); assert.equal(out[1], out[2]);
  assert.deepEqual(JSON.parse(out[0]).map((r) => [r.label, r.n]).sort(), [['a', 1], ['b', 2]], 'a: one human click, the bot click left out; b: both unclassified clicks count');
  assert.ok(NOT_BOT.includes('ua_class'));
});

test('migration 0044 fills ua_class from meta on existing rows and gives them version 1', () => {
  const upTo = MIGRATIONS.filter((f) => !f.includes('0044_'));
  const db = makeSqliteD1(upTo).raw;
  db.exec(`INSERT INTO events (id, event_type, meta) VALUES ('a', 'outbound_click', '{"ua_class":"bot"}'), ('b', 'outbound_click', '{"ua_class":"human"}'), ('c', 'outbound_click', NULL), ('d', 'outbound_click', '{"ua_class":"weird"}')`);
  db.exec(fs.readFileSync(new URL('../migrations/0044_events_typed_columns.sql', import.meta.url), 'utf8'));
  const rows = db.prepare('SELECT id, ua_class, schema_version FROM events ORDER BY id').all().map((r) => ({ ...r }));
  assert.deepEqual(rows, [{ id: 'a', ua_class: 'bot', schema_version: 1 }, { id: 'b', ua_class: 'human', schema_version: 1 }, { id: 'c', ua_class: null, schema_version: 1 }, { id: 'd', ua_class: null, schema_version: 1 }]);
});
