# Scope: remove "book", "secure" and "lock in" wording from the generated pages (proposal, nothing built)

Written 2026-10-14 after PR #224 fixed three live strings. Question: should the council's referral-copy rule (no "book" or
"secured" in Sparkfare's own voice) reach the generated pages too? This file counts what that touches, where the text really lives,
and what a safe rewrite would be. **Status: proposal. No code, copy or checker change is made by this file.**

## 1. What the checker does today, and the gap
`scripts/check-referral-copy.js` bans specific phrases ("book now", "book this fare", "your booking", "we book", `secured`, "locked in",
`reserve*` ...). It does **not** ban a bare `book`/`booking`, `secure`, `lock in` or `lock down`, and it allows phrases like
"Aviasales handles booking and payment" and "doesn't sell or book travel" (`scripts/referral-copy-allowlist.json`). So every hit below
passes today. Counts are from `main` on 2026-10-14, after stripping the allowlisted phrases, over visible text and meta attributes.

## 2. Where the wording comes from (the sources, not the 1,000+ output files)

| Source of truth | Wording it emits | Output affected |
|---|---|---|
| `Phase 17 pSEO Generator (Step 106).py` line 195 | "...is the best way to **secure** a favorable flight rate." (shared paragraph) | all 880 `/data/*.html` pages (1 per page) |
| same file, lines 251 and 277 | meta description "...genuinely **worth booking**" | about 765 `/data` pages (the priced ones; meta only) |
| `Phase 20 Blog Generator.py` line 98 | og:description "...it's genuinely **worth booking**" | 40 destination posts |
| same file, line 168 | heading "Before you **lock in** dates" | 40 destination posts |
| `sparkfare_destinations.json` (copy generated 2026-09-04 with Claude Haiku) | `away_mode_transition` (67 hits across all 40 destinations: `secure` 29, `lock in` 26, `book*` 9, `lock down` 3, `reservations` 2), plus `the_hook` (5) and `on_ground_reality` (1) | the body paragraph of the 40 destination posts (all 40 destinations have at least one hit) |
| `blog/index.html` (hand-maintained cards) | "...the moment it's genuinely **worth booking**" on destination cards (the index also carries duplicate cards, a separate pre-existing issue) | 1 file |
| Hand-written posts | residual `book*` / `lock` / `secure` in 8 posts: `away-mode-checklist` 2, `cant-go-because-of-the-dog` 1, `departing-soon-alert-explained` 1, `same-day-cheapest-wins` 1, `unsubscribe-without-logging-in` 1, `what-happens-after-you-click-book` 3 (the slug itself says "book"), `what-happens-with-your-data` 3, `why-book-through-us-first` 2 (title and slug) | 8 files, each needs a human read |
| Root pages | `check.html` and `widget.html` signup subtext ("genuinely worth booking"); the privacy page's "whether the fare was booked" (factual, about tracking); terms/about "Sparkfare doesn't sell, book..." (allowlisted, correct) | 2 files need a change; the rest are descriptive and fine |

**Key finding:** the 880 `/data` pages need only **two template edits** (one sentence, one meta string). Their visible `book*`
hits are all allowlisted disclosure phrases, so after those two edits the `/data` pages have zero residual hits.

## 3. Proposed wording rules (a judgement call; the owner should confirm)
- "worth booking" -> "worth a look" (already used on the homepage after PR #224). Same meaning, no verb of Sparkfare doing or promising a booking.
- "secure a favorable flight rate" -> "find a favorable flight rate". "Secure" as a verb about the visitor's own prep ("secure travel
  insurance") -> not "arrange" (the rule bans "we arrange"); use "confirm", "check" or "sort out": "Before you go, check your
  travel medical coverage".
- "lock in dates" / "lock down logistics" -> "settle your dates" / "sort out the logistics". "Before you book" -> "Before you go".
- Leave unchanged: "booking site", "booking partner", "Aviasales handles booking and payment", "we don't sell or book travel", and the
  privacy page's descriptive "fare was booked".
- Insurance copy (ROADMAP step 19): the destination guides' "secure travel medical coverage" sentences are educational only, with no
  link (the SafetyWing card was removed 2026-10-13). Rewording is a style change, not a legal one.

## 4. Proposed build, in order (one PR per row, each reviewable)
1. **`/data` generator** (2 template edits) -> regenerate 880 pages + the listing page. Diff: 880 one-sentence changes plus about 765 meta
   strings. Verify: regenerate twice, `diff -r` shows the second run changes nothing; spot-check one page per status (deal, priced no
   deal, price-only, building history).
2. **Blog generator and destinations JSON**: edit `og:description` and the h2 in `Phase 20 Blog Generator.py`; fix the 40
   `away_mode_transition` strings (plus `the_hook` x5 and `on_ground_reality` x1). 67 strings is hand-editable in one sitting; do not
   re-run the LLM generation (it is the source of the current style and a new run would change unrelated sentences). Regenerate the 40
   posts and diff to confirm only the intended sentences moved.
3. **Hand-written posts, blog index, `check.html`, `widget.html`**: edit by hand. The two posts whose slug contains "book"
   (`what-happens-after-you-click-book`, `why-book-through-us-first`) need a retitle and a **301** (same `_redirects` mechanism as
   PR #223) plus sitemap and index updates; do not retitle without the redirect.
4. **Tighten the checker last**, once the above are clean, so it fails on regression instead of on today's backlog: add `secure`
   (word), bare `book`/`booking`/`booked` outside the allowlisted phrases, and `lock in/down`. Add `tests/` coverage that fails if a
   generator template reintroduces any of them.

## 5. Risks and things to decide
- **Where the line is (owner decision, the main one):** is the rule "Sparkfare never claims it books or secures anything" (the current
  checker, already satisfied) or "those words never appear in Sparkfare's voice" (this work)? The first is a legal-positioning rule
  (see `CLAUDE.md`, "Compliance"); the second is stricter than it needs to be and changes about 1,000 files.
- **Churn:** step 1 rewrites 880 files; crawlers will recrawl; acceptable, but do it once.
- **Regeneration schedule:** the `/data` pages are regenerated daily by `daily-compile-other-origins.yml`; a template edit goes live on
  the next run after merge, so steps 1 and 4 must not be merged in the same hour as an unrelated data change.
- **Meaning drift:** "worth a look" is weaker than "worth booking"; the alert's promise (a fare below its own 30-day median) is unchanged.
- **Not in scope:** the Worker templates in `src/` and the emails (they already pass `src/referralCopy.js` and the checker; a bare
  `book`/`secure` search of `src/` found only code comments and a cookie attribute).

## 6. Effort and verification
Roughly: step 1 about half a day including regeneration checks; step 2 about half a day (67 strings and 40 regenerated posts to
read); step 3 a few hours plus the redirect; step 4 an hour. Each step is verified by regeneration diff, `npm run check:copy`, the full
suite, and a live `curl` of one page per type after deploy (Cloudflare auto-deploys `main`).

## 7. Not checked
The stored `partners.commission_note` blurbs and email-template copy beyond a search of `src/`; the PTO and `/check` result pages'
dynamically generated text; whether the `the_hook` and `on_ground_reality` hits reach a public page (they are in the JSON; the post
template was not traced for those two fields).
