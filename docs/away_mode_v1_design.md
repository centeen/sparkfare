# Away Mode plan v1: design doc (Addendum G, task G1)

Written 2026-10-16. **Design only: no code, no flag change, no migration.** It replaces Addendum E's E2 and E3. Stop here and wait for the owner;
nothing in G2 to G9 starts before the owner approves this doc.

## 0. Read this first

1. **The plan file is missing.** The addendum says to read `claude/away_mode_plan_v1_2026-10-16.md` first. It is not in the repo (not on `main`, not on any
   branch; `claude/` holds only `g19_drafts/`). Section 5.7 of that plan (tone) and section 4 (the exact inputs) were therefore not available. I used the
   addendum's own tone and banned-word rules and its four-answer input list. **Please add the file, or tell me the differences, before the council reviews section 6.**
2. **Most of the State Department could not be opened.** `travel.state.gov` answers every request, including from a real browser, with a Cloudflare "Just a moment /
   verifying you are not a bot" page that did not clear after 6 seconds. I did not try to get past it. So **no passport-validity rule and no passport-processing
   time is verified.** Per the addendum those are `held` and show "Check the State Department page for <country>". This blocks the useful half of G5 (section 3.1).
3. **Rules from memory: none.** Every rule below was read on the official page on **2026-10-16** in a browser, with the quote shown. Where a page did not say
   something, the rule says less.
4. **A rule that is already merged is wrong or unverified.** PR #259 (`src/data/leaveByRules.js`) states the Bali levy as "IDR 150,000". Today the Love Bali
   homepage shows no amount, so I cannot confirm it (section 3.2, `bali-levy`). G3 should drop the amount until it is read on an official page.

## 1. E1 findings carried forward

