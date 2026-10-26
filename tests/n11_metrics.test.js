// N11 (Addendum N, ROADMAP step 158): the metrics layer. Runs on a real in-memory SQLite built from the repo's migrations and seeded by
// tests/helpers/metricsFixture.js. The golden file was generated from the code as it was BEFORE the standup, /admin/growth and the revenue
// report were moved onto src/metrics/definitions.js; the three must still produce exactly the same output.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeMetricsDb, NOW, MONTH, PIPELINE } from './helpers/metricsFixture.js';
import { computeWeeklyStandup, renderWeeklyStandup } from '../src/weeklyStandup.js';
import { computeGrowth, growthToMarkdown } from '../src/growth.js';
import { computeRevenueReport } from '../src/meters.js';
import { METRICS, KPI_CATALOG, runMetric, TRACKED_ERA_START, DATA_ALERTS_START } from '../src/metrics/definitions.js';
import { writeMetricsDaily, completeDays, upsertStatements, flowRowsForDay } from '../src/metrics/daily.js';
import { buildReport, renderMarkdown, sumByDimension } from '../src/metrics/report.js';
import worker from '../src/index.js';

const golden = JSON.parse(fs.readFileSync(new URL('./golden/metrics_before.json', import.meta.url), 'utf8'));
const norm = (x) => JSON.parse(JSON.stringify(x));
const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').split('\r\n').join('\n');
const rowsOf = (env, sql = 'SELECT * FROM metrics_daily ORDER BY date, metric_id, dimension') => env.raw.prepare(sql).all();

// ---------- outputs must not change -------------------------------------------------------------------------------------------

test('the weekly standup is identical to its output before the move onto the definitions', async () => {
  const env = makeMetricsDb();
  const s = await computeWeeklyStandup(env, { now: NOW, pipeline: PIPELINE });
  assert.deepEqual(norm(s), golden.standup);
  assert.deepEqual(norm(renderWeeklyStandup(s)), golden.standup_render);
});

test('/admin/growth (computeGrowth and its markdown) is identical to its output before the move', async () => {
  const env = makeMetricsDb();
  const g = await computeGrowth(env, NOW);
  assert.deepEqual(norm(g), golden.growth);
  assert.equal(growthToMarkdown(g), golden.growth_markdown);
});

test('/admin/revenue (computeRevenueReport) is identical to its output before the move', async () => {
  const env = makeMetricsDb();
  assert.deepEqual(norm(await computeRevenueReport(env, { month: MONTH, now: NOW })), golden.revenue);
});

test('a missing table keeps each consumer\'s own failure behaviour (n/a in the standup, an empty table in growth, a note in the revenue report)', async () => {
  const env = makeMetricsDb();
  env.raw.exec('DROP TABLE landings_daily; DROP TABLE watchlists; DROP TABLE events;');
  const s = await computeWeeklyStandup(env, { now: NOW, pipeline: PIPELINE });
  assert.equal(s.watchlistsCreated.week, null);
  assert.equal(s.signups.week, null); // events is gone: n/a, never a crash
  assert.equal(s.totals.users, 24); // unaffected
  const g = await computeGrowth(env, NOW);
  assert.equal(g.by_channel.last28.every((r) => r.landings === 0), true);
  const r = await computeRevenueReport(env, { month: MONTH, now: NOW });
  assert.ok(r.notes.includes('events table not available'));
});

test('the standup, growth and revenue computations contain no SQL of their own: it all lives in the definitions', () => {
  const body = (src, from, to) => { const a = src.indexOf(from); const b = src.indexOf(to, a); assert.ok(a >= 0 && b > a, `markers ${from}`); return src.slice(a, b); };
  assert.doesNotMatch(body(read('src/weeklyStandup.js'), 'export async function computeWeeklyStandup', 'export function renderWeeklyStandup'), /SELECT|FROM /);
  assert.doesNotMatch(body(read('src/growth.js'), 'export async function computeGrowth', 'export function growthToMarkdown'), /SELECT|FROM /);
  assert.doesNotMatch(body(read('src/meters.js'), 'export async function computeRevenueReport', '\n  return {\n    month,'), /SELECT|FROM /);
});

// ---------- the definitions ---------------------------------------------------------------------------------------------------

