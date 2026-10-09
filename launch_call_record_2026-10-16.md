# Launch call record: template for the Oct 16, 2026 18:00 ET go/no-go (DRAFT)

Prepared 2026-10-09. **Nothing here is a decision.** The owner makes the call; this is the blank form, pre-filled only with
facts already checked on Oct 9. It pairs with `launch_go_no_go_2026-10-16.md` (the checks) and `go_no_go_scorecard.md` (the Oct 7 snapshot).

How to use it on Oct 16: run the checks in `launch_go_no_go_2026-10-16.md` from about 14:00 ET, fill the "Oct 16" column below, make the
call at 18:00 ET, then (1) copy the decision block into `state_DECISION_LOG.md`, (2) update `ROADMAP.md` Phase 0 in the same commit, and
(3) delete this file or mark it done. Do not edit the Oct 9 column; it is the baseline.

## 1. Evidence

| Check | Pass rule | Oct 9 baseline (checked 07:00 to 08:00 UTC) | Oct 16 |
|---|---|---|---|
| 1. Deals for every origin (P0) | each marketed origin prices wherever data supports it; both files under about 36 h old | Files 0.8 h old. Priced routes: JFK 32, ATL 20, BOS 22, DFW 21, EWR 32, IAD 20, IAH 11, LAX 26, MIA 22, ORD 25, SEA 16, SFO 23. **DEN 1, PHX 0, LAS 0** (still building history). TLV 31 (not marketed). | |
| 2. Away Mode (P0) | 14+ live partners, 0 empty blurbs, `/away-mode` 200, `/out/safetywing` 302 | 14 partners, 0 empty blurbs, 200, 302 | |
| 6. Analytics events | `outbound_click`, `route_promoted`, `alert_email_sent` each seen within a day or two | all three present; `email_open` 33 in 7 days | |
| 7. Email deliverability | webhook enabled with 200s; latest digest in Inbox with headers and SPF/DKIM/DMARC pass; breaker not tripped | D1: 0 bounces, 0 complaints, 7 digest sends in 7 days. Webhook status and raw headers not checked (need the Resend dashboard and a real inbox). DMARC still `p=none` | |
| 10. Route pages | few hundred URLs, no TLV or `undefined`, route button goes to `/?origin=..#signup-form`, thin route 404 | 261 URLs, none bad; LAX button correct; DEN to Bali 404 | |
| Phone QA (owner) | the seven steps in the checklist | Headless 375px pass done Oct 9 (no overflow on 10 pages); the real-phone walk is the owner's | |
| Also: step 12, step 49 | monitor verified; `/check` live | `/check` live and answering. Step 12's alert path unverified; first weekly standup due Oct 12 | |

## 2. Judgement calls to settle on the call
1. **DEN, PHX, LAS and the homepage line.** If each is still under about 20 priced routes, either soften "Tracking prices for 600 routes from 15
   major hubs." (tests in `tests/homepage_hub_count.test.js` tie it to the data and must change with it) or drop the origin. Choice: ____________
2. **DMARC.** Tighten to `quarantine` now, or after launch volume is stable. Choice: ____________
3. **Anything that failed.** Say so in plain words here before deciding: ____________

## 3. Decision (fill in; one outcome)
- [ ] **GO.** All P0 criteria pass; any non-P0 gap is listed below.
- [ ] **GO with reduced scope.** Scope cut: ____________
- [ ] **NO-GO for a P0 fix, so launch the JFK-only board** with a "more airports this week" note. Reason: ____________ (the date does not move)

Decided by: ____________   Time (ET): ____________   Open items carried past launch: ____________

## 4. Block to paste into `state_DECISION_LOG.md`
```
- DECISION 2026-10-16: Launch go/no-go: <GO | GO with reduced scope: ... | NO-GO for P0, JFK-only fallback> (<name>, <time> ET). P0 checks 1 and 2: <result>. Gates 6, 7, 10 and phone QA: <result>. DEN/PHX/LAS: <homepage line kept | softened | origins dropped>. DMARC: <left at none | set to quarantine>. Carried past launch: <items>.
```
Then update `ROADMAP.md` Phase 0 (statuses and the launch note) in the same commit, citing this decision.

## 5. Launch weekend watch list (from `launch_go_no_go_2026-10-16.md`)
Email breaker counts Saturday and Sunday evening; signup abuse from a single source; daily fetch freshness and the 08:00 UTC health email;
`/flight/*` 5xx under load; any public claim found wrong (suspend the flag, review `dealQuality`).
