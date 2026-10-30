# Addendum M: Growth pack for the Nov 7 launch (Oct 21, 2026)

> **Amendment 1 (Oct 30, 2026, owner decision D-054):** the capacity swap is approved. The limit "build M0 and M1 only, then stop and ask" no longer applies; M2 to M7 are released inside the merge train, in the order and windows of section 1. K-B6 (night mode), K-B9 (directory and blog polish) and K-B7 (image work) move to after Nov 9. Unchanged: last feature merge Wed Nov 4, Thu Nov 5 fix-only, freeze Nov 6 18:00 ET to Nov 8, M1 the D-036 hard gate (Sat Oct 31), one PR per package with the owner's approval, no M package green-lane eligible, copy PRs wait for the Hub's Guard read, new behavior behind its default-off flag. Dates the build serves (D-057): the Holiday Fare Report goes out Wed Nov 11 (Nov 18 under the D-036 fallback), so M5 must be ready, unlinked, by Nov 10; Show HN is Tue Nov 10 and lands on `/check` and `/how-it-works`. Full text: `docs/handoff/addendum_M_amendment_1_2026-10-30.md`.

**For:** Claude Code, and Antigravity IDE when Claude usage runs out. Both tools follow the same file, the same rules and the same progress log (section 3).

**Why.** On Oct 21 the owner approved Sparkfare Growth & GTM Plan v1 (D-037) and kept the Nov 7 launch (D-036). The plan needs seven small builds before launch so every visitor from the launch fortnight lands in the list, can share, and can be counted by source. This addendum is that build. It adds no new product, no new partner and no paid tool.

**Read first:**
- Growth & GTM Plan v1, Claude Doc: https://claude.ai/artifact/6Fa9cZtiqYpgyRHPLdfcvS (Part 5 is the plan; the council section has the Guard conditions numbered 1 to 11).
- Addendum K and Amendment 1 (`claude/handoff_CLAUDE_CODE_ADDENDUM_K_2026-10-17.md`, `..._K_AMENDMENT_1_2026-10-17.md`) and Addendum J. M builds on them and shares their rules.
- `CLAUDE.md` and `ROADMAP.md` in the repo.

**Decisions this addendum carries:**
| Decision | What |
|---|---|
| D-036 | Launch stays Sat Nov 7. Hard gates at the Nov 6 go/no-go: J1 merged, route count matches data, signup source tagging works (M1). A missed gate cuts scope, not the date |
| D-037 | Growth & GTM Plan v1 approved at test status; replaces plan v3.1's acquisition parts |
| D-054 (answers consult 13 decision 3, Oct 30) | M takes the pre-launch slots of K-B6, K-B9 and K-B7, which move after Nov 9. ~~Until the owner answers, build M0 and M1 only, then stop and ask~~ no longer applies (Amendment 1) |

## 1. Order, gates and dates

| Order | Package | Target (latest, not earliest; D-035 pull-forward applies) | Hard gate? |
|---|---|---|---|
| 1 | **M0** read-only plan | Fri Oct 23 | — |
| 2 | **M1** measurement | Sat Oct 31 | **Yes (D-036)** |
| 3 | **M2** referral prompt | Sun Nov 1 | No |
| 4 | **M7** conversion additions, shipped inside K-B2's PR | with K-B2 | No |
| 5 | **M4** 2027 PTO page, press-ready | Mon Nov 2 | No |
| 6 | **M5** Holiday Fare Report page | Tue Nov 3 (page may merge unlinked) | No |
| 7 | **M3** `/check` share image (the `/time-off` link is J3 C8) | Wed Nov 4 | No |
| 8 | **M6** answer-engine basics | Wed Nov 4, else after Nov 9 | No |

- Last feature merge Wed Nov 4; Thu Nov 5 fix-only; freeze Nov 6 18:00 ET to Nov 8 (unchanged).
- If capacity runs short, cut from the bottom: M6, then M3, then M5's link from the homepage (the page can still go live for the Nov 11 report date). Never cut M1.
- If M5 is not live by Nov 10, the owner moves the report to Nov 18 (D-036 fallback). Say so in the approval pack the moment you see the risk.

