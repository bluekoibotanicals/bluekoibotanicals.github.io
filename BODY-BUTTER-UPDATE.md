# Body butter size update

Each of the five scents has one product page with 8 oz and 4 oz **jar-capacity** options. The 8 oz jar is selected by default. The selected photo, price, availability, and shopping-bag item change together. The upgrade message is “Double the butter for $8 more” at the current $28/$20 prices; if Square prices change, the difference updates automatically.

The corrected small-jar studio photographs use the trimmed side labels and lid stickers. Large jars retain their existing studio images, with the new individual Eucalyptus image. The collection image includes all five scents. Capacity is not described as net product weight.

## Install

Copy this ZIP's contents over the existing repository, preserving your local `.dev.vars` and existing Cloudflare secrets. Commit and push the changes. If your Git push does not automatically deploy your Cloudflare Worker, run your existing deployment workflow (`npm install`, then `npm run deploy`; on Windows, `npm.cmd`). Updating static GitHub Pages alone does not deploy the Square integration in `server/`.

No new database migration or Square catalog write is required for this size update. Keep the existing database and the existing migrations from earlier updates.

## Square

Body butter variation IDs are resolved from the active Square account by the exact parent item name and size variation name below. The removed standalone 4 oz Jasmine ID is never reused. Missing or ambiguous names make that size unavailable instead of selecting another variation. A complete catalog lookup is cached for up to one minute; prices and availability are fetched when the catalog is requested and checked again during checkout.

| Parent Square item | 8 oz variation | 4 oz variation |
| --- | --- | --- |
| Cedarwood Vanilla Whipped Body Butter | 8oz Cedarwood Vanilla Whipped Body Butter | 4oz Cedarwood Vanilla Whipped Body Butter |
| Eucalyptus Whipped Body Butter | 8oz Eucalyptus Body Butter | 4oz Eucalyptus Body Butter |
| Jasmine Whipped Body Butter | 8oz Jasmine Whipped Body Butter | 4oz Jasmine Whipped Body Butter |
| Lavender Whipped Body Butter | 8oz Lavender Whipped Body Butter | 4oz Lavender Whipped Body Butter |
| Unscented Whipped Body Butter | 8oz Unscented Whipped Body Butter | 4oz Unscented Whipped Body Butter |

Tracked sizes use their inventory counts. For body butters without numeric inventory tracking, Square's manually set Available/Sold out status is respected, with the existing 12-item website order limit. The override behavior follows [Square's sold-out guidance](https://developer.squareup.com/docs/inventory-api/monitor-sold-out-status-on-item-variation). Each size is independent.

Production mappings for all other products are retained. The supplied local development setup points to a sandbox with the old body butter catalog; it cannot verify the new production names. Use preview mode for local visual review or create the corresponding variations in a separate Square sandbox. After deployment, check the two sizes' prices and availability against your production Square dashboard. No production purchases, charges, emails, inventory edits, or deployments were performed for this update.

## Shipping

A single 4 oz jar ships at **0.5925 lb**: 0.3725 lb for the jar/product plus the existing 0.22 lb large box. All five scents use this calculation. The 8 oz jar retains 0.6825 lb plus its 0.22 lb box (0.9025 lb packed). Mixed orders add the individual jar weights and one shared box, avoiding duplicated box weight.

The old small Jasmine URL redirects to the shared Jasmine page with 4 oz selected. Existing small Jasmine cart entries retain the same internal slug, now mapped to the new Square variation. Both sizes share the scent page's published reviews.

The Eucalyptus listing retains the source catalog's missing ingredient-list disclosure; no unverified ingredient list has been invented.
