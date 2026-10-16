// Browser helpers for the passport check (Addendum G, task G5), shared by /plan and /passport.
// Nothing here stores, logs or sends anything. The expiry month and year, and the travel dates, are read from the page, used by
// checkPassport() in the same tab, and forgotten when the tab closes. The only storage touched is a READ of the origin the visitor chose
// on the home page, so a Tel Aviv origin gets the general link instead of a verdict.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function readOrigin() {
  try {
    return window.localStorage.getItem('sparkfare_selected_origin') || null;
  } catch (e) {
    return null;
  }
}

// The watcher's holds and the owner's confirmations for the passport rules. Failure means no overrides.
export async function loadPassportOverrides() {
  try {
    const r = await fetch('/api/passport-check/status', { cache: 'no-store' });
    if (!r.ok) return {};
    const j = await r.json();
    return (j && j.overrides) || {};
  } catch (e) {
    return {};
  }
}

// Fills a month <select> and a year <select> with their options. The year runs from last year (a passport may already have expired)
// to twenty years ahead.
export function fillExpirySelects(monthSelect, yearSelect) {
  const m0 = document.createElement('option');
  m0.value = '';
  m0.textContent = 'Month';
  monthSelect.appendChild(m0);
  MONTHS.forEach((name, i) => {
    const o = document.createElement('option');
    o.value = String(i + 1);
    o.textContent = name;
    monthSelect.appendChild(o);
  });
  const y0 = document.createElement('option');
  y0.value = '';
  y0.textContent = 'Year';
  yearSelect.appendChild(y0);
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 1; y <= thisYear + 20; y++) {
    const o = document.createElement('option');
    o.value = String(y);
    o.textContent = String(y);
    yearSelect.appendChild(o);
  }
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function link(text, href) {
  const a = el('a', null, text);
  a.href = href;
  a.rel = 'noopener noreferrer';
  a.target = '_blank';
  return a;
}

// Draws a checkPassport() result into `container`.
export function renderPassportResult(container, r) {
  container.replaceChildren();
  if (!r) return;
  if (r.result === 'hidden') {
    container.appendChild(el('p', 'p-note', r.note));
    const p = el('p', 'p-meta');
    p.appendChild(link('State Department travel information', r.generalUrl));
    container.appendChild(p);
    return;
  }
  if (r.ok === false) {
    container.appendChild(el('p', 'p-error', r.error === 'expiry' ? 'Choose the month and year your passport expires.' : 'Check your leaving and back dates.'));
    return;
  }
  container.appendChild(el('h3', 'p-headline p-' + r.result, r.headline));
  if (r.result === 'check') {
    const p = el('p', 'p-note', r.heldNotice || 'Check the official page:');
    p.appendChild(document.createTextNode(' '));
    p.appendChild(link('State Department page for ' + r.countryName, r.countryUrl));
    container.appendChild(p);
  } else {
    if (r.rule) {
      container.appendChild(el('p', 'p-note', r.rule.requirementText));
      if (r.rule.recommendation) container.appendChild(el('p', 'p-meta', r.rule.recommendation));
      container.appendChild(el('blockquote', 'p-quote', r.rule.quote));
      const src = el('p', 'p-meta');
      src.appendChild(document.createTextNode('Source: '));
      src.appendChild(link(r.rule.sourceName, r.rule.sourceUrl));
      src.appendChild(document.createTextNode('. Page last updated ' + r.rule.pageDate + '. Checked on ' + r.rule.asOf + '.'));
      container.appendChild(src);
    }
    if (r.result === 'renew' && r.renew) {
      container.appendChild(el('p', 'p-by', r.renew.actByText));
      container.appendChild(el('p', 'p-note', r.renew.note));
      if (r.renew.pastDue && r.renew.urgentUrl) {
        const u = el('p', 'p-note', r.renew.urgentNote + ' ');
        u.appendChild(link('Urgent passport travel', r.renew.urgentUrl));
        container.appendChild(u);
      }
      const proc = el('p', 'p-meta');
      proc.appendChild(document.createTextNode('Source: '));
      proc.appendChild(link('U.S. Department of State, passport processing times', r.renew.processing.sourceUrl));
      proc.appendChild(document.createTextNode('. Page last updated ' + r.renew.processing.pageDate + '. Checked on ' + r.renew.processing.asOf + '.'));
      container.appendChild(proc);
    }
  }
  const d = el('p', 'p-disclaimer');
  d.appendChild(document.createTextNode('Based on a US passport. Check the '));
  d.appendChild(link('State Department page for ' + r.countryName, r.countryUrl));
  d.appendChild(document.createTextNode(' before you travel.'));
  container.appendChild(d);
}
