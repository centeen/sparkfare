// Shows every server-printed fare time in the visitor's own time zone, with the zone name.
// The page ships the UTC time as plain text inside <span data-asof="ISO time">; this replaces it. No JavaScript: the UTC text stays.
(function () {
  try {
    var spans = document.querySelectorAll('[data-asof]');
    for (var i = 0; i < spans.length; i++) {
      var d = new Date(spans[i].getAttribute('data-asof'));
      if (isNaN(d.getTime())) continue;
      spans[i].textContent = d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    }
  } catch (e) { /* leave the UTC text */ }
})();
