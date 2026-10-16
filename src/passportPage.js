// The standalone passport page's blocks (Addendum G, task G5): one block per destination, written from the same rule data the checker
// uses, so what a visitor reads here is what the check compares against. Server-rendered so the page is indexable. Contains no date and
// no traveler input.
import {
  LEAVE_BY_DESTINATIONS, DESTINATION_COUNTRY_MAP, COUNTRY_NAMES, PASSPORT_RULES, PASSPORT_PROCESSING, passportRuleFor,
  passportRequirementText, stateDeptCountryUrl,
} from './data/leaveByRules.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function passportAnchor(destination) {
  return String(destination).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function ruleBlock(destination) {
  const code = DESTINATION_COUNTRY_MAP[destination];
  const countryName = COUNTRY_NAMES[code] || code;
  const rule = passportRuleFor(code);
  const url = stateDeptCountryUrl(code);
  const held = !rule || rule.status === 'held' || rule.kind === 'check';
  const body = held
    ? `<p class="rule">Check the official page: the State Department page for ${esc(countryName)} does not say how long a passport must stay valid.</p>`
    : `<p class="rule">${esc(passportRequirementText(rule))}${rule.recommendMonths ? ' ' + esc('The page recommends ' + rule.recommendMonths + ' months of validity.') : ''}</p>
      <blockquote>${esc(rule.quote)}</blockquote>
      <p class="meta">Source: <a href="${esc(url)}" rel="noopener noreferrer">U.S. Department of State, ${esc(countryName)} page</a>. Page last updated ${esc(rule.pageDate)}. Checked on ${esc(rule.asOf)}.</p>`;
  return `    <section class="dest" id="${esc(passportAnchor(destination))}">
      <h3>${esc(destination)}</h3>
${body}
      <p class="meta"><a href="${esc(url)}" rel="noopener noreferrer">Official page for ${esc(countryName)}</a></p>
    </section>`;
}

export function renderPassportBlocks() {
  const processing = `    <section class="dest" id="processing-time">
      <h3>How long a US passport takes</h3>
      <blockquote>${esc(PASSPORT_PROCESSING.quote)}</blockquote>
      <p class="meta">Source: <a href="${esc(PASSPORT_PROCESSING.officialUrl)}" rel="noopener noreferrer">${esc(PASSPORT_PROCESSING.sourceName)}</a>. Page last updated ${esc(PASSPORT_PROCESSING.pageDate)}. Checked on ${esc(PASSPORT_PROCESSING.asOf)}. Mailing can add up to 2 weeks each way.</p>
    </section>`;
  return LEAVE_BY_DESTINATIONS.map(ruleBlock).join('\n') + '\n' + processing;
}

export { PASSPORT_RULES };
