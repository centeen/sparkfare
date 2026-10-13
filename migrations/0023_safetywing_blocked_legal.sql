-- 0023: D-002 (2026-10-13). SafetyWing's referral link is removed from every surface until ROADMAP Step 19 (insurance-referral
-- licensing) is resolved. Educational insurance copy stays; there is no link, no partner recommendation and no call to action.
-- /api/partners only returns status = 'live' rows, and /out/safetywing and /go/safetywing now redirect to /away-mode in the Worker
-- (RETIRED_PARTNER_SLUGS in src/index.js), so no outbound click is logged. url_template is left in place on purpose: removing it
-- is not needed to stop every render path, and keeping it makes the later decision a one-row UPDATE.
-- Additive in effect, one row. Rollback: UPDATE partners SET status = 'live', status_reason = NULL WHERE slug = 'safetywing';
UPDATE partners
   SET status = 'blocked_legal',
       status_reason = 'Step 19 open; D-002',
       updated_at = datetime('now')
 WHERE slug = 'safetywing';
