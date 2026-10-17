// K-A2 (ROADMAP step 120): a browser-side WCAG AA contrast audit. Paste into the console (or run through the browser pane) on any page;
// it returns the visible text whose colour fails 4.5:1 (3:1 for large text: 24px, or 18.66px bold) against the background it sits on, plus
// any element painted with the gold brand colour that is not a Deal chip or the mark. CI will run the same logic in K-B10.
(() => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; } }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const c of stack.reverse()) base = blend(c, base);
    return base;
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const fails = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden],[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    seen.add(el);
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const ink = blend(fg, bg);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(ink, bg);
    if (got < need) fails.push({ text: t.textContent.trim().slice(0, 40), ratio: +got.toFixed(2), need, size: +size.toFixed(1), tag: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '') });
  }
  const gold = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const bg = parse(cs.backgroundColor);
    if (bg && bg.a > 0 && bg.r === 232 && bg.g === 185 && bg.b === 48 && !/badge|chip|deal/i.test(String(el.className))) gold.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]);
  }
  return { page: location.pathname, failures: fails, goldOutsideChip: gold };
})()
