// Single source of truth for the referral-positioning copy (decision logged 2026-10-07).
//
// The position this wording supports: Sparkfare publishes fare information and sends people to the
// booking site. It does not sell, book, ticket, arrange or take payment for travel. These strings
// state facts about what Sparkfare does not do; they never assert a legal status.
//
// Used by the Worker (interstitial, emails, route pages). The static pages get the same two footer
// lines from /site-footer.js, which cannot import this module; tests/referral_copy.test.js fails if
// the two ever drift apart.

export const FOOTER_LINE_1 =
  "Sparkfare is a deal-information service. We don't sell, book or arrange travel, and we never take payment. When you click a fare, you buy from the airline or booking site you choose.";
export const FOOTER_LINE_2_TEXT =
  'Prices are indications and can change. Sponsored links may earn Sparkfare a commission.';

// The line under every deal grid (also the step 16 inline affiliate disclosure, merged).
export const GRID_DISCLOSURE =
  'Fare links lead to our travel search partners or the booking site you choose, which handle booking and payment. Sparkfare may earn a commission if you buy through a link, at no extra cost to you.';

// Interstitial (/departing/:trip_id).
export const INTERSTITIAL_HEADING = 'Check this fare';
export const INTERSTITIAL_CTA = 'Continue to fare search ↗';
// The line for the Aviasales path (the only path today). A Fare Search arm will carry its own line, rendered from the trip's
// fare_path (ROADMAP step 79); until then every trip is the Aviasales path, so naming Aviasales here is true.
export const INTERSTITIAL_PARTNER_NOTE = 'Aviasales shows live fares and handles booking and payment. Prices can differ from the fare shown here.';
export const INTERSTITIAL_DISCLOSURE =
  "Sponsored link: Sparkfare may earn a commission if you buy through the button above or the links below, at no extra cost to you. Sparkfare doesn't sell or book travel.";
export const HOTEL_ROW_LABEL = 'Hotels: coming soon';

// Deal buttons.
// Always the short form: a deal link must read the same whichever search or booking site it leads to (the path is
// chosen at click time, so the page cannot know). Any partner argument is ignored on purpose.
export function viewFareLabel() {
  return 'View fare ↗';
}
export function viewFareAria() {
  return 'View this fare (opens in a new tab). Sparkfare does not sell or book travel.';
}
export function viewOnPartnerLabel(partner) {
  return `View on ${partner} ↗`;
}

// Emails.
export const EMAIL_PRIMARY_BUTTON = 'View fare';
export const EMAIL_FOOTER_LINE =
  "Sparkfare is a deal-information service. We don't sell, book or arrange travel. Purchases are made with the airline or booking site you choose.";
export const EMAIL_DOESNT_SELL = "Sparkfare doesn't sell or book travel.";
export function postClickReason(destination, dateText) {
  return `You're getting this because you clicked through to ${destination} fares on sparkfare.com${dateText ? ` on ${dateText}` : ''}.`;
}
export function bookingReportedSubject(destination, partner) {
  return `Looks like you booked ${destination} on ${partner}`;
}
export function bookingReportedOpening(partner) {
  return `${partner} reported a purchase from your Sparkfare click. Here is what to sort before you go.`;
}

// "What Sparkfare does and doesn't do" (terms and disclosure pages).
export const ABOUT_SECTION_TITLE = "What Sparkfare does and doesn't do";
export const ABOUT_SECTION_TEXT =
  "Sparkfare publishes fare information and price-history analysis. We don't sell, book, ticket, arrange or take payment for travel. When you follow a link you leave Sparkfare, and any purchase is a contract between you and the airline or booking site you choose. That site, not Sparkfare, is responsible for your booking, payment, changes and refunds. Fares shown are indications from recent search data and may change or sell out.";
