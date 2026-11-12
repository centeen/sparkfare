# Strings for the Hub's Guard read (2026-11-11)

Read from `main` at `8fa1b32` by Claude Code. Strings are quoted from the source; none was seen rendered (the sandbox cannot reach
sparkfare.com). Three groups are waiting on a read. Nothing here changes code, flags or copy.

## 1. D-081 alert-via-signup (#505, dark behind `ENABLE_ALERT_VIA_SIGNUP="false"`) - read before the flip

Source: `alert-via-signup.js`, `src/index.js` (`subscribeFromAccount`).

**Line beside the button** (`{airport}` is the chosen code, or "your home airport" if none is chosen):

> Free account. At most one fare email a day, with fares from {airport}. Unsubscribe any time.

**Button label:** unchanged ("Create alert"). The email field is hidden while the flag is on.

**Messages the visitor can see**
- While saving: "Creating your alert…"
- On success: "Alert created for {airport}. It uses your account email ({email}), which is already verified."
- Signed out at the subscribe step: "Please sign in to create your alert."
- Server error: "Something went wrong while creating the alert."

**The 30-minute hold** (signed-out visitors only)
- The visitor goes to Clerk's hosted sign-up (`accounts.sparkfare.com/sign-up`) with the current page as the return address.
- Before leaving, the page keeps a record in `localStorage` for 30 minutes: the three-letter airport code and a timestamp, nothing else.
- It is cleared after use or after 30 minutes. A signed-in visitor with a saved airport is subscribed once on return.

**Consent record**
- `consent_log` gets `source = alert_via_signup` and `wording_version = v2_account_signup`.
- The code stores no consent text. The version tag points at the beside-button line above, so that line is the consent wording.
- **Open:** a matching `wording_version` entry has to exist wherever the full wording text is kept. None was found in the code. Check before the flip.

**Also to confirm before the flip:** "Unsubscribe any time" must be true in every email a new subscriber receives (the O0 item 5 check).

## 2. The vacancy post - `/blog/vacancy-rules-and-homeowners-insurance`

Changed by #467 (the insurer day-threshold figures, "30 or 60 days" and "60 or 90 days", were removed), so any earlier approval was bound to an older version. Points to read:
- The intro says some policies treat an extended absence differently and tells readers to check their own policy.
- No insurer day thresholds are given: "The number of days varies by insurer and by state, so ask yours."
- It advises contacting the agent or carrier "before embarking on an absence of 30 days or longer" and lists five questions to ask.
- Frozen pipes, vandalism and gradual leaks are each phrased as "some policies ... ask whether yours does".
- "Background reading" links only the home pages of Triple-I (iii.org), NAIC (naic.org) and IBHS (ibhs.org), and says outright that no statement above is tied to a specific page.
- It ends with "Away Mode has a short list of home and trip items to run through before you go." and an "Open Away Mode" link.
- It carries no partner link and no insurance recommendation (insurance partners stay blocked until ROADMAP step 19).

## 3. Destination guides with no "On the ground" section

On current `main`, **30 of the 40** destination guides contain neither "On the ground" nor "On-the-ground". Earlier notes said 19; the count above is from a direct check of the files and replaces it.

Guides that still have the phrase (10): marrakech-morocco, cappadocia-turkey, petra-jordan, oaxaca-mexico, cusco-peru, luxor-egypt, tbilisi-georgia, baku-azerbaijan, antigua-guatemala, muscat-oman.

The other 30 are every other destination guide in `blog/` (for example bali-indonesia, tokyo-japan, lisbon-portugal, prague-czechia, madrid-spain). The notes say the guide filter removes every bullet that carries a figure, a comparison or barred wording, so those guides lost the whole section. The read should confirm the remaining guide text (route facts, season notes, "More" content) is still accurate and complete without it.

## 4. Already live, read after the fact - Holiday Fare Report (#482)

- Button on `/how-it-works`: "Holiday Fare Report".
- `llms.txt` line: "Holiday Fare Report 2026: Counts and shares by US airport for international round-trip routes, with the method stated and two CSV downloads of derived statistics."
- Credit line, shown twice on `/reports/holiday-2026`: "Source: Sparkfare (sparkfare.com), as of October 24, 2026 01:22 UTC."
- `ENABLE_REPORT_CC_BY` is `"false"`, so there is no licence text and no Dataset `license`.
- Rollback if the read finds a problem: set `ENABLE_REPORTS` back to `"false"` in `wrangler.jsonc` and merge (auto-deploys in 1 to 2 minutes).
