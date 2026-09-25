// Shared by every page's nav so the "Sign in" link reflects real Clerk auth state.
//
// Found 2026-09-25: a signed-in user visiting Preferences (account.html) still saw "Sign in" in
// the top nav. Root cause -- the 2026-09-14 fix that made index.html's nav correctly swap to
// "Sign out" for a signed-in visitor was hand-written directly into that one page's inline
// script and never factored out, so B8's later nav-markup unification (2026-09-24) copied the
// static <a class="sign-in-link"> HTML to every page but had no shared behavior to bring along
// with it. Every other page (account.html, trips.html, watchlists.html, away-mode.html,
// disclosure.html, privacy.html) kept a static link that never reflected real session state.
//
// This file exists so a future new page only needs one script include plus
// id="sign-in-nav-link" on its nav anchor, not a hand-copied swap block -- the actual fix for
// this class of bug, not just a patch for today's specific report.

// Loads clerk-js only (no @clerk/ui bundle) and resolves the Clerk object, or null on failure --
// for pages that only need to READ session state, not mount any Clerk UI component. Pages that
// already load Clerk with the UI bundle (for a mounted sign-in/account form, e.g. account.html,
// trips.html, watchlists.html) should call syncNavAuthState() directly with their own
// already-loaded clerk object instead of this loader, rather than loading Clerk a second time.
function loadClerkLight() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://clerk.sparkfare.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js';
    script.setAttribute('data-clerk-publishable-key', 'pk_live_Y2xlcmsuc3BhcmtmYXJlLmNvbSQ');
    script.crossOrigin = 'anonymous';
    script.onload = async () => {
      try {
        await window.Clerk.load();
        resolve(window.Clerk);
      } catch {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
}

// Swaps the #sign-in-nav-link element to reflect a real Clerk session: "Sign out" (wired to
// clerk.signOut(), then reloads) when signed in, or a redirect_to-tagged /sign-in link when not.
// Safe to call with a null/undefined clerk (falls back to the signed-out state).
function syncNavAuthState(clerk) {
  const link = document.getElementById('sign-in-nav-link');
  if (!link) return;
  if (clerk && clerk.session) {
    link.textContent = 'Sign out';
    link.removeAttribute('href');
    link.style.cursor = 'pointer';
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      await clerk.signOut();
      window.location.reload();
    });
  } else {
    link.href = '/sign-in?redirect_to=' + encodeURIComponent(window.location.pathname + window.location.search);
  }
}
