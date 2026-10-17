// Rule watcher (Addendum G, task G2; ROADMAP step 88). Behind ENABLE_RULE_WATCHER (default "false").
//
// Once a week (on the existing Monday cron trigger) it fetches every distinct officialUrl and sourceUrl used by the leave-by
// rules, reduces each page to its main text, hashes it and compares it with the stored hash. A changed page, or a page that
// failed to load three runs in a row, puts every rule that uses it on hold. A page that refuses automated visitors (a bot check, or
// HTTP 401, 403 or 429) is different: the watcher cannot read it at all, so it is reported as "cannot check automatically" and
// holds nothing. Holding on a block would take every rule that uses that site off the plan for a reason that says nothing about the rule. A held rule shows only "This changed recently.
// Check the official page:" and the link, never a date. The owner gets ONE summary email per run and confirms or keeps each
// rule in /admin/rules. The first time a page is seen it only records a baseline: nothing is held.
//
// Only the owner can lift a hold. Nothing here writes to the rules file; holds and confirmations live in D1.
import { ALL_WATCHED_RULES } from './data/leaveByRules.js';
import { sendRuleWatcherSummaryEmail } from './email.js';

export const RULE_WATCHER = {
  FAILS_BEFORE_HOLD: 3,
  FETCH_TIMEOUT_MS: 15000,
  DELAY_BETWEEN_FETCHES_MS: 500,
  MIN_TEXT_LENGTH: 200,
  USER_AGENT: 'SparkfareRuleWatcher/1.0 (+https://sparkfare.com)',
};

export function ruleWatcherEnabled(env) {
  return env?.ENABLE_RULE_WATCHER === 'true';
}