## 2. Standing rules (same as J and K, plus three)
- One PR per package, owner approval per PR, through the merge train (D-035). **No M package is green-lane eligible**: every one touches copy, links, emails or data.
- Copy PRs wait for the Hub's Guard read before they enter a train. Show before and after text in the PR.
- `npm run check:copy` passes; Brand v1 banned-pressure list applies; no "book", "secured", "instantly", "the moment", countdowns, "only X left", activity or subscriber counts.
- Disclosure stays inline beside every fare and partner link.
- Privacy: no traveler dates, names or emails in URLs, share images, logs, UTM tags or sub-IDs. Fare itinerary dates may be shown.
- Travelpayouts: no change to their tools (clause 2.3.5). Published figures are derived statistics only (Sep 23 written OK); never raw price rows for download.
- New user-visible behavior sits behind a flag, default off, flipped by a separate one-line PR the owner approves: `ENABLE_REFERRAL_PROMPT` (M2), `ENABLE_SHARE_IMAGE` (M3), `ENABLE_REPORTS` (M5). M1, M4, M6 and M7 need no flag unless M0 says otherwise.
- **New:** never click fare or partner links on production, and never trigger real emails to real subscribers while testing; use the test addresses pattern already in the repo.
- **New:** every number shown publicly is computed from data at build time with an as-of date and zone; nothing typed by hand (Guard condition 6).
- **New:** update the progress log (section 3) at the end of every working session, whichever tool you are.

## 3. Working across Claude Code and Antigravity

The owner will switch between Claude Code and Antigravity IDE mid-addendum. Neither tool remembers the other's session, so the repo is the only shared memory.

**Files in the repo (create in M0):**
- `docs/handoff/ADDENDUM_M.md`: a copy of this addendum, committed unchanged. If the Hub issues an amendment, it is appended at the top with a date.
- `docs/handoff/BUILD_STATE.md`: the live progress log. One table row per package (package, branch, PR number, status, last commit, next step) and a dated "Session notes" list at the bottom: what was done, what is half done, anything surprising, which tool did it. Newest note first.

**Conventions both tools follow:**
- Branch per package: `m/m1-measurement`, `m/m2-referral-prompt`, and so on. One PR per branch, opened as a draft as soon as there is a first commit.
- Commit messages start with the package ID: `M2: add referral block to confirmation page`.
- PR description uses the reply format in section 6, so the next tool can read where things stand from the PR alone.
- Run checks through the repo's own scripts (`npm test`, `npm run check:copy`, the K contrast and target scripts) so results are the same in either tool.
- Do not put rules only in a tool-specific place. Project rules live in `CLAUDE.md`; if Antigravity needs its own rules file, the owner copies section 2 of this addendum into it rather than writing new rules.
- The repo's older `antigravity_build_plan.md` (tasks T0 to T7) is history. Do not resume it; where it overlaps (share images, route pages, referral loop), this addendum and the newer addenda win.

**Before stopping a session (either tool):**
1. Commit work in progress to the package branch and push; leave the PR as a draft if unfinished.
2. Update `BUILD_STATE.md`: status, the exact next step, open questions for the owner.
3. Run the tests and the copy checker; note any failure in the session note rather than leaving it silent.

**Starting a session (either tool):** paste this prompt.
```
You are continuing Sparkfare Addendum M (growth pack). Read, in order: CLAUDE.md, docs/handoff/ADDENDUM_M.md, docs/handoff/BUILD_STATE.md, then the open m/* pull requests. Do not start anything the owner has not approved. Pick up the "next step" in BUILD_STATE.md for the lowest-numbered unfinished package. Follow section 2's rules. Before you stop, update BUILD_STATE.md and push.
```

**Merging is the same in both tools:** the owner approves a numbered batch from the approval pack; whichever tool is active merges in order, waits for a green deploy and smoke check, stops on the first failure and reverts only that PR (D-035). If the active tool cannot see deploy status, it stops and asks the owner instead of merging.

## 4. Packages

