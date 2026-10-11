# Fare Search spike: CNAME and White Label setup steps

Status: **DRAFT checklist for the owner**, written 2026-10-11. Nothing here is done yet.
Source: `claude_code_white_label_fare_search_2026-10-10.md` section 8 (Task S) and ROADMAP steps 77 to 83, updated with the
two Travelpayouts replies (2026-10-11, recorded in ROADMAP under "Travelpayouts reply" and "second reply").

What this is: the dashboard and DNS actions only the owner can do, in the order that starts the slow clocks first. It
changes nothing on sparkfare.com, adds no code and no flag, and costs nothing (do **not** buy the paid "appearance setup"
service, gate G1).

**State on 2026-10-11:** `node scripts/fare_search_probe.mjs check` reports `fares.sparkfare.com` does not resolve (no CNAME,
TLS and HTTP `ENOTFOUND`). `links` was already run on Oct 10 and saved three test ids to
`scratch/fare_search_probe_state.json`; keep that file, re-running `links` overwrites it.

## Before you start

- The host must be `fares.sparkfare.com`. A travel brand name in the domain (Aviasales, Booking, and so on) can get the
  account blocked (R3).
- Allow lead time: DNS can take 24 hours (up to 72 quoted), SSL up to 48 hours after you create and customise the page.
  Starting today means the earliest usable check is around Oct 13 to 14. Nothing here blocks launch.
- Have the Travelpayouts dashboard and the Cloudflare dashboard for `sparkfare.com` open. No tokens are typed into
  chat or a file.

## Step 1: create the Page-type White Label (Travelpayouts dashboard)

1. White Label Web, create a new one, type **Page**.
2. Domain: `fares.sparkfare.com`. Language `en`. Currency `USD`.
3. Under **Content**, leave "Show your Travelpayouts referral link" **off** (Misha confirmed it is a setting).
4. Note the **Project** it creates and write its name and id in the scorecard (R8). Conversions are recorded under the
   project selected at setup, not necessarily campaign 569853.
5. Do not choose a paid setup or appearance service. If any screen asks for payment or shows a recurring fee, stop and
   write down the screen (scorecard M6).

## Step 2: add the CNAME (Cloudflare DNS)

1. DNS, Add record: type **CNAME**, name `fares`, target `whitelabel.travelpayouts.com`.
2. Proxy status: **DNS only** (grey cloud) first. Travelpayouts' own Cloudflare article does not state the setting; if the
   page does not load or SSL fails after a day, ask Travelpayouts support, then try proxied. Write down which one worked
   (scorecard M8).
3. Check that no existing Worker route or custom domain on `sparkfare-app` matches `fares.sparkfare.com` (Workers, 
   `sparkfare-app`, Settings, Domains and Routes). A `*.sparkfare.com/*` route would shadow the new host. `wrangler.jsonc`
   has no `routes` entry, so this has to be looked at in the dashboard, not the repo.
4. Back in the Travelpayouts dashboard, finish the page and save. SSL is requested after the page is created and customised.

## Step 3: confirm DNS and TLS (any time, safe to repeat)

```bash
node scripts/fare_search_probe.mjs check
```

Pass: DNS `OK` (CNAME to `whitelabel.travelpayouts.com`), TLS `OK`, HTTP 200 with a title. Write the output in the
scorecard (M8). The `noindex` line is expected to say `NO` until Step 5.

## Step 4: the footer disclosure and policy links (HTML editor in the White Label settings)

From Misha's reply: there is an HTML editor, a footer placed there appears on all White Label pages including results.

1. Footer text (facts only, no legal status):
   "Sparkfare earns a commission when you choose a fare here. Sparkfare does not sell or book travel; the purchase is
   completed with the airline or agency you choose."
2. Links to Terms, Privacy and Cookie policy pages for the White Label. **Travelpayouts says you must supply your own.**
   Sparkfare has no cookie policy, `/terms` is a minimal unreviewed page and `privacy.html` does not describe a
   Travelpayouts-operated search. For the spike only, link to the existing `/terms` and `/privacy` and note in the
   scorecard that the policy gap is open; this is a prerequisite for any traffic beyond your own test clicks.
3. Open the results page (after a test search) and screenshot it at 390px and 1280px: is the footer visible, and where
   (scorecard M4).

## Step 5: noindex and the main page (custom HTML)

1. In the custom HTML area add `<meta name="robots" content="noindex">` to the main page head.
2. Re-run `check` and confirm `noindex: YES` (scorecard M12).
3. Note whether a `<script>` is accepted there (M9, informational) and whether Inter or Space Grotesk is in the font list
   (M10, informational). Do not add any tracker.

## Step 6: test clicks, with no purchase

1. Run `node scripts/fare_search_probe.mjs links` to print candidate deep links. **The path and parameter names are
   candidates, not verified.** Open each in a browser; only a link that pre-fills the form and runs the search counts
   (M2). Record the exact working path and parameters.
2. SubID: Misha said a SubID in the White Label URL is passed to statistics, but not the parameter name. The probe uses
   the Aviasales-style `marker=314524.<test-id>`. If your follow-up reply gives a different name, tell me and I will add
   it to the probe before you spend a click; otherwise use `marker=` and treat a miss as "name unconfirmed", not as the
   spike failing.
3. Click one result from the winning link. **Stop at the seller list**: do not press a "Buy" button and do not enter
   anything. Inspect the outbound URL for the partner id (M5), and screenshot the seller list (merchant of record, "Buy"
   label, highlight, any seats-remaining text).
4. 24 hours or more later: `$env:TRAVELPAYOUTS_TOKEN = "<token>"; node scripts/fare_search_probe.mjs stats` in your own
   terminal (PowerShell). Record which campaign or project, type and state the test ids show, and whether a **click**
   appears at all (the statistics API is known here for paid actions; clicks may not be listed).

## Step 7: the Widget-type test (optional, only if you want M11)

Create a second White Label of type **Widget**, and put its scripts on a throwaway static page in a preview branch only.
Do not touch the production site. This only matters if Page fails M1, M2 or M4.

## Stop conditions

- A payment or recurring fee appears (M6): stop and log it.
- The account warns about a brand name or blocks the domain (R3): stop and ask Travelpayouts support.
- No SubID reaches Reports or the statistics API after 48 hours (M1): the experiment cannot be measured. Log it and stop.

## What gets written down

Fill the scorecard (table in `claude_code_white_label_fare_search_2026-10-10.md`, M1 to M17) and save it as
`claude/fare_search_spike_scorecard_<date>.md`; log the result in `state_DECISION_LOG.md`. Merging any Fare Search code
still waits for gates G0 (scorecard passes) and G2 (positioning decision), and nothing is sent to a real visitor beyond
the owner allowlist until the conditions C1 to C7 in ROADMAP steps 77 to 83 are met.

## Items Claude Code can do once DNS is up

- Re-run `check` and read the output with you.
- Add a `--subid-param` option to the probe when Travelpayouts names the parameter.
- Nothing else is needed in `src/` for the spike.
