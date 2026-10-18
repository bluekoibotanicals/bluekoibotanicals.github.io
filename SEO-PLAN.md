# Blue Koi Botanicals: Google Search and AI visibility plan

Prepared October 18, 2026. Production domain: **https://bluekoibotanicals.com**.

The domain in the request, `bluekoi.botanicals.com`, differs from the domain in the site's CNAME, Cloudflare route and store configuration. This implementation uses the existing production domain throughout.

## The strategy

Give Google a clear answer to three questions: what Blue Koi sells, where a customer can actually buy it, and which facts support the product descriptions. Use the salve collection and roll-on pages for Virginia product searches, one substantive Charlottesville page for local shopping, and a comparison guide for related questions. Make that information readable in the initial HTML and consistently linked across the site.

Google says a page must be indexed and eligible for a search snippet to be eligible as a supporting link in AI Overviews or AI Mode. Its guidance does not require a special AI file or special schema. These changes improve that foundation; they cannot guarantee rankings, indexation, or an AI Overview citation. Google may not display an AI Overview for a particular query at all. [1]

For “near me,” location matters: Google identifies relevance, distance and prominence as local ranking factors. Website work supports relevance, but real local presence, accurate listings, reviews and links remain important. A Virginia shipping destination does not make a business physically near every Virginia searcher. [2]

## Audit findings

- The supplied site already has static product text, real product photographs, ingredient lists, a maker story and a market calendar. These are useful foundations.
- Public web search returned Blue Koi's homepage, salve and roll-on pages, and its Marketspread profile. This is not a personalized Google ranking report and does not establish where the business ranks for a Charlottesville searcher.
- The supplied build did not generate a robots.txt file, sitemap, shared canonical URLs, social metadata or structured business/page/product data.
- The production product URL inspected redirects from `.html` to an extensionless URL. Existing internal links mainly used `.html`, and older product aliases used relative canonicals.
- The salve/roll-on pages did not give local shoppers much practical Charlottesville buying information.
- The PDF already linked from the salve pages is an Anresco report for a **CBD isolate ingredient sample**, not a finished Blue Koi salve or roll-on. It cannot establish finished-product testing or all current batches.
- Private workflow pages lacked explicit search-indexing controls.

## Query-to-page plan and implementation

| Search intent | Primary destination after deployment | What is implemented |
| --- | --- | --- |
| CBD salve Charlottesville; CBD roll-on Charlottesville; nearby local buying | `/cbd-charlottesville` | Product links, verified market venue addresses, map links, actual attendance dates from the supplied calendar, absence dates, stock-confirmation guidance, online ordering and practical questions |
| CBD salve Virginia | `/products/cbd-salves` | Virginia-focused title and heading, concise search description, both jar sizes, ingredients and links to the local page and comparison guide |
| CBD roll-on Virginia | `/products/cbd-roll-on` and `/products/cbd-roll-ons` | Virginia-focused search metadata, existing 10 mL/1,000 mg facts, product details and local-buying links |
| Specific salve size | `/products/cbd-salve` and `/products/cbd-salve-4oz` | Distinct titles/descriptions, product facts, breadcrumbs and Charlottesville buying context |
| CBD salve vs roll-on; size and ingredient comparisons | `/cbd-salve-vs-roll-on` | Plain-language summary, comparison table, labeled CBD totals, application differences, ingredient differences and links to each product |
| Blue Koi CBD lab report; batch documentation | `/cbd-lab-reports` | Original PDF, lab/sample/lot/date information, exact ingredient-sample results, report limitations and a way to ask about a batch |
| Brand and Virginia body care | `/` | Clear Charlottesville context, a dedicated salve/roll-on section and direct links into the local/product content |

The new local page covers both products. It does not create near-duplicate city pages for locations where Blue Koi has no documented presence.

## Technical work completed

1. Added one absolute canonical URL per generated page, on the existing HTTPS production domain. Public navigation uses the extensionless URL format already used by the live site.
2. Added permanent redirects for known public `.html`/trailing-slash URLs, homepage aliases and legacy product aliases. Tracking parameters survive. Legacy 4 oz butter URLs retain their size selection. Checkout/API requests are excluded from this redirect logic.
3. Added a generated `sitemap.xml` containing 31 indexable canonical pages and a `robots.txt` file that permits crawling and identifies the sitemap. No invented modification dates or special AI crawler promises.
4. Added Organization, WebSite, WebPage/CollectionPage and matching breadcrumb JSON-LD. Product detail pages also identify their products using the same names, descriptions, sizes and images as the product records.
5. Added page-specific Open Graph metadata and large-image preview permission.
6. Added `noindex` HTML metadata to cart, checkout, order, review and admin pages, with matching Worker HTTP controls on both clean and `.html` paths. Private pages/API responses are not cached. These controls supplement existing authentication; they are not access controls.
7. Connected the new pages through navigation, the footer, homepage, categories and product detail pages. The information is present without requiring JavaScript.
8. Labeled the existing isolate COA accurately and did not add unverified finished-product testing, THC guarantees, reviews, storefronts, stockists or suppliers.
9. Kept payment, product-price, ingredient, tax, inventory and shipping source records unchanged. The existing live Square updates still operate. Static cards no longer present a saved zero-stock snapshot as a current “Sold out” claim while waiting for the live catalog.

