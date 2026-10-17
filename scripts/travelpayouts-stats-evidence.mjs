#!/usr/bin/env node
// Addendum H, section 2 (owner decision D-019; ROADMAP step 98): one read-only call to the Travelpayouts statistics API for campaign 100,
// and an evidence note that says whether the repo's assumptions about the response match it. Evidence only: it is not a gate input.
//
//   TRAVELPAYOUTS_TOKEN=<token> node scripts/travelpayouts-stats-evidence.mjs [--from 2026-10-01] [--to 2026-10-17] [--out docs/evidence_....md]
//
// The token is read from the environment and used only as the X-Access-Token header. It is never printed, logged or written: the
// report holds no header, and any error text is scrubbed of the token before it is shown. Run it in your own terminal; do not paste
// the token into a chat or a file. The request is the same shape reconcileBookings() sends (src/index.js) and carries no traveler data.
// It makes ONE call. If the answer fills the page it says so and stops; pass --page2 to fetch the next page (a second call).
// It does not search, click or buy anything, and calls no endpoint that logs a click.
import fs from 'node:fs';
import path from 'node:path';

export const STATS_URL = 'https://api.travelpayouts.com/statistics/v1/execute_query';
export const CAMPAIGN_ID = 100; // AVIASALES_CAMPAIGN_ID in src/index.js
export const MARKER = '314524'; // the affiliate marker withTripMarker() puts before the trip id
export const PAGE_LIMIT = 1000; // what reconcileBookings() asks for
export const FIELDS = ['sub_id', 'state', 'date', 'price_eur']; // what reconcileBookings() reads
const TRIP_ID = /^[0-9a-f]{32}$/; // trips.trip_id shape; the repo strips a leading period and a "314524." prefix before matching

// What the repo's normalizeSubId() does (src/index.js), restated step for step so the evidence can say whether a real value would survive
// it. tests/travelpayouts_stats_evidence.test.js compares this with the real function so the two cannot drift apart.
export function repoNormalizeSubId(value) {
  if (typeof value !== 'string') return '';
  let v = value.trim();
  if (v.startsWith(MARKER + '.')) v = v.slice(MARKER.length + 1);
  v = v.replace(/^\.+/, '');
  return v;
}

export function buildRequest({ from, offset = 0 }) {
  return {
    fields: FIELDS,
    filters: [
      { field: 'date', op: 'ge', value: from },
      { field: 'campaign_id', op: 'eq', value: CAMPAIGN_ID },
      { field: 'type', op: 'eq', value: 'action' },
    ],
    sort: [{ field: 'date', order: 'desc' }],
    offset,
    limit: PAGE_LIMIT,
  };
}

// Reduce a response to facts about its shape. Real sub_id values are NOT kept: they identify trips and this note is committed to a public repo.
export function analyze(data) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const keys = new Set();
  for (const row of results) for (const k of Object.keys(row || {})) keys.add(k);
  const topLevel = data && typeof data === 'object' ? Object.keys(data) : [];
  const states = {};
  let priceSum = 0;
  let priceN = 0;
  let minDate = null;
  let maxDate = null;
  const sub = { present: 0, empty: 0, leadingPeriod: 0, containsMarker: 0, markerPrefix: 0, tripIdAsIs: 0, tripIdAfterRepoNormalize: 0, lengths: new Set(), other: 0 };
  for (const row of results) {
    states[row?.state ?? '(none)'] = (states[row?.state ?? '(none)'] || 0) + 1;
    if (typeof row?.price_eur === 'number') { priceSum += row.price_eur; priceN += 1; }
    if (typeof row?.date === 'string') {
      const d = row.date.slice(0, 10);
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
    const raw = row?.sub_id;
    if (raw === null || raw === undefined || String(raw) === '') { sub.empty += 1; continue; }
    sub.present += 1;
    const s = String(raw);
    sub.lengths.add(s.length);
    if (s.startsWith('.')) sub.leadingPeriod += 1;
    if (s.includes(MARKER)) sub.containsMarker += 1;
    if (s.startsWith(MARKER + '.')) sub.markerPrefix += 1;
    if (TRIP_ID.test(s)) sub.tripIdAsIs += 1;
    if (TRIP_ID.test(repoNormalizeSubId(s))) sub.tripIdAfterRepoNormalize += 1;
    else if (!TRIP_ID.test(s)) sub.other += 1;
  }
  return {
    rowCount: results.length,
    topLevelKeys: topLevel,
    rowFields: [...keys].sort(),
    requestedFieldsMissing: FIELDS.filter((f) => !keys.has(f) && results.length > 0),
    unexpectedFields: [...keys].filter((k) => !FIELDS.includes(k)).sort(),
    states,
    priceEurSum: priceN ? Math.round(priceSum * 100) / 100 : null,
    priceEurRows: priceN,
    dateRange: { first: minDate, last: maxDate },
    subId: { ...sub, lengths: [...sub.lengths].sort((a, b) => a - b) },
    pageFull: results.length >= PAGE_LIMIT,
  };
}