### M0. Read-only plan (by Fri Oct 23). Stop after it.
Write `docs/handoff/addendum_M_plan_2026-10-21.md` and create the two handoff files. Answer:
1. **Signup paths:** every place a person can subscribe (home, route pages, `/time-off`, `/check`, widget, `/hub`, any other), and whether each stores the first-touch source from PR #163. List gaps.
2. **Referral links:** how `?ref=` codes work today (Workplan step 93); whether an email-only subscriber, without an account, can get and share a link; what the live `/hub` shows signed out; whether referred signups use double opt-in. Reconciliation item 53 and 96: what reward tiers the code actually grants.
3. **Data for the report (M5):** what the stored history can honestly support for 22 hubs: candidate findings with counts and sample sizes, for example share of verdict-capable routes at or past the deal floor (D-021) by hub and region over the last 30 and 60 days; median observed fare movement by region; routes with the most observation days. Say which findings the data cannot support. No predictions, no "cheapest day to book".
4. **`/time-off` for 2027:** which of the 12 holiday toggles have 2027 dates; whether `.ics` and the share link cover 2027; how pages are rendered (for printable and social-image work).
5. **Analytics access:** whether visits by source can be read automatically (Cloudflare Web Analytics API token or not). If not, M1 shows signups and confirmations by source only and the owner reads visits in the Cloudflare dashboard.
6. **Overlaps:** files M shares with K-B2 (home), J3 (share link), K-B4 (`/check`), K-B5 (`/time-off`), K-B8 (emails); proposed PR order with K and J.
7. **Load:** whether M fits the windows to Nov 4 alongside J and K, and what you would defer if the owner does not approve the K-B6, K-B9, K-B7 swap.
8. **Route count:** status of J1.5 (one computed count) and every place "880" or "600" still appears.

### M1. Measurement (D-036 hard gate; by Sat Oct 31)
- Every signup path stores a first-touch source: existing UTM tags plus internal values `pto`, `check`, `report`, `share`, `referral`, `widget`, `route`. A signup with no tag stores `direct`.
- An owner-only view (`/admin/growth`, same auth as other admin pages): per day and per source, signups, confirmations (double opt-in completed) and confirmation rate; referrals sent and confirmed; totals for the last 7 and 28 days. Visits by source too if M0 found API access.
- A script that writes the Day-14 baseline to `docs/metrics/baseline_2026-10-27.md` (or the date it runs): visits (from the owner if no API), signups, confirmations, rate, by source; the Hub copies it into the project's `state_METRICS.md`.
- **Acceptance:** a test signup through each path with and without a UTM tag shows the right source in `/admin/growth`; the view needs admin auth; no personal data in the view beyond counts.

### M2. Referral prompt (flag `ENABLE_REFERRAL_PROMPT`; by Sun Nov 1)
- One short block in three places: the double opt-in confirmation page, the welcome email, and the footer of every digest. It gives the person's own referral link with a copy button and names the first reward (a second home airport, per the live terms page).
- Works for email-only subscribers without an account (if M0 finds it does not, propose the smallest change and stop for the owner).
- Draft copy for the Hub's Guard read (do not ship until it is approved): "Know someone who'd use this? Share your link. When one friend confirms, you can add a second home airport." Rules: one ask per email, never repeated in the same email, no progress bars, streaks or counts of other people.
- Referred signups use double opt-in; a referral counts only after confirmation (existing T3 rules).
- **Acceptance:** with the flag on in staging, each of the three places shows the block with a working link; a referred test signup is credited only after confirming; with the flag off nothing changes.

### M7. Conversion additions (inside K-B2's PR)
- K-B2 already reorders the homepage and cuts the signup to email and origin. Add: a "See a sample digest" text link to the latest `/digest` edition for the selected origin; the signup form records `source`; confirm there is no pop-up, exit-intent or scroll-triggered modal anywhere.
- Visitors arriving from a thin origin see the K-B2 empty state plus links to `/check` and `/time-off` (plan coverage rule).
- **Acceptance:** K-B2's acceptance plus a working sample-digest link and zero modals on any page.

