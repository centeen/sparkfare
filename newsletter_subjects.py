"""Subject-line and intro rules for the Sunday newsletter (handoff D-009).

Pure functions, no network and no third-party imports, so tests can run them directly. Used by
"Phase 19 Newsletter Generator.py".

The rules, in plain words:
  * A subject is a curiosity-gap line (subjectA) or a direct, price-led line (subjectB). Both must be
    truthful to the FIRST deal in the email: any dollar amount equals that deal's price, and no other
    deal's destination is named.
  * Under 58 characters.
  * No hype phrases, no savings claim that the data does not back, and none of the banned referral words
    (the copy rule in CLAUDE.md: nothing that says Sparkfare books, secures, reserves or arranges travel).
  * If subjectA fails any rule, subjectB goes out in its place. If subjectB fails too, a deterministic
    direct subject built from the first deal goes out. The choice is returned so the caller can log it.

CAN-SPAM note: a subject must not mislead about the content of the message. This is non-attorney
guidance; verify with counsel.
"""
import re
from datetime import datetime, timedelta, timezone

SUBJECT_MAX_LEN = 57  # "under 58 characters"

# Hype and pressure phrases named in the handoff.
HYPE_PATTERNS = [
    r"you won'?t believe",
    r"dirt[ -]cheap",
    r"\bhuge\b",
    r"\bsteals?\b",
    r"right now",
    r"\bhurry\b",
    r"last chance",
    r"unbeatable",
]

# Savings claims: a percentage, or words that promise money back. A deal's own badge already states its basis
# ("% below the 30-day median"); a subject line has no room for that basis, so it makes no such claim.
SAVINGS_PATTERNS = [
    r"%",
    r"\bpercent\b",
    r"\boff\b",
    r"\bsav(e|es|ed|ing|ings)\b",
    r"\bdiscount\w*",
    r"\bbargain\w*",
    r"\bhalf[ -]price\b",
    r"\bfree\b",
]

# The referral-positioning copy rule (CLAUDE.md, "Compliance"): nothing that says Sparkfare sells, books,
# secures, reserves or arranges travel, and no legal-status words.
REFERRAL_PATTERNS = [
    r"\bbook\w*",
    r"\bsecur(e|es|ed|ing)\b",
    r"locked[ -]in",
    r"\breserv\w*",
    r"\bwe (arrange|arranged)\b",
    r"we found you a trip",
    r"seller of travel",
    r"travel agency",
    r"\blicensed\b",
    r"\bexempt\b",
    r"\bcalifornia\b",
    r"\bflorida\b",
    r"\bhawaii\b",
]

_ALL = [("hype", HYPE_PATTERNS), ("savings claim", SAVINGS_PATTERNS), ("banned referral word", REFERRAL_PATTERNS)]

ORIGIN_CITY = {
    "JFK": "New York", "LAX": "Los Angeles", "ORD": "Chicago", "ATL": "Atlanta", "DFW": "Dallas", "SFO": "San Francisco",
    "MIA": "Miami", "IAD": "Washington", "EWR": "Newark", "SEA": "Seattle", "IAH": "Houston", "BOS": "Boston",
    "DEN": "Denver", "PHX": "Phoenix", "LAS": "Las Vegas", "PHL": "Philadelphia", "MSP": "Minneapolis", "CLT": "Charlotte",
    "DTW": "Detroit", "FLL": "Fort Lauderdale", "BWI": "Baltimore", "AUS": "Austin", "TLV": "Tel Aviv",
}

SAFE_INTRO = "Here are the lowest fares we tracked this week. Each price shows when we retrieved it, and fares change."


def origin_city(origin):
    return ORIGIN_CITY.get(origin, origin)


def dest_city(display_name):
    """'Lisbon, Portugal' -> 'Lisbon'. The part before the first comma."""
    return str(display_name or "").split(",")[0].strip()


def _price_int(deal):
    try:
        return int(round(float(deal.get("price"))))
    except (TypeError, ValueError, AttributeError):
        return None


def banned_matches(text):
    """Every banned-rule hit in text as (category, matched_text). Case-insensitive."""
    hits = []
    low = str(text or "")
    for category, patterns in _ALL:
        for p in patterns:
            m = re.search(p, low, flags=re.IGNORECASE)
            if m:
                hits.append((category, m.group(0)))
    return hits


def subject_violations(subject, deals):
    """Return a list of human-readable reasons the subject is not allowed. Empty list means it passes."""
    reasons = []
    if not isinstance(subject, str) or not subject.strip():
        return ["empty"]
    s = subject.strip()
    if len(s) > SUBJECT_MAX_LEN:
        reasons.append("too long (%d characters, limit %d)" % (len(s), SUBJECT_MAX_LEN))
    for category, text in banned_matches(s):
        reasons.append("%s: %r" % (category, text))

    first = deals[0] if deals else None
    first_price = _price_int(first) if first else None
    for amount in re.findall(r"\$\s?([0-9][0-9,]*)", s):
        value = int(amount.replace(",", ""))
        if first_price is None or value != first_price:
            reasons.append("price $%s is not the first deal's price" % amount)

    if first:
        first_name = dest_city(first.get("display_name")).lower()
        for d in deals[1:]:
            other = dest_city(d.get("display_name")).lower()
            if other and other != first_name and re.search(r"\b" + re.escape(other) + r"\b", s, flags=re.IGNORECASE):
                reasons.append("names %r, which is not the first deal" % dest_city(d.get("display_name")))
    return reasons


