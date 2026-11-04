-- Tackly relay (AMAWP's Cloudflare): stores NO user content.
-- Only anonymous safety counters: a salted hash of the Pinterest account id + post timestamps
-- (to enforce the 10 pins / 24 h limit), per-IP rate-limit windows, and daily aggregate totals.

CREATE TABLE IF NOT EXISTS post_quota (
  id TEXT PRIMARY KEY,
  acct TEXT NOT NULL,          -- sha256(salt + pinterest user id), not reversible
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quota_acct ON post_quota (acct, at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric)
);
