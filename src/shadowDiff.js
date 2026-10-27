// N10 (Addendum N): reads the shadow-ranking diff pointer (serving-shadow/diff-latest.json in the private raw bucket)
// for the Monday standup. Counts only. Reports nothing without the RAW binding or before the first diff. Never throws.
// A difference is not a problem by itself (the shadow is ranked from the curated store); records missing or added, or a
// pointer more than two days old, are what a person should look at before ENABLE_CURATED_SERVING is considered.

export const SHADOW_DIFF_MAX_AGE_DAYS = 2;

export async function readShadowDiff(env, now = new Date()) {
  if (!env?.RAW) return { details: [], problems: [] };
  let diff;
  try {
    const obj = await env.RAW.get('serving-shadow/diff-latest.json');
    if (!obj) return { details: [{ line: 'Shadow ranking diff: none recorded yet' }], problems: [] };
    diff = JSON.parse(await obj.text());
  } catch (error) {
    return { details: [], problems: [`The shadow ranking diff could not be read (${String(error?.message ?? error).slice(0, 120)}).`] };
  }
  const details = [];
  const problems = [];
  const ageDays = (now - new Date(`${diff.date}T00:00:00Z`)) / 864e5;
  if (!Number.isFinite(ageDays) || ageDays > SHADOW_DIFF_MAX_AGE_DAYS) {
    problems.push(`The newest shadow ranking diff is dated ${diff.date ?? 'unknown'}; the daily "Rank curated (shadow)" workflow has stopped.`);
  }
  for (const [name, f] of Object.entries(diff.files || {})) {
    if (!f) { details.push({ line: `Shadow diff ${diff.date}, ${name}: not compared (a file was missing)` }); continue; }
    details.push({ line: `Shadow diff ${diff.date}, ${name}: ${f.status_changes} verdict change(s), ${f.price_diffs} price difference(s), ${f.missing} missing, ${f.added} added${f.clean ? ' (clean)' : ''}` });
    if (f.missing > 0 || f.added > 0) problems.push(`Shadow ranking for ${name} has ${f.missing} record(s) missing and ${f.added} added against the served file.`);
  }
  return { details, problems };
}