const yn = (b) => (b ? 'yes' : 'no');

export function renderEvidence({ status, ok, endpointPath, from, to, calls, analysis, errorText, generatedAt }) {
  const L = [];
  L.push('# Evidence: Travelpayouts statistics, campaign 100 (Addendum H, D-019)');
  L.push('');
  L.push(`Generated ${generatedAt}. Read-only evidence for ROADMAP step 98; it is not a gate input and does not change D-007 or count toward the Dec 11 gate.`);
  L.push('');
  L.push('## The call');
  L.push(`- Endpoint path: \`POST ${endpointPath}\` (the same request shape \`reconcileBookings()\` sends: fields ${FIELDS.map((f) => '`' + f + '`').join(', ')}; filters \`date >= ${from}\`, \`campaign_id = ${CAMPAIGN_ID}\`, \`type = action\`; limit ${PAGE_LIMIT}).`);
  L.push(`- Date range asked for: ${from} to ${to} (the API was filtered from ${from}; the call was made ${to}).`);
  L.push(`- Calls made: ${calls}. HTTP status: ${status}.`);
  L.push('- The access token was read from the environment and sent only as a header. It is not in this file.');
  if (!ok) {
    L.push('');
    L.push('## The call did not succeed');
    L.push('Stopped without retrying, as instructed. Error text (token removed if it had appeared):');
    L.push('');
    L.push('```');
    L.push(String(errorText || '(no body)').slice(0, 800));
    L.push('```');
    return L.join('\n') + '\n';
  }
  const a = analysis;
  L.push('');
  L.push('## What came back');
  L.push(`- Top-level keys of the response: ${a.topLevelKeys.length ? a.topLevelKeys.map((k) => '`' + k + '`').join(', ') : '(none)'}.`);
  L.push(`- Rows returned: **${a.rowCount}**${a.pageFull ? ` (the page limit of ${PAGE_LIMIT} was reached, so there may be more; use \`--page2\` for the next page)` : ''}.`);
  L.push(`- Field names present on rows: ${a.rowFields.length ? a.rowFields.map((k) => '`' + k + '`').join(', ') : '(no rows, so no field names can be listed)'}.`);
  L.push(`- Dates on returned rows: ${a.dateRange.first ? `${a.dateRange.first} to ${a.dateRange.last}` : '(none)'}.`);
  L.push(`- Rows by \`state\`: ${Object.keys(a.states).length ? Object.entries(a.states).map(([k, v]) => `${k}: ${v}`).join(', ') : '(none)'}.`);
  L.push(`- \`price_eur\`: ${a.priceEurRows} row(s) carry a number; their sum is ${a.priceEurSum ?? '(none)'} EUR.`);
  L.push('');
  L.push('## `sub_id` handling');
  L.push('Counts only; no real `sub_id` value is written here because each one identifies a trip.');
  L.push(`- Rows with a \`sub_id\`: ${a.subId.present}; empty or missing: ${a.subId.empty}.`);
  L.push(`- Starts with a leading period: ${a.subId.leadingPeriod}.`);
  L.push(`- Contains the marker \`${MARKER}\` anywhere: ${a.subId.containsMarker}; starts with \`${MARKER}.\`: ${a.subId.markerPrefix}.`);
  L.push(`- Already looks like a trip id (32 hex characters) as returned: ${a.subId.tripIdAsIs}.`);
  L.push(`- Looks like a trip id after the repo's normalisation (strip leading periods and a \`${MARKER}.\` prefix): ${a.subId.tripIdAfterRepoNormalize}.`);
  L.push(`- Length(s) seen: ${a.subId.lengths.length ? a.subId.lengths.join(', ') : '(none)'}.`);
  L.push('');
  L.push('## Against what the repo expects');
  const diffs = [];
  if (a.rowCount === 0) diffs.push('No rows came back for this range, so the field names, the leading period and the marker cannot be confirmed from this call. That is expected if nothing on campaign 100 has been recorded since the start date; it does not show the filter is wrong. The call itself was accepted, which does show the credential and the request shape are valid.');
  if (a.requestedFieldsMissing.length) diffs.push(`These requested fields are missing from the rows: ${a.requestedFieldsMissing.join(', ')}.`);
  if (a.unexpectedFields.length) diffs.push(`Extra fields on rows that the repo does not read: ${a.unexpectedFields.join(', ')}.`);
  if (a.subId.present && a.subId.leadingPeriod === 0) diffs.push('No `sub_id` had a leading period, so the vendor\'s "possibly with a leading period" statement was not seen in this response (the repo handles it either way).');
  if (a.subId.present && a.subId.containsMarker > 0) diffs.push(`The marker ${MARKER} appears inside ${a.subId.containsMarker} \`sub_id\` value(s). The repo strips only a leading "${MARKER}." prefix, so check these are handled.`);
  if (a.subId.present && a.subId.tripIdAfterRepoNormalize < a.subId.present) diffs.push(`${a.subId.present - a.subId.tripIdAfterRepoNormalize} \`sub_id\` value(s) do not look like a trip id even after normalisation (they may be test or non-Sparkfare traffic, or a format the repo does not expect).`);
  if (a.rowCount && !a.rowFields.includes('sub_id')) diffs.push('Rows have no `sub_id` field at all: reconciliation could never match a trip.');
  if (!diffs.length) diffs.push('Nothing differs from what `reconcileBookings()` expects: every requested field is present, every `sub_id` survives the repo normalisation as a trip id, and no extra fields were returned.');
  for (const d of diffs) L.push(`- ${d}`);
  return L.join('\n') + '\n';
}

