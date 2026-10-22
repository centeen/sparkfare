// src/checkOg.js
// 1200 x 630 share card for /check (Addendum M, Package M3 - ROADMAP step 145).
// Renders route, verdict word, median comparison, basis and as-of timestamp.
// Zero hex literals (uses EMAIL_LIGHT tokens).
import { html as satoriHtml } from 'satori-html';
import { EMAIL_LIGHT } from './emailTokens.js';

export function checkOgHtml({
  origin,
  destination,
  verdict = 'typical',
  pctDiff = 0,
  direction = 'about_equal',
  median = null,
  n = null,
  price = null,
  asOf = '',
}) {
  const routeLabel = `${origin} → ${destination}`;
  const routeSize = routeLabel.length > 32 ? 46 : routeLabel.length > 22 ? 54 : 64;

  const verdictUpper = (verdict || 'typical').toUpperCase();
  const isDeal = verdict === 'deal';
  const isHigh = verdict === 'high';

  // Verdict pill colors based on Brand v1 tokens
  const chipBg = isDeal ? EMAIL_LIGHT.spark : EMAIL_LIGHT.card;
  const chipColor = isDeal ? EMAIL_LIGHT.onSpark : isHigh ? EMAIL_LIGHT.ink : EMAIL_LIGHT.ink2;
  const chipBorder = isDeal ? `2px solid ${EMAIL_LIGHT.ink}` : `2px solid ${EMAIL_LIGHT.line}`;

  // Direction headline
  let comparisonText = 'About the same as 30-day median';
  if (direction === 'below') {
    comparisonText = `${pctDiff}% below this route's 30-day median`;
  } else if (direction === 'above') {
    comparisonText = `${pctDiff}% above this route's 30-day median`;
  }

  // Optional price display (only when person opted to include it; never mandatory)
  const priceDisplay = price !== null && price !== undefined
    ? `<div style="display: flex; align-items: baseline; margin-top: 8px;">
        <div style="font-size: 76px; font-weight: 700; color: ${isDeal ? EMAIL_LIGHT.sage : EMAIL_LIGHT.ink}; line-height: 1;">$${Math.round(price)}</div>
        <div style="font-size: 26px; color: ${EMAIL_LIGHT.ink2}; margin-left: 14px;">round trip</div>
      </div>`
    : '';

  const basisText = median
    ? `30-day median: $${Math.round(median)}${n ? ` (from ${n} daily fares)` : ''}`
    : 'Benchmarked against cached 30-day daily lows';

  const raw = `<div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background-color: ${EMAIL_LIGHT.paper}; padding: 56px 64px; justify-content: space-between; font-family: 'Inter'; border: 12px solid ${EMAIL_LIGHT.line};">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="font-size: 32px; font-weight: 700; color: ${EMAIL_LIGHT.ink2}; text-transform: uppercase; letter-spacing: 4px;">SPARKFARE</div>
      <div style="display: flex; align-items: center; background-color: ${chipBg}; color: ${chipColor}; border: ${chipBorder}; padding: 8px 24px; border-radius: 999px; font-size: 26px; font-weight: 700; letter-spacing: 1px;">
        ${verdictUpper}
      </div>
    </div>

    <div style="display: flex; flex-direction: column; margin: 12px 0;">
      <div style="font-size: ${routeSize}px; font-weight: 700; color: ${EMAIL_LIGHT.ink}; line-height: 1.15; margin-bottom: 12px;">
        ${routeLabel}
      </div>
      <div style="font-size: 38px; font-weight: 600; color: ${isDeal ? EMAIL_LIGHT.sage : EMAIL_LIGHT.ink}; line-height: 1.2;">
        ${comparisonText}
      </div>
      ${priceDisplay}
    </div>

    <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 18px; border-top: 2px solid ${EMAIL_LIGHT.line};">
      <div style="font-size: 24px; color: ${EMAIL_LIGHT.ink2};">
        ${basisText}
      </div>
      <div style="font-size: 22px; color: ${EMAIL_LIGHT.ink2};">
        ${asOf ? `As of ${asOf} · ` : ''}sparkfare.com/check
      </div>
    </div>
  </div>`;

  return satoriHtml(raw);
}

