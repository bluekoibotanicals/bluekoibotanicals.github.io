#!/usr/bin/env python3
"""Build the static GitHub Pages site from the shared templates and product data."""
from pathlib import Path
from html import escape
import json
import shutil
from commerce_pages import render_commerce_pages
from market_calendar import render_market_calendar
from seo import page_head, clean_public_links, write_discovery, absolute
from search_pages import render_search_pages, local_product_note

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = json.loads((ROOT / 'content/products.json').read_text(encoding='utf-8'))
STICKERS = json.loads((ROOT / 'content/stickers.json').read_text(encoding='utf-8'))
BY_SLUG = {p['slug']: p for p in PRODUCTS}
LISTED_PRODUCTS = [p for p in PRODUCTS if p.get('parent_slug', p['slug']) == p['slug']]
SHOP = 'https://blue-koi-botanicals-llc.square.site'
EMAIL = 'blue.koi.botanicals@gmail.com'
CATEGORIES = {
    'cbd-salves': ('CBD Salves', 'Rich care. A refreshing finish.', 'Take a moment to work a little care into your day. Our rich CBD salves soften with the warmth of your hands, combining coconut oil, shea butter, and beeswax with cooling menthol, eucalyptus, and camphor. Choose a compact 2 oz jar or make room for more of your favorite with 4 oz.', 'category-cbd-salves', '2 oz and 4 oz'),
    'cbd-roll-ons': ('CBD Roll-On', 'Your cooling ritual, ready to go.', 'Silky oils, a refreshing feel, and a roller that goes where you do. Our 10 mL CBD Roll-On combines 1,000 mg of CBD isolate with MCT and jojoba oils, skin-conditioning bisabolol and vitamin E, and a light eucalyptus-lavender scent. Glide on a little care without reaching for a jar.', 'cbd-roll-on', '10 mL · 1,000 mg CBD'),
    'body-oils': ('Body Oils', 'Turn the last minute of your shower into your favorite.', 'A few drops, a soft sheen, and a scent you look forward to wearing. Our meadowfoam and jojoba body oils glide over damp skin, making everyday moisture feel a little more indulgent. Find your favorite among lush florals, fresh eucalyptus, and warm cedarwood vanilla.', 'category-body-oils', 'Four scents · 4 fl oz'),
    'magnesium-sprays': ('Magnesium Body Mists', 'A small spritz. A moment for yourself.', 'Make a little room for ritual with magnesium chloride, botanical flower waters, and aloe. Choose softly herbal Lavender for your evening essentials or delicate Rose for a fresh floral moment. These water-based body mists have a distinctive mineral feel; start with a small amount and follow the care directions.', 'category-magnesium-sprays', 'Two scents · 4 fl oz'),
    'lip-balms': ('Lip Balms', 'Little comforts you can take everywhere.', 'Buttery softness in a pocket-sized tube. Beeswax, cocoa and shea butters, meadowfoam, and jojoba come together for a comfortable glide over dry lips. Choose sweet, floral Honey Lavender or fresh Lavender Spearmint—or keep one of each within reach.', 'category-lip-balms', 'Two blends · 0.19 oz'),
    'body-butters': ('Whipped Body Butters', 'Scoop. Soften. Savor.', 'Treat dry skin to the rich feel of whipped body butter. Start with a small scoop, warm it in your hands, and take an extra moment over elbows, knees, and other dry spots. Choose warm, floral, fresh, or unscented, with 4 oz and 8 oz jar capacities to suit your routine.', 'category-body-butters', 'Five scents · 4 oz & 8 oz jars'),
}
PHOTOS = {
    'cbd-roll-on': ('cbd-roll-on.jpeg', 'Blue Koi CBD Roll-On, 10 mL with 1,000 mg CBD, in an amber bottle with a black cap', '1122', '1402'),
    'category-cbd-salves': ('category-cbd-salves.jpeg', 'Blue Koi CBD Salves in 2 oz and 4 oz jars', '1122', '1402'),
    'category-body-oils': ('category-body-oils.jpeg', 'Blue Koi body oils in Jasmine, Eucalyptus, Cedarwood Vanilla, and Lavender', '1122', '1402'),
    'category-magnesium-sprays': ('category-magnesium-sprays.jpeg', 'Blue Koi Rose and Lavender Magnesium Body Mists', '1122', '1402'),
    'category-lip-balms': ('category-lip-balms.jpeg', 'Blue Koi Lavender Spearmint and Honey Lavender Lip Balms', '1122', '1402'),
    'category-body-butters': ('category-body-butters.jpeg', 'Blue Koi Whipped Body Butters in five scents', '1122', '1402'),
    'cbd-salve': ('cbd-salve.jpeg', 'Blue Koi CBD Salve, 2 oz, with 1,000 mg CBD', '1122', '1402'),
    'cbd-salve-4oz': ('cbd-salve-4oz.jpeg', 'Blue Koi CBD Salve, 4 oz, with 2,000 mg CBD', '1122', '1402'),
    'lavender-body-oil': ('lavender-body-oil.jpeg', 'Blue Koi Lavender Body Oil in an amber glass bottle', '1122', '1402'),
    'jasmine-body-oil': ('jasmine-body-oil.jpeg', 'Blue Koi Jasmine Body Oil in an amber glass bottle', '1122', '1402'),
    'cedarwood-vanilla-body-oil': ('cedarwood-vanilla-body-oil.jpeg', 'Blue Koi Cedarwood Vanilla Body Oil in an amber glass bottle', '1122', '1402'),
    'eucalyptus-body-oil': ('eucalyptus-body-oil.jpeg', 'Blue Koi Eucalyptus Body Oil in an amber glass bottle', '1122', '1402'),
    'lavender-magnesium-spray': ('lavender-magnesium-spray.jpeg', 'Blue Koi Lavender Magnesium Body Mist', '1122', '1402'),
    'rose-magnesium-spray': ('rose-magnesium-spray.jpeg', 'Blue Koi Rose Magnesium Body Mist', '1122', '1402'),
    'lavender-spearmint-lip-balm': ('lavender-spearmint-lip-balm.jpeg', 'Blue Koi Lavender Spearmint Lip Balm', '1122', '1402'),
    'honey-lavender-lip-balm': ('honey-lavender-lip-balm.jpeg', 'Blue Koi Honey Lavender Lip Balm', '1122', '1402'),
    'lavender-whipped-body-butter': ('lavender-whipped-body-butter.jpeg', 'Blue Koi Lavender Whipped Body Butter', '1122', '1402'),
    'jasmine-whipped-body-butter': ('jasmine-whipped-body-butter.jpeg', 'Blue Koi Jasmine Whipped Body Butter', '1122', '1402'),
    'cedarwood-vanilla-whipped-body-butter': ('cedarwood-vanilla-whipped-body-butter.jpeg', 'Blue Koi Cedarwood Vanilla Whipped Body Butter', '1122', '1402'),
    'unscented-whipped-body-butter': ('unscented-whipped-body-butter.jpeg', 'Blue Koi Unscented Whipped Body Butter', '1122', '1402'),
    'market': ('market.jpeg', 'The Blue Koi Botanicals tent and product display at a farmers market', '2048', '1536'),
    'gwyn': ('gwyn.jpg', 'Gwyn, the owner and maker behind Blue Koi Botanicals', '1179', '1240'),
}

