# Blue Koi: EPD checkout update
Prepared November 19, 2026.

## What this package does

This is an UPDATE OVERLAY for the website ZIP you supplied. Copy its files into your existing project, keeping all other images, COAs, content, and files. It is not a complete standalone website.

The new checkout uses EPD's provisioned NMI Classic Payment API with Collect.js hosted card fields. Kurv remains your processor. The Kurv developer app and its keys are not part of this integration.

- Replaces the customer-facing Square card form and new payment flow with EPD.
- Maps all 20 active products to the SKU and prices in your EPD screenshot.
- Retains Shippo shipping quotes, discount codes, existing tax calculation, Resend receipts, reviews, and historical Square order records.
- Adds website stock controls and a Mark shipped action to admin.html.
- Removes the expired November 19 shipping notice and restores cart navigation.
- Keeps live checkout locked until credentials, inventory, and explicit launch settings are ready.

No keys, Cloudflare deployment, live gateway request, real payment, or paid postage purchase was performed while preparing this update.

## 1. Install the files

Back up your current project folder and preserve any uncommitted work first. Extract this ZIP to a temporary folder, then copy its CONTENTS over the matching files in your existing bluekoibotanicals.github.io folder. Do not replace your entire project folder with this overlay.

The changed-file list is UPDATE-FILES.txt. Files are relative to the project root. Do not copy an extra nested folder into the project.

In PowerShell, open a terminal in that project folder. You need Node 22.13 or newer and Python 3, as required by your existing project.

~~~powershell
npm.cmd install
npm.cmd run build
npm.cmd test
~~~

The .cmd spelling avoids PowerShell's npm.ps1 execution-policy issue without changing the computer's policy.

## 2. Which key goes where

| Setting | Value / source |
| --- | --- |
| PAYMENT_PROVIDER | epd |
| EPD_GATEWAY_ORIGIN for live | https://secure.easypaydirectgateway.com |
| EPD_PRIVATE_API_KEY | Full PRIVATE Key1-INTEGRATION value belonging to BlueKoiINTEGRATIONS, API permission |
| EPD_PUBLIC_TOKENIZATION_KEY | Full PUBLIC Key2-INTEGRATION value with Tokenization permission |
| SITE_URL for live | https://bluekoibotanicals.com |
| STORE_MODE for live | live |

Copy each full key using EPD's copy control; the key ID and display name are not the key. Keep the private key in Cloudflare secrets or your ignored local .dev.vars, never Git, HTML, screenshots, or chat. The public tokenization key is designed for the card form.

Do not use the ADMIN user's Key for API Access. Do not use the Collect Checkout key: this implementation uses Collect.js Tokenization, not Collect Checkout.

The /merchants/options.php address is your administrative dashboard. It is not a payment endpoint. Code derives these URLs from EPD_GATEWAY_ORIGIN:

- /token/Collect.js — hosted card-field script
- /api/transact.php — server-side payment requests
- /api/query.php — server-side transaction verification

Do not paste an API path or trailing slash into EPD_GATEWAY_ORIGIN. No Kurv webhook URL or new EPD webhook secret is needed for this implementation. Recovery uses EPD transaction queries and the existing five-minute Cloudflare cron.

## 3. Test locally using a separate sandbox

Ask Alec for EPD-compatible NMI sandbox credentials for https://sandbox.nmi.com and confirmation that Collect.js and the Classic Payment/Query APIs are enabled. Your production integration keys are not sandbox keys.

Copy .dev.vars.example to .dev.vars, replacing the old Square configuration. Use a separate sandbox account:

~~~dotenv
STORE_MODE=sandbox
PAYMENT_PROVIDER=epd
SITE_URL=http://localhost:8787
EPD_GATEWAY_ORIGIN=https://sandbox.nmi.com
EPD_PRIVATE_API_KEY=YOUR_SANDBOX_PRIVATE_KEY
EPD_PUBLIC_TOKENIZATION_KEY=YOUR_SANDBOX_TOKENIZATION_KEY
EPD_TEST_ACCOUNT_CONFIRMED=true
EPD_LIVE_ACCOUNT_CONFIRMED=false
INVENTORY_CONFIRMED=false
LIVE_LAUNCH_CONFIRMED=false
SHIPPO_API_KEY=YOUR_SHIPPO_TEST_KEY
SHIPPO_AUTO_LABELS=false
RESEND_API_KEY=
EMAIL_FROM=Blue Koi Botanicals <orders@bluekoibotanicals.com>
OWNER_EMAIL=blue.koi.botanicals@gmail.com
ADMIN_TOKEN=YOUR_RANDOM_ADMIN_TOKEN_AT_LEAST_32_CHARACTERS
~~~