export async function ensureRuleWatcherTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS rule_watch_urls (
       url TEXT PRIMARY KEY,
       hash TEXT,
       last_checked TEXT,
       last_changed TEXT,
       fail_count INTEGER NOT NULL DEFAULT 0,
       last_error TEXT
     )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS rule_status_overrides (
       rule_id TEXT PRIMARY KEY,
       status TEXT NOT NULL,
       reason TEXT,
       url TEXT,
       held_at TEXT,
       as_of TEXT,
       note TEXT,
       updated_at TEXT
     )`
  ).run();
}

// Reduce a page to the text a reader would see, so a changed script, menu or footer does not count as a rule change.
export function normalizePageText(html) {
  let t = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|nav|header|footer|svg|form)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  t = t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return t.replace(/\s+/g, ' ').trim();
}

export async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// A bot-check page is a failed fetch, not a changed rule.
export function isChallengePage(text) {
  return /just a moment|performing security verification|verify(ing)? you are not a bot|enable javascript and cookies to continue/i.test(
    String(text || '').slice(0, 600)
  );
}

// Map of url -> rule ids that use it (officialUrl and sourceUrl, de-duplicated).
export function collectWatchUrls(rules = ALL_WATCHED_RULES) {
  const map = new Map();
  for (const rule of rules) {
    for (const url of [rule.officialUrl, rule.sourceUrl]) {
      if (!url || !/^https:\/\//i.test(url)) continue;
      if (!map.has(url)) map.set(url, new Set());
      map.get(url).add(rule.id);
    }
  }
  return map;
}

export async function getRuleOverrides(env) {
  if (!env?.DB) return {};
  try {
    await ensureRuleWatcherTables(env);
    const { results } = await env.DB.prepare(
      'SELECT rule_id, status, reason, url, held_at, as_of, note FROM rule_status_overrides'
    ).all();
    const out = {};
    for (const r of results || []) {
      out[r.rule_id] = { status: r.status, reason: r.reason, url: r.url, heldAt: r.held_at, asOf: r.as_of, note: r.note };
    }
    return out;
  } catch (error) {
    console.error('Rule override lookup failed:', error);
    return {};
  }
}

// Put a rule on hold. Returns true only when it was not already held (so the email lists new holds, not repeats).
async function holdRule(env, ruleId, url, reason, nowIso) {
  const existing = await env.DB.prepare('SELECT status FROM rule_status_overrides WHERE rule_id = ?').bind(ruleId).first();
  if (existing?.status === 'held') return false;
  await env.DB.prepare(
    `INSERT INTO rule_status_overrides (rule_id, status, reason, url, held_at, as_of, note, updated_at)
     VALUES (?, 'held', ?, ?, ?, NULL, NULL, ?)
     ON CONFLICT(rule_id) DO UPDATE SET status = 'held', reason = excluded.reason, url = excluded.url,
       held_at = excluded.held_at, as_of = NULL, updated_at = excluded.updated_at`
  ).bind(ruleId, reason, url, nowIso, nowIso).run();
  return true;
}

export async function confirmRule(env, ruleId, todayIso, nowIso = new Date().toISOString()) {
  await ensureRuleWatcherTables(env);
  await env.DB.prepare(
    `INSERT INTO rule_status_overrides (rule_id, status, reason, url, held_at, as_of, note, updated_at)
     VALUES (?, 'confirmed', NULL, NULL, NULL, ?, NULL, ?)
     ON CONFLICT(rule_id) DO UPDATE SET status = 'confirmed', reason = NULL, as_of = excluded.as_of, updated_at = excluded.updated_at`
  ).bind(ruleId, todayIso, nowIso).run();
}

export async function keepRuleHeld(env, ruleId, note = null, nowIso = new Date().toISOString()) {
  await ensureRuleWatcherTables(env);
  await env.DB.prepare(
    `INSERT INTO rule_status_overrides (rule_id, status, reason, url, held_at, as_of, note, updated_at)
     VALUES (?, 'held', 'kept by owner', NULL, ?, NULL, ?, ?)
     ON CONFLICT(rule_id) DO UPDATE SET status = 'held', note = excluded.note, updated_at = excluded.updated_at`
  ).bind(ruleId, nowIso, note, nowIso).run();
}

// A page that will not talk to automated visitors. Not a failure and not a change.
export const BLOCKED_STATUSES = [401, 403, 429];
class BlockedError extends Error {
  constructor(message) { super(message); this.blocked = true; }
}

async function fetchPageText(url, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': RULE_WATCHER.USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(RULE_WATCHER.FETCH_TIMEOUT_MS),
  });
  if (BLOCKED_STATUSES.includes(res.status)) throw new BlockedError(`HTTP ${res.status}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = normalizePageText(await res.text());
  if (isChallengePage(text)) throw new BlockedError('bot check page');
  if (text.length < RULE_WATCHER.MIN_TEXT_LENGTH) throw new Error('page text too short');
  return text;
}

