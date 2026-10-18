// K-B10: runs inside the page (Playwright evaluates this file's text as an expression). Returns counts and a few examples.
// Contrast and gold come from scripts/contrast-audit.js (run separately); this file adds target size, small text and fonts.
(() => {
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden],[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '') + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24) + '"';

  // Targets under 24 x 24 CSS px (WCAG 2.5.8). An inline link inside a sentence is exempt, as the success criterion says.
  const targets = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left + r.width < 0 || r.top + r.height < 0) continue; // skip-link parked off screen
    if (r.width >= 24 && r.height >= 24) continue;
    const cs = getComputedStyle(el);
    if (el.tagName === 'A' && cs.display === 'inline') {
      const parent = el.parentElement;
      const text = [...parent.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).length;
      if (text > 0) continue; // sits in running text
    }
    targets.push(label(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }

  // Text under 13 px.
  const small = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || !visible(el)) continue;
    seen.add(el);
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 13) small.push(label(el) + ' ' + size.toFixed(1) + 'px');
  }

  const bodyFont = getComputedStyle(document.body).fontFamily;
  const brandFont = /^["']?(Inter|Space Grotesk|IBM Plex Mono)/.test(bodyFont);
  return { targets: targets.length, targetExamples: targets.slice(0, 5), smallText: small.length, smallExamples: small.slice(0, 5), bodyFont, brandFont };
})()
