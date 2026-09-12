# Publisher Outreach Pitch — Draft (Workplan Step 95)

**Status**: draft only, not sent. **Real gate, not mine to lift**: this step's own tracker note
says outreach shouldn't go out until Step 92 (revenue-share terms) is actually decided — right
now the split is only a proposed 20%, not settled. The draft below leaves the number as an
explicit placeholder for exactly that reason. If you send this before deciding Step 92, be ready
for "what's the split?" as the first reply and not have a real answer.

## What's real vs. not, so you don't overpromise on a follow-up call

**Real, and safe to state as fact:**
- The widget (`sparkfare.com/widget`) is live and creates real alert signups today — confirmed
  end-to-end against production.
- `partner_id` attribution is stored server-side with first-touch protection (Step 89) — a
  publisher's referred signups are genuinely tracked, not lost.
- Sparkfare has 3 real, live, earning Away Mode partners today: SafetyWing (travel insurance),
  Bounce (luggage storage), US Global Mail (mail forwarding).

**Not real yet — don't imply otherwise:**
- No publisher-facing revenue report exists (Step 91 built the internal accounting log, not a
  dashboard a publisher can check themselves).
- No publisher has actually been paid anything — there's no track record to point to yet.
- The revenue-share percentage itself isn't decided.

Given that, this is honestly an **early/founding-partner pitch**, not a mature program with a
proven payout history — the draft below is framed that way rather than overselling maturity that
doesn't exist yet.

## Email template

**Subject:** A flight-deal widget for [Publication Name]'s readers — free to embed

Hi [Name],

I run Sparkfare, a flight-deal alert tool that flags fares genuinely below a route's own 30-day
price history — not just "looks cheap," but statistically below what that route has recently
cost.

I'd like to offer [Publication Name] a free, drop-in signup widget your readers can use to get
these alerts for their home airport — a single iframe embed, no build work on your end:

```html
<iframe src="https://sparkfare.com/widget?partner=[your_slug]" width="100%" height="360" frameborder="0" scrolling="no"></iframe>
```

Readers who sign up through your embed are tracked as yours, and [Publication Name] gets a share
of the downstream revenue Sparkfare earns from them — [XX]%, paid [cadence TBD] — as an early
partner while we're still setting exact terms with the first few publishers we work with.

If you'd like to see it live first: [sparkfare.com/widget?partner=preview]

Happy to answer anything or adjust the embed to fit your layout.

[Your name]
Sparkfare — sparkfare.com

## Shorter version (DM / social outreach)

Hey — I built a flight-deal alert tool ([sparkfare.com](https://sparkfare.com)) and have a free
embeddable widget for newsletter/blog publishers: your readers sign up for deal alerts for their
home airport, you get a revenue share on what Sparkfare earns from them. Zero build work, just an
iframe. Want me to send the embed code?

## Notes

- "[your_slug]" should be a short, unique identifier per publisher (e.g. `denver_guide`,
  `austin_nomads`) — matches the existing pattern in `gtm_publisher_embed_guide.md`, don't invent
  a different format per publisher.
- No specific publisher names or contacts are included here — I don't have a real prospect list
  to draw from, and inventing one would just be guessing at reachable regional newsletters rather
  than verified leads. Finding actual publishers to send this to is real work still ahead.
- Consider deciding Step 92 before sending a single one of these — the placeholder `[XX]%` is the
  one thing in this draft I couldn't responsibly fill in myself.
