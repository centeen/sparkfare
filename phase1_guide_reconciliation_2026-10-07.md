# Reconciling "Sparkfare Phase 1 Implementation Guide (Final, Ready to Execute)" with the repo, 2026-10-07

The guide arrived cut off: Part IV, Track C (the weekly standup email) ends with an empty "Email Body:" and there is nothing after it. This file records, track by track, what the guide asks for, what the
repo already has, and the verdict. **Nothing here changes code.** Part III of the guide (roadmap changes) was applied to `ROADMAP.md` with the corrections below. Parts I, II and IV are builds; none starts before the
gates in `plus_tier_design_2026-10-07.md` clear (Phase 0 passes Oct 16, the owner approves the design and its section 10 decisions).

Verdict key: **Done** (already in the repo, do not rebuild) / **Build, modified** (correct the guide's version first) / **Needs decision** / **Do not build as written**.

## Part I: pre-work checklist
| Guide item | Reality | Verdict |
|---|---|---|
| Phase 0 go/no-go "passed on Oct 1", launch Oct 2 | Launch is **Oct 17**, go/no-go **Oct 16** (`go_no_go_scorecard.md`) | Stale dates |
| Stripe account, keys "in `wrangler.toml`" | There is no `wrangler.toml` (the config is `wrangler.jsonc`); secrets are set with `wrangler secret put`, never in a file | Owner action, corrected |
| LLC formed | Roadmap step 18, not done | Owner action, still open |
| Referral-positioning copy pass merged, banned-phrase CI check wired | Merged (PR #69) and enforced by `npm test`. **No CI workflow runs the tests**; only Cloudflare's build runs on a PR | Done, with that gap |
| Baseline metrics in `state_METRICS.md` | The file does not exist. The `events` table and `/kpi` are the source; the pre-launch numbers are mostly test and crawler traffic | Corrected |
| T7 headers, bounce webhook, suppression confirmed live | Confirmed except the Resend dashboard subscription to bounces and complaints (owner) and DMARC `p=none` | Mostly done |
| "Feature flags toggled via env vars without re-deploy" | **False.** Flags live in `wrangler.jsonc`; changing one means editing it and merging (about 1 to 2 minutes). A dashboard variable edit is overwritten by the next deploy | Checklist item fails as written |
| Migrations numbered #101 to #130 | Migrations are `NNNN_name.sql`; the next is `0016`. Remote apply is flaky (HTTP 403), documented in `CLAUDE.md` | Use 0016 onward |

## Part II: "design decisions locked (from user input)"
Recorded in the guide as the owner's decisions. They are **not in `state_DECISION_LOG.md`**, so each needs the owner's explicit confirmation before it governs anything.
| Decision | Note |
|---|---|
| Stripe built in Weeks 1 to 2 (Nov 4 to 17) | Reverses "do not build Stripe yet"; consistent with the design doc's "after launch plus two weeks of data" |
| Single price $29 a year, no A/B test; pivot to $9 a month only if conversion is under 0.2% in Month 1 | Same as the design doc's recommendation |
| Household sharing, re-run, automation first (Weeks 1 to 3); email scheduling and sitter link next | **Bigger than the design doc's v1** (more watchlists and origins, reminder timing); needs a "plan" definition first (see Track A below) |
| Household sharing first | OK, but the two guides disagree on access: read-only for non-Plus members (first guide) vs read-write (this one) |
| 5 to 10 bloggers recruited in Month 1, minimal conversion expectations | Reasonable; owner action |

## Part III: roadmap changes, as applied
Added, all "Proposed, not approved": **22a** `/plus` landing page, **22b** Plus email templates, **22c** marketing collateral (gate: step 22 approved); **23a** household sharing; **64** churn tracking and re-engagement;
**65** weekly standup brief; **66** provider directory; **67** sponsorship and display-ad network; **68** B2B2C partnerships. Step 23 moved to the Phase 3 window, gate "step 22 approved plus about two weeks of real data (about Oct 30)".
Corrections to what the guide proposed:
- **Its new steps 46 to 50 were renumbered 64 to 68.** Steps 46 to 48 already exist in Phase 5 and 49 and 50 are `/check` and City Unlock.
- **Existing steps 24 to 38 were not renumbered.** Step numbers are referenced across the roadmap, `CLAUDE.md` and the scorecard; renumbering would break every reference.
- **Step 67 overlaps** step 26 (display-ads exploration) and step 30 (T5b, self-serve display ads); it is kept as one gated idea, not a third mechanism.
- **Phase dates** use the roadmap's proposed ones (Phase 2 Oct 18 to 31, Phase 3 Nov 1 to Dec 15, Phase 4 mid-Dec to mid-Apr), not the guide's "Oct 3 to 31".

## Part IV: tracks
**Week 1 to 2, Track A, Stripe.** Build, modified (`plus_tier_design_2026-10-07.md` section 6). Fix before building:
- `GET /api/subscriptions/create-session` with **no auth** cannot tie a payment to a user. Require the Clerk session and pass the user id to Stripe.
- The webhook needs **signature verification** (the guide omits it) and an idempotency table (`stripe_events`); it lists three subscription events but needs `checkout.session.completed` and `invoice.payment_failed` too.
- **Do not store an `entitlements` table.** A stored copy drifts from the subscription status. Derive entitlements from `subscriptions` (and merge with the referral rewards in `getEntitlements()`).
- No staging exists: PRs get a Cloudflare preview and merges deploy to production, so "tested on staging" becomes "Stripe test mode behind a flag, in production".

**Week 1 to 2, Track B, email "T7 completion".** **Done; do not rebuild.** The guide's version is weaker than what ships:
- It specifies `List-Unsubscribe: <mailto:...>`; the repo sends a signed HTTPS one-click URL with `List-Unsubscribe-Post` (RFC 8058 requires the HTTPS form).
- It adds `GET /api/preferences/unsubscribe?email=`, a state-changing GET on a bare email address: the exact hole removed in PR #64 (scanners follow links; anyone could unsubscribe anyone).
- `bounce_log` and `users.suppressed_at` duplicate `email_suppressions` and the `events` bounce and complaint rows. Its manual-resume sending guard is replaced by the self-clearing one already live.
- Real remaining work: the owner subscribes the Resend webhook to bounces and complaints, and DMARC.

**Week 1 to 2, Track C, affiliate registry (step 20).** **Done; do not rebuild.** The `partners` table exists (migration 0002) with 14 live partners and status values; migration "#103" would collide, and its five-partner seed is out of date. A test already checks the Away Mode keys against the registry.

**Week 1 to 2, Track D, household schema.** Build later. `household_shared_alerts.alert_id` points at an **`alerts` table that does not exist** (the product has `watchlists`, `trips` and the digest by origin). Define the object being shared first.

**Week 1 to 2, Track E, `/plus` page, email templates, collateral.** Build after approval. The copy must pass the referral-copy guard (no "book", "secured", "locked in"); "Rerun" must mean "look up the latest cached price, shown with its as-of time", never "live".

**Week 2 to 3, Plus features.** Needs decision. `alerts.rerun_enabled`, `auto_rerun`, `seasonal_rerun_enabled` and `send_rerun_alerts()` all target the missing `alerts` table and a `trip_start_date`. The nearest real machinery is `trips` plus `sendPreDepartureSequenceAlerts`; reuse it rather than a parallel hourly job.

**Week 2 to 4, Awin and ShareASale.** Build after the first paid conversion (step 37). **Merchant 11564 in the guide's pixel URL is CheapOair's id** (Sparkfare applied to it as an affiliate, step 25); Sparkfare as an advertiser gets its own id. Advertiser programs have onboarding requirements and may have fees: verify before applying.

**Week 3 to 6, sitter link.** Build later, modified. `trips` rows are flight click records, so "booked fare" and "confirmation link" on the page contradict the positioning (Sparkfare holds no booking) and trip the banned phrases; show only the saved trip and tracked fare. The 32-character token, 14-day expiry, revoke and noindex are fine.

**Week 3 to 6, email scheduling.** Partly exists. `users.frequency` (daily, instant, weekly) and `paused_until` already drive `sendDailyAlerts` (weekly goes out Mondays). New: a per-user day and time, which needs an hourly Cron Trigger (this Worker uses 3 of the account's 5 free-plan triggers). There is no `user_preferences` table; extend `users`.

**Week 3 to 6, route pages.** Largely exist. Route pages are already two columns (fare and "Everything else, handled" partners) at `/flight/<ORIGIN>/<Destination>`, plus 601 `/data/` pages. There is no date in the URL, every destination is international (so the "Bounce for domestic" filter never fires), and no `destinations` table is needed (`sparkfare_destinations.json`).

**Week 5 to 6, "MCP server".** Do not build as written. `/api/mcp/prices` is a plain REST endpoint, not an MCP server (MCP is a JSON-RPC protocol); `.claude/mcp.json` is not a registry listing. Rate limiting by IP in "Cloudflare KV" needs a KV binding that does not exist. The data has no per-date price (history is the daily low per route). Real scope is steps 38 and 57 (link-outs only, privacy page first).

**Week 7 to 8, white-label.** Step 43, gated. Clerk's production instance is bound to `sparkfare.com`; partner subdomains or custom domains need Clerk satellite or allowed-origin setup, wildcard routes and cookie handling, none of which the 24 to 32 hour estimate covers. A partner presenting deals under its own brand also needs a legal read (see the reopen triggers in `CLAUDE.md`).

**Week 9 to 12, analytics dashboard.** Build, modified. The queries are Postgres (`now() - interval '1 day'`); D1 is SQLite (`datetime('now','-1 day')`) and the column is `ts`, not `timestamp`. **DAU, WAU and MAU cannot be computed**: there are no page-view or session events and `events.user_id` is null for anonymous visitors. Options: use the Cloudflare Web Analytics beacon already on the pages (`/cdn-cgi/rum`), or add a privacy-reviewed page-view event (re-check what the privacy policy says about analytics before either).

**Week 9 to 12, churn and re-engagement (step 64).** Needs decision. The guide says alert at over 5% a month; the first guide said over 50%. With tens of subscribers a percentage is noise; use a count. "One month free" needs a Stripe coupon and terms wording.

**Week 9 to 12, weekly standup (step 65).** The body was cut off. It is cheap and independent of Plus: extend the daily health check into a short weekly summary of signups, `/check` use, email opens and flagged problems.

## Net
The guide is now fully **logged** (steps 22a to 22c, 23, 23a, 63 to 68) and none of it is approved. Two of its seven tracks (email T7, partner registry) are already built, three more (Plus features, sitter, MCP) rest on objects or
protocols that do not exist, and the metrics it wants cannot be computed from today's events. The first real work after approval is the same as before: the design doc's section 10 decisions, then the Stripe test-mode slice behind `ENABLE_PLUS`.