### Structured-data limits

The product nodes describe products; they deliberately omit live Offers, availability and review aggregates. The source catalog contains stock snapshots, including a zero roll-on snapshot, while the store gets current values from Square. A static build should not advertise that snapshot as live stock. As a result, the descriptive Product nodes are **not a complete application for Google Product rich results**; a rich-results validator may flag the missing offer/review requirement. This is intentional, not a promise of shopping enhancements. [4]

Before considering Product rich results or a Merchant Center feed, confirm CBD eligibility for that exact Google surface. Google applies separate policies to shopping features, including restrictions on regulated products; ordinary crawlability is a different question. If eligible products later receive offer markup, source both visible prices and markup from the same current data. Do not add fabricated ratings just to satisfy a validator. [4]

The useful questions and answers remain visible page content. This implementation does not rely on FAQ rich results, hidden answer blocks or an `llms.txt` file.

## Highest-priority work outside the website

### 1. Deploy and establish Google's view of the site

- Deploy the revised project to the existing Cloudflare Worker/domain using the instructions below.
- Verify a **Domain property for `bluekoibotanicals.com` in Google Search Console**, using the DNS verification token Google provides. No verification token has been invented or inserted. Alternatively, if using a URL-prefix property with HTML verification, place the real token in `content/seo.json` under `google_site_verification`, then rebuild and deploy.
- Submit `https://bluekoibotanicals.com/sitemap.xml` once in Search Console.
- Inspect the homepage, local page, salve collection, both salve sizes, roll-on detail and comparison guide. Use Test Live URL, check that indexing is allowed, and request indexing for the main changed URLs. Submission does not guarantee inclusion; repeatedly submitting the same URL will not accelerate crawling. [3]
- Check Cloudflare bot/security rules for accidental challenges to Googlebot. Verify that the actual production URLs return usable content, not a challenge or login screen.
- Confirm that HTTPS and any `www` hostname redirect to the chosen apex domain. A Worker cannot redirect a hostname whose DNS/TLS/routing never reaches it; no unrelated domain configuration was changed here.

### 2. Resolve local-profile eligibility before creating or changing a listing

A verified, accurate Google Business Profile can be valuable **if Blue Koi's actual operating model qualifies**. Do not assume a home office, online shop or temporary market table is an eligible permanent storefront. Google requires accurate real-world locations and permanent signage for displayed storefront addresses, and restricts some age-restricted businesses from operating as service-area profiles without a storefront. Confirm how those rules apply to this CBD/body-care business before choosing a setup. Do not claim a market's address as your permanent shop or invent a delivery service to qualify. [5]

If eligible, use the actual business name, best-fitting available category, real customer-facing location/hours, website, contact details and current photos. If not eligible, concentrate on organic search, market/vendor pages and genuine stockist listings. This website uses Organization markup rather than claiming a permanent LocalBusiness storefront.

### 3. Strengthen genuine local mentions and buying information

- Update the existing Marketspread profile and product entries to current product names, sizes, prices and website links. Search results surfaced inconsistent historical market product prices; check the current editable listings before updating them.
- Ask the organizers of markets you actually attend to link the Blue Koi vendor entry to the new Charlottesville page. A link in a relevant vendor directory is more useful here than dozens of unrelated directory submissions.
- For each confirmed retail partner, get a current listing on the partner's own site and add the public shopping address, exact products carried and purchasing instructions to the local page. Confirm permission, current stock and the buying arrangement first. No retailer was added from memory alone.
- Add supplier relationships only when current and verified. When appropriate, request a genuine customer/stockist feature with a link. Do not buy links or manufacture endorsements.
- Invite real purchasers to leave honest reviews through eligible platforms. Invite customers regardless of expected sentiment, without incentives or suggested keyword scripts. Respond helpfully.

### 4. Add stronger first-party evidence over time

- Obtain and publish product/batch-specific documentation when available, with the relevant lot and date. Preserve the distinction between ingredient tests and finished-product tests.
- Keep complete ingredient lists and directions synchronized with labels when formulations change.
- Add a few original, useful photos or short demonstrations: salve texture, roller application, bottle/jar scale, maker at work and the market table. Include readable captions and descriptions. Avoid unsupported medical outcome claims.
- Update the market data before dates change; replace the 2026 schedule before the 2027 season. Rebuild after updating `content/markets.json` so both local-page dates and the calendar agree.
- Keep price records aligned with Square when prices change. Live prices update in the browser, but crawlers can also encounter the initial HTML.