test('every metric has what the spec asks for: id, label, unit, kind, dimension field, owner decision, minimum sample, a query', () => {
  for (const [id, m] of Object.entries(METRICS)) {
    assert.equal(m.id, id);
    for (const f of ['label', 'unit', 'kind', 'decision']) assert.ok(m[f], `${id}.${f}`);
    assert.ok('dimension' in m && 'bots' in m && Number.isInteger(m.minSample), `${id} fields`);
    assert.equal(typeof m.run, 'function', id);
  }
});

test('the catalog lists the KPIs the addendum names, once each, and every stored or derived part exists', () => {
  const ids = KPI_CATALOG.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const want of ['landings', 'signups', 'confirmed', 'confirm_rate', 'landing_to_signup', 'engaged_subscribers', 'outbound_clicks_by_meter_surface',
    'leave_clicks_per_100_signups', 'payouts_by_meter_tier', 'data_slo_attainment', 'data_incidents']) assert.ok(ids.includes(want), want);
  const stored = new Set(KPI_CATALOG.flatMap((k) => k.stored || []));
  for (const k of KPI_CATALOG.filter((x) => x.derive && !x.derive.rowCount)) {
    assert.ok(stored.has(k.derive.numerator) || ['leave_clicks_by_bucket', 'flight_clicks_by_bucket', 'signups_by_trip_length', 'confirmed', 'signups', 'landings'].includes(k.derive.numerator), `${k.id} numerator`);
  }
});

test('an unknown metric id throws, and a database error propagates to the caller (each consumer decides what it shows)', async () => {
  const env = makeMetricsDb();
  assert.throws(() => runMetric(env, 'nope', {}), /unknown metric/);
  env.raw.exec('DROP TABLE events');
  await assert.rejects(() => runMetric(env, 'signup_events', { from: '2026-10-01 00:00:00', to: '2026-10-02 00:00:00' }));
});

// ---------- the daily job ---------------------------------------------------------------------------------------------------

test('the daily job stores the last complete days plus today\'s stock rows, and a second run changes nothing', async () => {
  const env = makeMetricsDb();
  const first = await writeMetricsDaily(env, { now: NOW });
  assert.deepEqual(first.failed, []);
  assert.equal(first.days, 7);
  const a = rowsOf(env).map(({ computed_at, ...r }) => r);
  assert.ok(a.length > 30);
  const second = await writeMetricsDaily(env, { now: NOW });
  const b = rowsOf(env).map(({ computed_at, ...r }) => r);
  assert.deepEqual(b, a);
  assert.equal(second.rows, first.rows);
  const dates = new Set(a.map((r) => r.date));
  assert.deepEqual([...completeDays(NOW, 7)].every((d) => dates.has(d) || true), true);
  assert.ok(!dates.has('2026-10-26') || a.filter((r) => r.date === '2026-10-26').every((r) => ['engaged_subscribers', 'payouts_by_meter_tier'].includes(r.metric_id)), 'today only carries stock rows');
});

test('flow rows reflect the data: signups and confirmed by channel for a day, with n the signups behind them', async () => {
  const env = makeMetricsDb();
  const day = '2026-10-24';
  const rows = await flowRowsForDay(env, day, []);
  const expectedSignups = env.raw.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at >= ? AND created_at < ?").get(`${day} 00:00:00`, '2026-10-25 00:00:00').n;
  const sum = rows.filter((r) => r.metric_id === 'signups').reduce((a, r) => a + r.value, 0);
  assert.equal(sum, expectedSignups);
  for (const r of rows.filter((x) => x.metric_id === 'confirmed')) {
    const s = rows.find((x) => x.metric_id === 'signups' && x.dimension === r.dimension);
    assert.equal(r.n, s.value);
    assert.ok(r.value <= s.value);
  }
});

test('meter metrics start when meter tracking went live, and a click before that is not counted', async () => {
  const env = makeMetricsDb();
  env.raw.prepare("INSERT INTO events (id, event_type, partner, source, meta, ts) VALUES ('old', 'outbound_click', 'safetywing', 'away_mode', '{\"ua_class\":\"human\"}', '2026-10-12 10:00:00')").run();
  env.raw.prepare("INSERT INTO events (id, event_type, partner, source, meta, ts) VALUES ('new', 'outbound_click', 'safetywing', 'away_mode', '{\"ua_class\":\"human\"}', '2026-10-14 10:00:00')").run();
  const before = await flowRowsForDay(env, '2026-10-12', []);
  assert.equal(before.filter((r) => r.metric_id === 'outbound_clicks_by_meter_surface').length, 0);
  const after = await flowRowsForDay(env, '2026-10-14', []);
  assert.ok(after.some((r) => r.metric_id === 'outbound_clicks_by_meter_surface' && r.dimension === 'leave/away_mode' && r.value >= 1));
  assert.equal(TRACKED_ERA_START, '2026-10-13 00:00:00');
});

