# Guard read package: C1.2 / C1.3 trip stream v2 (G112)

Flag: `ENABLE_TRIP_STREAM_V2` (default `"false"`; needs `ENABLE_TRIP_SELF_REPORT`). Nothing below changes while it is off. Copy lives in `content/emails/trip_stream.json`; edit text there.

## What a reader sees when it is on
1. A fare click sends the checklist email, which now asks **Got your ticket?** with **Yes / Still deciding / Not going** (one tap each; a tap opens a confirm page, it changes nothing until pressed). Note under it: "One tap. Trip emails start only after you say yes."
2. Only a **Yes** starts the trip stream: 21, 7 and 1 days before departure (30, 14 and 7 for `2+ weeks` and `30_plus`), then a **return-day** note. Still deciding, Not going and no answer get none of it.
3. On digest days the due stage is a block at the top of that reader's digest instead of a separate email.
4. The stress-valve, 7-day briefing, 3-day departing-soon and 14/7/1 prep emails are not sent while it is on.

## Questions for the Hub
1. Do the three labels and the note read as honest and low-pressure? Anything that implies we know they bought?
2. Stage copy (first, second, third, return) in `trip_stream.json`: any urgency, speed or booking wording? (`npm run check:copy` passes.)
3. Partner per stage: mail (first), phone and data (second), luggage (third), none on return. Sponsored disclosure appears above a partner link only. Acceptable?
4. Return-day note carries no partner and no ask. Right?
5. Is removing the four legacy trip emails the intended trade (D-049d: trip emails only after the tap)?

## Operations
- New table `trip_stream_deliveries` (migration `0046`, also created inline). Apply 0046 to production before the flag is flipped.
- Send budget: new lifecycle kind `trip_stream`, ranked just below `plan_reminder`; the one-email-a-day rules apply.
- Digest merge uses the existing alert-block path (needs `ENABLE_EMAIL_V2`); if the digest is skipped, the standalone email goes instead.
