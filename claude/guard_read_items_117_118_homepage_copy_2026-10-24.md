# Guard read · Items 117 and 118 (homepage copy) · 2026-10-24 ~15:20 Israel

Short consult: Frame, Ground, Guard, Audit. Non-attorney guidance; verify with counsel.

Context: owner reports PR #364 merged and a new unmerged PR making the homepage route count computed (item 119) and fixing the ROADMAP step 107 row. Items 117 and 118 are Hub reconciliation items (session state), not repo items; observed on the live homepage Oct 24 ~14:05.

## Item 117
Live text (Tools tile): "Long weekends and PTO days, with fares for each window." Also the strip: "See 2026–2027 long-weekend calendars and flight options around federal holidays."
Fact: `ENABLE_PTO_FARES` is off (Claude Code, Oct 24); windows show destinations, not fares (ledger L06).
Guard: CONDITIONAL. Cleared replacements: tile "Long weekends and PTO days, with destinations for each window."; strip "See 2026–2027 long-weekend calendars and destinations around federal holidays." Restore the fare wording only when the flag is on.

## Item 118
Live text: "Tracking prices for 880 routes from 22 major hubs." Selector lists 23 origins including TLV (test origin).
Guard: CONDITIONAL. Either option passes: (A) compute the hub count with the route count, exclude TLV and its routes from both, and say "US hubs"; (B) keep TLV out of the public selector. Owner call; A fits the computed-count PR.
