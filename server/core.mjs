import products from '../content/products.json' with { type: 'json' };
import store from '../content/store.json' with { type: 'json' };
export { products, store };
export class StoreError extends Error {
  constructor(message, status = 400, code = 'INVALID_REQUEST') { super(message); this.status = status; this.code = code; }
}
export const fail = (message, status = 400, code) => { throw new StoreError(message, status, code); };
export const now = () => Math.floor(Date.now() / 1000);
export const uuid = () => crypto.randomUUID();
export const money = cents => (cents / 100).toFixed(2);
export async function digest(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(v => v.toString(16).padStart(2, '0')).join(''); }
export async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))));
}
export function safeEqual(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
export function clean(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function address(input = {}, billing = false) {
  const a = Object.fromEntries(['name','email','phone','street1','street2','city','state','zip','country'].map(k => [k, clean(input[k], k === 'email' ? 254 : 100)]));
  a.country = a.country.toUpperCase(); a.state = a.state.toUpperCase();
  if (!a.name || !a.street1 || !a.city || !/^[A-Z]{2}$/.test(a.country) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) fail('Enter your name, email, street address, city, and country.');
  if (a.country === 'US' && (!US_STATES.has(a.state) || !/^\d{5}(-\d{4})?$/.test(a.zip))) fail('Enter a valid U.S. state and ZIP code.');
  if (!billing && a.country !== 'US') fail('We ship only within the United States.',400,'US_ONLY');
  return a;
}
export const US_STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
export function normalizeCart(cart) {
  if (!Array.isArray(cart) || !cart.length || cart.length > store.max_items_per_order) fail('Your bag is empty or exceeds the order limit.');
  const combined = new Map();
  for (const line of cart) {
    if (!line || !products.some(p => p.slug === line.slug) || !Number.isInteger(line.quantity) || line.quantity < 1) fail('An item or quantity in your bag is invalid.');
    combined.set(line.slug, (combined.get(line.slug) || 0) + line.quantity);
  }
  if ([...combined.values()].reduce((a,b) => a+b, 0) > store.max_items_per_order) fail(`Please contact us for orders larger than ${store.max_items_per_order} items.`);
  return [...combined].sort(([a],[b]) => a.localeCompare(b)).map(([slug,quantity]) => ({slug,quantity}));
}
export function makeLines(cart, catalog) {
  return normalizeCart(cart).map(line => {
    const p = catalog.find(p => p.slug === line.slug);
    if (!p || !p.online_enabled || p.stock < line.quantity) fail(`${p?.name || 'This item'} is unavailable in the requested quantity.`, 409, 'STOCK_CHANGED');
    if (!Number.isInteger(p.price_cents) || p.price_cents <= 0) fail('A product price needs to be checked.', 503);
    return { slug: p.slug, name: p.name, size: p.display_size, quantity: line.quantity, price_cents: p.price_cents, variation_id: p.square_variation_id, cbd: p.cbd, weight_lb: p.weight_lb, package: p.package, customs_tariff_number: p.customs_tariff_number, origin_country: p.origin_country };
  });
}
export function checkDestination(lines, a) {
  if (a.country !== 'US' || !US_STATES.has(a.state)) fail('We ship only to the 50 U.S. states and Washington, D.C.',400,'US_ONLY');
  if (lines.some(p=>p.cbd) && ['CO','ID','WY'].includes(a.state)) fail('CBD products cannot ship to Colorado, Idaho, or Wyoming. Remove CBD items or use an eligible delivery address.',400,'CBD_STATE_RESTRICTED');
}
export function totals(lines, shipping, a, discount = 0) {
  if (!Number.isInteger(shipping) || shipping < 0) fail('Invalid shipping price.');
  const subtotal = lines.reduce((sum,p) => sum + p.price_cents * p.quantity, 0);
  if (!Number.isInteger(discount) || discount < 0) fail('Invalid discount.');
  discount = Math.min(discount, subtotal);
  const tax = Math.round((subtotal-discount) * store.tax.virginia_basis_points / 10000);
  return {subtotal, discount, shipping, tax, total:subtotal-discount+shipping+tax, currency:'USD'};
}
export function parcels(lines) {
  const quantity=lines.reduce((n,p)=>n+p.quantity,0),box=store.packages[quantity>1?'large':lines[0]?.package];
  const netWeight=lines.reduce((n,p)=>n+p.weight_lb*p.quantity,0);
  if(!quantity || !box || !Number.isFinite(netWeight) || netWeight<=0)fail('Package details need to be checked.',503,'SHIPPING_SETUP');
  return [{description:lines.map(p=>`${p.quantity} × ${p.name}`).join(', '),items:lines.map(p=>({slug:p.slug,name:p.name,quantity:p.quantity})),value:money(lines.reduce((n,p)=>n+p.price_cents*p.quantity,0)),net_weight:netWeight,parcel:{length:String(box.length),width:String(box.width),height:String(box.height),distance_unit:'in',weight:String(Number((netWeight+box.weight_lb).toFixed(4))),mass_unit:'lb'}}];
}
export function promotionalRates(rates, freeShipping = false) {
  if (!freeShipping) return rates;
  // The least expensive available service is free; faster services retain their quoted price.
  const cheapest=rates.reduce((best,r)=>r.amount<best.amount?r:best,rates[0]);
  return rates.map(r=>r.id===cheapest.id?{...r,carrier_amount:r.amount,amount:0,free_shipping:true}:r);
}
export function publicProduct(p) { return {slug:p.slug,name:p.name,display_size:p.display_size,price_cents:p.price_cents,stock:p.stock,online_enabled:p.online_enabled,cbd:p.cbd}; }
export function ready(env) {
  const mode = env.STORE_MODE || 'preview';
  const basic = ['SQUARE_ACCESS_TOKEN','SQUARE_APPLICATION_ID','SQUARE_LOCATION_ID','SHIPPO_API_KEY','SHIP_FROM_JSON'].every(k => Boolean(env[k]));
  return mode === 'sandbox' ? basic && env.SQUARE_ENVIRONMENT === 'sandbox' : mode === 'live' && basic && env.SQUARE_ENVIRONMENT === 'production' && env.LIVE_LAUNCH_CONFIRMED === 'true' && !!env.SQUARE_WEBHOOK_SIGNATURE_KEY && !!env.SQUARE_WEBHOOK_URL && !!env.RESEND_API_KEY && !!env.EMAIL_FROM && (env.ADMIN_TOKEN?.length || 0)>=32;
}
