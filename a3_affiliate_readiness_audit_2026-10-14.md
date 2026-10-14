# A3 read-only audit for affiliate readiness (Addendum A, item A3)

Run 2026-10-14 at about 16:45 UTC. Nothing was changed. Method: production HTTP requests, read-only queries of production D1
(`events`), and the repo on `main`. "Not checked" means I could not look. Counts for the `/data` pages come from the repo copy of
the generated files, which CI regenerates daily, so they drift.

## 1. Analytics
- **Cloudflare beacon:** present on all 12 page types sampled (`/`, `/check`, `/away-mode`, `/leave`, `/time-off`, a blog post,
  a route page, a `/data` page, `/about`, `/hub`, `/pricing`, `/digest`).
- **How it is injected:** at the Cloudflare edge, not in the repo. Plain `curl` shows no beacon; a browser-like User-Agent shows
  `static.cloudflareinsights.com/beacon.min.js` with a token. A "curl and grep" check will wrongly report it missing.
- **`Cache-Control: no-transform`:** not seen on any response, and not present in `src` or `wrangler.jsonc`. Worker-rendered pages
  (`/check`, `/leave`, `/flight/*`, `/hub`, `/pricing`) send no `Cache-Control` at all.
- **Not checked:** the Cloudflare dashboard's visit counts (no dashboard access).
- **`events` table:** exists in production, 1,646 rows since 2026-09-24. Last 7 days by type: `deal_suppressed` 321,
  `outbound_click` 132, `pto_view` 89, `email_open` 36, `pricing_view` 29, `leave_view` 26, `leave_answer` 24, `route_promoted` 12,
  `interstitial_view` 11, `check_run` 9, `checklist_email_sent` 6, `alert_email_sent` 5, `leave_trip_length` 4, `leave_result_view` 4,
  `leave_completed` 4, `leave_started` 3, `leave_long_branch_shown` 2, `interstitial_close` 2, `digest_skipped_unchanged` 2, and one
  each of `weekly_standup_sent`, `share_click`, `pto_ics_download`, `check_share`, `away_mode_sequence_sent`.

## 2. Thin pages (index hygiene)
| `/data` pages (880, excluding the index) | Count |
|---|---|
| "Still building enough price history" | 582 (66%) |
| Price shown but not judged against a 30-day baseline | 80 |
| Priced, no deal | 183 |
| Deal | 35 |

- **Identical text:** all 880 carry the same generic destination paragraph ("... offers a unique blend of cultural immersion and
  modern convenience ...") with only the place name swapped; after removing the name there is exactly 1 distinct text.
- **Indexing:** none of the 880 has a robots meta tag, so all are indexable. The main `sitemap.xml` lists 881 `/data/` URLs.
- **Route pages (`/flight/...`):** `sitemap-routes.xml` lists 291 URLs (267 `/flight/`, 23 `/time-off`, plus one URL not
  identified). 10 evenly spaced `/flight/` URLs all returned 200 with no noindex. A nonexistent route returns 404, so thin routes are
  not served: about 267 of the 880 possible routes (30%) have a page.

## 3. Basics an application will check
- **About page:** exists. Contact text: "Questions, corrections or data requests: hello@sparkfare.com". A domain address, not free-mail.
- **Privacy and terms:** both return 200.
- **`/disclosure`:** matches `GET /api/partners`: Aviasales/Travelpayouts plus the 13 live partners. SafetyWing is not listed.
- **Affiliate links without a disclosure line:** of 41 static HTML pages with partner or fare links, 0 lack a visible
  commission/disclosure sentence. **Not checked:** Worker-rendered pages (route pages, the interstitial), email templates, and the
  homepage's JS-built fare links.

## 4. Away Mode pet and home content
- **`/away-mode`:** a "Traveling with a pet?" Yes/No row with no link; the intro reads "Before you leave: the water, the mail, the
  pets, and who has a key."
- **`/leave`:** asks "Are pets staying home while you are away?". A "yes" gives: "Line up care for your pets. Choose who covers
  (friend, sitter, boarding or a home check), meet them with your pet first, and write down feeding, medication and vet details. Do not
  write alarm codes on the sheet." No link. The code comment says "free steps only today (no live pet partner)".
- **Pet or housesitting partner:** none live and none shown.
- **Partners shown (`/api/partners`, all live, 13):** airhelp, yesim, wise, us-global-mail, nordvpn, bounce, rocket-languages,
  timekettle, parking-access, tiqets, gocity, qeeq, welcome-pickups. rover, pet-gear and holafly are `pending` and hidden.

## 5. Blog
- **Count:** 85 posts (86 files minus the index).
- **Generated:** 40 posts match destination slugs and are written by `Phase 20 Blog Generator.py` from
  `sparkfare_destinations.json` and one template. Rough pairwise similarity (12-post sample, `quick_ratio`) 0.86 to 0.94; median
  length about 370 words.
- **Other:** 45 posts that look hand-written (methodology, Away Mode, trust posts).
- **To confirm:** 16 of those 45 look like short-slug destination posts (`algarve`, `antigua`, `baku`, `bucharest`, `cape-town`,
  `cebu`, `guatemala-city`, `ho-chi-minh-city`, `larnaca`, `maldives`, `oaxaca`, `phuket`, `san-jose`, `taipei`, `tbilisi`,
  `thessaloniki`). For one pair, `algarve.html` and `algarve-portugal.html` have different text (84 differing lines) and `/blog/algarve`
  is in the sitemap. The rest were not compared.

## 6. Outbound links
- **Static HTML in the repo:** 7 partners (airhelp, yesim, wise, us-global-mail, nordvpn, bounce, rocket-languages) at 40 each, 280
  links, all on the 40 destination blog posts via `/go/<slug>`. No direct Aviasales hrefs in static HTML.
- **Dynamic:** `/away-mode` builds `/out/<slug>?src=away_mode` from the live partner list (13). Route pages, the interstitial and the
  emails render links at runtime and were not counted.

## Not checked
Dashboard visit counts; Search Console indexing status; per-email-template disclosure placement; the 16 short-slug posts for
duplication; rendered route-page text similarity.
