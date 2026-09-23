# X API Developer Access — Draft (Workplan Steps 107/108/116)

**Status: draft only, not submitted — and there's a real cost decision to make first, not just an
application to fill out.** Researched directly against X's current 2026 developer platform, not
assumed from how the old (pre-2026) Twitter Developer Application used to work.

## The process has fundamentally changed since these workplan steps were written

The old written-application gate — describe your use case, wait for Twitter/X staff to
approve/deny, get Free/Elevated/Academic access — **no longer exists**. Confirmed: **X
discontinued the free tier for new developer signups on 2026-02-06.** Access today is instant
self-serve through `console.x.com`: create a project, create an app inside it, get credentials —
no narrative application, no review, no waiting period.

**What replaced it is pay-per-use billing, on by default for every new developer:**
- **$0.015 per post created** — or **$0.20 per post if it contains a link**.
- $0.005 per post read, capped at 2,000,000 reads/month.
- The legacy flat-rate Basic ($200/mo) and Pro ($5,000/mo) tiers still exist but only for
  developers who were already on them before 2026 — not available to a new signup, and X has
  already started force-migrating existing legacy subscribers onto pay-per-use too (Basic after
  2026-06-01, Pro after 2026-09-01).

**This matters a lot for Sparkfare specifically**: every post either of these features would make
is a deal alert or PR tweet **with a link back to the route page or booking link** — meaning
**every single post costs $0.20, not $0.015.** There's no way to opt out of the link-inclusive
rate by, say, shortening the URL — the higher rate is about the post containing a link at all.

## Real cost math — this is the actual decision, not a form to submit

| Cadence | Posts/month | Cost/month |
|---|---|---|
| Step 116's weekly PR tweet only | ~4 | **~$0.80/month** |
| + a daily deal-flagged post (1/day) | ~30 | **~$6.80/month** |
| + Step 107's broadcaster posting every flagged deal (today's board can flag dozens of routes across 12 origins on an active day) | could be 50-200+/month | **$10-40+/month**, scaling directly with however many deals actually get flagged |

The workplan never pinned down Step 107's exact posting cadence (only Step 116's weekly cron is
specific: Friday 14:00 UTC). That's the real open question before spending anything — a fixed,
capped cadence (e.g. "post at most the single best deal once a day") keeps this in the
few-dollars-a-month range; posting every flagged deal as it happens does not have a natural
ceiling and could grow with the site's own success. This is the same category of decision as the
FlightAPI.io call in `t13_secondary_data_source_feasibility.md` — a real, recurring, usage-scaling
cost — and per this project's own passive-ops discipline, not something to default into without
you setting the actual posting rule first.

## What you'd need to do yourself (not something I can do)

Creating the developer account and adding a payment method are both blocked for me — account
creation and entering payment credentials are lines I don't cross even with a green light, so
this part is on you regardless of the cost question above:

1. Sign in to `console.x.com` with the **Sparkfare X account itself** (not a personal account —
   API access is tied to whichever account creates the project, and this needs to post as
   @sparkfare, not as you personally).
2. Create a project. If it asks for a project name/description (a vestige of the old application,
   not a reviewed submission), use:
   > Sparkfare is a flight-deal alert site. This project powers an automated posting feed that
   > shares genuinely below-average flight fares (verified against each route's own 30-day price
   > history, never a marked-up "was" price) and periodic account-performance summaries. All
   > posts are generated from the site's own real-time pricing data — no scraped content, no
   > engagement automation like auto-following or auto-liking.
3. Add a payment method (pay-per-use requires one on file even before your first paid call) — a
   step I can't do on your behalf per the payment-credential rule.
4. Load credits / confirm the pay-per-use plan at the billing section of the console.
5. Generate the app's API key, API secret, and (for posting) an OAuth 2.0 user-context token or
   the older OAuth 1.0a keys — either works for posting, per X's current docs.

## What I need from you before building anything

Not the credentials themselves (those go straight into a Cloudflare Worker secret via `wrangler
secret put`, same pattern as every other API key in this project — never through me or committed
to git) — I need **the posting cadence decision**, since that's what actually determines the
monthly cost:
- Keep Step 116's weekly PR tweet only, hold off on Step 107's broadcaster? (~$1/month)
- Cap Step 107 to one post/day (best deal only)? (~$7/month)
- Something else?

Once you've picked a cadence and have real credentials set as Worker secrets, I can build the
actual posting code (Step 107's broadcaster and/or Step 116's weekly cron) against them.
