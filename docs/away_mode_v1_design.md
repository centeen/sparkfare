# Away Mode plan v1: design doc (Addendum G, task G1)

Written 2026-10-16. **Design only: no code, no flag change, no migration.** It replaces Addendum E's E2 and E3. Stop here and wait for the owner;
nothing in G2 to G9 starts before the owner approves this doc.

## 0. Read this first

1. **The plan file is missing.** The addendum says to read `claude/away_mode_plan_v1_2026-10-16.md` first. It is not in the repo (not on `main`, not on any
   branch; `claude/` holds only `g19_drafts/`). Section 5.7 of that plan (tone) and section 4 (the exact inputs) were therefore not available. I used the
   addendum's own tone and banned-word rules and its four-answer input list. **Please add the file, or tell me the differences, before the council reviews section 6.**
2. **State Department pages: read.** In my own browser `travel.state.gov` shows a Cloudflare "verifying you are not a bot" page that I did not try to get past. Through the owner's Chrome the same check cleared on its own, and I read the passport section of all 34 country pages and the processing-time page (section 3.1). 33 passport rules are `active` with their quote and page date; Egypt is `held` because its page does not say what the 6 months count from.
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

### 3.1 Passport (State Department): **read on the official pages, 2026-10-16 (33 active, Egypt held)**

