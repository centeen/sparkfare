# Backlog rows G110 to G117: Communications Framework v1 (consult 18, Oct 27, 2026)

Status: **APPROVED with the framework (D-049, Oct 27 14:29).** Read with `state_COUNCIL_BACKLOG.md` and the G76-G105 staged file until the next full rewrite. Report: Claude Doc "Sparkfare Communications Framework v1", https://claude.ai/artifact/BgioYGgsJtz976iQHxu9S9. Scores: Spark Score D x V x F; weights equal, no F0 data yet. D from persona replies (Live digest and Live (repo) lifecycle emails only), V from the Revenue assumptions table ($0 / ~$4 / ~$49 incremental per 100 confirmed signups over 90 days, arithmetic), F from Product Reality (repo at 8657dea). Integrity: AGENT_LEGAL_COMPLIANCE, CONDITIONAL (9 conditions), non-attorney guidance.

| ID | Plan step | Gem | Spark | Integrity | Smallest test | Kill signal | Status |
|---|---|---|---|---|---|---|---|
| G110 | Q1 | One-envelope send budget: per-recipient daily ledger, priority order, max 1 scheduled and 2 total per local day; trip content folds into the digest | 5x3x4 = 60 | CONDITIONAL (Guard 2) | Emails per recipient per day; unsubscribes per send by stream | Any delayed transactional email | Approved (D-049): build, C0, Addendum Q |
| G111 | Q5 | Welcome email W1 on confirmation; verification subject reworded | 4x3x4 = 48 | CONDITIONAL (Guard 6) | Welcome clickers per 100 delivered; 30-day active share vs pre-W1 cohort | Welcome click rate below digest click rate after 200 sends | Approved (D-049): build, C0; W1 copy needs PROPOSED mock read |
| G112 | C1.2, C1.3 | Trip stream gated by the "Got your ticket?" tap; one schedule 21/7/1 (30/14/7 for long stays) plus return-day note | 4x4x3 = 48 | CONDITIONAL (Guard 7) | Partner clicks per 100 confirmed travellers by trip length | Under 10% of clickers answer after 100 asks | Approved (D-049d): build, flips from Nov 9 |
| G113 | Q2 | Weekly edition emailed to weekly readers; Sunday newsletter retired | 4x2x4 = 32 | CONDITIONAL (Guard 1, 2) | Sunday emails per recipient = 1; weekly clicks per 100 | Weekly click rate below the old newsletter's | Approved (D-049b): build, C0 |
| G114 | C1.1 | Daily or weekly choice at signup; signed preference page without an account | 4x2x4 = 32 | PASS | Signup rate and 90-day unsubscribe rate by choice | Signup rate drops vs the Day-14 baseline | Approved (D-049): test, C1 |
| G115 | Q6 | Clicks, not opens: engagement from clicks; opens can delay but never trigger a pause | 3x2x5 = 30 | PASS | Wrongly paused readers who later click (reactivations) | n/a (measurement hygiene) | Approved (D-049): build, C0 |
| G116 | C1.4 | One v2 template for every lifecycle email; one partner per email | 3x3x3 = 27 | CONDITIONAL (Guard 5) | Partner clicks per 100 delivered, lifecycle | No lift after 1,000 delivered | Approved (D-049): test, C1 |
| G117 | Q7 | Local-morning send (06:30 local per origin, hourly cron) | 3x2x4 = 24 | PASS | 06:30 vs 19:30 local on clicks per 100, 1,000 delivered per arm | Evening arm wins | Approved (D-049c): build C0 (movable to Nov 9-12), test in C1 |

Program score: 4x3x3 = 36 (test band). Refused (FAIL): SMS without a consent program; emails from anonymous browsing; countdown, scarcity or "prices rising" devices. Parked: BIMI (revisit at 1,000+ confirmed), per-person AI send time and AI-written deal copy.

Splits kept: Dana (daily, speed) vs Priya, Tess, Elena (fewer, dated, chosen); Ray vs Linda (numbers vs guidance first); deal-publisher lens vs Behavioral Design on instant sends.