# The two sizes retain their own photographs, without stretching their aspect ratios.
for item in PRODUCTS:
    if item['category'] == 'body-butters':
        slug = item['slug']
        width, height = ('1086', '1448') if item['jar_capacity_oz'] == 4 else ('1122', '1402')
        PHOTOS[slug] = (slug + '.jpeg', f"Blue Koi {item['name']} in a jar with {item['jar_capacity_oz']} oz capacity", width, height)



def e(value):
    return escape(str(value), quote=True)


def photo(key, prefix='', eager=False, extra=''):
    name, alt, width, height = PHOTOS[key]
    loading = 'eager' if eager else 'lazy'
    priority = ' fetchpriority="high"' if eager else ''
    return f'<div class="photo photo-{key} {extra}"><img src="{prefix}assets/photos/{name}" alt="{e(alt)}" width="{width}" height="{height}" loading="{loading}" decoding="async"{priority}></div>'


def nav(prefix, active):
    items = [('index.html', 'Home'), ('products.html', 'Products'), ('cbd-charlottesville.html', 'Find us locally'), ('about.html', 'Our story'), ('contact.html', 'Contact')]
    links = ''.join(f'<li><a href="{prefix}{url}"'+(' aria-current="page"' if active == url else '')+f'>{label}</a></li>' for url, label in items)
    return f'''<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><nav class="nav wrap" aria-label="Main navigation">
<a class="brand" href="{prefix}index.html" aria-label="Blue Koi Botanicals home"><img src="{prefix}assets/logo.png" alt="" width="68" height="68"><span class="brand-name">Blue Koi<small>Botanicals</small></span></a>
<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="main-navigation">Menu</button>
<ul id="main-navigation" class="nav-links">{links}<li class="shop-nav"><a class="button" href="{prefix}cart.html">Your bag <span data-cart-count aria-label="items in bag">0</span></a></li></ul>
</nav></header>'''


