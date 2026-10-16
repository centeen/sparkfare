# Leave-by plan (G23): design doc, E2

Written 2026-10-16 for Addendum E (Design Council consult 7, owner decision D-014). **Design only: no code, no flag, no migration.**
Everything ships behind a new flag, `ENABLE_LEAVE_BY_PLAN` (default `"false"` in every environment). Nothing here is user-visible before
Nov 9, and the flag flip is its own PR after the council has seen the real copy (section 9) and the owner approves.

## 0. What was verified, and what was not (read this first)

The addendum says each first-set rule must be verified by opening the official page and quoting the fact with its date. I tried every one
today (2026-10-16). Several official sites refuse automated fetches (HTTP 403) or are JavaScript apps that return only a title. **I did not
write a rule from memory.** Rules I could not open are marked `needs_verification`: they show only the generic "check the official page" line
until someone opens the page in a normal browser and the quote and date are filled in.

| Rule | Official page tried | Result | Status in this design |
|---|---|---|---|
| USPS Hold Mail | usps.com/manage/hold-mail.htm | **Opened.** "a minimum of 3 days and a maximum of 30 days." To hold longer or reroute: "please sign up for a forwarding service." | `active` |
| ETIAS | home-affairs.ec.europa.eu, article "Main differences between the EES and ETIAS" (28 April 2026) | **Opened.** "ETIAS is scheduled to start in the last quarter of 2026." "The exact start date of ETIAS will be officially communicated later this year." (The travel-europe.europa.eu pages returned only a page title.) | `not_yet_required` |
| International Driving Permit | aaa.com/vacation/idpf.html | **Opened.** "AAA issues International Driving Permits only to individuals who hold a valid U.S. driver's license." Fee: "Pay $20 USD permit fee"; online adds a "$10 passport photo fee plus applicable shipping." "International Driving Permits may not be issued more than six (6) months in advance of desired effective date." No validity period stated on that page. No date on the page. | `active` (only these facts) |
| Bali tourist levy | lovebali.baliprov.go.id | **Opened.** Levy "IDR 150,000"; paid through the Love Bali site ("Pay Tourist Levy"); no effective date on the page (a stale "Coming Soon ... February 14th, 2024" banner). | `active` for the levy only |
| Passport processing time | travel.state.gov (processing-times and get-fast pages) | **Not opened: HTTP 403.** A search result summarising those pages said routine 4 to 6 weeks, expedited 2 to 3 weeks, plus mailing time. That is a secondary summary, not a quote. | `needs_verification` |
| Australia ETA | immi.homeaffairs.gov.au, eta.homeaffairs.gov.au | **Not opened: 403 / connection reset.** | `needs_verification` |
| Brazil eVisa | brazil.vfsevisa.com; no official Itamaraty page reached | **Not opened: 403.** Search results were blogs and visa-service sites, which this design must not rely on or link. | `needs_verification` |
| Thailand Digital Arrival Card | tdac.immigration.go.th | **Not opened:** the site returned an empty JavaScript shell. Search found only third-party guides (a three-day window, in effect since 2025-05-01). | `needs_verification` |
| Indonesia arrival declaration | allindonesia.imigrasi.go.id | **Not opened:** title-only JavaScript shell. | `needs_verification` |

**Owner action to finish E2's verification:** open the five `needs_verification` pages in a normal browser, copy the exact sentence and today's
date into the rule file. Until then the plan shows those destinations a single link (section 2.4).

## 1. Rules as data

One file, `src/data/leaveByRules.js`, exports an array. **No rule text lives in a template, an email or a page.** Shape:

```js
{
  id: 'usps-hold-mail',
  appliesWhen: {
    countries: ['*'],            // ISO-3166 alpha-2 list, or '*' for every destination
    tripLengthBuckets: ['4-6', '7-10', '11-14'],   // existing buckets; 'weekend' and '2+ weeks' / '30_plus' as relevant
    answers: { mail: ['no', 'skip'] },              // optional: /leave answers that make the item relevant
  },
  actBy: { kind: 'suggested', daysBefore: 3 },      // see 1.1
  why: 'USPS can hold your mail for 3 to 30 days.',
  officialUrl: 'https://www.usps.com/manage/hold-mail.htm',
  sourceUrl: 'https://www.usps.com/manage/hold-mail.htm',
  asOf: '2026-10-16',                // the date the source was opened
  quote: 'a minimum of 3 days and a maximum of 30 days',   // verbatim, kept for audit, never rendered as advice
  status: 'active',                  // 'active' | 'not_yet_required' | 'needs_verification'
  partner: null,                     // or { slug: 'us-global-mail', whenTripOverDays: 30 }
}
```

