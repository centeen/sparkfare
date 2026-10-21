# Sparkfare Growth & GTM Plan v1 (for approval)

Oct 21, 2026 · @Coby

## Consult summary

**Recommendation: test this as one integrated plan.** Win the first 100 subscribers by hand, the next 400 with a well-run launch fortnight and two honest data moments, and the next 2,000 with loops that run without you. The plan leads with the three things only Sparkfare has: honest fare history, a live 2026 to 2027 time-off planner, and a leave-by plan for long trips.

|  |  |
| --- | --- |
| Question (neutral) | Which channels, assets and sequence would move Sparkfare from single-digit confirmed subscribers to hundreds within weeks of the Nov 7 launch and thousands by spring, measured by confirmed subscribers by source and visit-to-signup rate, inside the referral-only, no-urgency and passive-operations rules? |
| Owner's wording | "the best methods for building site traffic and acquiring users in the quickest manner… from single digit users to hundreds of users in a matter of weeks and later thousands" |
| Meter | Audience (confirmed subscribers) first; Fare and Leave through the people it brings |
| Goal ladder (owner goal, not a forecast) | 100 confirmed by Nov 7 · 300 to 500 by Dec 6 · 1,000 by Jan 31 · 2,500 by Mar 31 |
| Scores | GTM scorecard: 8 of the 30 scored ideas reach 30 or more of 40. Spark Score: X1 conversion pass = 48 (build); the other top ideas 24 to 30 (test), because v1 of the rubric gives pure acquisition a Value of 1 to 2. Weights equal: no F0 data yet |
| The split | Fast channels (Hacker News, Product Hunt, Reddit, social) reach Dana and Priya, the lowest-value acquirers. Elena, Tess and Ray & Linda, the monetizers, arrive through slow channels (search, niche communities, press) that AI answers are eroding. The plan runs two tracks rather than averaging them |
| Integrity | CONDITIONAL, 11 conditions (non-attorney guidance). Two ideas FAIL and are refused (giveaways; bought or swapped votes). The heaviest condition: Legal's own tracked item says any active marketing push makes Seller of Travel more urgent, so a decision is needed before Nov 7 |
| Quality gate | STATUS: PASSED (checklist in the council section) |
| Owner decisions | 9, listed in the last section. The three that shape everything: approve the plan, approve a time-boxed launch-sprint exception to the passive rule, approve the build-capacity swap |

**Pre-flight checks.** Capability ledger last verified Oct 13: 8 days old, under the 14-day limit (it lapses Oct 27). Synced `wrangler.jsonc` shows `ENABLE_T3_REFERRALS` "true", `ENABLE_LONG_LEAVE` "false", `ENABLE_PINTEREST` "true" with `PINTEREST_ENV` "sandbox", `ENABLE_X_BROADCASTER` "false". Two conflicts are logged for reconciliation: the ledger says referral rewards are locked while the live `/hub` lists four reward tiers; the homepage still claims 880 routes against 828 in the data. `state_METRICS.md` is still missing, so the only baseline is 8 visits in 24 hours (Oct 13) and the owner's "single digits".

**Loop steps run:** Frame, Ground, Convene (illustrative channel-reach reactions), Price, Guard, Score, Audit. Decide is yours.

## Part 1 · Sparkfare's essence

Sparkfare is the free, honest way for US travelers to plan international trips around the time off they actually have, and to leave home ready. Fares are judged against each route's own history, time off becomes trips that fit, and long absences get a leave-by plan.

