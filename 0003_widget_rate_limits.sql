-- 0003_widget_rate_limits.sql
-- T6 Embeddable Widget Rate Limits
-- Used to prevent abuse of the unauthenticated public JSON endpoint.

CREATE TABLE IF NOT EXISTS widget_rate_limits (
    ip_hash TEXT NOT NULL,
    origin TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start INTEGER NOT NULL, -- Unix timestamp (seconds)
    PRIMARY KEY (ip_hash, origin)
);

-- Index for quick purging of expired windows
CREATE INDEX IF NOT EXISTS idx_widget_rate_limits_window ON widget_rate_limits(window_start);