def intro_violations(intro):
    if not isinstance(intro, str) or not intro.strip():
        return ["empty"]
    return ["%s: %r" % (c, t) for c, t in banned_matches(intro)]


def direct_subject(origin, deals):
    """A deterministic, truthful, price-led subject built from the first deal. Always under the limit."""
    city = origin_city(origin)
    if not deals:
        return "Flight deals from %s this week" % city
    dest = dest_city(deals[0].get("display_name"))
    price = _price_int(deals[0])
    candidates = []
    if price is not None:
        candidates = [
            "Lowest fares from %s: %s $%d" % (city, dest, price),
            "%s fares: %s $%d" % (origin, dest, price),
            "%s from %s: $%d" % (dest, origin, price),
        ]
    candidates.append("Flight deals from %s this week" % city)
    for c in candidates:
        if len(c) <= SUBJECT_MAX_LEN:
            return c
    return "Flight deals this week"


def mock_copy(origin, deals):
    """Offline copy that follows the same rules (used when the API key is absent)."""
    city = origin_city(origin)
    dests = [dest_city(d.get("display_name")) for d in deals]
    price = _price_int(deals[0]) if deals else None
    if price is not None:
        a = "Where $%d gets you from %s this week" % (price, city)
        if len(a) > SUBJECT_MAX_LEN:
            a = "Where $%d gets you from %s" % (price, origin)
    else:
        a = "What we found from %s this week" % city
    return {
        "intro": "Here are the lowest fares we tracked from %s this week: %s. Each price shows when we retrieved it, and fares change." % (city, ", ".join(dests)),
        "subjectA": a,
        "subjectB": direct_subject(origin, deals),
    }


def choose_copy(copy, origin, deals):
    """Validate generated copy and decide what goes out.

    Returns {"intro", "subjectA", "subjectB", "subject_used", "rejections"}. subject_used is "A" when the curiosity-gap line
    passed, "B" when it failed and the direct line replaced it, "fallback" when neither passed and the deterministic direct
    subject was used. rejections lists every rule hit, for the log.
    """
    copy = copy or {}
    rejections = []

    sub_a = copy.get("subjectA")
    sub_b = copy.get("subjectB")
    a_bad = subject_violations(sub_a, deals)
    b_bad = subject_violations(sub_b, deals)
    if a_bad:
        rejections.append({"field": "subjectA", "value": sub_a, "reasons": a_bad})
    if b_bad:
        rejections.append({"field": "subjectB", "value": sub_b, "reasons": b_bad})

    fallback = direct_subject(origin, deals)
    if not a_bad:
        used = "A"
        final_a = sub_a
        final_b = sub_b if not b_bad else fallback
    elif not b_bad:
        used = "B"
        final_a = sub_b
        final_b = sub_b
    else:
        used = "fallback"
        final_a = fallback
        final_b = fallback

    intro = copy.get("intro")
    i_bad = intro_violations(intro)
    if i_bad:
        rejections.append({"field": "intro", "value": intro, "reasons": i_bad})
        intro = SAFE_INTRO

    return {"intro": intro, "subjectA": final_a, "subjectB": final_b, "subject_used": used, "rejections": rejections}


# Render-time guard (Addendum J, J1 A2/A3), the same rule as src/priceFreshness.js fareStillShowable() and index.html:
# a fare is not shown or sent when it departs within DEPARTURE_BUFFER_HOURS, or was last seen more than LAPSE_DAYS calendar days ago.
DEPARTURE_BUFFER_HOURS = 48
LAPSE_DAYS = 3


def _parse_when(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def fare_showable(record, now=None):
    now = now or datetime.now(timezone.utc)
    departure = _parse_when(record.get("departure_at"))
    if departure is not None and departure < now + timedelta(hours=DEPARTURE_BUFFER_HOURS):
        return False
    last_day = None
    fresh_date = record.get("last_fresh_date")
    if record.get("is_stale_fallback") and isinstance(fresh_date, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", fresh_date):
        last_day = datetime.fromisoformat(fresh_date).replace(tzinfo=timezone.utc).date()
    else:
        found = _parse_when(record.get("found_at"))
        if found is not None:
            last_day = found.date()
        elif isinstance(fresh_date, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", fresh_date):
            last_day = datetime.fromisoformat(fresh_date).replace(tzinfo=timezone.utc).date()
    if last_day is not None and (now.date() - last_day).days > LAPSE_DAYS:
        return False
    return True
