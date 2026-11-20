# Blue Koi Botanicals

Custom Cloudflare storefront with EPD card payments, website-managed D1 inventory, Shippo shipping, Resend notifications, D1 orders, and verified reviews. Kurv is the merchant processor.

Start with [EPD-SETUP.md](EPD-SETUP.md) for the November 19, 2026 migration. It supersedes the Square payment and inventory setup in older guides. Product SKUs and prices match the supplied EPD catalog. Stock quantities start at zero and checkout remains closed until configured. No deployment or real transaction was performed.

Windows PowerShell:
```powershell
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Node.js 22.13+ and Python 3 are required. Local development uses your own .dev.vars; without it the server defaults to preview mode. Production uses wrangler.jsonc and Cloudflare secrets. GitHub Pages alone cannot run checkout.

Product data: content/products.json. Tax/packages/promotion: content/store.json. Templates/build: scripts/. APIs: server/. Browser code: js/. Database migrations: migrations/.

Use [EPD-SETUP.md](EPD-SETUP.md) for current operations and validation scope. Older setup and update documents remain as historical references. Website stock is not automatically synchronized with EPD or market POS sales.
