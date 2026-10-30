# Guard read: Addendum R, R1 interim fare wording (D-051; the request calls it D-053)

Oct 30, 2026, about 09:30 Israel. Non-attorney guidance; have a licensed attorney review before anything binding is published or signed. Strings are PROPOSED (not live). Audit: STATUS: PASSED.

**Limits of this read.** Ledger last verified Oct 13 (17 days; refresh owed). `src/` and `wrangler.jsonc` are not readable in the project, so no repo flag check. The R0 report (PR #426) and plan (#427) are not in the project; R0 findings are as the owner wrote them.

**Question (neutral):** Which fare-qualifier wording on every surface that prints a cached fare is true to what the cache supports, keeps one honest naming of Aviasales where a visitor leaves, and passes the copy rules, so the fare meter stays honest before the Nov 7 launch?
**Recommendation:** Build R1 (D-051 option B stands), but not as pasted: four strings change and two explainer pages need replacement text, not an added paragraph. Spark Score: not scored (copy fix under an adopted decision).
**The split:** Brand wants the fewest Aviasales mentions (Addendum H, step 97); Legal wants it named wherever a click leaves with nothing after it. Q1 satisfies both.
**Integrity:** CONDITIONAL.
**Owner decision needed:** approve R1 with these changes, and widen R1's scope to the strings and pages in Q3 and Q5 (Addendum R says "do not edit live copy outside R1's table")?
**Steps run:** Frame, Ground, Guard, creative review, Audit. **Skipped:** Convene, Price, Score (wording fix under an adopted decision; no new idea; no revenue effect claimed, as in D-051).

## AGENT_PRODUCT_REALITY
- Strings 1 to 6 are PROPOSED; nothing is built. Ledger L11: "live price may differ"; "Prices as of" is fetch time, not fare time. R0 as reported matches: `found_at` is when we asked the cache; the cache can be about two days old. The Oct 10 log gives 48 hours to 7 days from docs [U which bound holds].
- Live pages read Oct 30 [E]: `/how-it-works` says its freshness rules mean "you never see outdated claims disguised as current deals"; its FAQ says fares are judged "from when our daily fetch observed the quote"; `/blog/how-we-rank-deals` says "today's cheapest fare" and "a price older than 48 hours isn't judged at all". All three treat fetch age as fare age.
- [U]: whether cached fares are per adult and economy (`/how-it-works` says economy; the Oct 10 legal review lists whether cached prices include taxes and fees as unverified); whether every "View fare" lands on the interstitial or goes straight out.
- Conflict: the request says D-053; the log's next free number is D-051 and the staged file is D-051. D-052 and D-053 are not in the project.

## AGENT_LEGAL_COMPLIANCE: CONDITIONAL
| # | Verdict | What must change |
|---|---|---|
| 1 Freshness line | CONDITIONAL | "updated {n} h ago" reads as the fare was refreshed n hours ago; we only know when we asked the cache. Use "retrieved" (D-051 condition 3). |
| 2 Card note | PASS | True as written. See Q1 (naming) and Q6 ("may"). |
| 3 Interstitial | CONDITIONAL | Keep "Aviasales, not Sparkfare ... handles booking and payment" (D-018 handoff identification). Drop only "Fares change." "for your dates" is wrong: the dates are the fare's, not the visitor's. |
| 4 Email footer | CONDITIONAL | "one adult" has no source in the project [U]; confirm from code or Travelpayouts docs before it ships. "recent": see below. |
| 5 Explainer paragraph | CONDITIONAL | Must replace the three live sentences above, not sit beside them. Confirm from code that "lowest" is what the fetch keeps per route. |
| 6 Social | CONDITIONAL | "Seen in search data" is true. The daily Bluesky/Mastodon line says "Current flight price observation"; "current" implies now. Change it. |

"recent" (strings 3, 4, 5): the bound is about two days by R0 and up to 7 days by the Oct 10 docs. Drop the word, or state the bound once R0 confirms it.

**Not cured by R1.** A qualifier does not make "Deal", "% below" and "$ under" safe beside a price that does not reproduce (D-051 condition 4; 16 CFR 233.2 flagged earlier; verify with counsel). Only R2 or a counsel decision does. Also: the hero proof line "It only sparks when the fare's real" (D-026) sits badly beside "not a quote" until R2 is on; a public post cannot be corrected after it goes out, so social is where an unreproducible "% below" does most harm; the bag note is not DOT compliance, and D-003 stays open.

## The seven questions
| Q | Answer | Owner |
|---|---|---|
| 1 Aviasales naming | Yes, strings 2 and 6 may say "the booking site", provided Aviasales stays named on the interstitial (button and note), in `/disclosure`, in the email footer (string 4), and on any surface where "View fare" goes straight out with no interstitial. Claude Code lists which surfaces those are in R1's acceptance [U today]. | Legal, Brand |
| 2 Other freshness states | Keep "Last seen" and "Prices as of ... N days ago": neither implies verification (PASS). "Last seen" is a fetch date. "as of" is the older wording; move it to "retrieved" when next touched. | Legal |
| 3 Other age wordings | Unify on one pattern, "Search data retrieved ...", wherever a date is shown ("Fare data retrieved" and "search data retrieved" are one fact in two voices). Not needed for PASS; needs a scope amendment. | Brand |
| 4 Interstitial | Keep both, trimmed: the new pair plus "Aviasales, not Sparkfare, handles booking and payment". "confirms the final price" and "Fares change." go, since the new pair covers them. | Legal, Brand |
| 5 Explainers | Yes, as replacements: `/how-it-works` section 3 and its FAQ (and the FAQ structured data, matching the visible text), `/blog/how-we-rank-deals`, `/check`, `/disclosure`. | Legal |
| 6 Bags | "may" passes: true, and claims neither inclusion nor exclusion. "Baggage fees vary by airline" is about airlines, not this price, so it is weaker on a price note. R-013a shows $731 is personal-item only on Aviasales; if the cache never includes bags [U], say so plainly later. | Legal, Brand |
| 7 "updated" | Yes, it implies the fare was refreshed. Use "retrieved" (already on emails, route-page footer, share image, Pinterest). Even "retrieved n h ago" can read as the fare's age, so strings 3 and 5 carry "the fare itself can be older". | Legal |

## Persona seats: not convened.

## Brand and Creative Director: drift (PROPOSED; Guard decides final text)
1. Card, hero, route page: "Search data retrieved {n} h ago · {time} {zone}"
2. "Price can differ on the booking site. Bags may cost extra."
3. Interstitial: "Sparkfare shows prices from search data, not a quote for these dates. The price on Aviasales may be different. Aviasales, not Sparkfare, handles booking and payment."
4. Email footer: "Prices come from search data for one adult, round trip, and can differ on Aviasales." (hold "one adult" until sourced)
5. Explainers: "Fares are the lowest round-trip price for one adult found in search data we retrieved. They are not quotes, and the fare itself can be older than the retrieval time. The price on Aviasales can be higher or lower. The deal comparison uses our own 30-day history, not the Aviasales price."
6. Social: "Seen in search data; price can differ on the booking site." Bluesky/Mastodon: "Flight price in search data: {origin} to {dest} is ${price}."
Notes: "search data" is jargon to a first-time visitor; link the first mention to `/how-it-works`. On the share image the qualifier must be in the image itself, since it travels without the page. No banned phrase appears above; Claude Code still runs the copy checker.

## Behavioral Design: charter check PASS
No timeliness pressure, countdown or scarcity added. Metric: fare clicks per 100 card views before and after R1, reported, not a kill signal; the wording is a Guard condition, not an experiment.

## For Claude Code (add to Addendum R, R1)
1. Use the Brand strings, with "retrieved" and "booking site" as above.
2. Source "one adult" (and "economy") or drop it.
3. Replace, not add: the three live sentences; list every other freshness claim measured from fare age.
4. Acceptance also fails on "Checked", "observed", "never see outdated", "today's cheapest", "Current flight price observation" and "updated {n} h ago".
5. List per surface whether "View fare" goes via the interstitial.
6. Scope amendment for the Q3 and Q5 surfaces.
7. Fix the decision number (D-051 or D-053).

## AGENT_QUALITY_AUDITOR
1. Status grounded: PASS. L11 read; strings PROPOSED; `/how-it-works` and `/blog/how-we-rank-deals` fetched Oct 30. No workplan CSV in the project (missing file, noted).
2. No scope breach: PASS. Legal named conditions and drafted no copy; Brand drafted, set no price; Hub only sequenced.
3. Figures sourced or labeled: PASS. "About two days" is the owner's report of R0 (not read); 48 hours to 7 days is the Oct 10 log; neither drives the recommendation.
4. Legal-adjacent claims flagged: PASS. Non-attorney label; 16 CFR 233.2 and DOT items carried for counsel.
5. No fabrication: PASS. "One adult", "economy", bag inclusion and the interstitial path are labeled [U].
6. Assumptions stated: N/A. No projection.
7. Conflicts surfaced: PASS. D-051 vs D-053; live pages vs R0; stale ledger; repo unreadable.
8. Attribution intact: PASS.
9. Ledger respected: PASS. No persona reacted to a non-live item.
10. Persona honesty: N/A. No persona convened.
11. Splits preserved: PASS. Brand vs Legal on naming kept.
STATUS: PASSED
