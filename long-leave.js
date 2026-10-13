// G1 (ENABLE_LONG_LEAVE): the 30_plus trip-length option on signup forms, and the three-item lead for a long absence.
// GET /api/long-leave says whether the flag is on and, when it is, returns the lead items. With the flag off this
// script changes nothing on the page and sends nothing.
// Exposes window.sparkfareLongLeave = { info(), ensureTripLength(select, value), renderLead(container, items), report(event, meta) }.
(function () {
  var TOKEN = '30_plus';
  var infoPromise = null;

  function info() {
    if (!infoPromise) {
      infoPromise = fetch('/api/long-leave', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
        .then(function (d) { return d && d.enabled ? d : { enabled: false }; })
        .catch(function () { return { enabled: false }; });
    }
    return infoPromise;
  }

  function addOption(select) {
    if (!select || select.querySelector('option[value="' + TOKEN + '"]')) return;
    var opt = document.createElement('option');
    opt.value = TOKEN;
    opt.textContent = '30+ days';
    select.appendChild(opt);
  }

  // For pages that set the select's value from saved preferences after load.
  function ensureTripLength(select, value) {
    if (value === TOKEN) addOption(select);
    select.value = value;
  }

  // Builds the lead into `container`: a heading and the items in the order given. Links to a partner are marked
  // sponsored; the insurance item arrives with no links at all.
  function renderLead(container, items) {
    container.replaceChildren();
    var h = document.createElement('h2');
    h.textContent = 'If you will be away for 30 days or more';
    container.appendChild(h);
    var ol = document.createElement('ol');
    ol.className = 'items';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var t = document.createElement('div');
      t.className = 'item-title';
      t.textContent = it.text;
      li.appendChild(t);
      if (it.action) {
        var a = document.createElement('div');
        a.className = 'item-action';
        a.textContent = it.action;
        li.appendChild(a);
      }
      if (it.links && it.links.length) {
        var wrap = document.createElement('div');
        wrap.className = 'item-links';
        it.links.forEach(function (l) {
          var link = document.createElement('a');
          link.href = l.href;
          link.textContent = l.label;
          link.rel = l.sponsored ? 'sponsored nofollow noopener noreferrer' : 'noopener noreferrer';
          if (l.external || l.sponsored) link.target = '_blank';
          wrap.appendChild(link);
        });
        li.appendChild(wrap);
      }
      ol.appendChild(li);
    });
    container.appendChild(ol);
    container.hidden = false;
  }

  // Client-sent events go to /api/events, which accepts only the two long-leave events and a fixed meta shape.
  function report(eventType, meta) {
    try {
      fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: eventType, meta: meta }), keepalive: true });
    } catch (e) { /* analytics never blocks the page */ }
  }

  window.sparkfareLongLeave = { info: info, ensureTripLength: ensureTripLength, renderLead: renderLead, report: report };

  info().then(function (d) {
    if (!d.enabled) return;
    var selects = document.querySelectorAll('select[name="trip_length"], select#trip_length');
    for (var i = 0; i < selects.length; i++) addOption(selects[i]);
  });
})();