def footer(prefix):
    return f'''<footer class="site-footer"><div class="wrap">
<div class="footer-top"><div><a class="footer-brand" href="{prefix}index.html">Blue Koi Botanicals</a><p>Body care made by hand in Virginia.<br>Thanks for supporting a small business.</p></div>
<ul class="footer-links"><li><a href="{prefix}products.html">Our products</a></li><li><a href="{prefix}cbd-charlottesville.html">Find us in Charlottesville</a></li><li><a href="{prefix}cbd-salve-vs-roll-on.html">Salve or roll-on?</a></li><li><a href="{prefix}cbd-lab-reports.html">CBD lab report</a></li><li><a href="{prefix}about.html">Our story</a></li><li><a href="{prefix}contact.html">Contact us</a></li><li><a href="{prefix}shipping-returns.html">Shipping &amp; returns</a></li><li><a href="{prefix}privacy.html">Privacy</a></li></ul>
<div><div class="footer-label">Have a question?</div><a class="footer-email" href="mailto:{EMAIL}">{EMAIL}</a><p>Based in Charlottesville, Virginia.</p></div></div>
<div class="footer-bottom"><p>© 2026 Blue Koi Botanicals LLC</p><p>For external use only. Statements on this site have not been evaluated by the FDA. Products are not intended to diagnose, treat, cure, or prevent disease.</p></div>
</div></footer>'''


def page(path, title, description, body, active='products.html'):
    prefix = '../' if path.startswith('products/') else ''
    slug = Path(path).stem
    product = BY_SLUG.get(slug) if path.startswith('products/') else None
    category = CATEGORIES.get(slug) if path.startswith('products/') else None
    image = 'assets/photos/' + PHOTOS[product_photo(product)][0] if product else 'assets/photos/' + PHOTOS[category[3]][0] if category else 'assets/photos/market.jpeg'
    breadcrumbs = None
    if product:
        breadcrumbs = [('Home', 'index.html'), ('Products', 'products.html'), (CATEGORIES[product['category']][0], 'products/'+product['category']+'.html'), (product['name'], path)]
    elif category:
        breadcrumbs = [('Home', 'index.html'), ('Products', 'products.html'), (category[0], path)]
    elif path in {'cbd-charlottesville.html', 'cbd-salve-vs-roll-on.html', 'cbd-lab-reports.html'}:
        label = {'cbd-charlottesville.html': 'Find us in Charlottesville', 'cbd-salve-vs-roll-on.html': 'CBD salve vs. roll-on', 'cbd-lab-reports.html': 'CBD lab reports'}[path]
        breadcrumbs = [('Home', 'index.html'), (label, path)]
    metadata = page_head(path, title, description, image=image, product=product, breadcrumbs=breadcrumbs, collection=bool(category))
    doc = f'''<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | Blue Koi Botanicals</title><meta name="description" content="{e(description)}">
{metadata}
<meta name="theme-color" content="#173d52"><link rel="icon" type="image/png" href="{prefix}assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="{prefix}css/styles.css"><link rel="stylesheet" href="{prefix}css/commerce.css"><script defer src="{prefix}js/site.js"></script><script type="module" src="{prefix}js/commerce.js"></script>
</head><body>{nav(prefix, active)}<main id="main"><noscript><p class="notice wrap">Please enable JavaScript to use the shopping bag and checkout, or email us for help placing an order.</p></noscript>{body}</main>{footer(prefix)}</body></html>'''
    (ROOT / path).write_text(clean_public_links(doc, path) + '\n', encoding='utf-8')


def category_nav(prefix='', active=''):
    items = [('products.html', 'All products', '')] + [(f'products/{slug}.html', values[0].replace('Whipped ', ''), slug) for slug, values in CATEGORIES.items()]
    return '<nav class="category-nav" aria-label="Product collections">' + ''.join(f'<a href="{prefix}{path}"'+(' aria-current="page"' if slug == active else '')+f'>{label}</a>' for path, label, slug in items) + '</nav>'


