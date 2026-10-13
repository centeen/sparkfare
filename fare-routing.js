// F0 (ENABLE_FARE_ROUTING): sends the homepage "View fare" links through /out/aviasales so every outbound fare click
// is logged with its surface. The raw Aviasales URL is kept in data-booking-link, which is what the signed-in
// tracking call (POST /api/trips) needs. With the flag off, /api/route-links says enabled:false and nothing changes.
// No traveler data is added to any URL: only the fare's own link and a surface name go in the query.
(function () {
  var RAW_HOST = /^https:\/\/www\.aviasales\.com\//;

  function srcFor(a) {
    if (a.classList && a.classList.contains('hero-cta')) return 'home_hero';
    if (a.classList && a.classList.contains('book-link')) return 'home_card';
    return 'home_search';
  }

  function rewrite(a) {
    if (a.getAttribute('data-booking-link')) return;
    var href = a.getAttribute('href') || '';
    if (!RAW_HOST.test(href)) return;
    a.setAttribute('data-booking-link', href);
    a.setAttribute('href', '/out/aviasales?url=' + encodeURIComponent(href) + '&src=' + srcFor(a));
  }

  function apply() {
    var links = document.querySelectorAll('a.track-booking');
    for (var i = 0; i < links.length; i++) rewrite(links[i]);
  }

  fetch('/api/route-links', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .then(function (d) {
      if (!d || !d.enabled) return;
      apply();
      // The board re-renders on origin and sort changes; rewrite new links as they appear.
      new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
    })
    .catch(function () { /* links stay as they are */ });
})();
