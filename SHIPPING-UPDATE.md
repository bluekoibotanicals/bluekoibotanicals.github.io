# October 15, 2026 website update

The source and generated pages are updated. This archive has not been deployed to Cloudflare. All payment and postage tests used simulated providers; no live card charge or shipping label was purchased.

## Install on the existing Cloudflare site

Copy the contents into your existing website project. Keep your existing local secrets and Cloudflare account settings. Node.js 22.13+ and Python 3 are required.

Run from the folder containing package.json and wrangler.jsonc. Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run db:remote
npm.cmd run deploy
```

On macOS/Linux, use `npm` instead of `npm.cmd`.

**Apply migration 0005 before deploying the new Worker.** It adds the combined-discount setting and shipping-label queue. The existing database ID is preserved. Existing orders are retained and are not automatically backfilled with labels. The Cloudflare deployment publishes both the generated pages and Worker; uploading only HTML to GitHub Pages will not update checkout or label automation.

The existing Cloudflare `SHIPPO_API_KEY` secret must be a live Shippo key from the account in which you want to purchase and print labels. The existing `SHIP_FROM_JSON` secret must contain your correct sender/return address. Do not put either secret in source files. The existing Square payment and signed-webhook configuration, Resend email settings, and five-minute maintenance schedule continue to be used.

`SHIPPO_AUTO_LABELS` is set to `true` in wrangler.jsonc. Live checkout uses a live Shippo key; the code rejects test keys before buying postage. To pause automatic label purchases, set it to `false` and redeploy. Orders placed while paused use manual label preparation.

## Discount and destinations

- `SAVE15FORYOU` gives 15% off the merchandise subtotal and free lowest-priced available shipping, with no minimum order amount. Faster services retain their quoted price.
- For a $5 item, the discount is $0.75, the existing tax calculation is $0.23, and the total with the free service is $4.48.
- The code is seeded or updated by migration 0005 and can be deactivated/reactivated in the store admin page. Other codes remain unchanged. The separate FREESHIP25 promotion retains its existing rules.
- CBD, non-CBD, and mixed carts accept all 50 states and Washington, D.C. International addresses and territories remain excluded. Checkout and product/policy text agree.

## Automatic Shippo labels

1. The customer chooses a real Shippo service and completes payment through Square.
2. Only a confirmed, paid new order triggers a label purchase. A quote, abandoned cart, failed card, or unresolved payment cannot buy postage.
3. The Worker buys the selected rate from Shippo and requests a print-ready `PDF_4x6` label. The business pays for postage even when shipping is free to the customer.
4. Gwyn receives the normal paid-order notification and a separate label-ready email with the PDF link and tracking number. Labels are available in the Shippo account; look under Shipments, not only the unfulfilled Orders list. The API transaction carries the reference `blue-koi-order:<website order ID>`.
5. `/admin.html` shows each order's label status, tracking number, and **Print 4 × 6 label** button. **Check Shippo label** retrieves pending results; for ready labels it refreshes the PDF link without buying another label.
6. Check the packed parcel against its configured weight and dimensions. Print at actual size / 100%. Enter tracking and mark fulfilled in Square when handed to the carrier. Creating a label does not mark the order shipped or start the post-fulfillment review timer.

The existing package rule remains: one configured box per order, an 8 × 6 × 4 inch box for multiple items, product weights plus one box tare. This is not a packing optimizer. If the actual parcel differs, correct the shipment in Shippo before using the label; follow Shippo's replacement/refund process when required.

## Exceptions and duplicate protection

A database claim allows only one purchase attempt per order, even if checkout, customer polling, webhooks, and scheduled tasks overlap. Queued transactions are checked every five minutes. A lost response is recovered by locating the original transaction, rather than buying another label. Known labels can be refreshed by their transaction ID.

If Shippo returns an error or the purchase outcome is uncertain, the payment stays paid, the owner receives an alert, and the admin page shows the issue. **Check Shippo label** is safe: it checks for an existing purchase and does not repeat an uncertain purchase. If no usable label exists, handle that order manually in Shippo after checking for duplicates. A carrier or account error can require correcting the Shippo account or shipment before buying a replacement. The system never silently substitutes a different carrier or service.

No historical orders are automatically labeled. Fully or partially refunded orders and orders already marked fulfilled are not newly labeled. A refund after postage purchase does not automatically refund that postage; review unused labels in Shippo.

## Market calendar

All appearances are 9 a.m.–1 p.m. Eastern:

- IX Art Park: October 17, 24, 31, and November 21.
- November 7 and 14: not attending, preserving the uploaded calendar's absences.
- Charlottesville Holiday Market: November 28 and December 5, 12, and 19.
- Farmers in the Park removed from the homepage schedule and calendar.

The current schedule is in `content/markets.json`; rebuild after editing it. The holiday start date and IX fall hours were checked against the official market pages:

- https://www.charlottesville.gov/619/Charlottesville-Farmers-Markets
- https://www.ixartpark.org/farmers-market

## Verification

Automated tests cover discount math, tax/order totals, all 50 state codes and D.C., formerly blocked CBD destinations, concurrency, successful labels, lost responses, queued labels, provider errors, declined/unresolved/recovered payments, key-mode checks, historical/refunded/fulfilled orders, owner notifications, and admin access. The site build regenerates 40 pages.

Tests use isolated SQLite and simulated Square, Shippo, and email responses. They do not verify live Shippo billing, carrier-account eligibility, your actual return address, printer settings, or Cloudflare deployment. Existing browser checks are updated for the new calendar and CBD copy; Chromium is not installed in the editing environment, so browser checks were not run here.

After deployment, check the first actual paid order in both Square and Shippo, confirm exactly one label, and verify its physical parcel details before printing.

API references:
- https://docs.goshippo.com/shippoapi/public-api/transactions/createtransaction
- https://docs.goshippo.com/api-reference/transactions/list-all-shipping-labels
- https://support.goshippo.com/hc/en-us/articles/6822822524827-Managing-your-Shipments-in-Shippo
