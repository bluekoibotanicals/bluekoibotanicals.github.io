CREATE TABLE past_review_invitations (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, customer_name TEXT NOT NULL,
 source TEXT NOT NULL, purchase_reference TEXT NOT NULL COLLATE NOCASE,
 purchased_on TEXT NOT NULL, products_json TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 revoked_at INTEGER, email_sent INTEGER NOT NULL DEFAULT 0,
 first_attempt_at INTEGER, last_attempt_at INTEGER,
 email_payload TEXT NOT NULL,
 UNIQUE(source,purchase_reference)
);
CREATE TABLE past_reviews (
 id TEXT PRIMARY KEY, invitation_id TEXT NOT NULL REFERENCES past_review_invitations(id),
 slug TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 author TEXT NOT NULL, body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected')),
 moderation_reason TEXT, created_at INTEGER NOT NULL,
 UNIQUE(invitation_id,slug)
);
CREATE VIEW all_product_reviews AS
 SELECT id,slug,rating,author,body,status,moderation_reason,created_at,'website' AS purchase_source FROM reviews
 UNION ALL
 SELECT r.id,r.slug,r.rating,r.author,r.body,r.status,r.moderation_reason,r.created_at,i.source AS purchase_source
 FROM past_reviews r JOIN past_review_invitations i ON i.id=r.invitation_id;
-- Existing codes and their activation choices are preserved.
INSERT OR IGNORE INTO discount_codes(code,kind,value,minimum_subtotal_cents,active,created_at,updated_at)
 VALUES('FREESHIP25','free_shipping',0,2501,1,unixepoch(),unixepoch());
