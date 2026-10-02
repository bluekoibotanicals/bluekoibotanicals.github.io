# CBD Roll-On and product copy update — October 2, 2026

## What changed

- Added CBD Roll-On: $26, 10 mL, 1,000 mg CBD, with the approved studio photograph.
- Added its product page, collection page, homepage feature, collection navigation, cart image, and related CBD products.
- Uses the owner's measured 40.0 g weight for the filled, capped bottle. The existing shipping box weight is added separately.
- Expanded every existing product description, including the 4 oz body butter catalog entries. Added three concise highlights and a fuller “A closer look” paragraph to each product page.
- Collection cards now show descriptions. Refreshed collection introductions and homepage copy.
- Preserved all existing product prices, ingredients, stock snapshots, sizes, Square mappings, weights, checkout promotions, and market dates.
- The existing build command regenerates the new content; these are source changes as well as generated HTML updates.

## Apply the update

1. Back up your current website folder.
2. Extract this ZIP and copy the contents of its `bluekoibotanicals.github.io` folder into your existing project folder, replacing matching files. Merge the folders; do not delete your original project first.
3. Keep your existing `.dev.vars`, environment files, `.git` directory, and Cloudflare secrets. They are not included in this ZIP.
4. From the project folder in Windows PowerShell:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd test
npm.cmd run dev
```

Open the local URL shown by the development server. Press Ctrl+C when finished. To deploy through your existing Cloudflare setup:

```powershell
npm.cmd run deploy
```

This update has not been deployed to the live website. No new database migration or secret is required.

## Square connection

The roll-on is configured to resolve the existing Square item named **CBD Roll-On**. It requires one unambiguous variation, inventory tracking, availability at your configured location, and a positive USD price. Square remains authoritative for live price and stock: confirm that its price is $26 and its available quantity is correct.

If that item has several variations, set `square_variation_name` to the intended variation's exact name on the `cbd-roll-on` entry in `content/products.json`. The site deliberately leaves the product unavailable when no unique match exists. It never substitutes another item.

The local/offline roll-on stock snapshot is zero because no stock quantity was supplied. An offline preview may therefore show “Sold out”; live availability comes from Square after deployment. Do not interpret that preview as a Square inventory check.

The roll-on has `cbd: true`, so the existing U.S.-only and Colorado/Idaho/Wyoming exclusions also apply to this product. A single bottle ships at 0.1882 lb with the existing small-box allowance; mixed orders add each item's weight and one combined box as before.

## Content notes

Copy emphasizes scent, texture, skin conditioning, and everyday use. It does not add pain-relief, sleep-treatment, or other medical promises. Existing safety directions remain available.

The supplied catalog has no ingredient list for Eucalyptus Whipped Body Butter. Its expanded copy does not invent one; the page retains the invitation to contact you for the full formula. Add the verified list to both size entries when available.

The existing salve lab-report links are preserved. No unverified finished-product lab-report claim or link was added to the roll-on page.

## Validation

- Static site build completed: 40 HTML pages.
- All six Node test files pass, including roll-on price, weight, live Square mapping, stock, shipping exclusions, ambiguous/missing mapping, and simulated purchase coverage.
- Existing browser checks pass for desktop/mobile layouts, body butter sizes, cart, simulated checkout, promotion codes, and review workflows.
- Roll-on browser checks pass for homepage discovery, catalog listings, image loading, ingredients, $26 pricing, add-to-bag, and mobile overflow.
- Generated local links and image paths checked; no broken references.
- Existing product data compared with the uploaded catalog; only descriptions, body copy, and highlights changed.

Browser checks use simulated provider responses. No real payment, email, inventory change, or live Square verification was performed.

To rerun browser checks locally, install the browser once with `npx.cmd playwright install chromium`, then run `npm.cmd run test:browser` and `npm.cmd run test:roll-on-browser`.

The ZIP excludes dependencies, Git history, local databases, caches, test screenshots, credentials, and the generated `dist` folder. `npm.cmd run build` recreates `dist`.
