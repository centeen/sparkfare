# Launch go/no-go checklist — Friday Oct 16, 2026, 18:00 ET

Launch is **Saturday Oct 17, 12:01 a.m. PT, Product Hunt** (`ROADMAP.md`, Phase 0). The date does not move: a missed
gate cuts scope, not the date. A failing **non-P0** step never blocks launch. A failing **P0** (step 1 or 2)
means launching the JFK-only board with an honest "more airports this week" note.

Written 2026-10-08 from the evidence on file that day. Every "Evidence" cell is last-known, not current: re-run the
check on Oct 16 and write the new result next to it. If a check fails, say so in plain words here before deciding.

**How to use it.** Work top to bottom on Oct 16 afternoon (about 14:00 ET), fill the "Oct 16 result" column, and make
the call at 18:00 ET. Three outcomes: **GO**, **GO with reduced scope** (say which scope), or **NO-GO for a P0 fix**
(there is no date change, so this means the JFK-only fallback below).

## The decision

| # | Criterion | Priority | Evidence on 2026-10-08 | Re-check on Oct 16 | Oct 16 result |
|---|---|---|---|---|---|
| 1 | Deals for all origins | **P0** | Original 12 origins confirmed live. DEN, PHX and LAS were added Oct 7: only 6, 10 and 7 of 40 routes had a price, no deals possible before about Oct 21. | See "Check 1" below. | |
| 2 | Away Mode partner list loads in production and on a phone | **P0** | 14 live partners, no empty blurbs, 375px layout clean (verified Oct 3). | See "Check 2". | |
| 6 | Analytics events (T0) | gate | `events` table accumulating since 2026-09-24. | See "Check 6". | |
| 7 | Email deliverability (T7) | gate | Headers, signed unsubscribe, bounce suppression and complaint suppression all confirmed live (2026-10-08). Only DMARC `p=none` is open. | See "Check 7". | |
| 10 | Route pages: real data or noindex (T5) | gate | 264 URLs in `/sitemap-routes.xml` (258 on Oct 3), thin routes 404. Route-page "Get Deal Alerts" button fixed (PRs #94, #95), confirmed live 2026-10-08. | See "Check 10". | |
| — | Full phone QA pass | gate | Headless 375x812 pass on 2026-10-08: no horizontal overflow or console errors on `/`, `/away-mode`, `/check`, a route page, `/data/`, `/hub`, `/blog/`, `/sign-in`. | **Owner on a real phone.** See "Phone QA". | |

Also confirm before the call: step 12 (revenue health monitor) is verified, and step 49 (`/check`) is still live.
Neither blocks launch, but a silent failure in either is easier to fix before a traffic spike.

## Check 1 — deals for every origin (P0)

1. Open the live site, pick each origin in the dropdown, and note how many cards show a real price.
2. From the repo, count priced routes per origin in the live files (no credentials needed):

```bash
curl -s "https://sparkfare.com/sparkfare_ranked_deals_other_origins.json?x=$(date +%s)" -o _oo.tmp
curl -s "https://sparkfare.com/sparkfare_ranked_deals.json?x=$(date +%s)" -o _jfk.tmp
python - <<'EOF'
import json, collections
for f in ('_jfk.tmp', '_oo.tmp'):
    d = json.load(open(f, encoding='utf-8'))
    print(f, 'generated_at', d.get('generated_at'))
    c = collections.defaultdict(collections.Counter)
    for k, v in d.items():
        if isinstance(v, list):
            for r in v:
                if isinstance(r, dict): c[r.get('origin')][r.get('status')] += 1
    for o in sorted(c): print(' ', o, dict(c[o]))
EOF
rm -f _oo.tmp _jfk.tmp
```

3. **Pass:** every marketed origin shows real prices wherever the data supports it, and both files' `generated_at`
   is within about 36 hours (daily) of now. **Judgement call:** DEN, PHX and LAS are expected to be thin and to show
   no deals until about Oct 21. That is acceptable only if the homepage does not promise more than it delivers
   (see below).
4. **Homepage line.** It currently reads "Tracking prices for 600 routes from 15 major hubs." It is true as a count
   of routes tracked. If DEN/PHX/LAS still price fewer than about 20 routes each on Oct 16, either soften the line
   (tests in `tests/homepage_hub_count.test.js` tie it to the data and must change with it), or drop the origin.
   This is the owner's decision; record it in `state_DECISION_LOG.md`.
5. **Fallback if this P0 fails:** launch the JFK-only board with a "more airports this week" note.

## Check 2 — Away Mode (P0)

```bash
curl -s https://sparkfare.com/api/partners | python -c "import json,sys; d=json.load(sys.stdin); p=d if isinstance(d,list) else d.get('partners',d); print(len(p),'partners; empty blurbs:',sum(1 for x in p if not (x.get('blurb') or '').strip()))"
curl -s -o /dev/null -w "%{http_code} away-mode\n" https://sparkfare.com/away-mode
curl -s -o /dev/null -w "%{http_code} /out/safetywing\n" https://sparkfare.com/out/safetywing
```

Note: the `/out/safetywing` request logs one `outbound_click` event. `curl` is classed `bot` (`meta.ua_class`), so
the KPI dashboard leaves it out, but it will appear in raw `events` counts.

**Pass:** 14 (or more) live partners, 0 empty blurbs, `/away-mode` 200, `/out/safetywing` 302. Then view `/away-mode` on a
real phone: partner cards stack, nothing overflows sideways. Note the footprint of any partner whose link status
changed since Oct 8.

## Check 6 — analytics events

Run against production D1 (read-only; this runs `wrangler` with your Cloudflare login):

```bash
node node_modules/wrangler/bin/wrangler.js d1 execute sparkfare-db --remote --command "SELECT event_type, count(*) n, max(ts) latest FROM events WHERE ts > datetime('now','-2 days') GROUP BY event_type ORDER BY n DESC"
```

**Pass:** `outbound_click`, `route_promoted` and `alert_email_sent` all have a `latest` within the last day or two.
(`wrangler d1 execute --command` accepts one statement per call.)

## Check 7 — email deliverability

- Resend → Webhooks → `https://sparkfare.com/api/webhooks/resend`: Enabled, listening for `email.opened`,
  `email.bounced`, `email.complained`, recent deliveries `200`.
- The most recent scheduled digest (08:00 UTC) arrived in the **Inbox**, with `List-Unsubscribe` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` in the raw headers and SPF, DKIM, DMARC all `pass`.
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
```

**Pass:** the sitemap lists a few hundred URLs and no TLV or `undefined` entries; a non-JFK route page's button is
`/?origin=<ORIGIN>#signup-form` and **never** `/departing/...`; a route with no real data returns 404 and not an empty
page.

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
7. Product Hunt: open the listing page on the phone, check the images and links, and check the "view on" links go
   where the copy says.

Known small issues, **not** blockers: nav links on content pages are about 22px tall (small tap targets); the route
page's "Get Deal Alerts" button is gold while the site rule reserves gold for deal signals (a design call).

## Before the call (Oct 16, 14:00–17:00 ET)

- [ ] Checks 1, 2, 6, 7, 10 run and the result column filled in
- [ ] Phone QA done by the owner
- [ ] Step 12 verified (alert path and weekly standup, first scheduled send was Mon Oct 12)
- [ ] `ENABLE_*` flags that must be OFF at launch are OFF; `ENABLE_PRICE_CHECK` is ON (step 49)
- [ ] `ENABLE_DAILY_DIGEST` is `"true"` (the kill switch is only for emergencies)
- [ ] Product Hunt listing, images and first comment are ready (owner)
- [ ] Step 52, the one-time launch-window posts, is scheduled by the owner
- [ ] Anyone watching during launch knows the kill switch: setting `ENABLE_DAILY_DIGEST` to the exact string
      `"false"` in `wrangler.jsonc` and merging (auto-deploys in 1 to 2 minutes) stops the digest send

## Launch weekend watch list (Oct 17–18)

- **Email breaker.** A signup surge brings the first real bounces. At under 100 weekly sends, 10 bounces or 3
  complaints pause all guarded email until the 7-day window clears. Check the bounce/complaint counts (Check 7)
  Saturday and Sunday evening.
- **Signup abuse.** Watch for a burst of signups from one source; confirm real verification emails still send.
- **Daily fetch freshness.** The daily fetch moved to `17 3 * * *`; confirm it still starts on time and the 07:10
  compile and 08:00 digest used same-day data. The 08:00 UTC health check emails `hello@sparkfare.com` if a data
  file is stale.
- **Route pages.** A burst of traffic to `/flight/*` should not 5xx; the Worker template smoke test covers every
  HTML route but not load.
- **A deal claim that turns out wrong.** If any public claim is found wrong or unbookable, suspend the relevant flag
  and review the `dealQuality` thresholds (step 5), per the roadmap's decision gates.

## Record the call

Write the decision, who made it, the time, and any reduced scope in `state_DECISION_LOG.md` as a dated `DECISION`
entry, and update `ROADMAP.md` Phase 0 in the same commit.
