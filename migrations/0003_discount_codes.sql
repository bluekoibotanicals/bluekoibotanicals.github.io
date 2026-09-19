CREATE TABLE IF NOT EXISTS discount_codes (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('fixed','percent','free_shipping')),
  value INTEGER NOT NULL CHECK(value >= 0),
  minimum_subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK(minimum_subtotal_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS discount_codes_active ON discount_codes(active, code);
