# Guard read packet: "Sign up" nav link (PR #502, D-079 freeze exception)

PR: https://github.com/centeen/sparkfare/pull/502 (draft, not merged)
Scope: the nav link only. The BOS empty-state wording is not in this PR.
Reader: Hub Guard (non-attorney). Please return PASS, CONDITIONAL or FAIL.

## 1. Label (exact string)

`Sign up`

No other new visible copy. No aria-label, tooltip or description.

## 2. Markup (shared header, every page and generator)

```html
<a class="sign-in-link" id="sign-in-nav-link" href="/sign-in">Sign in</a>
<a class="sign-up-link sf-signed-out-only" id="sign-up-nav-link" href="https://accounts.sparkfare.com/sign-up?redirect_url=https%3A%2F%2Fsparkfare.com%2Faccount">Sign up</a>
```

Tab order is Sign in, then Sign up.

## 3. Target and return-URL behavior

- No-JS default: `https://accounts.sparkfare.com/sign-up?redirect_url=https://sparkfare.com/account`.
- With JS: `brand/header.js` replaces the href with `https://accounts.sparkfare.com/sign-up?redirect_url=` plus the URL-encoded current page (origin, path and query). Nothing else is added to the URL.
- UNVERIFIED: whether Clerk honors `redirect_url` on its hosted sign-up page for this instance. `accounts.sparkfare.com` returns a Cloudflare bot check to automated requests, so it could not be tested. The post-deploy smoke check must confirm it.

## 4. Signed-in condition

- Hidden (`hidden = true`) when a Clerk session exists. `nav-auth.js` does this on most pages; the homepage's own script does it there.
- Shown to everyone else, including visitors with no JS.
- Pages that never load Clerk get no hiding, so a signed-in visitor on such a page would still see Sign up. How many pages that covers has not been checked.

## 5. What the target is

Clerk's hosted account sign-up. It creates an account, not an email alert. The handoff file's default target was the homepage alert form (saves an email and a home airport only). D-079's stated reason (visitors cannot find the account sign-up) was followed instead.

## 6. Scope and tracking

- Nav link only.
- No tracking added. Whether nav clicks are tracked has not been confirmed.
- The privacy page already names Clerk for sign-in.

## 7. Style

A filled sage link, visually heavier than Sign in. The handoff says Sign in should stay equal or quieter. Hub to call it; changing it to a plain link is a small edit.

## 8. Not verified

- Clerk's `redirect_url` return path.
- The 375px header (one row, at most 64px) and the Tab focus ring, in a browser.
- The full test suite. Header, homepage and nav-auth tests pass (26).
- Whether Clerk's verification emails go through Resend and count against the 100-a-day cap (D-079 term 7).

## 9. Revert

`git revert -m 1 <merge commit>` on main. The sha will be stated before merging.
