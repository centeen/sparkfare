// Manual check of Q7 (ENABLE_LOCAL_MORNING_SEND): fakes the clock and confirms each origin's readers get one digest at 06:30 local, none at 08:00 UTC, no duplicates.
// Run from the repo root: node tests/manual/local_morning_dry_run.mjs   (Node 22+; sends nothing)
import fs from 'node:fs';
import { makeSqliteD1 } from '../../tests/helpers/sqliteD1.js';
process.env.EMAIL_POSTAL_ADDRESS ??= '1 Test Street, Test City, TS 00000';
const R=new URL('../../', import.meta.url).pathname;
const worker=(await import(R+'src/index.js')).default;
const files=fs.readdirSync(R+'migrations').filter(f=>f.endsWith('.sql')).sort().map(f=>'migrations/'+f);
const DB=makeSqliteD1(files); const raw=DB.raw;
const sent=[]; const rf=globalThis.fetch;
globalThis.fetch=async(url,init)=>{ if(String(url).includes('api.resend.com')){const body=JSON.parse(init.body);for(const b of (Array.isArray(body)?body:[body]))sent.push({to:[].concat(b.to)[0],subject:b.subject});return new Response('{"id":"x"}',{status:200});} return new Response('{}',{status:200}); };
const ASSET=u=>{try{return new Response(fs.readFileSync(R+new URL(u.url).pathname.slice(1)))}catch{return new Response('nf',{status:404})}};
const env={ADMIN_SECRET:'a',UNSUBSCRIBE_SECRET:'u'.repeat(32),RESEND_API_KEY:'k',APP_URL:'https://sparkfare.com',EMAIL_FROM:'hello@sparkfare.com',EMAIL_POSTAL_ADDRESS:'1 Test St',ENABLE_DAILY_DIGEST:'true',ENABLE_EMAIL_V2:'true',ENABLE_LOCAL_MORNING_SEND:'true',ASSETS:{fetch:ASSET},DB};
const cols=raw.prepare("select name from pragma_table_info('users')").all().map(r=>r.name);
const mk=(id,email,o,f)=>{const r={id,email,origin_iata:o,verified_email:1,frequency:f,created_at:'2026-07-01 00:00:00',last_opened_at:'2026-10-28 00:00:00'};const k=Object.keys(r).filter(c=>cols.includes(c));raw.prepare(`insert into users (${k.join(',')}) values (${k.map(()=>'?').join(',')})`).run(...k.map(c=>r[c]));};
mk('u1','a+jfk@example.com','JFK','daily');mk('u2','b+lax@example.com','LAX','daily');mk('u3','c+ord@example.com','ORD','daily');
const ctx={waitUntil:p=>p};
const quiet=()=>{const e=console.error,w=console.warn,l=console.log;console.error=console.warn=console.log=()=>{};return()=>{console.error=e;console.warn=w;console.log=l;};};
async function at(utc,cron){const n=sent.length;const un=quiet();try{await worker.scheduled({cron,scheduledTime:Date.parse(utc)},env,ctx);}finally{un();} return sent.slice(n).filter(s=>/example.com/.test(s.to)).map(s=>s.to);}
const RealDate=Date;
async function run(utc,cron){ const t=RealDate.parse(utc); globalThis.Date=class extends RealDate{constructor(...a){ if(a.length)super(...a); else super(t);} static now(){return t;}}; try{return await at(utc,cron);} finally{globalThis.Date=RealDate;} }
console.log('08:00Z legacy cron      ->',await run('2026-10-29T08:00:00Z','0 8 * * *'));
console.log('04:30Z hourly           ->',await run('2026-10-29T04:30:00Z','30 * * * *'));
console.log('10:30Z hourly (06:30 NY, ORD 05:30) ->',await run('2026-10-29T10:30:00Z','30 * * * *'));
console.log('10:30Z hourly again (dup check)     ->',await run('2026-10-29T10:30:00Z','30 * * * *'));
console.log('11:30Z hourly (06:30 ORD)->',await run('2026-10-29T11:30:00Z','30 * * * *'));
console.log('13:30Z hourly (06:30 LA) ->',await run('2026-10-29T13:30:00Z','30 * * * *'));
console.log('14:30Z hourly (after window)->',await run('2026-10-29T14:30:00Z','30 * * * *'));
console.log('total per user:',sent.filter(s=>/example.com/.test(s.to)).reduce((a,s)=>(a[s.to]=(a[s.to]||0)+1,a),{}));
console.log('ops emails:',[...new Set(sent.filter(s=>!/example.com/.test(s.to)).map(s=>s.subject))]);
const r=await worker.fetch(new Request('https://sparkfare.com/api/check-revenue-health',{method:'POST',headers:{Authorization:'Bearer a'}}),env,ctx);
console.log('HEALTH', r.status, (await r.text()).slice(0,900));
