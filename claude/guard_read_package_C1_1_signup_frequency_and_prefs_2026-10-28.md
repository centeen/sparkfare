# Guard read package: C1.1 daily-or-weekly choice at signup, and the signed settings page (G114)

For the Hub, 2026-10-28 (non-attorney). **Status:** built dark on PR #418's branch. `ENABLE_SIGNUP_FREQUENCY` and `ENABLE_SIGNED_PREFS` are both `"false"`: no form shows the choice, `/prefs` answers 404, and no email carries the settings link until the owner flips each (not before Nov 9, owner approval). All copy is in `content/prefs.json`; strings below are copied from it.

## 1. What a reader sees (flags on)

**Every signup form** (home page bar, `/widget`, `/check`, `/leave`, `/time-off/*`, route pages `/data/*`, the digest archive form): a small group under the email field.
- Legend: **How often?**
- Radio 1 (selected): **Daily digest (you can switch anytime)**
- Radio 2: **Weekly edition, Sundays**
- No checkbox, nothing pre-ticked beyond the daily radio, whose label carries the "you can switch anytime" wording the addendum requires.

**The settings page** (`/prefs?token=...`, a link in the footer of every commercial email, labelled **Change how often, or pause**). No sign-in. Opening the link changes nothing.
- Title: **Email settings**. Intro: "Choose how often Sparkfare emails you. Nothing changes until you press a button."
- Current setting line: "Right now: daily digest, at most one email a day." / "…the weekly edition, on Sundays." / "…paused until {date}." / "…stopped. You get no emails from Sparkfare."
- Four buttons: **Daily digest, at most one email a day** · **Weekly edition, Sundays** · **Pause for 30 days** · **Stop all emails**
- Confirmations: "Saved. You'll get the daily digest, at most one email a day." · "Saved. You'll get the weekly edition on Sundays." · "Saved. Your emails are paused for 30 days." · "Done. You won't get more emails from Sparkfare. If you change your mind, you can sign up again."
- Bad or old link: "This link is not valid. Use the link in your latest Sparkfare email."

## 2. How it behaves (checked in tests, real SQLite)

- **The link is signed to one address** ("prefs:<email>"). An unsubscribe or reactivate token does not open it, and it does not open them. The address is not printed on the page.
- **A GET never changes anything**; every change is a POST (mail scanners follow GET links).
- **Stop is final from this page.** Once stopped, choosing daily or weekly does not turn emails back on; the person signs up again. Stop also adds the suppression entry, as the unsubscribe link does.
- **The signup choice is saved for a new address only.** A resubmit of the public form by an existing address cannot change that address's setting (anyone can type anyone's email into a form).
- **Only `daily` or `weekly`** are stored (Q3 retired the other values).
- The page is `noindex`, `no-store`, sends no referrer, and has one `h1`, a `main`, 44 px buttons.
- Changes are counted as a `prefs_change` event with the action only (no address, no id).

## 3. Rules check

| Rule | Where it stands |
|---|---|
| No pre-checked marketing box | The only default is the daily radio, with the required label. |
| Copy checker | `npm run check:copy` passes with the strings in place. |
| Works without an account | Yes. The link carries the signed address. |
| Footer link on every commercial email | Added at the one send point and the digest batch path, above the postal address, in HTML and plain text. Transactional mail (verification, welcome) does not get it. |
| "Pause" length | 30 days is a judgement call; the addendum names no length. |

## 4. Questions for the Hub

1. **"Daily digest (you can switch anytime)"** keeps "daily" as the preselected radio. Acceptable as the addendum allows, or should neither be selected until the reader picks?
2. **Pause for 30 days**: right length, or a choice of 14 / 30 / 60?
3. **"Stop all emails"** on this page also stops the lifecycle emails for a trip they asked for. Is that the right scope for the word "all", or should the button say "Stop everything except emails about a trip I tracked"?
4. **Weekly readers who pause**: paused weekly readers get no Sunday edition either. Confirm.
5. **Footer wording**: "Change how often, or pause". Keep?

## 5. Not built / not verified

- **Not wired:** the 880 pre-built `/data/*` pages get the control the next time the daily compile regenerates them (the generator is updated; Python could not be run in this session). `welcome.js` and `leaveReady.js` (the confirmation page and the leave-ready follow-up) have no signup form of their own.
- Not seen in a browser; the shared script is tested against a fake page. The radios have not been checked with a screen reader.
- Q3's honest-frequency pages (`/account`, `preferences.html`) are unchanged; the signed page is the no-account route to the same settings.

## 6. Owner steps

Nothing to apply (no migration). At the flip: set `ENABLE_SIGNED_PREFS` first (the footer link and the page), then `ENABLE_SIGNUP_FREQUENCY`; check a `+alias` signup picks weekly and receives no daily digest, and that the link in the footer of that address's first email opens the page.