Also retain SHIP_FROM_JSON and CUSTOMS_SIGNER from the supplied example, checking the return address. Do not literally use the placeholder strings above as credentials.

~~~powershell
npm.cmd run build
npm.cmd run dev
~~~

Open http://localhost:8787/admin.html, enter the local ADMIN_TOKEN, and set a few test stock quantities. Local migrations run automatically. Open the storefront and test the complete flow with the sandbox card details provided by EPD/NMI. Sandbox mode refuses to send credentials to the production hostname.

Confirm correct product/size, shipping service, discount, total, card acceptance and decline, order confirmation, and stock decrement. Reload after a payment to confirm that the same order appears without a second charge. Sandbox order confirmations are explicitly labeled as tests; no customer emails or automatic postage are sent.

Local .dev.vars is not deployed by Wrangler. Production settings are configured separately below.

## 4. Configure Cloudflare, initially with checkout closed

The supplied wrangler.jsonc retains your existing Worker routes and D1 database identity. Review those against your Cloudflare account before deployment. It includes:

~~~json
"STORE_MODE": "live",
"SITE_URL": "https://bluekoibotanicals.com",
"PAYMENT_PROVIDER": "epd",
"EPD_GATEWAY_ORIGIN": "https://secure.easypaydirectgateway.com",
"EPD_PUBLIC_TOKENIZATION_KEY": "",
"EPD_LIVE_ACCOUNT_CONFIRMED": "false",
"INVENTORY_CONFIRMED": "false",
"LIVE_LAUNCH_CONFIRMED": "false",
"SHIPPO_AUTO_LABELS": "false"
~~~

Replace only the empty EPD_PUBLIC_TOKENIZATION_KEY with your full production Key2-INTEGRATION tokenization key. This is a public key, not the private key.

If you already configured EPD_PUBLIC_TOKENIZATION_KEY as a Cloudflare secret, remove that property from wrangler.jsonc instead of defining the same name as both a variable and secret.

Authenticate Wrangler if necessary, then set the production private key through the interactive secret prompt:

~~~powershell
npx.cmd wrangler login
npx.cmd wrangler secret put EPD_PRIVATE_API_KEY
~~~

Paste the production private Key1-INTEGRATION value when prompted. Existing Cloudflare secrets can stay in place. Confirm these are present and valid; only run the corresponding secret command if a value is missing or needs updating:

~~~powershell
npx.cmd wrangler secret put SHIPPO_API_KEY
npx.cmd wrangler secret put SHIP_FROM_JSON
npx.cmd wrangler secret put RESEND_API_KEY
npx.cmd wrangler secret put ADMIN_TOKEN
~~~

SHIPPO_API_KEY must be the live key for production. SHIP_FROM_JSON is your shipping-origin JSON, not an API key. ADMIN_TOKEN must be a random secret of at least 32 characters; reuse your existing valid admin token if available. EMAIL_FROM/OWNER_EMAIL are in wrangler.jsonc; the Resend sending domain must be verified.

Back up D1 before applying the migration; keep this export private because it contains customer records:

~~~powershell
npx.cmd wrangler d1 export blue-koi-store --remote --output=../blue-koi-before-epd.sql
npm.cmd run db:remote
npm.cmd run deploy
~~~

The migration adds provider information to orders and a new website_inventory table. It does not delete historical orders or reviews. Leave all three production confirmation flags false for this first deployment. Checkout remains closed while you populate inventory. The static pages display the new prices and cart links after deployment.

## 5. Enter real website stock

Open https://bluekoibotanicals.com/admin.html and sign in with ADMIN_TOKEN. Use Website inventory to enter the number of units allocated to ONLINE orders, saving one product at a time.

All initial quantities are ZERO intentionally: your EPD screenshot shows SKU and price, but not physical stock counts. Setting INVENTORY_CONFIRMED=true does not populate quantities.

Inventory ownership in this implementation:

| Data | Authority |
| --- | --- |
| Product descriptions, photos, sizes, prices, EPD SKU mapping | content/products.json in your website project |
| Units available to website customers | Cloudflare D1 website_inventory, managed in admin.html |
| Website orders, delivery details, discounts, reviews | Website D1 database |
| Card transactions and gateway reporting | EPD |
| Processor statements, settlement and payouts | Kurv |