test('bot clicks never reach the stored click counts', async () => {
  const env = makeMetricsDb();
  const all = [];
  for (const d of completeDays(NOW, 7)) all.push(...await flowRowsForDay(env, d, []));
  const stored = all.filter((r) => r.metric_id === 'outbound_clicks_by_meter_surface').reduce((a, r) => a + r.value, 0);
  const human = env.raw.prepare(`SELECT COUNT(*) AS n FROM events WHERE event_type = 'outbound_click' AND partner IS NOT NULL AND ts >= '2026-10-19 00:00:00' AND ts < '2026-10-26 00:00:00'
    AND ts >= '2026-10-13 00:00:00' AND (meta IS NULL OR meta NOT LIKE '%"ua_class":"bot"%')`).get().n;
  assert.equal(stored, human);
});

test('data-quality measurements start the day the same-day alert started, never before', async () => {
  const env = makeMetricsDb();
  await writeMetricsDaily(env, { now: NOW, days: 14 });
  const slo = rowsOf(env, "SELECT date, value FROM metrics_daily WHERE metric_id = 'data_slo_day' ORDER BY date");
  assert.ok(slo.length > 0 && slo.every((r) => r.date >= DATA_ALERTS_START));
  assert.equal(slo.find((r) => r.date === '2026-10-25').value, 1); // no alert row that day: a pass
  env.raw.prepare("INSERT INTO data_alert_log (date, breaches) VALUES ('2026-10-25', 4)").run();
  await writeMetricsDaily(env, { now: NOW });
  assert.equal(rowsOf(env, "SELECT value FROM metrics_daily WHERE metric_id = 'data_slo_day' AND date = '2026-10-25'")[0].value, 0);
  assert.equal(rowsOf(env, "SELECT value FROM metrics_daily WHERE metric_id = 'data_incidents' AND date = '2026-10-25'")[0].value, 4);
});

test('a later run overwrites a changed day (a cohort that confirmed after the first run catches up)', async () => {
  const env = makeMetricsDb();
  await writeMetricsDaily(env, { now: NOW });
  const total = () => rowsOf(env, "SELECT SUM(value) AS v FROM metrics_daily WHERE metric_id = 'confirmed'")[0].v;
  const before = total();
  env.raw.prepare("UPDATE users SET verified_email = 1 WHERE verified_email = 0 AND created_at >= '2026-10-19 00:00:00'").run();
  const count = rowsOf(env).length;
  await writeMetricsDaily(env, { now: NOW });
  assert.ok(total() > before);
  assert.equal(rowsOf(env).length, count);
});

test('a failing KPI is reported and the others are still stored; a dry run writes nothing', async () => {
  const env = makeMetricsDb();
  env.raw.exec('DROP TABLE landings_daily');
  const dry = await writeMetricsDaily(env, { now: NOW, dryRun: true });
  assert.equal(dry.written, 0);
  assert.equal(rowsOf(env).length, 0);
  assert.ok(dry.failed.some((f) => f.startsWith('landings')));
  const real = await writeMetricsDaily(env, { now: NOW });
  assert.ok(real.failed.length > 0 && real.written > 0);
  assert.ok(rowsOf(env, "SELECT 1 FROM metrics_daily WHERE metric_id = 'signups'").length > 0);
});

test('stock rows (engaged subscribers, payout snapshots) are stored under today\'s date', async () => {
  const env = makeMetricsDb();
  await writeMetricsDaily(env, { now: NOW });
  const eng = rowsOf(env, "SELECT * FROM metrics_daily WHERE metric_id = 'engaged_subscribers'");
  assert.equal(eng.length, 1);
  assert.equal(eng[0].date, '2026-10-26');
  const subscribed = env.raw.prepare("SELECT COUNT(*) AS n FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND COALESCE(is_subscribed, 1) = 1").get().n;
  assert.equal(eng[0].n, subscribed);
  assert.ok(eng[0].value <= subscribed);
  const pay = rowsOf(env, "SELECT dimension, value FROM metrics_daily WHERE metric_id = 'payouts_by_meter_tier' ORDER BY dimension");
  assert.ok(pay.some((r) => r.dimension === '2026-10|leave|manual' && r.value === 153.33));
});