### 1.1 `actBy`
- `{ kind: 'sourced', daysBefore | windowDays }` only when the official page states a lead time (for example the IDP "not more than six months in advance" is a **window start**, not a deadline).
- `{ kind: 'suggested', daysBefore }` is a Sparkfare suggestion computed from the person's own date. It is always labelled "Suggested" and never shown as a rule.
- `not_yet_required` and `needs_verification` rules **never** get an act-by date (tested in E3).

### 1.2 Status meanings
- `active`: shown with source, as-of date and the check-the-official-site line.
- `not_yet_required`: shown as one line, "Not required yet; the EU will announce the start date." with the source and as-of date, and no date.
- `needs_verification`: not shown as a rule; the destination gets the generic country line (2.4).

## 2. First rule set

### 2.1 Active rules (verified above)

| id | Applies | Suggested act-by | Why line (draft) | Source |
|---|---|---|---|---|
| `usps-hold-mail` | all; trip 3 to 30 days | 3 days before departure (suggested) | "USPS can hold your mail for 3 to 30 days." | USPS Hold Mail page, opened 2026-10-16 |
| `usps-forwarding` | trip over 30 days | 7 days before (suggested) | "For more than 30 days, USPS points you to a forwarding service." Partner: US Global Mail (live), disclosed. | same page |
| `idp` | only when the person answered "renting a car = yes" | not before 6 months ahead (sourced window); suggested: 3 weeks before | "AAA issues an International Driving Permit to U.S. licence holders. It can't be issued more than six months before the date you want it to start." | AAA IDP page, opened 2026-10-16 |
| `bali-levy` | destination Bali | at or before arrival (suggested: 7 days before) | "Foreign visitors to Bali pay a levy of IDR 150,000, through the Love Bali site." | Love Bali site, opened 2026-10-16 |
| `etias` | Schengen destinations (see 2.3) | none | "Not required yet; the EU will announce the start date." | EC article 28 April 2026, opened 2026-10-16 |

### 2.2 Home items (no external source needed; no promises)
Water shutoff, thermostat, mail, pets, who has a key: plain suggestions from the existing `/leave` copy. They are labelled "Suggestion" and carry no source line because they are not facts about a government or provider. Climate-by-airport-and-month for the thermostat (G28) needs data this repo does not have; the first version says only "Set your thermostat for the season" (open question 4).

### 2.3 Country mapping (new data; derived from the display names, not from any rule)
There is **no destination-to-country mapping in the repo today**. A 40-row table is needed in the rules file, keyed by `sparkfare_destinations.json` display name:
Bali ID; Tokyo JP; Cape Town ZA; Sydney AU; Maldives (Male) MV; Buenos Aires AR; Rio de Janeiro BR; Phuket TH; Ho Chi Minh City VN; Taipei TW; Amalfi Coast IT; Algarve PT; Athens GR; Thessaloniki GR; Larnaca CY; Madrid ES; Dubrovnik HR; Tulum MX; Mallorca ES; San Jose CR; Da Nang VN; Cebu PH; Prague CZ; Budapest HU; Sofia / Borovets BG; Bogota CO; Krakow PL; Bucharest RO; Guatemala City GT; Marrakech MA; Cappadocia TR; Petra JO; Oaxaca MX; Cusco PE; Luxor EG; Tbilisi GE; Baku AZ; Antigua GT; Muscat OM; Lisbon PT.

**ETIAS list needs a check before it is data.** The addendum lists Portugal, Spain, Italy, Greece, Hungary, Czechia, Poland, Croatia, Cyprus, Romania, Bulgaria. I could not open the official country list. I understand ETIAS to apply to Schengen states and Cyprus may not be one; I did not verify that. Cyprus (Larnaca) stays out of the `etias` rule until the official list is read.

### 2.4 Everything else
For a destination whose rule is `needs_verification` or absent: one line, "Entry rules for {country}: see the U.S. State Department's page for {country}." linking to that country's State Department travel page (the page itself, not a search). The URL pattern must be confirmed in a browser (travel.state.gov refused automated access).