- **How it was read.** On 2026-10-16 I opened the State Department country pages in the owner's Chrome (through the Claude in Chrome connector). The Cloudflare check cleared by itself with no click, and the old address (`.../International-Travel-Country-Information-Pages/<Country>.html`) now redirects to `https://travel.state.gov/en/international-travel/travel-advisories/<country>.html`. The rule is in the subsection **"Valid passport requirements"** under "Entry, exit, and visa requirements". Each quote below is that subsection's own text, copied from the fetched page, and "Page date" is the page's own "Last Updated" line. Rules are for US passport holders. The owner's draft (a summarizing tool's extraction) was a starting list only; where the page disagrees, the page wins and the difference is shown.

| Country | Destinations | Rule | Quote (read 2026-10-16) | Page date | Status | Versus the owner draft |
|---|---|---|---|---|---|---|
| Indonesia | Bali | entry, 6 months | "Must have 6 months validity beyond your arrival date. 2 blank pages required for entry." | Jul 9, 2026 | active |  |
| Japan | Tokyo | stay (entire stay) | "Passport must be valid for the entire stay. 1 blank page required per entry stamp." | Aug 11, 2025 | active |  |
| South Africa | Cape Town | departure, 30 days | "Passport must be valid for 30 days after your planned exit from South Africa. Must have 2 consecutive empty visa pages per entry not including endorsement pages." | Aug 11, 2025 | active |  |
| Australia | Sydney | at entry | "Your passport must be valid at the time of entry. You must have 1 blank page available per stamp." | Aug 13, 2026 | active | page date differs (draft: Jun 2, 2025) |
| Maldives | Male | entry, 6 months | "Must have 6 months validity beyond your arrival date. 1 page required for entry stamp." | Oct 16, 2025 | active |  |
| Argentina | Buenos Aires | at entry | "Your passport must be valid at the time of entry." "You need at least 1 blank page in your passport for entry and exit stamps." | Jul 16, 2026 | active |  |
| Brazil | Rio de Janeiro | entry, 1 month | "Your passport must be valid for one month at the time of entry. Your passport must have at least one blank page available per stamp." | Aug 6, 2026 | active | **differs:** draft said valid on the entry date, no months |
| Thailand | Phuket | entry, 6 months | "Your passport must have six months’ validity beyond your arrival date." | Aug 20, 2026 | active | page date differs (draft: May 2, 2025) |
| Vietnam | Ho Chi Minh City, Da Nang | entry, 6 months | "Your passport must have 6 months’ validity beyond your arrival date." "You must have 1 blank page available per stamp." | Jul 2, 2026 | active |  |
| Taiwan | Taipei | stay (intended stay) | "Your passport must be valid at the time of entry. Passports must be valid through your intended stay. 1 blank page available per entry or exit stamp." | Sep 17, 2026 | active | page date differs (draft: Jan 21, 2025); the "six months not required" line was not in this section, so it is not used |
| Italy | Amalfi Coast | departure, 3 months (6 recommended) | "Passports must be valid for at least 3 months beyond your planned date of departure from the Schengen area. A 6-month validity is recommended. Passports must have 2 blank pages for entry stamp." | Aug 11, 2025 | active |  |
| Portugal | Algarve, Lisbon | departure, 3 months | "Must have 3 months validity beyond your date of departure. 2 blank pages required for entry." | Dec 11, 2025 | active |  |
| Greece | Athens, Thessaloniki | departure, 3 months | "Must have 3 months’ validity beyond your date of departure. 1 blank page available per stamp." | Feb 19, 2026 | active |  |
| Cyprus | Larnaca | departure, 3 months | "Must have 3 months’ validity beyond your date of departure. 2 blank pages required for entry." | Aug 13, 2026 | active | **differs:** draft had it unclear (Check) |
| Spain | Madrid, Mallorca | departure, 3 months | "Must have 3 months validity beyond your date of departure. 1 blank passport page per entry and exit." | Aug 11, 2025 | active |  |
| Croatia | Dubrovnik | departure, 3 months | "Must have 3 months’ validity beyond your date of departure. 1 blank page available per stamp." | Dec 11, 2025 | active |  |
| Mexico | Tulum, Oaxaca | at entry | "Your passport must be valid at the time of entry. 1 blank passport page per stamp required for air travelers." | Aug 11, 2025 | active | the page date is now stated (draft: not stated) |
| Costa Rica | San Jose | stay (period of stay) | "Passport must be valid for the period of the stay." | Aug 11, 2025 | active |  |
| Philippines | Cebu | entry, 6 months | "Must have 6 months’ validity beyond your arrival date. Passport must have sufficient space for an entry visa stamp." | Aug 13, 2026 | active | **differs:** draft had it unclear, counted from end of stay; the page says arrival |
| Czechia | Prague | departure, 3 months | "Must have 3 months’ validity beyond your departure date. 2 blank pages required for entry." | Dec 11, 2025 | active |  |
| Hungary | Budapest | departure, 3 months | "Your passport must be valid at the time of entry. Your passport must have 3 months validity beyond your date of departure." | Apr 23, 2026 | active |  |
| Bulgaria | Sofia / Borovets | departure, 3 months | "Must have 3 months validity beyond date of departure from the Schengen area. 2 blank page available per stamp." | Dec 4, 2025 | active |  |
| Colombia | Bogota | at entry and for the stay (6 months recommended) | "Must be valid at the time of entry and for the duration of your stay." "Recommend 6 months validity." | Aug 11, 2025 | active |  |
| Poland | Krakow | entry, 6 months | "Your passport must be valid at the time of entry. Must have 6 months’ validity beyond your arrival date. Must have 1 blank page available for entry." | Aug 20, 2026 | active | **differs:** draft said 3 months after departure (6 recommended). The page now requires 6 months from arrival |
| Romania | Bucharest | departure, 3 months | "Must have 3 months validity beyond your date of departure. 1 blank page available per stamp." | Nov 12, 2025 | active |  |
| Guatemala | Guatemala City, Antigua | at entry | "Your passport must be valid at the time of entry." | Jun 11, 2026 | active |  |
| Morocco | Marrakech | entry, 6 months | "Your passport must have at least six months’ validity at time of entry. Your passport must have 1 blank page available per stamp." | Jul 30, 2026 | active | page date differs (draft: Jun 4, 2025) |
| Turkey | Cappadocia | entry, 6 months | "must have 6 months’ validity beyond your date of entry. Your passport must have at least 1 blank page available." | Jun 11, 2026 | active |  |
| Jordan | Petra | entry, 6 months | "Must have 6 months’ validity beyond your arrival date." | May 14, 2026 | active |  |
| Peru | Cusco | entry, 6 months | "Must have 6 months’ validity from the date of entry. 1 blank visa page required for entry stamp." | Aug 20, 2026 | active | page date differs (draft: May 15, 2025) |
| Egypt | Luxor | unclear | "Passport must be valid for 6 months. At least 1 blank passport page is needed." | Aug 11, 2025 | **held** | the page does not say what the 6 months count from |
| Georgia | Tbilisi | at entry | "Your passport must be valid at the time of entry. Your passport must have at least 1 blank page for an entry stamp." | Sep 17, 2026 | active | the draft's "6 months recommended" is not on the page |
| Azerbaijan | Baku | entry, 6 months | "Must have 6 months’ validity beyond your arrival date. 1 blank page available per stamp." | Sep 10, 2026 | active | **differs:** draft had the basis unclear |
| Oman | Muscat | entry, 6 months | "Your passport must be valid at the time of entry. Must have 6 months of validity beyond your arrival date. 1 blank page available per stamp." | Apr 16, 2026 | active |  |

  **Counts:** entry-based 6 months: 12 (Indonesia, Maldives, Thailand, Vietnam, Philippines, Poland, Morocco, Turkey, Jordan, Peru, Azerbaijan, Oman); entry-based 1 month: 1 (Brazil); departure-based 3 months: 10 (Italy, Portugal, Greece, Cyprus, Spain, Croatia, Czechia, Hungary, Bulgaria, Romania); departure-based 30 days: 1 (South Africa); valid at entry or for the stay, no months: 9 (Japan, Australia, Argentina, Taiwan, Mexico, Costa Rica, Colombia, Guatemala, Georgia); **held: 1 (Egypt)**.

  **Rule kinds for G5.** *entry* = the passport must still have the stated months after the arrival date (compare the expiry, taken as the first day of its month, with the leaving date plus the months). *departure* = the same, counted from the back date (South Africa counts **days**, so the rule needs a unit field). *at entry* = valid on the leaving date. *stay* = valid through the back date. Italy and Colombia only **recommend** 6 months, so the plan says "recommended" and never "required" for those. Hungary and Poland say both "valid at the time of entry" and the months; the months rule governs.

  **Sentences I did not use.** The pages also describe blank-page counts and entry steps (arrival cards, e-visas, registrations). The blank-page counts are in the quotes above and can show as a note. The entry steps in the owner's draft were **not** re-read here, so they remain leads, not rules: arrival cards or declarations (Indonesia, Maldives, Vietnam, Colombia, Guatemala, Japan), a visa or ETA (Australia, Brazil, Egypt, Vietnam, Azerbaijan, Turkey, Jordan, Oman) and EU Entry/Exit System registration (Czechia). Each needs its own official-page read.

  **Processing time (read the same day).** Page `https://travel.state.gov/en/passports/apply/help/processing-time.html`, "Last Updated: October 05, 2026": "Routine processing takes 4-6 weeks. Expedited processing takes 2-3 weeks. Urgent travel requires an appointment at a passport agency and proof of international travel within 14 calendar days." The same page says mailing the application can take up to 2 weeks, receiving the passport up to 2 weeks, and expedited service costs an additional $60. Rule `passport-renew-by`: `active`; suggested renew-by date = leaving date minus 6 weeks (routine, 4-6 weeks) with the text "Routine service takes 4-6 weeks plus mailing. Expedited takes 2-3 weeks." Because mailing can add up to 4 weeks, the plan should present the date as a suggestion and link the page. **Note for G4:** the official urgent-travel window is **14 calendar days**, not the 7 days Addendum G uses for late-plan mode; I suggest the late-plan link say "Departing within 14 days? See the State Department's urgent travel page" (owner to decide, Q11).


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
| `bali-levy` | lovebali.baliprov.go.id | "Pay Tourist Levy"; "pay the Bali Foreign Tourist Levy". **No amount is shown today.** | `active` wording without an amount: "Bali charges foreign visitors a tourist levy, paid through the official Love Bali site." The merged "IDR 150,000" is removed until an official page shows it. (The owner's draft of the Indonesia State Department page also says IDR 150,000, but that is a summarized, unverified read, so it does not change this.) |
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
2. **State Department access (answered).** Read through the owner's Chrome on 2026-10-16 (section 3.1). Still open: the Egypt rule (the page does not say what the 6 months count from), and whether to re-read the pages when the watcher (G2) finds a change. The old country-page address redirects to `/en/international-travel/travel-advisories/<country>.html`; use the new one in `officialUrl`.
3. **Bali levy amount:** is there an official page that shows it today? Until then the rule has no amount, and PR #259's "IDR 150,000" should be removed in G3.
4. **Australia ETA and Brazil eVisa for US passports:** please confirm in a browser (eligible-passport list; the Brazil nationality selector). Until then Australia reads "if your passport is eligible" and Brazil is `held`.
5. **Page name and entry points:** `/plan`? The addendum puts a link in the nav, a home page block, and a line on route pages. Confirm the nav label ("Leave-by plan"?).
6. **One flag.** `ENABLE_LEAVE_BY_PLAN` already guards the merged API. Reuse it for the page, as the addendum's flag table says (yes assumed).
7. **Airport time zones** for the 18:00 "You're set" send: I will add a 22-row table; confirm the rule "18:00 in the home airport's local time" and what to do for TLV (hide, as in G5).
8. **Cron:** put the watcher and the retention delete on the Monday trigger (assumed), or add a trigger (Workers Paid raised the account limit; I have not checked the new number).
9. **Existing sequence:** when reminders are on for a trip, skip the fixed 14/7/1 sequence for that trip (as G7 says). This needs a `plan_id` link from the trip; how should a trip and a plan be tied (same email and destination within 30 days)?
10. **Hold on 0027:** `migrations/0027_trip_length_chosen.sql` is on `main` unapplied. Apply it, delete it, or leave it? It does not block this work, but `npm run deploy` would apply it.
11. **Urgent-travel window:** the State Department says urgent travel (an appointment at a passport agency) needs proof of international travel within **14 calendar days**; Addendum G's late-plan mode uses 7. Keep 7 for the plan as a whole but link the passport urgent page at 14 days?

## 9. Not verified / could not check

- The entry steps in the owner's draft (arrival cards, e-visas, registrations) on the State Department pages; only the passport subsection and the processing-time page were read. The Egypt validity basis.
- Australia: which passports are eligible. Brazil: whether a US passport needs the eVisa. Indonesia: the arrival card deadline and fee. Bali: the levy amount. Thailand: the exact meaning of "3 days in advance" beyond the quoted sentence.
- Whether the plan file or the Addendum C to F handoffs differ from what I assumed; none of them is in the repo.
