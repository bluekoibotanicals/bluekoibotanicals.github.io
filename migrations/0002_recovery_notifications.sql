ALTER TABLE orders ADD COLUMN owner_email_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN recovery_checked_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN recovery_note TEXT;
CREATE INDEX IF NOT EXISTS orders_recovery_queue ON orders(status, recovery_checked_at);
