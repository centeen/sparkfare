# Guard read package: N13 retention and deletion jobs (draft `/privacy` paragraph)

For the Hub, 2026-10-28 (non-attorney; the owner may ask counsel). **Status:** built dark on PR #418's branch. Nothing is deleted and no visitor sees any change until the owner (1) sets `ENABLE_RETENTION_JOBS` to `"true"` and (2) sets `RETENTION_DRY_RUN` to `"false"`. With only the first set, the job runs monthly and **only counts** (written to the Monday brief). The `/privacy` page still says the opposite today; the paragraph below replaces that wording **in the same PR that turns real deletion on**, not before, so the page never promises something the code does not do.

## 1. What the job does (Framework 5.4, values approved as D-042)

| What | Rule | Kept |
|---|---|---|
| Activity log (`events`) | Rows older than 13 months are added into monthly totals (month, event type, visitor class, count) and deleted, in one step | The monthly totals (no ids, no routes, no addresses) |
| Delivery logs (which email went to whom, when) | Deleted 90 days after the send | Nothing |
| A subscriber's personal data | 30 days after they unsubscribe, after the sunset pause, or after a deletion request: the record is made anonymous (address, airport, trip length, travelers, answers, referral link, token removed) and their watchlists, plans, push subscriptions, waitlist entry and email-keyed delivery rows are deleted | The suppression entry (so we keep honouring the opt-out) and the consent record (so we can show they opted in) |
| Trips and payouts | Never deleted. A trip keeps its counts; its link to a person ends because the record no longer identifies anyone | Everything |
| Backups | Roll off on their own schedule (14 daily, 12 monthly), so a deletion leaves them within a year | n/a |

Safeguards in the code: paying members are never touched; a reactivated subscriber stops the clock; each rule runs on its own (one failing rule does not stop the rest); at most 500 people per run; real deletion needs both flags; a dry run changes nothing (tested: the database is identical before and after).

## 2. Draft `/privacy` paragraph (PROPOSED, not live)

> **How long we keep things.** We keep the internal activity log for 13 months; after that we keep only monthly totals (for example, how many people clicked a partner link in a month), with no accounts, addresses or routes. We keep a record of which emails we sent you for 90 days. If you unsubscribe, or we pause your alerts because you stopped opening them, or you ask us to delete your data, we remove your personal details 30 days later: your email address, home airport, trip preferences, watchlists, saved plans and push subscriptions. We keep two things so that we can honour your choice and show it was yours: a record that your address is suppressed (so we never email you again) and the record that you signed up (date, source and a one-way hash of your IP address). Payment and revenue records are kept, without your details. Backups hold older copies for up to a year and then roll off.

It replaces: "We don't currently have an automatic deletion schedule for these internal logs — they're kept indefinitely unless you ask us to delete your data" and "We retain your account data for as long as your account is active. If you unsubscribe, we stop sending alerts but keep enough of your record to honor that choice."

## 3. Questions for the Hub

1. **Consent record content.** The consent record keeps the person's email address (not anonymised) with the date, source and hashed IP. Is keeping the plain address in the consent record right, given the suppression entry also holds it? The alternative is hashing both and checking against a hash.
2. **Sunset timing.** The sunset pause stores no time, so the first monthly run that sees a paused subscriber stamps it and the 30 days run from then (so 30 to about 60 days after the pause). Acceptable, or should the pause itself be stamped (a change to the Q6 code)?
3. **Deletion requests.** The page says "email us". There is no form yet; a request is recorded by setting `users.deletion_requested_at` by hand. Is "email us, we delete within 30 days" the promise, or should a request be deleted at once?
4. **13 months for events** and **90 days for delivery logs**: confirmed by the owner as proposed (D-042); no change asked.
5. **Backups "up to a year".** True for monthly backups (12 kept). Keep the sentence?

## 4. Owner steps

1. Apply migration `0045` (monthly totals table and three `users` columns; the Worker also adds them) and record it in `d1_migrations`.
2. Now: nothing to switch. Later: after the Hub's read and a dry-run month, set `ENABLE_RETENTION_JOBS` and `RETENTION_DRY_RUN` and replace the `/privacy` wording in one PR.
3. To try a dry run first: set only `ENABLE_RETENTION_JOBS` to `"true"`, then `POST /api/run-retention` (admin secret) and read the counts in the response or the Monday brief.

## 5. Not verified

Tested only on a copy of the schema with invented rows (11 tests, hand-computed counts, six deliberate breaks each fail a test). It has not run against production data; a dry run on production is the first real check. `home_cards` rows are removed with their plan; any other table holding an address that was added after this was written would not be covered (a test lists the tables handled).