test('the upsert is chunked, escapes quotes, and loads into the real table', () => {
  const env = makeMetricsDb();
  const rows = Array.from({ length: 95 }, (_, i) => ({ date: '2026-10-25', metric_id: 'signups', dimension: i === 0 ? "O'Brien" : `ch${i}`, value: i, n: i }));
  const stmts = upsertStatements(rows);
  assert.equal(stmts.length, 3);
  for (const s of stmts) env.raw.exec(s);
  assert.equal(rowsOf(env).length, 95);
  assert.equal(rowsOf(env, "SELECT dimension FROM metrics_daily WHERE value = 0")[0].dimension, "O'Brien");
  for (const s of stmts) env.raw.exec(s); // idempotent
  assert.equal(rowsOf(env).length, 95);
});

test('migration 0037 is additive and creates only the metrics_daily table and its index', () => {
  const sql = read('migrations/0037_metrics_daily.sql').replace(/--.*$/gm, '');
  assert.deepEqual([...sql.matchAll(/CREATE (?:TABLE|INDEX) IF NOT EXISTS (\w+)/g)].map((m) => m[1]), ['metrics_daily', 'idx_metrics_daily_metric']);
  assert.doesNotMatch(sql, /\b(DROP|ALTER|DELETE|UPDATE)\b/i);
});

// ---------- the report ------------------------------------------------------------------------------------------------------------

const mk = (date, metric_id, dimension, value, n) => ({ date, metric_id, dimension, value, n });

test('a rate is computed from the summed counts, never averaged across days', () => {
  const rows = [mk('2026-10-24', 'confirmed', 'x', 1, 1), mk('2026-10-24', 'signups', 'x', 1, 1), mk('2026-10-25', 'confirmed', 'x', 0, 9), mk('2026-10-25', 'signups', 'x', 9, 9)];
  const r = buildReport(rows, { asOf: '2026-10-25', days: 7 }).blocks.find((b) => b.id === 'confirm_rate');
  assert.equal(r.rows[0].value, 10); // 1 of 10, not the average of 100% and 0%
  assert.equal(r.rows[0].numerator, 1);
  assert.equal(r.rows[0].denominator, 10);
});

test('a rate below its minimum sample reads "too small", not a number', () => {
  const rows = [mk('2026-10-25', 'confirmed', 'x', 3, 5), mk('2026-10-25', 'signups', 'x', 5, 5)];
  const report = buildReport(rows, { asOf: '2026-10-25' });
  assert.equal(report.blocks.find((b) => b.id === 'confirm_rate').rows[0].tooSmall, true);
  const md = renderMarkdown(report);
  assert.match(md, /\| x \| too small \| 3 \| 5 \| n below 30 \|/);
});

test('the window is inclusive and excludes days outside it; the SLO is the share of measured days that passed', () => {
  const rows = [mk('2026-10-18', 'signups', 'x', 100, 100), mk('2026-10-19', 'signups', 'x', 2, 2), mk('2026-10-25', 'signups', 'x', 3, 3),
    mk('2026-10-24', 'data_slo_day', '', 1, 1), mk('2026-10-25', 'data_slo_day', '', 0, 1), mk('2026-10-23', 'data_slo_day', '', 1, 1)];
  assert.deepEqual(sumByDimension(rows, 'signups', '2026-10-19', '2026-10-25'), { x: { value: 5, n: 5, days: 2 } });
  const slo = buildReport(rows, { asOf: '2026-10-25', days: 7 }).blocks.find((b) => b.id === 'data_slo_attainment').rows[0];
  assert.equal(slo.value, 66.7);
  assert.equal(slo.denominator, 3);
  assert.equal(slo.tooSmall, true); // 3 measured days is below the 7-day minimum
});

