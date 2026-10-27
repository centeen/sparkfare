-- Expected database schema: what migrations/ builds. Regenerate with `node scripts/data/schema-snapshot.mjs write`.
-- Columns are sorted by name. See the header of scripts/data/schema-snapshot.mjs for what is and is not compared.

CREATE TABLE "away_mode_clicks" (
  "affiliate_slug" TEXT NOT NULL,
  "clicked_at" TEXT DEFAULT datetime('now'),
  "id" TEXT PRIMARY KEY(1),
  "partner_id" TEXT,
  "trip_id" TEXT
);

CREATE TABLE "away_mode_email_log" (
  "email" TEXT NOT NULL,
  "email_type" TEXT NOT NULL,
  "id" INTEGER PRIMARY KEY(1),
  "partner_id" TEXT,
  "sent_at" TEXT DEFAULT datetime('now')
);

CREATE TABLE "away_plan_done" (
  "done_at" TEXT NOT NULL,
  "plan_id" TEXT PRIMARY KEY(1) NOT NULL,
  "rule_id" TEXT PRIMARY KEY(2) NOT NULL
);

CREATE TABLE "away_plan_reminders" (
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "item_ids_json" TEXT NOT NULL,
  "plan_id" TEXT PRIMARY KEY(1) NOT NULL,
  "send_on" TEXT PRIMARY KEY(2) NOT NULL,
  "sent_at" TEXT,
  "status" TEXT NOT NULL DEFAULT 'scheduled'
);

CREATE TABLE "away_plans" (
  "answers_json" TEXT NOT NULL,
  "back_date" TEXT NOT NULL,
  "bucket" TEXT,
  "confirmed_at" TEXT,
  "created_at" TEXT NOT NULL,
  "delete_after" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "destination_country" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY(1),
  "leave_date" TEXT NOT NULL,
  "origin" TEXT,
  "pending_until" TEXT NOT NULL,
  "set_sent_at" TEXT,
  "stopped_at" TEXT
);

CREATE TABLE "consent_log" (
  "email" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY(1),
  "ip_hash" TEXT,
  "source" TEXT,
  "timestamp" TEXT DEFAULT datetime('now'),
  "user_id" TEXT,
  "wording_version" TEXT
);

CREATE TABLE "daily_alert_deliveries" (
  "created_at" TEXT DEFAULT datetime('now'),
  "delivered_on" TEXT NOT NULL,
  "delivery_key" TEXT PRIMARY KEY(1),
  "email" TEXT NOT NULL,
  "error" TEXT,
  "status" TEXT NOT NULL
);

CREATE TABLE "data_alert_log" (
  "breaches" INTEGER NOT NULL,
  "date" TEXT PRIMARY KEY(1),
  "sent_at" TEXT DEFAULT datetime('now')
);

CREATE TABLE "departing_soon_deliveries" (
  "created_at" TEXT DEFAULT datetime('now'),
  "email" TEXT NOT NULL,
  "error" TEXT,
  "status" TEXT NOT NULL,
  "trip_id" TEXT PRIMARY KEY(1)
);

CREATE TABLE "departure_briefing_deliveries" (
  "created_at" TEXT DEFAULT datetime('now'),
  "email" TEXT NOT NULL,
  "error" TEXT,
  "status" TEXT NOT NULL,
  "trip_id" TEXT PRIMARY KEY(1)
);

CREATE TABLE "digest_editions" (
  "created_at" TEXT NOT NULL,
  "deals_json" TEXT NOT NULL,
  "edition_date" TEXT NOT NULL,
  "edition_number" INTEGER NOT NULL,
  "html_public" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY(1),
  "kind" TEXT NOT NULL DEFAULT 'daily',
  "origin" TEXT NOT NULL,
  "subject" TEXT NOT NULL
);
CREATE INDEX "idx_digest_editions_date" ON "digest_editions" ("edition_date", "origin");

CREATE TABLE "digest_sent_snapshots" (
  "created_at" TEXT DEFAULT datetime('now'),
  "deals_json" TEXT NOT NULL,
  "origin" TEXT PRIMARY KEY(1) NOT NULL,
  "sent_on" TEXT PRIMARY KEY(2) NOT NULL
);

