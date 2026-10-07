# Digest archive audit (ROADMAP step 21, E1 to E3), 2026-10-07

Read-only audit of what exists, what it would publish, and whether it is safe to switch on before launch. Nothing was
enabled or changed. Sources: `src/digestArchive.js`, `src/emailTemplates/dailyDigest.js`, `src/email.js`,
`migrations/0014_digest_editions.sql`, `tests/digest_archive.test.js`, a read-only production D1 query, and a render of real archive
pages from today's real ranked-deals files in an in-memory database.

## What exists
- **E2, the public archive: built, tested, off.** `ENABLE_DIGEST_ARCHIVE` is `"false"` in `wrangler.jsonc`. The table
  `digest_editions` exists in production (0 rows). Routes: `/digest` (indexable list), `/digest/<ORIGIN>` (noindex), `/digest/<ORIGIN>/<date>`
  (noindex daily edition), `/digest/<ORIGIN>/<date>/weekly` (indexable, canonical), `/sitemap-digest.xml` (the list plus weekly editions only).
  `tests/digest_archive.test.js`: 15 tests, all pass (storage, idempotence, no email address or token or unsubscribe link in a stored edition, 404s with the
  flag off, noindex rules, stale banner and live route links on old editions, sitemap, scheduled-run wiring, "View in browser" link).
- **How it fills:** `scheduled()` calls `archiveEditions()` before `sendDailyAlerts()` on both the 07:00 and 08:00 runs. First run of the day wins, one immutable
  edition per origin per day, built from the same free-tier file and email freshness rules as the emailed digest. An origin with no eligible deals gets no edition
  (DEN, PHX and LAS get none until they have deals, about Oct 21). TLV is excluded.
- **E1, the v2 email template: built, off.** `ENABLE_EMAIL_V2` is `"false"`, so subscribers still get the original plain template.
- **E3, the weekly flagship and "skip if unchanged": not built.** Nothing in the code ever writes a `kind = 'weekly'` row. The weekly routes, the sitemap entry and the
  `index, follow` rule for weekly pages exist, but no weekly edition can appear.

## What a public edition looks like (rendered from today's real data)
- Today's JFK edition: 31 KB; "Madrid $296 from New York (25% below usual) + 5 more". Contains the affiliate disclosure and the deal-information footer line, a signup form that posts to
  `/api/signup` with `partner_id: digest_archive`, and no email address, token or unsubscribe link. The postal address is not shown.
- Past editions are re-rendered at request time with a "Prices from <date>. Fares have likely changed." banner and fare links pointing at the live `/flight/...` route page
  instead of the old affiliate deep link.
- `Cache-Control: public, max-age=300`.

## Findings
1. **Today's edition has 7 affiliate links with no `rel="sponsored nofollow"`.** The booking buttons are direct Aviasales links carrying the affiliate marker
   (`aviasales.com/search/...marker=314524`) and have no `rel` at all, the same gap fixed on blog posts, route pages and Away Mode in PR #80. Past editions
   are fine (they link to route pages). Fix: add the `rel` to booking links in the digest template (harmless in email clients).
2. **What the archive shows is not what subscribers get while `ENABLE_EMAIL_V2` is off.** Archive pages are always rendered with the v2 template, but the emails are the
   original plain list, with no edition number and no "View in browser" link (that link only exists in v2). SparkLoop's stated concern was the bare-list email, so
   showing them a v2 archive while sending v1 would be misleading. To make the archive truthful, E1 has to be switched on too, which changes the daily email for every subscriber.
3. **One flag controls both writing and serving.** With the flag off nothing is archived, so no edition history builds up. Turning it on to start the "5 editions" clock also makes the
   pages public from day one. There is no way today to archive silently first. A second flag (write on, serve off) is a small change.
4. **The weekly edition SparkLoop asked for cannot exist yet** (E3 unbuilt, see above). The roadmap's gate for the resubmission, at least 5 editions including a weekly, cannot be met by
   switching things on.
5. **Minor:** the comment above `ARCHIVE_ORIGINS` still says "The 12 public US origins" (the list has 15). The archive nav lacks the new "Check a price" link. `/digest`
   itself carries no affiliate links and so no disclosure, which is fine for a list page.
6. **Fine as is:** no personal data in stored or rendered editions (tested, and confirmed on the render); noindex on daily and per-origin pages; the sitemap lists only `/digest` and weekly
   editions; the table is idempotent and additive (rollback is `DROP TABLE digest_editions`); errors per origin are caught and logged without stopping the digest.

## Is it safe to switch on before launch?
Technically yes: it is tested, the table exists, and it adds a new public page rather than changing existing ones. **But not as is, and not alone:** fix finding 1 first (affiliate links
without `rel`), decide finding 2 (enable E1 too, or accept that the archive and the email differ), and know that finding 4 means it will not by itself satisfy SparkLoop.

## Status after PR #84 (same day)
Option B below is done. Finding 1 is fixed (`relFor()` in the digest template marks paid links `rel="sponsored nofollow noopener"`) and finding 3 is fixed (`ENABLE_DIGEST_ARCHIVE_WRITE`, on, stores editions while serving stays off). Findings 2 and 4 remain open by design. Writing begins with the first 07:00 or 08:00 UTC run after the deploy.

## Options
- **A. Do nothing before launch.** Lowest risk. Start the archive after launch week; the 5-edition clock starts then.
- **B. Minimal early start (recommended if you want the clock running):** fix finding 1, add the write-on/serve-off flag (finding 3), switch on writing only around Oct 12. Editions accumulate privately; flip serving on after launch week.
- **C. Full pull-forward:** B plus `ENABLE_EMAIL_V2` and a build of E3 before launch. Largest change to the daily email and the most to test in launch week; not recommended inside the freeze.
