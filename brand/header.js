// N5: load the channel/landing script on every page that has the shared header (inert until its ENABLED switch is on).
(function () {
  if (window.__sfAttribution || document.querySelector('script[data-sf-attribution]')) return;
  var s = document.createElement('script');
  s.src = '/attribution.js';
  s.async = true;
  s.setAttribute('data-sf-attribution', '1');
  (document.head || document.documentElement).appendChild(s);
})();

// "Sign up" opens the Clerk sign-up page (accounts.sparkfare.com/sign-up). The static href returns to /account; here it is changed to
// return to the page the visitor is on. Hidden for signed-in visitors by nav-auth.js and the homepage session check.
(function () {
  var link = document.getElementById('sign-up-nav-link');
  if (!link) return;
  // Guard C1: the return URL is the origin, the path and the airport code only. Every other query parameter and the hash are dropped
  // (trip dates and search inputs must not be handed to a third-party host). Sign-in, the 404 page and pages whose path holds a
  // private token return to /account.
  var path = window.location.pathname;
  var is404 = /^Page not found/.test(document.title || '');
  var privatePath = /^\/(sign-in|sign-up|card|departing|home-card)(\/|$|\.html)/.test(path);
  var back = window.location.origin + ((is404 || privatePath) ? '/account' : path);
  if (!is404 && !privatePath) {
    var code = (new URLSearchParams(window.location.search).get('origin') || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) back += '?origin=' + code;
  }
  link.setAttribute('href', 'https://accounts.sparkfare.com/sign-up?redirect_url=' + encodeURIComponent(back));
})();

// K-B1: collapses the shared header's links behind the Menu button on phones. The links are already in the HTML
// (crawlers and no-script visitors see them); this only adds the toggle.
(function () {
  var nav = document.querySelector('nav.sf-nav');
  if (!nav) return;
  var btn = nav.querySelector('.sf-menu-btn');
  if (!btn) return;
  nav.classList.add('sf-js');
  function setOpen(open) {
    nav.classList.toggle('sf-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  btn.addEventListener('click', function () { setOpen(!nav.classList.contains('sf-open')); });
  // choosing a link closes the panel (matters for #deals, which does not reload the homepage)
  var menu = nav.querySelector('.sf-menu');
  if (menu) menu.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('sf-open')) { setOpen(false); btn.focus(); }
  });
})();