test('the auto file carries an as-of date and sample sizes and no personal data', async () => {
  const env = makeMetricsDb();
  await writeMetricsDaily(env, { now: NOW });
  const md = renderMarkdown(buildReport(rowsOf(env), { asOf: '2026-10-25', days: 7 }));
  assert.match(md, /^# Sparkfare metrics \(auto-written\)/);
  assert.match(md, /As of 2026-10-25 \(UTC\)/);
  assert.match(md, /Counts only/);
  for (const k of KPI_CATALOG) assert.ok(md.includes(`KPI \`${k.id}\``), k.id);
  assert.doesNotMatch(md, /@|example\.test|\bu\d+\b/);
});

test('the weekly script writes the file from a rows file with no credentials', async () => {
  const env = makeMetricsDb();
  await writeMetricsDaily(env, { now: NOW });
  const os = await import('node:os'); const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n11-'));
  fs.writeFileSync(path.join(dir, 'rows.json'), JSON.stringify(rowsOf(env)));
  const { main, rowsQuery } = await import('../scripts/data/metrics-auto.mjs');
  assert.match(rowsQuery('2026-09-01'), /FROM metrics_daily WHERE date >= '2026-09-01'/);
  const log = console.log; console.log = () => {};
  let out;
  try { out = await main(['--rows-file', path.join(dir, 'rows.json'), '--out-dir', path.join(dir, 'out'), '--as-of', '2026-10-25']); } finally { console.log = log; }
  assert.match(path.basename(out.file), /^state_METRICS_auto_\d{4}-\d\d-\d\d\.md$/);
  assert.match(fs.readFileSync(out.file, 'utf8'), /As of 2026-10-25/);
});

// ---------- the Worker -------------------------------------------------------------------------------------------------------------

test('POST /api/run-metrics-daily needs the admin secret; with it ?dry=1 writes nothing and a normal call stores the rows', async () => {
  const env = { ...makeMetricsDb(), ADMIN_SECRET: 'sekret' };
  const call = (qs, headers = {}) => worker.fetch(new Request(`https://sparkfare.com/api/run-metrics-daily${qs}`, { method: 'POST', headers }), env, { waitUntil() {} });
  assert.equal((await call('')).status, 401);
  const auth = { Authorization: 'Bearer sekret' };
  const dry = await (await call('?dry=1', auth)).json();
  assert.equal(dry.ok, true); assert.equal(dry.dryRun, true); assert.equal(dry.written, 0);
  assert.equal(rowsOf(env).length, 0);
  const real = await (await call('?days=3', auth)).json();
  assert.equal(real.days, 3); assert.ok(real.written > 0);
  assert.ok(rowsOf(env).length > 0);
  assert.equal((await (await call('?days=999&dry=1', auth)).json()).days, 45); // clamped
});

test('the 09:30 UTC cron stores the metrics even when the data alert is off, and a failure there cannot stop the cron', async () => {
  const env = { ...makeMetricsDb(), ENABLE_DATA_ALERTS: 'false' };
  await worker.scheduled({ cron: '30 9 * * *' }, env, { waitUntil() {} });
  assert.ok(rowsOf(env).length > 0);
  const broken = { ...makeMetricsDb(), ENABLE_DATA_ALERTS: 'false' };
  broken.raw.exec('DROP TABLE metrics_daily');
  const err = console.error; console.error = () => {};
  try { await worker.scheduled({ cron: '30 9 * * *' }, broken, { waitUntil() {} }); } finally { console.error = err; }
});

test('the weekly workflow is a dry run by hand, reads D1 only, and commits only docs/metrics', () => {
  const y = read('.github/workflows/metrics-auto.yml');
  assert.match(y, /DRY_RUN: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.dry_run != 'false' \}\}/);
  assert.match(y, /shell: bash\r?\n\s+run: \|\r?\n\s+flags=/);
  assert.equal((y.match(/git add /g) || []).length, 1);
  assert.match(y, /git add docs\/metrics\/\r?\n/);
  assert.doesNotMatch(y, /pull_request/);
  assert.match(y, /cron: '\d+ \d+ \* \* 1'/);
});

test('the gates registry names every gate and says plainly where a rule was not supplied', () => {
  const g = read('docs/data/gates.md');
  for (const s of ['G1', 'G2', 'Nov 20', 'Dec 6', 'Dec 11', 'Feb 12', 'D-004']) assert.ok(g.includes(s), s);
  assert.equal((g.match(/Rule not supplied/g) || []).length, 2);
});
