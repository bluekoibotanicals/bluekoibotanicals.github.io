PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS quotes (
 id TEXT PRIMARY KEY, session_hash TEXT NOT NULL, fingerprint TEXT NOT NULL,
 data TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS quotes_fingerprint ON quotes(session_hash, fingerprint, expires_at);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, quote_id TEXT NOT NULL UNIQUE, session_hash TEXT NOT NULL,
 status TEXT NOT NULL, data TEXT NOT NULL, square_order_id TEXT UNIQUE,
 payment_id TEXT UNIQUE, payment_request TEXT, payment_attempted INTEGER NOT NULL DEFAULT 0, error_code TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, fulfilled_at INTEGER,
 email_sent INTEGER NOT NULL DEFAULT 0, review_sent INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reservations (
 order_id TEXT NOT NULL REFERENCES orders(id), slug TEXT NOT NULL, quantity INTEGER NOT NULL,
 PRIMARY KEY(order_id, slug)
);
CREATE TABLE IF NOT EXISTS reviews (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), slug TEXT NOT NULL,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), author TEXT NOT NULL, body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')),
 moderation_reason TEXT, created_at INTEGER NOT NULL, UNIQUE(order_id,slug)
);
CREATE TABLE IF NOT EXISTS review_tokens (
 token_hash TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
