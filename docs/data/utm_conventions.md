# Launch links: UTM conventions and the landing counter

Used for every Product Hunt, Show HN, Reddit, Indie Hackers, directory and press link (Addendum N, N5; framework DR-18). The counter and the channel stored on a signup are **switched on** from the switch-on PR of 2026-10-24, with the approved wording on the privacy page (see "Switching it on").

## The tag table

Lower case, no dates, no personal data, letters digits `_` `-` only. **`utm_content` never names a person, a handle or a username**: press links use the outlet name only, Reddit links use the subreddit only (Hub Guard read, Oct 24). `utm_source` is the **channel** (20 characters at most), `utm_campaign` the **campaign** (16), `utm_content` names the post or placement.

| Where the link is posted | `utm_source` | `utm_campaign` | `utm_content` (examples) |
| --- | --- | --- | --- |
| Product Hunt | `producthunt` | `launch2026` | `maker-comment`, `listing` |
| Show HN | `hackernews` | `launch2026` | `showhn` |
| Reddit | `reddit` | `launch2026` | `r-travel`, `r-traveldeals` (one per subreddit) |
| Indie Hackers | `indiehackers` | `launch2026` | `post` |
| Bluesky | `bluesky` | `launch2026` | `launch-post` |
| Mastodon | `mastodon` | `launch2026` | `launch-post` |
| X | `x` | `launch2026` | `launch-post` |
| A press note or journalist | `press` | `launch2026` | the outlet, e.g. `outlet-name` |
| The newsletter / email | `newsletter` | `launch2026` | `digest`, `welcome` |
| A directory listing | `directory-<name>` | `launch2026` | `listing` |

Example: `https://sparkfare.com/?utm_source=producthunt&utm_campaign=launch2026&utm_content=maker-comment`

A link with **no** tag is still classified, by the kind of site that sent the visitor: `search`, `social`, `email`, `other_site`, or `direct` (no referrer, or a link from sparkfare.com itself). Only that class is kept, never the address of the referring page.

## What is counted, and what is not

- **One count per browser session**, on the first page, as channel + campaign + kind of page (`home`, `route`, `check`, `pto`, `report`, `other`). It adds 1 to a row in `landings_daily` for that day. Nothing identifies the visit: no IP address, no user agent, no cookie, no id.
- Bots and requests with no browser user agent are not counted.
- A **signup** stores the same channel and campaign **once** (first touch) next to the form it used (`signup_source`, unchanged). A later signup attempt never overwrites it.
- People who block scripts or session storage are not counted, so landing-to-signup is an **upper bound**.
- Pages: every page that carries the shared header loads the script (about 975 static pages and the Worker-rendered pages). The launch fortnight's landing pages are all covered.

## Report

`/admin/growth` (admin secret) has a "By channel" table for the last 7 and 28 days: landings, signups, confirmed, landing-to-signup %, confirm %. Signups from before the counter show as `unknown`.

## Privacy line (rewritten by the Hub's Guard read, Oct 24; live copy, needs the owner's approval before it goes on the page)

> We also count visits as daily totals, grouped by where they came from: a tagged link (for example a launch post), the kind of site that sent you (search, social, email or another site), or a direct visit. To count each visit once, your browser keeps a short note for that tab, deleted when you close it. This count stores no IP address, cookie or identifier and is never linked to you. If you sign up, we also keep that kind of source, once, next to your email address.

Where it goes: `privacy.html`, beside the existing source-tag sentence (which already covers keeping the tag for the session). The page date changes with it. "Deleted with your address" is left out on purpose: the privacy page says internal logs are kept indefinitely and the retention jobs (N13) stay off until Dec 1; add that wording when they go live.

**Open question for counsel (does not block a US-focused launch):** the per-tab note is not strictly necessary for the site to work, and in the EU ePrivacy rules can require consent for it (candidate regime to verify: ePrivacy Directive, Art. 5(3)). It is the same exposure as the existing source-tag note.

## Switching it on (done 2026-10-24: owner approval of the tag table, the rewritten privacy line and the Nov 1 deadline; the switch-on PR is this change)

All of these together, in one small PR, after the approval and **by Sun Nov 1** (the Hub's recommended exception to Addendum N's "no flag before Nov 9": launch measurement needs the counter on before Nov 7, and Nov 1 leaves four days to confirm it in production before the Nov 6 go/no-go; the exception needs the owner's explicit approval):

1. `wrangler.jsonc`: `"ENABLE_LANDING_COUNTER": "true"`.
2. `attribution.js`: `var ENABLED = true;`.
3. `privacy.html`: the approved line above, and the page date.
4. Migration `0032_channel_attribution.sql`: **applied to production 2026-10-24** and recorded in `d1_migrations`. It is N5's number; N7's schema reconciliation takes the next free number (0033), since 0032 is used.

Then confirm in a real browser on the live site: one `POST /api/landing` per session, a 204, and a new row in `landings_daily`; a test signup stores a channel; `/admin/growth` shows the table.
