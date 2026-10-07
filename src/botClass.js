// Coarse bot / human / unknown classification of a request's User-Agent, recorded on outbound_click
// events so launch numbers can exclude crawlers. Only the class is stored, never the raw User-Agent.
//
// This is a heuristic, not proof. A crawler that sends a browser-like User-Agent (most headless Chrome,
// many scrapers) is classed "human", and a real person on an unusual client may be "none". It exists to
// strip the obvious, self-identifying traffic: search and AI crawlers, link-preview fetchers, HTTP
// libraries, monitors. `robots.txt` (Disallow /out/ and /go/) is the first line of defence; this is the
// second, for the crawlers that ignore it.

const BOT_PATTERN = new RegExp([
  // search engines, ad and AI crawlers
  'bot\\b', 'bot/', 'crawl', 'spider', 'slurp', 'bingpreview', 'mediapartners', 'adsbot', 'apis-google', 'google-', 'duckduck',
  'yandex', 'baidu', 'sogou', 'applebot', 'petalbot', 'ahrefs', 'semrush', 'mj12', 'dotbot', 'ccbot', 'gptbot', 'claudebot',
  'anthropic', 'bytespider', 'amazonbot', 'perplexity', 'cohere',
  // link-preview and chat unfurlers
  'facebookexternalhit', 'facebot', 'embedly', 'whatsapp', 'telegrambot', 'slackbot', 'twitterbot', 'linkedinbot', 'discordbot',
  'pinterestbot', 'skypeuripreview', 'vkshare',
  // automation, headless browsers, HTTP libraries
  'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'selenium', 'lighthouse', 'python-requests', 'python-urllib', 'aiohttp',
  'httpx', 'curl/', 'wget', 'go-http-client', 'java/', 'okhttp', 'libwww', 'axios', 'node-fetch', 'undici', 'postman', 'insomnia',
  'scrapy', 'apache-httpclient', 'http-client', 'httpclient', 'ruby', 'perl',
  // uptime and monitoring
  'uptimerobot', 'pingdom', 'statuscake', 'monitor', 'check_http',
].join('|'), 'i');

const BROWSER_PATTERN = /mozilla\/\d/i;
const ENGINE_PATTERN = /(chrome|safari|firefox|edg|gecko|opr\/|samsungbrowser)/i;

// Returns 'bot', 'human' or 'none' (no User-Agent, or not recognizable as a browser).
export function classifyUserAgent(userAgent) {
  const ua = String(userAgent || '').trim();
  if (!ua) return 'none';
  if (BOT_PATTERN.test(ua)) return 'bot';
  if (BROWSER_PATTERN.test(ua) && ENGINE_PATTERN.test(ua)) return 'human';
  return 'none';
}

// Event meta for an outbound click: the optional slot plus the class. Never the raw User-Agent.
export function outboundClickMeta(request, slot) {
  const meta = { ua_class: classifyUserAgent(request.headers.get('User-Agent')) };
  if (slot) meta.slot = slot;
  return meta;
}
