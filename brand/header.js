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
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('sf-open')) { setOpen(false); btn.focus(); }
  });
})();
