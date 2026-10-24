// N5 (Addendum N, ROADMAP step 153): channel attribution and the landing counter. Loaded on every page by /brand/header.js.
//
// What it does, and the limits:
//  * works out the visitor's CHANNEL once per browser session: utm_source if the link has one, otherwise the class of
//    the referring site (search, social, email, other_site), otherwise direct. The campaign is utm_campaign.
//  * sends ONE tiny count per session to /api/landing: channel, campaign and the kind of page. The Worker adds 1 to a
//    daily total. No cookie, no IP address, no user agent and no identifier is stored; only the class of the referrer is
//    used, never its address.
//  * adds the same channel to a signup the visitor submits (the signup stores it once, first touch).
//  * does nothing at all until ENABLED is true. It is flipped, together with ENABLE_LANDING_COUNTER on the Worker, only after
//    the privacy page says what is counted.
(function () {
  if (window.__sfAttribution) return;
  window.__sfAttribution = true;
  var ENABLED = true; // switched on 2026-10-24 (owner approval, Hub Guard read); keep in step with ENABLE_LANDING_COUNTER
  if (!ENABLED) return;

  var KEY = 'sparkfare_attr';
  var LANDED = 'sparkfare_landed';

  function clean(v, n) { return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, n); }
  function host(url) { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } }

  var SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|kagi|baidu|yandex|startpage|qwant|ask|aol)\./;
  var SOCIAL = /(^|\.)(facebook|instagram|twitter|x|t|linkedin|reddit|youtube|pinterest|bsky|threads|mastodon|tiktok|ycombinator|producthunt|indiehackers|lobste)\./;
  var MAIL = /(^|\.)(mail\.google|outlook\.live|outlook\.office|mail\.yahoo|mail\.proton|proton|icloud|fastmail|mail\.aol)\./;

  function referrerClass() {
    var h = host(document.referrer);
    if (!h) return 'direct';
    var own = (location.hostname || '').toLowerCase().replace(/^www\./, '');
    if (h === own || h === 'sparkfare.com' || /\.sparkfare\.com$/.test(h)) return 'direct'; // a self-referral is not a channel
    if (MAIL.test(h + '.')) return 'email';
    if (SEARCH.test(h + '.')) return 'search';
    if (SOCIAL.test(h + '.')) return 'social';
    return 'other_site';
  }

  function pageClass() {
    var p = location.pathname || '/';
    if (p === '/' || p === '/index.html') return 'home';
    if (p.indexOf('/flight/') === 0 || p.indexOf('/data/') === 0) return 'route';
    if (p.indexOf('/check') === 0) return 'check';
    if (p.indexOf('/time-off') === 0) return 'pto';
    if (p.indexOf('/reports') === 0) return 'report';
    return 'other';
  }

  function read(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } }

  var attr = null;
  var stored = read(KEY);
  if (stored) { try { attr = JSON.parse(stored); } catch (e) { attr = null; } }
  var storageOk = !!attr;
  if (!attr) {
    var p = new URLSearchParams(location.search || '');
    var source = clean(p.get('utm_source'), 20);
    var rc = referrerClass();
    attr = { channel: source || rc, campaign: clean(p.get('utm_campaign'), 16), referrer_class: rc };
    storageOk = write(KEY, JSON.stringify(attr));
  }

  window.sparkfareAttribution = function () { return { channel: attr.channel, campaign: attr.campaign, referrer_class: attr.referrer_class }; };

  // One count per browser session. If sessionStorage is blocked we cannot remember, so only a visit that arrives from
  // outside the site (or with no referrer) is counted, never every page view.
  var already = read(LANDED) === '1';
  var arrivedFromOutside = referrerClass() !== 'direct' || !document.referrer;
  var count = !already && (storageOk || arrivedFromOutside);
  if (count) {
    write(LANDED, '1');
    try {
      fetch('/api/landing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, credentials: 'omit',
        body: JSON.stringify({ channel: attr.channel, campaign: attr.campaign, referrer_class: attr.referrer_class, page_class: pageClass() }),
      }).catch(function () {});
    } catch (e) { /* counting is best effort */ }
  }

  // Carry the channel on a signup without editing every form (the 880 route pages, the widget, the hub...).
  var realFetch = window.fetch;
  if (typeof realFetch === 'function') {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/\/api\/signup(\?|$)/.test(url) && init && typeof init.body === 'string' && String(init.method || 'GET').toUpperCase() === 'POST') {
          var body = JSON.parse(init.body);
          if (body && typeof body === 'object' && !body.channel) {
            body.channel = attr.channel; body.campaign = attr.campaign; body.referrer_class = attr.referrer_class;
            var next = {};
            for (var k in init) if (Object.prototype.hasOwnProperty.call(init, k)) next[k] = init[k];
            next.body = JSON.stringify(body);
            init = next;
          }
        }
      } catch (e) { /* never break a signup */ }
      return realFetch.call(this, input, init);
    };
  }
})();