def product_photo(p):
    return p.get('photo_slug', p['slug'])


def product_card(p, prefix='', brief=False):
    return f'''<a class="product-card" href="{prefix}products/{p['slug']}.html">
{photo(product_photo(p), prefix, extra='product-shot')}<div class="card-meta">{e('4 oz & 8 oz jars' if p.get('parent_slug') else p['display_size'])}</div>
<div class="card-title"><h3>{e(p['name'])}</h3><span class="price" data-product-price="{p['slug']}">{e(p['price'])}</span></div><span class="stock-note" data-stock="{p['slug']}"></span>
{'' if brief else '<p>'+e(p['description'])+'</p>'}<span class="text-link">Take a closer look</span></a>'''


def render_home():
    cats = ''.join(f'<a class="category-card" href="products/{slug}.html">{photo(v[3], extra="category-shot")}<h3>{v[0].replace("Whipped ", "")}</h3><p>{v[4]}</p></a>' for slug, v in CATEGORIES.items())
    features = ''
    for slug in ['jasmine-body-oil', 'jasmine-whipped-body-butter']:
        p = BY_SLUG[slug]
        features += f'<a class="feature-card" href="products/{slug}.html">{photo(product_photo(p), extra="product-shot")}<div class="card-title"><h3>{p["name"]}</h3><span class="price" data-product-price="{slug}">{p["price"]}</span></div><p>{e(p["description"])}</p><span class="text-link">Meet the {"oil" if p["category"] == "body-oils" else "butter"}</span></a>'
    body = f'''<section class="hero"><div class="wrap hero-grid"><div>
<p class="eyebrow">Charlottesville, Virginia · Small-batch body care</p><h1>A little care,<br><em>just for you.</em></h1>
<p class="lead">Soft skin. Scents you look forward to. Small moments that feel like yours. Discover our CBD salves and roll-on, body oils, mists, balms, and whipped butters, made by hand in Virginia. Shop online or find our table at a Charlottesville market.</p>
<div class="actions"><a class="button" href="products.html">Find your favorite</a><a class="text-link" href="about.html">Meet the maker</a></div>
<p class="hero-note">Woman-owned &nbsp;·&nbsp; Made in small batches</p></div>
<figure class="hero-photo">{photo('category-body-oils', eager=True, extra='category-shot')}<figcaption class="photo-caption"><span>Four scents. One simple oil blend.</span>Meadowfoam + jojoba</figcaption></figure></div></section>
<section class="section section-border"><div class="wrap"><div class="section-head"><div><p class="eyebrow">The collection</p><h2>What we make.</h2></div><a class="text-link" href="products.html">Browse all products</a></div><div class="collection-grid">{cats}</div></div></section>
<section class="section search-wash"><div class="wrap search-content"><p class="eyebrow">From Virginia, with care</p><h2>CBD salves &amp; roll-on.<br>Find your everyday format.</h2><p class="lead">Choose a 2 oz CBD salve with 1,000 mg CBD, a 4 oz salve with 2,000 mg CBD, or a 10 mL CBD Roll-On with 1,000 mg CBD. Read the ingredients, compare textures, and find us at a scheduled Charlottesville market.</p><div class="actions"><a class="button" href="products/cbd-salves.html">Explore CBD salves</a><a class="text-link" href="products/cbd-roll-on.html">Meet the CBD roll-on</a><a class="text-link" href="cbd-charlottesville.html">Find us in Charlottesville</a></div><p class="small"><a href="cbd-salve-vs-roll-on.html">Not sure which format to choose? Compare salve and roll-on.</a></p></div></section>
<section class="section roll-on-section"><div class="wrap roll-on-feature"><a class="roll-on-photo" href="products/cbd-roll-on.html">{photo('cbd-roll-on', extra='product-shot')}</a><div><p class="eyebrow">Meet your new everyday companion</p><h2>A little care.<br>Ready to roll.</h2><p class="lead">Cooling menthol. Silky oils. A fresh hint of eucalyptus and lavender. Our new CBD Roll-On puts your favorite small moment of care in a bottle that goes where you do.</p><p>1,000 mg CBD · 10 mL · <span data-product-price="cbd-roll-on">$26</span></p><a class="button" href="products/cbd-roll-on.html">Meet the CBD Roll-On</a></div></div></section>
<section class="section jasmine-section"><div class="wrap"><div class="section-head"><div><p class="eyebrow">Jasmine &amp; ylang ylang</p><h2>Oil or butter?</h2></div><p>A few drops of oil on damp skin, or a small scoop of butter for the dry spots. The same floral scent, in two different textures.</p></div><div class="feature-grid">{features}</div></div></section>
<section class="section" id="market-calendar"><div class="wrap market-grid"><figure>{photo('market')}<figcaption class="photo-caption">A day at the market with Blue Koi.</figcaption></figure><div class="market-copy"><p class="eyebrow">A small Virginia business</p><h2>Come say hello.</h2><p class="lead">There’s something nice about trying a scent in person and talking to the person who made it. We bring Blue Koi to markets around Charlottesville.</p><p><a class="text-link" href="cbd-charlottesville.html">Market locations &amp; visiting details</a></p></div>{render_market_calendar()}</div></section>'''
    page('index.html', 'Virginia CBD Salve, Roll-On & Handmade Body Care', 'Shop Virginia-made CBD salve, roll-on and handmade body care from Blue Koi Botanicals. Find us at Charlottesville markets or order online.', body, 'index.html')


