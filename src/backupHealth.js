// N3 (Addendum N): is the nightly D1 backup happening, and did the last restore drill pass?
// Reads the two small state objects the backup scripts write to the private raw bucket (state/d1_backup/latest.json
// and drill.json) through the read-only RAW binding. Used by the daily health check and the Monday standup.
// Without the binding, or before the first backup, it reports nothing. Never throws.

export const BACKUP_MAX_AGE_HOURS = 26;
export const DRILL_MAX_AGE_DAYS = 45;

const read = async (env, key) => {
  const obj = await env.RAW.get(key);
  return obj ? JSON.parse(await obj.text()) : null;
};

export async function checkBackupState(env, now = new Date()) {
  if (!env?.RAW) return { problems: [], details: [], skipped: 'RAW binding not configured' };
  const problems = [];
  const details = [];
  let latest = null;
  let drill = null;
  try {
    latest = await read(env, 'state/d1_backup/latest.json');
    drill = await read(env, 'state/d1_backup/drill.json');
  } catch (error) {
    problems.push(`The D1 backup status could not be read from the raw bucket (${String(error?.message ?? error).slice(0, 120)}).`);
    return { problems, details };
  }

  if (!latest) {
    details.push({ line: 'D1 backup: none recorded yet' });
  } else {
    const taken = new Date(latest.taken_at);
    const ageHours = Number.isNaN(taken.getTime()) ? null : (now - taken) / 36e5;
    const rounded = ageHours === null ? null : Math.round(ageHours * 10) / 10;
    details.push({ line: `D1 backup: ${latest.date}, ${latest.tables} tables, ${rounded === null ? 'undated' : `${rounded}h old`} (limit ${BACKUP_MAX_AGE_HOURS}h)` });
    if (ageHours === null || ageHours > BACKUP_MAX_AGE_HOURS) {
      problems.push(`The newest D1 backup is ${ageHours === null ? 'undated' : `${Math.round(ageHours)} hours old`} (limit ${BACKUP_MAX_AGE_HOURS}). The nightly backup workflow has stopped working; see docs/data/RUNBOOK.md.`);
    }
  }

  if (drill) {
    const checked = new Date(drill.checked_at);
    const ageDays = Number.isNaN(checked.getTime()) ? null : (now - checked) / 864e5;
    details.push({ line: `D1 restore drill: ${drill.status.toUpperCase()} on ${String(drill.checked_at).slice(0, 10)} (backup of ${drill.backup_date})` });
    if (drill.status !== 'pass') {
      problems.push(`The last D1 restore drill FAILED (${drill.backup_date} backup${drill.missing_tables?.length ? `, missing tables: ${drill.missing_tables.join(', ')}` : ''}). The backups cannot be trusted until this is fixed; see docs/data/RUNBOOK.md.`);
    } else if (ageDays !== null && ageDays > DRILL_MAX_AGE_DAYS) {
      problems.push(`The last passing D1 restore drill was ${Math.round(ageDays)} days ago (limit ${DRILL_MAX_AGE_DAYS}); the monthly drill has stopped running.`);
    }
  } else if (latest) {
    details.push({ line: 'D1 restore drill: not run yet (first one on the 2nd of the month)' });
  }
  return { problems, details };
}
