// Entry points for the leave-by plan (Addendum G, task G3). With ENABLE_LEAVE_BY_PLAN off, GET /api/leave-by-plan/status answers 404, so
// this script changes nothing on the page. With it on, it adds a "Leave-by plan" link to the navigation and un-hides the blocks marked
// data-plan-entry. The answer is remembered for ten minutes per tab so a visit makes at most one request. No dates, no user data.
(function () {
  var KEY = 'sparkfare_plan_status';
  var TTL_MS = 10 * 60 * 1000;

  // Counts a visit to /away-mode, only while the plan is on, so partner clicks there can be compared per 100 views. No data is sent.
  function countAwayModeView() {
    try {
      if (typeof location === 'undefined' || (location.pathname !== '/away-mode' && location.pathname !== '/away-mode.html')) return;
      fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'away_mode_view', meta: {} }), keepalive: true }).catch(function () {});
    } catch (e) { /* counting never gets in the way of the page */ }
  }

  function reveal() {
    countAwayModeView();
    var nav = document.querySelector('.site-nav, nav');
    if (nav && !nav.querySelector('a[href^="/plan"]')) {
      var a = document.createElement('a');
      a.href = '/plan?src=nav';
      a.textContent = 'Leave-by plan';
      var after = nav.querySelector('a[href="/check"]');
      if (after) after.parentNode.insertBefore(a, after.nextSibling);
      else nav.appendChild(a);
    }
    var blocks = document.querySelectorAll('[data-plan-entry]');
    for (var i = 0; i < blocks.length; i++) blocks[i].hidden = false;
  }

  var cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { cached = null; }
  if (cached && typeof cached.t === 'number' && Date.now() - cached.t < TTL_MS) {
    if (cached.enabled) reveal();
    return;
  }

  fetch('/api/leave-by-plan/status', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .then(function (d) {
      var enabled = Boolean(d && d.enabled);
      try { sessionStorage.setItem(KEY, JSON.stringify({ enabled: enabled, t: Date.now() })); } catch (e) { /* storage can be blocked */ }
      if (enabled) reveal();
    })
    .catch(function () { /* offline or blocked: leave the page as it is */ });
})();
