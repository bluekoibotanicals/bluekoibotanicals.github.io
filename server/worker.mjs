import {store, products, StoreError, fail, now, uuid, digest, hmac, safeEqual, clean, address, normalizeCart, makeLines, checkDestination, totals, publicProduct, ready, money, promotionalRates} from './core.mjs';
import {catalog, shipping, square, squareAddress, squareOrder, sendEmail} from './providers.mjs';
import {createPastInvitation,listPastInvitations,pastInvitationAction,retryPastInvitations} from './past-reviews.mjs';
const checkoutPolicy=()=>JSON.stringify({version:4,tax:store.tax});
const stmt = (env,sql,...values) => env.DB.prepare(sql).bind(...values);
const first = (env,sql,...values) => stmt(env,sql,...values).first();
const all = async (env,sql,...values) => (await stmt(env,sql,...values).all()).results;
const run = (env,sql,...values) => stmt(env,sql,...values).run();
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function body(req) { const s=await req.text(); if (s.length>20000) fail('Request is too large.',413); try { return JSON.parse(s); } catch { fail('Invalid JSON.'); } }
async function limit(env, req, scope, max=30) {
  const k=await digest(`${scope}:${req.headers.get('CF-Connecting-IP') || 'local'}:${Math.floor(now()/3600)}`);
  const r=await first(env,'INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits',k,now()+7200);
  if (r.hits>max) fail('Too many requests. Please try again later or contact us.',429,'RATE_LIMIT');
}
function admin(req,env) { if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length<32 || !safeEqual(req.headers.get('Authorization') || '',`Bearer ${env.ADMIN_TOKEN}`)) fail('Sign in to manage the store.',401); }
async function ownedOrder(env,id,session) { const o=await first(env,'SELECT * FROM orders WHERE id=? AND session_hash=?',id,session); if (!o) fail('Order not found in this browser.',404); return o; }
function publicOrder(o) { const d=JSON.parse(o.data); return {id:o.id,status:o.status,lines:d.lines.map(p=>({name:p.name,size:p.size,quantity:p.quantity,price_cents:p.price_cents})),totals:d.totals,discount:d.discount || null,refunded_cents:d.refunded_cents || 0,carrier:d.rate.carrier,service:d.rate.service,receipt_url:d.receipt_url || null,tracking:d.tracking || null}; }
function discountCode(value) {
  const code=clean(value,32).toUpperCase();
  if (code && !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(code)) fail('Enter a valid discount code.',400,'DISCOUNT_INVALID');
  return code;
}
async function resolveDiscount(env,input,subtotal) {
  const code=discountCode(input); if (!code) return null;
  const row=await first(env,'SELECT code,kind,value,minimum_subtotal_cents FROM discount_codes WHERE code=? AND active=1',code);
  if (!row || subtotal<row.minimum_subtotal_cents) fail('That discount code is not available for this order.',400,'DISCOUNT_INVALID');
  const amount=row.kind==='percent' ? Math.round(subtotal*row.value/10000) : row.kind==='fixed' ? row.value : 0;
  if (row.kind!=='free_shipping' && amount<1) fail('That discount code is not available for this order.',400,'DISCOUNT_INVALID');
  return {code:row.code,kind:row.kind,value:Number(row.value),minimum_subtotal_cents:Number(row.minimum_subtotal_cents),amount:Math.min(amount,subtotal)};
}
const sameDiscount=(a,b)=>JSON.stringify(a || null)===JSON.stringify(b || null);
async function finishPayment(env,o,payment) {
  if (!payment || payment.order_id!==o.square_order_id || Number(payment.amount_money?.amount)!==JSON.parse(o.data).totals.total || payment.amount_money?.currency!=='USD') fail('Payment requires an order check. Please contact us.',503,'PAYMENT_MISMATCH');
  const state=payment.status === 'COMPLETED' ? (Number(payment.refunded_money?.amount || 0)>=Number(payment.amount_money.amount) ? 'refunded' : 'paid') : ['CANCELED','FAILED'].includes(payment.status) ? 'failed' : 'processing';
  const data=JSON.parse(o.data);data.refunded_cents=Number(payment.refunded_money?.amount || 0); if (payment.receipt_url?.startsWith('https://')) data.receipt_url=payment.receipt_url;
  await run(env,'UPDATE orders SET status=?,payment_id=?,data=?,payment_request=CASE WHEN ?=\'processing\' THEN payment_request ELSE NULL END,recovery_note=NULL,updated_at=? WHERE id=? AND status IN (\'processing\',\'paid\',\'refunded\')',state,payment.id,JSON.stringify(data),state,now(),o.id);
  if (state!=='processing') await run(env,'DELETE FROM reservations WHERE order_id=?',o.id);
  return first(env,'SELECT * FROM orders WHERE id=?',o.id);
}
async function confirmation(env,o) {
  if (o.status!=='paid') return;
  const d=JSON.parse(o.data), t=d.totals;
  const discountSummary=d.discount ? d.discount.kind==='free_shipping' ? `\nDiscount code ${d.discount.code}: Free shipping` : `\nDiscount code ${d.discount.code}: -$${money(t.discount)}` : '';
  const summary=`Order: ${o.id}\n${d.lines.map(p=>`${p.quantity} × ${p.name} (${p.size}) — $${money(p.price_cents*p.quantity)}`).join('\n')}\n\nItems: $${money(t.subtotal)}${discountSummary}\nShipping: $${money(t.shipping)} (${d.rate.carrier} ${d.rate.service})\nSales tax (5.3%): $${money(t.tax)}\nTotal: $${money(t.total)} USD`;
  // Independent flags/keys: failure of one recipient never suppresses the other's notification.
  await Promise.allSettled([
    (async()=>{
      if(o.email_sent)return;
      const sent=await sendEmail(env,{to:d.address.email,subject:`Your Blue Koi order ${o.id.slice(0,8)}`,key:`order-${o.id}`,text:`Thank you for your order!\n\n${summary}\n\nProcessing takes 1–3 days before carrier transit.\nRefunds are available for defective items. Contact ${store.email} with your order number for help.\n\n${env.SITE_URL}/order.html?id=${o.id}\n(Order details open in the browser used at checkout.)`});
      if(sent)await run(env,'UPDATE orders SET email_sent=1 WHERE id=?',o.id);
    })(),
    (async()=>{
      if(o.owner_email_sent)return;
      const a=d.address;
      const sent=await sendEmail(env,{to:env.OWNER_EMAIL || store.email,subject:`New paid Blue Koi order ${o.id.slice(0,8)}`,key:`owner-order-${o.id}`,text:`Gwyn, a website order has been paid.\n\n${summary}\n\nShip to:\n${[a.name,a.street1,a.street2,`${a.city}, ${a.state} ${a.zip}`,a.country].filter(Boolean).join('\n')}\nEmail: ${a.email}\nPhone: ${a.phone || 'Not supplied'}\n\nPackage:\n${d.parcels.map(p=>`${p.description}\n${p.parcel.length} × ${p.parcel.width} × ${p.parcel.height} in; ${p.parcel.weight} lb`).join('\n')}\n\nSquare order: ${o.square_order_id}\nPayment: ${o.payment_id}\n\nCheck the physical packed weight and fit, purchase the label in Shippo, then enter tracking and mark fulfilled in Square. Labels are not purchased automatically.\n\nManage orders: ${env.SITE_URL}/admin.html`});
      if(sent)await run(env,'UPDATE orders SET owner_email_sent=1 WHERE id=?',o.id);
    })()
  ]);
}
async function reconcile(env,o) {
  if (!o.square_order_id) return o;
  const {order}=await square(env,`/orders/${o.square_order_id}`);
  const paymentId=o.payment_id || order.tenders?.find(t=>t.payment_id)?.payment_id;
  if (paymentId) { const {payment}=await square(env,`/payments/${paymentId}`); o=await finishPayment(env,o,payment); }
  const shipment=order.fulfillments?.find(f=>f.type==='SHIPMENT' && f.state==='COMPLETED');
  if (shipment && o.status==='paid') {
    const data=JSON.parse(o.data); data.tracking=clean(shipment.shipment_details?.tracking_number,100);
    await run(env,'UPDATE orders SET fulfilled_at=COALESCE(fulfilled_at,?),data=? WHERE id=?',now(),JSON.stringify(data),o.id);
    o=await first(env,'SELECT * FROM orders WHERE id=?',o.id);
  }
  return o;
}
const PAYMENT_RETRY_SECONDS=23*3600;
async function recoverPayment(env,o) {
  // Persist queue progress even when Square is unavailable, so one old order cannot starve others.
  await run(env,'UPDATE orders SET recovery_checked_at=? WHERE id=?',now(),o.id);
  o=await reconcile(env,o);
  if(o.status!=='processing')return o;
  if(o.payment_request && o.created_at<now()-120 && o.created_at>now()-PAYMENT_RETRY_SECONDS && (o.recovery_checked_at || 0)<now()-120) {
    try {
      // Never generate another key, amount, token, or payment request during recovery.
      const {payment}=await square(env,'/payments',JSON.parse(o.payment_request));
      return finishPayment(env,o,payment);
    } catch {
      // Even an error on replay is not proof the original request never charged.
      o=await reconcile(env,o);
    }
  }
  if(o.status==='processing')await run(env,'UPDATE orders SET recovery_note=? WHERE id=?',o.created_at<=now()-PAYMENT_RETRY_SECONDS?'Automatic retry window ended. Check Square; use Cancel unpaid order only after review.':'Payment result is uncertain. Checking the same Square order; do not charge again.',o.id);
  return first(env,'SELECT * FROM orders WHERE id=?',o.id);
}
async function cancelUnpaid(env,o) {
  if(o.status!=='processing')fail('Only a processing order can be checked for unpaid cancellation.',409);
  if(o.created_at>now()-120)fail('Wait at least two minutes for the original payment to finish.',409);
  o=await reconcile(env,o);
  if(o.status!=='processing' || o.payment_id)fail('Square has a payment for this order. Review it in Square; do not cancel it here.',409);
  if(o.square_order_id) {
    let {order}=await square(env,`/orders/${o.square_order_id}`);
    if(order.tenders?.length || !['OPEN','CANCELED'].includes(order.state))fail('Square does not confirm this order is unpaid and cancelable.',409);
    if(order.state!=='CANCELED')await square(env,`/orders/${o.square_order_id}`,{order:{location_id:env.SQUARE_LOCATION_ID,version:order.version,state:'CANCELED'}},'PUT');
    // Never release stock just because a request timed out or the local payment ID is missing.
    ({order}=await square(env,`/orders/${o.square_order_id}`));
    if(order.state!=='CANCELED' || order.tenders?.length)fail('Cancellation could not be confirmed. Review this order in Square.',409);
  } else if(o.payment_attempted || o.created_at>now()-3600)fail('This order needs further reconciliation before cancellation.',409);
  await env.DB.batch([
    stmt(env,'UPDATE orders SET status=\'failed\',payment_request=NULL,recovery_note=NULL,error_code=\'OWNER_CANCELED_UNPAID\',updated_at=? WHERE id=? AND status=\'processing\' AND payment_id IS NULL',now(),o.id),
    stmt(env,'DELETE FROM reservations WHERE order_id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status=\'failed\')',o.id,o.id),
    stmt(env,'UPDATE quotes SET status=\'closed\' WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status=\'failed\')',o.quote_id,o.id)
  ]);
  return first(env,'SELECT * FROM orders WHERE id=?',o.id);
}
async function checkout(req,env,session,ctx) {
  if (!ready(env)) fail('Checkout is not open yet. Please contact us to order.',503,'SETUP_REQUIRED');
  await limit(env,req,'checkout',30);
  const b=await body(req);
  const q=await first(env,'SELECT * FROM quotes WHERE id=? AND session_hash=?',clean(b.quote_id,50),session);
  if (!q) fail('Get shipping rates before paying.',409,'QUOTE_EXPIRED');
  let o=await first(env,'SELECT * FROM orders WHERE quote_id=?',q.id);
  if (o && ['paid','refunded'].includes(o.status)) return json(publicOrder(o));
  if (o?.status==='failed') fail('This payment attempt has closed. Get new shipping rates and try again.',409,'QUOTE_EXPIRED');
  if (o) {
    // Recover only by looking up the provider result. Never create a second payment for this quote.
    o=await recoverPayment(env,o);
    if (o.status==='paid') { ctx.waitUntil(confirmation(env,o).catch(()=>{})); return json(publicOrder(o)); }
    return json(publicOrder(o),202);
  }
  if (q.expires_at<now() || q.status!=='open') fail('Your shipping quote has expired. Please get new rates.',409,'QUOTE_EXPIRED');
  const data=JSON.parse(q.data),rate=data.rates.find(r=>r.id===b.rate_id);
  if(data.shipping_policy!==checkoutPolicy())fail('Shipping settings have changed. Please get new shipping rates.',409,'QUOTE_EXPIRED');
  if (!rate) fail('Choose an available shipping method.');
  checkDestination(data.lines,data.address);
  if (typeof b.source_id!=='string' || b.source_id.length<10 || b.source_id.length>2000) fail('Enter your card details to pay.');
  const billing=address(b.billing || data.address,true);
  const live=await catalog(env), lines=makeLines(data.lines,live);
  if (lines.some(p=>p.price_cents!==data.lines.find(x=>x.slug===p.slug).price_cents || p.variation_id!==data.lines.find(x=>x.slug===p.slug).variation_id)) fail('A product price has changed. Please get new shipping rates.',409,'QUOTE_EXPIRED');
  let currentDiscount;
  try { currentDiscount=await resolveDiscount(env,data.discount?.code || '',data.item_totals.subtotal); } catch { fail('Your discount code has changed. Please get new shipping rates.',409,'QUOTE_EXPIRED'); }
  if (!sameDiscount(currentDiscount,data.discount)) fail('Your discount code has changed. Please get new shipping rates.',409,'QUOTE_EXPIRED');
  const t={...data.item_totals,shipping:rate.amount,total:data.item_totals.total+rate.amount};
  const d={id:uuid(),lines,address:data.address,rate,totals:t,discount:data.discount || null,parcels:data.parcels};
  const insert=await run(env,'INSERT OR IGNORE INTO orders(id,quote_id,session_hash,status,data,created_at,updated_at) VALUES(?,?,?,\'processing\',?,?,?)',d.id,q.id,session,JSON.stringify(d),now(),now());
  if (!insert.meta.changes) return json(publicOrder(await first(env,'SELECT * FROM orders WHERE quote_id=?',q.id)),202);
  o=await first(env,'SELECT * FROM orders WHERE id=?',d.id);
  let paymentStarted=false;
  try {
    // Conditional inserts serialize competing website reservations in D1. Square is still the authority for POS stock.
    const reservations=await env.DB.batch(lines.map(p=>stmt(env,'INSERT INTO reservations(order_id,slug,quantity) SELECT ?,?,? WHERE ? >= ? + COALESCE((SELECT SUM(quantity) FROM reservations WHERE slug=?),0)',o.id,p.slug,p.quantity,live.find(x=>x.slug===p.slug).stock,p.quantity,p.slug)));
    if (reservations.some(r=>r.meta.changes!==1)) fail('An item just sold out. Please update your bag.',409,'STOCK_CHANGED');
    // Refresh after acquiring reservations to close the gap if another website order just completed.
    const refreshed=await catalog(env),held=await all(env,'SELECT slug,SUM(quantity) AS quantity FROM reservations GROUP BY slug');
    for (const p of lines) {
      const current=refreshed.find(x=>x.slug===p.slug);
      if (!current?.online_enabled || current.stock<(held.find(x=>x.slug===p.slug)?.quantity || p.quantity)) fail('An item just sold out. Please update your bag.',409,'STOCK_CHANGED');
      if (current.price_cents!==p.price_cents) fail('A product price changed. Please get new shipping rates.',409,'QUOTE_EXPIRED');
    }
    const {order}=await square(env,'/orders',squareOrder(env,d));
    await run(env,'UPDATE orders SET square_order_id=?,updated_at=? WHERE id=?',order.id,now(),o.id); o.square_order_id=order.id;
    if (Number(order.total_money?.amount)!==t.total || order.total_money?.currency!=='USD') fail('The total changed. Please get a fresh shipping quote.',409,'QUOTE_EXPIRED');
    const request={idempotency_key:o.id,source_id:b.source_id,amount_money:{amount:t.total,currency:'USD'},autocomplete:true,order_id:order.id,location_id:env.SQUARE_LOCATION_ID,buyer_email_address:data.address.email,billing_address:squareAddress(billing),shipping_address:squareAddress(data.address),reference_id:o.id};
    await run(env,'UPDATE orders SET payment_request=?,payment_attempted=1,updated_at=? WHERE id=?',JSON.stringify(request),now(),o.id);
    // From this point a timeout is ambiguous. Keep the order and reservation until reconciled.
    paymentStarted=true;
    const {payment}=await square(env,'/payments',request);
    o=await finishPayment(env,o,payment);
    ctx.waitUntil(confirmation(env,o).catch(()=>{}));
    return json(publicOrder(o),o.status==='processing'?202:200);
  } catch(error) {
    const ambiguous=paymentStarted && (!(error instanceof StoreError) || ['SQUARE_UNCERTAIN','PAYMENT_MISMATCH'].includes(error.code));
    if (!ambiguous) {
      await env.DB.batch([stmt(env,'UPDATE orders SET status=\'failed\',error_code=?,payment_request=NULL,updated_at=? WHERE id=?',error.code || 'CHECKOUT_ERROR',now(),o.id),stmt(env,'DELETE FROM reservations WHERE order_id=?',o.id),stmt(env,'UPDATE quotes SET status=\'closed\' WHERE id=?',q.id)]);
      // Unpaid Square orders can safely be canceled; failure here does not permit charging.
      if (o.square_order_id) ctx.waitUntil((async()=>{ const result=await square(env,`/orders/${o.square_order_id}`); if (!result.order.tenders?.length) await square(env,`/orders/${o.square_order_id}`,{order:{location_id:env.SQUARE_LOCATION_ID,version:result.order.version,state:'CANCELED'}},'PUT'); })().catch(()=>{}));
      throw error;
    }
    return json({id:o.id,status:'processing',message:'Your payment is being checked. Do not submit another order.'},202);
  }
}
async function reviewToken(env,token) {
  if (typeof token!=='string' || token.length>200) fail('Invalid review invitation.',403);
  const hash=await digest(token),r=await first(env,'SELECT o.*,t.expires_at FROM review_tokens t JOIN orders o ON o.id=t.order_id WHERE t.token_hash=?',hash);
  if(r && r.expires_at>now() && ['paid','refunded'].includes(r.status))return {...r,past:false};
  const past=await first(env,'SELECT id,products_json,expires_at,revoked_at FROM past_review_invitations WHERE token_hash=?',hash);
  if(!past || past.revoked_at || past.expires_at<=now())fail('This review invitation is invalid or has expired. Contact us for help.',403);
  return {id:past.id,past:true,data:JSON.stringify({lines:JSON.parse(past.products_json)})};
}
async function route(req,env,ctx,session) {
  const u=new URL(req.url),p=u.pathname;
  if (p==='/api/config' && req.method==='GET') {
    const code=env.DB?await first(env,"SELECT code FROM discount_codes WHERE code='FREESHIP25' AND active=1 AND kind='free_shipping' AND minimum_subtotal_cents=2501"):null;
    return json({mode:env.STORE_MODE || 'preview',checkout_ready:ready(env),square_environment:env.SQUARE_ENVIRONMENT || 'sandbox',application_id:env.SQUARE_APPLICATION_ID || '',location_id:env.SQUARE_LOCATION_ID || '',processing:store.processing_days,free_shipping:{enabled:!!code,code:'FREESHIP25',banner:'Free shipping for the first 50 customers on orders over $25.',terms:'Enter FREESHIP25 below and choose the lowest-priced shipping service. Merchandise subtotal must exceed $25 before tax. Expedited services cost extra. One code per order.'}});
  }
  if (!env.DB) fail('The store database is being configured.',503,'SETUP_REQUIRED');
  if (p==='/api/catalog' && req.method==='GET') {
    const items=await catalog(env),held=await all(env,'SELECT slug,SUM(quantity) AS quantity FROM reservations GROUP BY slug');
    return json({products:items.map(p=>publicProduct({...p,stock:Math.max(0,p.stock-(held.find(h=>h.slug===p.slug)?.quantity || 0))})),preview:env.STORE_MODE==='preview'});
  }
  if (p==='/api/quote' && req.method==='POST') {
    if (!ready(env)) fail('Checkout is not open yet. Please contact us to order.',503,'SETUP_REQUIRED');
    await limit(env,req,'quotes',20);
    const pending=await first(env,'SELECT id FROM orders WHERE session_hash=? AND status=\'processing\' LIMIT 1',session);
    if (pending) fail(`Order ${pending.id} is still being checked. Open your order confirmation page or contact us before placing another order.`,409,'PAYMENT_PENDING');
    const b=await body(req),a=address(b.address),cart=normalizeCart(b.cart);
    checkDestination(cart.map(l=>products.find(p=>p.slug===l.slug)),a);
    const requestedCode=discountCode(b.discount_code);
    const fingerprint=await digest(JSON.stringify({cart,a,discount_code:requestedCode,shipping_policy:checkoutPolicy()}));
    const cached=await first(env,'SELECT * FROM quotes WHERE session_hash=? AND fingerprint=? AND expires_at>? AND status=\'open\' AND id NOT IN (SELECT quote_id FROM orders) ORDER BY created_at DESC LIMIT 1',session,fingerprint,now()+60);
    if (cached) {
      const cachedData=JSON.parse(cached.data),current=await resolveDiscount(env,requestedCode,cachedData.item_totals.subtotal);
      if (sameDiscount(current,cachedData.discount)) return quoteResponse(cached);
      await run(env,'UPDATE quotes SET status=\'closed\' WHERE id=?',cached.id);
    }
    const lines=makeLines(cart,await catalog(env)); checkDestination(lines,a);
    const beforeDiscount=totals(lines,0,a),discount=await resolveDiscount(env,requestedCode,beforeDiscount.subtotal);
    const expected=totals(lines,0,a,discount?.amount || 0);
    const [ship,calculated]=await Promise.all([shipping(env,lines,a),square(env,'/orders/calculate',{order:squareOrder(env,{id:uuid(),lines,address:a,totals:expected,discount,rate:{carrier:'',service:''}}).order})]);
    const itemTotals=expected,tax=Number(calculated.order?.total_tax_money?.amount);
    if (!Number.isInteger(tax) || tax<0 || Math.abs(tax-itemTotals.tax)>lines.length || Number(calculated.order.total_money?.amount)!==itemTotals.subtotal-itemTotals.discount+tax) fail('The tax total could not be confirmed.',503);
    itemTotals.tax=tax;itemTotals.total=itemTotals.subtotal-itemTotals.discount+tax;
    ship.rates=promotionalRates(ship.rates,discount?.kind==='free_shipping');
    const q={id:uuid(),expires_at:now()+store.quote_minutes*60,data:JSON.stringify({shipping_policy:checkoutPolicy(),lines,address:a,discount,item_totals:itemTotals,...ship})};
    await run(env,'INSERT INTO quotes(id,session_hash,fingerprint,data,created_at,expires_at) VALUES(?,?,?,?,?,?)',q.id,session,fingerprint,q.data,now(),q.expires_at);
    return quoteResponse(q);
  }
  if (p==='/api/checkout' && req.method==='POST') return checkout(req,env,session,ctx);
  if (p.startsWith('/api/order/') && req.method==='GET') {
    let o=await ownedOrder(env,p.slice(11),session);
    if (o.status==='processing' && o.updated_at<now()-5) { await limit(env,req,'order-poll',180); o=await recoverPayment(env,o); }
    ctx.waitUntil(confirmation(env,o).catch(()=>{})); return json(publicOrder(o));
  }
  if (p==='/api/reviews' && req.method==='GET') {
    const slug=u.searchParams.get('product'); if (!products.some(p=>p.slug===slug)) fail('Product not found.',404);
    const product=products.find(p=>p.slug===slug), parent=product.parent_slug || slug;
    const slugs=products.filter(p=>(p.parent_slug || p.slug)===parent).map(p=>p.slug);
    const placeholders=slugs.map(()=>'?').join(',');
    const reviews=await all(env,`SELECT rating,author,body,created_at FROM all_product_reviews WHERE slug IN (${placeholders}) AND status='published' ORDER BY created_at DESC LIMIT 100`,...slugs);
    const stats=await first(env,`SELECT COUNT(*) AS count,AVG(rating) AS average FROM all_product_reviews WHERE slug IN (${placeholders}) AND status='published'`,...slugs);
    return json({reviews,...stats});
  }
  if (p==='/api/review-invitation' && req.method==='POST') {
    await limit(env,req,'review-token',30); const b=await body(req),o=await reviewToken(env,b.token);
    const done=await all(env,o.past?'SELECT slug FROM past_reviews WHERE invitation_id=?':'SELECT slug FROM reviews WHERE order_id=?',o.id);
    return json({products:JSON.parse(o.data).lines.map(l=>({slug:l.slug,name:l.name,size:l.size,submitted:done.some(x=>x.slug===l.slug)}))});
  }
  if (p==='/api/reviews' && req.method==='POST') {
    await limit(env,req,'review-write',20); const b=await body(req),o=await reviewToken(env,b.token);
    if (!JSON.parse(o.data).lines.some(p=>p.slug===b.slug)) fail('Only products in your order can be reviewed.',403);
    const author=clean(b.author,60),text=clean(b.body,2000);
    if (!author || text.length<10 || !Number.isInteger(b.rating) || b.rating<1 || b.rating>5) fail('Add a name, a rating from 1 to 5, and at least 10 characters of review text.');
    const sql=o.past?'INSERT OR IGNORE INTO past_reviews(id,invitation_id,slug,rating,author,body,created_at) VALUES(?,?,?,?,?,?,?)':'INSERT OR IGNORE INTO reviews(id,order_id,slug,rating,author,body,created_at) VALUES(?,?,?,?,?,?,?)';
    const r=await run(env,sql,(o.past?'past-':'')+uuid(),o.id,b.slug,b.rating,author,text,now());
    if (!r.meta.changes) fail('You have already reviewed this product from this order.',409);
    return json({message:'Thank you! Your verified purchase review has been submitted for moderation.'},201);
  }
  if (p.startsWith('/api/admin/')) {
    await limit(env,req,'admin',100); admin(req,env);
    if(p==='/api/admin/past-review-invitations' && req.method==='GET')return json({invitations:await listPastInvitations(env),products:products.map(p=>({slug:p.slug,name:p.name,size:p.display_size}))});
    if(p==='/api/admin/past-review-invitations' && req.method==='POST') {
      const b=await body(req);
      if(b.action==='create') {await limit(env,req,'past-invitations',30);return json(await createPastInvitation(env,b),201);}
      return json(await pastInvitationAction(env,b));
    }
    if (p==='/api/admin/status') return json({mode:env.STORE_MODE,checkout_ready:ready(env),owner_email:env.OWNER_EMAIL || store.email,mapped:(await catalog(env)).filter(p=>p.square_variation_id).length,total:products.length,missing:['SQUARE_ACCESS_TOKEN','SQUARE_APPLICATION_ID','SQUARE_LOCATION_ID','SHIPPO_API_KEY','SHIP_FROM_JSON','SQUARE_WEBHOOK_SIGNATURE_KEY','RESEND_API_KEY','EMAIL_FROM'].filter(k=>!env[k])});
    if (p==='/api/admin/orders' && req.method==='GET') return json({orders:(await all(env,'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100')).map(o=>({...publicOrder(o),created_at:o.created_at,fulfilled_at:o.fulfilled_at,square_order_id:o.square_order_id,payment_id:o.payment_id,recovery_note:o.recovery_note,email_sent:!!o.email_sent,owner_email_sent:!!o.owner_email_sent,address:JSON.parse(o.data).address,parcels:JSON.parse(o.data).parcels}))});
    if (p==='/api/admin/discount-codes' && req.method==='GET') return json({discount_codes:await all(env,'SELECT code,kind,value,minimum_subtotal_cents,active,created_at,updated_at FROM discount_codes ORDER BY active DESC, created_at DESC')});
    if (p==='/api/admin/discount-codes' && req.method==='POST') {
      const b=await body(req),code=discountCode(b.code);
      if (!code) fail('Enter a discount code.');
      if (b.action==='create') {
        if (!['fixed','percent','free_shipping'].includes(b.kind) || !Number.isInteger(b.value) || !Number.isInteger(b.minimum_subtotal_cents) || b.minimum_subtotal_cents<0) fail('Enter valid discount details.');
        if ((b.kind==='percent' && (b.value<1 || b.value>10000)) || (b.kind==='fixed' && (b.value<1 || b.value>1000000)) || (b.kind==='free_shipping' && b.value!==0)) fail('Enter a valid discount amount.');
        try { await run(env,'INSERT INTO discount_codes(code,kind,value,minimum_subtotal_cents,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)',code,b.kind,b.value,b.minimum_subtotal_cents,now(),now()); }
        catch { fail('A code with that name already exists. Deactivate it instead of replacing its history.',409,'DISCOUNT_EXISTS'); }
        return json({ok:true},201);
      }
      if (b.action==='set-active' && typeof b.active==='boolean') {
        const changed=await run(env,'UPDATE discount_codes SET active=?,updated_at=? WHERE code=?',b.active?1:0,now(),code);
        if (!changed.meta.changes) fail('Discount code not found.',404);
        return json({ok:true});
      }
      fail('Invalid discount code action.');
    }
    if (p==='/api/admin/reviews' && req.method==='GET') return json({reviews:await all(env,'SELECT id,slug,rating,author,body,status,created_at,purchase_source FROM all_product_reviews ORDER BY created_at DESC LIMIT 100')});
    if (p==='/api/admin/reviews' && req.method==='POST') {
      const b=await body(req); if (!['published','rejected','pending'].includes(b.status)) fail('Invalid review status.');
      if (b.status==='rejected' && clean(b.reason,300).length<5) fail('Provide a moderation reason. Negative ratings are not a reason to reject a review.');
      const id=clean(b.id,50),table=id.startsWith('past-')?'past_reviews':'reviews';
      await run(env,`UPDATE ${table} SET status=?,moderation_reason=? WHERE id=?`,b.status,clean(b.reason,300),id);return json({ok:true});
    }
    if (['/api/admin/reconcile','/api/admin/cancel-unpaid'].includes(p) && req.method==='POST') { const b=await body(req),o=await first(env,'SELECT * FROM orders WHERE id=?',clean(b.id,50));if (!o) fail('Order not found.',404); const updated=p.endsWith('cancel-unpaid')?await cancelUnpaid(env,o):o.status==='processing'?await recoverPayment(env,o):await reconcile(env,o);ctx.waitUntil(confirmation(env,updated).catch(()=>{}));return json(publicOrder(updated)); }
  }
  if (p==='/api/webhooks/square' && req.method==='POST') {
    if (!env.SQUARE_WEBHOOK_SIGNATURE_KEY || !env.SQUARE_WEBHOOK_URL) fail('Webhook is not configured.',503);
    const raw=await req.text(); if (raw.length>1000000) fail('Payload too large.',413);
    const signature=await hmac(env.SQUARE_WEBHOOK_SIGNATURE_KEY,env.SQUARE_WEBHOOK_URL+raw);
    if (!safeEqual(signature,req.headers.get('x-square-hmacsha256-signature'))) fail('Invalid signature.',403);
    let event;try {event=JSON.parse(raw);}catch {fail('Invalid payload.');}
    const object=event.data?.object || {},orderId=object.payment?.order_id || object.order_updated?.order_id || object.order_fulfillment_updated?.order_id || object.refund?.order_id;
    const paymentId=object.payment?.id || object.refund?.payment_id;
    const o=orderId ? await first(env,'SELECT * FROM orders WHERE square_order_id=?',orderId) : paymentId ? await first(env,'SELECT * FROM orders WHERE payment_id=?',paymentId) : null;
    if (o) { const updated=await reconcile(env,o); ctx.waitUntil(confirmation(env,updated).catch(()=>{})); }
    return json({received:true});
  }
  fail('Not found.',404);
}
function quoteResponse(q) { const d=JSON.parse(q.data);return json({id:q.id,expires_at:q.expires_at,lines:d.lines.map(p=>({slug:p.slug,name:p.name,size:p.size,quantity:p.quantity,price_cents:p.price_cents})),discount:d.discount || null,item_totals:d.item_totals,rates:d.rates.map(({shippo_rate_ids,carrier_amount,...r})=>r)}); }
const CSP="default-src 'self'; script-src 'self' https://web.squarecdn.com https://sandbox.web.squarecdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://web.squarecdn.com https://sandbox.web.squarecdn.com; font-src 'self' https://fonts.gstatic.com https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net; img-src 'self' data: https://*.squarecdn.com; connect-src 'self' https://pci-connect.squareup.com https://pci-connect.squareupsandbox.com https://*.squarecdn.com https://o160250.ingest.sentry.io; frame-src https://web.squarecdn.com https://sandbox.web.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
export default {
  async fetch(req,env,ctx={waitUntil(){}}) {
    const url=new URL(req.url), api=url.pathname.startsWith('/api/');let cookie;
    try {
      if (!api) {
        const response=await env.ASSETS.fetch(req);return secure(response,url,false);
      }
      if (!['GET','POST'].includes(req.method)) fail('Method not allowed.',405);
      if (req.method==='POST' && url.pathname!=='/api/webhooks/square') {
        const allowed=new URL(env.SITE_URL || url.origin).origin;
        if (req.headers.get('Origin')!==allowed || url.origin!==allowed || !req.headers.get('Content-Type')?.startsWith('application/json')) fail('Please submit this request from the store website.',403,'ORIGIN');
      }
      let token=req.headers.get('Cookie')?.match(/(?:^|;\s*)bk_session=([a-f0-9-]{36})/)?.[1];
      if (!token) { token=uuid();cookie=`bk_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${url.protocol==='https:' ? '; Secure' : ''}`; }
      const response=await route(req,env,ctx,await digest(token));return secure(response,url,true,cookie);
    } catch(error) {
      if (!(error instanceof StoreError)) console.error('Store request failed:',error.name); // Never log payment requests, tokens, addresses, or provider bodies.
      return secure(json({error:error instanceof StoreError ? error.message : 'The store could not complete this request. Please try again or contact us.',code:error.code || 'INTERNAL'},error.status || 500),url,true,cookie);
    }
  },
  async scheduled(event,env,ctx) { ctx.waitUntil(maintenance(env)); }
};
function secure(response,url,api,cookie) {
  const r=new Response(response.body,response);r.headers.set('Content-Security-Policy',CSP);r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('Referrer-Policy','no-referrer');r.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if (url.protocol==='https:')r.headers.set('Strict-Transport-Security','max-age=31536000');
  if (api || ['admin','review','checkout','order'].some(p=>url.pathname===`/${p}.html`))r.headers.set('Cache-Control','no-store');
  if (cookie)r.headers.set('Set-Cookie',cookie);return r;
}
export async function maintenance(env) {
  if (!env.DB || env.STORE_MODE==='preview')return;
  await retryPastInvitations(env);
  const pending=await all(env,'SELECT * FROM orders WHERE status=\'processing\' OR (status=\'paid\' AND (email_sent=0 OR owner_email_sent=0 OR fulfilled_at IS NULL)) ORDER BY recovery_checked_at ASC,created_at ASC LIMIT 40');
  for (let o of pending) {
    try {
      await run(env,'UPDATE orders SET recovery_checked_at=? WHERE id=?',now(),o.id);
      if (o.status==='processing' && !o.payment_attempted && !o.payment_id && o.created_at<now()-3600) {
        // No durable payment request means the payment call could not have started.
        if (o.square_order_id) {
          const r=await square(env,`/orders/${o.square_order_id}`);
          if (r.order.tenders?.length) {o=await reconcile(env,o);await confirmation(env,o);continue;}
          if (r.order.state!=='CANCELED')await square(env,`/orders/${o.square_order_id}`,{order:{location_id:env.SQUARE_LOCATION_ID,version:r.order.version,state:'CANCELED'}},'PUT');
        }
        await env.DB.batch([stmt(env,'UPDATE orders SET status=\'failed\',updated_at=? WHERE id=?',now(),o.id),stmt(env,'DELETE FROM reservations WHERE order_id=?',o.id)]);
        continue;
      }
      o=o.status==='processing'?await recoverPayment(env,o):await reconcile(env,o);
      await confirmation(env,o);
    } catch { /* A later schedule or the owner can retry against Square. */ }
  }
  const invites=await all(env,'SELECT * FROM orders WHERE status=\'paid\' AND fulfilled_at<? AND review_sent=0 LIMIT 40',now()-store.review_delay_days*86400);
  for (const o of invites) {
    try {
      // Deterministic invitation per order keeps retries within the email provider's idempotency contract.
      if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length<32) continue;
      const token=await hmac(env.ADMIN_TOKEN,`review:${o.id}`),d=JSON.parse(o.data);
      await run(env,'INSERT OR IGNORE INTO review_tokens(token_hash,order_id,expires_at) VALUES(?,?,?)',await digest(token),o.id,now()+store.review_expiry_days*86400);
      const sent=await sendEmail(env,{to:d.address.email,subject:'How are you enjoying your Blue Koi products?',key:`review-${o.id}`,text:`Thank you for supporting Blue Koi Botanicals. If you would like to share your experience, leave a verified purchase review here:\n\n${env.SITE_URL}/review.html#${encodeURIComponent(token)}\n\nHonest feedback, positive or negative, is welcome. Your email and order number will not appear on the review.\n\nQuestions about a defective item? Contact ${store.email}.`});
      if (sent)await run(env,'UPDATE orders SET review_sent=1 WHERE id=?',o.id);
    } catch { /* Retry on the next scheduled run. */ }
  }
  await env.DB.batch([stmt(env,'DELETE FROM quotes WHERE expires_at<? AND id NOT IN (SELECT quote_id FROM orders)',now()-86400),stmt(env,'DELETE FROM rate_limits WHERE expires_at<?',now()),stmt(env,'DELETE FROM review_tokens WHERE expires_at<?',now()),stmt(env,'UPDATE orders SET payment_request=NULL WHERE created_at<?',now()-86400)]);
}
