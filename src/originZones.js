// The time zone of each marketed origin's home airport (all 22 US origins, plus TLV). Used for the evening-before email
// (planReminders) and to print fare times in an email in the recipient's home-airport zone, the closest an email can get to
// "the reader's own time zone" (A6, owner decision 2026-10-24).
export const ORIGIN_TIME_ZONES = {
  JFK: 'America/New_York', EWR: 'America/New_York', BOS: 'America/New_York', IAD: 'America/New_York', ATL: 'America/New_York',
  MIA: 'America/New_York', FLL: 'America/New_York', PHL: 'America/New_York', CLT: 'America/New_York', DTW: 'America/New_York', BWI: 'America/New_York',
  ORD: 'America/Chicago', DFW: 'America/Chicago', IAH: 'America/Chicago', MSP: 'America/Chicago', AUS: 'America/Chicago',
  DEN: 'America/Denver', PHX: 'America/Phoenix',
  LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', SEA: 'America/Los_Angeles', LAS: 'America/Los_Angeles',
  TLV: 'Asia/Jerusalem',
};