// One run. Returns a summary; sends at most one email.
export async function runRuleWatcher(env, {
  rules = ALL_WATCHED_RULES,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  if (!env?.DB) return { ok: false, error: 'Database not configured' };
  await ensureRuleWatcherTables(env);
  const watch = collectWatchUrls(rules);
  const summary = { ok: true, checked: 0, baselined: 0, changed: 0, failed: 0, blocked: 0, cannotCheck: [], newlyHeld: [] };
  const heldGroups = [];

  let first = true;
  for (const [url, ruleSet] of watch) {
    if (!first) await sleep(RULE_WATCHER.DELAY_BETWEEN_FETCHES_MS);
    first = false;
    const nowIso = now().toISOString();
    const ruleIds = [...ruleSet];
    const prior = await env.DB.prepare('SELECT hash, fail_count FROM rule_watch_urls WHERE url = ?').bind(url).first();
    summary.checked += 1;

    let text;
    try {
      text = await fetchPageText(url, fetchImpl);
    } catch (error) {
      if (error?.blocked) {
        // Cannot read it. Keep the stored hash and the failure count as they are, change nothing about the rules, and say so.
        summary.blocked += 1;
        summary.cannotCheck.push(url);
        await env.DB.prepare(
          `INSERT INTO rule_watch_urls (url, hash, last_checked, last_changed, fail_count, last_error)
           VALUES (?, NULL, NULL, NULL, 0, ?)
           ON CONFLICT(url) DO UPDATE SET last_error = excluded.last_error`
        ).bind(url, ('blocked: ' + String(error.message)).slice(0, 200)).run();
        continue;
      }
      summary.failed += 1;
      const failCount = (prior?.fail_count || 0) + 1;
      await env.DB.prepare(
        `INSERT INTO rule_watch_urls (url, hash, last_checked, last_changed, fail_count, last_error)
         VALUES (?, NULL, ?, NULL, ?, ?)
         ON CONFLICT(url) DO UPDATE SET last_checked = excluded.last_checked, fail_count = excluded.fail_count, last_error = excluded.last_error`
      ).bind(url, nowIso, failCount, String(error?.message || error).slice(0, 200)).run();
      if (failCount >= RULE_WATCHER.FAILS_BEFORE_HOLD) {
        const reason = `could not be loaded ${failCount} runs in a row (${String(error?.message || error).slice(0, 80)})`;
        const fresh = [];
        for (const id of ruleIds) if (await holdRule(env, id, url, reason, nowIso)) fresh.push(id);
        if (fresh.length) heldGroups.push({ url, ruleIds: fresh, reason });
      }
      continue;
    }

    const hash = await hashText(text);
    if (!prior || !prior.hash) {
      summary.baselined += 1;
      await env.DB.prepare(
        `INSERT INTO rule_watch_urls (url, hash, last_checked, last_changed, fail_count, last_error)
         VALUES (?, ?, ?, NULL, 0, NULL)
         ON CONFLICT(url) DO UPDATE SET hash = excluded.hash, last_checked = excluded.last_checked, fail_count = 0, last_error = NULL`
      ).bind(url, hash, nowIso).run();
    } else if (prior.hash !== hash) {
      summary.changed += 1;
      // Record the new hash right away so next week compares against it; the rule stays held until the owner confirms.
      await env.DB.prepare(
        'UPDATE rule_watch_urls SET hash = ?, last_checked = ?, last_changed = ?, fail_count = 0, last_error = NULL WHERE url = ?'
      ).bind(hash, nowIso, nowIso, url).run();
      const reason = 'the official page text changed';
      const fresh = [];
      for (const id of ruleIds) if (await holdRule(env, id, url, reason, nowIso)) fresh.push(id);
      if (fresh.length) heldGroups.push({ url, ruleIds: fresh, reason });
    } else {
      await env.DB.prepare(
        'UPDATE rule_watch_urls SET last_checked = ?, fail_count = 0, last_error = NULL WHERE url = ?'
      ).bind(nowIso, url).run();
    }
  }

  summary.newlyHeld = heldGroups.flatMap((g) => g.ruleIds);
  if (heldGroups.length) {
    try {
      const sent = await sendRuleWatcherSummaryEmail(env, { runAt: now().toISOString(), groups: heldGroups, cannotCheck: summary.cannotCheck });
      summary.emailed = Boolean(sent?.ok && !sent?.mocked);
    } catch (error) {
      console.error('Rule watcher summary email failed:', error);
      summary.emailed = false;
    }
  }
  return summary;
}

// Rows for /admin/rules: every rule with its base and effective status and when its pages were last checked and changed.
export async function listRulesForAdmin(env, rules = ALL_WATCHED_RULES) {
  await ensureRuleWatcherTables(env);
  const overrides = await getRuleOverrides(env);
  const { results } = await env.DB.prepare('SELECT url, last_checked, last_changed, fail_count, last_error FROM rule_watch_urls').all();
  const byUrl = new Map((results || []).map((r) => [r.url, r]));
  return rules.map((rule) => {
    const ov = overrides[rule.id];
    const pages = [rule.officialUrl, rule.sourceUrl].filter((u, i, a) => u && a.indexOf(u) === i).map((u) => byUrl.get(u)).filter(Boolean);
    const lastChecked = pages.map((p) => p.last_checked).filter(Boolean).sort().pop() || null;
    const lastChanged = pages.map((p) => p.last_changed).filter(Boolean).sort().pop() || null;
    const cannotCheck = pages.some((p) => String(p.last_error || '').startsWith('blocked'));
    return {
      id: rule.id,
      title: rule.title,
      baseStatus: rule.status,
      status: ov?.status === 'held' ? 'held' : rule.status,
      asOf: ov?.status === 'confirmed' && ov.asOf ? ov.asOf : rule.asOf || null,
      officialUrl: rule.officialUrl || null,
      lastChecked,
      lastChanged,
      cannotCheck,
      heldReason: ov?.status === 'held' ? ov.reason || null : null,
      heldAt: ov?.status === 'held' ? ov.heldAt || null : null,
      note: ov?.note || null,
      failCount: Math.max(0, ...pages.map((p) => p.fail_count || 0)),
    };
  });
}

// A static shell. It contains no data and no secret: the owner types the admin secret into the page, which keeps it in memory
// and sends it only as an Authorization header to /admin/rules/data and /admin/rules/action.
export function rulesAdminPageHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Rules</title>
<style>
body{font:14px/1.5 system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#2B2620;background:#FBF7EF}
table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #d9d0c0;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#efe7d6}button{padding:6px 10px;margin:2px;cursor:pointer}.held{background:#fff1d6}input{padding:6px;width:320px}
</style></head><body>
<h1>Leave-by rules</h1>
<p>Enter the admin secret to load the rules. It stays in this page and is sent only as an Authorization header.</p>
<p><input id="secret" type="password" placeholder="admin secret" autocomplete="off"> <button id="load">Load</button> <button id="run">Run the watcher now</button></p>
<div id="msg"></div><table id="t" hidden><thead><tr><th>Rule</th><th>Status</th><th>Checked on</th><th>Last checked</th><th>Last changed</th><th>Held because</th><th></th></tr></thead><tbody></tbody></table>
<script>
(function(){
var msg=document.getElementById('msg'),tb=document.querySelector('#t tbody'),t=document.getElementById('t');
function h(){return {'Authorization':'Bearer '+document.getElementById('secret').value,'Content-Type':'application/json'};}
function say(s){msg.textContent=s;}
function td(tr,txt){var c=document.createElement('td');c.textContent=txt==null?'':txt;tr.appendChild(c);return c;}
function act(id,a){fetch('/admin/rules/action',{method:'POST',headers:h(),body:JSON.stringify({ruleId:id,action:a})}).then(function(r){return r.json();}).then(function(j){say(j.ok?'Done: '+a+' '+id:'Failed: '+(j.error||''));load();});}
function load(){fetch('/admin/rules/data',{headers:h()}).then(function(r){if(r.status===401){say('Wrong secret.');return null;}return r.json();}).then(function(j){
 if(!j||!j.ok)return;tb.textContent='';t.hidden=false;say(j.rules.length+' rules');
 j.rules.forEach(function(r){var tr=document.createElement('tr');if(r.status==='held')tr.className='held';
  td(tr,r.id+' - '+r.title);td(tr,r.status+(r.status!==r.baseStatus?' (base: '+r.baseStatus+')':''));td(tr,r.asOf);td(tr,r.cannotCheck?'Cannot check automatically (the site blocks it). Check by hand.':r.lastChecked);td(tr,r.lastChanged);td(tr,r.heldReason);
  var c=document.createElement('td');
  var b1=document.createElement('button');b1.textContent='Confirm still correct';b1.onclick=function(){act(r.id,'confirm');};c.appendChild(b1);
  var b2=document.createElement('button');b2.textContent='Keep held';b2.onclick=function(){act(r.id,'keep');};c.appendChild(b2);
  tr.appendChild(c);tb.appendChild(tr);});});}
document.getElementById('load').onclick=load;
document.getElementById('run').onclick=function(){fetch('/admin/rules/action',{method:'POST',headers:h(),body:JSON.stringify({action:'run'})}).then(function(r){return r.json();}).then(function(j){say(j.ok?'Run finished: '+JSON.stringify(j.summary):'Failed: '+(j.error||''));load();});};
})();
</script></body></html>`;
}