def render_products():
    sections = ''
    for slug, v in CATEGORIES.items():
        cards = ''.join(product_card(p) for p in LISTED_PRODUCTS if p['category'] == slug)
        sections += f'<section id="{slug}" class="catalog-category"><div class="section-head"><div><h2>{v[0]}</h2><p>{v[1]}</p></div><a class="text-link" href="products/{slug}.html">About our {v[0].lower()}</a></div><div class="product-grid">{cards}</div></section>'
    body = f'<section class="page-top"><div class="wrap"><p class="eyebrow">Our products</p><h1>The Blue Koi collection.</h1><p class="lead">Something for dry hands, a favorite scent after a shower, or a lip balm to keep close. Here’s the whole Blue Koi collection.</p>{category_nav()}</div></section><div class="wrap product-section">{sections}<p class="shop-note">Orders process in 1–3 days. Choose your delivery service and see current shipping rates at checkout.</p></div>'
    page('products.html', 'Our Products', 'Find your daily favorites: handmade body oils, CBD salves and roll-on, magnesium mists, lip balms, and whipped body butters.', body)
    for slug, v in CATEGORIES.items():
        selected = [p for p in LISTED_PRODUCTS if p['category'] == slug]
        cards = ''.join(product_card(p, '../') for p in selected)
        grid = 'product-grid pair' if len(selected) == 2 else 'product-grid'
        body = f'<section class="page-top"><div class="wrap"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="../index.html">Home</a><span aria-hidden="true">/</span><a href="../products.html">Products</a><span aria-hidden="true">/</span><span>{v[0]}</span></nav><p class="eyebrow">{v[4]}</p><h1>{v[0]}</h1><p class="lead">{v[2]}</p>{category_nav("../", slug)}</div></section><section class="product-section"><div class="wrap"><div class="{grid}">{cards}</div><p class="shop-note">Choose your products here, then see shipping options and tax at checkout.</p></div></section>'
        title, description = v[0], v[2]
        if slug in ('cbd-salves', 'cbd-roll-ons'):
            title = 'CBD Salves Made in Virginia' if slug == 'cbd-salves' else 'Virginia CBD Roll-On · 1,000 mg CBD'
            description = 'Compare 2 oz (1,000 mg CBD) and 4 oz (2,000 mg CBD) salves handmade in Virginia. Shop online or find Blue Koi at Charlottesville markets.' if slug == 'cbd-salves' else 'Explore Blue Koi’s 10 mL CBD roll-on with 1,000 mg CBD, MCT and jojoba oils. Made in Virginia; shop online or find us in Charlottesville.'
            body = body.replace('<h1>'+v[0]+'</h1>', '<h1>'+v[0]+', made in Virginia.</h1>')
            body += local_product_note(BY_SLUG['cbd-salve' if slug == 'cbd-salves' else 'cbd-roll-on'])
        page('products/'+slug+'.html', title, description, body)


def details(title, content, opened=False):
    return f'<details{" open" if opened else ""}><summary>{title}</summary><div class="details-body">{content}</div></details>'


