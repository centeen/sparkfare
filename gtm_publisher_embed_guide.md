# Sparkfare widget — publisher embed guide

Give each publisher an iframe tag with their own `partner` value in the query string:

```html
<iframe
  src="https://sparkfare.com/widget?partner=denver_guide"
  width="100%"
  height="360"
  frameborder="0"
  scrolling="no">
</iframe>
```

Replace `denver_guide` with a short, unique slug per publisher (e.g. `austin_nomads`,
`seattle_weekly`). The widget reads that value from its own URL and includes it as
`partner_id` on every signup it creates.

## How it actually works

- The iframe loads `widget.html` directly from `sparkfare.com` — this is a real page in the
  repo, wired to the live `/api/signup` endpoint (same contract `index.html`'s own signup form
  uses: `email`, `origin_iata`, `trip_length`, a generated `id`).
- Because the document inside the iframe is served from `sparkfare.com`, its `fetch('/api/signup')`
  call is same-origin regardless of what domain the publisher embeds it on — no CORS
  configuration needed on either side.
- The widget only offers the 12 origins that are actually publicly marketed
  (JFK/LAX/ORD/ATL/DFW/SFO/MIA/IAD/EWR/SEA/IAH/BOS). It deliberately excludes TLV, which is a
  design-partner test origin kept off every public-facing surface — see CLAUDE.md's "Decisions
  locked" section.

## Current limitation — read before promising publishers a revenue split

`partner_id` is captured and sent with every signup, and **the backend now stores it** on the
`users` table with first-touch attribution (workplan Step 89, done 2026-09-12) — so a signup from
a publisher's widget is recorded as theirs even if the user later resubmits the form directly.
Separately, an internal `away_mode_email_log` table records which publisher a recipient is
attributed to whenever an Away Mode email actually sends (Step 91, built but not yet observed via
a real send). **What's still missing**: there is no publisher-facing dashboard or report — this is
Sparkfare's own internal accounting, not something a publisher can check themselves yet. Don't
promise a publisher a self-serve revenue-share report; the underlying data now exists, the
reporting surface doesn't.
