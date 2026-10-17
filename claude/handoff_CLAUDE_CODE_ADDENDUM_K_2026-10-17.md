# Addendum K to Claude Code: Brand v1 rollout, all phases before launch (Oct 17, 2026)

**Why.** On Oct 17 the owner approved Sparkfare's brand and design direction, "Honest Anticipation" v1 (D-025), and a full production scan against it (D-029, approved D-030). The scan found 49 findings across 18 surfaces: 5 critical, 16 high, 19 medium, 9 low; mean brand fit 2.1 of 5. The owner wants every phase live before the Nov 7 launch (D-031). This addendum is the build plan.

**Read first (the owner will give you copies, as with R-008):**
- Brand & Design Direction v1: Claude Doc https://claude.ai/code/artifact/8b85344c-0508-481c-9345-45f1a1d675b0. Sections 5.3 (behavior charter), 5.4 (voice and lexicon) and 5.5 to 5.8 (visual system, page blueprints, accessibility) are the spec.
- Site Scan vs Brand v1: Claude Doc https://claude.ai/code/artifact/5baa8408-1191-48dc-8771-fef2e56bef69. Every finding ID below (SYS-1, H-3, …) is defined there with its measured value.
- Addendum J (`claude/handoff_CLAUDE_CODE_ADDENDUM_J_2026-10-17.md`), which K builds on.

**Decisions this addendum carries:**
| Decision | What |
|---|---|
| D-025 to D-027 | Brand v1 approved; hero line "Look forward to it. Honestly."; one signature spark on verified deals |
| D-030 | Scan report approved, severities included |
| D-031 | Phase A approved; Phases B and C run back to back after it, all before launch |
| D-032 | Hide the Petcube card and `/disclosure` entry now (G62 stays open) |
| D-033 | This addendum |

## The timeline

Every phase starts when the previous one is merged and live. Dates are targets; the gates are what matter.

| Window | What | Gate to move on |
|---|---|---|
| Now to Tue Oct 20 | **K0** read-only plan (with J0); deploy fix | Deploy works; owner approves K0 |
| Tue Oct 20 to Sat Oct 24 | **Phase A** (K-A1 to K-A6), merged together with J1 to J4 | Production read shows Phase A acceptance tests pass |
| Sun Oct 25 to Sat Oct 31 | **Phase B** (K-B1 to K-B10) | Phase B tests pass; **Oct 31 checkpoint** with the owner |
| Sun Nov 1 to Tue Nov 3 | **Phase C** (K-C1 live; K-C2 built dark) | Phase C tests pass |
| **Wed Nov 4** | Last merge | — |
| Thu Nov 5 | Verification file; Hub re-scans production and re-walks the journeys | Ready for the go/no-go |
| Fri Nov 6, 18:00 ET | Go/no-go; freeze until Nov 8 (unchanged) | — |

**Oct 31 checkpoint.** If Phase B is not fully merged by Oct 31, stop and report. The owner chooses between finishing Phase B, starting Phase C, or moving named packages past launch. Suggested order to cut first, if asked: K-B6 night mode, K-B9 directory and blog, K-B7 image pipeline. Never cut a package that closes a critical or high finding.

**Load.** This runs alongside Addendum J, Addendum G (Away Mode dark build), Addendum H (Task C copy) and Addendum F (articles). Put K and J first; where they touch the same files, ship them as one PR. Tell the owner in K0 if the timeline cannot hold and which other addendum work you propose to slow.

