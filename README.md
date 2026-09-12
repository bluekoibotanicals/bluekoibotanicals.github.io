# Blue Koi Botanicals

The refreshed static website for bluekoibotanicals.com.

All pages are ready to use on GitHub Pages. The existing page addresses, Square store, email contact, CNAME, and CBD lab report are retained.

## Updating the site

Upload the contents of this folder to the GitHub Pages repository root. The website does not need a package install or a server application.

Product descriptions and prices are in `content/products.json`. Shared page templates are in `scripts/build_site.py`. Run `python3 scripts/build_site.py` after editing these files to regenerate the HTML and the static preview output in `dist/`. Styles and navigation behavior are in `css/styles.css` and `js/site.js`.

The current product images in `assets/photos/` use the supplied product photographs, formatted for a consistent, natural home-studio presentation.

Prices are consistent across the website: 2 oz CBD salve $32, 4 oz CBD salve $58, oils $22, mists $19, lip balms $5, and body butters $28. Square remains the source for stock and checkout prices. Ingredient lists and product directions are preserved from the original product pages.
