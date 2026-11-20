# Admin inventory request-limit fix

Copy server/worker.mjs, js/account-pages.js and tests/admin-limits.test.mjs from this ZIP into the matching folders in your existing website project, replacing the two existing code files and adding the test file.

This is a small overlay for the EPD update already installed. It contains no wrangler.jsonc, package.json, package-lock.json, keys, catalog changes or database migrations. Your Cloudflare settings and stock quantities are preserved.

From your project folder in PowerShell:

    npm.cmd test
    npm.cmd run deploy

Expected: 81 passing tests and a successful deployment. After deployment, use Ctrl+Shift+R on the admin page and sign in with your existing ADMIN_TOKEN.

The new admin limits use separate counters, so the previous 100-request lockout no longer applies immediately after deployment. No database clearing or inventory re-entry is required. Check the inventory list: saves that succeeded remain stored, but entries rejected before this fix may still need saving.

Why this happened:
- Every dashboard load made six admin requests.
- Each stock save triggered another full dashboard load.
- All authenticated requests shared a 100-request hourly limit, including login-page loading.

What changed:
- Saving stock now updates only that row, retains the returned stock version, and leaves other unsaved entries intact.
- Failed authentication attempts are limited separately to 30/hour per IP.
- Authenticated reads allow 1,200/hour per IP; edits allow 300/hour per IP.
- Tests cover all 20 stock edits plus repeated dashboard reads, recovery from the old lockout, failed-login isolation, and enforcement of the new edit limit.
- Existing optimistic concurrency and reserved-stock protection remain in place.

Validation: all 81 automated tests passed and the 44-page static build completed. Production deployment must be run from your computer.