| Element | What it is today (live unless marked) | Why it draws people |
| --- | --- | --- |
| Core concept | International-only fare alerts from 22 US hubs to 40 destinations, each judged against its route's 30-day median; referral-only, never sells or books | Clear, narrow promise; nothing to buy |
| Signature value | "It only sparks when the fare's real." Stated basis, as-of time, no "book now", no predictions | Trust in a category full of hype; Dana's whole test |
| Hook 1: `/check` | Paste a fare, see how it compares with that route's own history | Answers the question every traveler asks in forums: is this price actually good? |
| Hook 2: `/time-off` | Every long weekend through 2027, PTO cost per window, destinations that fit, `.ics` and share | Rides the annual "turn 10 PTO days into 40 off" story; Priya's favourite page |
| Hook 3: `/leave` and Away Mode | Leave-ready checklist and \~14 disclosed pre-trip partners; leave-by plan built dark for Nov 9 | Nobody else pairs fares with leaving home; Elena, Tess, Ray & Linda |
| Assets only Sparkfare has | Permissioned fare history (Travelpayouts written OK, Sep 23); departure-intent signal; planning tools paired with fares; the pre-trip partner stack | Original data: the 2026 currency for press, AI answers and Reddit |
| A free wedge (to verify) | Going's free Limited tier covers domestic deals only and international sits in its $49-a-year Premium, according to a competitor's comparison ([Thrifty Traveler](https://thriftytraveler.com/blog/thrifty-traveler-vs-going/)) and a coupon site ([coupons.com](https://www.coupons.com/coupon-codes/going)) | "Free international alerts" is an open position, if Going's own page confirms it on the day |
| Emotional promise | Honest anticipation: calm, no regret, no manipulation (Brand v1) | The opposite of the urgency the category trains people to distrust |

**Who it is for.** Acquirers: Dana, who starts from the fare and checks the basis, and Priya, who turns a small PTO budget into 5-to-9-day bridges. Retainer and amplifier: Marcos, who flies a family corridor with a party of three. Monetizers: Elena (a month or more away), Tess (teacher summers, on probation) and Ray & Linda (retirement scouts, on probation). Amplifier, reported separately: Gloria, the person who stays. Not for: domestic weekenders, mistake-fare and points chasers, fixed-fare business travelers.

**Limits to fix or say out loud before any big push.**

- Coverage: 28% of US routes could carry a deal verdict on Oct 16 data; 10 US origins had none. A visitor from MSP or PHX may see little.
- Accuracy: the homepage claims "880 routes"; the data holds 828. Press and Hacker News readers will check.
- Display: fare dates, nights and airline are not shown yet (Addendum J2 fixes this).
- Window fares are off, the share link is generic (J3 fixes it), signup tops out at "2+ weeks", and the digest is daily, not instant. English only.

**Proposed positioning line (for Guard and creative review):** "Free, honest international flight alerts, and a plan for the time off you actually have."

## Part 2 · What has grown products like Sparkfare

Every comparable's step change came from people talking (one press story, Reddit, word of mouth, a referral prompt), never from search in year one. In 2026 the search route is narrower still, while original data has become the thing press, AI answers and Reddit reward.

### Comparables

| Company | What moved it | Lesson for Sparkfare |
| --- | --- | --- |
| [Scott's Cheap Flights, now Going](https://www.cnbc.com/2016/11/29/how-a-29-year-old-turned-an-obsession-with-cheap-plane-tickets-into-a-1-million-business-in-under-2-years.html) | A Business Insider story in Apr 2015, found through Facebook; 646 premium subscribers 3.5 months later. The founder credits Reddit for a sizable share of subscribers. | A founder story plus Reddit is the proven ignition for this exact category |
| [Scott's, Indie Hackers interview](https://www.indiehackers.com/interview/scotts-cheap-flights-from-small-side-project-to-booming-business-de62ca54b1) | Kept the focus narrow; 44% of subscribers came by word of mouth | One sharp promise; make sharing easy |
| [Thrifty Traveler](https://tcbmag.com/the-thrifty-traveler-is-still-flying-high/) | Bootstrapped from 2015; found its niche in international deals; 1M+ monthly page views and 25,000 paid subscriptions by 2022; [regular local TV and 200,000 social followers by 2019](https://sitepilot09.firmseek.com/client/moss/www/news-moss-and-barnett-advocate-we-are-proud-to-recognize-thrifty-traveler-and-jared-kamrowski) | International is a real niche; recurring local media compounds |
| [Jack's Flight Club](https://en.wikipedia.org/wiki/Jack%27s_Flight_Club) | Set up for £30 in Sep 2016; 500,000 subscribers by May 2018; [a weekly column in The Independent](https://jacksflightclub.com/press) | A recurring byline is a channel, not a one-off |
| [HolidayPirates](https://www.phocuswire.com/whatsapp-travel-brands-meta-communication) | WhatsApp Channels grew eightfold to 625,000 followers from Mar 2024; [over 4% of its traffic at no cost](https://eglobaltravelmedia.com.au/?p=1437508) | Messaging channels are a free distribution layer for deals |
| [The Flight Club (Italy)](https://www.theflightclub.it/en/2025/01/canale-whatsapp-voli-offerte-biglietti/amp/) | WhatsApp channel opened Oct 2023, 44,000 followers by Jan 2025; three of four people interacting were not followers | Same; channel pages are browsable without following |
| [Morning Brew](https://digiday.com/media/publishers-use-free-swag-perks-keep-email-acquisition-costs-lower/) | Referrals drove about 35% of list growth; 225,000 readers referred at least one person; a share block in every issue | A referral prompt in every email, with a reward people want |

### The 2026 channel landscape

| Channel | What the evidence says (as of source date) | What it means for Sparkfare |
| --- | --- | --- |
| Google organic, travel | Similarweb: travel and tourism search referrals down 20% year on year; AI search replaced about 10% of it ([CO/AI, 2026](https://getcoai.com/news/googles-ai-overviews-slash-website-traffic-30-since-may-launch/)). Seer: organic click-through fell 61% on queries with AI Overviews; brands cited in them earn 35% more clicks ([Travel Talk](https://traveltalkmedia.com.au/googles-ai-revolution-is-changing-travel-search-is-the-industry-ready/)) | Do not bet the first 90 days on SEO. Build pages to be cited, not just ranked |
| AI answer engines | Small, well-organised, current sites can be cited by Perplexity ([Lilach Bullock](https://www.lilachbullock.com/how-to-get-cited-on-perplexity/)); original data appeared in about half of posts ChatGPT cited in one audit (secondary report, unverified: [NeuronWriter](https://neuronwriter.com/how-to-rank-in-perplexity-and-get-cited-by-chatgpt-the-ultimate-playbook/)) | Sparkfare's fare history is exactly the original data these engines look for |
| Product Hunt | 40 to 60% of launch-day upvotes come from the maker's own audience; weekends bring less traffic but an easier board ([launch guide](https://app.getlaunchlist.com/blog/how-to-launch-on-product-hunt-2026), [Stackmatix](https://www.stackmatix.com/blog/launching-on-product-hunt)); both secondary | A warm list before Nov 7 matters more than the page |
| Reddit | 90/10 rule; disclose affiliation; each subreddit sets its own rules; first signups usually after 30 to 60 days of participation ([Redship](https://redship.io/blog/reddit-self-promotion-rules), vendor) | Start participating now; post data, not links |
| Newsletter networks | SparkLoop free recommendations exist; paid growth starts at $100 a month ([SparkLoop help](https://help.sparkloop.app/en/articles/9184574-the-ultimate-guide-to-sparkloop-features-pricing)); one review says its milestone referral tool closed to new accounts in May 2026 ([Creator Economy Tools](https://creatoreconomytools.com/tool/sparkloop), unverified) | Use Sparkfare's own `/hub` for referrals; apply for free recommendations once the archive proves the digest |
| Directories | Anecdotal: InboxReads brought about 12 subscribers to one newsletter ([Indie Hackers](https://www.indiehackers.com/post/website-directories-which-ones-are-worth-it-c843e5b880)); The Sample about 7 to 10 a month | One-time listing; small but free |
| Journalist requests | Source of Sources is free, from HARO's founder; Qwoted carries the largest share of requests ([Everything PR](https://everything-pr.com/haro-earned-media-placements), [BuzzStream](https://buzzstream.com/blog/journalist-request-platform-study/)) | 15 minutes a day during the sprint can earn quotes and links |
| PTO press cycle | Fortune ran "PTO-maxxing" in May 2026 ([Fortune](https://fortune.com/2026/05/27/how-to-max-out-paid-time-off-in-2026-pto-maxxing/)); National Plan for Vacation Day falls on the last Tuesday of January ([Denver Life](https://www.denverlifemagazine.com/?p=63895)) | The live 2027 planner is a ready press asset; the window opens late December |
| Data PR | Expedia's Air Hacks report, built on ARC data, has run nine years and is widely picked up ([Nasdaq release](https://www.nasdaq.com/press-release/expedia-2025-air-hacks-report-flight-prices-down-august-cheapest-month-and-sunday)) | A smaller, honest, no-prediction report from 22 hubs fits the brand |
| Short video | 48% of Gen Z respondents in Spain, Italy and the UK cite TikTok for travel inspiration ([Euronews, Aug 2026](https://www.euronews.com/2026/08/21/i-saw-it-on-tiktok-48-of-gen-z-travellers-turn-to-the-platform-for-travel-inspiration)) | Reaches Priya; posting is manual |
| Pinterest | Travel content keeps sending clicks for months ([Stray Travel case](https://www.tomahawk.co.nz/our-work/stray-travel-pinterest-strategy)) | Evergreen fit for PTO calendars; Sparkfare's integration is built, in sandbox |
| Competitors | Google Flights tracks prices on "any dates" for 3 to 6 months ([Outlook Traveller](https://www.outlooktraveller.com/whats-new/google-unveils-insights-for-budget-friendly-flight-booking)); Going launched Price Drop in Sep 2026 ([Simplify](https://simplify.jobs/c/Going)) | Do not market "alerts". Market honest, international, planned and ready to leave |

**Five lessons that shape the plan.**

1. The step change is earned media and community, so the plan needs a few owner hours a week for a short time.
2. A narrow, sharp promise beats breadth: lead with one hook per audience.
3. Every burst must land in the list: confirmation, share and referral prompts come before traffic.
4. Original data is the asset that serves press, AI answers and Reddit at once.
5. Referral prompts work when they sit in every email, not on a page people must find.

## Part 2b · The full recommendation list (31 ideas)

Thirty-one ideas in nine groups; each is PROPOSED until you approve it, and each new screen or email still needs a mock and a Guard read. "Built on" names the live ledger item it reuses.

| ID | Idea | Exactly what | Reaches | Built on |
| --- | --- | --- | --- | --- |
| **A · Launch moments** |  |  |  |  |
| L1 | Founding list from your own network | 100 to 150 people you know who travel abroad, one personal note each on launch morning; nothing imported into the list | Friends of all personas | L02 |
| L2 | Product Hunt, Sat Nov 7 (scheduled) | Gallery in Brand v1, maker comment, a reply to every comment for 12 hours | Early adopters, Dana | L01, L04 |
| L3 | Show HN, Tue Nov 10 | "Is this flight price actually good?" leading with `/check` and the method | Dana, technical travelers | L04 |
| L4 | Reddit data post | One original chart from Sparkfare's history (for example, how often international fares from 22 hubs sat 15% under their median this autumn), posted where original-content posts are allowed, plus disclosed answers in travel threads | Dana, Priya, Elena | L03, L04 |
| L5 | Indie Hackers build-in-public post | The honest-deal-site story with real numbers | Makers (low traveler value) | — |
| L6 | Directory batch | Product directories (G21) and newsletter directories (InboxReads, The Sample) in one sitting | Mixed | L01 |
| **B · Owned loops** |  |  |  |  |
| O1 | Referral prompt everywhere | `/hub` link on the confirmation page, in the welcome email and in every digest footer; first reward stays "a second home airport" | Marcos, Priya-for-two | L14 |
| O2 | Share cards | A share image for a `/check` result and a plan-carrying `/time-off` share link (with J3); never the traveler's dates | Priya, Dana, Gloria | L04, L06 |
| O3 | Widget for blogs and communities | Promote the existing embed to travel bloggers as inbound only (G16) | Bloggers' readers | L35 |
| **C · Search and answer engines** |  |  |  |  |
| S1 | Answer-engine basics | A methodology page, short answer blocks on `/check` and `/time-off`, schema, `llms.txt`, Bing Webmaster Tools and IndexNow on publish | Anyone asking an AI | L03, L04, L06 |
| S2 | 2027 PTO hub, press-ready | Printable and `.ics` "2027 long weekends from your airport", a social image, a method note, an embed snippet | Priya, press, Tess later | L06 |
| S3 | Holiday window pages | "Thanksgiving and Christmas international windows from \[hub\]": history only, basis and as-of | Priya, Marcos | L03, L06 |
| S4 | Free international alerts comparison page | Factual, dated comparison with Going and Google Flights (re-scores G18) | Dana | L01 |
| **D · Earned media and data** |  |  |  |  |
| P1 | Honest Holiday Fare Report | What 22 hubs' international fares did around Thanksgiving and Christmas, from stored history, with method and sample sizes; one press note | Press, Dana, Priya | L03 |
| P2 | Founder story pitch | "An honest flight-deal site that refuses to say book now" to the 15 to 25 reporters who covered airfare or PTO in 2026 | Press | — |
| P3 | Journalist requests | Source of Sources and Qwoted free tiers, about 15 minutes a day during the sprint | Press | — |
| P4 | Local press by hub | The report cut per hub ("winter escapes from Minneapolis") for local outlets and TV | Local audiences | L03 |
| P5 | National Plan for Vacation Day, Jan 26 | Tie the 2027 planner and data to the day | Priya, press | L06 |
| **E · Communities** |  |  |  |  |
| C1 | Reddit participation (90/10) | Answer "is this fare good?" questions, link `/check` only when it answers, disclosed | Dana | L04 |
| C2 | Niche groups with admin permission | Teacher-travel, retire-abroad and nomad groups; one helpful post each, admins asked first | Tess, Ray & Linda, Elena | L08, L09 |
| C3 | Newsletter swaps | One-time swaps with nomad, PTO or retire-abroad newsletters | Elena, Ray & Linda | L02 |
| **F · Partners and networks** |  |  |  |  |
| N1 | SparkLoop free recommendations | Apply now the archive is live; recommend and be recommended for free | Newsletter readers | L16 |
| N2 | Away Mode partner mentions | Ask live partners (US Global Mail, AirHelp, Bounce) for a resource-page or newsletter mention | Their customers | L09 |
| N3 | HR and employee newsletters | Offer the PTO planner as a free resource for teams | Priya | L06 |
| **G · Social and messaging** |  |  |  |  |
| G1 | Bluesky and Mastodon upgrade (live) | Same automation, data-led posts with the basis on the image | Dana | L33 |
| G2 | Short video from data | Weekly templated clip ("this week's honest fare from JFK"); posting is manual unless an API is approved | Priya | L33 |
| G3 | Pinterest (built, sandbox) | Apply for standard access; auto-pin PTO calendars and route cards | Priya, Tess | L33 |
| G4 | WhatsApp Channel test | Three posts a week of verified deals; manual posting | Marcos, Dana | L01 |
| **H · Conversion and retention** |  |  |  |  |
| X1 | Homepage and signup conversion pass | One action above the fold, "see a sample digest" link to `/digest`, origin first, no pop-ups | Everyone | L01, L02, L16 |
| X2 | Source-aware first 30 days (G13) | Welcome emails by source and trip length | Everyone | L02, L12 |
| X3 | Measurement kit | Source tag on every signup path, a daily owner dashboard, the Day-14 baseline in `state_METRICS.md` | Business bench | L19, F1 |

**Refused (integrity or brand), not scored as options:** giveaways or sweepstakes for signups; buying, swapping or asking for votes and reviews; fake or borrowed social proof; countdowns and "only X left"; mistake fares and domestic routes; co-registration or list imports without the person's own opt-in; mass AI-written pages; cold direct-message blasts; second accounts. Paid ads stay out under the Sep 13 zero-acquisition-cost decision unless you reopen it.

## Part 3 · Pressure test and scores

Eight ideas score 30 or more of 40, and together they form the core of the plan: the 2027 PTO hub, the Honest Holiday Fare Report, the referral prompt, the conversion pass, Show HN, the warm founding list, answer-engine basics and the founder story. All scores are Hub and council judgment \[I\]; no F0 or channel data exists yet.

**How to read the scores (1 to 5 each, 5 is best).** Value: quality of the users it brings and the meter they move. Impact: reach in 90 days. Speed: time to the first users. Fit: brand, personas and guardrails. Growth: the 90-day band, 1 under 50 people, 2 is 50 to 200, 3 is 200 to 500, 4 is 500 to 2,000, 5 over 2,000. Effort: 5 is the least owner and build time. Passive: 5 is no recurring work. Evidence: 5 is strong comparables. Integrity is a gate, not a score.

| ID | Idea | Value | Impact | Speed | Fit | Growth | Effort | Passive | Evidence | Total /40 | Integrity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S2 | 2027 PTO hub, press-ready | 3 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | 33 | PASS |
| P1 | Honest Holiday Fare Report | 4 | 4 | 4 | 5 | 4 | 3 | 4 | 5 | 33 | CONDITIONAL |
| O1 | Referral prompt everywhere | 4 | 3 | 4 | 5 | 3 | 4 | 5 | 5 | 33 | CONDITIONAL |
| X1 | Homepage and signup conversion pass | 4 | 3 | 4 | 5 | 3 | 4 | 5 | 4 | 32 | PASS |
| L3 | Show HN on `/check` | 2 | 4 | 5 | 5 | 3 | 4 | 5 | 3 | 31 | CONDITIONAL |
| L1 | Founding list from your network | 3 | 2 | 5 | 5 | 2 | 4 | 5 | 4 | 30 | PASS |
| S1 | Answer-engine basics | 3 | 3 | 3 | 5 | 3 | 4 | 5 | 4 | 30 | PASS |
| P2 | Founder story pitch | 3 | 4 | 3 | 4 | 4 | 3 | 4 | 5 | 30 | CONDITIONAL |
| L4 | Reddit data post | 3 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 29 | CONDITIONAL |
| O2 | Share cards | 3 | 3 | 3 | 5 | 3 | 3 | 5 | 4 | 29 | CONDITIONAL |
| L2 | Product Hunt | 2 | 3 | 5 | 4 | 3 | 3 | 5 | 3 | 28 | CONDITIONAL |
| S3 | Holiday window pages | 3 | 3 | 4 | 4 | 3 | 3 | 5 | 3 | 28 | CONDITIONAL |
| P5 | National Plan for Vacation Day | 3 | 3 | 2 | 5 | 3 | 4 | 4 | 3 | 27 | CONDITIONAL |
| X2 | Source-aware first 30 days | 4 | 2 | 3 | 5 | 2 | 3 | 5 | 3 | 27 | PASS |
| N1 | SparkLoop free recommendations | 2 | 3 | 2 | 4 | 3 | 4 | 5 | 3 | 26 | PASS |
| G3 | Pinterest | 2 | 3 | 2 | 4 | 3 | 4 | 5 | 3 | 26 | PASS |
| S4 | Free international alerts comparison | 3 | 2 | 3 | 3 | 2 | 4 | 5 | 3 | 25 | CONDITIONAL |
| P4 | Local press by hub | 3 | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 25 | CONDITIONAL |
| C3 | Newsletter swaps | 4 | 2 | 3 | 4 | 2 | 3 | 4 | 3 | 25 | PASS |
| G1 | Bluesky and Mastodon upgrade | 2 | 1 | 5 | 4 | 1 | 5 | 5 | 2 | 25 | PASS |
| L6 | Directory batch | 2 | 1 | 4 | 4 | 1 | 4 | 5 | 3 | 24 | PASS |
| N3 | HR and employee newsletters | 3 | 3 | 2 | 4 | 3 | 3 | 4 | 2 | 24 | PASS |
| L5 | Indie Hackers post | 1 | 2 | 5 | 3 | 1 | 4 | 4 | 3 | 23 | CONDITIONAL |
| O3 | Widget for blogs | 2 | 2 | 2 | 4 | 2 | 4 | 5 | 2 | 23 | CONDITIONAL |
| P3 | Journalist requests | 3 | 3 | 3 | 4 | 3 | 2 | 1 | 4 | 23 | CONDITIONAL |
| C2 | Niche groups with admin permission | 4 | 2 | 3 | 4 | 2 | 3 | 3 | 2 | 23 | CONDITIONAL |
| G4 | WhatsApp Channel test | 2 | 3 | 3 | 3 | 3 | 3 | 2 | 4 | 23 | CONDITIONAL |
| C1 | Reddit participation | 3 | 3 | 2 | 4 | 3 | 2 | 1 | 4 | 22 | CONDITIONAL |
| N2 | Away Mode partner mentions | 3 | 2 | 2 | 4 | 2 | 3 | 4 | 2 | 22 | PASS |
| G2 | Short video from data | 2 | 4 | 2 | 3 | 4 | 2 | 2 | 3 | 22 | CONDITIONAL |

X3, the measurement kit, is a foundation and is not scored: without it no channel above can be judged.

**What the pressure test found.**

- **The two highest-impact ideas cost the most owner time.** Reddit (L4, C1), the founder pitch (P2) and journalist requests (P3) carry the strongest evidence but score 1 to 3 on Passive. They are the reason the plan asks for a time-boxed exception.
- **Product Hunt is weaker than its place in the current plan.** It scores 28, below Show HN, because the audience is makers, the launch is on a Saturday, and there is no warm list yet. Keep it (it is scheduled and costs little) but stop treating it as the launch.
- **Data is the multiplier.** P1, S2, S3, P4, L4 and S1 all draw on the same stored history, so one generator script feeds six ideas.
- **Fit drops where coverage is thin.** Any idea that sends a visitor from MSP, PHX, DFW or BOS to a page with no verdict wastes the visit; the plan routes those visitors to `/time-off` and `/check` instead of the deal board.
- **Messaging channels have strong evidence and poor fit today.** HolidayPirates and The Flight Club grew large WhatsApp audiences, but posting is manual and Sparkfare's daily digest already does the job by email. Test G4 only if you accept the manual work.
- **Two ideas could hurt.** A comparison page (S4) and the Reddit data post (L4) are where a wrong number or a loose claim would cost the most trust. Both carry Guard conditions.

## Part 4 · The current GTM measured against the findings

The current plan is honest and well guarded, but it has no acquisition engine. Build capacity to Nov 4 goes almost entirely to design and accuracy work, the launch is a single Saturday spike with no warm list, and the channels that grew every comparable are blocked by the passive rule. Mean score 2.1 of 5.

| Area | What exists today (source) | What the evidence says | Gap | Now (1 to 5) |
| --- | --- | --- | --- | --- |
| Promise and hook | Hero "Look forward to it. Honestly." (D-026); launch drafts lead with `/check` (ROADMAP step 52) | One narrow, sharp promise per audience | No acquisition line per audience; the free international position is unused | 3 |
| Pre-launch audience | Product Hunt scheduled for Nov 7 (D-012a); no list work | 40 to 60% of launch-day support comes from your own audience | No warm list | 1 |
| Launch sequence | Product Hunt plus X and Bluesky Nov 7; Show HN, Reddit and Indie Hackers "a few days after", dates to be set Nov 6 (D-012) | Spaced moments; weekday Hacker News; data-led Reddit | Order is right, dates and assets are missing | 3 |
| Owned loops | `/hub` live with four reward tiers; share loop G14 and source-aware emails G13 wait until Nov 9 (D-015) | A referral prompt in every email | The launch traffic arrives before the loop is wired | 2 |
| Earned media | At most four press notes a year (consult 2, decision a); seasonal report G15 scored 36, test, unscheduled | One story moved Scott's from about 300 to 3,000 | No report or pitch in the holiday window | 1 |
| Search and AI answers | 289 route URLs in the sitemap (Oct 12 walk); F2 proposes noindex for thin pages; 40+ blog posts | Cited brands earn more clicks; original data gets cited | No method or dataset page; many route pages carry no verdict | 2 |
| Communities | Personal Reddit account route with disclosure (D-011e); subreddits not chosen (waiting item 11) | 90/10 participation for weeks before posting | Not started | 1 |
| Partners and networks | SparkLoop held; HouseSitters America parked (R-011); swaps wait for the readiness bar (D-011d) | Free recommendations exist now | Waiting, and plan v3.1 assumes a SparkLoop referral tool that may be closed to new accounts | 2 |
| Measurement | Cloudflare analytics on; PR #163 source tags; `state_METRICS.md` missing; F1 not reported | Every channel judged by confirmed signups per source | No baseline, no daily view | 2 |
| Build capacity | J and K: about 21 PRs in about 19 owner windows to Nov 4 (D-034); the first G19 articles already at risk | Growth work needs build time before the traffic | No growth build before launch | 1 |
| Integrity | Brand v1 behavior charter, Guard on every copy PR, referral copy checker | Trust is the product in this category | None; this is the strength | 5 |

**Keep:** the honesty system and Brand v1; the launch post drafts (they need the 880 fix and fresh numbers); Product Hunt on Nov 7; the affiliate readiness bar; Bluesky and Mastodon automation.

**Change:**

1. Treat launch as a fortnight of moments, not a day, with the warm list first and Show HN on a weekday.
2. Pull forward the smallest growth builds (measurement, referral prompt, share cards, report page, PTO page polish) by swapping out the three lowest-value Phase B packages.
3. Schedule one honest data report in the Thanksgiving and Christmas news window and one PTO release for the new year.
4. Give the owner a capped, time-boxed allowance for the manual channels the evidence favours.
5. Write the Day-14 baseline and a daily source dashboard before Nov 7, so every channel can be kept or cut on numbers.

## Part 5 · The plan: Spark, Launch, Compound

Four phases from today to Mar 31, each with a gate that keeps or cuts work on numbers. The north-star metric is **confirmed subscribers by source, counted weekly**; every channel is judged on confirmed subscribers per owner-hour, not on visits or upvotes.

&#91;embedded content: Growth plan v1 · 4 phases, 4 gates, 5 milestones · dates from this plan\]

The launch is a fortnight of moments rather than one Saturday, and each phase ends at a gate that keeps or cuts work on confirmed subscribers.

### Goals and what they require

The goals are yours; the funnel rates below are placeholders until the Day-14 baseline replaces them.

| By | Confirmed subscribers (goal) | Carried mainly by |
| --- | --- | --- |
| Sat Nov 7 | 100 | Founding list (L1), conversion pass (X1) |
| Sun Dec 6 | 300 to 500 | Launch fortnight (L2 to L6), Holiday Fare Report (P1), referral prompt (O1) |
| Sun Jan 31 | 1,000 | 2027 PTO release (S2), National Plan for Vacation Day (P5), free recommendations (N1), answer engines (S1) |
| Wed Mar 31 | 2,500 | Summer-planning content, Reddit and community compounding, swaps; matches ROADMAP's Phase exit gate |

| Placeholder funnel | Low | Base | High |
| --- | --- | --- | --- |
| Visit to signup | 2% | 4% | 6% |
| Signup to confirmed (double opt-in) | 60% | 75% | 85% |
| Visit to confirmed | 1.2% | 3.0% | 5.1% |
| Visits needed for 500 confirmed | about 41,700 | about 16,700 | about 9,800 |
| Visits needed for 2,500 confirmed | about 208,000 | about 83,000 | about 49,000 |

At today's 8 visits a day, 500 confirmed by Dec 6 needs roughly 10,000 to 42,000 visits in about four weeks \[I\]. Passive channels alone will not produce that; it takes one or two step-change moments (a press pickup, a Hacker News front page, a Reddit data post) plus the referral loop, which is why the plan is built around them.

### Phase 0 · Spark (now to Fri Nov 6): fill the bucket before opening the tap

**You (about 8 hours in total, in your evening and Friday windows):**

1. Write the founding list: 100 to 150 people you know who travel abroad. On launch morning send each a short personal note; nobody is added to the list unless they sign up themselves.
2. Open free Source of Sources and Qwoted profiles (topics: airfare data, PTO, international travel). Confirm your Reddit history is ordinary (D-011e), pick 6 to 8 subreddits, read their rules and start answering questions now.
3. Finish the Product Hunt page with the Hub: gallery in Brand v1, tagline, maker comment.
4. Build a press list of 15 to 25 reporters who wrote about airfare or PTO in 2026 (one sitting).

**Claude Code: Addendum M, the growth pack (written after your approval, run inside the merge train):**

| Package | What it delivers | Replaces in the pre-launch queue |
| --- | --- | --- |
| M1 Measurement | Source tag confirmed on every signup path; a daily owner view of visits, signups and confirmations by source; Day-14 baseline into `state_METRICS.md` (Oct 27 to 31) | K-B6 night mode moves after launch |
| M2 Referral prompt | `/hub` link on the confirmation page, in the welcome email and in every digest footer (copy Guard-read) | K-B9 directory and blog polish moves after launch |
| M3 Share cards | `/check` result share image; plan-carrying `/time-off` share link (joins J3); no traveler dates | K-B7 image work moves after launch |
| M4 PTO 2027 page | Printable and `.ics` long-weekend calendar per airport, social image, method note, embed snippet | (uses the space above) |
| M5 Report page | Honest Holiday Fare Report, generated by script from stored history, with method, sample sizes and as-of; repeatable monthly (ROADMAP 39 and 54) | (uses the space above) |
| M6 Answer-engine basics | Method page, answer blocks, schema, `llms.txt`, Bing Webmaster Tools and IndexNow | After launch if capacity is short |
| M7 Conversion pass | One action above the fold, sample-digest link, origin first, no pop-ups (with K-A) | Shares K-A work |

The swap mirrors the "Core" setting on the existing pace dial (D-034), so the Nov 4 last merge and the freeze do not move.

**Hub:** refresh the launch posts (880 fixed, current numbers), draft the report text and press note, the PTO release note, subreddit-specific posts, and a Guard read of each before you post.

**Gate G0 at the Nov 6 go/no-go:** J1 accuracy merged; route count corrected; a test signup shows its source; referral prompt live; report page ready (may stay unlinked); your Seller of Travel decision logged.

### Phase 1 · Launch fortnight (Sat Nov 7 to Fri Nov 20)

| When (Israel time) | What | Who |
| --- | --- | --- |
| Sat Nov 7, 10:01 | Product Hunt live (12:01 a.m. PT); maker comment at once | You |
| Sat Nov 7, 10:15 to 13:00 | X and Bluesky post; personal notes to the founding list | You |
| Sat Nov 7, all day | Reply to every Product Hunt comment | You |
| Tue Nov 10, 18:00 (11:00 ET) | Show HN on `/check` and the method; answer comments that evening | You |
| Wed Nov 11 | Publish the Honest Holiday Fare Report; press note to the list; matching journalist requests | You and the Hub |
| Thu Nov 12, 18:00 | Reddit original-data post where the rules allow, plus 1 to 2 disclosed posts in travel subreddits | You |
| Fri Nov 13 | Indie Hackers post | You |
| Sat Nov 14 | Directory batch (product and newsletter directories) | You |
| Nov 15 to 20 | Reply loop; 15 minutes a day on journalist requests; fix-only PRs for what the launch reveals | You, Claude Code |

**Gate G1 (Fri Nov 20):** 150 or more confirmed, continue; 75 to 149, shift effort to the two best channels by confirmed per hour; under 75, fix conversion before buying more attention.

### Phase 2 · Compound (Sat Nov 21 to Thu Dec 31)

1. G13 source-aware welcome emails and G14 share loop (D-015 Phase 2), now on top of M2 and M3.
2. Apply for SparkLoop free recommendations; turn on G8 if accepted.
3. Weekly: one Reddit contribution, three journalist responses, the automated Bluesky and Mastodon posts.
4. As Away Mode Wave 1 flips (from Nov 9), admin-approved posts in nomad, teacher-travel and retire-abroad groups and one or two newsletter swaps: the slow track for Elena, Tess and Ray & Linda.
5. Apply for Pinterest standard access; once approved, PTO calendars and route cards pin automatically.
6. Optional: a WhatsApp Channel test from Dec 1 if you approve the manual posting.

**Gate G2 (Sun Dec 6):** 300 to 500, on track; 150 to 299, add a second press push; under 150, re-plan with the council.

### Phase 3 · New-year wave (Fri Jan 1 to Wed Mar 31)

1. Tue Jan 5: "2027: turn your PTO into international trips" release and press note number two; per-hub versions for local press.
2. Tue Jan 26: National Plan for Vacation Day tie-in.
3. February: summer-break content for Tess (school calendar G2 if built) and "try a season" for Ray & Linda (G5, now parked, is your call).
4. Fri Feb 12: council gate with F0 data; check the affiliate readiness bar (5,000 visits and 500 subscribers) and apply to Rover and TrustedHousesitters if met.
5. After Jan 31 the manual allowance ends unless you renew it; what stays is passive: reports by script, loops, search, social automation.

### Rules that keep it honest and cheap

- **Owner time cap:** about 8 hours in Phase 0, about 14 in the launch fortnight, up to 4 a week to Jan 31, then under 1 a week.
- **Cut rule:** drop a manual channel that brings fewer than 5 confirmed subscribers per owner-hour after three attempts (placeholder; reset from the Day-14 baseline).
- **Coverage rule:** posts aimed at thin origins link to `/check` and `/time-off`, never to an empty board.
- **Every number public is measured:** routes, deals and subscriber counts appear only as measured values with an as-of date; no subscriber count is shown until it is real and worth showing.

## Council spokes

Each spoke's output sits under its own heading; the Hub only sequenced and summarized it.

### AGENT\_PRODUCT\_REALITY · Ground

| Ledger | Feature the plan uses | Status | Note |
| --- | --- | --- | --- |
| L01 | Deal board | Live | "880 routes" claim vs 828 in data (item 73) |
| L02 | Alert signup | Live | Tops out at "2+ weeks" |
| L03 | Route pages | Live | Many show no verdict (coverage 28%) |
| L04 | `/check` | Live | Round trip, no party size |
| L06 | `/time-off` | Live | Covers windows through end of 2027 (page read Oct 21); window fares off |
| L08, L09 | `/leave`, Away Mode | Live | Wave 1 leave-by plan built dark, earliest flip Nov 9 |
| L14 | Referral hub | Live | **Conflict:** ledger says rewards shown locked; live page (Oct 21) lists Extra Origin, More Watchlist Routes, Early Access, Founding Member |
| L16 | Digest archive | Live (repo) | Supports the sample-digest link and SparkLoop |
| L33 | Bluesky and Mastodon posting | Live (repo) | X off |
| L35 | Widget | Live (repo, unverified) |  |
| none | Pinterest integration | Built, sandbox | `ENABLE_PINTEREST` "true", `PINTEREST_ENV` "sandbox" in synced repo; no ledger row (proposed L37) |
| L20 | Long Leave | Built, flag off (synced repo) | Item 74 still open |
| M1 to M7 | Growth pack | Not started | PROPOSED; mocks needed for M2, M3, M7 |

Feasibility: M1, M2 and M4 reuse live features (days of work). M3 and M5 are new pages from existing data (a week each, inference). M6 is configuration and copy.

### Persona seats · Convene (illustrative reactions, not real people)

Each reacts to the live hook that the channel would show them, not to the channel itself.

| Persona | Reached by | Live hook | Use? | Objection | What would make me leave | Revenue moment | Conf. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dana (acquirer) | Reddit threads and Hacker News \[I, card tools\] | `/check` | H for `/check`, M for alerts \[I\] | "Show me the median in dollars and the dates, or it's just a number" | A stale price tagged as fresh, or any "book now" | View fare | 3 |
| Priya (acquirer) | PTO-hack articles, short video for ideas \[E10\] | `/time-off` 2027 | H \[I\] | "Which holidays are on by default? Mine gives five" | Wrong holiday defaults or PTO-hack hype | Watch a window | 3 |
| Marcos (retainer) | Family and corridor groups, a sibling's referral \[I\] | Route page plus referral reward | M \[I\] | "Is this for my dates and for three of us?" | His corridor has no data | Fare for three (not live) | 2 |
| Elena (monetizer) | r/digitalnomad \[E29\], nomad newsletters \[I\] | `/leave` | M: Long Leave is off \[I\] | "My trip is eight weeks. Which box do I tick?" | An insurance push | Mail partner | 3 |
| Tess (monetizer, probation) | Teacher-travel groups and blogs \[I\] | `/time-off` | L to M \[I\] | "I don't have PTO. I have a summer." | A planner that ignores school calendars | Summer leave items (later) | 2 |
| Ray & Linda (monetizer, probation) | Retire-abroad forums and groups \[I\] | `/leave` | Linda M, Ray L \[I\] | Ray: "Show me the data first." Linda: "Tell me what to ask before you show me who helps" | Advice creep or pressure | Mail plan | 2 |
| Gloria (amplifier, separate) | Only a link someone sends her \[I\] | Shared `/time-off` link | L today \[E: walkthrough 1.9 of 5\] | "This link isn't about my friend's trip" | Being marketed to without asking | None | 3 |

### AGENT\_REVENUE\_STRATEGIST · Price

Value per 100 confirmed signups over their first 90 days. A click is never revenue.

| Assumption | Low | Base | High | Source |
| --- | --- | --- | --- | --- |
| Fare clicks per signup in 90 days | 0.2 | 0.6 | 2 | placeholder |
| Value per fare click | $0.12 | $0.12 | $0.12 | project review, business model section 4 (reported) |
| Leave value per 100 signups | $0.12 | $3.38 | $36 | consult 7 placeholders |
| Newsletter recommendations accepted per 100 (after G8) | 0 | 5 | 15 | placeholder |
| Net per accepted recommendation | $1.50 | $3.00 | $5.40 | business model section 4 (reported range) |
| **Value per 100 signups** | **about $3** | **about $26** | **about $141** | arithmetic, not a forecast |

Assumption that drives the spread: leave-meter conversion. What F0 data would settle it: leave clicks and allocated leave revenue per 100 signups by trip-length bucket in `/admin/revenue`. **Reading:** growth earns little directly in 90 days; its value is that it buys the Dec 11 gate sample (30 per bucket), the affiliate readiness bar (500 subscribers) and the SparkLoop audience meter.

### AGENT\_GTM\_STRATEGIST · Channels and gates

Baseline supplied: 8 visits in 24 hours (Oct 13) and the owner's "single digits"; no channel is sized from it. Passive channels that reach the seated personas: `/time-off` and `/check` search and AI answers (Priya, Dana), the digest's referral prompt (Marcos), the report page and its monthly refresh (press), Pinterest auto-pins (Priya, Tess). Manual channels (Reddit, journalist requests, groups, swaps) need the owner's exception. Dependencies shown as gates: M1 before launch, J1 before any press, Wave 1 before slow-track community posts.

### Creative bench · Brand, UX, Behavioral design

Brand and Creative Director: launch assets follow Brand v1 (Paper and Ink, one Spark accent for verified deals only, Space Grotesk headlines); proposed line goes to copy review. UX and Accessibility: M3 share cards and M7 need 375 px checks and 44 px actions. Behavioral Design: referral rewards stay feature unlocks; one referral prompt per email, never a repeated ask, streak or progress pressure; the Founding Member badge is fine, a public leaderboard is not.

### AGENT\_LEGAL\_COMPLIANCE · Guard

**CONDITIONAL** (non-attorney guidance; have a licensed attorney review before anything binding is published or signed).

1. Seller of Travel (Step 23) lists "any active seed-audience or marketing push" as its trigger, and there is no liability entity. Record a decision (accept as with D-003, or ask counsel; form an entity or not) before Nov 7.
2. Every post, pitch and video that links the site says you built it and that it earns referral commissions; inline disclosure on the site stays.
3. No incentivized, swapped or requested votes, reviews or comments, and no second accounts; follow each platform's own rules. Candidate regime to verify with counsel: the FTC's rule on fake reviews and testimonials.
4. Comparisons with Going or Google Flights: factual, dated, read from their own pages on the day, names used only to identify them, no disparagement.
5. Reports and PTO content state history with basis, sample size and as-of; no predictions, no "you saved $X", no "cheapest day to book" claim the data cannot support.
6. The route count must be the measured number before any post or press note.
7. Referral rewards remain feature unlocks under the live terms page; referred signups use double opt-in.
8. Founding-list notes are one-to-one to people you know; nobody is added to the list without their own signup. Candidate regime: CAN-SPAM.
9. Share cards, links and tags carry no travel dates or personal data; UTM tags name the channel only.
10. Referral-copy rules and the Brand v1 banned-pressure list apply to every post.
11. No insurance partner in any launch or press material while Step 19 is open.

**FAIL:** giveaways or sweepstakes for signups (state contest rules, counsel needed); bought, swapped or requested votes and reviews.

### AGENT\_SYNTHESIZER · Score

| Idea | D | V | F | Spark | Rule |
| --- | --- | --- | --- | --- | --- |
| X1 Conversion pass | 4 (all seats benefit) | 3 (improves conversion to fare clicks) | 4 (Product Reality) | 48 | Build (PASS, metric: signups per 100 homepage visits) |
| S2 2027 PTO hub | 3 (Priya H, Tess and Elena L) | 2 | 5 | 30 | Test |
| O1 Referral prompt | 3 (Marcos H, Dana and Ray skeptical) | 2 | 5 | 30 | Test |
| L3 Show HN | 3 | 2 | 5 | 30 | Test |
| L1 Founding list | 3 | 2 | 5 | 30 | Test |
| P1 Holiday Fare Report | 3 (Dana H, Ray M) | 2 | 4 | 24 | Test |
| S1 Answer-engine basics | 3 | 2 | 4 | 24 | Test |
| P2 Founder story | 3 | 2 | 4 | 24 | Test |

Views: unweighted as above; value-weighted: weights equal, no F0 data yet. Gloria reported separately (L today). **Rubric note:** v1 gives pure acquisition a Value of 1 to 2, so no growth idea can reach "build". That is a limit of the rubric, not of the ideas; the owner's open question on which rubric governs (backlog question 9) now matters.

**Splits kept:**

- Fast vs valuable: fast channels bring Dana and Priya; Elena, Tess and Ray & Linda come slowly. Needs two tracks.
- Passive rule vs speed: the best-evidenced channels are manual. Needs an owner decision.
- Priya vs Tess on the PTO asset: it fits PTO, not school breaks. Needs a branch later (G2).
- Dana vs Marcos on the "free international" message: Dana wants the basis; Marcos needs dates and party size, so the message can overpromise to him.
- Ray vs Linda: Linda would share a checklist with their children; Ray wants the data first.

### AGENT\_QUALITY\_AUDITOR · Gate

1. Status grounded: PASS. Ledger rows and the synced `wrangler.jsonc` read; live `/`, `/hub`, `/time-off` read Oct 21; conflicts named.
2. No scope breach: PASS. Personas did not price or size; Revenue drafted no legal text; Hub added no claims of its own.
3. Statistics sourced or labeled: PASS. Each figure carries a linked source and date; secondary or vendor figures are labeled and none is load-bearing; funnel rates are placeholders.
4. Legal-adjacent claims flagged: PASS. Comparisons, disclosure, reviews, email and Seller of Travel carry Guard conditions; Legal output labeled non-attorney.
5. No fabrication: PASS. No user counts, testimonials or rates invented; persona lines labeled illustrative.
6. Assumptions stated: PASS. Funnel and revenue tables list every assumption and its source.
7. Conflicts surfaced: PASS. Referral-reward status, route count, SparkLoop referral tool and the passive rule are named and queued.
8. Attribution intact: PASS. Each spoke under its own heading.
9. Ledger respected: PASS. Personas reacted only to live hooks; M1 to M7 marked PROPOSED.
10. Persona honesty: PASS. Tags, one objection and one leave trigger per seat.
11. Splits preserved: PASS. Five splits kept, none averaged.

STATUS: PASSED

## Decisions for the owner

Nothing is built, posted or sent until you answer. Decisions 1 to 3 shape everything; the rest can follow this week.

1. **Approve Growth & GTM Plan v1 at test status** as the GTM plan. It replaces the acquisition parts of plan v3.1 (D-015); the affiliate readiness bar (D-011d) and the article plan stay.
2. **Approve a launch-sprint exception to the passive-operations rule** from Oct 22 to Jan 31: about 8 hours in Phase 0, about 14 in the launch fortnight, then up to 4 hours a week, for the manual channels named in the plan. It lapses on Jan 31 unless you renew it. If you decline, the plan shrinks to its passive tracks and the Dec 6 goal is unlikely \[I\].
3. **Approve the capacity swap:** Addendum M (M1 to M7) takes the pre-launch slots of K-B6, K-B9 and K-B7, which move after Nov 9. The Nov 4 last merge and the freeze stay.
4. **Use two of the four yearly press notes** (consult 2, decision a): the Holiday Fare Report on Nov 11 and the 2027 PTO release on Jan 5.
5. **Record a Seller of Travel and entity decision before Nov 7** (Guard condition 1): accept as is, or ask counsel; form an entity now or later.
6. **Founder visibility:** which name you use publicly, whether a photo appears, and how much of your story goes into the Product Hunt page and press pitch.
7. **Confirm the launch calendar:** Product Hunt Sat Nov 7, Show HN Tue Nov 10, report Wed Nov 11, Reddit Thu Nov 12, Indie Hackers Fri Nov 13, directories Sat Nov 14.
8. **Optional tests:** a WhatsApp Channel from Dec 1 (manual posting), and a Pinterest standard-access application. Yes or no to each.
9. **Scoring for channel ideas:** use this 8-criterion GTM scorecard for acquisition decisions and keep the Spark Score for product gems, or keep the Spark Score for both.

**On approval the Hub will:** log the decisions; write Addendum M for Claude Code; merge the scored rows into the council backlog; draft the founding-list note, the Product Hunt copy and the report outline for your review; and run Guard on each before anything goes live.

**New reconciliation items:** 96, referral rewards shown locked in the ledger vs four tiers on live `/hub`; 97, plan v3.1 assumes a SparkLoop referral tool that one review says closed to new accounts in May 2026; 98, Pinterest integration built and in sandbox with no ledger row; 99, the passive-operations rule vs the owner's growth goal.

## Sources

Found through web search on Oct 21, 2026; the three sparkfare.com pages were opened in full the same day. Figures carry the source's own date.

- Comparables: [CNBC on Scott's Cheap Flights](https://www.cnbc.com/2016/11/29/how-a-29-year-old-turned-an-obsession-with-cheap-plane-tickets-into-a-1-million-business-in-under-2-years.html) · [Indie Hackers interview](https://www.indiehackers.com/interview/scotts-cheap-flights-from-small-side-project-to-booming-business-de62ca54b1) · [TCB on Thrifty Traveler](https://tcbmag.com/the-thrifty-traveler-is-still-flying-high/) · [Moss & Barnett on Thrifty Traveler](https://sitepilot09.firmseek.com/client/moss/www/news-moss-and-barnett-advocate-we-are-proud-to-recognize-thrifty-traveler-and-jared-kamrowski) · [Jack's Flight Club (Wikipedia)](https://en.wikipedia.org/wiki/Jack%27s_Flight_Club) · [Jack's Flight Club press page](https://jacksflightclub.com/press) · [PhocusWire on HolidayPirates](https://www.phocuswire.com/whatsapp-travel-brands-meta-communication) · [eGlobal Travel Media on HolidayPirates](https://eglobaltravelmedia.com.au/?p=1437508) · [The Flight Club WhatsApp](https://www.theflightclub.it/en/2025/01/canale-whatsapp-voli-offerte-biglietti/amp/) · [Digiday on Morning Brew](https://digiday.com/media/publishers-use-free-swag-perks-keep-email-acquisition-costs-lower/)
- Competitors: [Thrifty Traveler vs Going](https://thriftytraveler.com/blog/thrifty-traveler-vs-going/) · [coupons.com on Going](https://www.coupons.com/coupon-codes/going) · [Simplify on Going](https://simplify.jobs/c/Going) · [Outlook Traveller on Google Flights](https://www.outlooktraveller.com/whats-new/google-unveils-insights-for-budget-friendly-flight-booking)
- Channels: [CO/AI on AI Overviews](https://getcoai.com/news/googles-ai-overviews-slash-website-traffic-30-since-may-launch/) · [Travel Talk on AI travel search](https://traveltalkmedia.com.au/googles-ai-revolution-is-changing-travel-search-is-the-industry-ready/) · [Lilach Bullock on Perplexity](https://www.lilachbullock.com/how-to-get-cited-on-perplexity/) · [NeuronWriter on AI citations](https://neuronwriter.com/how-to-rank-in-perplexity-and-get-cited-by-chatgpt-the-ultimate-playbook/) · [LaunchList Product Hunt guide](https://app.getlaunchlist.com/blog/how-to-launch-on-product-hunt-2026) · [Stackmatix on Product Hunt](https://www.stackmatix.com/blog/launching-on-product-hunt) · [Redship on Reddit rules](https://redship.io/blog/reddit-self-promotion-rules) · [SparkLoop pricing guide](https://help.sparkloop.app/en/articles/9184574-the-ultimate-guide-to-sparkloop-features-pricing) · [Creator Economy Tools on SparkLoop](https://creatoreconomytools.com/tool/sparkloop) · [Indie Hackers on directories](https://www.indiehackers.com/post/website-directories-which-ones-are-worth-it-c843e5b880) · [Everything PR on HARO alternatives](https://everything-pr.com/haro-earned-media-placements) · [BuzzStream request-platform study](https://buzzstream.com/blog/journalist-request-platform-study/) · [Fortune on PTO-maxxing](https://fortune.com/2026/05/27/how-to-max-out-paid-time-off-in-2026-pto-maxxing/) · [Denver Life on National Plan for Vacation Day](https://www.denverlifemagazine.com/?p=63895) · [Expedia Air Hacks release](https://www.nasdaq.com/press-release/expedia-2025-air-hacks-report-flight-prices-down-august-cheapest-month-and-sunday) · [Euronews on TikTok and Gen Z](https://www.euronews.com/2026/08/21/i-saw-it-on-tiktok-48-of-gen-z-travellers-turn-to-the-platform-for-travel-inspiration) · [Tomahawk on Stray Travel's Pinterest](https://www.tomahawk.co.nz/our-work/stray-travel-pinterest-strategy)
- Sparkfare: [sparkfare.com](https://sparkfare.com/) · [Referral Hub](https://sparkfare.com/hub) · [Time-off planner](https://sparkfare.com/time-off) · project files: business model v1.3, capability ledger (Oct 13), decision log D-001 to D-035, session state (Oct 20), plan v3.1, persona cards v3, synced `wrangler.jsonc`
