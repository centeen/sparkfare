# K0 item 6: merge train and green lane prerequisites (2026-10-18)

Read-only facts, checked 2026-10-18. Answers Addendum K Amendment 1 section 10, item 6.

| Question | Answer |
|---|---|
| What CI runs, and when | `.github/workflows/pr-tests.yml` ("Tests"): on every pull request and on pushes to `main`. It runs `npm ci`, `npm run check:copy` and every `tests/*.test.js` except `t7b_push` (needs outbound network). About 1 to 1.5 minutes. Cloudflare's "Workers Builds" also runs on every PR and builds the Worker. |
| Branch protection / required checks | **None.** `main` is not protected (GitHub returns 404 for protection). Nothing stops a merge on a red check, so the rule is by practice: merge only when both checks are green and `mergeStateStatus` is CLEAN. A train merge passes by using `gh pr merge --match-head-commit <sha>`, which refuses if the head moved after approval. |
| Deploy time | Cloudflare auto-deploys `main` on merge, usually one to two minutes (observed on every merge today). Proposed smoke-check window: wait for the new version to appear in `wrangler deployments list`, then check within 5 minutes. |
| Revert | `git revert -m 1 <merge commit>` on a branch, PR, merge; it deploys by the same path. D1 migrations are not reverted by it. About 5 minutes end to end. |
| Contrast, 24 px target, hex and text-node checks in CI | **Not in CI today.** `scripts/contrast-audit.js` is a browser-side script run by hand; there is no hex lint, no 24 px target check and no text-node diff check. They are what K-B10 builds. They can run in CI with a headless browser (Playwright is not a dependency; adding it touches the lockfile, which has bitten this repo once, see the npm 10 note). |

## Consequence for arming the green lane
The lane's conditions (zero changed text nodes, contrast and 24 px checks, screenshots, an automatic revert) need checks that do not exist yet. So:
- **K-B10 (CI brand checks) is the first package in the lane and cannot use it:** it creates the checks, so it goes through a pack once.
- **K-B6 and K-B7 may use the lane only after K-B10 has merged and its checks run on every PR.** Until then they go in packs like any other PR.
- K-A1a and K-A2 are already merged.
- Every green-lane merge still needs: green CI, green deploy, the PR's smoke check in the window above, screenshots at 375 and 1,440 px, and a note in the next approval pack.

## Pace dial
Full, per the owner's go (2026-10-18). Pace line for the first session of Phase B: 12 of the planned Phase A and J packages merged (K-A1a/b to K-A6, J1 data and display, J3b, J5, step 97 stack); Phase B starts now, ahead of its Oct 25 target.
