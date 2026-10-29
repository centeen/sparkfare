// Manual flip-order dry run (not part of npm test). Applies every migration to a fresh in-memory SQLite, stubs Resend, then turns the Q/C1 flags on cumulatively in the
// order of docs/handoff/flip_order_checklist_2026-10-28.md and, at each step, hits the main routes and runs the scheduled jobs + digest. Prints emails per recipient per pass.
// Run from the repo root: node tests/manual/flip_order_dry_run.mjs   (Node 22+; sends nothing)
import fs from 'node:fs';
import { makeSqliteD1 } from '../../tests/helpers/sqliteD1.js';
process.env.EMAIL_POSTAL_ADDRESS ??= '1 Test Street, Test City, TS 00000';
const R = new URL('../../', import.meta.url).pathname;
const mod = await import(R + 'src/index.js'); const worker = mod.default; const sendDailyAlerts = mod.sendDailyAlerts;
const files = fs.readdirSync(R + 'migrations').filter(f => f.endsWith('.sql')).sort().map(f => 'migrations/' + f);
// 1. every migration must apply cleanly, in order, on a fresh DB
let DB; const migErrs = [];
{
  const { DatabaseSync } = await import('node:sqlite');
  const probe = new DatabaseSync(':memory:');
  for (const f of files) { try { probe.exec(fs.readFileSync(R + f, 'utf8')); } catch (e) { migErrs.push(f + ': ' + e.message); } }
}
console.log('migrations:', files.length, 'files; errors on a fresh DB:', migErrs.length ? migErrs : 'none');
// build DB skipping failures
const okFiles = [];
{ const { DatabaseSync } = await import('node:sqlite'); const p = new DatabaseSync(':memory:');
  for (const f of files) { try { p.exec(fs.readFileSync(R + f, 'utf8')); okFiles.push(f); } catch {} } }
DB = makeSqliteD1(okFiles);
const raw = DB.raw;
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) { const body = JSON.parse(init.body); const arr = Array.isArray(body) ? body : [body]; for (const b of arr) sent.push({ to: [].concat(b.to)[0], subject: b.subject, tags: b.tags, headers: b.headers, html: b.html }); return new Response(JSON.stringify({ id: 'x' + sent.length }), { status: 200 }); }
  return new Response('{}', { status: 200 });
};
const ASSET = u => { try { return new Response(fs.readFileSync(R + new URL(u.url).pathname.slice(1)), { status: 200 }); } catch { return new Response('nf', { status: 404 }); } };
const base = { ADMIN_SECRET: 'a', UNSUBSCRIBE_SECRET: 'u'.repeat(32), RESEND_API_KEY: 'k', APP_URL: 'https://sparkfare.com', EMAIL_FROM: 'hello@sparkfare.com',
  EMAIL_POSTAL_ADDRESS: '1 Test St, Test City, TS 00000', ENABLE_DAILY_DIGEST: 'true', ENABLE_EMAIL_V2: 'true', ENABLE_DIGEST_SKIP_UNCHANGED: 'false', ASSETS: { fetch: ASSET }, DB };
const cols = raw.prepare("select name from pragma_table_info('users')").all().map(r => r.name);
const mk = (id, email, origin, freq, extra = {}) => { const o = { id, email, origin_iata: origin, verified_email: 1, frequency: freq, created_at: '2026-07-01 00:00:00', last_opened_at: '2026-10-28 00:00:00', ...extra };
  const k = Object.keys(o).filter(c => cols.includes(c)); raw.prepare(`insert into users (${k.join(',')}) values (${k.map(() => '?').join(',')})`).run(...k.map(c => o[c])); };
mk('u1', 'a+jfk@example.com', 'JFK', 'daily'); mk('u2', 'b+lax@example.com', 'LAX', 'daily'); mk('u3', 'c+jfk@example.com', 'JFK', 'weekly');
const digestResults = []; const warns = new Set();
const ctx = { waitUntil: p => p };
const steps = [ 'ENABLE_SIGNED_PREFS','ENABLE_SIGNUP_FREQUENCY','ENABLE_WELCOME_EMAIL','ENABLE_R2_SERVING','ENABLE_RETENTION_JOBS','ENABLE_LOCAL_MORNING_SEND','ENABLE_TRIP_SELF_REPORT','ENABLE_TRIP_STREAM_V2','ENABLE_LIFECYCLE_V2','ENABLE_CARE_EMAIL' ];
const env = { ...base, ENABLE_SIGNED_PREFS: 'false', RETENTION_DRY_RUN: 'true' };
const routes = ['/', '/prefs', '/api/signup-options', '/api/health', '/sparkfare_ranked_deals.json', '/check', '/time-off/jfk', '/away-mode', '/api/deals?origin=JFK'];
async function pass(label) {
  for (const t of ['daily_alert_deliveries','email_send_ledger','daily_job_runs']) { try { raw.exec('delete from '+t); } catch {} }
  const bad = []; for (const p of routes) { try { const r = await worker.fetch(new Request('https://sparkfare.com' + p), env, ctx); if (r.status >= 500) bad.push(p + ' ' + r.status); } catch (e) { bad.push(p + ' threw ' + e.message); } }
  const before = sent.length; const cw = console.warn; console.warn = (...a) => { if (!String(a[0]).includes("Promoted")) warns.add(String(a[0]).slice(0,140)); }; const errs = []; const ce = console.error; console.error = (...a) => errs.push(a.map(String).join(' ').slice(0, 160));
  for (const cron of ['0 8 * * *', '30 * * * *', '30 9 * * *']) { try { await worker.scheduled({ cron, scheduledTime: Date.parse('2026-10-29T08:00:00Z') }, env, ctx); } catch (e) { errs.push(cron + ' threw ' + e.message); } }
  try { const r = await sendDailyAlerts(env); digestResults.push(label + ': ' + JSON.stringify(r)); } catch (e) { digestResults.push(label + ' threw ' + e.message); }
  console.error = ce; console.warn = cw;
  const per = {}; for (const s of sent.slice(before)) per[s.to] = (per[s.to] || 0) + 1;
  console.log(`\n[${label}] route 5xx: ${bad.length ? bad : 'none'} | emails this pass:`, JSON.stringify(per), '| distinct errors:', [...new Set(errs)].slice(0, 4));
  return per;
}
await pass('baseline (all C1/Q flags off)');
for (const f of steps) { env[f] = 'true'; if (f === 'ENABLE_TRIP_STREAM_V2') env.ENABLE_TRIP_SELF_REPORT = 'true'; await pass('+ ' + f); }
const total = {}; for (const s of sent) total[s.to] = (total[s.to] || 0) + 1;
console.log('\nTOTAL emails by recipient across all passes:', total);
const last = sent.filter(x=>/example.com/.test(x.to)).slice(-1)[0]; console.log('last user email:', last && {to:last.to, subject:last.subject, tags:last.tags, hasPostal:/Test St|Test Street/.test(last.html||''), hasUnsub:!!(last.headers&&last.headers['List-Unsubscribe']), prefsLink:/\/prefs/.test(last.html||'')});
const tags = new Set(sent.map(s => JSON.stringify((s.tags || []).map(t => t.name + '=' + t.value))));
console.log('distinct stream/kind tag sets:', [...tags].slice(0, 8));
console.log(digestResults.join('\n'));
globalThis.fetch = realFetch;
console.log('WARNS', [...warns].slice(0,8));
console.log(JSON.stringify(raw.prepare('select email,status,error,delivered_on from daily_alert_deliveries').all())); console.log(JSON.stringify(raw.prepare("select event_type,count(*) n from events group by 1 order by 2 desc limit 12").all()));
