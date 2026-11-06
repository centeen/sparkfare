# Hub update: launch status, Fri Nov 6, 2026 (about 10:30 UTC)

From Claude Code, for the Hub. Read-only checks on production, plus the owner's own screenshots (Resend, Cloudflare, Product Hunt, Gmail headers) and phone test. Detail and evidence per row: `docs/launch_nov6_results_sheet_2026-11-04.md` and `docs/launch_nov6_go_no_go_checklist_2026-11-03.md` (both updated). Not legal advice; no copy, flag or product code changed beyond the merged PRs listed.

## Headline
- **Both P0 rows pass** (re-run 10:09 UTC). Original 12 origins: 14 to 31 priced routes each (thinnest IAH 14, SEA 15). Away Mode: 13 live partners, 0 empty blurbs, Petcube absent (`/out/petcube` 403), no SafetyWing link (`/out/safetywing` goes home).
- **No launch-blocking failure found.** Partial rows are 1b (one thin-origin sample), 4 (referral prompt not seen), 10 (pipeline timing, below).
- **Owner still to do:** row 14 (schedule the 08:01 UTC X and Bluesky post; set Show HN, Reddit and Indie Hackers dates) and the decision. Hub still to do: Read 3 on Mon Nov 9 to 10.

## Hub Guard round 10 (your Nov 6 read)
| Read | Your result | What happened |
|---|---|---|
| 1 vacancy post | CONDITIONAL | No change needed. The "30- to 60-day peril exclusions" text is not on the live page or in the repo (live meta: "Understanding unoccupied and vacant definitions, limits some policies set on long absences, inspection clauses, and questions to ask your insurance agent."). The read was of a stale or summarised copy. |
| 2 guides | CONDITIONAL | Real miss, fixed. 30 priced guides' meta and og said "On-the-ground notes". #495 (generator line 128 plus 30 posts) merged 09:33 UTC, live about four minutes later, 40 of 40 guides checked. Featured routes keep "On-the-ground notes for {City}, plus why this route is always featured on the board regardless of price" (approved Nov 5). |
| 3 CC BY | CONDITIONAL | Waits for Mon Nov 9 to 10 (needs the freeze lifted). Edit: "The CSV files on this page may be reused under CC BY 4.0. Attribution: Sparkfare (sparkfare.com), as of {date and time} UTC." Fallback `ENABLE_REPORT_CC_BY="false"`. |

## Found and fixed today (worth the Hub knowing)
1. **`EMAIL_POSTAL_ADDRESS` held `hello@sparkfare.com`.** The send-time check only requires a non-empty value, so every non-transactional footer read "Sparkfare · hello@sparkfare.com". The owner then re-set it, but the first attempt pasted the admin secret (clipboard); it showed in one test digest footer (06:56 UTC, to the owner's own alias; no scheduled digest had run in that window). The address is now the real postal address (seen in a test digest at 07:14 UTC) and `ADMIN_SECRET` was rotated. Hardening (reject an email-shaped value; a test over every template) was offered and declined by the owner.
2. **Three M1 test confirmations bounced** (a mistyped base address, permanent bounce; now suppressed). Retests with a working mailbox confirmed all three, and `email_verified` events logged for the first time in production. All test users, events and consent rows were then deleted from D1.
3. **Product Hunt primary link** was `https://sparkfare.com/?ref=producthunt`, which the site reads as a referral code (not tagged). The owner changed it to `?utm_source=producthunt&utm_medium=post&utm_campaign=launch_nov7`, reworded the description to the daily-email sentence, and added shoutouts (Cloudflare, Clerk, Resend, Unsplash, Claude). Category left as "Flight booking apps" by the owner's choice.
4. **The launch-post drafts' UTM tags** used mediums that store as `other` (`social`, `launch`, `directory`) and campaign `launch`. Fixed in #499 (open, docs only): medium `post`, campaign `launch_nov7`, a separate Bluesky row.

## Evidence on the main gates
- **Email:** SPF, DKIM, DMARC pass; signed `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` present; DMARC `p=quarantine`. Resend webhook subscribed to delivered, opened, clicked, bounced, complained; all recent deliveries 200. Resend Free plan: **daily cap 100** (resets 00:00 UTC; 12 used mid-morning), monthly 3,000, **10 API requests per second per team**. Per D-074 the tripwire is 60 of 100 used. A confirmation sent after the cap fails is not retried (no resend path; the 24-hour reminder flag `ENABLE_CONFIRM_REMINDER` does not exist).
- **Capacity:** Cloudflare dashboard (Oct 13 to Nov 13): 38.87k of 10M requests, 226.54k of 30M CPU ms, 1.23k of 6k build minutes, $0.00 billable. These are the Workers Paid allowances; the plan name is not shown.
- **Site:** `/check` tracked route shows the alert card, an untracked one hides it; `/time-off/embed` shows the Guard sub-line; analytics beacon on the four main page types; sitemaps 966 and 365 URLs with no TLV or `undefined`; 880 US routes plus 40 TLV; signed-in and anonymous paths unchanged. Phone: owner walked it on a real phone ("everything worked perfectly"); emulated 375 px pass found no overflow on five pages.
- **Flags** (read from `wrangler.jsonc` on `main`): all 26 "must be false" are `"false"`, all 23 "expected true" are `"true"`, `RETENTION_DRY_RUN` is `"true"`, `PINTEREST_ENV` is `"sandbox"`.

## Risks and open items
- **Pipeline timing (row 10, partial):** the 01:37 UTC hourly run took 1 h 17 min (target about 40) and the next started 09:30 UTC; the daily fetch starts about 10:50 UTC rather than 03:17, so the JFK file is about 23 h old before it runs and the 08:00 UTC digest uses the previous day's JFK data. GitHub scheduling delay, known; all runs succeeded and both files are inside the 36-hour bound. A watcher is set for today's daily fetch.
- **Resend cap:** 100 a day on Free. A strong launch could reach the 60 tripwire early; dropped confirmations are silent. Owner checks the Usage page tonight (baseline) and Saturday after 10:30 Israel time, 14:00, 18:00 and 22:00, then Sunday morning.
- **Product Hunt description** was reworded; the owner confirmed it saved. The Hub has not re-read the final listing text.
- **Not checked:** a live spot-check of banned copy (the repo check passes, 1,046 files), the 08:00 UTC digest's own headers, every thin origin's card, the referral prompt on signup.
- **After the call:** record the decision in `state_DECISION_LOG.md`, update `ROADMAP.md` Phase 0 and `docs/handoff/BUILD_STATE.md` (the 2026-11-06 session entry is already on `main`, #498). Freeze Nov 6 18:00 ET to Nov 8.
- **Standing:** no copy or wording PRs between the call and Mon Nov 9; second-wave posts (Show HN, Reddit, Indie Hackers) wait for the Hub's check of the "Fare data retrieved" wording and the site's current text, and their dates are set at the call.
