-- Same schema the engine creates automatically on first use.
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, username TEXT, profile_image TEXT, sealed TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS pins (
    id TEXT PRIMARY KEY, account_id TEXT, board_id TEXT, board_name TEXT, title TEXT, description TEXT, link TEXT,
    alt_text TEXT, keyword TEXT, template_id TEXT, batch_id TEXT, thumb TEXT, image_url TEXT, design_json TEXT,
    source TEXT, status TEXT NOT NULL DEFAULT 'draft', scheduled_at INTEGER, next_attempt_at INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, posted_at INTEGER, pinterest_pin_id TEXT, locked_at INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pins_due ON pins (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_pins_sched ON pins (scheduled_at);

CREATE TABLE IF NOT EXISTS post_log (id TEXT PRIMARY KEY, pin_id TEXT, at INTEGER NOT NULL, ok INTEGER NOT NULL, message TEXT);