def product_gallery(p):
    primary = photo(product_photo(p), '../', True, 'product-shot')
    panels = f'<div data-gallery-panel="0" id="product-photo-0">{primary}</div>'
    filename, alt, _, _ = PHOTOS[product_photo(p)]
    buttons = f'<button type="button" data-gallery-select="0" aria-pressed="true" aria-controls="product-photo-0" aria-label="Show product photo"><img src="../assets/photos/{filename}" alt="" loading="lazy"><span>Product</span></button>'
    for i, filename in enumerate(STICKERS.get(p.get('parent_slug', p['slug']), []), 1):
        label = ('Front label' if i == 1 else 'Back label') if p['category'] == 'cbd-salves' else 'Label'
        src = '../assets/stickers/' + filename
        panels += f'<div data-gallery-panel="{i}" id="product-photo-{i}" hidden><a class="sticker-preview" href="{src}" target="_blank" rel="noopener"><img src="{src}" alt="{e(p["name"])} — {label.lower()}" loading="lazy"></a><p class="gallery-caption"><a href="{src}" target="_blank" rel="noopener">View full-size {label.lower()} ↗</a></p></div>'
        buttons += f'<button type="button" data-gallery-select="{i}" aria-pressed="false" aria-controls="product-photo-{i}" aria-label="Show {label.lower()}"><img src="{src}" alt="" loading="lazy"><span>{label}</span></button>'
    return f'<figure class="detail-image" data-product-gallery>{panels}<div class="gallery-thumbnails" aria-label="Product images">{buttons}</div></figure>'


def render_detail(p):
    slug = p['slug']
    category = CATEGORIES[p['category']][0]
    selected = [x for x in LISTED_PRODUCTS if x['category'] == p['category']]
    variants = ''
    for x in selected:
        label = x['display_size'] if p['category'] == 'cbd-salves' else x['name'].replace(' Whipped Body Butter', '').replace(' Magnesium Body Mist', '').replace(' Body Oil', '').replace(' Lip Balm', '')
        variants += f'<a href="{x["slug"]}.html"'+(' aria-current="page"' if x['slug'] == slug else '')+f'>{e(label)}</a>'
    variant_label = 'Choose a size' if p['category'] == 'cbd-salves' else 'Choose your scent'
    ingredients = '<ul class="ingredients">'+''.join('<li>'+e(x)+'</li>' for x in p['ingredients'])+'</ul>' if p['ingredients'] else '<p>Contact us for the full ingredient list.</p>'
    info = details('How to use', '<p>'+e(p['use'])+'</p>', True)
    info += details('Ingredients', ingredients)
    storage = p['storage'] or ('Keep in a cool, dry place, away from direct sunlight.' if p['category'] in ['body-butters', 'lip-balms'] else '')
    care = ('<p>'+e(storage)+'</p>' if storage else '') + '<p>'+e(p['warning'])+'</p>'
    info += details('Storage & care', care)
    lab = '<div class="lab-note"><a class="lab-link" href="../assets/coa/R251119MS08MS126_COA.pdf" target="_blank" rel="noopener noreferrer">Read the CBD isolate ingredient report (PDF)</a><p class="small muted">This report covers an ingredient sample, not a finished Blue Koi product. <a href="../cbd-lab-reports.html">See report details and ask about your batch.</a></p></div>' if p['category'] == 'cbd-salves' else ''
    related = [x for x in LISTED_PRODUCTS if x['slug'] != slug and (x['category'] == p['category'] or (p['cbd'] and x['cbd']))][:3]
    cards = ''.join(product_card(x, '../', True) for x in related)
    variant_nav = f'<div class="variants"><p class="variants-label">{variant_label}</p><nav class="variant-list" aria-label="{variant_label}">{variants}</nav></div>' if len(selected) > 1 else ''
    highlights = '<ul class="product-highlights">' + ''.join('<li>'+e(x)+'</li>' for x in p.get('highlights', [])) + '</ul>' if p.get('highlights') else ''
    sizes = ''
    if p['category'] == 'body-butters':
        sizes = '<fieldset class="size-selector"><legend>Choose your jar size</legend><div class="size-options">'
        for oz in (8, 4):
            item = BY_SLUG[slug if oz == 8 else slug + '-4oz']
            sizes += f'<label class="size-option"><input type="radio" name="jar-size" value="{oz}" data-size-slug="{item["slug"]}"{" checked" if oz == 8 else ""}><span><strong>{oz} oz jar</strong><span data-option-price="{item["slug"]}">{e(item["price"])}</span><small data-option-stock="{item["slug"]}"></small></span></label>'
        sizes += '</div></fieldset><p class="size-upgrade" data-size-upgrade>Double the butter for $8 more</p><p class="small muted">Sizes refer to jar capacity, not net product weight.</p>'
    body = f'''<section class="product-detail wrap" data-product-detail="{slug}"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="../index.html">Home</a><span aria-hidden="true">/</span><a href="../products.html">Products</a><span aria-hidden="true">/</span><a href="{p['category']}.html">{category}</a><span aria-hidden="true">/</span><span>{e(p["name"])}</span></nav>
<div class="detail-grid">{product_gallery(p)}
<article class="detail-copy"><p class="eyebrow">{category}</p><h1>{e(p['name'])}</h1><div class="product-spec"><span class="price" data-product-price="{slug}">{e(p['price'])}</span><span class="muted" data-selected-size>{e(p['display_size'])}</span></div>
<p class="lead">{e(p['description'])}</p>{highlights}
{variant_nav}
{sizes}
<div class="buy-row"><label class="field purchase-quantity">Quantity<input type="number" value="1" min="1" max="12" step="1" id="product-quantity"></label><button class="button" type="button" data-add-product="{slug}" disabled>Loading…</button><a class="text-link" href="../contact.html">Ask us a question</a></div><p class="stock-note" data-stock="{slug}"></p><p class="small">Ships in 1–3 days. U.S. delivery only. {'CBD delivery to all 50 states and Washington, D.C.' if p['cbd'] else ''} <a href="../shipping-returns.html">Shipping &amp; returns</a></p>
<div class="product-story"><h2>A closer look</h2><p class="body-copy">{e(p['body'])}</p></div><div class="details-list">{info}</div>{lab}</article></div></section>
<section class="review-section"><div class="wrap"><h2>From our customers.</h2><div data-reviews="{slug}"><p class="muted">Loading purchase reviews…</p></div><p class="small muted">After your order ships, we’ll email you a private link to share your experience.</p></div></section>
<section class="related"><div class="wrap"><div class="section-head"><h2>{'More CBD favorites.' if p['cbd'] else 'Also in this collection.'}</h2><a class="text-link" href="{'../products.html' if p['cbd'] else p['category']+'.html'}">View the collection</a></div><div class="product-grid">{cards}</div></div></section>'''
    title, description = p['name'], p['description']
    if p['cbd']:
        body += local_product_note(p)
        title = p['name'] + (' · 1,000 mg CBD' if slug == 'cbd-roll-on' else ' · Virginia Made')
        description = f"{p['name']} ({p['display_size']}), handmade in Virginia by Blue Koi Botanicals. See ingredients and directions; buy online or visit our Charlottesville markets."
    page('products/'+slug+'.html', title, description, body)


