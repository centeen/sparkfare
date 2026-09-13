# Sparkfare — Content & Distribution Strategy (Workplan Step 35)

*Scoping document, not yet built. Step 35 previously had no written scope — this is the first
pass, reasoned out from the product's own real differentiators and current technical state, not
guessed from a generic "content marketing" template.*

## Why this is scoped this way

Sparkfare's product infrastructure is genuinely mature (daily deal pipeline, accounts, Away Mode,
trip tracking, 3 live earning affiliate partners) but has **no real distribution engine** — no
blog, no confirmed social presence, no SEO metadata at all, and (per the 2026-09-12 privacy-policy
accuracy pass) no analytics anywhere in the codebase. Everything built so far gets people through
the funnel once they arrive; nothing yet brings them there. That gap is the actual problem Step 35
needs to address — not "make some content," but "build the first real acquisition channel that
isn't paid ads or the still-undecided publisher-syndication play (Phase 15)."

**Verified before writing this**: `index.html`'s `<head>` has no `<meta name="description">`, no
Open Graph tags, and no canonical URL; there is no `sitemap.xml` or `robots.txt` anywhere in the
repo. SEO content published today would have nothing to actually rank on — the technical
groundwork doesn't exist yet either.

## The two real differentiators worth writing about

Both are already substantiated in the codebase, not just marketing claims — content built on top
of them can cite the actual mechanism rather than vague "we're honest" language:

1. **A stated, defensible ranking methodology** (`sparkfare_ranking_methodology.md`, Step 98) —
   trailing 30-day mean, per-cluster thresholds, a 7-day minimum history gate. Competitors
   (Going, Thrifty Traveler, Dollar Flight Club) use opaque "our experts found this" framing —
   this is a real, checkable difference worth explaining publicly, aimed directly at the
   "Spontaneous Opportunist" persona described as "skeptical of inflated 'deal' marketing."
2. **40 curated destinations with real photography and copy already built** — an existing content
   asset (`sparkfare_destinations.json`, `sparkfare_images.json`) that a blog can extend rather
   than duplicate.

**Not yet a safe thing to build content around**: the trip-length filter. The product background
doc (`sparkfare_product_background.md`) explicitly flags it as UI-only, functionally unverified —
content shouldn't claim a differentiator that hasn't been confirmed to actually work.

## Content pillars

1. **Methodology/trust content** — a public, plain-language explainer of "how a Sparkfare deal
   gets flagged," built from the existing methodology doc. Distinct from `disclosure.html`
   (compliance-focused) — this is persuasion-focused, aimed at a skeptical reader deciding whether
   to trust the site at all.
2. **Destination guides** — short, real guides for the 40 existing destinations ("best time to
   visit," practical trip-planning notes), each linking directly to that destination's live card
   on the homepage. Reuses existing photography/copy assets rather than commissioning new ones.
3. **Away Mode / trip-prep content** — practical pre-trip checklist articles that naturally
   introduce the real Away Mode partners (SafetyWing, Bounce, US Global Mail) with the same FTC
   disclosure-before-link discipline used everywhere else on the site. This pillar is the one that
   doubles as a monetization surface, not just an acquisition one.

## Cadence

**Recommendation: one piece per week**, alternating pillars (roughly 2 destination guides : 1
methodology/trust piece : 1 Away Mode piece per month) — not an aggressive daily/multi-weekly
schedule. This is a single-operator project (a real, already-documented constraint elsewhere in
this codebase) — a sustainable weekly cadence beats a burst that stalls after a month.

**Real dependency worth naming**: there's no analytics anywhere in this project. A content cadence
decision made *after* a few weeks of real traffic data (which pillar/destination actually gets
read, where visitors come from) would be a much better-informed decision than one made blind
today. Building basic analytics isn't part of this step's scope — it wasn't requested — but it's
worth flagging as the thing that would make the *next* cadence review much less speculative than
this one.

## Technical approach

Matching the existing site's own conventions rather than introducing a new pattern:
- Plain static HTML pages (`/blog/<slug>.html`), same as `away-mode.html`/`disclosure.html` —
  no CMS, no build step, consistent with the frontend's deliberate framework-free constraint.
- A `/blog/index.html` listing page, linked from the main nav alongside Trips/Preferences/Privacy.
- Real style-guide compliance from the start: Paper/Ledger palette, Space Grotesk/Inter, sage for
  links/CTAs — same discipline already applied to the transactional emails (Step 100) and the
  publisher widget (Step 94).
- **Basic SEO plumbing added at the same time**, since none exists today: `<meta
  name="description">` and Open Graph tags per page, a real `sitemap.xml`, and a `robots.txt`
  that doesn't block anything. Publishing content without this would waste the content itself.

## First 8 topics (first 2 months at the recommended cadence)

1. "How Sparkfare actually decides something is a deal" (methodology/trust)
2. Destination guide: Lisbon, Portugal
3. Destination guide: Marrakech, Morocco
4. "What 'Away Mode' actually covers before your next trip" (Away Mode)
5. Destination guide: Tulum, Mexico
6. Destination guide: Prague, Czechia
7. "Why we show a stale-fallback price instead of hiding a route" (methodology/trust — an honest
   look at a real design decision already documented in this codebase, Steps 65/66)
8. "The 3-partner Away Mode checklist, city by city" (Away Mode, cross-linking the destination
   guides published so far)

## Explicitly not decided here

- Exact publishing platform beyond "static HTML matching the existing site" (no CMS evaluated —
  not needed at this scale).
- Whether social distribution (which platforms, what cadence) is part of this step or a separate
  one — deliberately left out of this pass since it's a distinct decision with its own tradeoffs,
  not assumed here.
- Nothing has been built yet. This is the scoping pass Step 35 was missing — building the first
  article, the `/blog/` template, and the SEO plumbing is real follow-up work, not done here.
