// Addendum Q, C1.1 (G114): the daily-or-weekly choice on a signup form, DARK. A form opts in by containing <div data-sf-frequency hidden></div>.
// While ENABLE_SIGNUP_FREQUENCY is off, /api/signup-options says so and nothing on the page changes. When it is on, the placeholder is filled with two radio buttons
// (copy from content/prefs.json: "Daily digest (you can switch anytime)" preselected, "Weekly edition, Sundays"; no pre-checked marketing box) and every POST to
// /api/signup from this page carries the chosen value. The server stores it for a new address only.
(function () {
  var COPY = { legend: 'How often?', daily: 'Daily digest (you can switch anytime)', weekly: 'Weekly edition, Sundays' };
  var slots = function () { return document.querySelectorAll('[data-sf-frequency]'); };
  var chosen = function () {
    var el = document.querySelector('[data-sf-frequency]:not([hidden]) input[type=radio]:checked');
    return el ? el.value : null;
  };
  window.sparkfareFrequency = chosen;

  // Add the choice to the signup request without editing every page's own submit code.
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (init && /\/api\/signup(\?|$)/.test(url) && String(init.method || 'GET').toUpperCase() === 'POST' && typeof init.body === 'string') {
        var f = chosen();
        if (f) { var body = JSON.parse(init.body); if (body && typeof body === 'object' && !body.frequency) { body.frequency = f; init = Object.assign({}, init, { body: JSON.stringify(body) }); } }
      }
    } catch (e) { /* never block a signup */ }
    return realFetch.call(this, input, init);
  };

  function render(slot, n) {
    var name = 'sf-frequency-' + n;
    slot.innerHTML = '<fieldset style="border:0;margin:0 0 12px;padding:0"><legend style="font-weight:600;margin-bottom:4px">' + COPY.legend + '</legend>' +
      '<label style="display:flex;align-items:center;gap:8px;min-height:44px"><input type="radio" name="' + name + '" value="daily" checked> <span>' + COPY.daily + '</span></label>' +
      '<label style="display:flex;align-items:center;gap:8px;min-height:44px"><input type="radio" name="' + name + '" value="weekly"> <span>' + COPY.weekly + '</span></label></fieldset>';
    slot.hidden = false;
  }

  function start() {
    if (!slots().length) return;
    realFetch('/api/signup-options', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) {
      if (!o || !o.frequency) return;
      Array.prototype.forEach.call(slots(), render);
    }).catch(function () { /* off, or offline: the form stays as it was */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
