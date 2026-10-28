# Guard read package: C1.5 care email (stream 5)

Flag: `ENABLE_CARE_EMAIL` (default `"false"`; flip from Nov 9; also needs `ENABLE_SIGNED_PREFS` and `UNSUBSCRIBE_SECRET`). Copy in `content/emails/care.json`.

## What happens
One email, once per address, to someone verified and subscribed whose last click was 60 or more days ago (or never) and whose account is at least 60 days old. Not paused, not stopped. The pause rule from Q6 acts at 90 days without a click, so this email comes first.

## The email
Subject "Still want Sparkfare in your inbox?". Three links, each to the signed settings page with one choice named: keep the daily digest, switch to weekly (Sundays), pause 30 days. Each link opens a confirm page with ONE button and changes nothing until it is pressed. If they do nothing, nothing changes and we do not send this again.

## Safety
- Sent only if at least one click was recorded in the last 30 days anywhere. With click tracking off (Resend tracking is OFF today) the email does not run at all, so it cannot go to everyone.
- At most 100 per run. Sent once ever: `users.care_sent_at` (migration `0047`, also added at run time).
- It goes through the normal send guard (suppression, circuit breaker, stream pause, postal address) as stream `care`.

## Questions for the Hub
1. Intro: "We haven't seen a click from you in about two months. Clicks and opens aren't always counted, so this may be a mistake." Honest and not guilt-inducing?
2. Is a single email, with no reminder, the right shape?
3. Should "stop all emails" also be offered here, or is the footer unsubscribe enough?
4. Does 60 days feel right next to the 90-day pause?

## Before flipping
Apply migration 0047; turn on Resend click tracking and the `email.clicked` webhook; confirm `last_clicked_at` is filling in.
