-- Q3 (Addendum Q, ROADMAP step 169): frequency has two honest values, 'daily' and 'weekly'. 'instant' never meant anything the product
-- delivers, and an empty value was already treated as daily. Idempotent and additive in effect (no column change).
-- Apply to production and record it in d1_migrations BEFORE or with the merge:
--   wrangler d1 execute sparkfare-db --remote --file=migrations/0038_frequency_two_choices.sql
UPDATE users SET frequency = 'daily' WHERE frequency = 'instant' OR frequency IS NULL;
