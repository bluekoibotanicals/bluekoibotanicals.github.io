# Blue Koi: past-customer reviews and market calendar update

This is an incremental update for the discount-code version you already deployed. It has not been deployed to Cloudflare and has not sent any real invitations.

## Install

1. Make a local backup of your existing project folder.
2. Extract the ZIP. Open its `Blue-Koi-Reviews-and-Markets-Update` folder, then copy **the contents** into your existing `bluekoibotanicals.github.io` project folder. Replace matching files and merge matching folders. **Do not delete your existing project.**
3. Your `.dev.vars`, `wrangler.jsonc`, product catalog/mappings, photos, dependencies, Git history, and existing database stay in place. This ZIP does not contain credentials or a replacement Cloudflare configuration.
4. From your existing project folder, run these PowerShell commands one at a time:

```powershell
npm.cmd test
npm.cmd run build
npx.cmd wrangler d1 migrations apply blue-koi-store --remote
npx.cmd wrangler deploy
```

Stop if a command fails. Answer **yes** to applying `0004_past_customer_reviews.sql`. Apply the migration before deploying. Do not create a new database or rerun Square catalog mapping.

The migration adds separate invitation/review tables and a combined review view. It preserves existing orders, website reviews, and review links. It creates `FREESHIP25` only if that code does not already exist; an existing code's settings and activation choice are preserved. Dependencies have not changed.

## Invite a past customer

Open https://bluekoibotanicals.com/admin.html and sign in with your existing store access key.

1. Find **Invite past customers**.
2. Enter their name and email.
3. Select the source: Square/POS, market/cash, Etsy, or another prior purchase.
4. Enter the purchase date and receipt number. For a cash sale without a receipt number, use a unique reference from your own sales records, such as `MARKET-2026-09-19-003`.
5. Select only the products they purchased and check the purchase-verification box after confirming the sale.
6. Click **Send review invitation**. This sends a real email through your existing Resend setup immediately; it does not wait for the normal post-fulfillment delay.

The invitation creates no sale, charge, inventory adjustment, or shipping request. Invite customers regardless of whether you expect positive or negative feedback. The same source/reference cannot be invited twice. The invitation list shows the latest 100 invitations.

Each private link lasts 90 days and permits one review per selected product. Customer contact details and purchase references remain private. Submitted reviews appear under **Customer reviews** and require publication by an administrator. The moderation list identifies the purchase source.

Use **Copy review link** to share the existing link privately with that customer. **Revoke invitation** blocks further use but leaves submitted reviews available for moderation. An expired/revoked invitation cannot be reused.

Failed email deliveries retry on the existing five-minute schedule, using the same email and deduplication key. Retries stop after 23 hours to avoid duplicate sends after the provider's deduplication window. If a status says to check Resend, inspect its email log; use the existing private link rather than creating a duplicate purchase reference.

## FREESHIP25 banner

The checkout banner advertises: **Free shipping for the first 50 customers on orders over $25.** The **Use FREESHIP25** button fills the code field; the customer then clicks **Get shipping options** to apply it.

- Code: `FREESHIP25`.
- Type: Free lowest-cost shipping.
- Amount: 0.
- Minimum merchandise subtotal: $25.01, before tax.
- The cheapest available service becomes free. Other services remain paid upgrades.
- Shipping is not free by default, and the code does not combine with another discount.
- The first-50 wording is promotional: there is **no automatic 50-customer cutoff**, as previously requested. Deactivate the code under **Discount codes** when you want to end the offer. Deactivation also hides the banner on page reload.
- The banner is shown only while FREESHIP25 is active, is a free-shipping code, and has a $25.01 minimum. If your existing code has different settings, check those settings before advertising the offer.

## Homepage, markets, and Contact

The homepage headline is now:

> Rooted in Virginia
>
> A little care, just for you.

The homepage includes a month-by-month September–December **2026** calendar with Charlottesville local times:

- Farmer's in the Park: Wednesdays, 3–7 p.m., through October 28. “Until November” is interpreted as no Wednesday appearances in November.
- Charlottesville City Market: Saturdays, 9 a.m.–1 p.m., through December 19 inclusive.
- Not attending November 7 or November 14.

The calendar starts on the current month within the displayed season, with previous/next buttons. All four months remain readable when JavaScript is disabled. It does not automatically invent dates for a future season. The source schedule is `content/markets.json`; update it and rebuild when dates change. Weekday numbers in that file use Monday=0 through Sunday=6.

Customer-facing links, help messages, and error text now use “Contact us,” “Email us,” “Ask us a question,” or “Send us a note.” Gwyn's portrait has been removed from Contact; her text introduction and the portrait on Our Story remain. Contact links to the same market calendar.

## Quick check after deployment

- Refresh the homepage and Contact. Browse November and confirm the two absences; December ends on the 19th.
- Verify the active FREESHIP25 settings in Admin. With an eligible cart, compare shipping without the code and with it, stopping before payment.
- Use a verified past purchase and a customer you intend to invite. Confirm the invitation email arrives, submit a review through its private link, and check that it is not public until you publish it.
- Existing website-order reviews continue to use the original fulfillment-based invitations.

Automated tests use simulated providers. No additional real charge is necessary to verify this update.