def render_story():
    body = f'''<section class="wrap story-grid"><figure class="story-portrait">{photo('gwyn', eager=True)}<figcaption class="photo-caption">Gwyn · Owner &amp; maker</figcaption></figure><div class="story-copy"><p class="eyebrow">The person behind Blue Koi</p><h1>It started<br>with my mom.</h1><p class="lead">I learned to make body care through my mom’s business in Colorado. When I started Blue Koi Botanicals, I brought those skills with me.</p><p>Today, I make our products in small batches here in Virginia: oils, salves, mists, lip balms, and whipped butters. Some are lightly floral, some are woodsy, and there’s an unscented butter if you prefer to keep things simple.</p><p>If you’ve stopped by our market table, thank you. If we haven’t met yet, I’d love for you to try something and let me know what you think.</p><p class="story-signature">Gwyn</p><div class="actions"><a class="button" href="products.html">See what I make</a><a class="text-link" href="contact.html">Say hello</a></div></div></section>
<section class="section jasmine-section"><div class="wrap"><div class="section-head"><h2>A few things about Blue Koi.</h2></div><div class="principles"><div class="principle"><h3>Small batches.</h3><p>We blend, pour, and fill by hand.</p></div><div class="principle"><h3>Ingredients you can check.</h3><p>Every product page has its ingredient list and directions. If there’s something you need to avoid, take a look or ask us before ordering.</p></div><div class="principle"><h3>A person you can reach.</h3><p>Have a question about a scent or texture? Send us a note. We’re happy to help you find your favorite.</p></div></div></div></section>
'''
    page('about.html', 'Our Story', 'Meet Gwyn, the maker behind Blue Koi Botanicals. She learned to make body care through her mom’s business in Colorado and now makes small batches in Virginia.', body, 'about.html')


