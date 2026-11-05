# Temporary checkout pause

Online checkout is unavailable while a replacement payment provider is arranged. Customers can browse products and email blue.koi.botanicals@gmail.com to order. The public notice explains the payment-processing difficulty and states that orders cannot be shipped until November 19, 2026.

The original Square checkout, payment code, order management, webhook, and recovery logic remain in this project. The site generator's `COMMERCE_PAUSED` flag hides purchase controls and replaces the cart and checkout pages with the notice; the separate `COMMERCE_PAUSED` flag in `server/worker.mjs` rejects quote and checkout requests, including direct requests. Existing orders and review functions remain available.

A new provider will generally require an integration change, not merely an API key: the retained code is specific to Square. Once that integration is implemented and tested, set both flags to false, rebuild and deploy. Review the temporary notice, shipping and privacy text, prices, inventory, and fulfillment before reopening. Existing payment recovery continues to run for prior processing orders; check these in Square before changing provider credentials.

To deploy this update, copy the contents over the current repository, preserving local environment files and Cloudflare secrets, then use the existing deployment workflow (`npm install`, `npm run deploy`). This changes the Cloudflare Worker as well as the static pages. Do not rely on static hosting alone: the server-side pause must be deployed too. No database migration is needed for this update.
