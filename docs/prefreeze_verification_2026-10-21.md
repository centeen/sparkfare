# Pre-freeze verification, Addendum K section (first pass)

Date: 2026-10-21. Read-only: production page and API reads, GitHub check results. No fare or partner clicks. Re-run on Nov 4 to 5.

## K package status (all merged to `main`)

K-A1 to K-A6 (steps 119 to 124), K-B1 to K-B10 (steps 125 to 134), K-C1 (135), K-C2 (136, built dark behind its Wave 1 flags). K verification (137) is this document.

## Production sweep, 13 key pages

| Page | Status | h1 | main | tokens.css linked | Google Fonts requests |
|---|---|---|---|---|---|
| / , /check, /time-off, /away-mode, /leave, /data/, /data/jfk-to-prague-czechia, /flight/JFK/Prague, Czechia, /hub, /blog/, /privacy, /disclosure | 200 | 1 | 1 | yes | 0 |
| /sign-in | 200 | 1 real (a second match is a code comment about Clerk's own heading, which the page script replaces) | 1 | yes | 0 |

Gold `#E8B930` appears on the route page only as the logo mark's dot (allowed). It does not appear in the source of any other page checked.

## Partners and policy

- `/api/partners` returns 13 live partners. Petcube is not among them (D-032, row `pending`).
- Yesim blurb reads "Data from the moment you land, on a supported network" (K-A3 wording is live).
- `robots.txt` disallows `/out/`, `/go/`, `/card/`, `/welcome`.

## CI

The `brand` workflow (contrast, 24 px targets, small text, gold-only, body font, at 375 and 1,440 px on 17 surfaces) and `test` passed on `441949ea`. The run on `9b5a517f` was cancelled by the next push, not failed.

## Not yet checked in this pass

- Rendered screenshots of home, a route page, `/check`, `/time-off`, `/away-mode`, `/leave` and an email at 375 and 1,440 px.
- Night mode on production (CI covers it on local files).
- Cut-list acceptance numbers measured on production: first price above 812 px at 375 wide, image transfer size per card.
- Migration 0029 (partner copy) in production D1. The API shows the new Yesim line, which suggests it is applied, but `d1_migrations` was not read.
- K-C2 stays dark; nothing to verify live until its flags are flipped.
- Mixed-state check after quick successive merges (see the CLAUDE.md note on out-of-order Cloudflare builds).
