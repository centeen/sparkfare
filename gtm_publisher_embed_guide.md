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

`partner_id` is captured and sent with every signup, but **the backend does not store it yet**
(workplan Steps 89/91, still `NOT STARTED`). Signups from a publisher's widget work today and
create a real Sparkfare alert — the attribution just isn't recorded anywhere yet, so there is no
live revenue-share reporting for publishers to check. Don't tell a publisher partner_id tracking
is live until Step 89 actually ships.
