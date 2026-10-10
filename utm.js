// Launch-source attribution (ROADMAP step 52). Reads utm_source, utm_campaign and utm_content from the landing URL,
// keeps the first tag seen in this browser session, and exposes it as window.sparkfareUtm() so a signup can carry it.
//
// What it is and is not: a first-party value kept in sessionStorage (it disappears when the tab session ends) and
// sent only with a signup the visitor submits. It is not a tracker: no cookie, no third-party request, no page-view
// log. The Worker sanitizes it again and stores it in the signup event's meta.
(function () {
  var KEY = 'sparkfare_utm';
  function clean(v, n) { return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, n); }

  function fromUrl() {
    try {
      var p = new URLSearchParams(location.search);
      var source = clean(p.get('utm_source'), 20);
      if (!source) return null;
      return [source, clean(p.get('utm_campaign'), 16), clean(p.get('utm_content'), 16)]
        .filter(Boolean).join('_').slice(0, 40);
    } catch (e) { return null; }
  }

  function stored() {
    try { return sessionStorage.getItem(KEY) || null; } catch (e) { return null; }
  }

  var seen = stored();
  var current = fromUrl();
  // First touch wins within the session: a later in-site page without a tag never clears it.
  if (current && !seen) {
    try { sessionStorage.setItem(KEY, current); } catch (e) { /* storage blocked: the value below still works */ }
  }

  window.sparkfareUtm = function () { return seen || current || stored(); };
})();
