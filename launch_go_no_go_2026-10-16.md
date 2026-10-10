# Launch go/no-go checklist — Friday Oct 16, 2026, 18:00 ET

Launch is **Saturday Oct 17, 12:01 a.m. PT, Product Hunt** (`ROADMAP.md`, Phase 0). The date does not move: a missed
gate cuts scope, not the date. A failing **non-P0** step never blocks launch. A failing **P0** (step 1 or 2)
means launching the JFK-only board with an honest "more airports this week" note.

Written 2026-10-08, **refreshed 2026-10-10** against what changed since (see "What changed since Oct 8" below). Every
"Evidence" cell is last-known, not current: re-run the check on Oct 16 and write the new result next to it. If a
check fails, say so in plain words here before deciding.

**How to use it.** Work top to bottom on Oct 16 afternoon (about 14:00 ET), fill the "Oct 16 result" column, and make
the call at 18:00 ET. Three outcomes: **GO**, **GO with reduced scope** (say which scope), or **NO-GO for a P0 fix**
(there is no date change, so this means the JFK-only fallback below).

## What changed since Oct 8 (so the old evidence is not trusted)

| Change | Why it matters on Oct 16 |
|---|---|
| **Origins grew from 12 to 22 US origins (plus TLV)**: DEN, PHX, LAS (Oct 7); PHL, MSP, CLT (#148) and DTW, FLL, BWI, AUS (#150) on Oct 10. Homepage line is now "880 routes from 22 major hubs." | Check 1 now has two tiers: the **original 12** (P0) and the **10 newer origins** (thin by design; they only start appearing in the served data at the 07:10 UTC compile on Oct 12 and cannot show a deal for 14+ days). |
| Hourly fetch is now 23 origins x 40 = 920 requests, about 33 minutes a run (60-minute timeout, concurrency group). | New Check 12. |
| `/time-off` PTO planner and `ENABLE_PTO_WATCH` are live; `ENABLE_PTO_FARES` is off pending [#147](https://github.com/centeen/sparkfare/pull/147) (planned Oct 12). | New Check 11. |
| Daily digest v2 and skip-if-unchanged are ON (since Oct 9). | Check 7 gains skip and snapshot checks. |
| Referral wording work ("Fare data retrieved", neutral "View fare") is in **draft PRs #155 and #157**, deliberately **not** merged before launch. | The live site still says "Prices as of" and "View fare on Aviasales" in some places. That is expected; do not merge on Oct 16 or 17. |
| `.bak` history backups no longer public (#156). `/pricing` waitlist exists but its flag is off. Fare Search (White Label) is **proposed only**: nothing about it is live. | Nothing to check, but confirm the waitlist flag is still off (list below). |

## The decision

| # | Criterion | Priority | Evidence on 2026-10-10 | Re-check on Oct 16 | Oct 16 result |
|---|---|---|---|---|---|
| 1 | Deals for the **original 12 origins** (JFK, LAX, ORD, ATL, DFW, SFO, MIA, IAD, EWR, SEA, IAH, BOS) | **P0** | Priced routes of 40: JFK 32, EWR 32, ORD 26, LAX 26, SFO 23, MIA 23, BOS 22, DFW 21, IAD 20, ATL 20, SEA 17, IAH 11. Files generated 2026-10-10 09:48 UTC. | See "Check 1". | |
| 1b | The 10 **newer** origins (DEN, PHX, LAS, PHL, MSP, CLT, DTW, FLL, BWI, AUS) | gate (honesty, not P0) | DEN 2, PHX 0, LAS 0 priced; the seven added Oct 10 are not in the served file yet (appear Oct 12). The homepage line already says new routes are marked "Building history". | See "Check 1b". | |
| 2 | Away Mode partner list loads in production and on a phone | **P0** | 14 live partners, 0 empty blurbs (checked 2026-10-10); 375px layout clean (Oct 3). | See "Check 2". | |
| 6 | Analytics events (T0) | gate | `events` accumulating since 2026-09-24; open events recorded since the 2026-09-26 webhook fix. | See "Check 6". | |
| 7 | Email deliverability (T7) | gate | Headers, signed unsubscribe, bounce and complaint suppression confirmed (2026-10-08). 2026-10-10 08:00 digest: 1 sent, snapshot written, opens recorded. DMARC `p=none` open. | See "Check 7". | |
| 10 | Route pages: real data or noindex (T5) | gate | 287 URLs in `/sitemap-routes.xml` (264 on Oct 8), 0 TLV or `undefined`. | See "Check 10". | |
| 11 | PTO planner and watches | gate (non-P0) | `/time-off` and `/time-off/<origin>` 200 for all US origins; fares flag off. | See "Check 11". | |
| 12 | Data pipelines on time | gate | Hourly runs every 4 to 7 hours (cron `23 * * * *`, GitHub delays), 33 minutes at 23 origins (2026-10-10). Daily fetch started 7 to 10 hours late for 14 days (2026-10-09). | See "Check 12". | |
| — | Full phone QA pass | gate | Headless 375x812 on 2026-10-08 and 2026-10-09: no horizontal overflow or console errors on the main pages. | **Owner on a real phone.** See "Phone QA". | |

Also confirm before the call: step 12 (revenue health monitor) is verified, and step 49 (`/check`) is still live.
Neither blocks launch, but a silent failure in either is easier to fix before a traffic spike.

## Check 1 — deals for the original 12 origins (P0)

1. Open the live site, pick each of the 12 origins in the dropdown, and note how many cards show a real price.
2. From the repo, count priced routes per origin in the live files (no credentials needed; Python is not needed,
   Node is fine):

```bash
node -e '
const https=require("https");const get=u=>new Promise((res,rej)=>https.get(u+"?x="+Date.now(),r=>{let s="";r.on("data",d=>s+=d).on("end",()=>res(JSON.parse(s)))}).on("error",rej));
(async()=>{const out={};
for(const u of ["https://sparkfare.com/sparkfare_ranked_deals.json","https://sparkfare.com/sparkfare_ranked_deals_other_origins.json"]){
 const d=await get(u);console.log(u.split("/").pop(),"generated_at",d.generated_at);
 for(const [k,v] of Object.entries(d))if(Array.isArray(v))for(const r of v){const o=r.origin||"JFK";const c=out[o]=out[o]||{priced:0,deal:0,total:0};c.total++;
  if(r.price>0&&r.status!=="no_data"&&r.status!=="insufficient_history")c.priced++;if(r.status==="deal")c.deal++}}
for(const [o,c] of Object.entries(out).sort())console.log(o.padEnd(4),"priced",c.priced+"/"+c.total,c.deal?"deals "+c.deal:"")})()'
```

3. **Pass:** each of the **original 12** shows at least about 10 priced routes, and both files' `generated_at` is within
   about 36 hours of now. IAH (11 on Oct 10) is the thinnest and the one to watch: Travelpayouts' cache is thin for
   it. If an original origin falls below that, that is a P0 judgement call: say so here and decide between a note on
   that origin and the JFK-only fallback.
4. **Fallback if this P0 fails:** launch the JFK-only board with a "more airports this week" note.

## Check 1b — the 10 newer origins (honesty, not P0)

DEN, PHX, LAS, PHL, MSP, CLT, DTW, FLL, BWI and AUS are expected to be thin. In their first days, DEN, LAS and PHX
already return nothing for 78 to 85% of routes (a Travelpayouts cache gap, not an error); the other seven showed
about 52 to 87% `no_data` in their first snapshot (BWI and FLL best).

1. Run the Check 1 script and confirm all 10 appear in the served file (the 07:10 UTC compile on Oct 12 is when the
   seven new ones first show up). **If PHL, MSP, CLT, DTW, FLL, BWI or AUS are still absent on Oct 16**, the compile
   or hourly run is failing: look at Check 12 before anything else.
2. Selecting a thin origin must show the honest empty state ("aren't live yet" or "Building history"), never JFK's
   board, and no deal badge.
3. **Homepage line.** It reads "Tracking prices for 880 routes from 22 major hubs. New routes are marked Building
   history until there is enough data to judge a deal." It is true as a count and states the caveat. If the owner
   would rather not say 22 hubs with this many thin ones, the line and `tests/homepage_hub_count.test.js` change
   together (the test derives the number from the fetch workflow, so only the sentence needs editing). Record the
   decision in `state_DECISION_LOG.md`.
4. **Not a blocker.** The decision about removing a weak origin is the origins Task C report (about Oct 13), not
   this call.

## Check 2 — Away Mode (P0)

```bash
curl -s https://sparkfare.com/api/partners | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);const p=Array.isArray(d)?d:(d.partners||d);console.log(p.length,"partners; empty blurbs:",p.filter(x=>!(x.blurb||"").trim()).length)})'
curl -s -o /dev/null -w "%{http_code} away-mode\n" https://sparkfare.com/away-mode
curl -s -o /dev/null -w "%{http_code} /out/safetywing\n" https://sparkfare.com/out/safetywing
```

Note: the `/out/safetywing` request logs one `outbound_click` event. `curl` is classed `bot` (`meta.ua_class`), so
the KPI dashboard leaves it out, but it will appear in raw `events` counts.

**Pass:** 14 (or more) live partners, 0 empty blurbs, `/away-mode` 200, `/out/safetywing` 302. Then view `/away-mode` on a
real phone: partner cards stack, nothing overflows sideways. Note any partner whose link status changed since Oct 10.

## Check 6 — analytics events

Run against production D1 (read-only; this runs `wrangler` with your Cloudflare login; on this machine use
`node node_modules/wrangler/bin/wrangler.js`, and if you get Cloudflare error 7403, simply retry):

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command "SELECT event_type, count(*) n, max(ts) latest FROM events WHERE ts > datetime('now','-2 days') GROUP BY event_type ORDER BY n DESC"
```

**Pass:** `outbound_click`, `route_promoted` and `alert_email_sent` all have a `latest` within the last day or two,
and `email_open` appears once the digest has been opened.
(`wrangler d1 execute --command` accepts one statement per call.)

## Check 7 — email deliverability

- Resend → Webhooks → `https://sparkfare.com/api/webhooks/resend`: Enabled, listening for `email.opened`,
  `email.bounced`, `email.complained`, recent deliveries `200`.
- The most recent scheduled digest (08:00 UTC) arrived in the **Inbox**, with `List-Unsubscribe` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` in the raw headers and SPF, DKIM, DMARC all `pass`. Since Oct 9
  it is the **v2** template (change-led subject, NEW / PRICE DROP / STILL AVAILABLE chips).
- **Skip-if-unchanged:** a subscriber with nothing new or cheaper for their origin is skipped for the day (at most 4
  quiet days). Confirm the mechanism is healthy: a `digest_skipped_unchanged` event exists after a quiet day, and
  `digest_sent_snapshots` has a row for each origin that was emailed. A skip is **not** a failure. If subscribers
  report "no email today", this is the first place to look.
- The sending circuit breaker is **not** tripped: it blocks all guarded email (verification, digests, lifecycle)
  once the 7-day count reaches 10 bounces or 3 complaints while under 100 sends, or bounce rate above 5% or complaint
  rate above 0.3% at 100 sends or more. Check the counts:

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command "SELECT event_type, count(*) n FROM events WHERE event_type IN ('email_bounce','email_complaint','alert_email_sent') AND ts > datetime('now','-7 days') GROUP BY event_type"
```

- **Open, not a blocker:** DMARC is `p=none`. Decide whether to tighten to `quarantine` after launch, once volume is
  stable.
- If you run any live bounce or complaint test, **delete the `email_bounce` / `email_complaint` events it creates**,
  or they count against real sending for 7 days. Delete the child rows before the user (`events.user_id` is a foreign
  key to `users`).

## Check 10 — route pages

```bash
curl -s "https://sparkfare.com/sitemap-routes.xml" | grep -c "<loc>"
curl -s "https://sparkfare.com/flight/LAX/Lisbon%2C%20Portugal" | grep -o 'href="[^"]*" class="cta"'
curl -s -o /dev/null -w "%{http_code} thin route\n" "https://sparkfare.com/flight/DEN/Bali%2C%20Indonesia"
curl -s -o /dev/null -w "%{http_code} new-origin pSEO page\n" "https://sparkfare.com/data/phl-to-lisbon-portugal"
```

**Pass:** the sitemap lists a few hundred URLs and no TLV or `undefined` entries; a non-JFK route page's button is
`/?origin=<ORIGIN>#signup-form` and **never** `/departing/...`; a route with no real data returns 404 and not an empty
page; a `/data/` page for a new origin returns 200 (the 880-page set was published Oct 10; a missing page would be
the #148-style gap, which `tests/sitemap_data_pages.test.js` now guards).

## Check 11 — PTO planner (non-P0)

```bash
curl -s -o /dev/null -w "%{http_code} /time-off\n" https://sparkfare.com/time-off
curl -s -o /dev/null -w "%{http_code} /time-off/jfk\n" https://sparkfare.com/time-off/jfk
curl -s -o /dev/null -w "%{http_code} /time-off/phl\n" https://sparkfare.com/time-off/phl
curl -s -o /dev/null -w "%{http_code} TLV (must be 404)\n" https://sparkfare.com/time-off/tlv
```

**Pass:** 200, 200, 200, 404. Then check the fares flag state matches what you decided: if [#147](https://github.com/centeen/sparkfare/pull/147)
was merged on Oct 12, `/time-off/jfk` shows "from $X, <dates>, seen <date>" lines and "No fare seen yet" on the rest;
if it was not, the windows say fares appear as we see them. Either is acceptable; **an origin page that shows fares
for some windows and an error for others is not.** DFW, BOS, DEN and LAS had no window fares on Oct 10, so their
pages will say "No fare seen yet" everywhere: that is the honest state, not a bug.

## Check 12 — data pipelines on time

```bash
gh run list --workflow daily-fetch.yml --limit 5 --json event,conclusion,createdAt -q '.[]|[.event,.conclusion,.createdAt]|@tsv'
gh run list --workflow hourly-multi-origin-fetch.yml --limit 4 --json conclusion,createdAt,updatedAt -q '.[]|[.conclusion,.createdAt,.updatedAt]|@tsv'
gh run list --workflow daily-compile-other-origins.yml --limit 3 --json conclusion,createdAt -q '.[]|[.conclusion,.createdAt]|@tsv'
```

**Pass:** every recent run `success`; an hourly run finished in under about 40 minutes (33 on Oct 10; the timeout
is 60); the daily fetch's last run is from the past ~30 hours. The daily fetch has started 7 to 10 hours after its
`17 3` slot (GitHub scheduling), so "08:00 digest on the previous day's JFK data" is possible on a bad day; the
08:00 UTC health check emails `hello@sparkfare.com` if a file is stale. The Cloudflare-triggered dispatch (`30 3`) has
**not** been observed firing; it is a backup, not something to rely on.

## Phone QA — owner, real phone

Headless checks cannot see a keyboard covering a field, a sticky bar, or a slow connection. Walk this on a real phone
over mobile data, not Wi-Fi, and write down anything awkward:

1. Homepage: the hero deal and the signup bar are reachable without hunting. Tap "More" on a card; tap a fare link
   ("View fare") and confirm it opens in a new tab.
2. Sign up for alerts with a real email. The verification email arrives (check Promotions) and the link works.
3. A route page (for example `/flight/JFK/Larnaca%2C%20Cyprus`): tap "Get Deal Alerts", confirm you land on the signup
   form with your airport already chosen.
4. `/check`: enter a price on a real route and read the answer.
5. `/away-mode`: open the partner list, tap one partner link.
6. Sign in and out; open `/account` and `/trips`.
7. **`/time-off/<your airport>`:** the plan appears near the top, the holiday boxes are collapsed, tapping a
   destination link opens its route page, and the email field takes a keyboard without covering the button.
8. **Pick a thin origin** (for example DEN or one of the new ones) in the homepage dropdown and read what a visitor
   sees: it should say plainly that there is not enough data yet, not look broken.
9. Product Hunt: open the listing page on the phone, check the images and links, and check the "view on" links go
   where the copy says.

Known small issues, **not** blockers: nav links on content pages are about 22px tall (small tap targets); the route
page's "Get Deal Alerts" button is gold while the site rule reserves gold for deal signals (a design call).

## Before the call (Oct 16, 14:00–17:00 ET)

- [ ] Checks 1, 1b, 2, 6, 7, 10, 11, 12 run and the result column filled in
- [ ] Phone QA done by the owner
- [ ] Step 12 verified (alert path and weekly standup, first scheduled send was Mon Oct 12)
- [ ] **Flags that must be OFF at launch are OFF:** `ENABLE_T5B_ADS`, `ENABLE_X_BROADCASTER`,
      `ENABLE_T7B_PUSH`, `ENABLE_PTO_DIGEST_BLOCK`, `ENABLE_LEAVE_READY`,
      `ENABLE_TRIP_SELF_REPORT`. **ON:** `ENABLE_PRICE_CHECK` (step 49), `ENABLE_PLUS_WAITLIST` (turned on 2026-10-10; check `/pricing` returns 200 and that a signup sends the confirmation email), `ENABLE_DAILY_DIGEST`, `ENABLE_EMAIL_V2`,
      `ENABLE_DIGEST_SKIP_UNCHANGED`, `ENABLE_DIGEST_ARCHIVE` (only if this PR was merged; then `/digest` returns 200 and the daily email carries a "View in browser" link), `ENABLE_PTO_CALENDAR`, `ENABLE_PTO_WATCH`, and `ENABLE_PTO_FARES` only if #147 was
      merged. `ENABLE_PINTEREST` is also `"true"` on `main` (admin-only routes behind the admin secret, no public
      surface); confirm that is intended. Confirm everything against `wrangler.jsonc` on `main`, not against memory.
- [ ] **No copy or wording PRs are queued to merge on Oct 17.** #155 and #157 wait for Mon Oct 19 and the owner's
      say-so; nothing else touching live copy lands between this call and Oct 19
- [ ] `ENABLE_DAILY_DIGEST` is `"true"` (the kill switch is only for emergencies)
- [ ] Product Hunt listing, images and first comment are ready (owner)
- [ ] Step 52, the one-time launch-window posts, is scheduled by the owner
- [ ] Anyone watching during launch knows the kill switches: setting `ENABLE_DAILY_DIGEST` to the exact string
      `"false"` in `wrangler.jsonc` and merging (auto-deploys in 1 to 2 minutes) stops the digest send;
      `ENABLE_PTO_FARES` and `ENABLE_PTO_WATCH` can be set `"false"` the same way

## Merge rules over the launch window

- **Before the Oct 16 18:00 call:** only work behind a flag that defaults to off may merge (the 2026-10-09 owner rule).
- **Oct 16 18:00 ET to Oct 18:** nothing merges, except a fix for a P0 or a flag set to its safe value.
- **From Mon Oct 19:** merges resume; live copy (#155, then #157) goes one at a time with the owner's approval.
- Cloudflare auto-deploys `main` on every merge, so "merge" means "ship to production in about a minute".

## Launch weekend watch list (Oct 17–18)

- **Email breaker.** A signup surge brings the first real bounces. At under 100 weekly sends, 10 bounces or 3
  complaints pause all guarded email until the 7-day window clears. Check the bounce/complaint counts (Check 7)
  Saturday and Sunday evening.
- **Signup abuse.** Watch for a burst of signups from one source; confirm real verification emails still send.
- **Data freshness.** Confirm the daily fetch started within its usual delay, the 07:10 compile ran, and the 08:00
  digest used same-day data. The 08:00 UTC health check emails `hello@sparkfare.com` if a data file is stale.
- **Hourly run length.** A run that creeps toward the 60-minute timeout (33 minutes at 23 origins) means a slow
  Travelpayouts response; the concurrency group will queue the next run, not cancel it.
- **Route and `/data/` pages.** A burst of traffic to `/flight/*` and `/data/*` should not 5xx; the Worker template
  smoke test covers every HTML route but not load.
- **PTO planner.** `pto_view`, `pto_signup` and `pto_watch_create` events and watch emails (first alerts only go out
  for windows that have a fare).
- **A deal claim that turns out wrong.** If any public claim is found wrong or unbookable, suspend the relevant flag
  and review the `dealQuality` thresholds (step 5), per the roadmap's decision gates. Known: the "Prices as of" time
  is the fetch time, not the fare's observation time (decision log, 2026-10-10); a fare shown as a deal can already
  be gone from Aviasales. That is documented, accepted for launch, and fixed by #155 after Oct 19.

## Record the call

Write the decision, who made it, the time, and any reduced scope in `state_DECISION_LOG.md` as a dated `DECISION`
entry, and update `ROADMAP.md` Phase 0 in the same commit.
