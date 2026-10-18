"""Shared search metadata. Public canonical URLs match Cloudflare's clean URLs.

Product facts come from the same records as the visible page. Live Square prices,
stock and customer ratings are deliberately not frozen into structured data.
"""
import json
import posixpath
import re
from html import escape
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from xml.etree.ElementTree import Element, SubElement, ElementTree, register_namespace

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'content/seo.json').read_text(encoding='utf-8'))
ORIGIN = CONFIG['site_url'].rstrip('/')
PRIVATE = {'cart.html', 'checkout.html', 'order.html', 'admin.html', 'review.html', '404.html'}
PAGES = {}


def canonical_path(path):
    return '/' if path == 'index.html' else '/' + path.removesuffix('.html')


def absolute(path):
    return ORIGIN + canonical_path(path)


def script_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


def page_head(path, title, description, image='assets/photos/market.jpeg', product=None,
              breadcrumbs=None, collection=False):
    url = absolute(path)
    PAGES[path] = {'title': title, 'description': description, 'url': url}
    public = path not in PRIVATE
    robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' if public else 'noindex,follow'
    tags = [f'<link rel="canonical" href="{escape(url, quote=True)}">',
            f'<meta name="robots" content="{robots}">']
    if CONFIG.get('google_site_verification'):
        tags.append(f'<meta name="google-site-verification" content="{escape(CONFIG["google_site_verification"], quote=True)}">')
    for prop, value in {'og:type': 'website', 'og:site_name': CONFIG['business_name'],
                        'og:title': title + ' | ' + CONFIG['business_name'],
                        'og:description': description, 'og:url': url,
                        'og:locale': 'en_US', 'og:image': ORIGIN + '/' + image,
                        'og:image:alt': product['name'] if product else 'Blue Koi Botanicals, handmade body care in Virginia'}.items():
        tags.append(f'<meta property="{prop}" content="{escape(value, quote=True)}">')
    tags.append('<meta name="twitter:card" content="summary_large_image">')
    if not public:
        return '\n'.join(tags)
    org_id, site_id, page_id = ORIGIN + '/#organization', ORIGIN + '/#website', url + '#webpage'
    graph = [{
        '@type': 'Organization', '@id': org_id, 'name': CONFIG['business_name'],
        'legalName': CONFIG['legal_name'], 'url': ORIGIN + '/',
        'logo': ORIGIN + '/assets/logo.png', 'email': CONFIG['email'],
        # A market is not a permanent storefront. Do not publish a residential address.
        'address': {'@type': 'PostalAddress', 'addressLocality': CONFIG['locality'],
                    'addressRegion': CONFIG['region'], 'addressCountry': CONFIG['country']},
        'sameAs': CONFIG['same_as']
    }, {'@type': 'WebSite', '@id': site_id, 'url': ORIGIN + '/',
        'name': CONFIG['business_name'], 'publisher': {'@id': org_id}, 'inLanguage': 'en-US'},
        {'@type': 'CollectionPage' if collection else 'WebPage', '@id': page_id,
         'url': url, 'name': title, 'description': description,
         'isPartOf': {'@id': site_id}, 'publisher': {'@id': org_id}, 'inLanguage': 'en-US'}]
    webpage = graph[-1]
    if product:
        product_id = url + '#product'
        webpage['mainEntity'] = {'@id': product_id}
        graph.append({'@type': 'Product', '@id': product_id, 'name': product['name'],
                      'url': url, 'description': product['description'],
                      'image': ORIGIN + '/' + image, 'sku': product['slug'],
                      'brand': {'@type': 'Brand', 'name': CONFIG['business_name']},
                      'size': product['display_size'],
                      'mainEntityOfPage': {'@id': page_id}})
    if breadcrumbs:
        crumb_id = url + '#breadcrumb'
        webpage['breadcrumb'] = {'@id': crumb_id}
        graph.append({'@type': 'BreadcrumbList', '@id': crumb_id,
                      'itemListElement': [
                          {'@type': 'ListItem', 'position': n, 'name': label, 'item': absolute(target)}
                          for n, (label, target) in enumerate(breadcrumbs, 1)]})
    tags.append('<script type="application/ld+json">' + script_json({'@context': 'https://schema.org', '@graph': graph}) + '</script>')
    return '\n'.join(tags)


def clean_public_links(doc, page_path):
    """Avoid a redirect for public navigation; preserve commerce URL contracts."""
    def convert(match):
        value = match.group(1)
        parts = urlsplit(value)
        if parts.scheme or parts.netloc or not parts.path.endswith('.html'):
            return match.group(0)
        target = posixpath.normpath(posixpath.join(posixpath.dirname(page_path), parts.path)).lstrip('/')
        if target in PRIVATE:
            return match.group(0)
        return 'href="' + urlunsplit(('', '', canonical_path(target), parts.query, parts.fragment)) + '"'
    return re.sub(r'href="([^"]+)"', convert, doc)


def write_discovery():
    ns = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    register_namespace('', ns)
    root = Element(f'{{{ns}}}urlset')
    for path, data in sorted(PAGES.items()):
        if path in PRIVATE:
            continue
        node = SubElement(root, f'{{{ns}}}url')
        SubElement(node, f'{{{ns}}}loc').text = data['url']
    # No synthetic lastmod dates: ordinary rebuilds are not content updates.
    ElementTree(root).write(ROOT / 'sitemap.xml', encoding='utf-8', xml_declaration=True)
    (ROOT / 'robots.txt').write_text('User-agent: *\nAllow: /\n\nSitemap: ' + ORIGIN + '/sitemap.xml\n', encoding='utf-8')
