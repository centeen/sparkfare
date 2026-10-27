# Addendum O: desktop homepage gaps (G106 hero balance, G107 row alert card)

**For:** Claude Code (or Antigravity IDE; same rules, see Addendum M handover). **From:** the Sparkfare Design Council Hub, Oct 26, 2026.
**Authority:** D-045 (Oct 26 08:05, G106 approved) and the owner's approval of G107 with both v2 changes (Oct 26 08:11). Staged decision: `claude/decision_staged_D-045_desktop_gaps_G106_G107_2026-10-26.md`.
**Deadline:** merged and live by **Wed Nov 4** (last feature merge). Nov 5 fix-only. No merges Nov 6 18:00 ET to Nov 8.
**Lane:** neither package is green-lane eligible (O2 changes text and a form). Use the merge train: approval pack, approval bound to the head commit, deploy and smoke check after each merge, revert on failure (D-035).
**Order:** O0 report → O1 → O2. One PR per package.

---

## O0 · Read-only check (report, then stop for the owner)

The Hub inferred the causes from the project's synced `index.html`, which may predate the live Brand v1 hero (reconciliation item 131). Confirm on `main` and on production:

1. Which file and CSS render the homepage hero and deal grid today (quote the hero grid rule and the `.grid` rule with commit hash).
2. At **1366×768** and **1440×900**, for origins **MIA, JFK and MSP**: hero left-column height, right-column height, the gap between them, the y position of the first board card, and the y position of the hero "View fare" button. Attach screenshots.
3. For the same origins: how many cards are in the "Today's deals" section, how many grid columns render, and how many empty tracks are in the last row.
4. Whether `/watchlists` needs sign-in for a guest.
5. Whether every email that a homepage signup triggers (confirmation, daily digest, any welcome or referral email) carries a working unsubscribe link.
6. The method page URL and anchor that explains the deal rule (D-021: at least 15% below the median of distinct observation days and at least 10 observation days). Quote its current text.
7. The signup source and surface tag values in use (M1 / N5 tag table), and the value you propose for this card.

No code changes in O0.

---

## O1 · G106 · Balance the desktop hero (layout only)

**Goal:** remove the empty block under the hero's left column on desktop so the deal board starts higher.

**Change:** at desktop and tablet widths only (above the existing 720 px single-column breakpoint), make the hero photo's height follow the left column instead of its own aspect ratio, for example by stretching the columns and letting the photo fill its share with `object-fit: cover`. You choose the method; keep it CSS-only if possible.

**Must not change:** any text, link, disclosure, photo credit line, form field or data logic. Mobile (≤720 px) must be pixel-identical before and after.

**Acceptance (measured, MIA, JFK, MSP at 1366×768 and 1440×900):**
- the bottoms of the two hero columns are within 24 px of each other;
- the first board card's y position moves up by at least most of the gap measured in O0 item 2;
- the hero "View fare" button stays above the fold at 1366×768;
- the photo is not distorted and the credit line still sits under it;
- screenshots at 375, 1366 and 1440 px attached; mobile diff empty.

---

## O2 · G107 · End-of-row alert card (v2 copy, approved)

**Goal:** when a short "Today's deals" row leaves empty slots on desktop, fill them with an honest alert offer instead of blank space.

### Where and when it renders
- **Only** in the "Today's deals" section, and only when its last row has at least one empty grid track at the current width. Recompute on render and on resize.
- The card spans all empty tracks in that row (at least one track; it must read well at a single 240 px track).
- Never in "Worth a look", "On the board" or "Building history". Never when "Today's deals" has zero cards (that is a separate empty state; leave it as it is).
- Never on mobile when the grid is one column (no empty tracks, so it should not render; confirm).
- Behind a new flag `ENABLE_ROW_ALERT_CARD`, default `"false"`. Merge dark; the flip is a separate one-line PR after the Hub's Guard read of the rendered card (below). Both by Nov 4.

### Copy (v2, approved; change nothing without the Hub)
- **Heading:** `That's every real deal from {City} today.` where `{City}` is the selected origin's city name as the origin selector shows it, and **"real deal"** is a link to the method page anchor from O0 item 6.
- **Body:** `Get the next one by email.`
- **Optional line:** `One daily digest. Unsubscribe anytime.` **only if** O0 item 5 confirms a working unsubscribe link in every triggered email. Otherwise use `One daily digest.`
- **Form:** email field (visible placeholder `name@email.com`, real `<label>` kept for screen readers) and a **Create alert** button.
- **Secondary link:** `Or watch one route` → `/watchlists`. If O0 item 4 shows sign-in is required, append ` (sign-in needed)` to the link text.

### Behaviour
- The form posts to the **same signup endpoint** as the hero alert form, with the selected origin prefilled, the same default trip length, the same consent text and the **same double opt-in**. No new data fields.
- Tag the signup with the source and surface value proposed in O0 item 7 so the G107 test can be read (signups per 100 desktop homepage visits with the card rendered vs without).
- Success and error states reuse the hero form's messages.

### Look (Brand v1)
- It must not look like a deal: no photo, no price, no Deal chip, no spark. Sage for the action; card surface and radius from the existing tokens; text in Ink.
- 44 px targets, visible focus, AA contrast, the form is a labeled `<form>` with `aria-describedby` on the email field.

### Banned in this card
"Only", counts used as pressure ("just 2 left"), countdowns, "hurry", "book", "secured", any savings claim, any traveler date in the URL or tag.

### Acceptance
- Renders only under the conditions above: show MIA (short row) rendering it and an origin with a full row not rendering it, at 1366 and 1440 px; none at 375 px.
- A test signup from the card arrives with the correct origin and tag, and receives the same confirmation email as the hero form.
- The copy checker passes; tests pass; screenshots at 375, 1366 and 1440 px attached.
- **Before the flag-flip PR:** send the Hub the rendered card text and a screenshot for a Guard read. Flip only after the Hub's PASS and the owner's approval.

---

## What to send back
O0 report; then for O1 and O2 the PR link, head commit, measurements and screenshots in the next approval pack. Note in `docs/handoff/BUILD_STATE.md` so either build tool can resume.
