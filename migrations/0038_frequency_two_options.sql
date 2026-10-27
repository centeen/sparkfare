-- Addendum Q, Q3 (D-049): frequency has two honest values, `daily` and `weekly`. "Instant (Rare Finds only)" was never a separate send (the code
-- treated `instant` exactly like `daily`) and is removed from the preference pages and the API. Existing `instant` rows, and any row with no
-- value, become `daily`. A NULL row was never matched by the daily send's frequency check, so before this runs it receives no digest; after it
-- runs it does. Count them first: SELECT COUNT(*) FROM users WHERE frequency IS NULL;  (docs/q0_production_reads.sql block 6 shows them too).
-- Apply to production before the Q3 code merges (auto-deploy does not run migrations), then record it in d1_migrations.
UPDATE users SET frequency = 'daily' WHERE frequency IS NULL OR frequency NOT IN ('daily', 'weekly');