export function scrub(text, token) {
  let s = String(text ?? '');
  if (token) s = s.split(token).join('[token removed]');
  return s;
}

// One call (two with page2). Returns what the report needs. The token only ever goes into the request header.
export async function run({ token, from, to, fetchImpl = globalThis.fetch, url = STATS_URL, page2 = false, now = new Date() }) {
  if (!token) throw new Error('Set TRAVELPAYOUTS_TOKEN in your own terminal first. It is read from the environment and never printed.');
  const endpointPath = new URL(url).pathname;
  const generatedAt = now.toISOString().slice(0, 10);
  const post = async (offset) => fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Token': token },
    body: JSON.stringify(buildRequest({ from, offset })),
  });
  let calls = 1;
  const res = await post(0);
  const bodyText = await res.text().catch(() => '');
  if (!res.ok) {
    return { text: renderEvidence({ status: res.status, ok: false, endpointPath, from, to, calls, errorText: scrub(bodyText, token), generatedAt }), ok: false, status: res.status };
  }
  let data;
  try { data = JSON.parse(bodyText); } catch {
    return { text: renderEvidence({ status: res.status, ok: false, endpointPath, from, to, calls, errorText: 'The response was not JSON: ' + scrub(bodyText, token).slice(0, 300), generatedAt }), ok: false, status: res.status };
  }
  if (page2 && Array.isArray(data?.results) && data.results.length >= PAGE_LIMIT) {
    calls = 2;
    const r2 = await post(PAGE_LIMIT);
    const t2 = await r2.text().catch(() => '');
    if (r2.ok) { try { const d2 = JSON.parse(t2); data = { ...data, results: [...data.results, ...(d2.results || [])] }; } catch { /* keep page one */ } }
  }
  const analysis = analyze(data);
  return { text: renderEvidence({ status: res.status, ok: true, endpointPath, from, to, calls, analysis, generatedAt }), ok: true, status: res.status, analysis };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
  const today = new Date().toISOString().slice(0, 10);
  const from = arg('--from', '2026-10-01');
  const to = arg('--to', today);
  const out = arg('--out', 'docs/evidence_travelpayouts_stats_campaign100_2026-10-17.md');
  const token = process.env.TRAVELPAYOUTS_TOKEN || '';
  const result = await run({ token, from, to, page2: args.includes('--page2') });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, result.text);
  console.log(`HTTP ${result.status}. Wrote ${out}.`);
  if (result.ok && result.analysis) {
    const a = result.analysis;
    console.log(`Rows: ${a.rowCount}. Fields: ${a.rowFields.join(', ') || '(none)'}. sub_id with leading period: ${a.subId.leadingPeriod}; containing ${MARKER}: ${a.subId.containsMarker}.`);
  } else {
    console.log('The call did not succeed; the note holds the status and error text. Not retrying.');
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(process.argv[1] || '', 'file:///').href || process.argv[1]?.endsWith('travelpayouts-stats-evidence.mjs')) {
  main().catch((e) => { console.error(String(e?.message || e)); process.exitCode = 1; });
}
