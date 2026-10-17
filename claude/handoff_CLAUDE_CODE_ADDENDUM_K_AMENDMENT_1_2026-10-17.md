# Addendum K, Amendment 1: owner-paced timeline, merge train and green lane (Oct 17, 2026)

**Status:** PROPOSED by the Hub on the owner's direction (D-034, D-035, Oct 17 Israel). Pacing numbers are provisional until the owner confirms them. The green lane (section 5) is off until the owner arms it after reading K0. The owner relays this file to Claude Code alongside Addendum K.

**Why.** The owner works another job Sunday to Thursday. Build time on Claude is Sunday to Thursday evenings and all day Friday and Saturday (Israel time). The owner wants to progress at their own pace, to be able to build far more than planned in a window, and to keep the overall timeline aggressive. Scope, packages, acceptance tests and standing rules in Addendum K are unchanged, except where section 4 and section 5 amend the per-PR approval rule (D-020, D-035). This amendment replaces:
- the "timeline" table and the rule "every phase starts when the previous one is merged and live";
- the suggested daily approval batch at 09:00 ET (that hour falls inside the owner's workday).

**Assumptions (Hub inference; the owner will correct):** you progress in sessions the owner starts, unless the owner tells you a session is scheduled. An evening ("E") holds about one package from build to merge and a full day ("D") about three. These are estimates, not measurements.

## 1. Sequence governs; dates are targets
Packages merge in the order below. A target date is the latest the package should be live to keep the overall plan on pace; it is never the earliest. If a window is skipped, the package moves to the next window and nothing else changes. Report the pace at the start of every session (section 7).

**Hard dates (unchanged):** last feature merge Wed Nov 4; Thu Nov 5 is fix-only (fixes found by verification, no new features); Fri Nov 6 is verification and the go/no-go (18:00 ET is about 01:00 Sat Nov 7 Israel time, as I understand the clock change on Oct 25); freeze Nov 6 18:00 ET to Nov 8; launch Sat Nov 7, 10:01 Israel time.

## 2. Target pace (cumulative; Israel dates)

| Window | Type | Target by end of window |
|---|---|---|
| Sat Oct 17 | D (now) | Release J0 and K0 now (read-only). Report, then stop |
| Sun Oct 18 | E | Owner approves the combined J0/K0 plan; K-A1 built and merged if time allows |
| Mon Oct 19 | E | K-A1 and K-A2 merged |
| Tue Oct 20 | E | K-A3 merged (Hub reads the final copy first) |
| Wed Oct 21 | E | K-A4 merged (Petcube hidden) |
| Thu Oct 22 | E | J1 data accuracy merged |
| Fri Oct 23 | D | K-A5 with J4, and K-A6 with J2, merged |
| Sat Oct 24 | D | J3 merged; Phase A acceptance tests pass in production. **Checkpoint 1** |
| Sun Oct 25 | E | K-B1 shared header and footer |
| Mon Oct 26 | E | K-B2 homepage (may take two evenings) |
| Tue Oct 27 | E | K-B2 finished; K-B10 CI checks |
| Wed Oct 28 | E | K-B3 route template |
| Thu Oct 29 | E | K-B4 `/check` verdict and signature spark |
| Fri Oct 30 | D | K-B5 time-off planner; K-B8 secondary surfaces |
| Sat Oct 31 | D | K-B6 night mode, K-B9 directory and blog, K-B7 images, or catch-up. **Checkpoint 2** |
| Sun Nov 1 | E | K-C1 calm plan register (live) |
| Mon Nov 2 | E | K-C2 built dark |
| Tue Nov 3 | E | Buffer; verification file drafted |
| Wed Nov 4 | E | Last feature merge; verification file complete. **Checkpoint 3** |
| Thu Nov 5 | E | Hub re-scan and re-walk; fix-only PRs |
| Fri Nov 6 | D | Go/no-go |

Capacity check (inference): 19 windows from Oct 17 to Nov 4, five of them full days, give room for about 29 package slots against about 21 PRs plus the two read-only reports. That is roughly a quarter spare, before any competing work (section 9).

## 3. Build ahead and pull forward
- You may build the next packages as **stacked draft PRs** in dependency order while earlier ones wait for approval. K-A1 (tokens and fonts) is the base for everything.
- **Pull-forward is allowed.** If the owner builds much more than planned in a window, everything the owner approves in that window may be merged early, in dependency order, up to Wed Nov 4 (last feature merge). Early merge also buys more production days to catch regressions.
- **Limits that do not move:** K-A1 merges first; Away Mode Wave 1 flags stay off until Nov 9 (D-016); copy-bearing PRs need the Hub's Guard read (recorded in the PR) before they enter a merge train; the freeze and the Nov 5 fix-only rule stand.
- A PR is done only when it is live in production.
- If Cloudflare preview deploys work, use them for screenshots. If not, say so in K0 and use a local build; the production read happens after the merge.

## 4. Merge train (owner approves a batch; Claude Code merges and deploys in order) (D-035)
This amends the per-PR approval rule: the owner may approve a numbered batch in one reply instead of one PR at a time. It does not remove the owner's explicit approval.
1. **Approval pack first.** The owner approves only PRs listed in an approval pack (section 6), for example "approve 1 to 8". Merge only what is named.
2. **Approval binds to a commit.** Each approval covers the head commit shown in the pack. Any later push to that PR voids its approval; re-list it in the next pack.
3. **Order and gates.** Merge in the pack's dependency order, one at a time. After each merge, wait for a green Cloudflare deploy and run the PR's production smoke check (the page loads, and the PR's acceptance test passes) before the next merge.
4. **Stop on first failure.** If a deploy fails or a smoke check fails: stop the train, revert only the PR just merged if production is affected, and report. Do not continue, do not merge anything else, do not retry silently.
5. **Copy PRs** enter a train only after the Hub's Guard read of the final text is recorded in the PR.
6. **No trains** from Nov 6 18:00 ET to Nov 8. On Nov 5 a train may contain only fix-only PRs.
7. Report the result of every merge: PR, merge commit, deploy status, smoke result.

## 5. Green lane (optional; off until the owner arms it) (D-035)
Eligible packages, and only these: **K-A1, K-A2, K-B6, K-B7, K-B10.** A green-lane PR may merge itself, without waiting for a pack, when all of these hold:
- the diff touches only styles, tokens, fonts, the image-pipeline attributes (K-B7) or CI configuration (K-B10); it changes no text, link, disclosure, flag, email, migration, data logic or Travelpayouts tool;
- a diff check shows zero changed text nodes; the copy checker, the contrast and 24 px target checks, the hex lint and all tests pass;
- screenshots at 375 and 1,440 px, in light and dark where K-B6 applies, are attached;
- the deploy is green and the production smoke check passes within the time window set in K0; if either fails, the PR is reverted automatically and reported.
The owner sees every green-lane merge in the next approval pack, labeled "green lane, already merged". The owner may veto a package by naming it ("no green lane for K-B7") and may switch the lane off at any time.
**Arming.** The lane stays off until K0 confirms the prerequisites in section 10 and the owner says "arm the green lane".

## 6. Approval pack at the end of every session
Leave one message the owner can answer in a single reply:
- PRs ready, in the order to merge, each with: link, head commit, files, before and after copy, screenshots at 375 and 1,440 px, tests added, acceptance result, and one line on risk;
- green-lane merges already made, with deploy and smoke results;
- what you built ahead (draft PRs), and what the next window needs from the owner;
- the pace line (section 7).
The owner replies "approve 1 to 3" or similar.

## 7. Pace line (first thing in every session)
"Pace: {n} of {N} packages merged; target for today was {x}; behind by {k}; next: {package}."

## 8. Checkpoints and the pace dial
At each checkpoint the Hub reports how many Core packages are behind. If more than two are behind, the Hub proposes the next dial position and the owner decides. Pulling work forward moves the other way: if the owner is ahead, the Hub says so and the dial stays on Full.

| Dial | What ships before launch |
|---|---|
| **Full** | Everything in Addendum K and J |
| **Core** | Drops K-B6 night mode, K-B9 directory and blog, K-B7 image pipeline (the Addendum K cut order) and moves K-C2 to after launch. K-C2 is built dark, so launch visitors see no difference |
| **Minimum** | Only packages that close a critical or high finding. K0 must list which those are (section 10) |

## 9. Competing work (proposal, owner decides in the K0 review)
J and K are the critical path. Hub lean for the order when evenings collide: J and K PRs; then read-only reports (Addendum I Step 0, the campaign-100 call, the Task C report); then the Addendum G design doc; then Addendum F articles; then Away Mode dark builds. Two logged dates are at risk if this order holds: D-015's "first three articles before Nov 6" and D-016's "Wave 1 flips from Nov 9 at the earliest". K0 says which, by how many days.

## 10. K0 additions
Add to the K0 plan:
1. A severity map: every K and J package, which critical or high findings it closes, and a size (S, M or L).
2. Whether Cloudflare preview deploys work and how screenshots are produced.
3. Confirmation of a green production deploy of `main`, the `ENABLE_METER_TRACKING` line and commit, and the cause of the Petcube card.
4. Which competing work you propose to slow, and the dates it moves (section 9).
5. A sanity check of the section 2 table against your own size estimates; propose changes, do not silently adopt them.
6. **Merge train and green lane prerequisites:** what CI runs today and on which events; whether branch protection or required checks exist and how a train merge would pass them; how long a deploy takes and the smoke-check window you propose; how a revert would deploy; whether the contrast, target, hex and text-node checks can run in CI. Say plainly what is missing and what it would take.

**Stop after K0 and wait for the owner.**

## 11. Unchanged
Standing rules, package definitions, acceptance tests, the freeze, Away Mode Wave 1 flags staying off until Nov 9 (D-016), and the reply format in Addendum K. Except as amended in sections 3 to 5 and 10, each PR still requires the owner's explicit approval.
