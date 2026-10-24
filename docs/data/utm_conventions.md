# Launch links: UTM conventions and the landing counter

Used for every Product Hunt, Show HN, Reddit, Indie Hackers, directory and press link (Addendum N, N5; framework DR-18). The counter and the channel stored on a signup are built but **switched off** until the privacy page says what is counted (see "Switching it on").

## The tag table

Lower case, no dates, no personal data, letters digits `_` `-` only. `utm_source` is the **channel** (20 characters at most), `utm_campaign` the **campaign** (16), `utm_content` names the post or placement.

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

## Draft privacy line (for the Hub's Guard read; live copy needs the owner's approval)

> We count visits that arrive from a link, by where the link was posted, as daily totals. We do not store your IP address or any identifier for this count. If you sign up, we keep which kind of link brought you here (for example search, a social post or a campaign) next to your address, once, so we can tell which launch posts worked.

Where it goes: `privacy.html`, next to the existing paragraph on analytics and events. The page date changes with it.

## Switching it on (launch PR, after the Guard read and the owner's approval)

All of these together, in one small PR, no earlier than the approval and no later than Wed Nov 4:

1. `wrangler.jsonc`: `"ENABLE_LANDING_COUNTER": "true"`.
2. `attribution.js`: `var ENABLED = true;`.
3. `privacy.html`: the approved line above, and the page date.
4. Migration `0032_channel_attribution.sql` must already be applied to production (it is applied before the code that uses it merges).

Then confirm in a real browser on the live site: one `POST /api/landing` per session, a 204, and a new row in `landings_daily`; a test signup stores a channel; `/admin/growth` shows the table.
