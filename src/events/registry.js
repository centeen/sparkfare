// Addendum N, N12 (DR-16): the tracking plan. Every event name the code writes, defined once, with a version and the fields it must carry.
//
// - `v` is the schema version of the event's shape. It is stored in `events.schema_version`. Change a shape in a way a query could notice (rename or remove a
//   meta key, change a column's meaning) by raising `v`, and note it in `note`.
// - `required` lists fields that must be present: a bare name is a column of `events` (partner, route, source, origin, sub_id, user_id), `meta.x` is a key of
//   the JSON `meta`. A missing field does not drop the event; it is logged with `meta._missing` listing what was absent, so a bad call site shows up in the data.
// - `logEvent` accepts only names in this file. An unregistered name is recorded once per isolate as `unregistered_event` with the name in meta, never dropped
//   silently. tests/event_registry.test.js fails when the code names an event that is not here.
export const EVENT_SCHEMA_VERSION = 1;

const E = (note, required = []) => ({ v: EVENT_SCHEMA_VERSION, required, note });

export const EVENT_REGISTRY = {
  // ---- acquisition and signup ----
  signup: E('A signup or resubmit; source in `source`, campaign tag in meta.utm'),
  email_verified: E('The address was confirmed (/api/verify); source = the signup source'),
  referral_signup: E('A signup that arrived through a referral link'),
  alert_subscribed: E('An alert signup completed'),
  welcome_prefs: E('Trip length and travelers saved on the confirmation page'),
  origin_request: E('A visitor asked for an airport we do not cover'),
  plus_waitlist_join: E('Joined the Plus waitlist'),
  plus_waitlist_verified: E('Confirmed the Plus waitlist address'),
  pricing_view: E('Viewed the pricing page'),
  // ---- price checker, time-off planner, leave-by plan ----
  check_run: E('A /check price check'),
  check_share: E('Shared a /check result'),
  check_signup: E('Signed up from /check'),
  pto_view: E('Viewed the time-off planner'),
  pto_plan_change: E('Changed the planner budget or holidays'),
  pto_ics_download: E('Downloaded the planner calendar file'),
  pto_share: E('Shared the planner'),
  pto_signup: E('Signed up from the planner'),
  pto_watch_create: E('Created a long-weekend watch'),
  pto_watch_cancelled: E('Cancelled a long-weekend watch'),
  pto_watch_alert_sent: E('A long-weekend alert was sent'),
  plan_start: E('Opened the leave-by plan'),
  plan_complete: E('Finished a leave-by plan; counts only'),
  item_done: E('Ticked a plan item; counts only'),
  away_mode_view: E('Viewed Away Mode'),
  reminder_optin: E('Confirmed plan reminder emails'),
  homecard_created: E('A Home card was made; counts only'),
  homecard_open: E('A Home card was opened; counts only'),
  leave_view: E('Viewed /leave'),
  leave_started: E('Started the /leave questions'),
  leave_answer: E('Answered a /leave question'),
  leave_trip_length: E('Trip length chosen on /leave'),
  leave_long_branch_shown: E('The 30-day branch was shown'),
  leave_completed: E('Finished /leave'),
  leave_result_view: E('Viewed a /leave result'),
  leave_signup: E('Signed up from /leave'),
  trip_self_report: E('A traveler gave a trip status answer (done, not yet, not going)'),
  // ---- outbound clicks and sharing ----
  outbound_click: E('A partner or fare link click (/out, /go); meta.ua_class separates bots', ['partner']),
  share_click: E('Used a share control'),
  widget_impression: E('The embeddable widget was shown'),
  interstitial_view: E('The pre-redirect page was shown'),
  interstitial_close: E('The pre-redirect page was dismissed'),
  row_card_view: E('The end-of-row alert card was shown; counts only'),
  // ---- email ----
  alert_email_sent: E('A digest or alert was sent to one reader'),
  alert_merged_into_digest: E('A watch hit was carried in the digest instead of its own email'),
  away_mode_sequence_sent: E('An Away Mode follow-up email was sent'),
  email_open: E('Resend webhook: opened', ['meta.email_id']),
  email_click: E('Resend webhook: clicked; meta.scanner_suspect for scanner-speed clicks', ['meta.email_id']),
  email_delivered: E('Resend webhook: delivered', ['meta.email_id']),
  email_bounce: E('Resend webhook: bounced; meta.bounce_type', ['meta.email_id']),
  email_complaint: E('Resend webhook: spam complaint', ['meta.email_id']),
  email_unsubscribe: E('One-click unsubscribe, with the stream the link came from', ['meta.stream']),
  email_slot: E('A send-budget decision (allow, defer, batch)', ['meta.decision']),
  email_blocked_no_postal_address: E('A commercial email was not sent: no postal address configured'),
  digest_skipped_unchanged: E('A reader was skipped because nothing changed'),
  weekly_edition_missing: E('No weekly edition existed on a Sunday'),
  weekly_standup_sent: E('The Monday brief was sent; sub_id = the week'),
  prefs_change: E('A reader changed their email settings on the signed page; meta.action is daily, weekly, pause or stop', ['meta.action']),
  // ---- pipeline and operations ----
  deal_suppressed: E('A fare failed the deal-quality rules'),
  route_promoted: E('A route page became indexable'),
  x_post_sent: E('The daily X post went out'),
  x_post_skipped_no_deal: E('The daily X post had nothing to say'),
  retention_run: E('The monthly retention job ran (or counted, in a dry run); counts only', ['meta.dry_run']),
  // ---- the registry itself ----
  unregistered_event: E('logEvent was called with a name that is not in this registry; meta.name is that name', ['meta.name']),
};

export const isRegistered = (name) => Object.prototype.hasOwnProperty.call(EVENT_REGISTRY, name);

/** The required fields (see the header) that this event lacks. */
export function missingRequired(data) {
  const entry = EVENT_REGISTRY[data?.event_type];
  if (!entry) return [];
  const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
  return entry.required.filter((field) => (field.startsWith('meta.') ? meta[field.slice(5)] == null : data[field] == null || data[field] === ''));
}

const UA_CLASSES = new Set(['bot', 'human', 'none']);
/** The visitor class in the typed column: meta.ua_class when it is one we know. */
export const uaClassOf = (data) => {
  const v = data?.meta && typeof data.meta === 'object' ? data.meta.ua_class : null;
  return UA_CLASSES.has(v) ? v : null;
};
