import {flattenVariations, variationCandidates} from './catalog-matching.mjs';
import {products, store, StoreError, fail, money, parcels, uuid, clean, checkDestination} from './core.mjs';
const transport = env => env.FETCH || fetch;
export async function square(env, path, body, method = body ? 'POST' : 'GET') {
  const host = env.SQUARE_ENVIRONMENT === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  let response;
  try { response = await transport(env)(host+'/v2'+path,{method,headers:{Authorization:'Bearer '+env.SQUARE_ACCESS_TOKEN,'Content-Type':'application/json','Square-Version':env.SQUARE_API_VERSION || '2026-09-16'},body:body ? JSON.stringify(body) : undefined, signal:AbortSignal.timeout(20000)}); }
  catch { throw new StoreError('The payment service did not respond. Please check your order status before trying again.', 503, 'SQUARE_UNCERTAIN'); }
  let data; try { data = await response.json(); } catch { throw new StoreError('The payment service returned an unreadable response.', 503, 'SQUARE_UNCERTAIN'); }
  if (!response.ok) {
    const code = data.errors?.[0]?.code || 'SQUARE_ERROR';
    const uncertain = response.status >= 500 || response.status === 429;
    throw new StoreError(uncertain ? 'The payment service is temporarily unavailable.' : 'The payment service could not complete this request. Check your details or contact us.', uncertain ? 503 : 400, uncertain ? 'SQUARE_UNCERTAIN' : code);
  }
  return data;
}
// Resolve named sizes in the active Square environment. The old standalone Jasmine ID
// is intentionally never a fallback. Cache only a complete, unambiguous catalog response.
const variationCache = new Map();
async function mappedProducts(env) {
  if (!products.some(p=>p.square_variation_name)) return products;
  const key = [env.SQUARE_ENVIRONMENT, env.SQUARE_LOCATION_ID, env.SQUARE_ACCESS_TOKEN].join(':');
  let cached = variationCache.get(key);
  if (!cached || cached.expires < Date.now() || env.FETCH) {
    const items = []; let cursor;
    do {
      const data = await square(env, '/catalog/list?types=ITEM' + (cursor ? '&cursor='+encodeURIComponent(cursor) : ''));
      items.push(...(data.objects || [])); cursor = data.cursor;
    } while (cursor);
    cached = {variations:flattenVariations(items), expires:Date.now()+60000};
    if (variationCache.size >= 10) variationCache.clear();
    variationCache.set(key,cached);
  }
  return products.map(p=>{
    if (!p.square_variation_name) return p;
    const matches = variationCandidates(p,cached.variations);
    return {...p, square_variation_id:matches.length===1 ? matches[0].variation_id : null};
  });
}
export async function catalog(env) {
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID || env.STORE_MODE === 'preview') return products.map(p => ({...p,stock:p.stock_snapshot}));
  const resolved = await mappedProducts(env);
  const ids = resolved.map(p => p.square_variation_id).filter(Boolean);
  if (!ids.length) fail('The product catalog is being connected. Please contact us to order.',503,'CATALOG_SETUP');
  const [items, counts] = await Promise.all([
    square(env,'/catalog/batch-retrieve',{object_ids:ids,include_related_objects:true}),
    square(env,'/inventory/counts/batch-retrieve',{catalog_object_ids:ids,location_ids:[env.SQUARE_LOCATION_ID],states:['IN_STOCK']})
  ]);
  if (counts.cursor) fail('Inventory response is incomplete. Please try again shortly.',503);
  return resolved.map(p => {
    const v = items.objects?.find(v => v.id === p.square_variation_id);
    const d = v?.item_variation_data;
    const parent = items.related_objects?.find(x => x.id === d?.item_id);
    const location = d?.location_overrides?.find(x => x.location_id === env.SQUARE_LOCATION_ID);
    const price = location?.price_money || d?.price_money;
    const count = counts.counts?.find(x => x.catalog_object_id === p.square_variation_id);
    const tracked = (location?.track_inventory ?? d?.track_inventory) === true;
    const soldOut = location?.sold_out === true && (!location.sold_out_valid_until || !(Date.parse(location.sold_out_valid_until) < Date.now()));
    // Manually available body butters may not track a numeric count in Square.
    // Preserve the existing tracked-inventory requirement for other collections.
    const manualAvailability = p.category === 'body-butters' && !tracked;
    const stock = soldOut ? 0 : tracked ? Math.max(0,Math.floor(Number(count?.quantity || 0))) : manualAvailability ? store.max_items_per_order : 0;
    const present = v?.present_at_all_locations !== false || v?.present_at_location_ids?.includes(env.SQUARE_LOCATION_ID);
    return {...p,price_cents:Number(price?.amount || p.price_cents), stock, inventory_tracked:tracked, online_enabled:p.online_enabled && !!d && !v?.is_deleted && !parent?.is_deleted && present && !v?.absent_at_location_ids?.includes(env.SQUARE_LOCATION_ID) && (tracked || manualAvailability) && price?.currency === 'USD' && Number(price.amount)>0};
  });
}
export async function shipping(env, lines, a) {
  checkDestination(lines,a);
  let from; try { from = JSON.parse(env.SHIP_FROM_JSON); } catch { fail('Shipping is being configured. Please contact us to order.',503,'SHIPPING_SETUP'); }
  if (!['name','street1','city','state','zip','country'].every(k => from[k]) || from.country !== 'US' || from.state !== 'VA') fail('The shipping origin needs to be configured.',503,'SHIPPING_SETUP');
  const packs = parcels(lines);
  const shipments = await Promise.all(packs.map(async pack => {
    const payload = {address_from:from,address_to:{...a},parcels:[pack.parcel],async:false};
    let response; try { response = await transport(env)('https://api.goshippo.com/shipments/',{method:'POST',headers:{Authorization:'ShippoToken '+env.SHIPPO_API_KEY,'Content-Type':'application/json','SHIPPO-API-VERSION':'2018-02-08'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)}); } catch { fail('Shipping rates are taking too long. Please try again.',503,'SHIPPING_UNAVAILABLE'); }
    if (!response.ok) {
      // Status only: never log addresses, credentials, or raw provider response bodies.
      console.error('Shippo rate request rejected',response.status);
      fail('Shipping rates could not be calculated. Please contact us if this continues.',503,`SHIPPO_HTTP_${response.status}`);
    }
    const data = await response.json();
    return (data.rates || []).filter(r => r.currency === 'USD' && /^\d+(\.\d{1,2})?$/.test(r.amount) && r.object_id && r.servicelevel?.token && (env.STORE_MODE !== 'live' || !r.test));
  }));
  // Every parcel must have the same service available. Each amount is rounded separately.
  const first = new Map();
  for (const r of shipments[0]) { const key = `${r.carrier_account}:${r.servicelevel.token}`; if (!first.has(key) || Number(r.amount)<Number(first.get(key).amount)) first.set(key,r); }
  const rates = [];
  for (const [key,r] of first) {
    const matches = shipments.map(rs => rs.filter(x => `${x.carrier_account}:${x.servicelevel.token}` === key).sort((a,b)=>Number(a.amount)-Number(b.amount))[0]);
    if (matches.some(x => !x)) continue;
    rates.push({id:uuid(),carrier:clean(r.provider,50),service:clean(r.servicelevel.name,80),amount:matches.reduce((n,x)=>n+Math.round(Number(x.amount)*100),0),days:matches.every(x => Number.isFinite(Number(x.estimated_days)) && x.estimated_days !== null) ? Math.max(...matches.map(x=>Number(x.estimated_days))) : null,parcel_count:packs.length,shippo_rate_ids:matches.map(x=>x.object_id)});
  }
  if (!rates.length) fail('No shipping services are available for the entire order at this address. Please contact us.',400,'NO_RATES');
  return {rates:rates.sort((a,b)=>a.amount-b.amount),parcels:packs};
}
export function squareAddress(a) { return {address_line_1:a.street1,address_line_2:a.street2 || undefined,locality:a.city,administrative_district_level_1:a.state || undefined,postal_code:a.zip || undefined,country:a.country,first_name:a.name.split(' ')[0],last_name:a.name.split(' ').slice(1).join(' ')}; }
export function squareOrder(env, order) {
  const {lines,address:a,totals:t,rate,discount} = order;
  return {idempotency_key:order.id,order:{location_id:env.SQUARE_LOCATION_ID,reference_id:order.id,pricing_options:{auto_apply_discounts:false,auto_apply_taxes:false},line_items:lines.map(p=>({catalog_object_id:p.variation_id,quantity:String(p.quantity),base_price_money:{amount:p.price_cents,currency:'USD'}})),discounts:t.discount ? [{uid:'website-discount',name:`Discount code ${discount.code}`,discount_type:'FIXED_AMOUNT',amount_money:{amount:t.discount,currency:'USD'},scope:'ORDER'}] : [],taxes:t.tax ? [{uid:'va-sales-tax',name:'Sales tax (5.3%)',percentage:'5.3',scope:'ORDER',type:'ADDITIVE'}] : [],service_charges:t.shipping ? [{name:`Shipping: ${rate.carrier} ${rate.service}`,amount_money:{amount:t.shipping,currency:'USD'},calculation_phase:'TOTAL_PHASE',taxable:false}] : [],fulfillments:[{type:'SHIPMENT',state:'PROPOSED',shipment_details:{recipient:{display_name:a.name,email_address:a.email,phone_number:a.phone || undefined,address:squareAddress(a)}}}]}};
}
export async function sendEmail(env,{to,subject,text,key}) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;
  const response = await transport(env)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:env.EMAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new StoreError('Email delivery will be retried.',503,'EMAIL_RETRY');
  return true;
}
