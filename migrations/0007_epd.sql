-- Historical orders remain Square; new orders explicitly select their provider.
ALTER TABLE orders ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'square';
ALTER TABLE orders ADD COLUMN payment_environment TEXT;
ALTER TABLE orders ADD COLUMN inventory_committed INTEGER NOT NULL DEFAULT 0;
CREATE TABLE website_inventory (
 slug TEXT PRIMARY KEY, quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity>=0),
 version INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO website_inventory(slug,quantity) VALUES('lavender-whipped-body-butter',0);
INSERT INTO website_inventory(slug,quantity) VALUES('unscented-whipped-body-butter',0);
INSERT INTO website_inventory(slug,quantity) VALUES('lavender-spearmint-lip-balm',0);
INSERT INTO website_inventory(slug,quantity) VALUES('eucalyptus-body-oil',0);
INSERT INTO website_inventory(slug,quantity) VALUES('eucalyptus-whipped-body-butter',0);
INSERT INTO website_inventory(slug,quantity) VALUES('lavender-whipped-body-butter-4oz',0);
INSERT INTO website_inventory(slug,quantity) VALUES('jasmine-whipped-body-butter-4oz',0);
INSERT INTO website_inventory(slug,quantity) VALUES('cbd-roll-on',0);
INSERT INTO website_inventory(slug,quantity) VALUES('jasmine-body-oil',0);
INSERT INTO website_inventory(slug,quantity) VALUES('cedarwood-vanilla-whipped-body-butter',0);
INSERT INTO website_inventory(slug,quantity) VALUES('honey-lavender-lip-balm',0);
INSERT INTO website_inventory(slug,quantity) VALUES('cbd-salve',0);
INSERT INTO website_inventory(slug,quantity) VALUES('eucalyptus-whipped-body-butter-4oz',0);
INSERT INTO website_inventory(slug,quantity) VALUES('rose-magnesium-spray',0);
INSERT INTO website_inventory(slug,quantity) VALUES('cedarwood-vanilla-body-oil',0);
INSERT INTO website_inventory(slug,quantity) VALUES('unscented-whipped-body-butter-4oz',0);
INSERT INTO website_inventory(slug,quantity) VALUES('cedarwood-vanilla-whipped-body-butter-4oz',0);
INSERT INTO website_inventory(slug,quantity) VALUES('lavender-body-oil',0);
INSERT INTO website_inventory(slug,quantity) VALUES('jasmine-whipped-body-butter',0);
INSERT INTO website_inventory(slug,quantity) VALUES('lavender-magnesium-spray',0);
