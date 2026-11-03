# Square checkout and policy update

This package restores Square checkout and the shopping bag, removes the maintenance notice, and retains the business address, card logos, terms, cancellation policy, and defective-product return policy. Square credentials and configuration are preserved in the code; the live account must still be active and configured. Checkout cannot continue to process payments after Square closes the account. No new processor is configured.

Copy the ZIP contents over the existing website repository. Preserve `.git`, local environment files, and existing Cloudflare secrets. This ZIP omits dependencies, caches, Git history, and local configuration. Run `npm.cmd install` if needed, then `npm.cmd run deploy` from the site directory. No database migration is needed for this update. Verify the checkout, card brands, prices, and policies after deployment.

To pause purchases again, set `COMMERCE_PAUSED` to `True` in `scripts/build_site.py` and `true` in `server/worker.mjs`, then rebuild and deploy both the storefront and Worker. Existing order recovery may continue to contact Square for earlier orders.
