import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../server/worker.mjs';
import {products} from '../server/core.mjs';
import {canonicalRedirect} from '../server/seo-routing.mjs';

test('public redirects preserve attribution, converge, and retain legacy size selection', () => {
  for (const [from, to] of [
    ['/index.html?utm_source=market', '/?utm_source=market'],
    ['/products/cbd-salve.html?utm_campaign=local', '/products/cbd-salve?utm_campaign=local'],
    ['/products/cbd-roll-on/', '/products/cbd-roll-on'],
    ['/products/lavender-whipped-body-butter-4oz.html?utm_source=google', '/products/lavender-whipped-body-butter?utm_source=google&size=4'],
    ['/products/magnesium-spray.html', '/products/rose-magnesium-spray']
  ]) {
    const result = canonicalRedirect(new Request('https://bluekoibotanicals.com' + from), products);
    assert.equal(result.status, 301);
    assert.equal(result.headers.get('location'), 'https://bluekoibotanicals.com' + to);
    assert.equal(canonicalRedirect(new Request(result.headers.get('location')), products), null, 'no redirect loop');
  }
  for (const path of ['/checkout.html', '/cart.html', '/review.html#token', '/api/webhooks/square', '/assets/logo.png', '/unknown.html']) {
    assert.equal(canonicalRedirect(new Request('https://bluekoibotanicals.com' + path), products), null);
  }
  assert.equal(canonicalRedirect(new Request('https://bluekoibotanicals.com/products/cbd-salve.html', {method:'POST'}), products), null);
});

test('both spellings of private pages are non-indexable and uncached without changing static page access', async () => {
  const env = {ASSETS:{fetch:async()=>new Response('page',{headers:{'Content-Type':'text/html'}})}};
  for (const page of ['admin', 'checkout', 'cart', 'order', 'review']) {
    for (const suffix of ['', '.html', '/']) {
      const result = await worker.fetch(new Request('https://bluekoibotanicals.com/' + page + suffix), env);
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('x-robots-tag'), 'noindex, nofollow');
      assert.equal(result.headers.get('cache-control'), 'no-store');
    }
  }
  const publicPage = await worker.fetch(new Request('https://bluekoibotanicals.com/cbd-charlottesville'), env);
  assert.equal(publicPage.headers.get('x-robots-tag'), null);
  assert.equal(publicPage.status, 200);
});

test('all sitemap entries have crawlable static content, matching metadata and unique canonical URLs', () => {
  const read = path => readFileSync(new URL('../dist/' + path, import.meta.url), 'utf8');
  const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert.ok(urls.length >= 30);
  assert.equal(new Set(urls).size, urls.length);
  const titles = new Set();
  for (const url of urls) {
    assert.ok(url.startsWith('https://bluekoibotanicals.com/'));
    assert.ok(!url.endsWith('.html'));
    const path = new URL(url).pathname;
    const html = read(path === '/' ? 'index.html' : path.slice(1) + '.html');
    assert.equal((html.match(/rel="canonical"/g)||[]).length, 1);
    assert.ok(html.includes(`rel="canonical" href="${url}"`));
    assert.equal((html.match(/<h1\b/g)||[]).length, 1);
    assert.ok(!html.includes('noindex'));
    const title = html.match(/<title>(.*?)<\/title>/s)[1];
    assert.ok(!titles.has(title), 'unique page titles'); titles.add(title);
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.ok(data['@graph'].some(n => n['@type'] === 'Organization'));
    const product = data['@graph'].find(n => n['@type'] === 'Product');
    if (product) {
      const source = products.find(p => p.slug === product.sku);
      assert.equal(product.name, source.name);
      assert.equal(product.size, source.display_size);
      assert.equal(product.offers, undefined, 'do not turn stock snapshots into live availability');
      assert.equal(product.aggregateRating, undefined, 'do not invent ratings');
    }
  }
  for (const page of ['admin', 'checkout', 'cart', 'order', 'review']) {
    assert.ok(read(page + '.html').includes('noindex'));
    assert.ok(!urls.includes('https://bluekoibotanicals.com/' + page));
  }
  assert.ok(read('robots.txt').includes('Sitemap: https://bluekoibotanicals.com/sitemap.xml'));
  assert.ok(!urls.some(u => /-4oz$/.test(u) && u.includes('butter')));
  const local = read('cbd-charlottesville.html');
  assert.ok(local.includes('522 2nd St SE'));
  assert.ok(local.includes('100 E Water Street'));
  assert.ok(local.includes('Not attending'));
  assert.ok(read('cbd-lab-reports.html').includes('not a test of a finished Blue Koi salve or roll-on'));
});
