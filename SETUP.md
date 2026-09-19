# Configuration and operations

## Production update
Follow UPDATE.md. Do not create a new database or rerun catalog mapping merely to install this update. Production variation IDs, photos, prices, database ID, live mode, and launch confirmation are preserved.

Non-secret wrangler.jsonc variables: STORE_MODE, SITE_URL, SQUARE_ENVIRONMENT, SQUARE_API_VERSION, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID, EMAIL_FROM, OWNER_EMAIL, LIVE_LAUNCH_CONFIRMED, SQUARE_WEBHOOK_URL.

Cloudflare secrets: SQUARE_ACCESS_TOKEN, SHIPPO_API_KEY, SQUARE_WEBHOOK_SIGNATURE_KEY, RESEND_API_KEY, ADMIN_TOKEN, SHIP_FROM_JSON. Use npx.cmd wrangler secret put NAME to change one. Local development reads .dev.vars instead. Keep secrets out of Git and ZIP files; Git ignore rules alone do not exclude files from archives.

## Shipping, tax, and promotion
- U.S. delivery only: all 50 states and D.C. No territories, military state codes, or international delivery.
- Any CBD item blocks CO, ID, and WY, including mixed carts. Non-CBD orders may ship there. Checks happen during quoting and checkout.
- One parcel per order. Multiple units use the large 8 × 6 × 4 inch box with 0.22 lb tare. Single units retain their configured box. Add product weights and one box tare; Shippo receives at most four decimals.
- Verify physical fit and actual packed weight. This is a default carton rule, not a dimensional packing solver. The maximum remains 12 items.
- Every destination receives 5.3% merchandise tax, as requested. Square supplies final penny rounding. Separately stated shipping is untaxed. This is a fixed setting, not an automated jurisdiction or filing service.
- Free shipping applies strictly above $25 merchandise subtotal before tax. Only the cheapest available service is free; faster upgrades retain their full quoted shipping price.
- The first-50-orders banner has no counter or automatic expiration. Set free_shipping.enabled=false in content/store.json, rebuild, and deploy to end it. Banner and discount turn off together. Changed tax/promotion policies invalidate old open quotes.
- Quotes expire after 15 minutes and still require actual Shippo rates, even when free to the customer. No fallback shipping rates are fabricated. The original postage quote is retained in the order; the business pays for the label.

## Notifications and fulfillment
EMAIL_FROM must use a verified Resend sender. OWNER_EMAIL is Gwyn's separate notification address, currently blue.koi.botanicals@gmail.com. Customer confirmations and owner notifications have independent persistent sent flags and retry keys. Admin shows each status. Failed or unpaid orders do not send paid-order notifications.

Gwyn's message includes items, totals, contact/address, parcel details, Square references, and the admin link. Labels remain manual in Shippo. Enter tracking and mark fulfillment complete in Square. Maintenance runs every five minutes. Review invitations become eligible 10 days after fulfillment is observed; review links last 90 days.

Square webhooks: payment.updated, order.updated, order.fulfillment.updated, refund.updated. Use the exact SQUARE_WEBHOOK_URL and that subscription's production signature key. Refunds happen in Square. Reviews require a purchase token and moderation.

## Payment recovery
Processing orders retain stock reservations. Reconciliation checks the original Square order. From two minutes until 23 hours after creation, recovery may replay only the exact original request, including the idempotency key. Stored payment requests are removed after 24 hours. Recovery never invents a fresh charge.

Older uncertain payments remain pending for manual review. Admin's Cancel unpaid order checks Square, requires confirmed cancellation with no payment, and only then releases stock. Paid or unverifiable orders are refused. Never delete pending records simply to charge again.

Square provides current prices and tracked inventory. Unmapped/untracked variations are unavailable. Local reservations protect concurrent website orders; simultaneous POS activity still needs monitoring.

## Local checks
npm.cmd run build selects the Windows Python launcher or python3 on other platforms and writes UTF-8 explicitly. npm.cmd run dev serves http://localhost:8787 and defaults to preview mode without .dev.vars.

npm.cmd test uses isolated SQLite and simulated providers, with no real charges, label purchases, or emails. Optional browser checks:
```powershell
npx.cmd playwright install chromium
npm.cmd run test:browser
```

Use a separate project copy/database with sandbox IDs for sandbox testing; production variation IDs cannot be used with a sandbox account.

Before the first authorized live transaction, check the real card form, production credentials, inventory tracking, shipping options, state restrictions, tax/promotion totals, verified email sender, and webhook delivery. Verify exactly one payment, correct stock reduction, and separate customer/Gwyn messages afterward.
