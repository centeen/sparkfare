# Sparkfare — Brand Style Guide

*Directional brand concept — Sparkfare C-Suite Advisory System. Not final production art.*

Sparkfare reads like an honest instrument displaying a real number — not a travel brochure. Numbers lead. Photography doesn't.

---

## Tagline

**"It only sparks when the fare's real."**

Set in the Headline role — Space Grotesk, weight 500 (see Typography below), in Ledger on Paper.
Live in the site header (`index.html`, the `.tagline` element under the wordmark) as of
2026-09-13, replacing the earlier descriptive line ("Flight deals ranked against real price
history, not a marketing team's idea of a bargain."). Ties the copy directly to the mark itself —
"sparks" names the same moment the torn-ticket mark's gold dot represents, and "real" is the same
claim the ranking methodology exists to back up.

---

## Color

Warm neutral base carried over from the live site. The one accent — a struck-match gold, not the terracotta-orange that's become a generic default — is reserved for the signal that matters: a genuinely good deal.

| Name | Hex | Role |
|---|---|---|
| Paper | `#EDE6D6` | Background |
| Paper deep | `#E3D9C4` | Card / alternate background |
| Ledger | `#2B2620` | Primary text |
| Ledger muted | `#6B6255` | Secondary text |
| Spark | `#E8B930` | Accent — reserved for the one signal that matters |
| Line | `#DCD3BF` | Hairline borders / dividers |

**Dark mode equivalents:**

| Name | Hex (dark) |
|---|---|
| Paper | `#211F1A` |
| Paper deep | `#2A2822` |
| Ledger | `#EDE6D6` |
| Ledger muted | `#B3A992` |
| Spark | `#F0C548` |
| Line | `#3A362C` |

---

## Typography

Two roles, plus one deliberate exception. Space Grotesk carries the brand's voice. Inter stays quiet in the background. Monospace is reserved only for numbers — a visual marker that the figure is real, not styled for effect.

| Role | Typeface | Weight |
|---|---|---|
| Headline | Space Grotesk | 500 |
| Body | Inter | 400 |
| Numerals only | IBM Plex Mono | 400–500 |

**Headline sample:** It only sparks when the fare's real.

**Body sample:** Ranked against real price history, not a marketing team's idea of a bargain. Every figure on this page is real data, shown as-is.

**Numeral sample:** `$412 · 28%`

---

## Mark — ticket stub

The torn-off piece of a boarding pass, where the tear itself is drawn as the spark: a rectangle outline with a straight left edge, straight bottom edge, and a jagged three-point zigzag along the right edge (the "tear"), with a small filled gold dot placed inside the stub. Outline in Ledger (`#2B2620`), dot in Spark (`#E8B930`). The vector file is provided separately as `sparkfare_mark.svg`.

Selected over two earlier directions:
- **Asymmetric flash** — dropped; didn't encode any real meaning on its own.
- **Compass needle in a ring** — dropped; a preliminary trademark screen found this territory actively claimed by Compass, Inc.'s registered real-estate brand mark.

**Do:**
- Keep the torn edge angular, not curved
- Keep the spark dot in gold (`#E8B930` light / `#F0C548` dark)
- Render as an outline stroke, not a solid fill

**Don't:**
- Don't fill the stub solid — it reads as a badge, not a torn ticket
- Don't smooth the torn edge into a curve
- Don't recolor the spark dot outside gold

**Outstanding before commercial use:** a professional design pass and a full attorney-run trademark clearance search.

---

## Deal list — layout principle

Ledger rows, not a rounded-card grid. Price and percent-below-history lead in monospace; destination and trip detail sit quietly to the left. Illustrative figures only.

| Destination | Trip | Price | vs. average |
|---|---|---|---|
| Lisbon | from JFK · 7–10 days | `$412` | 28% below |
| Mexico City | from ORD · weekend | `$189` | 19% below |
| Reykjavík | from BOS · 4–6 days | `$298` | 33% below |

### Sparkline (workplan Steps 96–98)

Each row gets a small trailing-30-day price sparkline next to the price — the same window the
ranking script already uses (`HISTORY_WINDOW_DAYS = 30`), not a separately chosen number. No JS
charting library: rendered as a server-generated inline SVG polyline at the same point the
fetch/ranking script already runs, consistent with the framework-free frontend. The dot marks
today's price, in Spark gold — the same accent role it plays in the mark itself, reserved for
the one signal that matters.

```svg
<svg viewBox="0 0 120 32" width="120" height="32" role="img" aria-label="30-day price trend">
  <polyline points="0,10 15,14 30,12 45,18 60,16 75,22 90,20 105,26 120,24"
            fill="none" stroke="#2B2620" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="120" cy="24" r="2.5" fill="#E8B930"/>
</svg>
```

The `vs. average` column's percentage should carry a stated comparison basis next to it (e.g.
"vs. trailing 30-day average") rather than standing alone — every benchmarked competitor
(Hopper, Expedia) pairs their equivalent percentage with a stated basis; an unlabeled number is
weaker practice than the category norm. This is gated on documenting the methodology in writing
first (workplan Step 98) — the number itself is already real (Step 7's ranking logic), this is
about stating its basis, not changing how it's calculated.

---

## Messaging pillars

Statuses reflect current workplan verification, not final copy.

1. **Priced honestly** — real price history, not a guess.
2. **Built around your actual trip** — ⚠️ *on hold, pending workplan Step 75 functional verification.*
3. **Everything else, handled** — Away Mode.

---

*Ticket stub selected as primary mark; preliminary knockout search found no comparable conflicts, but a full attorney-run USPTO clearance search is still outstanding before commercial use.*
