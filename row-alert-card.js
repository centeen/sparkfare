// Addendum O, O2 (D-046, G107): the end-of-row alert card on the homepage.
//
// When the "Today's deals" grid ends with empty slots on desktop, this fills them with an honest offer of the daily email instead of
// blank space. It renders ONLY in that one grid, only when its last row has at least one empty track at the current width, and never
// when "Today's deals" is empty (that is a different empty state) or the grid is one column (no empty tracks). It is inert unless the
// Worker flag ENABLE_ROW_ALERT_CARD is on: GET /api/row-alert-card answers { enabled }, remembered ten minutes per tab, and any failure
// reads as off. The form posts through the homepage's own signup function (window.sparkfareHomeSignup), so it uses the same endpoint,
// messages, consent and double opt-in as the hero form; only the source tag differs ('home_row'), so the card's signups can be read.
//
// Copy is fixed by the Design Council (D-046) and changes only with the Hub. The optional line "Unsubscribe anytime." is NOT used:
// the verification email has no visible unsubscribe link (O0 report, item 5), so the note reads "One daily digest."
(function (root) {
  'use strict';

  var STATUS_KEY = 'sparkfare_row_card_status';
  var TTL_MS = 10 * 60 * 1000;
  var COPY = {
    before: "These are today's ",
    link: 'real deals',
    middle: ' from ',
    after: '.',
    body: 'Get the next one by email.',
    note: 'One daily digest.',
    label: 'Email',
    placeholder: 'name@email.com',
    button: 'Create alert',
    watch: 'Or watch one route (sign-in needed)',
    methodHref: '/how-it-works#deal-rule',
    watchHref: '/watchlists',
    source: 'home_row'
  };

  /** Empty tracks in the last row of a grid with `cols` columns holding `count` items. */
  function emptyTracks(cols, count) {
    if (!(cols >= 1) || !(count >= 1)) return 0;
    return cols - (count % cols || cols);
  }

  /** "MIA — Miami" -> "Miami"; an option text with no dash falls back to the code. */
  function cityOf(optionText, code) {
    var text = String(optionText || '');
    var i = text.indexOf('—');
    var city = i >= 0 ? text.slice(i + 1).trim() : '';
    return city || String(code || '');
  }

  /** The grid that follows the "Today's deals" heading, or null. */
  function findTodaysDealsGrid(doc) {
    var board = doc.getElementById('board-sections');
    if (!board) return null;
    var kids = board.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.classList && k.classList.contains('section-heading') && String(k.textContent || '').trim() === "Today's deals") {
        for (var j = i + 1; j < kids.length; j++) {
          if (kids[j].classList && kids[j].classList.contains('grid')) return kids[j];
          if (kids[j].classList && kids[j].classList.contains('section-heading')) return null;
        }
      }
    }
    return null;
  }

  function el(doc, tag, className, text) {
    var e = doc.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  /** The card. Plain DOM calls with textContent only: nothing here is built from an HTML string. */
  function buildCard(doc, opts) {
    var card = el(doc, 'aside', 'row-alert-card');
    card.setAttribute('aria-labelledby', 'row-alert-title');
    card.setAttribute('data-row-alert-card', '');
    card.style.gridColumn = 'span ' + Math.max(1, opts.empty);

    var title = el(doc, 'p', 'row-alert-title');
    title.id = 'row-alert-title';
    title.appendChild(doc.createTextNode(COPY.before));
    var a = el(doc, 'a', null, COPY.link);
    a.setAttribute('href', COPY.methodHref);
    title.appendChild(a);
    title.appendChild(doc.createTextNode(COPY.middle + opts.city + COPY.after));
    card.appendChild(title);

    card.appendChild(el(doc, 'p', 'row-alert-body', COPY.body));

    var form = el(doc, 'form', 'signup-form row-alert-form');
    form.setAttribute('novalidate', '');
    var field = el(doc, 'div', 'field');
    var label = el(doc, 'label', 'sr-only', COPY.label);
    label.setAttribute('for', 'row-alert-email');
    var input = el(doc, 'input');
    input.id = 'row-alert-email';
    input.setAttribute('name', 'email');
    input.setAttribute('type', 'email');
    input.setAttribute('placeholder', COPY.placeholder);
    input.setAttribute('autocomplete', 'email');
    input.setAttribute('required', '');
    input.setAttribute('aria-describedby', 'row-alert-note');
    field.appendChild(label);
    field.appendChild(input);
    var buttonField = el(doc, 'div', 'field');
    var button = el(doc, 'button', null, COPY.button);
    button.setAttribute('type', 'submit');
    buttonField.appendChild(button);
    form.appendChild(field);
    form.appendChild(buttonField);
    card.appendChild(form);

    var status = el(doc, 'div', 'status-message');
    status.setAttribute('aria-live', 'polite');
    card.appendChild(status);

    var note = el(doc, 'p', 'row-alert-note', COPY.note);
    note.id = 'row-alert-note';
    card.appendChild(note);

    var watch = el(doc, 'a', 'row-alert-watch', COPY.watch);
    watch.setAttribute('href', COPY.watchHref);
    card.appendChild(watch);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var signup = root.sparkfareHomeSignup;
      if (typeof signup !== 'function') return;
      signup({ email: String(input.value || '').trim(), origin: opts.origin, source: COPY.source, statusEl: status, form: form });
    });
    return card;
  }

  function removeCards(doc) {
    var old = doc.querySelectorAll('[data-row-alert-card]');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
  }

  /** Remembered flag answer for ten minutes per tab; one request per visit at most. Any failure reads as off. */
  function isEnabled(win) {
    var store = null;
    try { store = win.sessionStorage; } catch (e) { store = null; }
    try {
      var cached = store ? JSON.parse(store.getItem(STATUS_KEY) || 'null') : null;
      if (cached && typeof cached.t === 'number' && Date.now() - cached.t < TTL_MS) return Promise.resolve(!!cached.enabled);
    } catch (e) { /* ignore a damaged cache */ }
    return win.fetch('/api/row-alert-card', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
      .then(function (d) {
        var on = !!(d && d.enabled === true);
        try { if (store) store.setItem(STATUS_KEY, JSON.stringify({ t: Date.now(), enabled: on })); } catch (e) { /* ignore */ }
        return on;
      })
      .catch(function () { return false; });
  }

  // One counts-only beacon per page view when the card is shown (G107's denominator). The airport and how many empty tracks the card
  // filled, nothing else: no email, no id, no text. Sent again only if the page is reloaded; a resize that re-places the card does not repeat it.
  var viewSent = false;
  function reportView(win, origin, span) {
    if (viewSent) return;
    viewSent = true;
    try {
      win.fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'row_card_view', origin: origin, source: 'home_row', meta: { span: Math.min(4, Math.max(1, span)) } }),
        keepalive: true
      }).catch(function () { /* a lost count is fine */ });
    } catch (e) { /* ignore */ }
  }

  var runId = 0;
  /** Add or remove the card so it matches the page right now. Safe to call as often as needed. */
  function sync(win) {
    win = win || root;
    var doc = win.document;
    var mine = ++runId;
    return isEnabled(win).then(function (on) {
      if (mine !== runId) return; // a newer sync is already deciding
      removeCards(doc);
      if (!on) return;
      var grid = findTodaysDealsGrid(doc);
      if (!grid) return;
      var count = grid.children.length;
      var cols = String(win.getComputedStyle(grid).gridTemplateColumns || '').trim().split(/\s+/).filter(Boolean).length;
      var empty = emptyTracks(cols, count);
      if (empty < 1) return;
      var select = doc.getElementById('origin-select');
      var origin = (select && select.value) || (doc.getElementById('origin_iata') || {}).value || '';
      var option = select && select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
      grid.appendChild(buildCard(doc, { city: cityOf(option && option.text, origin), origin: origin, empty: empty }));
      reportView(win, origin, empty);
    });
  }

  function start(win) {
    var doc = win.document;
    var timer = null;
    function later() { clearTimeout(timer); timer = setTimeout(function () { sync(win); }, 120); }
    var board = doc.getElementById('board-sections');
    if (board && typeof win.MutationObserver === 'function') new win.MutationObserver(later).observe(board, { childList: true });
    win.addEventListener('resize', later);
    later();
  }

  var api = { COPY: COPY, emptyTracks: emptyTracks, cityOf: cityOf, findTodaysDealsGrid: findTodaysDealsGrid, buildCard: buildCard, reportView: reportView, removeCards: removeCards, isEnabled: isEnabled, sync: sync, start: start, STATUS_KEY: STATUS_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.document) {
    root.sparkfareRowAlertCard = api;
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { start(root); });
    else start(root);
  }
})(typeof window !== 'undefined' ? window : this);
