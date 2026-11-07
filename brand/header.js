// N5: load the channel/landing script on every page that has the shared header (inert until its ENABLED switch is on).
(function () {
  if (window.__sfAttribution || document.querySelector('script[data-sf-attribution]')) return;
  var s = document.createElement('script');
  s.src = '/attribution.js';
  s.async = true;
  s.setAttribute('data-sf-attribution', '1');
  (document.head || document.documentElement).appendChild(s);
})();

// "Sign up" goes to the alert form on the homepage with the airport the visitor last chose (read only, same key and the
// same 3-letter check the homepage uses). With no remembered airport it stays /#signup-form. Hidden for signed-in visitors
// by nav-auth.js and the homepage's own session check.
(function () {
  var link = document.getElementById('sign-up-nav-link');
  if (!link) return;
  try {
    var code = String(localStorage.getItem('sparkfare_selected_origin') || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) link.setAttribute('href', '/?origin=' + code + '#signup-form');
  } catch (e) { /* storage blocked: keep the plain link */ }
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