## Standing rules
- **One PR per package**, each merged only with the owner's explicit approval. To keep pace, batch your approval requests once a day (suggested 09:00 ET) with screenshots at 375 and 1,440 px.
- **Deploy first.** No PR is done until it is live in production. Cloudflare auto-deploy has failed since PR #269 (reconciliation item 81); fixing it is the first task once the owner supplies the build error text.
- **Freeze unchanged:** no merges Nov 6 18:00 ET to Nov 8; last merge Wed Nov 4; anything not merged by Thu Nov 5 18:00 ET waits until Nov 9.
- **Copy:** `npm run check:copy` passes; every copy change shows before and after text in the PR. Extend the checker in K-A3.
- **Disclosure** stays inline beside every fare and partner link through every redesign.
- **Privacy:** no traveler dates, names or emails in URLs, logs or sub-IDs. Fare itinerary dates may be shown.
- **Travelpayouts:** no change to their tools (clause 2.3.5).
- **Away Mode Plan v1 (D-016):** nothing behind a Wave 1 flag becomes visible before Nov 9. K-C2 is built dark.
- **No banned patterns** (Brand v1 section 5.3): no countdowns of any kind, "only X left", activity counts, "prices rising", "book now", resetting timers, pulsing red, confirmshaming, pre-checked boxes, streaks.
- **Tests:** follow repo patterns; add the acceptance tests listed per package; keep the 375 px mobile test suite green.

## K0. Read-only plan (with J0, by Tue Oct 20)
Add a K section to `docs/addendum_J_plan_2026-10-17.md` (or write `docs/addendum_K_plan_2026-10-17.md`):
1. Every HTML page, template, generator and email builder that sets its own `:root` colours or `font-family` (the scan found four palettes and Segoe UI on 13 surfaces). List them.
2. How the header and footer are built today on each page, and the plan to make one shared partial.
3. Which K packages overlap J sections, and the merged PR list in order, with files per PR.
4. Whether the timeline above holds alongside Addenda F, G and H; if not, what to slow.
5. How `/away-mode` decides to show "Matches your trip", and where the Petcube card and `/disclosure` entry come from (item 63).
6. Clerk: which appearance options the current Clerk version supports.
**Stop after K0 and wait for the owner.**

## Phase A (Oct 20 to 24): CSS, copy and governance

### K-A1 Tokens and fonts (SYS-1, SYS-2 pages, SYS-10, W-1)
- Create `brand/tokens.css` with the v1 tokens as CSS custom properties:
  - `--paper #F5EFE3`, `--card #FFFCF6`, `--paper-deep #EBE2D0`, `--ink #231C14`, `--ink-2 #5A4C3C`, `--spark #E8B930`, `--spark-ink #7A4F00`, `--sage #2F6B47`, `--clay #A63D2A`, `--line #DCCFB8`;
  - spacing 4, 8, 12, 16, 24, 32, 48, 64 px; radius 6 px (cards, buttons) and 999 px (chips);
  - type scale 13, 15, 17, 20, 25, 32, 44 px; body 17 px desktop and 16 px under 768 px, line height 1.55, measure 68ch.
  Night values are added in K-B6, not now.