The uploaded EPD product list is mapped, but it is NOT automatically synchronized. A successful website sale decrements website stock once. Changing a product price or quantity in EPD will not update the website. The payment order description includes product/SKU references; this is not an EPD product-cart inventory integration.

If you sell the same physical stock at farmers markets, reserve separate quantities for online sales or update the website's remaining quantity after market sales. Do not count the same units as available in both places. This update does not install or configure a market POS app or card reader; Alec must confirm compatible hardware/app and account provisioning.

Refunds and voids do not automatically restock products. Restore saleable returned units manually. Stock edits reject stale values and values below quantities held by pending payments.

## 6. Open live checkout and verify it

Before launch, confirm with Alec that the production gateway is approved and enabled for your website, Collect.js Tokenization and Classic Payment/Query API access work, and the production gateway's own Test Mode is OFF. Setting STORE_MODE=live in your website does not turn off Test Mode in EPD.

After sandbox testing and stock entry, set these three wrangler.jsonc values to the string "true":

~~~json
"EPD_LIVE_ACCOUNT_CONFIRMED": "true",
"INVENTORY_CONFIRMED": "true",
"LIVE_LAUNCH_CONFIRMED": "true"
~~~

Keep SHIPPO_AUTO_LABELS=false for the first live check so a test order does not automatically buy postage. Deploy:

~~~powershell
npm.cmd run deploy
~~~

This deployment opens real checkout to customers. Immediately make a small real purchase yourself and verify:

1. The correct amount and order ID appear in EPD, and the transaction is live.
2. Website status is paid, both order emails arrive, and stock decreases once.
3. The selected shipping option, delivery details, discount and current tax calculation are correct.
4. Use EPD to void/refund your test purchase as appropriate; use Check payment status in website admin to synchronize its status. Manually restore its stock if no goods shipped.
5. Verify the payment/settlement in Kurv as applicable to its reporting schedule.

The existing website tax policy is preserved: 5.3% on discounted merchandise for accepted U.S. destinations, excluding shipping. This migration does not validate or expand tax compliance. Review your existing policy before launch if it needs adjustment.

If any check fails, set LIVE_LAUNCH_CONFIRMED back to "false" and deploy again. Do not switch the new checkout back to Square as an emergency fallback. Historical Square records remain, but the new browser checkout is EPD-only.

Once a genuine order's Shippo service, package settings and label purchase have been verified, you may set SHIPPO_AUTO_LABELS="true" and deploy to enable automatic postage purchases for future paid live orders. Otherwise prepare labels manually and enter tracking with Mark shipped once handed to the carrier.

## 7. Day-to-day operations and uncertain payments

Use the website admin page for orders, stock, discounts, reviews and fulfillment; EPD for payment/refund operations; Kurv for processor reporting. Full customer delivery and parcel details remain in website admin and the owner order email.

After an EPD refund/void, click Check payment status in website admin. Scheduled reconciliation checks pending and unfulfilled orders; do not rely on it to detect every later refund of a fulfilled order.

If an order says processing, do not manually charge again. The gateway's orderid is a reference, not an idempotency guarantee. This implementation sends the original sale once and subsequently only queries it. Pending orders hold their stock and block another checkout in the same customer session.

Search EPD by the website order ID and use Check payment status. An absent transaction or timeout is not treated as proof of failure. If EPD cannot establish a definitive result, resolve it with Alec before any refund, replacement charge, or manual database release. The website deliberately has no blind Cancel unpaid action for attempted EPD payments.

Older Square keys can be retained in Cloudflare only if you still need to reconcile historical Square orders/webhooks. They do not power the new checkout. Do not delete your historical data.

## Validation performed

- 78 automated tests passed, including EPD approval/decline, duplicate submissions, concurrent stock use, uncertain responses, reconciliation, refund handling, authorization, and environment isolation.
- Static build completed for 44 pages.
- Checkout preview inspected in the browser with readiness gates closed.
- Actual production EPD Collect.js source checked for callback configuration.
- No authenticated sandbox or live payment/settlement tested: those require your credentials and account configuration.
- No EPD/POS inventory synchronization implemented.

## Technical references

- NMI advanced Collect.js integration: https://docs.nmi.com/docs/advanced-integrations
- NMI Classic transaction processing: https://docs.nmi.com/reference/transactions-processing
- NMI Classic Query API: https://docs.nmi.com/reference/query
- NMI key permissions: https://support.nmi.com/hc/en-gb/articles/360002575497-Security-Keys-Private-and-Public-Keys
