#!/usr/bin/env python3
"""Build the static GitHub Pages site from the shared templates and product data."""
from pathlib import Path
from html import escape
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = json.loads((ROOT / 'content/products.json').read_text())
BY_SLUG = {p['slug']: p for p in PRODUCTS}
SHOP = 'https://blue-koi-botanicals-llc.square.site'
EMAIL = 'blue.koi.botanicals@gmail.com'
CATEGORIES = {
    'cbd-salves': ('CBD Salves', 'Two sizes. Same cooling balm.', 'Coconut oil, shea butter, and beeswax make a firm balm that softens as you work it into your skin. Both jars use CBD isolate, with menthol, eucalyptus, and camphor for a cooling feel.', 'category-cbd-salves', '2 oz and 4 oz'),
    'body-oils': ('Body Oils', 'A few drops after a shower.', 'Our body oils start with meadowfoam and jojoba. They spread easily over damp skin and leave a light sheen. Choose from four scents, from soft florals to warm cedarwood.', 'category-body-oils', 'Four scents · 4 fl oz'),
    'magnesium-sprays': ('Magnesium Body Mists', 'Rose or lavender. Your choice.', 'Magnesium chloride, flower water, and aloe in a spray bottle. Choose rose for its fresh floral scent or lavender for a softer herbal scent. Start with a small amount and follow the directions on your bottle.', 'category-magnesium-sprays', 'Two scents · 4 fl oz'),
    'lip-balms': ('Lip Balms', 'Something for your pocket.', 'Beeswax, cocoa butter, shea butter, meadowfoam, and jojoba make a balm for dry lips. Honey Lavender is lightly sweet and floral; Lavender Spearmint has a fresh, minty scent.', 'category-lip-balms', 'Two blends · 0.19 oz'),
    'body-butters': ('Whipped Body Butters', 'For the spots that need more moisture.', 'Shea and cocoa butters, whipped with meadowfoam and jojoba oils for a rich texture. A small scoop is plenty to start with. Choose lavender, jasmine, cedarwood vanilla, or no added scent.', 'category-body-butters', 'Four choices · 4 oz'),
}
PHOTOS = {
    'category-cbd-salves': ('category-cbd-salves.jpeg', 'Blue Koi CBD Salves in 2 oz and 4 oz jars', '1122', '1402'),
    'category-body-oils': ('category-body-oils.jpeg', 'Blue Koi body oils in Jasmine, Eucalyptus, Cedarwood Vanilla, and Lavender', '1122', '1402'),
    'category-magnesium-sprays': ('category-magnesium-sprays.jpeg', 'Blue Koi Rose and Lavender Magnesium Body Mists', '1122', '1402'),
    'category-lip-balms': ('category-lip-balms.jpeg', 'Blue Koi Lavender Spearmint and Honey Lavender Lip Balms', '1122', '1402'),
    'category-body-butters': ('category-body-butters.jpeg', 'Blue Koi Whipped Body Butters in four scents', '1122', '1402'),
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


def e(value):
    return escape(str(value), quote=True)


def photo(key, prefix='', eager=False, extra=''):
    name, alt, width, height = PHOTOS[key]
    loading = 'eager' if eager else 'lazy'
    priority = ' fetchpriority="high"' if eager else ''
    return f'<div class="photo photo-{key} {extra}"><img src="{prefix}assets/photos/{name}" alt="{e(alt)}" width="{width}" height="{height}" loading="{loading}" decoding="async"{priority}></div>'


def nav(prefix, active):
    items = [('index.html', 'Home'), ('products.html', 'Products'), ('about.html', 'Our story'), ('contact.html', 'Contact')]
    links = ''.join(f'<li><a href="{prefix}{url}"'+(' aria-current="page"' if active == url else '')+f'>{label}</a></li>' for url, label in items)
    return f'''<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><nav class="nav wrap" aria-label="Main navigation">
<a class="brand" href="{prefix}index.html" aria-label="Blue Koi Botanicals home"><img src="{prefix}assets/logo.png" alt="" width="68" height="68"><span class="brand-name">Blue Koi<small>Botanicals</small></span></a>
<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="main-navigation">Menu</button>
<ul id="main-navigation" class="nav-links">{links}<li class="shop-nav"><a class="button" href="{SHOP}" target="_blank" rel="noopener noreferrer">Shop online</a></li></ul>
</nav></header>'''


def footer(prefix):
    return f'''<footer class="site-footer"><div class="wrap">
<div class="footer-top"><div><a class="footer-brand" href="{prefix}index.html">Blue Koi Botanicals</a><p>Body care made by hand in Virginia.<br>Thanks for supporting a small business.</p></div>
<ul class="footer-links"><li><a href="{prefix}products.html">Our products</a></li><li><a href="{prefix}about.html">Our story</a></li><li><a href="{prefix}contact.html">Contact Gwyn</a></li><li><a href="{SHOP}" target="_blank" rel="noopener noreferrer">Shop online</a></li></ul>
<div><div class="footer-label">Have a question?</div><a class="footer-email" href="mailto:{EMAIL}">{EMAIL}</a><p>Based in Charlottesville, Virginia.</p></div></div>
<div class="footer-bottom"><p>© 2026 Blue Koi Botanicals LLC</p><p>For external use only. Statements on this site have not been evaluated by the FDA. Products are not intended to diagnose, treat, cure, or prevent disease.</p></div>
</div></footer>'''


def page(path, title, description, body, active='products.html'):
    prefix = '../' if path.startswith('products/') else ''
    doc = f'''<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | Blue Koi Botanicals</title><meta name="description" content="{e(description)}">
<meta name="theme-color" content="#173d52"><link rel="icon" type="image/png" href="{prefix}assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="{prefix}css/styles.css"><script defer src="{prefix}js/site.js"></script>
</head><body>{nav(prefix, active)}<main id="main">{body}</main>{footer(prefix)}</body></html>'''
    (ROOT / path).write_text(doc + '\n')


def category_nav(prefix='', active=''):
    items = [('products.html', 'All products', '')] + [(f'products/{slug}.html', values[0].replace('Whipped ', ''), slug) for slug, values in CATEGORIES.items()]
    return '<nav class="category-nav" aria-label="Product collections">' + ''.join(f'<a href="{prefix}{path}"'+(' aria-current="page"' if slug == active else '')+f'>{label}</a>' for path, label, slug in items) + '</nav>'


def product_photo(p):
    return p['slug']


def product_card(p, prefix='', brief=False):
    return f'''<a class="product-card" href="{prefix}products/{p['slug']}.html">
{photo(product_photo(p), prefix, extra='product-shot')}<div class="card-meta">{e(p['display_size'])}</div>
<div class="card-title"><h3>{e(p['name'])}</h3><span class="price">{e(p['price'])}</span></div>
{'' if brief else '<p>'+e(p['description'])+'</p>'}<span class="text-link">Take a closer look</span></a>'''


def render_home():
    cats = ''.join(f'<a class="category-card" href="products/{slug}.html">{photo(v[3], extra="category-shot")}<h3>{v[0].replace("Whipped ", "")}</h3><p>{v[4]}</p></a>' for slug, v in CATEGORIES.items())
    features = ''
    for slug in ['jasmine-body-oil', 'jasmine-whipped-body-butter']:
        p = BY_SLUG[slug]
        features += f'<a class="feature-card" href="products/{slug}.html">{photo(product_photo(p), extra="product-shot")}<div class="card-title"><h3>{p["name"]}</h3><span class="price">{p["price"]}</span></div><p>{e(p["description"])}</p><span class="text-link">Meet the {"oil" if p["category"] == "body-oils" else "butter"}</span></a>'
    body = f'''<section class="hero"><div class="wrap hero-grid"><div>
<p class="eyebrow">Handmade in Virginia</p><h1>Body care,<br><em>made by hand.</em></h1>
<p class="lead">We make body oils, salves, balms, and butters in small batches here in Virginia. Take a look around, or come say hello at the market.</p>
<div class="actions"><a class="button" href="products.html">Find your favorite</a><a class="text-link" href="about.html">Meet the maker</a></div>
<p class="hero-note">Woman-owned &nbsp;·&nbsp; Made in small batches</p></div>
<figure class="hero-photo">{photo('category-body-oils', eager=True, extra='category-shot')}<figcaption class="photo-caption"><span>Four scents. One simple oil blend.</span>Meadowfoam + jojoba</figcaption></figure></div></section>
<section class="section section-border"><div class="wrap"><div class="section-head"><div><p class="eyebrow">The collection</p><h2>What we make.</h2></div><a class="text-link" href="products.html">Browse all products</a></div><div class="collection-grid">{cats}</div></div></section>
<section class="section jasmine-section"><div class="wrap"><div class="section-head"><div><p class="eyebrow">Jasmine &amp; ylang ylang</p><h2>Oil or butter?</h2></div><p>A few drops of oil on damp skin, or a small scoop of butter for the dry spots. The same floral scent, in two different textures.</p></div><div class="feature-grid">{features}</div></div></section>
<section class="section"><div class="wrap market-grid"><figure>{photo('market')}<figcaption class="photo-caption">A day at the market with Blue Koi.</figcaption></figure><div class="market-copy"><p class="eyebrow">A small Virginia business</p><h2>Come say hello.</h2><p class="lead">There’s something nice about trying a scent in person and talking to the person who made it. We bring Blue Koi to markets around Charlottesville.</p><p class="muted">Send Gwyn a note to find out where we’ll be next, or ask about a product you’ve had your eye on.</p><a class="text-link" href="contact.html">Get in touch</a></div></div></section>'''
    page('index.html', 'Handmade Body Care in Virginia', 'Body oils, CBD salves, lip balms, magnesium mists, and whipped body butters made by Gwyn in small batches in Virginia.', body, 'index.html')


def render_products():
    sections = ''
    for slug, v in CATEGORIES.items():
        cards = ''.join(product_card(p, brief=True) for p in PRODUCTS if p['category'] == slug)
        sections += f'<section id="{slug}" class="catalog-category"><div class="section-head"><div><h2>{v[0]}</h2><p>{v[1]}</p></div><a class="text-link" href="products/{slug}.html">About our {v[0].lower()}</a></div><div class="product-grid">{cards}</div></section>'
    body = f'<section class="page-top"><div class="wrap"><p class="eyebrow">Our products</p><h1>The Blue Koi collection.</h1><p class="lead">Something for dry hands, a favorite scent after a shower, or a lip balm to keep close. Here’s the whole Blue Koi collection.</p>{category_nav()}</div></section><div class="wrap product-section">{sections}<p class="shop-note">Orders are placed through our online shop. Check there for current stock and checkout prices.</p></div>'
    page('products.html', 'Our Products', 'Browse the Blue Koi collection: handmade body oils, CBD salves, magnesium mists, lip balms, and whipped body butters.', body)
    for slug, v in CATEGORIES.items():
        selected = [p for p in PRODUCTS if p['category'] == slug]
        cards = ''.join(product_card(p, '../') for p in selected)
        grid = 'product-grid pair' if len(selected) == 2 else 'product-grid'
        body = f'<section class="page-top"><div class="wrap"><div class="breadcrumbs"><a href="../products.html">Products</a><span aria-hidden="true">/</span><span>{v[0]}</span></div><p class="eyebrow">{v[4]}</p><h1>{v[0]}</h1><p class="lead">{v[2]}</p>{category_nav("../", slug)}</div></section><section class="product-section"><div class="wrap"><div class="{grid}">{cards}</div><p class="shop-note">Visit our online shop for current availability and checkout prices.</p></div></section>'
        page('products/'+slug+'.html', v[0], v[2], body)


def details(title, content, opened=False):
    return f'<details{" open" if opened else ""}><summary>{title}</summary><div class="details-body">{content}</div></details>'


def render_detail(p):
    slug = p['slug']
    category = CATEGORIES[p['category']][0]
    selected = [x for x in PRODUCTS if x['category'] == p['category']]
    variants = ''
    for x in selected:
        label = x['display_size'] if p['category'] == 'cbd-salves' else x['name'].replace(' Whipped Body Butter', '').replace(' Magnesium Body Mist', '').replace(' Body Oil', '').replace(' Lip Balm', '')
        variants += f'<a href="{x["slug"]}.html"'+(' aria-current="page"' if x['slug'] == slug else '')+f'>{e(label)}</a>'
    variant_label = 'Choose a size' if p['category'] == 'cbd-salves' else 'Choose your scent'
    ingredients = '<ul class="ingredients">'+''.join('<li>'+e(x)+'</li>' for x in p['ingredients'])+'</ul>'
    info = details('How to use', '<p>'+e(p['use'])+'</p>', True)
    info += details('Ingredients', ingredients)
    storage = p['storage'] or ('Keep in a cool, dry place, away from direct sunlight.' if p['category'] in ['body-butters', 'lip-balms'] else '')
    care = ('<p>'+e(storage)+'</p>' if storage else '') + '<p>'+e(p['warning'])+'</p>'
    info += details('Storage & care', care)
    lab = '<a class="lab-link" href="../assets/coa/R251119MS08MS126_COA.pdf" target="_blank" rel="noopener noreferrer">Read the CBD lab report (PDF)</a>' if p['category'] == 'cbd-salves' else ''
    related = [x for x in selected if x['slug'] != slug][:3]
    cards = ''.join(product_card(x, '../', True) for x in related)
    body = f'''<section class="product-detail wrap"><div class="breadcrumbs"><a href="../products.html">Products</a><span aria-hidden="true">/</span><a href="{p['category']}.html">{category}</a></div>
<div class="detail-grid"><figure class="detail-image">{photo(product_photo(p), '../', True, 'product-shot')}</figure>
<article class="detail-copy"><p class="eyebrow">{category}</p><h1>{e(p['name'])}</h1><div class="product-spec"><span class="price">{e(p['price'])}</span><span class="muted">{e(p['display_size'])}</span></div>
<p class="lead">{e(p['description'])}</p><p class="body-copy">{e(p['body'])}</p>
<div class="variants"><p class="variants-label">{variant_label}</p><nav class="variant-list" aria-label="{variant_label}">{variants}</nav></div>
<div class="buy-row"><a class="button" href="{SHOP}" target="_blank" rel="noopener noreferrer">Shop online</a><a class="text-link" href="../contact.html">Ask Gwyn a question</a></div><p class="small">See the shop for current stock and checkout prices.</p>
<div class="details-list">{info}</div>{lab}</article></div></section>
<section class="related"><div class="wrap"><div class="section-head"><h2>Also in this collection.</h2><a class="text-link" href="{p['category']}.html">View the collection</a></div><div class="product-grid">{cards}</div></div></section>'''
    page('products/'+slug+'.html', p['name'], p['description'], body)


def render_story():
    body = f'''<section class="wrap story-grid"><figure class="story-portrait">{photo('gwyn', eager=True)}<figcaption class="photo-caption">Gwyn · Owner &amp; maker</figcaption></figure><div class="story-copy"><p class="eyebrow">The person behind Blue Koi</p><h1>It started<br>with my mom.</h1><p class="lead">I learned to make body care through my mom’s business in Colorado. When I started Blue Koi Botanicals, I brought those skills with me.</p><p>Today, I make our products in small batches here in Virginia: oils, salves, mists, lip balms, and whipped butters. Some are lightly floral, some are woodsy, and there’s an unscented butter if you prefer to keep things simple.</p><p>If you’ve stopped by our market table, thank you. If we haven’t met yet, I’d love for you to try something and let me know what you think.</p><p class="story-signature">Gwyn</p><div class="actions"><a class="button" href="products.html">See what I make</a><a class="text-link" href="contact.html">Say hello</a></div></div></section>
<section class="section jasmine-section"><div class="wrap"><div class="section-head"><h2>A few things about Blue Koi.</h2></div><div class="principles"><div class="principle"><h3>Small batches.</h3><p>We blend, pour, and fill by hand.</p></div><div class="principle"><h3>Ingredients you can check.</h3><p>Every product page has its ingredient list and directions. If there’s something you need to avoid, take a look or ask us before ordering.</p></div><div class="principle"><h3>A person you can reach.</h3><p>Have a question about a scent or texture? Send Gwyn an email. She knows the products because she makes them.</p></div></div></div></section>
'''
    page('about.html', 'Our Story', 'Meet Gwyn, the maker behind Blue Koi Botanicals. She learned to make body care through her mom’s business in Colorado and now makes small batches in Virginia.', body, 'about.html')


def render_contact():
    body = f'''<section class="wrap contact-layout"><div class="contact-intro"><p class="eyebrow">Contact</p><h1>Let’s talk.</h1><p class="lead">Not sure which scent to choose? Have a question about an order? Send me a note. I’m happy to help.</p>
<dl class="contact-methods"><div class="contact-method"><dt>Email Gwyn</dt><dd><a href="mailto:{EMAIL}">{EMAIL}</a></dd></div><div class="contact-method"><dt>Find us</dt><dd>Charlottesville, Virginia<br><span class="muted small">Ask about our next market.</span></dd></div></dl><p class="contact-note">For an order question, include your order number. If you’re asking about a particular product, its name and batch code are helpful.</p><p class="contact-note">For shop, wholesale, or collaboration inquiries, email me a little about what you have in mind.</p></div>
<div class="contact-founder">{photo('gwyn', eager=True)}<p class="founder-label">Gwyn · Owner &amp; maker</p><h2>Hi, I’m Gwyn.</h2><p>I learned to make these products through my mom’s business in Colorado. Now I make Blue Koi’s body care in small batches here in Virginia, using the skills she taught me.</p><p>Whether we met at the market or you found us online, I’m glad you’re here.</p><a class="text-link" href="about.html">A little more about Blue Koi</a></div></section>
<section class="section contact-market"><div class="wrap market-grid"><figure>{photo('market')}<figcaption class="photo-caption">Our Blue Koi table at a local market.</figcaption></figure><div class="market-copy"><p class="eyebrow">Around Charlottesville</p><h2>Meet us at the market.</h2><p class="lead">Come smell the oils, try a sample, and ask a few questions. Email us to find out where we’ll be next.</p><div class="actions"><a class="button" href="mailto:{EMAIL}?subject=Your%20next%20market">Ask about the next market</a></div></div></div></section>'''
    page('contact.html', 'Contact Gwyn', 'Contact Gwyn at Blue Koi Botanicals for product questions, orders, local markets, and wholesale inquiries. Based in Charlottesville, Virginia.', body, 'contact.html')


def stage():
    dist = ROOT / 'dist'
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir()
    for f in ROOT.glob('*.html'):
        shutil.copy2(f, dist / f.name)
    for directory in ['css', 'js', 'products']:
        shutil.copytree(ROOT / directory, dist / directory)
    (dist / 'assets').mkdir()
    for directory in ['photos', 'coa']:
        shutil.copytree(ROOT / 'assets' / directory, dist / 'assets' / directory)
    shutil.copy2(ROOT / 'assets/logo.png', dist / 'assets/logo.png')


if __name__ == '__main__':
    render_home()
    render_products()
    for product in PRODUCTS:
        render_detail(product)
    render_story()
    render_contact()
    stage()
    print(f'Built {len(list(ROOT.glob("*.html"))) + len(list((ROOT / "products").glob("*.html")))} static pages and staged public assets.')