- Create `brand/fonts.css`, self-hosting woff2 Latin subsets from the npm `@fontsource` packages: Space Grotesk 500 and 700 (display), Inter 400, 500 and 600 (text and UI), IBM Plex Mono 500 (prices, dates, percentages; `font-variant-numeric: tabular-nums`). `font-display: swap`; preload Inter 400 and Space Grotesk 700. Confirm each family's SIL Open Font License in the PR.
- Import both files in every page, the pSEO route generator, the blog generator, the digest renderer and `widget.html`. Remove every page-level `:root` palette and `font-family` declaration (Sand, Amber, the old Sage, the style guide's Paper and Ledger, Segoe UI, Arial, Roboto Mono, Courier New).
- Update `sparkfare_style_guide.md` to point to `brand/tokens.css` and retire `#FFC107`.
- **Acceptance:** computed `font-family` on all 18 surfaces starts with a brand face; a CI grep finds no hex colour outside `tokens.css` (emails excepted, handled in K-B8); no text below 13 px.

### K-A2 Action colour and contrast (SYS-3, SYS-4)
- Every button and text link uses Sage (`--sage`, white text on fills). Gold (`--spark`) appears only as the Deal chip fill (with a 1 px `--spark-ink` border) and the mark's dot. Retire amber everywhere: "Create alert", "View fare", `/hub` "Copy", the account button, watchlist prices.
- Fix the three measured failures: the Away Mode badge (removed in K-A4), "Don't see your airport?" link, the watchlist banner body text.
- **Acceptance:** a script contrast check over the 18 surfaces finds zero WCAG AA text failures; `#E8B930` is used only by the chip and the mark.

### K-A3 Truth in copy (H-3, H-4, H-5, H-6, H-10, R-3, R-4, A-3)
- Ship J3 F1 (template blurbs), J3 F2, J3 F3, J1.5 (computed count) and J2.2's single call to action in this package's PRs.
- Replace the 14 lines in the scan report's copy table with the approved text (template placeholders filled from data). Key lines:
  - Home signup: "One email a day when a fare from {origin} beats its usual price."
  - Route page: "Watch this route. One email when it drops below its usual price."
  - Blog index: "how to watch this route and hear when it drops below its usual price".
  - Away Mode: "Compare airport parking before you go"; "Data from the moment you land, on a supported network."
- **Tag wording (owner choice 1a, resolved by D-030):** retire "LIVE-CHECKED PRICE". Show "Checked {n} h ago · {time} {zone}" on fresh rows only; keep PR #281's 48-hour freshness window; older than 3 days follows J1.3 ("Last seen {date}", no link). This replaces J1.1's "Checked today" wording.
- Extend `scripts/check-referral-copy.js` with the banned-urgency list from Brand v1 5.4: hurry, last chance, act now, steal, insane, guaranteed, save $, prices will rise, lowest ever, hack, instantly, "the moment", live (as a price claim), vanish, limited time, only {n} left.
- **Acceptance:** copy checker passes on all templates and generated pages; zero blurbs contain a figure; none of "instantly", "the moment", "LIVE" or "Book" remain in Sparkfare's own copy.

### K-A4 Away Mode governance (A-1, A-4, A-5) (D-032)
- Remove the "Matches your trip" badge from every partner until the visitor has answered at least one customize question; after that, show a neutral reason chip in Ink 2 on Card (for example "For stays over 30 days"), never gold or amber.
- **Hide Petcube:** remove the card from `/away-mode` and the entry from `/disclosure`; leave the partner row in place with status `pending` and the link not rendered. Do not request or click the Awin link. Update `/about` if it mentions Petcube. G62 stays open for the owner.
- Label the 14 partner checkboxes ("Done") or remove them; say which in the PR.
- **Acceptance:** no badge renders before an answer; no `petcube` link appears in `/away-mode` or `/disclosure` HTML.

### K-A5 Structure and access (SYS-6, SYS-7, SYS-8, H-2, H-11, L-1 heading)
- Ship J4 in full here.
- Home H1: "Look forward to it. Honestly." (Space Grotesk 700, 44 px desktop, 32 px mobile), with the proof line "It only sparks when the fare's real." beneath it.
- Remove the empty "Join this trip to !" heading and `/leave`'s empty second H1.
- Site-wide `:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }`.
- Visible "Travelers" label; "Request it" restyled as a 44 px secondary button.
- **Acceptance:** every surface has exactly one H1 and one `<main>`; a real Tab walk through home shows the 2 px ring on every control.

### K-A6 Fare Ticket and chips (H-13, H-7, H-9 empty state)
- Ship J2 with the v1 visual spec (Brand v1 5.5). The Fare Ticket, in order:
  1. route ("ORD → Lisbon", region as a text label);
  2. price in Plex Mono 32 px with one chip;
  3. basis "23% below 30-day median · $184 under" with the 30-day sparkline (median dashed, today's dot gold only on a deal);
  4. fare dates, nights, airline, "round trip, per person";
  5. "Checked {n} h ago · {time} {zone}";
  6. a dashed perforation divider, then **View fare** (Sage, primary), **Watch** (secondary; links to the existing signup until the email-only watch exists) and the inline disclosure.
- Chips, each carrying a word: Deal (Spark fill, Ink text, Spark-ink border); Typical (Card fill, Ink 2); Building history (dashed Line border; photo stays desaturated; View fare stays Sage, not greyed); Last seen (Clay outline, clock icon); No data (Ink 2 text).
- Thin-origin empty state (J3 C2) styled to v1.
- **Acceptance:** every priced card shows the six parts in order; zero cards with a greyed primary button; JFK→Mallorca matches J2's example.

## Phase B (Oct 25 to 31): layouts and templates

### K-B1 Shared header and footer (SYS-5, SYS-12, R-6)
- One partial used by every page and generator. Primary links: Deals (`/`), Check a price, Time off, Away Mode, Routes; an account menu (Sign in, or Watchlists, Trips, Preferences, Sign out).
- Footer: what Sparkfare is (one sentence), Disclosure, Terms, Privacy, Blog, Referrals, About.
- Mobile menu under 768 px on every page; header at most 64 px tall on mobile.
- **Acceptance:** the same header markup on all pages; at 375 px no page shows more than one row of header.

### K-B2 Homepage (H-1, H-8, H-9, H-12)
- **Order on mobile:** H1 and proof line; origin selector (remembered); today's best verified Fare Ticket for that origin, or the empty state naming the nearest hub with verdicts ("No verdicts from AUS yet. Nearest hub with deals: DFW." computed from data, labeled as another airport); one email field "Get daily alerts for {origin}"; then the board.
- **Desktop:** two columns above the fold, value line and email on the left, Fare Ticket and 4:3 postcard on the right.
- **Signup:** email and origin only. Trip length and travelers move to the confirmation page.
- Remove the full-width watchlist banner (Watch lives on each ticket).
- Move "Don't see your airport?" below the board.
- Add three tool tiles with one-line descriptions: Check a price; Plan your time off; Leave-ready checklist.
- **Acceptance:** at 375 × 812 the first price sits above 812 px; the signup has two fields.

### K-B3 Route template (R-1, R-2, R-5)
- Rebuild the pSEO route page around the Fare Ticket (K-A6), followed by a 30-day chart (dashed median line, today's dot, deal-floor band), Watch, and "About this route".
- H1 "Chicago to Lisbon"; keep the long descriptive string in `<title>`.
- One template only (retire the second); thin routes use the J3 empty state.
- **Acceptance:** every route page has one H1, one Fare Ticket or empty state, one fare link with disclosure, one call to action.

### K-B4 `/check` verdict (C-1, C-2)
- The verdict as peak 1: one word ("Deal", "Typical", "High") in Space Grotesk 44 px, the number beneath in Plex Mono, the chip, then Watch and View fare.
- **Signature spark (D-027):** the first time in a session that a Deal chip renders anywhere, its dot ignites once (opacity 0 to 1 and scale 0.8 to 1, 400 ms ease-out). Only for fares that meet the deal floor (D-021). Nothing under `prefers-reduced-motion`. No other animation is added.
- Mark destinations with no history "No history yet" in the selector.
- **Acceptance:** spark fires at most once per session and never on a non-deal; reduced-motion test shows no animation.

### K-B5 `/time-off` planner (T-1, T-2, T-3)
- The plan headline as the hero: "42 days off" in Space Grotesk 44 px, "for 10 PTO days" in Plex Mono beneath.
- A compact calendar strip; each window collapses to one line (dates, days off, PTO used) and expands on tap.
- Destinations ranked (fare seen first when fares exist; otherwise by window fit), three 4:3 postcards per window, "see all" for the rest.
- Keep J3 C8 (share link) and C9 (no checklist under 5 days).
- **Acceptance:** page height for SEA at default settings falls below half of today's 5,437 px.

### K-B6 Night mode (SYS-9)
- Add night tokens under `@media (prefers-color-scheme: dark)`: Paper `#17130E`, Card `#211B14`, Paper deep `#2A231A`, Ink `#F2EADB`, Ink 2 `#B9AC97`, Spark `#E8B930`, Spark ink `#E8B930`, Sage `#7FBF93` (Ink text on Sage fills), Clay `#E08A73`, Line `#3A3128`. All pass AA (computed in Brand v1).
- **Acceptance:** contrast script passes in both themes on all 18 surfaces.

### K-B7 Image pipeline (SYS-11)
- Unsplash images via `srcset` at 480 and 960 px with `fm=webp&q=70` (or AVIF where supported), 4:3 crop, `loading="lazy"` below the fold, explicit width and height.
- Credit lines stay under every photo. No image behind text or numbers.
- **Acceptance:** no card image transfers more than about 120 KB.

### K-B8 Secondary surfaces (SYS-2 rest, G-1, E-1, S-1, HUB-1)
- `/digest`: tokens, shared header, Fare Ticket rows.
- Emails: inline the v1 token values (Paper, Ink, Sage, Plex Mono for prices in Ink); no amber; subject lines stay truthful to the first item (D-009 rules).
- Clerk sign-in: `appearance.variables` from the tokens (colorPrimary Sage, colorText Ink, fontFamily Inter, borderRadius 6 px); one card, not a card inside a card; a "Back to Sparkfare" link. Keep any attribution Clerk's terms require.
- `/hub`: signed-out copy ("Sign in to see your referral link and rewards"), line icons instead of emoji locks, Sage buttons.
- Account and watchlists: tokens; prices in Plex Mono, Ink.

### K-B9 Directory and blog (D-1, B-1)
- `/data/` becomes a route finder: an origin filter and one row per route with its chip and latest price, grouped by origin; no 13,861 px list.
- Blog: 68-character measure, 17 px body; generator titles must fit the trip length (no "weekend" for long-haul Asia).

### K-B10 CI brand checks
- Hex lint (only `tokens.css` may define colours); contrast and 24 px target checks on the 18 surfaces at 375 and 1,440 px; the extended copy checker; a check that `#E8B930` appears only in the chip and mark.

## Phase C (Nov 1 to 3)

### K-C1 Calm plan register (A-2, L-1), live
- `/leave` and `/away-mode` adopt the calm register: guidance first (what to do, by when, with the official source), the person's answers carried from `/leave` (J3 or Wave 1 as available), a count of done items ("4 of 7 done", never a percentage, only for trips of 7+ days), then a separate **"Who can help"** section with the disclosed partners.
- No partner appears above the guidance.
- **Acceptance:** on `/away-mode`, the first partner card sits below the guidance block at both widths.

### K-C2 Peak 2 and keeper register, built dark
- Design and build the "You're set" screen and email (G44) and the keeper register for the Home card (G33) to Brand v1 5.2 and 5.6, behind their existing Wave 1 flags (default off), as part of the Addendum G builds.
- **Do not flip any Wave 1 flag before Nov 9** (D-016). The owner may amend that separately.

## Verification before the Nov 6 go/no-go
Extend J's verification file (`docs/prefreeze_verification_<date>.md`) with a K section, from production reads only (no fare or partner clicks):
- the acceptance result of every K package;
- screenshots of home, a route page, `/check`, `/time-off/sea`, `/away-mode` and sign-in at 375 and 1,440 px, light and dark;
- the contrast and target script output;
- the copy-checker output.
The Hub then re-scans the 18 surfaces against Brand v1 and re-walks the seven persona journeys before the go/no-go.

## Out of scope
- Flipping any Away Mode Wave 1 flag (D-016).
- Fare Search (D-007); total-price wording (F4).
- New social proof of any kind.
- Any new imagery source beyond Unsplash with credit lines.

## Reply format
After K0: the plan path, the merged J and K PR order with dates, anything that blocks the timeline, and what you propose to slow. Then stop.
After each PR: link, files, before and after copy, screenshots at 375 and 1,440 px, tests added, and the acceptance result.
