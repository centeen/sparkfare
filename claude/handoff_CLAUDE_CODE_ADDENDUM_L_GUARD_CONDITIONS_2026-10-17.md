# Addendum L: Guard conditions for Phase A draft PRs #296, #298, #299, #300, #301 (Oct 17, 2026)

**From:** the Hub, after its Guard read of your draft PRs (full read: `claude/guard_read_K-A_draft_PRs_296-301_2026-10-17.md`; non-attorney guidance).
**Result:** no FAIL. #300 passes. #296, #298, #299 and #301 are CONDITIONAL on the items below. #297 (K-A2) has no copy and needs no read.
**Rules that still apply:** nothing merges without the owner's explicit approval from an approval pack (D-020, D-035 section 4). Do not apply any migration to production yourself; list each one and wait for the owner's approval. Do not push to a PR in a way that hides a change: any push voids the owner's approval of that PR. No merges from Nov 6 18:00 ET to Nov 8. The green lane stays off until the owner arms it.

## Do these, in this order

### 1. #301: confirm J1-data first (it gates the Deal chip)
- Report whether the J1-data change (15% below the median and 10 distinct observation days, D-021; `Phase 1 Deal Ranking Script (Step 9 - with fallback).py` and `src/dealQuality.js`) is merged to `main` and whether production's ranked-deals file was regenerated with it. `CLAUDE.md` at the base of #296 records it as "BUILT - PR OPEN, NOT MERGED".
- If it is not merged: say so in the pack. #301 must not merge before it, because until then the Deal chip can show on fares under 15% below the median.
- Confirm the price in the data is for one adult (the booking links end in "1") and whether it includes taxes. If you cannot confirm, change "round trip, per person" back to "round trip" in the detail line and the tests, and say so.
- Keep the per-ticket disclosure sentence and the grid-level line exactly as they are until the owner answers your question in #301. The Hub's Guard view is to keep both.
- Do not change the "Typical" chip wording; report only whether any fare above its median can show "Typical" (count from today's data).

### 2. #296: privacy sentence
- Search the repo at the head commit for `googleapis`, `gstatic` and `fonts.google` in every served file: HTML, `src/*.js` templates, `embed.html`, `widget.html`, the generators, `/digest` rendering, confirmation and admin pages. Paste the command and its result in the pack.
- If the result is empty: keep the sentence as written.
- If anything remains: change the sentence to "The typefaces on most of our pages are served from sparkfare.com itself, not from a font service." and list the remaining pages, or hold K-A1b until K-B8. State which you chose.
- Quote the final `privacy.html` change (removed and added lines) in the pack, and confirm the "Last updated" date.

### 3. #298: the two promises in the signup copy
- Find the code that decides when the daily email sends and what qualifies a fare for it. Quote the condition (file and lines) in the pack.
- Confirm whether any other alert (for example the "departing soon" alert) can reach the same signup on the same day. If yes, change "One email a day" to "At most one fare email a day" in every place it appears (home, widget, `/check`, `/time-off`, `/leave`) and in the tests.
- Confirm "beats its usual price" is true of the send rule (below the route's median). If the rule sends on fares that are not below the median, stop and report instead of editing.
- Do the same check for the route-page line "Watch this route. One email when it drops below its usual price." against the route-watch trigger.
- Confirm the Parking Access partner page compares options; if it does not, report (do not edit).
- State which migrations it needs (0029) and wait for the owner's approval to apply it.

### 4. #299: send me the strings
- Paste all 13 reason-chip strings (one per question) exactly as rendered, with the partner each belongs to. Do not edit them yet. The Hub will read them.
- Paste the final `/disclosure` partner list and confirm it names every live partner (13) and no hidden one.
- Confirm `/about` reads correctly with Petcube hidden, and add a note in the PR that the line must change if G62 brings a pet-camera link back.
- Migrations 0029 then 0030: list the exact commands and wait for the owner's approval.

### 5. #300: nothing to change
No edits. Include it in the pack with its screenshots.

## Pack format and order
- One approval pack with the five PRs (and #297) in merge order: #296, #297, #298, #299, #300, #301. After each merge, retarget the next to `main`.
- For each PR: link, head commit, the exact final strings, the evidence asked for above, screenshots at 375 and 1,440 px (the PRs still say they are "to attach"), test results, and one line on risk.
- Mark which items the Hub has now read and which still need a second read (any string you change after this addendum, and the 13 chip strings).
- Put the owner's open items at the top: the per-ticket disclosure decision (Hub: keep), whether sourced figures may return to the destination guides later (21 of 41 lose their cost lists; 9 lose their closing sections), and the migrations to approve.
- Start the pack with the pace line (Addendum K Amendment 1, section 7).

## Report back
Reply with the pack. Stop after posting it. Do not merge, do not apply migrations, and do not start Phase B until the owner approves.
