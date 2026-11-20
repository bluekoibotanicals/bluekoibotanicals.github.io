# EPD Cloudflare request fix

Cause: server/epd.mjs used redirect:'error'. Cloudflare Workers rejects that option before sending an outbound request. Both payment submission and transaction lookup failed. The broad error handler labeled this as an uncertain payment. The earlier tests mocked fetch and did not exercise Cloudflare's Request validation.

Correction: use redirect:'manual'. The existing response.ok check rejects 3xx responses, so redirects remain blocked and the private key is not forwarded to another host.

Validation: reproduced the original error in workerd, Cloudflare's runtime. The corrected provider passed sale, lookup and redirect rejection tests against a mock gateway inside workerd. No live card requests or external gateway requests were made by these tests. All 82 tests pass. Actual EPD account configuration must still be checked with a real gateway test.

Install:
1. Copy this ZIP's files into matching folders in the existing website project. It updates server/epd.mjs and adds tests. No Cloudflare configuration, API keys, inventory, dependency files or database migrations are included.
2. Open wrangler.jsonc and temporarily set LIVE_LAUNCH_CONFIRMED to "false". Keep the other current settings.
3. In PowerShell run:
       npm.cmd test
       npm.cmd run deploy
4. The test suite now includes an actual workerd test using the workerd installed with Wrangler. If it reports a missing workerd package/platform binary, run npm.cmd install in this project on this computer, then rerun the tests. Do not copy node_modules between Windows and Linux.
5. Check EPD transaction reporting for the original $5.54 attempt, including approved, pending, declined and errored transactions. Match the full website order ID and attempt time. Do not rely solely on a card's posted-transactions list.
6. Use Check payment status for that order in website admin. The query connection can now run. If EPD shows an approved transaction, let the site reconcile it; do not submit another payment.
7. If EPD has no transaction, the old website order can remain pending: no query result is intentionally not treated as a general guarantee that a payment failed. Report the EPD search result and the exact website order ID so only this known pre-request failure can be closed and its reservation released. Do not delete orders or reset all reservations.
8. After the old order is resolved, re-enable LIVE_LAUNCH_CONFIRMED and deploy, then perform one new test. Keep automatic postage disabled during the test.

The fix does not automatically resubmit, recharge, cancel or delete any existing order. Successfully saved stock quantities are preserved.

Reference: https://developers.cloudflare.com/workers/runtime-apis/request/