### M4. 2027 PTO page, press-ready (by Mon Nov 2)
- Per airport (`/time-off/<origin>`): a print stylesheet so the page prints as a clean one- or two-page "2027 long weekends from {airport}" calendar; the existing `.ics` covers all 2027 windows.
- A national page section "2027 long weekends" with the bridge table for the default holiday set, a one-paragraph method note (federal calendar from OPM, observed days, "many employers do not give every federal holiday"), and an as-of date.
- A social image per airport (1200 × 630) showing the plan headline (for example "10 PTO days, 42 days off") computed from data, Brand v1 tokens, no fare and no traveler data.
- An embed snippet (a small iframe of the national calendar) with a credit link back to `/time-off`; no tracking beyond what the privacy page already discloses.
- **Acceptance:** prints cleanly at A4 and US Letter; social image validates in a card checker; numbers in the image match the page; copy checker passes.

### M5. Holiday Fare Report page (flag `ENABLE_REPORTS`; by Tue Nov 3)
- A page at `/reports/holiday-2026`, generated by a script from stored history (the repo's generator pattern; M0 says which), re-runnable monthly as the start of the Sparkfare Index (ROADMAP 39 and 54).
- Contents limited to the findings the Hub picks from M0's list after a Guard read: headline finding with its number, a table or chart by hub or region, method (data source, period, observation days, deal floor, what a "cached round-trip low" is, "not a quote for your dates"), sample sizes, as-of date and zone, and the inline affiliate disclosure if any fare link appears.
- A download of the aggregate table (CSV of derived statistics only) and `Dataset` structured data, so reporters and answer engines can cite it.
- No predictions, no savings claims, no "cheapest day", no claim the data cannot support (Guard condition 5).
- **Acceptance:** re-running the script reproduces the page from data; every number on the page traces to the CSV; the page stays unlinked until the owner flips the flag on Nov 11 (or Nov 18).

### M3. Share image for `/check` (flag `ENABLE_SHARE_IMAGE`; by Wed Nov 4)
- After a check, an optional "Share this result" button that creates a link and a 1200 × 630 image: route, the verdict word, "x% below/above this route's 30-day median", basis and as-of. Never the price the person typed if they choose not to include it; never their dates.
- The `/time-off` plan-carrying link is J3 C8; reuse its pattern, do not build a second one.
- **Acceptance:** the shared link opens a page that shows the same verdict and basis; no personal data in the URL or image; flag off hides the button.

### M6. Answer-engine basics (by Wed Nov 4, else after Nov 9)
- A method page (`/how-it-works`) that states plainly how deals are judged (30-day median of cached round-trip lows, deal floor of 15% and 10 observation days, freshness rule, what the price is not). Link it from `/check`, route pages and the report.
- Short question-and-answer blocks (two to four sentences each) on `/check`, `/time-off` and the method page, written for the Hub's Guard read.
- Structured data matching real content only (`Dataset` on the report, `WebApplication` on `/check`, `FAQPage` where the blocks exist); `llms.txt` at the root listing the method page, report, `/check` and `/time-off`.
- IndexNow ping on publish of new or changed pages (key file at the root); prepare Bing Webmaster Tools verification and give the owner the one-time step.
- **Acceptance:** structured data validates; `llms.txt` and the IndexNow key resolve; the method page passes the copy checker.

## 5. What the owner and the Hub do in parallel (for awareness; not your tasks)
- Owner: founding list, journalist-platform profiles, Reddit participation, Product Hunt page, press list (plan Phase 0).
- Hub: Guard reads of M2 and M6 copy and the report text; picks the report findings from M0; refreshes the launch posts; drafts the press note.

## 6. Reply format
- **After M0:** the plan path, the PR order with K and J and target dates, anything that blocks the timeline, what you would defer, and your answers to M0 items 1 to 8. Then stop.
- **After each PR:** link, branch, files, before and after copy, screenshots at 375 and 1,440 px, tests added, the acceptance result, and the `BUILD_STATE.md` line you updated.

## 7. Out of scope
Paid tools or paid acquisition; any new partner or affiliate link; flipping Away Mode Wave 1 flags (D-016); WhatsApp, Pinterest standard access and short-video automation (owner decision 8, open); public subscriber, visit or "deals found" counters; any change to Travelpayouts tools.
