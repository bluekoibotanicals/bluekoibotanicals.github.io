"""Helpful local buying and product reference pages, rendered as ordinary HTML."""
from datetime import date, timedelta
from html import escape
from urllib.parse import quote
from market_calendar import load_schedule, render_market_calendar

EMAIL = 'blue.koi.botanicals@gmail.com'


def crumbs(label):
    return f'<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span>{escape(label)}</span></nav>'


def price(p):
    return f'<span data-product-price="{escape(p["slug"])}">{escape(p["price"])}</span>'


def comparison(products):
    rows = []
    for slug, texture, use in [
        ('cbd-salve', 'Firm balm; coconut oil, shea butter and beeswax', 'Scoop a small amount and massage onto skin'),
        ('cbd-roll-on', 'Liquid oil; MCT and jojoba oils', 'Roll directly onto a small area of skin')]:
        p = products[slug]
        rows.append(f'<tr><th scope="row"><a href="products/{slug}.html">{escape(p["name"])}</a></th><td>{escape(p["display_size"])}</td><td>{texture}</td><td>{use}</td><td>{price(p)}</td></tr>')
    return '<div class="comparison-scroll" role="region" aria-label="CBD salve and roll-on comparison" tabindex="0"><table class="comparison-table"><caption>Compare Blue Koi’s CBD salves and roll-on</caption><thead><tr><th scope="col">Product</th><th scope="col">Size &amp; CBD per container</th><th scope="col">Texture</th><th scope="col">Application</th><th scope="col">Price</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div><p class="small muted">CBD amounts are the labeled totals per container, not per application. Prices update from our online catalog when available; check the product page for current stock.</p>'


def faqs(items):
    return '<div class="details-list search-faq">' + ''.join(f'<details><summary>{escape(q)}</summary><div class="details-body"><p>{a}</p></div></details>' for q, a in items) + '</div>'


def market_cards():
    schedule = load_schedule()
    cards = []
    for market in schedule['markets']:
        dates = []
        day, end = date.fromisoformat(market['start_date']), date.fromisoformat(market['end_date'])
        while day <= end:
            if day.weekday() == market['weekday'] and day.isoformat() not in market['excluded_dates']:
                dates.append(f'<time datetime="{day.isoformat()}">{day.strftime("%b")} {day.day}</time>')
            day += timedelta(days=1)
        address = market.get('address', 'Charlottesville, Virginia')
        source = market.get('venue_url', '')
        map_url = 'https://www.google.com/maps/search/?api=1&query=' + quote(market['name'] + ' ' + address)
        cards.append(f'<article class="local-card"><p class="eyebrow">Market visit</p><h3>{escape(market["name"])}</h3><p>{escape(address)}</p><p><strong>Our {schedule["year"]} dates:</strong> {", ".join(dates)}<br>{escape(market["start_time"])}–{escape(market["end_time"])} Eastern Time</p><div class="actions"><a class="text-link" href="{escape(map_url, quote=True)}" target="_blank" rel="noopener noreferrer">Map &amp; directions</a>' + (f'<a class="text-link" href="{escape(source, quote=True)}" target="_blank" rel="noopener noreferrer">Venue details</a>' if source else '') + '</div></article>')
    return '<div class="local-cards">' + ''.join(cards) + '</div>'


def local_product_note(p):
    kind = 'CBD roll-on' if p['slug'] == 'cbd-roll-on' else 'CBD salve'
    return f'''<section class="section section-border"><div class="wrap search-content"><p class="eyebrow">Made by hand in Virginia</p><h2>Shopping for {kind} in Charlottesville?</h2><p>Blue Koi Botanicals is based in Charlottesville, Virginia. Shop online or meet us at one of our scheduled local markets. Check our dates and ask about the product you want before making a special trip.</p><div class="actions"><a class="button secondary" href="../cbd-charlottesville.html">Where to find us locally</a><a class="text-link" href="../cbd-salve-vs-roll-on.html">Compare salve &amp; roll-on</a><a class="text-link" href="../cbd-lab-reports.html">About our CBD lab report</a></div></div></section>'''