def render_contact():
    body = f'''<section class="wrap contact-layout"><div class="contact-intro"><p class="eyebrow">Contact</p><h1>Let’s talk.</h1><p class="lead">Not sure which scent to choose? Have a question about an order? Send us a note. We’re happy to help.</p>
<dl class="contact-methods"><div class="contact-method"><dt>Email us</dt><dd><a href="mailto:{EMAIL}">{EMAIL}</a></dd></div><div class="contact-method"><dt>Find us</dt><dd>Charlottesville, Virginia<br><a class="small" href="cbd-charlottesville.html">Market locations, dates &amp; local buying options</a></dd></div></dl><p class="contact-note">For an order question, include your order number. If you’re asking about a particular product, its name and batch code are helpful.</p><p class="contact-note">For shop, wholesale, or collaboration inquiries, send us a note about what you have in mind.</p></div>
<div class="contact-founder contact-founder-note"><p class="founder-label">Gwyn · Owner &amp; maker</p><h2>Hi, I’m Gwyn.</h2><p>I learned to make these products through my mom’s business in Colorado. Now I make Blue Koi’s body care in small batches here in Virginia, using the skills she taught me.</p><p>Whether we met at the market or you found us online, I’m glad you’re here.</p><a class="text-link" href="about.html">A little more about Blue Koi</a></div></section>
<section class="section contact-market"><div class="wrap market-grid"><figure>{photo('market')}<figcaption class="photo-caption">Our Blue Koi table at a local market.</figcaption></figure><div class="market-copy"><p class="eyebrow">Around Charlottesville</p><h2>Meet us at the market.</h2><p class="lead">Come smell the oils, try a sample, and ask a few questions. Find your next visit on our market calendar.</p><div class="actions"><a class="button" href="index.html#market-calendar">See the market calendar</a></div></div></div></section>'''
    page('contact.html', 'Contact us', 'Contact us at Blue Koi Botanicals for product questions, orders, local markets, and wholesale inquiries. Based in Charlottesville, Virginia.', body, 'contact.html')


def stage():
    dist = ROOT / 'dist'
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir()
    for f in ROOT.glob('*.html'):
        shutil.copy2(f, dist / f.name)
    for filename in ['robots.txt', 'sitemap.xml']:
        shutil.copy2(ROOT / filename, dist / filename)
    for directory in ['css', 'js', 'products']:
        shutil.copytree(ROOT / directory, dist / directory)
    (dist / 'assets').mkdir()
    for directory in ['photos', 'coa', 'stickers']:
        shutil.copytree(ROOT / 'assets' / directory, dist / 'assets' / directory)
    shutil.copy2(ROOT / 'assets/logo.png', dist / 'assets/logo.png')
    public = [{**{k:p[k] for k in ('slug','name','display_size','price_cents','stock_snapshot','online_enabled','cbd')}, 'parent_slug':p.get('parent_slug'), 'jar_capacity_oz':p.get('jar_capacity_oz'), 'image':'assets/photos/'+PHOTOS[product_photo(p)][0]} for p in PRODUCTS]
    (dist / 'catalog.json').write_text(json.dumps(public), encoding='utf-8')
    (ROOT / 'catalog.json').write_text(json.dumps(public), encoding='utf-8')


if __name__ == '__main__':
    render_home()
    render_products()
    for product in LISTED_PRODUCTS:
        render_detail(product)
    aliases = {'magnesium-spray': 'rose-magnesium-spray', 'magnesium-facial-toner': 'lavender-magnesium-spray'}
    aliases.update({p['slug']: p['parent_slug'] + '?size=4' for p in PRODUCTS if p.get('parent_slug', p['slug']) != p['slug']})
    for source, destination in aliases.items():
        parent, _, query = destination.partition('?')
        target = absolute('products/' + parent + '.html') + ('?' + query if query else '')
        canonical = absolute('products/' + parent + '.html')
        (ROOT / 'products' / (source + '.html')).write_text(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url={e(target)}"><title>Product updated | Blue Koi Botanicals</title><link rel="canonical" href="{canonical}"></head><body><a href="{e(target)}">View the product</a></body></html>', encoding='utf-8')
    render_story()
    render_contact()
    render_commerce_pages(page, json.loads((ROOT / 'content/store.json').read_text(encoding='utf-8')))
    render_search_pages(page, BY_SLUG, product_card, photo)
    write_discovery()
    stage()
    print(f'Built {len(list(ROOT.glob("*.html"))) + len(list((ROOT / "products").glob("*.html")))} static pages and staged public assets.')
