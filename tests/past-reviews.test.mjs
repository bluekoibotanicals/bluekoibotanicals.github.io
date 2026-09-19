import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,address} from './fixture.mjs';
import {now} from '../server/core.mjs';
import {maintenance} from '../server/worker.mjs';
import {readFileSync} from 'node:fs';
import {LocalDB} from '../scripts/local-db.mjs';
const endpoint='/api/admin/past-review-invitations';
const lip='lavender-spearmint-lip-balm';
const admin=f=>({Authorization:'Bearer '+f.env.ADMIN_TOKEN});
const payload={action:'create',email:'past@example.com',customer_name:'Past Buyer',source:'square',purchase_reference:'receipt-123',purchased_on:'2025-01-10',products:[lip],purchase_verified:true};
function setup(){const f=fixture();f.env.RESEND_API_KEY='test';f.env.EMAIL_FROM='Blue Koi <orders@example.com>';return f;}
const invite=(f,extra={})=>f.request(endpoint,{...payload,...extra},admin(f));
const tokenFrom=f=>decodeURIComponent(f.state.emails[0].text.match(/review\.html#([^\s]+)/)[1]);
test('past purchase invitation sends once without orders, payments, shipping, or private data exposure',async()=>{
  const f=setup();try {
    const response=await invite(f);assert.equal(response.status,201);assert.equal(response.data.delivery,'sent');
    assert.equal(f.state.emails.length,1);assert.deepEqual(f.state.emails[0].to,['past@example.com']);
    assert.equal(f.state.paymentCalls,0);assert.equal(f.state.shippingCalls,0);assert.equal(f.state.catalogCalls,0);
    assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first()).n,0);
    const token=tokenFrom(f),lookup=await f.request('/api/review-invitation',{token});
    assert.equal(lookup.data.products[0].slug,lip);assert.equal(lookup.data.email,undefined);
    assert.equal((await invite(f)).data.code,'INVITATION_EXISTS');assert.equal((await invite(f,{purchase_reference:'RECEIPT-123'})).status,409);
    await maintenance(f.env);assert.equal(f.state.emails.length,1);
    const list=await f.request(endpoint,undefined,admin(f));assert.equal(list.data.invitations[0].email,'past@example.com');assert.equal(list.data.invitations[0].token_hash,undefined);assert.equal(list.data.invitations[0].email_payload,undefined);
  }finally{f.close();}
});
test('past reviews require correct product and token, allow one submission, and join moderated public ratings',async()=>{
  const f=setup();try {
    await invite(f);const token=tokenFrom(f),review={token,slug:lip,author:'Buyer',rating:2,body:'The texture was not my favorite.'};
    assert.equal((await f.request('/api/reviews',{...review,slug:'cbd-salve'})).status,403);
    assert.equal((await f.request('/api/reviews',{...review,token:'invalid'})).status,403);
    assert.equal((await f.request('/api/reviews',review)).status,201);
    assert.equal((await f.request('/api/reviews',review)).status,409);
    assert.equal((await f.request('/api/reviews?product='+lip)).data.count,0);
    const pending=(await f.request('/api/admin/reviews',undefined,admin(f))).data.reviews[0];
    assert.equal(pending.purchase_source,'square');assert.equal(pending.status,'pending');
    assert.equal((await f.request('/api/admin/reviews',{id:pending.id,status:'published'})).status,401);
    assert.equal((await f.request('/api/admin/reviews',{id:pending.id,status:'published'},admin(f))).status,200);
    let publicData=(await f.request('/api/reviews?product='+lip)).data;assert.equal(publicData.count,1);assert.equal(publicData.average,2);
    assert.doesNotMatch(JSON.stringify(publicData),/past@example.com|receipt-123/);
    assert.equal((await f.request('/api/review-invitation',{token})).data.products[0].submitted,true);
    await f.request('/api/admin/reviews',{id:pending.id,status:'rejected',reason:'Contains private information'},admin(f));
    assert.equal((await f.request('/api/reviews?product='+lip)).data.count,0);
  }finally{f.close();}
});
test('invitation admin permissions, purchase attestation, dates and product validation are enforced',async()=>{
  const f=setup();try {
    assert.equal((await f.request(endpoint)).status,401);assert.equal((await f.request(endpoint,payload)).status,401);
    for(const extra of [{purchase_verified:false},{email:'bad'},{source:'unknown'},{purchase_reference:''},{products:[]},{products:['made-up']},{purchased_on:'2039-12-31'},{purchased_on:'2025-02-30'}])assert.equal((await invite(f,extra)).status,400);
    assert.equal(f.state.emails.length,0);
    f.env.RESEND_API_KEY='';assert.equal((await invite(f)).status,503);
  }finally{f.close();}
});
test('revoked and expired past invitation links cannot submit; copied links stay scoped',async()=>{
  const f=setup();try {
    const i=await invite(f),token=tokenFrom(f);
    const link=await f.request(endpoint,{action:'link',id:i.data.id},admin(f));assert.equal(decodeURIComponent(link.data.url.split('#')[1]),token);
    await f.request(endpoint,{action:'revoke',id:i.data.id},admin(f));
    assert.equal((await f.request('/api/review-invitation',{token})).status,403);
    assert.equal((await f.request('/api/reviews',{token,slug:lip,author:'Buyer',rating:5,body:'Nice product and texture.'})).status,403);
    assert.equal((await f.request(endpoint,{action:'link',id:i.data.id},admin(f))).status,409);
    await f.env.DB.prepare('UPDATE past_review_invitations SET revoked_at=NULL,expires_at=? WHERE id=?').bind(now()-1,i.data.id).run();
    assert.equal((await f.request('/api/review-invitation',{token})).status,403);
  }finally{f.close();}
});
test('invitation email retries reuse a frozen payload and stop before provider deduplication expires',async()=>{
  const f=setup();try {
    f.state.failEmailTo=payload.email;const i=await invite(f);assert.equal(i.data.delivery,'pending');
    const row=await f.env.DB.prepare('SELECT * FROM past_review_invitations WHERE id=?').bind(i.data.id).first();
    f.state.failEmailTo=null;f.env.EMAIL_FROM='Changed <changed@example.com>';
    await f.env.DB.prepare('UPDATE past_review_invitations SET last_attempt_at=? WHERE id=?').bind(now()-301,i.data.id).run();
    await Promise.all([maintenance(f.env),maintenance(f.env)]);assert.equal(f.state.emails.length,1);assert.equal(f.state.emails[0].from,JSON.parse(row.email_payload).from);
    f.state.failEmailTo=payload.email;const late=await invite(f,{purchase_reference:'receipt-late'});
    await f.env.DB.prepare('UPDATE past_review_invitations SET first_attempt_at=?,last_attempt_at=? WHERE id=?').bind(now()-24*3600,now()-400,late.data.id).run();
    f.state.failEmailTo=null;await maintenance(f.env);assert.equal(f.state.emails.length,1);
    const list=(await f.request(endpoint,undefined,admin(f))).data.invitations;assert.equal(list.find(x=>x.id===late.data.id).delivery,'check_email_service');
  }finally{f.close();}
});
test('checkout advertises only an active eligible FREESHIP25 and still charges shipping without a code',async()=>{
  const f=fixture();try {
    let config=(await f.request('/api/config')).data;assert.equal(config.free_shipping.enabled,true);assert.match(config.free_shipping.banner,/first 50/);assert.equal(config.free_shipping.code,'FREESHIP25');
    const cart=[{slug:lip,quantity:6}];assert.equal((await f.quote(cart)).data.rates[0].amount,625);
    assert.equal((await f.quote(cart,address,'FREESHIP25')).data.rates[0].amount,0);
    assert.equal((await f.quote([{slug:lip,quantity:5}],address,'FREESHIP25')).data.code,'DISCOUNT_INVALID');
    await f.request('/api/admin/discount-codes',{action:'set-active',code:'FREESHIP25',active:false},admin(f));
    assert.equal((await f.request('/api/config')).data.free_shipping.enabled,false);
  }finally{f.close();}
});
test('migration preserves original reviews and existing FREESHIP25 choices',async()=>{
  const db=new LocalDB();try {
    for(const name of ['0001_store.sql','0002_recovery_notifications.sql','0003_discount_codes.sql'])db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
    db.exec("INSERT INTO orders(id,quote_id,session_hash,status,data,created_at,updated_at) VALUES('old','q','s','paid','{}',1,1); INSERT INTO reviews(id,order_id,slug,rating,author,body,status,created_at) VALUES('review','old','lavender-spearmint-lip-balm',4,'Buyer','Existing review','published',1); INSERT INTO review_tokens VALUES('hash','old',9999999999); INSERT INTO discount_codes VALUES('FREESHIP25','free_shipping',0,2501,0,1,1);");
    db.exec(readFileSync(new URL('../migrations/0004_past_customer_reviews.sql',import.meta.url),'utf8'));
    assert.equal((await db.prepare('SELECT * FROM all_product_reviews').first()).rating,4);
    assert.equal((await db.prepare('SELECT * FROM review_tokens').first()).token_hash,'hash');
    assert.equal((await db.prepare('SELECT * FROM discount_codes').first()).active,0);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  }finally{db.close();}
});