def render_search_pages(page, products, product_card, photo):
    featured = ''.join(product_card(products[slug], brief=True) for slug in ['cbd-salve', 'cbd-roll-on'])
    local_faq = faqs([
        ('Where can I buy CBD salve near me in Charlottesville?', 'Find Blue Koi Botanicals at the Charlottesville markets listed on this page on our scheduled dates, or order from our online shop. Email us before visiting if you want a particular size or product; market stock can vary.'),
        ('Can I buy the CBD roll-on locally?', 'Our CBD Roll-On is part of the Blue Koi collection. Contact us to confirm market availability before your visit, or check the <a href="products/cbd-roll-on.html">roll-on product page</a> for online availability.'),
        ('Are the market addresses a Blue Koi storefront?', 'These are the venues where we attend markets on the listed dates. Please use the schedule to plan your visit; the addresses are not a permanent Blue Koi retail store.'),
        ('Can I order CBD salve or a roll-on elsewhere in Virginia?', 'Yes. Order online for delivery in Virginia. Orders normally process in 1–3 days before shipping. Shipping options and rates appear at checkout; see our <a href="shipping-returns.html">shipping policy</a>.'),
    ])
    body = f'''<section class="page-top"><div class="wrap">{crumbs('Find us in Charlottesville')}<p class="eyebrow">Meet Blue Koi locally</p><h1>CBD salve &amp; roll-on<br>in Charlottesville.</h1><p class="lead">Looking for CBD salve or a CBD roll-on in Charlottesville, Virginia? Blue Koi Botanicals makes small-batch topical body care in Virginia. Shop our online collection or visit our table at a scheduled Charlottesville market.</p><div class="actions"><a class="button" href="#market-dates">Find a market date</a><a class="text-link" href="products/cbd-salves.html">Shop CBD salves</a><a class="text-link" href="products/cbd-roll-on.html">Shop the CBD roll-on</a></div></div></section>
<section class="section section-border"><div class="wrap"><div class="section-head"><div><p class="eyebrow">Two ways to apply</p><h2>A jar or a roller?</h2></div><a class="text-link" href="cbd-salve-vs-roll-on.html">Compare the formats</a></div><div class="product-grid">{featured}</div></div></section>
<section class="section search-wash" id="market-dates"><div class="wrap"><p class="eyebrow">Plan your visit</p><h2>Find our market table.</h2><p class="lead">The dates below are our scheduled appearances, not permanent shop hours. Check the calendar before visiting and <a href="mailto:{EMAIL}">email us</a> to confirm a particular product is available.</p>{market_cards()}<p class="small">Market venues and dates can change. Venue links provide location information; our attendance is shown in our calendar.</p><div class="market-grid">{render_market_calendar()}</div></div></section>
<section class="section"><div class="wrap local-feature"><figure>{photo('market')}<figcaption class="photo-caption">Look for the Blue Koi Botanicals table.</figcaption></figure><div><p class="eyebrow">Across Virginia</p><h2>Can’t make the market?</h2><p>Order our CBD salves or roll-on online for delivery in Virginia. Compare sizes, read the ingredients, and choose the format you prefer. Orders process in 1–3 days before carrier transit.</p><div class="actions"><a class="button" href="products.html">Shop online</a><a class="text-link" href="shipping-returns.html">Shipping &amp; returns</a></div><p class="small">Questions about texture or ingredients? <a href="about.html">Meet Gwyn, our owner and maker</a>, or <a href="contact.html">get in touch</a>.</p></div></div></section>
<section class="section section-border"><div class="wrap search-content"><h2>Buying locally: your questions.</h2>{local_faq}</div></section>'''
    page('cbd-charlottesville.html', 'CBD Salve & Roll-On in Charlottesville, VA', 'Find Blue Koi CBD salve and roll-on in Charlottesville, Virginia. See our market dates, locations, product sizes and online ordering options.', body, 'cbd-charlottesville.html')

    guide_faq = faqs([
        ('Is the roll-on an oral CBD oil?', 'No. The Blue Koi CBD Roll-On is a topical product for external use only and is not intended for human consumption. Follow the directions and warnings on the bottle.'),
        ('Which ingredients are different?', 'The salve uses coconut oil, shea butter and beeswax for a firm balm. The roll-on uses MCT and jojoba oils with bisabolol and vitamin E for a liquid format. Both contain menthol and eucalyptus; the roll-on also lists lavender, and the salves list camphor. Read the complete ingredient list on the product page.'),
        ('Where can I read the CBD lab report?', 'Our <a href="cbd-lab-reports.html">lab report page</a> links to the finished-product COAs for our CBD Salve and CBD Roll-On. Each report identifies its tested product and batch.'),
    ])
    body = f'''<section class="page-top"><div class="wrap">{crumbs('CBD salve vs. roll-on')}<p class="eyebrow">Choose your texture</p><h1>CBD salve or roll-on?</h1><p class="lead">Choose Blue Koi’s CBD salve if you prefer a firm balm you can scoop and massage into skin. Choose the CBD roll-on if you prefer a liquid oil applied directly with a roller. Both are topical formats, made by hand in Virginia.</p><p class="small">Product guide from Blue Koi Botanicals. Based on the sizes, ingredients and directions in our current online catalog.</p></div></section>
<section class="section section-border"><div class="wrap">{comparison(products)}<div class="local-cards"><article class="local-card"><h2>The salve.</h2><p>Coconut oil, shea butter and beeswax create a balm that softens as you massage it. The 2 oz jar contains 1,000 mg CBD.</p><a class="text-link" href="products/cbd-salves.html">Explore the CBD salve</a></article><article class="local-card"><h2>The roll-on.</h2><p>The 10 mL bottle contains 1,000 mg CBD in a liquid MCT and jojoba oil blend. The roller applies it directly to skin without scooping from a jar.</p><a class="text-link" href="products/cbd-roll-on.html">Explore the CBD Roll-On</a></article></div></div></section>
<section class="section search-wash"><div class="wrap search-content"><h2>Read the amount and the size together.</h2><p>The CBD amount on the label is the total for the entire container. A larger total does not, on its own, mean a more concentrated product or a different effect. Our salve sizes use weight in ounces and the roll-on uses volume in milliliters; those units should not be compared as if they were the same.</p><h2>Check the ingredients before you choose.</h2><p>Each product page includes the full ingredient list, directions and storage information. These products are for external use only. Follow the label, avoid broken or irritated skin, and discontinue use if irritation occurs.</p><a class="text-link" href="cbd-charlottesville.html">Find our salves and roll-on in Charlottesville</a></div></section>
<section class="section"><div class="wrap search-content"><h2>A few useful details.</h2>{guide_faq}</div></section>'''
    page('cbd-salve-vs-roll-on.html', 'CBD Salve vs. Roll-On: Ingredients & Texture', 'Compare Blue Koi’s 2 oz CBD salve and 10 mL roll-on. See CBD amounts, ingredients, prices and Charlottesville buying options.', body)

    body = f'''<section class="page-top"><div class="wrap">{crumbs('CBD lab reports')}<p class="eyebrow">Know what you’re reading</p><h1>Our CBD lab reports.</h1><p class="lead">A certificate of analysis, or COA, describes the specific finished product tested by a laboratory. Read the report that matches the Blue Koi product you use.</p><div class="actions"><a class="button" href="assets/coa/cbd-salve-coa.pdf" target="_blank" rel="noopener noreferrer">CBD Salve COA (PDF)</a><a class="button secondary" href="assets/coa/cbd-roll-on-coa.pdf" target="_blank" rel="noopener noreferrer">CBD Roll-On COA (PDF)</a></div></div></section>
<section class="section section-border"><div class="wrap search-content"><h2>CBD Salve</h2><dl class="search-facts"><div><dt>Laboratory</dt><dd>Green Analytics VA</dd></div><div><dt>Sample ID / Batch ID</dt><dd>34507 / 107</dd></div><div><dt>Report date</dt><dd>October 23, 2026</dd></div><div><dt>Total CBD</dt><dd>15.12 mg/g (1.512%)</dd></div><div><dt>Total THC</dt><dd>ND (not detected)</dd></div></dl>
<h2>CBD Roll-On</h2><dl class="search-facts"><div><dt>Laboratory</dt><dd>Green Analytics VA</dd></div><div><dt>Sample ID / Batch ID</dt><dd>34508 / 107</dd></div><div><dt>Report date</dt><dd>October 23, 2026</dd></div><div><dt>Total CBD</dt><dd>101.40 mg/g (10.140%)</dd></div><div><dt>Total THC</dt><dd>ND (not detected)</dd></div></dl>
<h2>“Not detected” applies to the tested sample.</h2><p>“ND” means the analyte was not detected under the test’s conditions. Review each PDF for the laboratory’s full methods, limits, and results.</p>
<h2>Need a report for a particular jar or bottle?</h2><p>Email <a href="mailto:{EMAIL}">{EMAIL}</a> with the product name and batch code. We can help identify the relevant documentation.</p><div class="actions"><a class="text-link" href="products/cbd-salves.html">CBD salves</a><a class="text-link" href="products/cbd-roll-on.html">CBD roll-on</a><a class="text-link" href="cbd-salve-vs-roll-on.html">Compare the formats</a></div></div></section>'''
    page('cbd-lab-reports.html', 'CBD Lab Reports & Batch Information', 'Read finished-product certificates of analysis for Blue Koi Botanicals CBD Salve and CBD Roll-On.', body)
