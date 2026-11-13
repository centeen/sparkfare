// D-081: the homepage "Create alert" buttons go to Clerk sign-up instead of posting an email to /api/signup.
//
// Dark by default. On every page load this asks GET /api/alert-via-signup (never cached, so a flag flip or a revert reaches the next page view)
// and changes the page ONLY when the answer is exactly { enabled: true }. Any failure, timeout or other answer leaves today's email form
// exactly as it is. The form markup in index.html is untouched; this script only swaps behaviour once the Worker says so.
//
// When on: the email field is hidden and the button (label unchanged) sends a signed-in visitor straight to POST /api/alert-subscribe
// (their account email, already verified; no redirect), and a signed-out visitor to Clerk's hosted sign-up with the home airport kept in
// sessionStorage for 30 minutes (this tab only) and a return URL that is the page plus, at most, the three-letter airport as ?origin= (D-079 C1: no other
// parameter is carried). On return, a signed-in visitor with a saved airport is subscribed once. If the saved airport is lost (the code was confirmed in
// another tab or device) NOTHING is subscribed; a person whose account was just created is told so and asked to press the button again.
// The beside-button line and the notice are PENDING the Hub's Guard read.
(function (root) {
  'use strict';

  var INTENT_KEY = 'sparkfare_alert_intent';
  var NOTICE_KEY = 'sparkfare_alert_notice_shown';
  /** Names the exact beside-button line below in consent_log.wording_version. Change the line => change this (a test enforces it). */
  var WORDING_VERSION = 'v2_account_signup';
  var NOTICE_TEXT = "Your account is ready, but your alert isn't on yet. Choose your home airport and press Create alert to turn it on.";
  var INTENT_TTL_MS = 30 * 60 * 1000;
  var SIGNUP_BASE = 'https://accounts.sparkfare.com/sign-up?redirect_url=';
  var NOTE_PREFIX = 'Free account. At most one fare email a day, with fares from ';
  var NOTE_SUFFIX = '. Unsubscribe any time.';

  /** Only the exact boolean true turns it on. */
  function isEnabledAnswer(data) { return !!data && data.enabled === true; }

  /** Only the page itself and, if it is a real three-letter code, ?origin=XXX. Nothing else in the address is carried. */
  function signUpUrl(loc, origin) {
    var code = String(origin || '').trim().toUpperCase();
    return SIGNUP_BASE + encodeURIComponent(loc.origin + loc.pathname + (/^[A-Z]{3}$/.test(code) ? '?origin=' + code : ''));
  }

  /** A real airport code, else the existing fallback wording. Never blank, never "undefined". */
  function noteText(origin) {
    var code = String(origin == null ? '' : origin).trim().toUpperCase();
    return NOTE_PREFIX + (/^[A-Z]{3}$/.test(code) ? code : 'your home airport') + NOTE_SUFFIX;
  }

  function saveIntent(storage, origin, now) {
    try { storage.setItem(INTENT_KEY, JSON.stringify({ origin: String(origin || '').toUpperCase(), t: now })); } catch (e) { /* ignore */ }
  }
  function readIntent(storage, now) {
    try {
      var v = JSON.parse(storage.getItem(INTENT_KEY) || 'null');
      if (v && typeof v.origin === 'string' && /^[A-Z]{3}$/.test(v.origin) && typeof v.t === 'number' && now - v.t >= 0 && now - v.t < INTENT_TTL_MS) return v;
    } catch (e) { /* ignore a damaged value */ }
    return null;
  }
  function clearIntent(storage) { try { storage.removeItem(INTENT_KEY); } catch (e) { /* ignore */ } }

  function justCreated(clerk, now) {
    var c = clerk && clerk.user && clerk.user.createdAt;
    var t = c instanceof Date ? c.getTime() : (typeof c === 'number' ? c : NaN);
    return isFinite(t) && now - t >= 0 && now - t < INTENT_TTL_MS;
  }
  function noticeShown(storage) { try { return storage.getItem(NOTICE_KEY) === '1'; } catch (e) { return false; } }
  function markNotice(storage) { try { storage.setItem(NOTICE_KEY, '1'); } catch (e) { /* ignore */ } }

  function say(statusEl, text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'status-message' + (kind ? ' ' + kind : '');
  }

  /** The airport, the wording version shown, and the same channel tags the email form already sends (nothing new is collected). */
  function requestBody(win, origin) {
    var body = { origin_iata: origin, wording_version: WORDING_VERSION };
    try {
      var a = typeof win.sparkfareAttribution === 'function' ? win.sparkfareAttribution() : null;
      if (a && a.channel) { body.channel = a.channel; body.campaign = a.campaign; body.referrer_class = a.referrer_class; if (a.medium) body.medium = a.medium; }
      var utm = typeof win.sparkfareUtm === 'function' ? win.sparkfareUtm() : null;
      if (utm) body.utm = utm;
    } catch (e) { /* tags are optional */ }
    return body;
  }

  function subscribe(win, origin, statusEl) {
    say(statusEl, 'Creating your alert…');
    return win.loadClerk().then(function (clerk) {
      if (!clerk || !clerk.session) throw new Error('Please sign in to create your alert.');
      return clerk.session.getToken();
    }).then(function (token) {
      return win.fetch('/api/alert-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(requestBody(win, origin))
      });
    }).then(function (res) {
      return res.json().catch(function () { return { ok: false }; }).then(function (data) {
        if (!res.ok || !data.ok) throw new Error((data && data.error) || 'Something went wrong while creating the alert.');
        say(statusEl, 'Alert created for ' + origin + ". It uses your account email (" + data.user.email + '), which is already verified.', 'success');
      });
    }).catch(function (err) { say(statusEl, (err && err.message) || 'Something went wrong while creating the alert.', 'error'); });
  }

  /** The replacement for window.sparkfareHomeSignup (the hero form and the end-of-row card both call it). The typed email is ignored. */
  function makeHandler(win) {
    return function (opts) {
      var origin = String((opts && opts.origin) || '').trim().toUpperCase();
      var statusEl = opts && opts.statusEl;
      if (!/^[A-Z]{3}$/.test(origin)) { say(statusEl, 'Please choose a valid origin airport from the list.', 'error'); return Promise.resolve(); }
      return win.loadClerk().then(function (clerk) {
        if (clerk && clerk.session) return subscribe(win, origin, statusEl);
        saveIntent(win.sessionStorage, origin, Date.now());
        say(statusEl, 'Taking you to create your free account…');
        win.location.href = signUpUrl(win.location, origin);
      });
    };
  }

  function activate(win) {
    var doc = win.document;
    doc.documentElement.classList.add('alert-via-signup');
    var style = doc.createElement('style');
    style.textContent = '.alert-via-signup .signup-form .field:has(input[type="email"]){display:none}' +
      '.alert-via-signup .alert-via-signup-note{margin:8px 0 0;font-size:13px;color:var(--ink-2,inherit)}';
    doc.head.appendChild(style);

    win.sparkfareHomeSignup = makeHandler(win);

    var form = doc.getElementById('signup-form');
    if (form) {
      var note = doc.createElement('p');
      note.id = 'alert-via-signup-note';
      note.className = 'alert-via-signup-note';
      var label = doc.getElementById('signup-origin-label');
      var sync = function () { note.textContent = noteText(label && label.textContent); };
      sync();
      form.insertAdjacentElement('afterend', note);
      form.setAttribute('aria-describedby', 'alert-via-signup-note');
      if (label && typeof win.MutationObserver === 'function') new win.MutationObserver(sync).observe(label, { childList: true, characterData: true, subtree: true });
    }

    // Back from Clerk with a saved airport: subscribe once, then forget it.
    var intent = readIntent(win.sessionStorage, Date.now());
    win.loadClerk().then(function (clerk) {
      if (!clerk || !clerk.session) return;
      var statusEl = doc.getElementById('signup-status');
      if (intent) {
        clearIntent(win.sessionStorage);
        return subscribe(win, intent.origin, statusEl);
      }
      // No saved airport. If the account was created in the last 30 minutes the person most likely came from this button in another tab or device:
      // subscribe nobody, say so once.
      if (justCreated(clerk, Date.now()) && !noticeShown(win.sessionStorage)) {
        markNotice(win.sessionStorage);
        say(statusEl, NOTICE_TEXT);
      }
    });
  }

  /** F1: a visit that came with a referral code (?ref= in the address, or the ref cookie /r/<code> sets) keeps the email-only form, because only
   *  /api/signup credits a referral. Read the same two places the homepage reads its own referralCode from. */
  function hasReferralCode(win) {
    try {
      var q = /[?&]ref=([^&#]+)/.exec(String((win.location && win.location.search) || ''));
      if (q && q[1]) return true;
      return /(^|;\s*)ref=[^;]+/.test(String((win.document && win.document.cookie) || ''));
    } catch (e) { return false; }
  }

  function start(win) {
    if (typeof win.fetch !== 'function' || typeof win.loadClerk !== 'function') return Promise.resolve(false);
    if (hasReferralCode(win)) return Promise.resolve(false);
    return win.fetch('/api/alert-via-signup', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (!isEnabledAnswer(data)) return false; activate(win); return true; })
      .catch(function () { return false; });
  }

  var api = { INTENT_KEY: INTENT_KEY, NOTICE_KEY: NOTICE_KEY, WORDING_VERSION: WORDING_VERSION, NOTICE_TEXT: NOTICE_TEXT, NOTE_PREFIX: NOTE_PREFIX, NOTE_SUFFIX: NOTE_SUFFIX, INTENT_TTL_MS: INTENT_TTL_MS, isEnabledAnswer: isEnabledAnswer, signUpUrl: signUpUrl, noteText: noteText, hasReferralCode: hasReferralCode,
    saveIntent: saveIntent, readIntent: readIntent, clearIntent: clearIntent, makeHandler: makeHandler, start: start };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.document) {
    root.sparkfareAlertViaSignup = api;
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { start(root); });
    else start(root);
  }
})(typeof window !== 'undefined' ? window : this);
