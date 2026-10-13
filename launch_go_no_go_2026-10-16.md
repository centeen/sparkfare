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
| `/time-off` PTO planner and `ENABLE_PTO_WATCH` are live; `ENABLE_PTO_FARES` was turned on by #147 on Oct 10 and turned back off on Oct 11 (owner) after a 36% window hit rate; keep it off for launch unless coverage is re-checked. | New Check 11. |
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
| 11 | PTO planner and watches | gate (non-P0) | `/time-off` and `/time-off/<origin>` 200 for all US origins; `ENABLE_PTO_FARES` is **off** (turned off 2026-10-11, #178; live-confirmed on `/time-off/dfw`). | See "Check 11". | |
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
curl -s -o /dev/null -w "%{http_code} /out/bounce\n" https://sparkfare.com/out/bounce
```

Note: the `/out/bounce` request logs one `outbound_click` event. `curl` is classed `bot` (`meta.ua_class`), so
the KPI dashboard leaves it out, but it will appear in raw `events` counts.

**Pass:** 13 (or more) live partners (14 before SafetyWing was removed on 2026-10-13), 0 empty blurbs, `/away-mode` 200, `/out/bounce` 302 to the partner. `/out/safetywing` is covered by Check 2b. Then view `/away-mode` on a
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

- **DMARC is `p=quarantine` (owner, 2026-10-13).** Changed from `p=none`; `rua` reports go to hello@sparkfare.com. The owner opened a Resend
  email and a Clerk email in Gmail ("Show original") and both showed SPF, DKIM and DMARC all PASS. On Oct 16, confirm it is still
  `quarantine` (`nslookup -type=TXT _dmarc.sparkfare.com 8.8.8.8`) and that the digest still passes. Rollback: set it back to `p=none`.
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

**Pass:** 200, 200, 200, 404. Then confirm the fares flag is still **off** (decided 2026-10-11, #178, after the Oct 11
run priced 56 of 800 calls and only 36% of windows had a fare; DFW, BOS, DEN and 7 other origins had none):

```bash
curl -s https://sparkfare.com/time-off/dfw | grep -c "Fares appear here as we see them"   # expect 8
curl -s https://sparkfare.com/time-off/dfw | grep -c "No fare seen yet"                   # expect 0
```

Every window on every origin page should say fares appear as we see them, with no "from $X" lines. An origin page
that shows an error for some windows is not acceptable. The daily PTO fetch keeps running and collecting data with the
flag off, so read `last_run` in `sparkfare_pto_window_prices.json` (priced calls and windows with a fare) before
deciding to turn it back on. Do not turn it on between this call and Oct 19.

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

- [ ] Checks 1, 1b, 2, 2b, 2c, 2d, 2e, 6, 7, 10, 11, 12 run and the result column filled in (2b to 2e were added 2026-10-13 from Addendum A:
      no SafetyWing link; a tagged test signup stores its tag; the analytics beacon is on the main page types; no "real-time", "live prices" or insurance-link copy)
- [ ] **Capacity:** the owner upgraded to Workers Paid ($5 a month) on 2026-10-13 (see the Capacity section). Confirm the Plans page shows Workers Paid
- [ ] Phone QA done by the owner
- [ ] Step 12 verified (alert path and weekly standup, first scheduled send was Mon Oct 12)
- [ ] **Flags that must be OFF at launch are OFF:** `ENABLE_T5B_ADS`, `ENABLE_X_BROADCASTER`,
      `ENABLE_T7B_PUSH`, `ENABLE_PTO_DIGEST_BLOCK`, `ENABLE_PTO_FARES` (off since 2026-10-11, #178),
      `ENABLE_TRIP_SELF_REPORT`. **ON:** `ENABLE_LEAVE_READY` and `ENABLE_ORIGIN_REQUESTS` (both turned on 2026-10-10; check `/leave` returns 200 and the homepage shows "Don't see your airport?"), `SPARKFARE_FREE_TIER_DELAY_HOURS=0` repository variable (same-speed free tier; confirm the latest hourly run is fresh), `ENABLE_PRICE_CHECK` (step 49), `ENABLE_PLUS_WAITLIST` (turned on 2026-10-10; check `/pricing` returns 200 and that a signup sends the confirmation email), `ENABLE_DAILY_DIGEST`, `ENABLE_EMAIL_V2`,
      `ENABLE_DIGEST_SKIP_UNCHANGED`, `ENABLE_DIGEST_ARCHIVE` (only if this PR was merged; then `/digest` returns 200 and the daily email carries a "View in browser" link), `ENABLE_PTO_CALENDAR`, and `ENABLE_PTO_WATCH`. `ENABLE_PINTEREST` is also `"true"` on `main` (admin-only routes behind the admin secret, no public
      surface); the owner confirmed on 2026-10-13 that leaving it on is intended.
      **Also ON (added 2026-10-13):** `ENABLE_METER_TRACKING` (since 10:47 UTC; check an `/out/<partner>` click event carries `meta.meter`) and
      `ENABLE_LONG_LEAVE` (since 14:05 UTC; check `GET /api/long-leave` returns `"enabled":true`, the homepage trip-length select has `30+ days`, and
      `/leave` answered "A month or more" shows the three-item lead with no link on the insurer item). `ENABLE_FARE_ROUTING` stays OFF. Confirm everything against `wrangler.jsonc` on `main`, not against memory.
- [ ] **No copy or wording PRs are queued to merge on Oct 17.** #155, #157 and #173 (a stack, merged in that order) wait for Mon Oct 19 and the owner's
      say-so; nothing else touching live copy lands between this call and Oct 19
- [ ] `ENABLE_DAILY_DIGEST` is `"true"` (the kill switch is only for emergencies)
- [ ] Product Hunt listing, images and first comment are ready (owner). **Scheduled 2026-10-13 (owner):** the Pre-Launch Dashboard showed
      "Scheduled", 3 days 12 h 48 min to launch (Sat Oct 17, 12:01 a.m. PT = 07:01 UTC), first comment written, thumbnail and three gallery
      images uploaded, tagline `Check if a flight price is good, against its own history.`, pricing Free, no promo code, Bootstrapped. Video skipped;
      "Product categories" still open on the dashboard. On Oct 16, open "View launch" and read it as a visitor would.
- [ ] Step 52, the one-time launch-window posts, is scheduled by the owner
- [ ] Anyone watching during launch knows the kill switches: setting `ENABLE_DAILY_DIGEST` to the exact string
      `"false"` in `wrangler.jsonc` and merging (auto-deploys in 1 to 2 minutes) stops the digest send;
      `ENABLE_PTO_WATCH` can be set `"false"` the same way (`ENABLE_PTO_FARES` is already off)

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

## Early walk, Saturday 2026-10-10 18:45 UTC (evidence only; Oct 16 still re-checks everything)

Run against production with the commands in this file. Nothing was changed by it.

| Check | Result on Oct 10 | Verdict |
|---|---|---|
| 1 (P0) original 12 origins | priced routes of 40: JFK 32, EWR 32, LAX 26, ORD 26, SFO 23, MIA 23, BOS 22, DFW 21, IAD 20, ATL 20, SEA 17, IAH 11. Both files' `generated_at` 2026-10-10 09:48 UTC (about 9 hours old). | **Pass.** IAH is still the thin one. |
| 1b newer origins | DEN 2, PHX 0, LAS 0 priced. PHL, MSP, CLT, DTW, FLL, BWI, AUS are not in the served file yet. TLV shows 31 priced, as usual (not marketed). | As expected. The seven should appear after the first same-speed hourly run (started 18:41 UTC today), earlier than the Oct 12 note above, because with `SPARKFARE_FREE_TIER_DELAY_HOURS=0` the hourly workflow compiles the free-tier file itself. |
| 2 (P0) Away Mode | 14 partners, 0 empty blurbs, `/away-mode` 200. (`/out/safetywing` not requested, to avoid an event.) | Pass. |
| 6 events | latest in the last 2 days: `outbound_click` 15:30 today, `alert_email_sent` 08:00 today, `email_open` 08:42 today, plus `pto_view`, `pricing_view`, `check_run`. **No `route_promoted` in 2 days.** | Pass, with a criterion to fix: `route_promoted` only logs the first time a route crosses the threshold, so a quiet stretch is not a failure. Read the criterion as "`route_promoted` rows exist and the cron ran", not "latest within 2 days". |
| 7 deliverability | 7-day counts: 0 bounces, 0 complaints, 7 `alert_email_sent`, 39 `email_open`. One digest sent per day Oct 8, 9, 10 (`daily_alert_deliveries` status `sent`); `digest_sent_snapshots` has a SEA row for Oct 10. No `digest_skipped_unchanged` events yet (one subscriber, never quiet). | Pass. The skip path has not run for real yet. |
| 10 route pages | `/sitemap-routes.xml` 287 URLs, 0 TLV or `undefined`; LAX/Lisbon button is `/?origin=LAX#signup-form`; DEN/Bali (thin) 404; `/data/phl-to-lisbon-portugal` 200. | Pass. |
| 11 PTO planner | `/time-off` 200, `/time-off/jfk` 200, `/time-off/phl` 200, `/time-off/tlv` 404. | Pass. |
| 12 pipelines | Hourly runs succeeded 00:58 (23 min), 07:15 (23 min), 13:49 (33 min); a scheduled run started 18:41 and was still in progress. Daily fetch last scheduled run 2026-10-10 09:46 UTC (a 03:17 slot, 6.5 hours late). Compile ran 09:48 and 16:22. | Pass, with the known lateness. |

Not walked: phone QA (owner), Check 7's Resend dashboard items (webhook event list and delivery log), Check 6's `email_open`
for a *new* digest (needs Oct 11's send).

## Early walk, Tuesday 2026-10-13 08:00 UTC (evidence only; Oct 16 still re-checks everything)

Run against production with the commands in this file and a read-only D1 query run. Nothing was changed. `/out/safetywing`
was not requested, to avoid logging an event.

| Check | Result on Oct 13 | Verdict |
|---|---|---|
| 1 (P0) original 12 origins | priced routes of 40: JFK 32, EWR 32, LAX 26, ORD 25, SFO 24, MIA 24, BOS 21, DFW 20, IAD 20, ATL 19, SEA 19, IAH 13. JFK file generated 2026-10-12 10:45 UTC (about 21 hours old), other-origins file 2026-10-13 04:11 UTC. Deals today: JFK 5, EWR 5, ATL 3, IAD 3, LAX 3, MIA 3, BOS 2, DFW 2, ORD 2, IAH 1, SEA 1, SFO 1. | **Pass.** IAH is still the thinnest, but up from 11. |
| 1b newer origins | All 10 are in the served file. Priced routes of 40: FLL 4, BWI 4, AUS 2, CLT 2, DEN 2, DTW 2, PHX 2, LAS 1, PHL 1, MSP 0. No deals. That is 20 priced routes across 10 origins (about 5%); the 12 original origins have 275 of 480. | As expected for build-up, but **thinner than the Oct 8 note** (52 to 87% `no_data`): the new origins are 90 to 100% `no_data` or `insufficient_history`. The decision on whether to keep the "22 major hubs" line is still the owner's (1b.3). |
| 1b.2 thin-origin view | Selecting MSP, DEN and PHL on the live homepage shows "Building history" sections, no deal badges, no "aren't live yet" and no JFK board. **But** the hero slot on a thin origin still reads "Today's featured destination" with a price and "Prices as of ..." (MSP: Phuket $1,159, 3 history points; PHL: Antigua $451). It is a real current price with no deal claim, but the label is a promotion of an unjudged price. | Honest empty state: **pass**. Hero label on origins with only `insufficient_history` records: **owner call**, not a blocker. |
| 2 (P0) Away Mode | 14 partners, 0 empty blurbs, `/away-mode` 200. | Pass (phone view is the owner's). |
| 6 events | Latest in 3 days: `outbound_click` 07:44 today, `alert_email_sent` 2026-10-12 08:00, `email_open` 2026-10-12 10:59, `deal_suppressed` and `digest_skipped_unchanged` 08:00 today, `pto_view`, `leave_view`, `pricing_view`, `share_click`. `route_promoted` 293 rows, latest 2026-10-12 08:00. | Pass (criterion read as "rows exist and the cron ran", per Oct 10). |
| 7 deliverability | 7-day counts: 0 bounces, 0 complaints, 6 `alert_email_sent`, 38 `email_open`, **2 `digest_skipped_unchanged`**. Today's delivery row for the one verified subscriber is `unchanged`; `digest_sent_snapshots` has a row for SEA on Oct 12. | **Pass.** The skip path has now run for real (it was unobserved on Oct 10). Resend dashboard items not walked. |
| 10 route pages | `/sitemap-routes.xml` 289 URLs, 0 TLV or `undefined`; LAX/Lisbon button `/?origin=LAX#signup-form`; DEN/Bali 404; `/data/phl-to-lisbon-portugal` 200. | Pass. |
| 11 PTO planner | `/time-off` 200, `/time-off/jfk` 200, `/time-off/phl` 200, `/time-off/tlv` 404; `/time-off/dfw` has 8 "Fares appear here as we see them" and 0 "No fare seen yet". | Pass; `ENABLE_PTO_FARES` is off. |
| 12 pipelines | Daily fetch: scheduled runs started 10:43 (Oct 12), 09:56 (Oct 11), 09:46 (Oct 10), all success; today's has not started yet. Hourly: 4 of 4 success, 33 to 34 minutes. Compile: 3 of 3 success. PTO window fetch: 2026-10-12 had a duplicate-fire failure, fixed in #189 (merged 07:40 UTC today); the next scheduled run will be its first test. | Pass, with the known lateness. |
| Flags | `wrangler.jsonc` on `main`: OFF as required: `ENABLE_T5B_ADS`, `ENABLE_X_BROADCASTER`, `ENABLE_T7B_PUSH`, `ENABLE_PTO_DIGEST_BLOCK`, `ENABLE_PTO_FARES`, `ENABLE_TRIP_SELF_REPORT`. ON: `ENABLE_DAILY_DIGEST`, `ENABLE_EMAIL_V2`, `ENABLE_DIGEST_SKIP_UNCHANGED`, `ENABLE_DIGEST_ARCHIVE` (and `_WRITE`), `ENABLE_PRICE_CHECK`, `ENABLE_PLUS_WAITLIST`, `ENABLE_LEAVE_READY`, `ENABLE_ORIGIN_REQUESTS`, `ENABLE_PTO_CALENDAR`, `ENABLE_PTO_WATCH`, `ENABLE_PINTEREST`. Repo variable `SPARKFARE_FREE_TIER_DELAY_HOURS` is `0`. `/leave`, `/pricing`, `/check`, `/digest` all return 200. | Matches the list. `ENABLE_PINTEREST` being on is still to be confirmed as intended. |

**Findings from this walk**
1. **The "Monday" Cron Trigger fires on Sunday.** `wrangler.jsonc` has `0 9 * * 1`, and Cloudflare numbers days with 1 as Sunday. The weekly standup event is dated Sunday 2026-10-11 09:01, not Monday Oct 12, and the weekly link-health check rides the same trigger. Harmless, but the next send lands Sunday Oct 18 at 09:00 UTC, in the middle of launch weekend, and the code comments (`src/index.js` ~line 314) say Monday. Use `0 9 * * 2` if Monday is meant, or fix the comments. Not changed here.
2. **Daily JFK file age.** At 08:00 UTC the JFK file is about 21 hours old (yesterday's 10:45 UTC fetch), so the digest uses yesterday's JFK data again. Known and accepted; the health check limit is 36 hours.
3. **New origins are very thin** (20 priced routes across 10 origins). See 1b above.

Not walked: phone QA (owner), Check 7's Resend dashboard items, and the PTO fetch after #189.

## Check 2b — no SafetyWing link anywhere (D-002, added 2026-10-13)

SafetyWing's referral link was removed until ROADMAP Step 19 is resolved. On Oct 16 confirm: no SafetyWing link on `/away-mode`, on
a destination post (for example `/blog/lisbon-portugal`), or in the follow-up email preview (`node scripts/preview-email.mjs`);
`/out/safetywing` and `/go/safetywing` return 302 to `/away-mode`; `GET /api/partners` has 13 live partners and none is
`safetywing`. Not a P0 by itself, but a visible insurance affiliate link is a legal exposure the owner has already decided against.
```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://sparkfare.com/out/safetywing
curl -s https://sparkfare.com/api/partners | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).partners;console.log(p.length,"partners; safetywing present:",p.some(x=>x.slug==="safetywing"))})'
curl -s https://sparkfare.com/blog/lisbon-portugal | grep -ci "safetywing"
```

## Check 2c — launch-source tags are stored with a signup (Addendum A1, added 2026-10-13)

The launch links carry `utm_source=...&utm_campaign=launch`. PR #163 (merged 2026-10-10 17:43 UTC, `34cc4209`) is what records them. It adds
`/utm.js` (first tag wins for the browser session, kept in `sessionStorage`, no cookie) and the Worker stores the tag in the **signup event's
`meta`** as `{"utm":"<source>_<campaign>"}`. It is **not** a column on `users`, and the separate `check_signup` event does not carry it.

**Observed on production 2026-10-13:** `/utm.js` returns 200 and is loaded by `/` and `/check`. Landing on
`/check?utm_source=test&utm_medium=social&utm_campaign=launch` stored `test_launch`; it persisted to `/`; a second tag
(`?utm_source=other&utm_campaign=second`) did not replace it; a real `/check` alert-form signup with a `+alias` produced a `signup` event with
`meta = {"utm":"test_launch"}` (the `utm_medium` value is ignored by design). The test rows were removed afterwards.

**On Oct 16:** repeat the signup with a `+alias`, then:
```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command "SELECT json_extract(meta,'$.utm') tag, count(*) n FROM events WHERE event_type='signup' GROUP BY 1 ORDER BY n DESC"
```
Remove your test rows in the order: `events` (by `user_id`), `referral_codes`, `consent_log`, then `users`; the foreign keys reject it otherwise.

**Known limit:** only the homepage signup bar and the `/check` alert form send the tag. A visitor who lands on a tagged page and then signs up on
`/leave`, `/time-off`, `/pricing`, `/widget` or a `/data/` page is recorded untagged. A link posted **without** its tag records nothing.

## Check 2d — Cloudflare Web Analytics beacon (Addendum A2, added 2026-10-13)

The beacon is injected by Cloudflare at the edge; there is no script tag in the repo. Check it in a browser, or with a browser-like request, on
`/`, `/check`, `/away-mode`, `/time-off`:
```bash
curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36" -H "Accept: text/html" https://sparkfare.com/check | grep -c "static.cloudflareinsights.com/beacon.min.js"
```
**Observed 2026-10-13:** present on all 8 page types tried (`/`, `/check`, `/away-mode`, `/leave`, `/time-off`, a blog post, a route page, a `/data/` page),
and the browser loaded `/cdn-cgi/rum`. A plain `curl` with no browser headers got none (so a bare grep reports 0: use the header form above). No
checked response sends `Cache-Control: ... no-transform`. The owner confirmed on 2026-10-13 that the dashboard shows about 8 visits in 24 hours.
**Gap, not fixed here:** `privacy.html` does not mention Cloudflare Web Analytics.

## Check 2e — copy claims (Addendum A2, added 2026-10-13)

Run `npm run check:copy` (enforces the banned referral phrases) and read the list below. **Observed 2026-10-13:** no page links insurance (SafetyWing
is gone) and no page claims Sparkfare's data is "real-time" or "live". What a literal search still finds, for the owner to accept or reword:
- "flights booked through our links" in the commission line on all 880 `/data/` pages, and `widget.html`; "services booked through the links below" on four blog posts.
- "Want to book tours or attractions?" (`away-mode.html`), and on `/trips` the subtitle "clicked through to book" and the "Booked" badge.
- "Real-time AI translation earbuds" in the Timekettle blurb is a product feature, not a claim about Sparkfare's data.

## Capacity (Addendum A2, added 2026-10-13)

The Cloudflare plan could **not** be read from `wrangler` (`wrangler whoami` returns the account and token scopes, not the plan). Read it in the
dashboard (Workers & Pages, then Plans or Billing) and write it here: **Workers Paid, $5 a month (see below)**. Worker-routed paths (`/api/*`, `/out/*`,
`/flight/*`, `/check`, `/hub`) counted against the Free plan's 100,000 requests a day; static assets never did.

**Decided and done 2026-10-13 (owner): upgraded from Workers Free to Workers Paid, $5 a month.** Before the upgrade the account was on Free
(100,000 Worker requests a day, 10 ms CPU per request, 5 cron triggers per account). The Workers metrics page for the previous 24 hours showed
**1.05k Worker invocations** (about 1% of the Free cap), 3.61k static asset requests, 0 errors and 0 "exceeded CPU time limit" errors; the
2.28k `sparkfare.local` asset requests are the Worker reading its own data files through its asset binding, not visitors. The upgrade is insurance
against a launch-day spike, not a response to a limit being hit, and nothing in the code depends on the plan. The plan can only be read in the
dashboard (not from `wrangler`), so this is owner-reported. On Oct 16, confirm the Plans page shows Workers Paid. The owner may downgrade after
launch week; if so, the Free cap and CPU limit apply again.

## Early walk, Tuesday 2026-10-13 16:20 UTC (evidence only; Oct 16 still re-checks everything)

Run by Claude at the owner's request with the commands in this file against production. Read-only except one `/out/bounce?src=go_no_go_walk`
click (a bot-classed `outbound_click` event). The tagged-signup round trip for Check 2c was done earlier the same day (16:02 UTC) and not repeated.

| Check | Result on Oct 13 | Verdict |
|---|---|---|
| 1 (P0) original 12 origins | Priced of 40: JFK 32, EWR 32, LAX 26, ORD 25, SFO 24, MIA 24, BOS 21, DFW 20, IAD 20, ATL 19, SEA 19, IAH 13. Deals today: JFK 6, EWR 5, BOS 4, LAX 3, ATL 3, MIA 3, IAD 3, ORD 2, DFW 2, SFO 1, SEA 1, IAH 1. JFK file 5.8 h old, other-origins file 3.9 h old. | **Pass.** None under 10; IAH still thinnest. |
| 1b newer origins | All 10 present in the served file. Priced of 40: FLL 4, BWI 4, DEN 2, PHX 2, CLT 2, DTW 2, AUS 2, LAS 1, PHL 1, MSP 0 (20 in total). No deals. 295 of 880 marketed routes have a price. | As expected for build-up; homepage line kept by owner decision 2026-10-13. |
| 2 (P0) Away Mode | 13 live partners, 0 empty blurbs, `/away-mode` 200, `/out/bounce` 302 to the partner. | **Pass.** |
| 2b SafetyWing | `/out/safetywing` and `/go/safetywing` 302 to `/away-mode`; `/api/partners` has no `safetywing`; 0 mentions on `/away-mode`, `/blog/lisbon-portugal`, `/blog/away-mode-checklist`, `/disclosure`, `/`. | **Pass.** Stale Oct 8 files in the gitignored `tmp/email-previews/` still contain it; they are not generated output (templates are test-covered by `tests/d002_safetywing_removed.test.js`). |
| 2c tags | `/utm.js` 200 and loaded by `/` and `/check`. Round trip verified at 16:02 UTC: `{"utm":"test_launch"}` in the signup event's meta; first touch held. | **Pass.** Only the homepage and `/check` forms send the tag. |
| 2d beacon | Present on `/`, `/check`, `/away-mode`, `/time-off` (and 4 other page types earlier); 0 responses with `no-transform`. A bare `curl` gets none (use browser headers). | **Pass.** `privacy.html` now names it (#211). |
| 2e copy | `npm run check:copy` passes (1012 files). #211 reworded the commission line, My Trips, the Away Mode label and added `/about`. The 880 `/data` pages carry the new commission wording after the next daily compile. | **Pass.** |
| 6 events | Last 2 days, latest: `outbound_click` 16:23 today, `email_open` 16:11 today, `pto_view` 16:23, `leave_*` 15:56, `alert_email_sent` 2026-10-12 08:00, `route_promoted` 2026-10-12 08:00, `digest_skipped_unchanged` 2026-10-13 08:00. | **Pass.** No digest was *sent* on Oct 13: the one verified subscriber had nothing new, so the skip path ran. |
| 7 deliverability | **DB side:** 7-day counts 5 digests sent, 2 skipped, 45 opens, 0 bounces, 0 complaints, 0 suppressed addresses; `digest_sent_snapshots` has rows for SEA only (the only emailed origin). **Not walked:** the Resend dashboard (webhook subscription, 200 deliveries) and the raw headers and SPF/DKIM/DMARC results of a real digest (need an inbox). DMARC is still `p=none` (owner is moving it to `quarantine`; a DNS edit). | **Partly walked**; the two dashboard and inbox items are the owner's. |
| 10 route pages | `sitemap-routes.xml` 289 `<loc>` (265 `/flight/`, 24 other); 0 TLV or `undefined`; LAX route CTA is `/?origin=LAX#signup-form`; DEN to Bali 404; `/data/phl-to-lisbon-portugal` 200. | **Pass.** |
| 11 PTO | `/time-off` 200, `/time-off/jfk` 200, `/time-off/phl` 200, `/time-off/tlv` 404; `/time-off/dfw` has 8 "Fares appear here as we see them" and 0 "No fare seen yet". Last PTO fetch priced 73 of 800 calls. | **Pass**; fares flag off. |
| 12 pipelines | Daily fetch: scheduled runs started 10:30 (Oct 13), 10:43, 09:56, 09:46 (all success; about 7 h after the `17 3` slot). Hourly: 4 of 4 success, each about 33 min; the latest started 11:54 UTC. Compile: 3 of 3 success (latest 10:32). **PTO window fetch:** the first scheduled run after #189 (2026-10-13 12:11 UTC) succeeded with no duplicate fire. | **Pass**, with the known lateness. #189 confirmed live. |
| Flags | OFF as required: `ENABLE_T5B_ADS`, `ENABLE_X_BROADCASTER`, `ENABLE_T7B_PUSH`, `ENABLE_PTO_DIGEST_BLOCK`, `ENABLE_PTO_FARES`, `ENABLE_TRIP_SELF_REPORT`, `ENABLE_FARE_ROUTING`. ON: `ENABLE_METER_TRACKING`, `ENABLE_LONG_LEAVE`, `ENABLE_LEAVE_READY`, `ENABLE_ORIGIN_REQUESTS`, `ENABLE_PRICE_CHECK`, `ENABLE_PLUS_WAITLIST`, `ENABLE_DAILY_DIGEST`, `ENABLE_EMAIL_V2`, `ENABLE_DIGEST_SKIP_UNCHANGED`, `ENABLE_DIGEST_ARCHIVE`, `ENABLE_PTO_CALENDAR`, `ENABLE_PTO_WATCH`, `ENABLE_PINTEREST`; `SPARKFARE_FREE_TIER_DELAY_HOURS=0`. | **Pass.** |

**Not walked, owner:** phone QA (done by the owner 2026-10-13, corrections in #206), the Resend dashboard items, the raw-header check of a real digest,
the Cloudflare plan (Capacity section), and the DMARC DNS edit.

**New since the Oct 10 walk:** Away Mode has 13 live partners (SafetyWing removed, D-002); Long Leave and meter tracking are on; a validated newsletter
subject generator is merged for the Oct 18 send; `/about` exists.

**Update 2026-10-13 (later):** DMARC moved from `p=none` to `p=quarantine` by the owner. Resolvers 8.8.8.8 and 1.1.1.1 both return
`v=DMARC1; p=quarantine; rua=mailto:hello@sparkfare.com;`. A Resend message and a Clerk message each showed DKIM and DMARC PASS in Gmail
("Show original"). This closes the DMARC item in Check 7; the Resend dashboard items there are still the owner's.

**Update 2026-10-13 (evening), Check 7 dashboard items closed by the owner:** the owner walked the Resend dashboard and the digest headers with Claude's
step list and reported **all confirmed**: the webhook `https://sparkfare.com/api/webhooks/resend` is enabled and subscribed to `email.opened`,
`email.bounced` and `email.complained` with recent deliveries returning 200; open tracking is on and click tracking is off; a real digest carries
`List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` with SPF, DKIM and DMARC all PASS. This is **owner-reported**: the webhook
page and the Configuration tab were not shown to Claude (only the domain Records tab, below).

What Claude did observe: the `sparkfare.com` domain page shows **Verified** (DNS verified Sep 28), DKIM, SPF and MX rows Verified, the tracking CNAME
`links` -> `links2.resend-dns.com` Verified, and Receiving off (inbound mail is Cloudflare Email Routing). In DNS, `links.sparkfare.com` resolves to
`links2.resend-dns.com`, and D1 holds 69 `email_open` events (latest 2026-10-13 16:58 UTC), so the pixel and the webhook are working in production.

**Unexplained, harmless:** the dashboard labels the domain's region **Tokyo (ap-northeast-1)** while the live `send` MX points at
`feedback-smtp.us-east-1.amazonses.com`. Every record is Verified and mail passes SPF, DKIM and DMARC, so it was left alone for launch week. Changing a
domain's region means creating a new domain and re-verifying DNS.

**Check 7 status:** closed apart from re-confirming on Oct 16 that the webhook is still enabled and the DMARC record is still `quarantine`.
