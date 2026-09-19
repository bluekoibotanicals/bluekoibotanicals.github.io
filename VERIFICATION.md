# Verification record — September 19, 2026

No deployment, real payment, label purchase, or email was performed.

Executed checks:
- 25 passing Node tests using isolated SQLite and simulated Square, Shippo, and Resend.
- Coverage includes all-destination 5.3% tax, free-shipping threshold and manual off switch, paid upgrades, combined cartons/weights, Shippo precision, domestic-only delivery, CBD state and mixed-cart restrictions, stale quote rejection, payment idempotency, interrupted-response recovery after one hour, expired recovery windows, safe unpaid cancellation, independent email retries, database migration preservation, stock/price changes, webhook signatures, reviews, moderation, and review invitations.
- Static page build succeeds with explicit UTF-8 output.
- Validated 41 public text files for UTF-8 and encoding artifacts; all local page/asset links resolve. JavaScript syntax checks pass. Product catalog bytes match the uploaded original, preserving production IDs and prices.

Limits:
- Chromium could not be downloaded in this environment, so the updated desktop/mobile browser suite was not executed this time. It includes the promotion, U.S. delivery form, combined carton, encoding checks, and simulated purchase. Run it locally using the commands in SETUP.md.
- A Wrangler deployment dry run was not performed here; local Wrangler dependencies were unavailable.
- Provider simulations do not verify live account configuration, actual email arrival, real Square inventory deductions, or physical carton fit.