CREATE TABLE "early_bird_snapshots" (
  "price" INTEGER,
  "route_key" TEXT PRIMARY KEY(1) NOT NULL,
  "snapshot_date" TEXT PRIMARY KEY(2) NOT NULL
);

CREATE TABLE "email_delivery_times" (
  "delivered_at" TEXT NOT NULL,
  "email_id" TEXT PRIMARY KEY(1)
);

CREATE TABLE "email_send_ledger" (
  "created_at" TEXT DEFAULT datetime('now'),
  "email" TEXT PRIMARY KEY(1) NOT NULL,
  "kind" TEXT PRIMARY KEY(3) NOT NULL,
  "local_date" TEXT PRIMARY KEY(2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'claimed',
  "stream" TEXT NOT NULL
);
CREATE INDEX "idx_email_send_ledger_date" ON "email_send_ledger" ("local_date");

CREATE TABLE "email_suppressions" (
  "created_at" TEXT DEFAULT datetime('now'),
  "email" TEXT PRIMARY KEY(1),
  "reason" TEXT NOT NULL
);

CREATE TABLE "events" (
  "anon_id" TEXT,
  "event_type" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY(1),
  "meta" TEXT,
  "origin" TEXT,
  "partner" TEXT,
  "route" TEXT,
  "source" TEXT,
  "sub_id" TEXT,
  "ts" TEXT DEFAULT datetime('now'),
  "user_id" TEXT
);
CREATE INDEX "idx_events_ts" ON "events" ("ts");
CREATE INDEX "idx_events_type_ts" ON "events" ("event_type", "ts");

CREATE TABLE "fare_daily" (
  "airline" TEXT,
  "departure_at" TEXT,
  "destination" TEXT NOT NULL,
  "first_seen_at" TEXT,
  "last_run_id" TEXT,
  "min_price" REAL NOT NULL,
  "n_obs" INTEGER NOT NULL DEFAULT 1,
  "obs_date" TEXT PRIMARY KEY(2) NOT NULL,
  "origin" TEXT NOT NULL,
  "return_at" TEXT,
  "route_key" TEXT PRIMARY KEY(1) NOT NULL
);
CREATE INDEX "idx_fare_daily_obs_date" ON "fare_daily" ("obs_date");

CREATE TABLE "home_cards" (
  "back_date" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "leave_date" TEXT NOT NULL,
  "manage_hash" TEXT NOT NULL,
  "notes_json" TEXT NOT NULL,
  "plan_id" TEXT,
  "removed_at" TEXT,
  "tasks_json" TEXT NOT NULL,
  "view_hash" TEXT PRIMARY KEY(1)
);

CREATE TABLE "landings_daily" (
  "campaign" TEXT PRIMARY KEY(3) NOT NULL DEFAULT '',
  "channel" TEXT PRIMARY KEY(2) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "date" TEXT PRIMARY KEY(1) NOT NULL,
  "page_class" TEXT PRIMARY KEY(4) NOT NULL
);
CREATE INDEX "idx_landings_daily_date" ON "landings_daily" ("date");

CREATE TABLE "metrics_daily" (
  "computed_at" TEXT NOT NULL DEFAULT datetime('now'),
  "date" TEXT PRIMARY KEY(1) NOT NULL,
  "dimension" TEXT PRIMARY KEY(3) NOT NULL DEFAULT '',
  "metric_id" TEXT PRIMARY KEY(2) NOT NULL,
  "n" INTEGER NOT NULL DEFAULT 0,
  "value" REAL NOT NULL
);
CREATE INDEX "idx_metrics_daily_metric" ON "metrics_daily" ("metric_id", "date");

CREATE TABLE "partner_conversions" (
  "id" TEXT PRIMARY KEY(1),
  "month" TEXT NOT NULL,
  "reported_conversions" INTEGER DEFAULT 0,
  "reported_revenue" REAL DEFAULT 0,
  "slug" TEXT NOT NULL,
  "updated_at" TEXT DEFAULT datetime('now')
);

CREATE TABLE "partner_payouts" (
  "amount_usd" REAL NOT NULL,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "entered_at" TEXT NOT NULL DEFAULT datetime('now'),
  "month" TEXT PRIMARY KEY(1) NOT NULL,
  "note" TEXT,
  "partner_id" TEXT PRIMARY KEY(2) NOT NULL,
  "source" TEXT PRIMARY KEY(3) NOT NULL
);

CREATE TABLE "partners" (
  "attribution" TEXT,
  "category" TEXT,
  "category_slug" TEXT,
  "commission_note" TEXT,
  "meter" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT PRIMARY KEY(1),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "status_reason" TEXT,
  "updated_at" TEXT DEFAULT datetime('now'),
  "url_template" TEXT NOT NULL
);

CREATE TABLE "pinterest_tokens" (
  "access_token_ciphertext" TEXT NOT NULL,
  "access_token_iv" TEXT NOT NULL,
  "connected_at" TEXT DEFAULT datetime('now'),
  "expires_at" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY(1),
  "refresh_token_ciphertext" TEXT NOT NULL,
  "refresh_token_iv" TEXT NOT NULL,
  "scopes" TEXT NOT NULL,
  "updated_at" TEXT DEFAULT datetime('now')
);

CREATE TABLE "plus_waitlist" (
  "created_at" TEXT DEFAULT datetime('now'),
  "email" TEXT PRIMARY KEY(1),
  "last_sent_at" TEXT,
  "source" TEXT,
  "verified_at" TEXT
);

CREATE TABLE "pre_departure_sequence_deliveries" (
  "created_at" TEXT DEFAULT datetime('now'),
  "email" TEXT NOT NULL,
  "error" TEXT,
  "stage" INTEGER PRIMARY KEY(2) NOT NULL,
  "status" TEXT NOT NULL,
  "trip_id" TEXT PRIMARY KEY(1) NOT NULL
);
CREATE INDEX "idx_pre_dep_seq_email" ON "pre_departure_sequence_deliveries" ("email");

CREATE TABLE "pto_window_watches" (
  "created_at" TEXT DEFAULT datetime('now'),
  "destination" TEXT,
  "id" TEXT PRIMARY KEY(1),
  "last_alert_price" INTEGER,
  "last_alerted_at" TEXT,
  "origin_iata" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "window_end" TEXT NOT NULL,
  "window_start" TEXT NOT NULL
);
CREATE UNIQUE INDEX "idx_pto_watch_unique" ON "pto_window_watches" ("user_id", "origin_iata", "window_start", "window_end", "destination");
CREATE INDEX "idx_pto_watch_window_end" ON "pto_window_watches" ("window_end");

CREATE TABLE "purchase_email_queue" (
  "created_at" TEXT DEFAULT datetime('now'),
  "destination" TEXT,
  "email" TEXT NOT NULL,
  "partner_id" TEXT,
  "passenger_count" INTEGER,
  "trip_id" TEXT PRIMARY KEY(1),
  "trip_length" TEXT
);

CREATE TABLE "push_subscriptions" (
  "auth" TEXT NOT NULL,
  "created_at" TEXT DEFAULT datetime('now'),
  "endpoint" TEXT PRIMARY KEY(1),
  "p256dh" TEXT NOT NULL,
  "user_id" TEXT NOT NULL
);

CREATE TABLE "referral_codes" (
  "code" TEXT NOT NULL,
  "created_at" TEXT DEFAULT datetime('now'),
  "id" TEXT PRIMARY KEY(1),
  "user_id" TEXT NOT NULL
);

CREATE TABLE "referrals" (
  "created_at" TEXT DEFAULT datetime('now'),
  "id" TEXT PRIMARY KEY(1),
  "reason" TEXT,
  "referred_id" TEXT NOT NULL,
  "referrer_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "updated_at" TEXT DEFAULT datetime('now')
);

CREATE TABLE "route_retrospective_deliveries" (
  "created_at" TEXT DEFAULT datetime('now'),
  "email" TEXT NOT NULL,
  "error" TEXT,
  "status" TEXT NOT NULL,
  "trip_id" TEXT PRIMARY KEY(1)
);

CREATE TABLE "route_verdict" (
  "distinct_days" INTEGER,
  "median_price" REAL,
  "pct_vs_median" REAL,
  "route_key" TEXT PRIMARY KEY(1) NOT NULL,
  "rule_version" TEXT,
  "verdict" TEXT,
  "verdict_date" TEXT PRIMARY KEY(2) NOT NULL
);

CREATE TABLE "rule_status_overrides" (
  "as_of" TEXT,
  "held_at" TEXT,
  "note" TEXT,
  "reason" TEXT,
  "rule_id" TEXT PRIMARY KEY(1),
  "status" TEXT NOT NULL,
  "updated_at" TEXT,
  "url" TEXT
);

CREATE TABLE "rule_watch_urls" (
  "fail_count" INTEGER NOT NULL DEFAULT 0,
  "hash" TEXT,
  "last_changed" TEXT,
  "last_checked" TEXT,
  "last_error" TEXT,
  "url" TEXT PRIMARY KEY(1)
);

CREATE TABLE "stress_valve_deliveries" (
  "created_at" TEXT DEFAULT datetime('now'),
  "email" TEXT NOT NULL,
  "error" TEXT,
  "status" TEXT NOT NULL,
  "trip_id" TEXT PRIMARY KEY(1)
);

CREATE TABLE "trips" (
  "booking_self_report" TEXT,
  "clicked_at" TEXT DEFAULT datetime('now'),
  "departure_at" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "event_name" TEXT,
  "hotel_name" TEXT,
  "is_open" INTEGER DEFAULT 0,
  "origin_iata" TEXT NOT NULL,
  "price_at_click" INTEGER NOT NULL,
  "price_eur" REAL,
  "return_at" TEXT,
  "self_reported_at" TEXT,
  "status" TEXT DEFAULT 'clicked',
  "tour_name" TEXT,
  "trip_id" TEXT PRIMARY KEY(1),
  "user_id" TEXT NOT NULL
);
CREATE INDEX "idx_trips_user" ON "trips" ("user_id");

CREATE TABLE "users" (
  "away_needs" TEXT,
  "created_at" TEXT DEFAULT datetime('now'),
  "early_access" INTEGER DEFAULT 0,
  "email" TEXT NOT NULL,
  "frequency" TEXT DEFAULT 'daily',
  "has_pet" INTEGER DEFAULT 0,
  "id" TEXT PRIMARY KEY(1),
  "is_subscribed" INTEGER DEFAULT 1,
  "last_clicked_at" TEXT,
  "last_opened_at" TEXT,
  "leave_answers" TEXT,
  "notify_email" INTEGER DEFAULT 1,
  "notify_push" INTEGER DEFAULT 0,
  "origin_iata" TEXT,
  "partner_id" TEXT,
  "passenger_count" INTEGER DEFAULT 1,
  "paused_until" TEXT,
  "pet_owner" INTEGER,
  "referred_by" TEXT,
  "signup_campaign" TEXT,
  "signup_channel" TEXT,
  "signup_referrer_class" TEXT,
  "signup_source" TEXT,
  "subscription_tier" TEXT DEFAULT 'free',
  "trip_length" TEXT,
  "trip_length_chosen" INTEGER DEFAULT 0,
  "unsubscribed_at" TEXT,
  "verification_token" TEXT,
  "verified_email" INTEGER DEFAULT 0
);
CREATE INDEX "idx_users_created_at" ON "users" ("created_at");
CREATE INDEX "idx_users_verified_subscribed" ON "users" ("verified_email", "is_subscribed");

CREATE TABLE "watchlists" (
  "created_at" TEXT DEFAULT datetime('now'),
  "destination" TEXT NOT NULL,
  "id" TEXT PRIMARY KEY(1),
  "notified_at" TEXT,
  "origin_iata" TEXT NOT NULL,
  "target_price" INTEGER NOT NULL,
  "user_id" TEXT NOT NULL
);

CREATE TABLE "widget_rate_limits" (
  "ip_hash" TEXT PRIMARY KEY(1) NOT NULL,
  "origin" TEXT PRIMARY KEY(2) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 1,
  "window_start" INTEGER NOT NULL
);
CREATE INDEX "idx_widget_rate_limits_window" ON "widget_rate_limits" ("window_start");