## 3. Guest flow (no account)
Runs entirely in the browser: destination (from the deal or chosen), departure date and trip length are entered or read from the page the person came from; the plan renders client-side from the rules data shipped as a static file. **Nothing is stored, no date is in any URL, nothing is sent to the server except the fixed-shape events in section 8.** The `.ics` is generated in the browser (a `Blob`), so the date never leaves the device. Guests who click a fare still create no trip row (unchanged; confirmed in E1).

## 4. Signed-in flow
The plan attaches to a tracked trip. The trip row already has `destination`, `departure_at`, `return_at`; the plan is computed from them on each view, so **no plan is stored**, only which items the person marked done (`trips`-side table `trip_plan_items(trip_id, rule_id, done_at)`, a future migration; no dates in event logs, only the rule id). Trip length comes from `return_at - departure_at` when present, else the user's saved bucket.

## 5. Emails (only with the flag on)
Today: pre-departure sequence at fixed day 14, 7, 1 (one partner each), departing-soon at day 3, briefing at days 6 to 8, stress-valve at 2 to 4 days after the click. With the flag on, each plan item's act-by date **replaces the fixed stage for that item**: a daily job finds items whose suggested date is today and sends one short email per trip per day at most. With the flag off, none of these emails change (tested). The existing delivery-log pattern (`(trip_id, stage)` primary key) extends to `(trip_id, rule_id)`.

## 6. Placement
Shown on: the `/leave` result, the trip card on `/trips`, and the post-click follow-up email. **Never** on the homepage deal board, `/data` route pages, `/flight` route pages or the alert digests.

## 7. Partners (at most one disclosed partner per item)
Only where it does the job: mail forwarding (US Global Mail, trips over 30 days), phone and data (Yesim), airport parking (Parking Access), airport transfer (Welcome Pickups), flight disruption on the return (AirHelp). Each goes through `/out/<slug>?src=leave-by-plan`, so the click is logged with the F0 meter fields. The trip-length bucket is looked up server-side from an opaque trip id (signed-in) or omitted (guest); **never a date, in the URL or the log.** Inline disclosure beside each partner link. No insurance, hotel, car or package item (Step 19, T3).

## 8. Measurement plan
New events (all fixed-shape; no dates, no free text; bot-classified like outbound clicks):
- `away_mode_view` (new; E1 found no `/away-mode` page-view event). Fields: `trip_length_bucket` only when signed in.
- `plan_view`, `plan_complete`, `item_done`: fields `country` (ISO code), `trip_length_bucket`, `rule_id` (for item_done). Never the departure date.
- Partner click: existing `outbound_click` with `source = 'leave-by-plan'`.

Query (D1/SQLite), "partner clicks per 100 plan completions" against "per 100 /away-mode views", by bucket:

```sql
WITH done AS (
  SELECT json_extract(meta,'$.trip_length_bucket') AS bucket, COUNT(*) AS n
  FROM events WHERE event_type = 'plan_complete' AND ts >= :from GROUP BY 1),
plan_clicks AS (
  SELECT json_extract(meta,'$.trip_length_bucket') AS bucket, COUNT(*) AS n
  FROM events WHERE event_type = 'outbound_click' AND source = 'leave-by-plan'
    AND COALESCE(json_extract(meta,'$.ua_class'),'') != 'bot' AND ts >= :from GROUP BY 1),
views AS (
  SELECT json_extract(meta,'$.trip_length_bucket') AS bucket, COUNT(*) AS n
  FROM events WHERE event_type = 'away_mode_view' AND ts >= :from GROUP BY 1),
am_clicks AS (
  SELECT json_extract(meta,'$.trip_length_bucket') AS bucket, COUNT(*) AS n
  FROM events WHERE event_type = 'outbound_click' AND source = 'away_mode'
    AND COALESCE(json_extract(meta,'$.ua_class'),'') != 'bot' AND ts >= :from GROUP BY 1)
SELECT d.bucket,
       100.0 * COALESCE(pc.n,0) / d.n AS plan_clicks_per_100_completions,
       100.0 * COALESCE(ac.n,0) / NULLIF(v.n,0) AS away_clicks_per_100_views
FROM done d
LEFT JOIN plan_clicks pc ON pc.bucket IS d.bucket
LEFT JOIN views v ON v.bucket IS d.bucket
LEFT JOIN am_clicks ac ON ac.bucket IS d.bucket;
```
Limit to know: `/away-mode` links carry no trip id, so guest clicks have a NULL bucket and the by-bucket comparison covers signed-in visitors only; the all-visitors comparison is the un-bucketed total.