## Measurement: first 90 days

| When | Action | Evidence to record |
| --- | --- | --- |
| Deployment day | Verify sitemap, canonical URLs and live crawlability | Search Console property verified; submitted sitemap; key URLs' inspection results |
| First 2 weeks | Watch indexing and resolve concrete errors | Indexed pages, Google's chosen canonical, crawl failures, security challenges |
| Weekly | Review relevant queries and landing pages | Impressions, clicks, CTR and position for salve/roll-on/local terms; email inquiries and orders attributable to organic traffic where your existing tools allow |
| At 30, 60 and 90 days | Compare equal-length periods and improve the pages attracting impressions | Trend by query and landing page; confirmed useful local links; review growth; organic inquiries/orders |
| Periodically | Sample the same local and comparison searches | Date, approximate search location, exact query, whether an AI Overview appeared and whether it cited Blue Koi |

Useful query groups include `CBD salve Charlottesville`, `CBD roll-on Charlottesville`, `CBD salve Virginia`, `CBD roll on Virginia`, `CBD salve near me`, `CBD roll on near me`, and salve/roll-on comparisons. Search outcomes vary with location, device and time; a manual sample is not a universal rank. Use Search Console's available search performance reports as the ongoing baseline and any AI-specific reporting your account exposes. No ranking baseline, traffic increase or AI citation has been claimed or measured in this implementation.

## Deployment on your existing Windows setup

The ZIP is a clean source package. It omits installed dependencies, local database/runtime caches, Git history, old screenshots and the redundant `dist` folder. Your product images, configuration, migrations, source templates and generated root HTML are included.

1. Back up your current project. Copy the updated source files into the same existing website project, preserving your local credentials and Git metadata. Do not replace it with an unrelated hosting project.
2. In PowerShell, from that project folder, run:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd run deploy
```

`npm.cmd run deploy` builds the site and runs Wrangler against the existing Worker in `wrangler.jsonc`. Use the Cloudflare account already associated with this project; if the CLI is not signed in, authenticate with your normal account. Node 22.13 or newer and Python 3 are required by the existing project. No database migration is required for this SEO update.

3. Open these URLs after deployment:

- https://bluekoibotanicals.com/cbd-charlottesville
- https://bluekoibotanicals.com/cbd-salve-vs-roll-on
- https://bluekoibotanicals.com/cbd-lab-reports
- https://bluekoibotanicals.com/products/cbd-salves
- https://bluekoibotanicals.com/products/cbd-roll-on
- https://bluekoibotanicals.com/sitemap.xml
- https://bluekoibotanicals.com/robots.txt

4. Check a product, mobile navigation, bag and checkout before doing the Search Console submission. Check the live roll-on availability rather than relying on the source snapshot.

**Status:** implemented and verified in the supplied source package; not deployed to the live domain. No Google profile, Search Console property, DNS record, external listing or outgoing message was changed.

## Verification and maintenance

- Build succeeds and generates 43 HTML pages, including 31 sitemap destinations, five private workflow pages and seven legacy redirect pages.
- All 58 Node tests pass: the existing 55 commerce tests plus three SEO/redirect tests.
- A static HTML/link scan found no missing local href targets or duplicate element IDs.
- Structured data parses as JSON; sitemap URLs resolve to generated public pages with one H1, one matching canonical and unique titles.
- Product, price, payment-provider, shipping and Wrangler configuration files match the supplied source.
- Browser visual QA and production Google tools were not available in this environment. Live validation is still required after deployment.
- Maintain page templates in `scripts/build_site.py` and `scripts/search_pages.py`, metadata in `scripts/seo.py` / `content/seo.json`, and dates/venues in `content/markets.json`. Generated HTML is overwritten by a build.

## Sources checked

1. Google Search Central, [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features).
2. Google Business Profile Help, [Tips to improve your local ranking](https://support.google.com/business/answer/7091?hl=en).
3. Google Search Central, [Ask Google to recrawl your URLs](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
4. Google Search Central, [Product snippet structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) and [Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing).
5. Google Business Profile Help, [Guidelines for representing your business](https://support.google.com/business/answer/3038177).
6. Google Search Central, [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies).
7. [IX Arts Foundation](https://www.ixartpark.org/) and [City of Charlottesville market information](https://www.charlottesville.gov/619/Charlottesville-Farmers-Markets), used for venue addresses. Blue Koi attendance comes from the uploaded `content/markets.json`.
8. Uploaded product data, production site configuration, and `assets/coa/R251119MS08MS126_COA.pdf`, used for Blue Koi-specific facts.
