// Keep search URLs consistent with Cloudflare's extensionless asset routes.
// Commerce/API requests retain their existing URLs and request semantics.
const privateNames = new Set(['admin', 'review', 'order', 'checkout', 'cart']);
export function isPrivatePage(pathname) {
  return privateNames.has(pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.html$/, ''));
}

export function canonicalRedirect(request, products) {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || isPrivatePage(url.pathname)) return null;
  const source = url.pathname.replace(/\/$/, '').replace(/\.html$/, '');
  const publicPaths = new Set(['', '/index', '/products', '/about', '/contact', '/privacy', '/shipping-returns',
    '/cbd-charlottesville', '/cbd-salve-vs-roll-on', '/cbd-lab-reports',
    ...products.flatMap(p => ['/products/' + p.slug, '/products/' + p.category])]);
  const aliases = new Map([
    ['/products/magnesium-spray', '/products/rose-magnesium-spray'],
    ['/products/magnesium-facial-toner', '/products/lavender-magnesium-spray'],
    ...products.filter(p => p.parent_slug && p.parent_slug !== p.slug)
      .map(p => ['/products/' + p.slug, '/products/' + p.parent_slug + '?size=4'])
  ]);
  let target;
  if (aliases.has(source)) {
    const destination = new URL(aliases.get(source), url.origin);
    url.pathname = destination.pathname;
    for (const [key, value] of destination.searchParams) url.searchParams.set(key, value);
    target = url.href;
  } else if (publicPaths.has(source)) {
    url.pathname = source === '' || source === '/index' ? '/' : source;
    if (url.href !== request.url) target = url.href;
  }
  return target ? new Response(null, {status: 301, headers: {Location: target}}) : null;
}
