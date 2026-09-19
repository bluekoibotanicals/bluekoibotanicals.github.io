import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,address} from './fixture.mjs';
import {products,store,parcels,now,totals,promotionalRates} from '../server/core.mjs';
import {maintenance} from '../server/worker.mjs';
const lip='honey-lavender-lip-balm',cbd='cbd-salve';
const admin=f=>({Authorization:'Bearer '+f.env.ADMIN_TOKEN});
const emails=f=>{f.env.RESEND_API_KEY='fixture';f.env.EMAIL_FROM='Blue Koi <orders@example.com>';f.env.OWNER_EMAIL='owner@example.com';};
async function pending(f,age=3601){
  const q=await f.quote();f.state.failPayment=true;const p=await f.pay(q);assert.equal(p.status,202);
  await f.env.DB.prepare('UPDATE orders SET created_at=?,updated_at=?,recovery_checked_at=0 WHERE id=?').bind(now()-age,now()-age,p.data.id).run();
  return {q,p};
}
test('CBD restrictions include mixed carts; non-CBD can ship to excluded states',async()=>{
  const f=fixture();
  for(const state of ['CO','ID','WY']){
    const a={...address,state};
    assert.equal((await f.quote([{slug:cbd,quantity:1},{slug:lip,quantity:1}],a)).data.code,'CBD_STATE_RESTRICTED');
    assert.equal((await f.quote([{slug:lip,quantity:1}],a)).status,200);
  }
  assert.equal(f.state.shippingCalls,3);f.close();
});
test('checkout rechecks destinations and rejects stale policy quotes before charging',async()=>{
  const f=fixture(),q=await f.quote([{slug:cbd,quantity:1}]);
  const row=await f.env.DB.prepare('SELECT data FROM quotes WHERE id=?').bind(q.data.id).first(),data=JSON.parse(row.data);
  for(const state of ['CO','ID','WY']){
    data.address.state=state;
    await f.env.DB.prepare('UPDATE quotes SET data=? WHERE id=?').bind(JSON.stringify(data),q.data.id).run();
    assert.equal((await f.pay(q)).data.code,'CBD_STATE_RESTRICTED');
  }
  data.address.country='CA';
  await f.env.DB.prepare('UPDATE quotes SET data=? WHERE id=?').bind(JSON.stringify(data),q.data.id).run();
  assert.equal((await f.pay(q)).data.code,'US_ONLY');
  data.address={...address};delete data.shipping_policy;
  await f.env.DB.prepare('UPDATE quotes SET data=? WHERE id=?').bind(JSON.stringify(data),q.data.id).run();
  assert.equal((await f.pay(q)).data.code,'QUOTE_EXPIRED');
  assert.equal(f.state.paymentCalls,0);f.close();
});
test('combined parcels use one large box, sum all weights, and stay within four decimals',()=>{
  for(const p of products){
    const single=parcels([{...p,quantity:1}])[0].parcel;
    assert.equal(Number(single.length),store.packages[p.package].length);
    for(const quantity of [1,2,12]){
      const packs=parcels([{...p,quantity}]);assert.equal(packs.length,1);
      const box=store.packages[quantity>1?'large':p.package];
      assert.equal(Number(packs[0].parcel.weight),Number((p.weight_lb*quantity+box.weight_lb).toFixed(4)));
      assert.match(packs[0].parcel.weight,/^\d+(\.\d{1,4})?$/);
    }
  }
  const lines=products.slice(0,2).map(p=>({...p,quantity:2})),pack=parcels(lines)[0];
  assert.equal(pack.items.length,2);assert.equal(pack.parcel.length,'8');
  assert.equal(Number(pack.parcel.weight),Number((lines.reduce((n,p)=>n+p.weight_lb*p.quantity,0)+0.22).toFixed(4)));
});
test('all destinations use 5.3 percent on merchandise only',()=>{
  for(const state of ['VA','CA','NY','AK','HI','CO','ID','WY']){
    assert.deepEqual(totals([{price_cents:3200,quantity:1}],625,{...address,state}),{subtotal:3200,discount:0,shipping:625,tax:170,total:3995,currency:'USD'});
  }
});
test('discount codes apply to merchandise before tax and the Square order',async()=>{
  const f=fixture();
  assert.equal((await f.request('/api/admin/discount-codes',{action:'create',code:'SAVE10',kind:'percent',value:1000,minimum_subtotal_cents:0},admin(f))).status,201);
  const q=await f.quote(undefined,address,'save10');assert.equal(q.status,200);
  assert.deepEqual(q.data.discount,{code:'SAVE10',kind:'percent',value:1000,minimum_subtotal_cents:0,amount:50});
  assert.equal(q.data.item_totals.discount,50);assert.equal(q.data.item_totals.tax,24);assert.equal(q.data.item_totals.total,474);
  const paid=await f.pay(q);assert.equal(paid.data.totals.total,1099);assert.equal(f.state.paymentRequests[0].amount_money.amount,1099);
  assert.equal([...f.state.orders.values()][0].discounts[0].amount_money.amount,50);await f.flush();f.close();
});
test('free shipping works only through an eligible code and leaves expedited shipping priced',async()=>{
  const f=fixture();
  await f.request('/api/admin/discount-codes',{action:'create',code:'FREESHIP25',kind:'free_shipping',value:0,minimum_subtotal_cents:2501},admin(f));
  const noCode=await f.quote([{slug:lip,quantity:6}]);assert.equal(noCode.data.rates[0].amount,625);
  const q=await f.quote([{slug:lip,quantity:6}],address,'freeship25');assert.equal(q.status,200);assert.equal(q.data.rates[0].amount,0);assert.equal(q.data.rates[0].free_shipping,true);assert.equal(q.data.rates[1].amount,910);
  assert.equal((await f.quote([{slug:lip,quantity:5}],address,'freeship25')).data.code,'DISCOUNT_INVALID');
  const paid=await f.pay(q);assert.equal(paid.data.totals.total,3159);assert.equal([...f.state.orders.values()][0].service_charges.length,0);await f.flush();f.close();
});
test('discount codes are safely deactivated and stale quotes cannot charge',async()=>{
  const f=fixture();
  assert.equal((await f.request('/api/admin/discount-codes',{action:'create',code:'TAKE5',kind:'fixed',value:500,minimum_subtotal_cents:0},admin(f))).status,201);
  assert.equal((await f.request('/api/admin/discount-codes',{action:'create',code:'TAKE5',kind:'fixed',value:500,minimum_subtotal_cents:0},admin(f))).data.code,'DISCOUNT_EXISTS');
  const q=await f.quote(undefined,address,'TAKE5');assert.equal(q.data.item_totals.discount,500);
  assert.equal((await f.request('/api/admin/discount-codes',{action:'set-active',code:'TAKE5',active:false},admin(f))).status,200);
  assert.equal((await f.pay(q)).data.code,'QUOTE_EXPIRED');assert.equal(f.state.paymentCalls,0);
  const codes=await f.request('/api/admin/discount-codes',undefined,admin(f));assert.equal(codes.data.discount_codes[0].active,0);f.close();
});
test('live configuration uses real rates, all-destination tax, and an optional code',async()=>{
  const f=fixture();emails(f);Object.assign(f.env,{STORE_MODE:'live',SQUARE_ENVIRONMENT:'production',LIVE_LAUNCH_CONFIRMED:'true',SHIPPO_API_KEY:'shippo_live_fixture'});
  await f.request('/api/admin/discount-codes',{action:'create',code:'FREESHIP',kind:'free_shipping',value:0,minimum_subtotal_cents:0},admin(f));
  const q=await f.quote([{slug:cbd,quantity:1}],{...address,state:'NY'},'FREESHIP');assert.equal(q.status,200);
  assert.equal(q.data.item_totals.tax,170);assert.equal(q.data.rates[0].amount,0);
  const p=await f.pay(q);assert.equal(p.data.totals.total,3370);await f.flush();assert.equal(f.state.emails.length,2);f.close();
});
test('owner and customer emails retry independently, with persistent sent flags',async()=>{
  for(const failing of ['customer@example.com','owner@example.com']){
    const f=fixture();emails(f);f.state.failEmailTo=failing;
    const p=await f.pay(await f.quote());await f.flush();
    assert.equal(f.state.emails.length,1);assert.ok(!f.state.emails[0].to.includes(failing));
    f.state.failEmailTo=null;await maintenance(f.env);await maintenance(f.env);
    assert.equal(f.state.emails.length,2);
    const row=await f.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(p.data.id).first();
    assert.equal(row.email_sent,1);assert.equal(row.owner_email_sent,1);
    const owner=f.state.emails.find(e=>e.to.includes('owner@example.com'));
    assert.match(owner.text,/100 Test Street/);assert.match(owner.text,/Package:/);assert.match(owner.text,/Sales tax \(5.3%\)/);
    f.close();
  }
});
test('failed or uncertain payment never sends paid-order email',async()=>{
  for(const failure of ['decline','failPayment']){
    const f=fixture();emails(f);f.state[failure]=true;await f.pay(await f.quote());await f.flush();assert.equal(f.state.emails.length,0);f.close();
  }
});
test('payment recovery works beyond one hour with the exact original request',async()=>{
  const f=fixture();emails(f);const {p}=await pending(f);
  f.state.failPayment=false;await maintenance(f.env);await maintenance(f.env);
  const row=await f.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(p.data.id).first();
  assert.equal(row.status,'paid');assert.equal(row.payment_request,null);assert.equal(f.state.paymentCalls,2);
  assert.deepEqual(f.state.paymentRequests[1],f.state.paymentRequests[0]);assert.equal(f.state.payments.size,1);
  assert.equal(f.state.emails.length,2);f.close();
});
test('expired recovery window holds inventory and requires verified unpaid cancellation',async()=>{
  const f=fixture(),{p}=await pending(f,24*3600+1);
  f.state.failPayment=false;await maintenance(f.env);
  let row=await f.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(p.data.id).first();
  assert.equal(row.status,'processing');assert.match(row.recovery_note,/window ended/);assert.equal(row.payment_request,null);
  assert.equal(f.state.paymentCalls,1);assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS n FROM reservations').first()).n,1);
  assert.equal((await f.request('/api/admin/cancel-unpaid',{id:p.data.id})).status,401);
  assert.equal((await f.request('/api/admin/cancel-unpaid',{id:p.data.id},admin(f))).status,200);
  row=await f.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(p.data.id).first();
  assert.equal(row.status,'failed');assert.equal([...f.state.orders.values()][0].state,'CANCELED');
  assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS n FROM reservations').first()).n,0);
  assert.equal((await f.quote()).status,200);f.close();
});
test('cancel unpaid refuses recent, paid, or provider-unverifiable orders',async()=>{
  const f=fixture(),{p}=await pending(f,30);
  assert.equal((await f.request('/api/admin/cancel-unpaid',{id:p.data.id},admin(f))).status,409);
  await f.env.DB.prepare('UPDATE orders SET created_at=?').bind(now()-3600).run();
  const fetch=f.env.FETCH;f.env.FETCH=async()=>{throw Error('Square unavailable');};
  assert.equal((await f.request('/api/admin/cancel-unpaid',{id:p.data.id},admin(f))).status,503);
  assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS n FROM reservations').first()).n,1);
  f.env.FETCH=fetch;f.state.failPayment=false;await maintenance(f.env);
  assert.equal((await f.request('/api/admin/cancel-unpaid',{id:p.data.id},admin(f))).status,409);
  await f.flush();f.close();
});