### 8.1 Privacy page wording needed (draft, for the council and counsel)
Add to the "Analytics and activity logging" paragraph: "If you use the leave-by plan, we log that you viewed it, how long your trip is (a range such as '7-10 days'), the destination's country, and which checklist items you marked done and whether you finished it. We do not log your dates or any text you type. If you are not signed in, the plan is built in your browser and we do not store it." And if plans attach to signed-in trips: "If you are signed in, your trip's items are saved with the trip so you can come back to them."

## 9. Draft copy (every user-facing string; nothing is in code yet)
Rules: no "book", "secure", urgency, countdown, "X people", "limited time"; no legal or immigration advice; no promises about the home.

- Page title: **Your leave-by plan**
- Intro: "Dates are suggestions worked out from the day you leave. Each item names its source and when we last checked it. Please check the official site before you rely on anything here."
- Input (guests): "Where are you going?" / "When do you leave?" / "How long will you be away?" / button "Make my plan". Note: "Your dates stay on this device. We don't save them."
- Item layout: **{item}**; "Suggested by {date}"; "{why}"; "Source: {source name}, checked {asOf}" with the official link; for sourced windows: "Per the source: {window}".
- ETIAS line: "Not required yet; the EU will announce the start date." Source line as above.
- Country fallback: "Entry rules for {country}: see the U.S. State Department's page for {country}."
- Mail: "Ask USPS to hold your mail" / why "USPS can hold your mail for 3 to 30 days." / over 30 days: "Set up mail forwarding" / "For more than 30 days, USPS points you to a forwarding service. A virtual mailbox is another option." + partner line "US Global Mail (partner link). Sparkfare may earn a commission if you buy through this link, at no extra cost to you."
- Driving permit (only if renting a car): "Get an International Driving Permit" / "AAA issues one to U.S. licence holders. It can't be issued more than six months before the start date you want."
- Water / thermostat / key / pets: reuse today's `/leave` wording ("Find your water shutoff", "Ask someone to check on your home", "Line up care for your pets"); thermostat: "Set your thermostat for the season."
- Phone and data: "Sort your phone and data" / "An eSIM can be set up before you leave." + disclosed Yesim link.
- Calendar button: "Add these to my calendar" (downloads a `.ics`; the file holds the item names and suggested dates and lives only on the person's device).
- Done marker: "Mark done".
- Empty or unknown: "We don't have dated items for this trip yet. Here is the official page for {country}."

## 10. Tests E3 must include
Flag off: no visible change and today's emails byte-identical. No date in any URL, share card, log row or partner sub-ID. Every `active` rule has `officialUrl`, `sourceUrl` and `asOf`. `not_yet_required` and `needs_verification` rules never carry an act-by date. Guest plans write nothing to D1. The referral-copy checker passes. No item mentions insurance, hotels, cars (other than the IDP) or packages.

## 11. Open questions for the owner
1. Open the five `needs_verification` pages (passport, Australia ETA, Brazil eVisa, Thailand TDAC, Indonesia arrival declaration) and confirm the quotes, or tell me to link-only.
2. Cyprus: is it in the ETIAS country list? (Not verified here.)
3. Trip length for the guest form: reuse the existing buckets (weekend, 4-6, 7-10, 11-14, 2+ weeks, 30+) or a number of days?
4. Thermostat/climate (G28) needs a data source; v1 is one generic line. Acceptable?
5. A new `away_mode_view` event is required to measure the comparison; it is one line in the privacy page. OK?
6. Passport timing is the item most users share; it ships only once its page is opened and quoted, or as a link-only line.

## Appendix: what the repo has today (E1 summary)
`trips` has destination, departure, return, origin, price at click, status; trip length and passenger count are on `users`. No destination-to-country mapping exists; `trip.country` is read by the post-click checklist but never set. `/leave` has six questions and builds results from `buildLeaveReadyPlan`; answers are stored for signed-in users only. `/time-off/<origin>.ics` is built server-side (`buildIcs`). The sequence emails use fixed 14/7/1-day stages with a per-trip, per-stage delivery log. There is no `/away-mode` page-view event. Outbound clicks carry the trip-length bucket only when the link carries a trip id.
