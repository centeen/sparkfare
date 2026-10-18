// K-B1: the one site header. Every static page, both generators and the Worker templates carry this exact markup
// (scripts/apply-shared-header.mjs writes it into the static pages; tests/k_b1_shared_header.test.js checks that every
// page, generator and template matches this string). The markup is server-rendered so crawlers see the links; the small
// script only collapses the menu on phones and opens it from the Menu button.
//
// Primary links: Deals, Check a price, Time off, Away Mode, Routes. Account: "Sign in" when signed out; when signed in
// the Account menu (Watchlists, Trips, Preferences) is revealed and the Sign in link becomes Sign out (nav-auth.js).
// Blog, Referrals, About, Terms, Privacy and Disclosure live in the footer (site-footer.js).
export const SITE_NAV_HTML = `<nav class="site-nav sf-nav" aria-label="Main">
      <a href="/" class="brand-link">
        <svg class="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
          <path d="M8,8 L8,36 L30,36 L27,29 L30,22 L27,15 L30,8 Z" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="18" cy="22" r="3.5" fill="var(--spark)"/>
        </svg>
        Sparkfare
      </a>
      <button type="button" class="sf-menu-btn" aria-expanded="false" aria-controls="sf-menu">Menu</button>
      <div class="sf-menu" id="sf-menu">
        <a href="/">Deals</a>
        <a href="/check">Check a price</a>
        <a href="/time-off">Time off</a>
        <a href="/away-mode">Away Mode</a>
        <a href="/data/">Routes</a>
        <div class="sf-account">
          <details class="sf-account-menu sf-signed-in-only" hidden>
            <summary>Account</summary>
            <div class="sf-account-links"><a href="/watchlists">Watchlists</a><a href="/trips">Trips</a><a href="/account">Preferences</a></div>
          </details>
          <a class="sign-in-link" id="sign-in-nav-link" href="/sign-in">Sign in</a>
        </div>
      </div>
    </nav>
    <link rel="stylesheet" href="/brand/header.css">
    <script src="/brand/header.js"></script>`;

// The Worker-rendered pages: same markup, plus the Leave-by plan link only while ENABLE_LEAVE_BY_PLAN is on (it is
// dark until Nov 9; plan-entry.js adds the same link on the static pages when the flag is on).
export function siteNavHtml(env = {}) {
  if (env.ENABLE_LEAVE_BY_PLAN !== 'true') return SITE_NAV_HTML;
  return SITE_NAV_HTML.replace('<a href="/check">Check a price</a>', '<a href="/check">Check a price</a>\n        <a href="/plan?src=nav">Leave-by plan</a>');
}
