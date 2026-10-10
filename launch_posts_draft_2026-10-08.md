# Launch posts: DRAFT for Coby (ROADMAP step 52)

Nothing here has been posted. Every post needs your review, and each community's own self-promotion
rules must be read before you post there. Facts below were checked against the repo and the live site
on 2026-10-08; items marked **[CONFIRM]** are claims only you can verify.

**Refreshed 2026-10-10** for what changed since: 22 US airports and 880 routes (was 15 and 600), ten of those
airports are new and still building history, history on the original twelve is about a month (was "two
weeks"), "as of" is the time the data was retrieved and the fare itself can be older, and launch-source tags
are now recorded with signups (PR #163).

## Ground rules used in these drafts
- **Lead with the tool** (`/check`), not the site. Roadmap step 52 says so.
- **Copy rule from CLAUDE.md:** no "book now", "we book", "secured", "booked for you", and no legal-status
  words. The posts say what Sparkfare does: it shows fare information and sends you to Aviasales.
- **Say it is new.** The original twelve airports have about a month of history; ten more were added this
  month (DEN, PHX, LAS, PHL, MSP, CLT, DTW, FLL, BWI, AUS) and mostly show "Building history", and several
  of them have thin data from the source. The posts say so rather than imply a long track record.
- **Disclose the affiliate link** wherever the platform allows it. Reddit and HN users check.
- **No "real-time" or "live prices".** Fares come from a cache. The time shown is when Sparkfare retrieved the
  data; the fare itself can be older, and may be gone by the time you click.

## Links (UTM-tagged; one per venue so outcomes can be logged)
Base: `https://sparkfare.com/check`

| Venue | Link |
|---|---|
| Show HN | `https://sparkfare.com/check?utm_source=hackernews&utm_medium=social&utm_campaign=launch` |
| Product Hunt | `https://sparkfare.com/?utm_source=producthunt&utm_medium=launch&utm_campaign=launch` |
| Reddit | `https://sparkfare.com/check?utm_source=reddit&utm_medium=social&utm_campaign=launch&utm_content=<subreddit>` |
| Indie Hackers | `https://sparkfare.com/check?utm_source=indiehackers&utm_medium=social&utm_campaign=launch` |
| X / Bluesky | `https://sparkfare.com/check?utm_source=x&utm_medium=social&utm_campaign=launch` |
| Directories | `https://sparkfare.com/?utm_source=<directory>&utm_medium=directory&utm_campaign=launch` |

**Tested 2026-10-10:** `/` and `/check` with these tags return 200 and render normally (the tagged `/check`
URL is served `noindex`, which is fine for a launch link). **PR #163 must be merged before launch** for the
tags to be recorded: it keeps the first tag for the browser session and stores it with a signup. The
resulting tags are `hackernews_launch`, `producthunt_launch`, `reddit_launch_<subreddit>`,
`indiehackers_launch`, `x_launch` and `<directory>_launch`. Only signups are tagged: a click that does not
sign up, and any link you post **without** its tag, records nothing. Tag every link.

---

## 1. Show HN

**Title** (max 80 characters, no marketing words):
`Show HN: Is this flight price actually good? A checker built on each route's own history`

**Text:**

> I built Sparkfare because "deal" on most flight sites means whatever the site says it means.
>
> You enter an origin, a destination and the price you were quoted. It compares that price with the
> median of the route's own cheapest daily fares over the last 30 days and tells you the percentage
> difference. That's all. No verdict, no "buy now", no prediction of where the price goes next.
>
> How it works:
> - Fares come from the Travelpayouts/Aviasales cache, one cheapest fare per day per route, kept per
>   origin-destination pair (JFK-Lisbon and ORD-Lisbon have separate baselines).
> - A route is called a deal only if today's price is below median minus 2 x MAD (median absolute
>   deviation), and only with at least 10 days of history spanning 14 days. Below that it shows
>   "building history" instead of guessing.
> - Today's price never goes into the baseline it's compared against.
> - Every price shows when I retrieved the data. The fare itself can be older (it comes from a search
>   cache), so treat it as an indication. The method is written up:
>   https://sparkfare.com/blog/how-we-rank-deals
>
> Limits, up front: it's new. The original twelve airports have about a month of history; ten more
> were added this month and mostly say "building history". Some of those get little data from the
> source at all. The cache is not a live quote, and fares change between the cache and the booking
> site. Prices for airports other than JFK are about a day behind. I don't predict prices.
>
> Sparkfare is a deal-information site. It doesn't sell or arrange travel; links go to Aviasales, and
> I may earn a commission on bookings made through them, at no extra cost to you. Ranking uses price
> history only; commissions don't enter it.
>
> Stack: Cloudflare Workers + D1, a Python pipeline on GitHub Actions, vanilla JS front end. The repo is
> public: https://github.com/centeen/sparkfare
>
> I'd like to hear where the method is wrong, especially the MAD threshold and the 14-day minimum.
> Link: **[Show HN UTM link]**

**Before posting:** HN penalizes asking for upvotes, so don't. Post from an account with some history if
you can, and stay available for the first few hours to answer comments. **[CONFIRM]** the repo link and
that you want it named.

---

## 2. Product Hunt

**[CONFIRM]** Whether Saturday 12:01 a.m. PT is still the slot. Saturdays tend to be quieter than
weekdays.

**Name:** Sparkfare

**Tagline** (60 characters): `It only sparks when the fare's real.`
Alternative that says what it does: `Check if a flight price is good, against its own history.`

**Description** (260 characters):
`Enter a route and the price you were quoted. Sparkfare compares it with that route's own 30-day median and says how far above or below it is. Daily deal alerts from 22 US airports. No predictions, no "buy now".`

**Topics:** Travel, Flights, Price Tracking

**First comment (maker):**

> Hi, I'm Coby. I built Sparkfare because I couldn't tell whether a "deal" on a flight site was one.
>
> What it does today:
> - **Price check:** type a route and a price; it tells you the percentage against that route's own
>   30-day median. It says nothing about whether to buy.
> - **Deal board:** 880 routes from 22 US hubs. A route is flagged only when it's well below its own
>   typical range, using a robust threshold, and only with enough history. Otherwise it says "building
>   history".
> - **Daily email:** deals from your home airport, with an unsubscribe link in every one.
> - **Trip checklist ("Away Mode"):** a short list of things to sort before you leave, with partner
>   links. I may earn a commission from those too, and the ranking doesn't consider commissions.
>
> It's new. The original twelve airports have about a month of history; the ten I added this month
> are still building theirs. Prices come from a cache; the time shown is when I retrieved the data,
> and the fare itself can be older. It is not a live quote.
>
> What would make you trust a "good price" label more? That's what I most want to learn.

**Gallery ideas:** a screenshot of `/check` with a result; one hero deal card; the "building history"
state (shows honesty). **[CONFIRM]** you have or want these made. I can capture them from the live site.

---

## 3. Reddit (one tailored post per community; do NOT cross-post the same text)

I haven't checked any subreddit's current rules and shouldn't guess them. Before each post: read the
sidebar, look for a self-promotion ratio rule or a weekly promo thread, and message the mods if it's
unclear. Many travel and deals subreddits remove tool promotion, so the **question/discussion form**
below is safer than a link post.

**Form A, discussion post (preferred where tools are unwelcome):**

> **Title:** How do you tell whether a quoted fare is actually good?
>
> I kept seeing "great deal" labels with no basis, so I started comparing quotes with each route's
> own recent history. For a route like JFK-Lisbon, the median cheapest fare over the last 30 days is
> a more honest yardstick than a site's own claim, and a quote 20% under that is rare.
>
> What do you use? Price history tools, Google Flights' graph, your own spreadsheet?
>
> (I built a small free checker around this idea, so I'm biased: sparkfare.com/check. It's new and
> only has about a month of history on the original airports and less on the newer ones. Happy to
> take it down from this post if it breaks a rule.)

**Form B, where tools are allowed (Show-off or project threads):**

> **Title:** I built a free "is this flight price good?" checker
>
> You enter a route and a quoted price; it compares it with the median of that route's cheapest daily
> fares over the last 30 days and shows the percentage difference. It doesn't predict prices or tell
> you to buy. It's new (about a month of history on the original airports, less on newer ones),
> prices come from a cache and the time shown is when I retrieved the data, and I may earn an
> affiliate commission on links to Aviasales. Method:
> sparkfare.com/blog/how-we-rank-deals. I'd like to know where it's wrong.
> **[Reddit UTM link]**

Reddit reads disclosure well and punishes the opposite. Reply to every comment in the first hours.
Don't ask friends to upvote.

---

## 4. Indie Hackers

> **Title:** Launching Sparkfare: flight prices judged against each route's own history
>
> I'm launching Sparkfare on Oct 17. It's a flight-deal alert site with a price checker, built on
> Cloudflare Workers, D1 and a Python pipeline on GitHub Actions. Revenue is affiliate commissions
> (flights through Aviasales, and a short pre-trip checklist with partner links), not subscriptions yet.
>
> Honest numbers: **[CONFIRM and fill in: signups to date, traffic]**. The product has been built over
> about six weeks; the original twelve airports have about a month of price history and ten newer ones
> are still building theirs; payouts from affiliates run on roughly 60-day terms, so launch month will
> show little revenue.
>
> What I'd like feedback on: whether "no verdicts, no predictions" is a positioning or a weakness.
> **[Indie Hackers UTM link]**

Only publish numbers you can show. I'd leave the revenue line out unless you want to share it.

---

## 5. X / Bluesky (short)

> A flight price is only "a deal" relative to something. Sparkfare checks a quote against that route's
> own 30-day median, shows the percentage, and says nothing about whether to buy. New and free; about a
> month of history on the original airports. **[X UTM link]**

Post once at launch. A thread isn't needed.

---

## 6. Directory blurbs (alternatives and product directories)

**One line (about 90 characters):** `Check if a flight price is good against its own 30-day history. Free daily deal alerts.`

**Short (about 250 characters):**
`Sparkfare compares a flight price with that route's own 30-day median and shows the percentage, with no predictions. Covers 880 routes from 22 US hubs, with a daily deal email and a pre-trip checklist. Free. We may earn commissions from links.`

**Category tags:** Travel, Flights, Price tracking, Deal alerts.

**Likely competitors to name when a directory asks "alternative to":** Google Flights, Hopper,
Skyscanner, Kayak. Say what differs: Sparkfare states its comparison basis and doesn't predict.
**[CONFIRM]** you're comfortable naming them.

---

## Claims I did NOT put in any draft, and why
- **"Real-time" or "live prices":** the data is cached; the time shown is retrieval time and the fare can be older.
- **"Best price" or "cheapest" claims, and any statement that a fare is bookable at the price shown:** the cache
  is not a quote.
- **A count of current deals:** it changes daily and I haven't pinned a number.
- **Subscriber, traffic or revenue figures:** I can't verify them from here.
- **Any claim that Sparkfare is licensed, registered or exempt:** the copy rule bans legal-status wording.
- **"Free forever":** a paid tier is being designed; I don't want to promise something you may change.
- **Star ratings, testimonials or press:** none exist.

## Still open on your side
1. Pick the venues and dates (the timing question from earlier).
2. Answer the **[CONFIRM]** items above.
3. Read each community's rules.
4. Log every post URL and outcome in `state_DECISION_LOG.md` (step 52 asks for this); I can set up a
   table for it.