From Addendum E1 (`docs/leave_by_plan_design.md`, Appendix) plus what PRs #259 and #260 changed:
- `trips` has destination, departure, return, origin, price at click, status. Trip length (bucket) and passenger count live on `users`, not on `trips`.
- **Destination to country:** a 40-row map now exists (`DESTINATION_COUNTRY_MAP` in `src/data/leaveByRules.js`, merged in #259; all 40 display names map). `trip.country` is read by the
  post-click checklist but is still never set on a trip.
- **Rules module:** `LEAVE_BY_RULES` (15 rules) with `appliesWhen`, `actBy`, `why`, `officialUrl`, `sourceUrl`, `asOf`, `status`, `partner`: already close to this addendum's shape.
  Differences to close in G3: the status value `needs_verification` becomes `held`; `not_yet_required` stays; `quote` stays (it is what proves a rule was read).
- **API:** `POST /api/leave-by-plan` and `/api/leave-by-plan/ics`, 404 while `ENABLE_LEAVE_BY_PLAN` is `"false"`, logging a `plan_view` event with country and bucket only. No page calls it yet.
- `/leave` has six questions and builds results with `buildLeaveReadyPlan`; answers are stored for signed-in users only (`leave_answers`, migration 0017).
- **`.ics`:** `buildLeaveByIcs` (new, #259) and the older server-side `buildIcs` for `/time-off`.
- **Emails:** the post-click sequence uses fixed 14/7/1-day stages with a per-trip, per-stage delivery log (`sendPreDepartureSequenceEmail`). `sendEmailWithGuard()` adds suppression and `List-Unsubscribe` to every guarded send.
- **Events:** `events` table with `/api/events` accepting a fixed allowlist of event names and meta shapes; outbound clicks carry the trip-length bucket only when the link carries a trip id; `ua_class` marks bots.
- **Privacy page:** its "Analytics and activity logging" paragraph is where the new wording goes (section 7).
- **Migrations:** `0027_trip_length_chosen.sql` is on `main` but **not applied** and unused. New migrations here start at **`0028`**.
- **Cron:** the Worker has four triggers (`30 3`, `0 7`, `0 8`, `0 9 * * 2`). The weekly watcher (G2) and the retention delete should ride the existing Monday `0 9 * * 2` trigger, as the weekly standup does, so no new trigger is needed.
- **Time zones:** the repo has no airport-to-time-zone table (only city names in `ORIGIN_CITIES`). G8's "18:00 in the home airport's time zone" needs a 22-row table (section 8, Q7).

## 2. Rules as data

One file, `src/data/leaveByRules.js` (it already exists). Each rule:

| Field | Meaning |
|---|---|
| `id` | stable slug |
| `appliesWhen` | `countries` (ISO codes or `['*']`), `depth` (`short`/`standard`/`long`), `minDays`/`maxDays`, `answers` (for example `driving_abroad: ['yes']`) |
| `actBy` | `{ kind: 'suggested', daysBefore: n }`, or a window such as `{ kind: 'window', hoursBeforeArrival: 72 }`, or `{ kind: 'none' }` |
| `why` | one plain line |
| `officialUrl` | where the traveler goes |
| `sourceUrl` | the page the rule was read from (often the same) |
| `asOf` | date a person last read the page (ISO) |
| `quote` | the exact words the rule rests on, kept in the file so a reviewer can compare |
| `status` | `active`, `held`, or `not_yet_required` |
| `partner` | optional partner id from the live list |

No rule text lives in templates. A `held` rule renders only "This changed recently. Check the official page:" plus the link, never a date. `actBy` dates are
"suggested by" dates computed from the traveler's own dates. The weekly watcher (G2) is the only thing that moves a rule to `held` automatically; only the owner moves it back.

## 3. First rule set (each read on the official page, 2026-10-16)

### 3.1 Passport (State Department): **held, not verifiable by me**
- **Page tried:** `travel.state.gov` country pages (`.../International-Travel-Country-Information-Pages/<Country>.html`), and the passport processing-times page. Result: bot-verification page, content never shown. The URL pattern is unconfirmed for the same reason.
- **Consequence:** for all 40 destinations the passport rule is `held` and reads: "Check the State Department page for <country>." The "renew by" date also needs the official processing time, so it is `held` too.
- **What G5 can do without this:** take the expiry month and year, compare against the trip, and say only "Check the official page" for every destination. That is not the product the addendum describes ("Fine for this trip" / "Renew before you go"). **I recommend G5 waits until the owner supplies the values below from a normal browser.**
- **What the owner would fill in** (one row per country; the fact and the date opened): 

| Country | Destinations | Months of validity required | Counts from (entry / departure / none) | Page and date opened |
|---|---|---|---|---|
| Indonesia | Bali | | | |
| Japan | Tokyo | | | |
| South Africa | Cape Town | | | |
| Australia | Sydney | | | |
| Maldives | Male | | | |
| Argentina | Buenos Aires | | | |
| Brazil | Rio de Janeiro | | | |
| Thailand | Phuket | | | |
| Vietnam | Ho Chi Minh City, Da Nang | | | |
| Taiwan | Taipei | | | |
| Italy | Amalfi Coast | | | |
| Portugal | Algarve, Lisbon | | | |
| Greece | Athens, Thessaloniki | | | |
| Cyprus | Larnaca | | | |
| Spain | Madrid, Mallorca | | | |
| Croatia | Dubrovnik | | | |
| Mexico | Tulum, Oaxaca | | | |
| Costa Rica | San Jose | | | |
| Philippines | Cebu | | | |
| Czechia | Prague | | | |
| Hungary | Budapest | | | |
| Bulgaria | Sofia / Borovets | | | |
| Colombia | Bogota | | | |
| Poland | Krakow | | | |
| Romania | Bucharest | | | |
| Guatemala | Guatemala City, Antigua | | | |
| Morocco | Marrakech | | | |
| Turkey | Cappadocia | | | |
| Jordan | Petra | | | |
| Peru | Cusco | | | |
| Egypt | Luxor | | | |
| Georgia | Tbilisi | | | |
| Azerbaijan | Baku | | | |
| Oman | Muscat | | | |

  Plus one row for the **routine passport processing time** (and expedited, if the page gives it).

### 3.2 Items I could read

| id | Page opened (2026-10-16) | What it says (quoted) | Rule |
|---|---|---|---|
| `usps-hold-mail` | usps.com/manage/hold-mail.htm | "for a minimum of 3 days and a maximum of 30 days." "To hold your mail longer or to reroute your mail, please sign up for a forwarding service." "You can make your request up to 30 days in advance." | `active`; trips 3 to 30 days; suggested 3 days before leaving |
| `usps-forwarding` | same page | same second sentence | `active`; trips over 30 days; suggested 7 days before; partner US Global Mail (live, disclosed) |
| `etias` | travel-europe.europa.eu/en/etias and /etias/about-etias/who-should-apply | "ETIAS is currently not in operation and no applications for travel authorisations are collected at this point. The European Union will inform about the specific date for the start of ETIAS several months prior to its launch." The page lists 30 countries including Cyprus, and lists the United States among visa-exempt nationalities. | `not_yet_required` for the **14** destinations in those countries: Amalfi Coast, Algarve, Lisbon, Athens, Thessaloniki, Larnaca, Madrid, Mallorca, Dubrovnik, Prague, Budapest, Sofia / Borovets, Krakow, Bucharest. No act-by date. (This settles the Cyprus doubt in the earlier design doc.) |
| `thailand-arrival-card` | tdac.immigration.go.th/arrival-card (page version 2026.10.00-0547) | "Foreigners are required to submit their arrival card information 3 days in advance of their arrival date in Thailand." | `active` for Phuket; window `72h_before_arrival`; the page says it is free ("No Fees Required" in its title) |
| `australia-eta` | immi.homeaffairs.gov.au/.../electronic-travel-authority-601 ("Last updated: 12 October 2026") | "You must use the Australian ETA App ... to apply for an ETA if you hold an ETA-eligible passport." "There is a service charge of AUD20 to use the Australian ETA app." "You must apply from outside Australia, have an eligible passport, use the Australian ETA app." | `active`, worded as "if your passport is eligible". **The page text does not list the United States** (the eligible-passports list is a pop-up I could not read), so the rule must not say US passports are eligible. Owner to confirm (Q4). |
| `brazil-evisa` | brazil.vfsevisa.com | "This is the only official portal where eligible travellers can apply for their electronic visa (eVisa)." Whether a US passport needs one is behind a nationality selector I did not use. | `held`; link to the portal; no claim about US travelers |
| `indonesia-arrival` | allindonesia.imigrasi.go.id | The site offers an arrival card for foreign visitors ("Pengunjung Asing"). The landing page gives no deadline and no fee. | `held` for timing; link only |
| `bali-levy` | lovebali.baliprov.go.id | "Pay Tourist Levy"; "pay the Bali Foreign Tourist Levy". **No amount is shown today.** | `active` wording without an amount: "Bali charges foreign visitors a tourist levy, paid through the official Love Bali site." The merged "IDR 150,000" is removed until an official page shows it. |
| `idp` | aaa.com/vacation/idpf.html | "International Driving Permits may not be issued more than six (6) months in advance of desired effective date." "A valid U.S. driver's license." "Pay $20 USD permit fee" (plus sales tax, and a photo fee online per the earlier read) | `active` only when `driving_abroad = yes`; AAA link only; suggested 3 weeks before |
| `step` | mytravel.state.gov/s/step (step.state.gov redirects there; no bot check) | "Smart Traveler Enrollment Program (STEP) is a free service to allow U.S. citizens and nationals to enroll their trip abroad so the Department of State can accurately and quickly contact them in case of emergency." | `active`, optional item for every plan; suggested 14 days before |
| Any other destination | none | none | one line: "Entry rules for <country>: see the U.S. State Department page for <country>." (link pattern unconfirmed, Q2) |

### 3.3 Home items (no external source; labeled "Suggestion"; no claims)
Water shutoff, thermostat, fridge, deliveries, lights, who has a key. They carry no source line because they are not facts about a government or a provider. No prevention claims.

## 4. Depth mapping

| Trip-length bucket | Depth | What shows |
|---|---|---|
| `weekend`, `4-6`, `7-10` | **Short** | Passport check plus at most 3 items. Order of preference: the destination's entry item if any (Thailand card, Australia ETA, Bali levy), `usps-hold-mail`, the home essentials (water, thermostat). ETIAS shows as one line, not an item. |
| `11-14`, `2+ weeks` | **Standard** | Passport check, the destination item, `usps-hold-mail` (or forwarding past 30 days), STEP, `idp` if driving, and the home items. |
| `30_plus` | **Long** | Everything in Standard, `usps-forwarding` with its disclosed partner, plus the Long Leave lead already merged for `/leave`. |

If the dates give a length that disagrees with the chosen bucket, the dates win (they are the traveler's own input).

## 5. Data model (signed-in and opted-in guests only)

Guests who do not opt in: **nothing stored**; the plan is computed in the browser. Next migration number is `0028`.

`away_plans`: `id` (random text), `owner_user_id` (nullable), `owner_email` (nullable, confirmed email for guests), `destination_country` (ISO), `leave_date`, `back_date`, `depth`,
`answers_json` (four booleans only), `item_states_json` (`{rule_id: 'open'|'done'}`), `reminders_opt_in` (0/1), `confirmed_at`, `created_at`, `delete_after` (back_date + 30 days).

`home_cards`: `token` (primary key, at least 128 bits of randomness), `plan_id`, `tasks_json` (`[{label, day | 'daily'}]`), `whatif_json` (free text blocks, rejected if they match the code/password patterns in G9), `expires_at` (back_date + 7 days), `removed_at`, `open_count`.

**Retention:** a job on the Monday trigger deletes both tables' rows 30 days after the back date (and any card past `expires_at` stops rendering immediately, whether or not deleted). No passport numbers, no expiry date, no ID, no codes, no home address are ever stored. The passport expiry month entered in G5 is used in the browser and the request, and is not written anywhere.

## 6. Every user-facing string (draft, for council review)

Tone: plain, one sentence, the step that handles the risk comes with the risk. Banned words are avoided (book, booking, secured, secure, protect, safe, vetted, guarantee, hurry, last chance, don't miss, countdown). I checked each string below against that list by eye; the real check is `npm run check:copy` on each PR.

**Page (`/plan`, name to confirm):**
- Title: "Leave-by plan"
- Intro: "Tell us where you're going and when. We'll list what to do before you leave, with the official page for each."
- Fields: "Where are you going?", "Leaving on", "Back on", "Will you drive there?" (Yes / No), "Do you have pets at home?" (Yes / No), "Anyone staying at your place?" (Yes / No), "Do you get mail?" (Yes / No)
- Button: "Make my plan"
- Item line: "Suggested by {date}" ; why line ; "Official page" ; "Checked on {asOf}"
- Disclosure line (when a partner item shows): "If you buy through this link, Sparkfare may earn a commission. It doesn't change the price you pay."
- Footer on every plan: "Rules change. Check each official page before you go. Sparkfare doesn't give legal, immigration or insurance advice."
- Held rule: "This changed recently. Check the official page:"
- Rule with no verified entry rule: "Entry rules for {country}: see the U.S. State Department page for {country}."
- ETIAS: "Not required yet; the EU has not set a start date."
- Guest note: "We don't save this plan. Close the page and it's gone."
- Late plan (G4) heading: "Past its window" ; line: "These usually take longer than the time you have. The official page shows the fastest route."

**Passport check (G5):** "Passport expires (month and year)", "Check my passport"; results: "Fine for this trip." / "Renew before you go. Suggested by {date}." / "Check the official page." ; always: "Based on a US passport. Check the State Department page for {country} before you travel."

**Reminders (G7):** opt-in "Email me each item when it's due." ; confirmation email subject "Confirm your leave-by reminders" ; body "Click to confirm. We'll email you on the day each item is due, at most six emails in all. You can stop at any time." ; reminder subject "Due: {item title}" ; footer "Stop all plan emails" (one-click).

**You're set (G8):** subject "Your plan for {destination}: what's done and what's open" (no date) ; body "Done: {list}. Still open: {list}." plus the Home card line if one exists.

**Home card (G9):** "Add a task", "Add a note for whoever is staying", blocked-pattern message "Please don't put codes or passwords here. Share those in person." ; expired card "This card is no longer active." ; remove button "Remove this card now".

## 7. Events and privacy wording

New events (all fixed-shape, bot-classified like outbound clicks; **none carries a date, passport data or free text**):
- `plan_start` (replaces the merged `plan_view`; fields `country`, `trip_length_bucket`)
- `plan_complete` (`country`, `trip_length_bucket`, `items_shown` count)
- `item_done` (`rule_id`, `country`, `trip_length_bucket`)
- `reminder_optin` (`trip_length_bucket`)
- `homecard_created` (`tasks_count` bucket: 1-3, 4-9, 10+)
- `homecard_open` (count only; no token, no IP)
- Partner clicks: existing `outbound_click` through `/out/<slug>?src=away-plan`, with `rule_id` and bucket.

The read-only query (partner clicks per 100 `plan_complete` by bucket, next to `/away-mode` clicks per 100 views) is the one in `docs/leave_by_plan_design.md` §8, with `plan_complete` and `src=away-plan`. Known limit: `/away-mode` links carry no trip id, so guest clicks have a NULL bucket.

**Privacy page sentences (draft):** "If you use the leave-by plan, we log that you started it, how long your trip is (a range such as '7-10 days'), the destination's country, and which items you marked done. We never log your travel dates, your passport details or anything you type. If you choose reminders, we store your email, your dates and your answers until 30 days after you're back, then delete them. A Home card is a private link with a random address that expires 7 days after you're back; you can remove it at any time. We log only how many times it was opened." Needs counsel review, as for every privacy change.

## 8. Open questions for the owner

1. **Add `claude/away_mode_plan_v1_2026-10-16.md` to the repo** (or tell me what differs from the addendum), so section 6 can be checked against the plan's tone section.
2. **State Department access.** Can you open the country pages and the processing-times page in a normal browser and fill the table in 3.1? Also confirm the country-page URL pattern. Without it G5 cannot give a real verdict.
3. **Bali levy amount:** is there an official page that shows it today? Until then the rule has no amount, and PR #259's "IDR 150,000" should be removed in G3.
4. **Australia ETA and Brazil eVisa for US passports:** please confirm in a browser (eligible-passport list; the Brazil nationality selector). Until then Australia reads "if your passport is eligible" and Brazil is `held`.
5. **Page name and entry points:** `/plan`? The addendum puts a link in the nav, a home page block, and a line on route pages. Confirm the nav label ("Leave-by plan"?).
6. **One flag.** `ENABLE_LEAVE_BY_PLAN` already guards the merged API. Reuse it for the page, as the addendum's flag table says (yes assumed).
7. **Airport time zones** for the 18:00 "You're set" send: I will add a 22-row table; confirm the rule "18:00 in the home airport's local time" and what to do for TLV (hide, as in G5).
8. **Cron:** put the watcher and the retention delete on the Monday trigger (assumed), or add a trigger (Workers Paid raised the account limit; I have not checked the new number).
9. **Existing sequence:** when reminders are on for a trip, skip the fixed 14/7/1 sequence for that trip (as G7 says). This needs a `plan_id` link from the trip; how should a trip and a plan be tied (same email and destination within 30 days)?
10. **Hold on 0027:** `migrations/0027_trip_length_chosen.sql` is on `main` unapplied. Apply it, delete it, or leave it? It does not block this work, but `npm run deploy` would apply it.

## 9. Not verified / could not check

- Every `travel.state.gov` page (bot check). 
- Australia: which passports are eligible. Brazil: whether a US passport needs the eVisa. Indonesia: the arrival card deadline and fee. Bali: the levy amount. Thailand: the exact meaning of "3 days in advance" beyond the quoted sentence.
- Whether the plan file or the Addendum C to F handoffs differ from what I assumed; none of them is in the repo.
