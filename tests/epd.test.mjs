import {test} from 'node:test';
import assert from 'node:assert/strict';
import {epdFixture} from './epd-fixture.mjs';
import {ready,now,activeProducts} from '../server/core.mjs';
import {gatewayOrigin,parseQuery} from '../server/epd.mjs';
import {maintenance} from '../server/worker.mjs';
const admin=f=>({Authorization:'Bearer '+f.env.ADMIN_TOKEN});
const row=(f,id)=>f.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
const stock=f=>f.env.DB.prepare("SELECT quantity FROM website_inventory WHERE slug='honey-lavender-lip-balm'").first();
const held=f=>f.env.DB.prepare('SELECT COUNT(*) AS n FROM reservations').first();
const aged=async(f,id)=>f.env.DB.prepare('UPDATE orders SET created_at=?,updated_at=? WHERE id=?').bind(now()-4000,now()-100,id).run();
test('EPD catalog has 20 unique SKUs, supplied prices and no invented source stock',()=>{
 assert.equal(activeProducts.length,20);assert.equal(new Set(activeProducts.map(p=>p.epd_sku)).size,20);
 assert.equal(activeProducts.find(p=>p.slug==='cbd-salve').price_cents,2800);
 assert.equal(activeProducts.find(p=>p.slug==='lavender-body-oil').price_cents,1600);
});
test('sandbox cannot send keys to live/custom hosts and live needs explicit launch checks',()=>{
 const f=epdFixture();assert.equal(ready(f.env),true);
 f.env.EPD_GATEWAY_ORIGIN='https://secure.easypaydirectgateway.com';assert.equal(ready(f.env),false);assert.throws(()=>gatewayOrigin(f.env));
 f.env.STORE_MODE='live';assert.equal(ready(f.env),true);
 for(const key of ['INVENTORY_CONFIRMED','EPD_LIVE_ACCOUNT_CONFIRMED','LIVE_LAUNCH_CONFIRMED']) {f.env[key]='false';assert.equal(ready(f.env),false);f.env[key]='true';}
 f.env.EPD_GATEWAY_ORIGIN='https://example.com';assert.equal(ready(f.env),false);f.close();
});
test('public config exposes only the tokenization key; no Square dependencies',async()=>{
 const f=epdFixture(),r=await f.request('/api/config');assert.equal(r.status,200);assert.equal(r.data.checkout_ready,true);assert.equal(r.data.tokenization_key,'fixture-public');assert.equal(r.data.collect_js_url,'https://sandbox.nmi.com/token/Collect.js');assert.ok(!JSON.stringify(r.data).includes('fixture-private'));f.close();
});
test('unconfirmed stock cannot be sold and API inventory does not reuse Square snapshots',async()=>{
 const f=epdFixture({stock:0});assert.equal((await f.request('/api/catalog')).data.products.every(p=>p.stock===0),true);assert.equal((await f.quote()).data.code,'STOCK_CHANGED');assert.equal(f.epd.sales.length,0);f.close();
});
test('EPD sale uses server total, token and integration key; paid stock commits once',async()=>{
 const f=epdFixture(),q=await f.quote(),p=await f.pay(q,{total:1});assert.equal(p.status,200);assert.equal(p.data.status,'paid');
 assert.equal(f.epd.sales[0].amount,'11.52');assert.equal(f.epd.sales[0].payment_token,'cnon:test-only-token');assert.equal(f.epd.sales[0].security_key,f.env.EPD_PRIVATE_API_KEY);assert.equal(f.epd.sales[0].orderid,p.data.id);
 assert.match(f.epd.sales[0].order_description,/909184Y/);assert.equal((await stock(f)).quantity,19);assert.equal((await held(f)).n,0);
 assert.equal((await row(f,p.data.id)).payment_request,null);assert.equal((await row(f,p.data.id)).inventory_committed,1);
 await f.pay(q);await f.request('/api/admin/reconcile',{id:p.data.id},admin(f));assert.equal(f.epd.sales.length,1);assert.equal((await stock(f)).quantity,19);await f.flush();assert.equal(f.state.emails.length,0);f.close();
});
test('parallel submissions for one quote submit exactly one EPD sale',async()=>{
 const f=epdFixture(),q=await f.quote(),results=await Promise.all([f.pay(q),f.pay(q)]);assert.ok(results.every(r=>[200,202].includes(r.status)));assert.equal(f.epd.sales.length,1);assert.equal((await stock(f)).quantity,19);await f.flush();f.close();
});
test('decline closes quote and releases stock without confirmation or labels',async()=>{
 const f=epdFixture();f.epd.decline=true;const q=await f.quote(),p=await f.pay(q);assert.equal(p.data.code,'CARD_DECLINED');assert.equal((await stock(f)).quantity,20);assert.equal((await held(f)).n,0);assert.equal((await f.pay(q)).data.code,'QUOTE_EXPIRED');await f.flush();assert.equal(f.state.emails.length,0);f.close();
});
test('lost approval recovers using Query API without recharging and decrements once',async()=>{
 const f=epdFixture();f.epd.timeout=true;const q=await f.quote(),p=await f.pay(q);assert.equal(p.status,202);assert.equal((await held(f)).n,1);assert.equal((await stock(f)).quantity,20);
 const recovered=await f.pay(q);assert.equal(recovered.data.status,'paid');await maintenance(f.env);assert.equal(f.epd.sales.length,1);assert.equal((await stock(f)).quantity,19);await f.flush();f.close();
});
test('no query match never triggers a second sale or releases a reservation',async()=>{
 const f=epdFixture();f.epd.fail=true;const q=await f.quote(),p=await f.pay(q);await aged(f,p.data.id);f.epd.fail=false;
 await maintenance(f.env);await f.pay(q);assert.equal(f.epd.sales.length,1);assert.equal((await held(f)).n,1);assert.equal((await row(f,p.data.id)).status,'processing');assert.equal((await f.quote()).data.code,'PAYMENT_PENDING');assert.equal((await f.request('/api/admin/cancel-unpaid',{id:p.data.id},admin(f))).status,409);f.close();
});
test('malformed approval and duplicate errors are uncertain, never safe retries',async()=>{
 for(const failure of ['malformed','duplicate']) {const f=epdFixture();f.epd[failure]=true;const q=await f.quote(),p=await f.pay(q);assert.equal(p.status,202);assert.equal((await held(f)).n,1);await f.pay(q);assert.equal(f.epd.sales.length,1);await f.flush();f.close();}
});
test('query amount/currency mismatch cannot fulfill or release pending inventory',async()=>{
 for(const change of [{amount:'0.01'},{currency:'EUR'}]) {const f=epdFixture();f.epd.timeout=true;const q=await f.quote(),p=await f.pay(q);Object.assign(f.epd.records[0],change);const recovered=await f.pay(q);assert.equal(recovered.data.code,'PAYMENT_MISMATCH');assert.equal((await row(f,p.data.id)).status,'processing');assert.equal((await held(f)).n,1);f.close();}
});
test('query outage does not replay payment and preserves the pending order',async()=>{
 const f=epdFixture();f.epd.timeout=true;const q=await f.quote(),p=await f.pay(q);f.epd.queryFailure=true;assert.equal((await f.pay(q)).data.code,'EPD_UNCERTAIN');assert.equal(f.epd.sales.length,1);assert.equal((await row(f,p.data.id)).status,'processing');f.close();
});
test('inventory edits require admin, compare versions and respect payment reservations',async()=>{
 const f=epdFixture(),b={slug:'honey-lavender-lip-balm',version:0,quantity:2};assert.equal((await f.request('/api/admin/inventory',b)).status,401);assert.equal((await f.request('/api/admin/inventory',b,admin(f))).status,200);assert.equal((await f.request('/api/admin/inventory',b,admin(f))).status,409);
 f.epd.fail=true;await f.pay(await f.quote());assert.equal((await f.request('/api/admin/inventory',{...b,version:1,quantity:0},admin(f))).status,409);f.close();
});
test('last unit cannot be oversold by a second session',async()=>{
 const f=epdFixture({stock:1}),q=await f.quote();f.epd.timeout=true;await f.pay(q);
 const cookie='bk_session='+crypto.randomUUID();const q2=await f.request('/api/quote',{cart:[{slug:'honey-lavender-lip-balm',quantity:1}],address:(await import('./fixture.mjs')).address},{Cookie:cookie});
 if(q2.status===200){const p2=await f.request('/api/checkout',{quote_id:q2.data.id,rate_id:q2.data.rates[0].id,source_id:'another-test-token'},{Cookie:cookie});assert.equal(p2.data.code,'STOCK_CHANGED');}
 assert.equal(f.epd.sales.length,1);assert.equal((await held(f)).n,1);f.close();
});
test('live confirmed sale sends customer and owner emails; fulfillment requires live paid order',async()=>{
 const f=epdFixture({live:true}),p=await f.pay(await f.quote());assert.equal(p.data.status,'paid');await f.flush();assert.equal(f.state.emails.length,2);
 assert.equal((await f.request('/api/admin/fulfill',{id:p.data.id,tracking:'TRACK123'},admin(f))).status,200);assert.ok((await row(f,p.data.id)).fulfilled_at);await maintenance(f.env);assert.equal(f.state.emails.length,2);f.close();
});
test('test orders cannot be fulfilled, send paid emails or buy postage',async()=>{
 const f=epdFixture();f.env.SHIPPO_AUTO_LABELS='true';const p=await f.pay(await f.quote());await f.flush();assert.equal(f.state.emails.length,0);assert.equal((await f.request('/api/admin/fulfill',{id:p.data.id,tracking:'TRACK'},admin(f))).status,409);assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS n FROM shipping_labels').first()).n,0);f.close();
});
test('refund reconciliation updates order but does not restock automatically',async()=>{
 const f=epdFixture(),p=await f.pay(await f.quote());f.epd.records[0].refund='11.52';const result=await f.request('/api/admin/reconcile',{id:p.data.id},admin(f));assert.equal(result.data.status,'refunded');assert.equal(result.data.refunded_cents,1152);assert.equal((await stock(f)).quantity,19);await f.flush();f.close();
});
test('test orders are never queried using production credentials',async()=>{
 const f=epdFixture();f.epd.timeout=true;const q=await f.quote();await f.pay(q);f.env.STORE_MODE='live';f.env.EPD_GATEWAY_ORIGIN='https://secure.easypaydirectgateway.com';await f.pay(q);assert.equal(f.epd.queries.length,0);assert.equal(f.epd.sales.length,1);f.close();
});
test('XML parser rejects entity declarations, errors, unrelated and duplicate transactions',()=>{
 const o={id:'order',data:JSON.stringify({totals:{total:100}})};assert.throws(()=>parseQuery('<!DOCTYPE bad><nm_response></nm_response>',o));assert.throws(()=>parseQuery('<nm_response><error>Unauthorized</error></nm_response>',o));assert.equal(parseQuery('<nm_response></nm_response>',o),null);
 assert.throws(()=>parseQuery('<nm_response><transaction><order_id>order</order_id></transaction><transaction><order_id>order</order_id></transaction></nm_response>',o));
});
