-- Combined merchandise discount and lowest-cost shipping, without a minimum.
ALTER TABLE discount_codes ADD COLUMN free_shipping INTEGER NOT NULL DEFAULT 0 CHECK(free_shipping IN (0,1));
INSERT INTO discount_codes(code,kind,value,minimum_subtotal_cents,free_shipping,active,created_at,updated_at)
VALUES('SAVE15FORYOU','percent',1500,0,1,1,unixepoch(),unixepoch())
ON CONFLICT(code) DO UPDATE SET kind='percent',value=1500,minimum_subtotal_cents=0,free_shipping=1,active=1,updated_at=unixepoch();
-- Only new orders explicitly enrolled by the updated checkout are automated.
CREATE TABLE shipping_labels (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','purchasing','waiting','ready','error','uncertain')),
 transaction_id TEXT UNIQUE, label_url TEXT, tracking_number TEXT, note TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, checked_at INTEGER NOT NULL DEFAULT 0,
 ready_email_sent INTEGER NOT NULL DEFAULT 0, issue_email_sent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX shipping_labels_queue ON shipping_labels(status,checked_at);
