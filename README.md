# Blue Koi Botanicals

Custom Cloudflare storefront with Square payments/inventory, Shippo rates, Resend notifications, D1 orders, and verified reviews.

Start with [UPDATE.md](UPDATE.md). Production IDs, prices, and live configuration are preserved. No deployment or real transaction was performed.

Windows PowerShell:
```powershell
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Node.js 22.13+ and Python 3 are required. Local development uses your own .dev.vars; without it the server defaults to preview mode. Production uses wrangler.jsonc and Cloudflare secrets. GitHub Pages alone cannot run checkout.

Product data: content/products.json. Tax/packages/promotion: content/store.json. Templates/build: scripts/. APIs: server/. Browser code: js/. Database migrations: migrations/.

See [SETUP.md](SETUP.md) for operations and [VERIFICATION.md](VERIFICATION.md) for testing scope.
