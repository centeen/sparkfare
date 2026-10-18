// K-A5 (ROADMAP step 123, Addendum J4): a browser-side structure and access audit. Run it in the page (console or the browser pane). It reports:
//   h1            visible <h1> elements (want exactly 1)
//   main          <main> landmarks (want exactly 1)
//   skipLink      whether the first focusable element is a link to the main content
//   smallTargets  controls smaller than 24x24 CSS px (WCAG 2.2 SC 2.5.8); an inline link inside a sentence is exempt
//   unlabelled    form fields with no label, aria-label or aria-labelledby (placeholder alone does not count)
//   smallText     visible text nodes under 13px (count and a sample)
//   focusRing     the computed outline of the first focusable control after focusing it with the keyboard
(() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],[aria-hidden="true"]');
  };
  const h1 = [...document.querySelectorAll('h1')].filter(visible);
  const main = document.querySelectorAll('main, [role="main"]');
  const focusables = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((e) => visible(e) && e.tabIndex >= 0 && !e.disabled && e.type !== 'hidden');
  const first = focusables[0];
  const skip = !!(first && first.tagName === 'A' && /^#/.test(first.getAttribute('href') || '') && document.querySelector(first.getAttribute('href')));
  const inSentence = (el) => el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && /^(P|LI|SPAN|SMALL|DD|TD|EM|STRONG|LABEL|DIV)$/.test(el.parentElement.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 12;
  const small = focusables.filter((e) => { const r = e.getBoundingClientRect(); return (r.width < 24 || r.height < 24) && !inSentence(e) && !(e.type === 'checkbox' || e.type === 'radio'); })
    .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : ''} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} "${(e.textContent || e.value || '').trim().slice(0, 20)}"`);
  const unlabelled = [...document.querySelectorAll('input, select, textarea')].filter((e) => visible(e) && e.type !== 'hidden' && e.type !== 'submit' && e.type !== 'button')
    .filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.title)
    .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}[${e.type || ''}]`);
  const tiny = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; const el = t.parentElement;
    if (!t.textContent.trim() || !el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || !visible(el)) continue;
    if (parseFloat(getComputedStyle(el).fontSize) < 13) tiny.push(t.textContent.trim().slice(0, 30));
  }
  let ring = null;
  if (first) { first.focus({ focusVisible: true }); const cs = getComputedStyle(first); ring = `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} offset ${cs.outlineOffset}`; first.blur(); }
  return { page: location.pathname, h1: h1.length, h1text: h1.map((e) => e.textContent.trim().slice(0, 40)), main: main.length, skipLink: skip, smallTargets: small.length, smallTargetSample: small.slice(0, 5), unlabelled, smallText: tiny.length, smallTextSample: tiny.slice(0, 3), focusRing: ring };
})()
