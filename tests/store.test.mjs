import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,address} from './fixture.mjs';
import {normalizeCart,totals,parcels,products,store,checkDestination,hmac,digest,now,uuid} from '../server/core.mjs';
import {maintenance} from '../server/worker.mjs';
const lip='honey-lavender-lip-balm';
test('money, all-destination tax, and Shippo-compatible packed weights',()=>{
  assert.deepEqual(totals([{price_cents:500,quantity:1}],625,address),{subtotal:500,shipping:625,tax:27,total:1152,currency:'USD'});
  assert.equal(totals([{price_cents:3200,quantity:1}],625,{...address,state:'CA'}).tax,170);
  const p=products.find(p=>p.slug==='cbd-salve');assert.equal(parcels([{...p,quantity:2}]).length,1);assert.equal(parcels([{...p,quantity:1}])[0].parcel.weight,'0.3969');
  assert.throws(()=>normalizeCart([{slug:lip,quantity:1.5}]));assert.throws(()=>normalizeCart([{slug:lip,quantity:13}]));
});
test('CBD international blocks before any shipping requests; Alaska and Hawaii work',async()=>{
  const f=fixture();const q=await f.quote([{slug:'cbd-salve',quantity:1}],{...address,country:'CA',state:'ON',zip:'M5V 1A1'});assert.equal(q.status,400);assert.equal(q.data.code,'US_ONLY');assert.equal(f.state.shippingCalls,0);
  for(const state of ['AK','HI'])assert.equal((await f.quote([{slug:'cbd-salve',quantity:1}],{...address,state})).status,200);f.close();
});
test('live rates combine the provided parcels; quotes cache and ignore customer price input',async()=>{
  const f=fixture();const cart=[{slug:lip,quantity:2,price_cents:1}];const q=await f.quote(cart);assert.equal(q.status,200);assert.equal(q.data.rates[0].amount,625);assert.equal(q.data.item_totals.subtotal,1000);assert.equal(q.data.item_totals.tax,53);assert.equal(q.data.rates[0].parcel_count,1);
  assert.equal((await f.quote(cart)).data.id,q.data.id);assert.equal(f.state.shippingCalls,1);f.close();
});
test('all foreign shipping is rejected before provider requests',async()=>{
  const f=fixture();
  for(const country of ['CA','GB','FR'])assert.equal((await f.quote(undefined,{...address,country})).data.code,'US_ONLY');
  assert.equal(f.state.shippingCalls,0);f.close();
});
test('price changes, sold-out stock, expired quotes, and altered rates cannot be charged',async()=>{
  const f=fixture();let q=await f.quote();f.state.prices[lip]=600;assert.equal((await f.pay(q)).data.code,'QUOTE_EXPIRED');f.state.prices[lip]=500;
  assert.equal((await f.pay(q,{rate_id:'tampered'})).status,400);
  f.state.stock[lip]=0;assert.equal((await f.pay(q)).data.code,'STOCK_CHANGED');f.state.stock[lip]=90;
  await f.env.DB.prepare('UPDATE quotes SET expires_at=0').run();assert.equal((await f.pay(q)).data.code,'QUOTE_EXPIRED');assert.equal(f.state.paymentCalls,0);f.close();
});
test('one order per quote, repeated payment cannot double charge, and order access is session bound',async()=>{
  const f=fixture(),q=await f.quote(),paid=await f.pay(q,{total:1});assert.equal(paid.status,200);assert.equal(paid.data.status,'paid');assert.equal(paid.data.totals.total,1152);
  const repeated=await f.pay(q);assert.equal(repeated.data.id,paid.data.id);assert.equal(f.state.paymentCalls,1);
  assert.equal((await f.request('/api/order/'+paid.data.id,undefined,{Cookie:'bk_session='+uuid()})).status,404);
  await f.flush();f.close();
});
test('a lost successful payment response is reconciled without charging again',async()=>{
  const f=fixture(),q=await f.quote();f.state.timeoutPayment=true;const p=await f.pay(q);assert.equal(p.status,202);assert.equal(p.data.status,'processing');
  const recovered=await f.request('/api/checkout',{quote_id:q.data.id});assert.equal(recovered.data.status,'paid');assert.equal(f.state.paymentCalls,1);await f.flush();f.close();
});
test('definite decline closes the quote and releases reservation',async()=>{
  const f=fixture(),q=await f.quote();f.state.decline=true;assert.equal((await f.pay(q)).status,400);assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS n FROM reservations').first()).n,0);assert.equal((await f.pay(q)).data.code,'QUOTE_EXPIRED');await f.flush();f.close();
});
test('concurrent checkout for the same quote creates a single payment',async()=>{
  const f=fixture(),q=await f.quote();const result=await Promise.all([f.pay(q),f.pay(q)]);assert.ok(result.every(r=>[200,202].includes(r.status)));assert.equal(f.state.paymentCalls,1);await f.flush();f.close();
});
test('verified reviews require a valid purchase token and moderation; one per product per order',async()=>{
  const f=fixture(),q=await f.quote(),p=await f.pay(q),token='test-private-review-token';
  await f.env.DB.prepare('INSERT INTO review_tokens VALUES(?,?,?)').bind(await digest(token),p.data.id,now()+1000).run();
  const review={token,slug:lip,author:'Test Buyer',rating:1,body:'The texture did not suit my preferences.'};
  assert.equal((await f.request('/api/reviews',{...review,token:'invalid'})).status,403);
  assert.equal((await f.request('/api/reviews',{...review,slug:'cbd-salve'})).status,403);
  assert.equal((await f.request('/api/reviews',review)).status,201);assert.equal((await f.request('/api/reviews',review)).status,409);
  assert.equal((await f.request('/api/reviews?product='+lip)).data.count,0);
  const r=await f.env.DB.prepare('SELECT id FROM reviews').first();
  assert.equal((await f.request('/api/admin/reviews',{id:r.id,status:'published'})).status,401);
  assert.equal((await f.request('/api/admin/reviews',{id:r.id,status:'published'},{Authorization:'Bearer '+f.env.ADMIN_TOKEN})).status,200);
  const published=await f.request('/api/reviews?product='+lip);assert.equal(published.data.average,1);assert.equal(published.data.count,1);assert.equal(published.data.reviews[0].email,undefined);await f.flush();f.close();
});
test('signed webhooks only, cross-origin posts rejected, preview mode cannot charge',async()=>{
  const f=fixture();assert.equal((await f.request('/api/quote',{cart:[{slug:lip,quantity:1}],address},{Origin:'https://attacker.example'})).status,403);
  assert.equal((await f.request('/api/webhooks/square',{})).status,403);
  const event={type:'payment.updated',data:{object:{}}},sig=await hmac(f.env.SQUARE_WEBHOOK_SIGNATURE_KEY,f.env.SQUARE_WEBHOOK_URL+JSON.stringify(event));
  assert.equal((await f.request('/api/webhooks/square',event,{'x-square-hmacsha256-signature':sig})).status,200);
  f.env.STORE_MODE='preview';assert.equal((await f.quote()).data.code,'SETUP_REQUIRED');assert.equal(f.state.paymentCalls,0);f.close();
});
test('confirmation and review emails wait for paid and fulfilled orders; scheduled retries do not duplicate flags',async()=>{
  const f=fixture();f.env.RESEND_API_KEY='test';f.env.EMAIL_FROM='Blue Koi <orders@example.com>';
  const q=await f.quote(),p=await f.pay(q);await f.flush();assert.equal(f.state.emails.length,2);
  await f.env.DB.prepare('UPDATE orders SET fulfilled_at=? WHERE id=?').bind(now()-11*86400,p.data.id).run();
  await maintenance(f.env);await maintenance(f.env);assert.equal(f.state.emails.length,3);assert.match(f.state.emails[2].text,/review.html#/);f.close();
});
