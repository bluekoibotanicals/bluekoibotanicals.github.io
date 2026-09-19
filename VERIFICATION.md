# Verification for the reviews and markets update

- `npm test`: 33 tests passed, 0 failed. Payment, inventory, shipping, discounts, tax, notifications, authorization, and existing reviews remain covered by the prior regression suite.
- Seven new tests cover past-customer invitations without charges/orders, duplicate receipt protection, selected-product enforcement, moderation/public privacy, authentication and input validation, revoked/expired links, bounded email retries, active-only banner behavior, code-required shipping, and migration preservation.
- `npm run build`: 34 static pages built successfully.
- Generated-page checks: all local script and stylesheet references resolve; old “Contact Gwyn”/“Email Gwyn” wording and known replacement-character patterns are absent; the homepage headline and Contact portrait removal are present.
- Calendar date checks: September–December 2026 contains 9 Wednesday visits (last October 28), 14 Saturday visits (last December 19), and two explicitly excluded Saturdays (November 7 and 14). Times match the requested schedule.
- JavaScript syntax checks passed for the updated frontend files and browser-check script.
- The optional Playwright browser suite was extended for the banner button, past-customer review workflow, calendar navigation, and Contact changes, but could not run here because the Chromium download timed out. Visual layout and browser interaction still need a browser smoke check after installation.
- All service tests use isolated local databases and simulated providers. No real customer email, payment, shipping-label purchase, or production deployment was performed.
