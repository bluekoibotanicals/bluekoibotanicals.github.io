# Apply the discount-code update

This update preserves the supplied production Square mappings, prices, product photos, Cloudflare database ID, live mode, and launch confirmation. It has not been deployed.

1. Back up your current project folder locally.
2. Extract this ZIP and copy the contents of its project folder into your existing project folder. Replace matching files. Keep your own .dev.vars, local data, and Git history; none is included here.
3. In Square Dashboard → Items & orders → Items, change each 4 fl oz Body Oil variation to **$18.00**: Cedarwood Vanilla, Eucalyptus, Jasmine, and Lavender. The live site uses Square as its checkout price authority, so this keeps the product pages and charged amount aligned.
4. In PowerShell, from your existing project folder, run:

```powershell
npm.cmd test
npm.cmd run build
npx.cmd wrangler d1 migrations apply blue-koi-store --remote
npx.cmd wrangler deploy
```

**Stop if any command fails. Apply the database migration before deploying the new Worker.** The migration adds the discount-code table and preserves existing orders. No new database is needed.

The build automatically uses the Windows Python launcher. Using npm.cmd and npx.cmd avoids PowerShell's script execution-policy error. Dependencies have not changed; use npm.cmd ci only if node_modules is missing.

## What changed

- Delivery is limited to the 50 states and D.C. All foreign shipping is rejected on the server as well as removed from the delivery form. Foreign billing addresses remain available.
- CBD and mixed CBD carts cannot ship to CO, ID, or WY. Non-CBD carts can.
- Every order uses one parcel. Two or more units select the 8 × 6 × 4 inch box with 0.22 lb tare. A single unit retains its configured box. Product weights are summed, box weight is added once, and Shippo weight precision is capped at four decimals.
- Every destination receives 5.3% tax on merchandise, as requested. Separately stated shipping remains untaxed. Square supplies the final tax rounding.
- Checkout accepts server-validated discount codes. Percentage and fixed-dollar codes reduce merchandise before the 5.3% tax; neither reduces shipping.
- All four 4 fl oz body oils are now displayed at $18.00. Update those four Square variations to $18.00 before deployment so checkout charges the same price.
- The former automatic free-shipping offer is now an optional code type. In /admin.html, create `FREESHIP25` as “Free lowest-cost shipping,” with amount `0` and a minimum merchandise subtotal of `25.01`. The code makes only the least-expensive available shipping service free; expedited upgrades retain their price.
- Admin can activate or deactivate codes. A changed or disabled code invalidates an open quote before any payment is submitted.
- Gwyn receives a separate paid-order email at blue.koi.botanicals@gmail.com, with items, totals, address, parcel details, and Square references. Change OWNER_EMAIL in wrangler.jsonc if needed. Customer and owner emails have separate delivery flags and retry independently.
- Payment recovery runs every five minutes and reuses the exact original request, including its idempotency key, for up to 23 hours. It never creates a fresh charge to recover an uncertain result. Older unresolved orders retain stock reservations for review.
- Admin shows email status and recovery notes. Cancel unpaid order checks Square, requires confirmed cancellation, and refuses orders with payments. Paid refunds still happen in Square.
- Page generation reads/writes UTF-8 explicitly, repairing separators, copyright signs, dashes, and other corrupted characters on Windows.
- Cloudflare configuration declares the existing apex domain route and disables workers.dev, avoiding the subdomain-registration prompt.

## Check after deployment

1. Hard refresh the website (Ctrl+F5). Check the footer ©, product separators, and 1–3 days.
2. In /admin.html, confirm live mode, 16/16 mappings, checkout connected, and the owner notification email.
3. Try a CBD cart to CO, ID, and WY: all should be blocked. Try a non-CBD cart to one of those states: it should quote normally.
4. In /admin.html, create a test percentage or fixed code and confirm its discount is shown before tax. Create the optional `FREESHIP25` code above and check that only the lowest-cost shipping service becomes free.
5. Before accepting bulky orders, physically confirm that the chosen products fit the 8 × 6 × 4 box and that the supplied item weights are accurate. This is the requested default carton, not a dimensional packing algorithm. The 12-item order limit remains.
6. With your first authorized transaction, verify one Square payment, the correct inventory decrease, a customer confirmation, and Gwyn's separate notification. Labels are still purchased manually in Shippo.

Cloudflare secrets are not changed by the ZIP. They remain configured in your account. No real charge, shipping label, or email was generated during these tests.

The supplied archive contained .dev.vars and Git history. Those files were not opened and are excluded here. Rotate any real credentials that were included in the original shared archive.
