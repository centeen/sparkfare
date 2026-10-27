// N11 (Addendum N, ROADMAP step 158): turns rows of `metrics_daily` into the auto-written metrics file the Hub copies into the project's
// state_METRICS.md (item 125). Pure functions over rows, so the weekly workflow (scripts/data/metrics-auto.mjs) and the tests use the same code.
// Counts only, each with its as-of date and its sample size n. A rate below its KPI's minimum sample is shown as "too small", never as a number.
import { KPI_CATALOG } from './definitions.js';

const pct = (n, d, scale) => (d > 0 ? Math.round((n / d) * scale * 10) / 10 : null);

/** Sum `value` and `n` per dimension over rows of one metric whose date is in [from, to] (inclusive, YYYY-MM-DD). */
export function sumByDimension(rows, metricId, from, to) {
  const out = {};
  for (const r of rows) {
    if (r.metric_id !== metricId || r.date < from || r.date > to) continue;
    const e = (out[r.dimension] = out[r.dimension] || { value: 0, n: 0, days: 0 });
    e.value += Number(r.value) || 0;
    e.n += Number(r.n) || 0;
    e.days += 1;
  }
  return out;
}

/** The newest row per dimension for a stock metric. */
export function latestByDimension(rows, metricId) {
  const out = {};
  for (const r of rows) {
    if (r.metric_id !== metricId) continue;
    if (!out[r.dimension] || r.date > out[r.dimension].date) out[r.dimension] = { date: r.date, value: Number(r.value) || 0, n: Number(r.n) || 0 };
  }
  return out;
}

const addDays = (key, n) => new Date(new Date(`${key}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

/**
 * Compute the report data for a window of `days` ending on `asOf` (the last complete day). Returns one block per KPI in KPI_CATALOG:
 *   { id, label, unit, kind: 'sum' | 'stock' | 'rate', rows: [{ dimension, value, n, tooSmall?, numerator?, denominator? }], note, minSample, days }
 */
export function buildReport(rows, { asOf, days = 7 } = {}) {
  const to = asOf;
  const from = addDays(to, -(days - 1));
  const blocks = [];
  for (const k of KPI_CATALOG) {
    const base = { id: k.id, label: k.label, unit: k.unit, minSample: k.minSample, note: k.note || null, decision: k.decision, bots: k.bots };
    if (k.derive?.rowCount) {
      // share of measured days that were good (a day's row is 1 for a pass, 0 for a miss)
      const e = sumByDimension(rows, k.derive.numerator, from, to)[''];
      const measured = e ? e.days : 0;
      blocks.push({ ...base, kind: 'rate', days, rows: [{ dimension: '', value: pct(e?.value || 0, measured, k.derive.scale), numerator: e?.value || 0, denominator: measured, n: measured, tooSmall: measured < k.minSample }] });
    } else if (k.derive) {
      const num = sumByDimension(rows, k.derive.numerator, from, to);
      const den = sumByDimension(rows, k.derive.denominator, from, to);
      const dims = [...new Set([...Object.keys(num), ...Object.keys(den)])].sort();
      blocks.push({ ...base, kind: 'rate', days, rows: dims.map((d) => {
        const n = num[d]?.value || 0; const dd = den[d]?.value || 0;
        return { dimension: d, value: pct(n, dd, k.derive.scale), numerator: n, denominator: dd, n: dd, tooSmall: dd < k.minSample };
      }) });
    } else if (k.kind === 'stock') {
      const latest = latestByDimension(rows, k.stored[0]);
      blocks.push({ ...base, kind: 'stock', days: 1, rows: Object.entries(latest).sort().map(([d, e]) => ({ dimension: d, value: e.value, n: e.n, asOf: e.date, tooSmall: e.n < k.minSample && k.id === 'engaged_subscribers' })) });
    } else {
      const sums = sumByDimension(rows, k.stored[0], from, to);
      blocks.push({ ...base, kind: 'sum', days, rows: Object.entries(sums).sort().map(([d, e]) => ({ dimension: d, value: e.value, n: e.n })) });
    }
  }
  return { asOf, from, to, days, blocks };
}

const fmt = (v) => (v == null ? 'n/a' : (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)));

export function renderMarkdown(report) {
  const lines = [
    `# Sparkfare metrics (auto-written)`,
    '',
    `As of ${report.asOf} (UTC). Window: ${report.from} to ${report.to} (${report.days} days) unless a row says otherwise. Counts only: no email address, no user id.`,
    'Rates are computed from the summed counts of their parts, never averaged across days. A rate whose denominator is below the KPI\'s minimum sample is shown as "too small".',
    'Generated from `metrics_daily` by `scripts/data/metrics-auto.mjs`; definitions are in `src/metrics/definitions.js`.',
    '',
  ];
  for (const b of report.blocks) {
    lines.push(`## ${b.label}`, '', `KPI \`${b.id}\`, unit ${b.unit}, serves: ${b.decision}. Bots: ${b.bots}. Minimum sample ${b.minSample}.`);
    if (b.note) lines.push('', `Note: ${b.note}`);
    lines.push('');
    if (!b.rows.length) { lines.push('No data in this window.', ''); continue; }
    if (b.kind === 'rate') {
      lines.push('| Dimension | Value | Numerator | Denominator (n) | Read |', '| --- | --- | --- | --- | --- |');
      for (const r of b.rows) lines.push(`| ${r.dimension || 'all'} | ${r.tooSmall ? 'too small' : fmt(r.value)} | ${fmt(r.numerator)} | ${fmt(r.denominator)} | ${r.tooSmall ? `n below ${b.minSample}` : 'ok'} |`);
    } else if (b.kind === 'stock') {
      lines.push('| Dimension | Value | n | As of |', '| --- | --- | --- | --- |');
      for (const r of b.rows) lines.push(`| ${r.dimension || 'all'} | ${fmt(r.value)} | ${fmt(r.n)} | ${r.asOf} |`);
    } else {
      lines.push('| Dimension | Value | n |', '| --- | --- | --- |');
      for (const r of b.rows) lines.push(`| ${r.dimension || 'all'} | ${fmt(r.value)} | ${fmt(r.n)} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
