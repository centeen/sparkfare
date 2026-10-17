# Sparkfare Site Scan vs Brand v1 (step 6, for approval), extracted text

> **Provenance.** Machine-extracted text of the owner-supplied PDF "Sparkfare Site Scan vs Brand v1 (step 6, for approval).pdf" (16 pages, supplied 2026-10-17). It is committed as text, not as the PDF, because `.assetsignore` blocks `*.md` but would not block a PDF placed under `claude/` from being served publicly. **Limits of the extraction:** tables are flattened column by column; the "Brand fit by surface" bar chart on page 3 (per-surface scores, shown on hover in the source) has no extractable text, so the per-surface scores are not in this file (the report states the mean, 2.1 of 5, and that no surface reaches 4). Wording is exactly the PDF's; line breaks inside table cells and some headings are an artifact of extraction. The PDF itself is the owner's copy.

---

===== PAGE 1 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Sparkfare Site Scan vs Brand v1 (step 6, for
approval)
Oct 17, 2026 · @Coby
Summary
The live site carries Sparkfare's honest engine but almost none of its brand: the brand
typefaces load on only 4 of 18 surfaces, five different visual systems are in use, and gold
(the deal signal) is spent on ordinary buttons. 49 findings across 18 surfaces: 5 critical, 16
high, 19 medium, 9 low . Mean brand fit is 2.1 of 5. Most of the gap is a missing shared
foundation (one tokens file, one font file, one header), so a few packages lift every page at
once. Spokes: Brand and Creative Director, UX and Accessibility, Behavioral Design
(seated D-028). This is an expert scan, not user testing.
The ten fixes that matter most
1. One tokens and fonts file on every page (13 of 18 surfaces fall back to the operating
system's default font).
2. Gold only for verified deals: "Create alert" and "View fare" move to Sage; amber is
retired.
3. Remove "Matches your trip" from all 14 Away Mode partners until the person has
answered a question: today it claims a match it has not made.
4. Replace unsourced and urgent blurbs ("70% below comparable Mediterranean
pricing", "pricing that vanishes after April").
5. Stop promising instant alerts where the product sends a daily email (homepage, route
pages, blog).
6. Mobile homepage leads with a fare: today the first price sits at 1,204 px, below a 4-
field form.
7. Fix the three AA contrast failures (badge 3.9:1, link 3.7:1, banner text 4.3:1).
8. One header on every page: five primary links and a menu; secondary pages show 12
links in three rows on a phone.
<main> <main>
9. An H1 and on every page (none have ; the homepage has no H1).
10. Rebuild the route page around the Fare Ticket with a fare link, the fare's dates and
one call to action.
Page 1 of 16

===== PAGE 2 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Owner decisions: approve the report; approve Phase A (six packages before Nov 4); hide
the Petcube card now; then the Hub writes Addendum K for Claude Code.
Scope, method and the build seen
Production at sparkfare.com was scanned on Oct 17, 2026 between about 14:20 and
14:45 Israel time; because Cloudflare deploys have failed since PR #269 (reconciliation
main
item 81), this is the last successful build, not . A re-check follows the deploy fix (D-
029). Every finding should be re-tested then; some may already be fixed on main (for
example the LIVE-CHECKED rule in PR #281).
Item Detail
Surfaces (18) Home, route page (
/data/ord-to-lisbon-
portugal ), /check , /time-off/sea , /leave ,
, index, , a blog
/away-mode /data/ /blog/
post (Cebu), /pricing , /hub , /about ,
/disclosure , 404, sign-in (Clerk), /digest ,
widget.html , email templates (repo read)
Behind sign-in (redirected, not scanned , , : read from
/watchlists /trips /account
live) the repo's HTML only
Viewports 1,440 × 900 desktop on every surface; 375 × 812
mobile on home, route page and Away Mode
Measured by script Computed font families, sizes and colours;
WCAG contrast of every visible text node
against its real background; target sizes;
landmarks and headings; first-price position;
image sizes; focus style after real Tab presses
Not done No form submitted (no /check verdict, no
signup), no partner or fare click, no account
sign-in, no night-mode test (the site has no
night styles), no screen-reader pass
Judged against Brand & Design Direction v1 (D-025): the ten
design laws, tokens, type, Fare Ticket, chips,
imagery, motion, voice and lexicon; WCAG 2.2
AA
Page 2 of 16

===== PAGE 3 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Severity: critical = a misleading claim or a live item against a decision; high = breaks a
design law on a primary path, or fails WCAG AA; medium = off brand or weak on a
secondary path; low = polish.
Brand fit by surface
No surface reaches the target of 4; the shared foundation (tokens, fonts, header) is
what holds every page down, so the gap closes site-wide rather than page by page.
Brand fit = how closely the surface follows v1's laws, tokens, type and voice, scored 1 to 5
by the creative bench [I].
Creative bench scores, production scan Oct 17, 2026 · hover a bar for the reason
Page 3 of 16

===== PAGE 4 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
The widget and the email templates score highest because they were already built from
the style guide's Paper and Sage. The route page, Away Mode and the index score
/data
lowest, and they are where most search and partner traffic lands.
Site-wide system findings
Twelve findings sit beneath every page; fixing SYS-1 to SYS-6 changes all 18 surfaces at
once. Measured values are from the production scan; "Phase" refers to the plan below.
ID Finding (measured) Law or standard Severity Fix spec Phase
SYS-1 Brand fonts load only on Law 1; tokens 5.5 High Self-host Space Grotesk A
home, /digest , the 500/700, Inter 400/500/600,
widget and emails. 13 IBM Plex Mono 500 (woff2
surfaces declare 'Segoe subsets) in one
UI', sans-serif with no brand/fonts.css , imported
web font, so Mac, iPhone by every page and by the
and Android visitors get pSEO, blog and digest
the system default generators
SYS-2 Five visual systems: home Law 4; governance High One brand/tokens.css with A
(Sand, Space Grotesk); 5.9 the v1 tokens; every page and
secondary pages (Sand, template imports it; no hex
Segoe UI); values outside it (CI lint)
/digest
(white, Inter, default blue
links); sign-in (Clerk's
default black button on a
taupe overlay); widget
and emails (style guide
Paper)
#2F6B47
SYS-3 Gold spent on actions: Law 4: gold means High All actions to Sage A
"Create alert" and "View a verified deal with white text; gold only as
fare" use #E8B930 ; the Deal chip and mark dot;
"Copy" ( ), the retire amber
/hub
account button and the
"Matches your trip"
badge use amber
#B8720F
Page 4 of 16

===== PAGE 5 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
ID Finding (measured) Law or standard Severity Fix spec Phase
SYS-4 Three WCAG AA text WCAG 1.4.3 High v1 tokens pass: Sage text on A
failures: white on amber Paper 5.5:1, white on Sage 6.3:1
badge 3.9:1 at 12 px (14
instances, Away Mode);
Sage link on Sand 3.7:1 at
14.4 px ("Don't see your
airport?"); cream on Sage
4.3:1 at 15.2 px (watchlist
banner)
SYS-5 Header has 12 links (Away Laws 1, 9 High One shared header: Deals, B
Mode, Blog, All Routes, Check a price, Time off, Away
Check a price, Time off, Mode, Routes, plus an account
Watchlists, Referrals, menu; Blog, Referrals, Privacy
Trips, Preferences, move to the footer; mobile
Privacy, Sign in, menu everywhere
wordmark). "Time off" is
missing on 7 secondary
pages. Only home has a
mobile menu; elsewhere
the nav fills three rows of
a 375 px screen
SYS-6 No page has a <main> ; WCAG 1.3.1; 5.8 High Already in Addendum J (E1); A
home has no H1 (its only add <main> and one H1 to
H2 reads "Join this trip to every template; drop or fill the
!", an empty template empty heading
string); /leave has a
second, empty H1
SYS-7 Keyboard focus uses the WCAG 2.4.7; 5.8 Medium :focus-visible { outline: A
browser default (a thin, 2px solid var(--ink);
auto-coloured ring) on site-
outline-offset: 2px }
header links wide
SYS-8 "Request it" is an 5.5 buttons; 2.5.8 Low Secondary button style, 44 px A
unstyled browser button tall
(Arial, 21 px tall)
SYS-9 No night mode: no 5.5 night tokens Medium Night tokens from v1, toggled B
by the system setting
prefers-color-scheme
rules anywhere
SYS- 20 different font sizes on 5.5 type scale Medium Seven-step scale (13 to 44 px); A
10 the homepage, including nothing below 13 px
10.4, 10.9 and 11.2 px text
Page 5 of 16

===== PAGE 6 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
ID Finding (measured) Law or standard Severity Fix spec Phase
SYS- Unsplash images are 5.8 performance Medium srcset at 480 and 960 px via B
11 served at 1,080 to 1,200 px Unsplash's and
w= fm=webp
wide into cards about 200 parameters; 4:3 crop
to 400 px wide
SYS- Footer repeats two Law 1 Low One footer: what Sparkfare is, B
12 disclosure paragraphs the disclosure link, Terms,
plus a third "prices are Privacy
sampled" line
What already works and must be kept: credit lines under every photo; inline disclosure
beside fare links; reduced-motion rules on the homepage; desaturated photos on
"Building history" cards (an honest signal worth keeping inside the chip system); the 404's
/pricing
on-voice line "This fare doesn't exist"; 's plain, honest copy.
Findings by surface
37 surface findings sit on top of the system layer; the five critical ones are all copy or
governance, so they can be fixed before the freeze without design work. Sorted by
surface, worst first within each.
Home (AUS shown by default)
ID Finding Law Severity Fix spec Phase
H-3 Featured card says "chosen for Laws 2, 8; Critical Template blurb (Addendum J A
the place, not the price" yet Guard F1); the featured card shows
shows $797 with no basis, and the Fare Ticket's basis or says
its blurb adds "Four-star dining "No verdict yet"
from $12. Pure visual
storytelling." (unsourced
figure, filler)
H-4 Card blurbs carry unsourced Law 8; FTC flag Critical Same template blurb; no A
comparisons and urgency: (item 79) figure without a source; no
"70% below comparable time pressure
Mediterranean pricing",
"pricing that vanishes after
April", "command premium
markups", "Currency arbitrage
meets temple culture"
Page 6 of 16

===== PAGE 7 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
ID Finding Law Severity Fix spec Phase
H-1 On a 375 px phone the first Laws 1, 9; High Order: H1, origin, today's Fare B
price sits at 1,204 px; the first Baymard Ticket, one email field, then
screen is a 4-field form and an the board; airport request
airport-request box moves below the board
H-5 "LIVE-CHECKED PRICE" tags Law 2 High Addendum J1 tag rule; A
five "Building history" cards replace with "Checked 3 h
(items 67, 71) ago · 09:10 ET"
H-6 "we'll email you the moment a Law 2; voice High "One email a day when a fare A
fare there is genuinely worth a from AUS beats its usual
look" while alerts are a daily price."
digest
H-9 Default origin AUS has no Laws 1, 3 High Empty state: "No verdicts A/B
verdicts, so the first from AUS yet. Nearest hub
impression has no deal and no with deals: DFW." (Addendum
explanation J C2 plus nearest hub)
H-10 "880 routes" in the tagline line Law 2 High Count from the data at build A
and "Browse All 880 Routes"; time (J1.5)
data holds 828 (item 73)
H-13 Cards show price and 5.5 Fare Ticket High Fare Ticket anatomy (J2 with A
sparkline but not the fare's v1 visuals)
dates, nights, airline or basis
H-2 No hero line; the proof line sits 5.1 Medium H1 "Look forward to it. A
where an H1 should be Honestly." (D-026) above the
proof line
H-7 "Building history" cards are 5.5 chips Medium Keep the photo desaturated; A
fully greyed, including the dashed "Building history"
"View fare" button, so they chip; button stays Sage
read as disabled
H-8 Signup asks for 4 things up Laws 3, 9 Medium Email and airport first; trip B
front (email, airport, trip length and travelers after
length, travelers) confirmation
H-12 A full-width Sage watchlist Law 9 Medium Becomes the secondary B
banner competes with the "Watch" action on each ticket
board for the key action
H-11 The travelers field shows only WCAG 3.3.2 Low Visible label "Travelers" A
"1" with no visible label on
desktop
Page 7 of 16

===== PAGE 8 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Route page ( /data/ord-to-lisbon-portugal )
ID Finding Law Severity Fix spec Phase
R-3 "get notified instantly when Law 8; Critical "Watch this route. One email A
airlines slash the fare" (daily voice when it drops below its usual
alerts; hype verb) price."
R-1 No fare link, no fare dates, a 760 5.5 Fare High Rebuild the template around the B
px plain card in the system font Ticket Fare Ticket, a 30-day chart and
Watch (G59, J2)
R-2 H1 is an SEO string: "ORD to Voice Medium H1 "Chicago to Lisbon"; keep the B
Lisbon, Portugal Fall Flights: long string in
<title>
Current Price vs. 30-Day Median"
R-4 Two calls to action ("Create free Law 9 Medium One: Watch by email A
alert" and "Create a free account
and a watchlist")
R-5 The sparkline sits inside a 5.5 data Medium A 30-day chart with a dashed B
sentence at text height viz median line and today's dot
R-6 On mobile the nav fills three Law 1 Medium Shared header (SYS-5); H1 at 26 B
rows and the H1 wraps to four px
lines at about 28 px
Tools
ID Finding Law Severity Fix spec Phase
T-1 /time-off : the peak line "10 PTO 5.2 peak 1 High Hero number in Space Grotesk B
days, 42 days off" is body text 44 px, with "10 PTO days" in Plex
Mono
T-2 : 5,437 px page; every Laws 1, 7 Medium Collapse windows to one line A/B
/time-off
window repeats six destinations, each; no checklist under 5 days
"34 more" and "Before you go", (J3 C9)
including 3-day windows
T-3 /time-off : destinations are an 5.5 Medium Ranked postcards, three per B
unranked list of underlined links imagery window
C-1 : the best tool on the site 5.2 peak 1 Medium Verdict: one word and one B
/check
is a plain card in the system font; number in Space Grotesk 44 px,
the verdict is not designed as a a chip, then Watch and View
peak (verdict screen not seen: no fare; signature spark only on a
form submitted) Deal (D-027)
Page 8 of 16

===== PAGE 9 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
ID Finding Law Severity Fix spec Phase
C-2 /check : the destination list Law 3 Low Mark them "No history yet" B
includes routes with no history
Away Mode and /leave
ID Finding Law Severity Fix spec Phase
A-1 All 14 partners carry an Laws 2, 8; Guard Critical Remove now; after A
amber "Matches your trip" answers, a neutral reason
badge before the visitor has chip ("For stays over 30
answered any question days")
A-4 The Petcube card and link Governance Critical Hide until the owner A
are live, against D-013 (item decides G62
63, G62)
A-2 Offers before guidance: 14 Law 5; Linda; Away High Calm plan register: C
partner cards follow one line Mode Plan v1 guidance and dated items
of guidance first, "Who can help" after
A-3 "Book airport parking Lexicon High "Compare airport parking A
ahead" (banned word, item before you go" (J3 F3);
65); "data the moment you "Data from the moment
touch down" you land"
L-1 /leave : a single short card, 5.6 Calm plan Medium Calm plan register with the A/C
no visual identity, an empty count of open items (Phase
second H1 C); empty H1 removed now
A-5 14 checkboxes beside WCAG 3.3.2 Low Label them ("Done") or A
partner cards with no stated remove
purpose
Content, account and email
ID Finding Law Severity Fix spec Phase
D-1 /data index: a 13,861 px Laws 1, 9 Medium Route finder: origin filter and B
bulleted list of 880 links with one row per route with its chip
no prices or status and price
G-1 : white page, default SYS-2 Medium Tokens, shared header, Fare B
/digest
blue links, its own header; a Ticket rows
public, indexable page off
brand
Page 9 of 16

===== PAGE 10 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
ID Finding Law Severity Fix spec Phase
S-1 Sign-in: Clerk's default widget SYS-2 Medium Clerk appearance variables set B
(black button, white card from tokens; a back link
inside a cream card, taupe
overlay), no way back to the
site
B-1 Blog post: about 88 characters 5.5 measure; Low 68-character measure, 17 px; B
a line at 16 px; a Cebu guide voice titles fit the trip length
titled as a "weekend sprint"
from the US
HUB- /hub : "You have ... confirmed Voice; SYS-3 Low Signed-out state copy; line B
1 referrals" shows to signed-out icons; Sage button
visitors; emoji locks; amber
"Copy"
W-1 Widget uses the old style- SYS-2 Low Import the tokens file A
guide token values
E-1 Emails use the old style-guide SYS-2, SYS-3 Low Inline the v1 token values; Plex B
values; the watchlist price is Mono in Ink for prices
Courier New in amber
, , and the 404 have no findings beyond the system layer:
/pricing /about /disclosure
their copy is on voice.
Copy and voice
Fourteen live lines break the v1 voice; each has a proposed replacement in the v1
lexicon. Proposed lines are PROPOSED: Guard and the owner approve the final text in the
Claude Code report, and the copy checker must pass. Figures in proposals are
placeholders the template fills from data.
Where Current text Problem Proposed text
Home, "we'll email you the Implies instant alerts "One email a day when
signup moment a fare there is a fare from {origin}
genuinely worth a look" beats its usual price."
Home, "Four-star dining from Unsourced figure; "Mezcal, markets and
featured $12. Pure visual filler colonial streets."
blurb storytelling." (template: three
nouns, no figures)
Page 10 of 16

===== PAGE 11 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Where Current text Problem Proposed text
Home, card "at 70% below Unsourced "Beaches, night
blurb comparable comparison markets and island day
Mediterranean pricing" trips."
Home, card "at pricing that vanishes Prediction and Cut the clause
blurb after April" urgency
Home, card "command premium Unsourced, negative "Caribbean beaches
blurb markups during peak and Mayan ruins."
months"
Home, card "Currency arbitrage Jargon, off voice "Temples, rice terraces
blurb meets temple culture." and surf."
Home, tag "LIVE-CHECKED PRICE" "Live" barred by "Checked {n} h ago ·
ROADMAP rule e; {time} {zone}"
wrong cards
Home and "880 routes" Data holds 828 "{count} routes" from
directory the data
Route page "get notified instantly False speed; hype "Watch this route. One
when airlines slash the verb email when it drops
fare" below its usual price."
Route page "Create a free account Second call to action; Removed; Watch by
and a watchlist" account wall email only
Away Mode "Book airport parking Banned word "Compare airport
ahead" parking before you go"
Away Mode "Matches your trip" (14 Claims a match not Removed until
cards, no answers given) made answered; then a
reason ("For stays
over 30 days")
Away Mode "data the moment you Overclaim "Data from the
touch down" moment you land, on a
supported network."
Blog index "how to catch this route Implies instant alerts "how to watch this
the moment it's route and hear when it
genuinely worth a look" drops below its usual
price"
Page 11 of 16

===== PAGE 12 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
On voice today and worth keeping: "This fare doesn't exist" (404); /pricing 's "Plus is not
available yet and nothing is charged"; 's "This is not your exact itinerary"; "We
/check
count requests to decide which airports to add next. Nothing is promised."
Implementation plan for Claude Code
Eighteen work packages in three phases close all 49 findings; Phase A (six packages,
CSS and copy only) closes all 5 critical and 11 of 16 high findings (two of them in part)
before the Nov 4 merge cutoff. On approval the Hub writes these as Addendum K. Each
package is one PR with the owner's approval; report first where the package touches
copy.
Gate before anything: the Cloudflare deploy must work again (item 81). Without it no
change can be verified live. Then: no merges Nov 6 18:00 ET to Nov 8; Phase A's last merge
target is Nov 4.
Phase A: before Nov 4 (CSS, copy, governance)
Package Scope Closes Acceptance test
K-A1 Tokens and brand/tokens.css (v1 SYS-1, SYS-2 Computed font-
fonts light tokens) and (pages), SYS-10, family on all 18
(three W-1 surfaces starts with a
brand/fonts.css
self-hosted woff2 brand face; a CI grep
families); imported by finds no hex colour
tokens.css
every page, the pSEO, outside ;
blog and digest no text below 13 px
generators and the
widget; seven-step type
scale
K-A2 Action Buttons and links to Sage; SYS-3, SYS-4 Script contrast check:
colour and gold only on the Deal chip zero AA text failures
contrast and mark; amber retired; on the 18 surfaces;
three contrast fixes #E8B930 appears
only in the chip and
mark
Page 12 of 16

===== PAGE 13 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Package Scope Closes Acceptance test
K-A3 Truth in copy The 14 lines in the copy H-3, H-4, H-5, H- Copy checker passes
table; template blurbs (J3 6, H-10, R-3, R-4, with the extended
F1); tag rule (J1); route A-3 banned list; zero
count (J1.5); one route- blurbs with a figure;
page call to action no "instantly", "the
moment", "LIVE" or
"Book" in Sparkfare's
own copy
K-A4 Away Mode Remove "Matches your A-1, A-4, A-5 No badge before an
governance trip" until answered; hide answer;
Petcube (pending G62); /out/petcube
label or remove partner absent from /away-
mode
checkboxes and
/disclosure
K-A5 Structure <main> and one H1 per SYS-6, SYS-7, Every surface has one
and access page; H1 "Look forward to SYS-8, H-2, H-11, H1 and one ;
<main>
it. Honestly." on home; L-1 (heading) Tab through home
empty headings removed; shows a 2 px ring on
2 px Ink focus ring; every control
travelers label; styled
secondary button
K-A6 Fare Ticket Ticket anatomy and the H-13, H-7, H-9 Every card shows
and chips (visual five chips in v1 styles; (empty state) route, price, chip,
spec for J2) "Building history" keeps basis, fare dates,
the desaturated photo airline, checked time
with a dashed chip; thin- with zone, one
origin empty state (J3 primary action
C2)
Phase B: from Nov 9 (layout and new templates)
Package Scope Closes
K-B1 Shared header and Five primary links, account menu, SYS-5, SYS-12, R-6
footer mobile menu everywhere; one footer
Page 13 of 16

===== PAGE 14 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Package Scope Closes
K-B2 Homepage Mobile order (H1, origin, ticket, email H-1, H-8, H-9, H-12
field, board); postcard beside the
ticket; email-first alert; nearest-hub
suggestion; Watch replaces the
banner; three tool tiles
K-B3 Route template Fare Ticket, 30-day chart with median, R-1, R-2, R-5
Watch by email, "Chicago to Lisbon"
H1
K-B4 verdict Verdict as peak 1; signature spark on C-1, C-2
/check
Deal only (D-027, deal floor D-021); no-
history marks
/time-off
K-B5 Hero number, one line per window, T-1, T-2, T-3
planner ranked postcards
K-B6 Night mode v1 night tokens SYS-9
K-B7 Image pipeline srcset 480 and 960 px, WebP or AVIF, SYS-11
4:3 postcards, credit lines kept
/digest
K-B8 Secondary , emails, Clerk sign-in theme, SYS-2 (rest), G-1, E-1, S-
surfaces /hub , account and watchlists on 1, HUB-1
tokens
K-B9 Directory and blog Route finder; 68-character measure; D-1, B-1
trip-length-honest titles
K-B10 CI brand checks Hex lint, contrast and target-size Prevents regression
checks, banned-urgency list in the
copy checker
Phase C: with Away Mode Wave 1 (after the owner flips each flag)
Package Scope Closes
/leave
K-C1 Calm plan and Away Mode: guidance and A-2, L-1
register dated items first, counted ("4 of 7 done"),
"Who can help" after
Page 14 of 16

===== PAGE 15 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Package Scope Closes
K-C2 Peak 2 and "You're set" screen and email; keeper v1 sections 5.2 and
keeper register for the Home card 5.6
After Phase A the Hub re-scans production and re-scores brand fit; after Phase B, a
second re-scan and a persona walkthrough of the seven journeys.
Guard, quality audit and owner decisions
Guard: CONDITIONAL. Quality audit: STATUS: PASSED. Four decisions are needed
before Addendum K is written.
Decided by the owner, Oct 17 14:34 (Israel): report approved (D-030); Phase A approved,
with Phases B and C back to back and the whole plan live before the Nov 7 launch (D-031:
Phase A Oct 20–24, Phase B Oct 25–31, Phase C Nov 1–3, last merge Nov 4); Petcube
hidden now (D-032); Addendum K written (D-033). K-C2 is built dark: Away Mode Wave 1
flags stay off until Nov 9 under D-016.
Consult steps. Frame, Ground, expert scan by the creative bench, Guard, Audit. Skipped:
Convene (no persona reacted; this is an audit of live pages against an approved standard,
and the persona walkthrough follows Phase B), Price (no revenue claim) and Spark Score
(not a gem).
Guard (AGENT_LEGAL_COMPLIANCE, non-attorney risk guidance; verify with
counsel). The Phase A copy and governance packages reduce risk: unsourced
comparative figures (FTC 16 CFR 233 flag, item 79), "Book" wording, a personalization
badge that claims a match not made, and the Petcube item live against D-013. Conditions:
final text of every replaced line goes through the copy checker and a Guard read in the
Claude Code report; disclosure stays beside every fare and partner link after the
redesign; image credit lines stay; Clerk theming must not hide the sign-in provider where
its terms require attribution (verify); no traveler data in any new URL.
Quality audit (AGENT_QUALITY_AUDITOR).
Check Result
Statuses grounded PASS: build caveat stated (item 81); findings labeled
production
Page 15 of 16

===== PAGE 16 =====
Sparkfare Site Scan vs Brand v1 (step 6, for approval)
Check Result
Statistics sourced PASS: every measured value came from a script on
the live page (method in Scope); contrast
computed with the WCAG formula
Legal labeled non-attorney PASS
Conflicts surfaced PASS: Petcube vs D-013; LIVE-CHECKED vs PR
#281; 880 vs 828
Counts tie PASS: 12 system + 37 surface = 49; 5 critical, 16 high,
19 medium, 9 low; 18 packages
Ledger respected PASS: no new feature proposed; layout packages
implement the approved v1
Decisions for the owner
Approve this report and its severities.
Approve Phase A (K-A1 to K-A6) for the pre-freeze window, after the deploy fix. K-A1
and K-A2 are new scope beyond D-020; the rest extends Addendum J items already
approved.
Hide the Petcube card now (K-A4) while G62 stays open, or confirm the flip was
intended.
Write Addendum K for Claude Code (Phase A in full; Phase B and C as outlines that
each need a later go).
Page 16 of 16
