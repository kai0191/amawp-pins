-- Tackly by AMAWP: initial schema
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  max_accounts INTEGER NOT NULL DEFAULT 1,
  ai_pins INTEGER NOT NULL DEFAULT 0,
  premium_templates INTEGER NOT NULL DEFAULT 0,
  bulk_max INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO plans (id, name, price_cents, max_accounts, ai_pins, premium_templates, bulk_max, active) VALUES
  ('free', 'Free', 0, 1, 0, 0, 100, 1),
  ('pro', 'Pro', 900, 5, 1, 1, 500, 0),
  ('agency', 'Agency', 2900, 25, 1, 1, 2000, 0);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  plan_id TEXT NOT NULL DEFAULT 'free',
  settings TEXT NOT NULL DEFAULT '{}',
  ai_settings_enc TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS pinterest_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pinterest_user_id TEXT NOT NULL,
  username TEXT,
  profile_image TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  access_expires_at INTEGER,
  refresh_expires_at INTEGER,
  scopes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, pinterest_user_id)
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON pinterest_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_pinterest ON pinterest_accounts (pinterest_user_id);

CREATE TABLE IF NOT EXISTS pins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT,
  board_id TEXT,
  board_name TEXT,
  title TEXT,
  description TEXT,
  link TEXT,
  alt_text TEXT,
  template_id TEXT,
  batch_id TEXT,
  thumb TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at INTEGER,
  next_attempt_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  posted_at INTEGER,
  pinterest_pin_id TEXT,
  locked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pins_due ON pins (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_pins_user ON pins (user_id, scheduled_at);

CREATE TABLE IF NOT EXISTS post_log (
  id TEXT PRIMARY KEY,
  pin_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  message TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_user ON post_log (user_id, at);

CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  feature TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
