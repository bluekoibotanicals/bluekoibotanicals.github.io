import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,address} from './fixture.mjs';
import {now} from '../server/core.mjs';
import {ensureLabel,maintainLabels} from '../server/labels.mjs';
import {maintenance} from '../server/worker.mjs';

const admin=f=>({Authorization:'Bearer '+f.env.ADMIN_TOKEN});
const row=(f,id)=>f.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
const label=(f,id)=>f.env.DB.prepare('SELECT * FROM shipping_labels WHERE order_id=?').bind(id).first();
async function age(f){await f.env.DB.prepare('UPDATE shipping_labels SET checked_at=?').bind(now()-300).run();}
function automated(){
  const f=fixture(),original=f.env.FETCH;
  f.env.SHIPPO_AUTO_LABELS='true';
  f.env.RESEND_API_KEY='fixture';f.env.EMAIL_FROM='orders@example.com';f.env.OWNER_EMAIL='owner@example.com';
  const state={purchases:0,transactions:[],lost:false,unavailable:false,status:'SUCCESS',requests:[]};
  f.env.FETCH=async(url,options={})=>{
    const u=new URL(url),reply=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
    if(u.pathname==='/transactions/' && options.method==='POST'){
      state.purchases++;state.requests.push(JSON.parse(options.body));
      if(state.unavailable)throw Error('Timeout before receipt');
      const b=JSON.parse(options.body),t={object_id:'transaction-'+state.purchases,metadata:b.metadata,rate:{object_id:b.rate},status:state.status,label_url:'https://example.com/label.pdf',tracking_number:'TRACK123',test:true};
      state.transactions.push(t);
      if(state.lost)throw Error('Response lost after purchase');
      return reply(t);
    }
    if(u.pathname==='/transactions/')return reply({results:state.transactions,next:null});
    if(u.pathname.startsWith('/transactions/'))return reply(state.transactions.find(t=>u.pathname.includes(t.object_id)));
    return original(url,options);
  };
  return {...f,labels:state};
}

test('SAVE15FORYOU gives 15 percent and free standard shipping below $25; Square charges the correct total',async()=>{
  const f=automated();
  try{
    const q=await f.quote(undefined,address,'save15foryou');
    assert.equal(q.status,200);assert.equal(q.data.item_totals.subtotal,500);
    assert.equal(q.data.discount.amount,75);assert.equal(q.data.discount.free_shipping,true);
    assert.equal(q.data.item_totals.tax,23);assert.equal(q.data.rates[0].amount,0);assert.equal(q.data.rates[1].amount,910);
    assert.equal(q.data.rates[0].shippo_rate_ids,undefined);
    const p=await f.pay(q);await f.flush();
    assert.equal(p.data.totals.total,448);assert.equal(f.state.paymentRequests[0].amount_money.amount,448);
    assert.equal(f.labels.purchases,1);assert.equal(f.labels.requests[0].rate,'shippo-ground-1');
    const saved=JSON.parse((await row(f,p.data.id)).data);
    assert.equal(saved.rate.carrier_amount,625);assert.equal((await label(f,p.data.id)).status,'ready');
  }finally{await f.flush();f.close();}
});

test('SAVE15FORYOU applies to larger CBD carts and can be deactivated, invalidating open quotes',async()=>{
  const f=fixture();
  try{
    const q=await f.quote([{slug:'cbd-salve',quantity:2}],address,'SAVE15FORYOU');
    assert.equal(q.data.discount.amount,960);assert.equal(q.data.rates[0].amount,0);
    await f.request('/api/admin/discount-codes',{action:'set-active',code:'SAVE15FORYOU',active:false},admin(f));
    assert.equal((await f.pay(q)).data.code,'QUOTE_EXPIRED');assert.equal(f.state.paymentCalls,0);
  }finally{await f.flush();f.close();}
});

test('one paid order buys one label across checkout, webhook-style concurrent calls, cron, and admin checks',async()=>{
  const f=automated();
  try{
    const q=await f.quote(),p=await f.pay(q);await f.flush();
    const o=await row(f,p.data.id);
    await Promise.all([ensureLabel(f.env,o),ensureLabel(f.env,o),f.pay(q)]);await f.flush();
    await maintenance(f.env);
    await f.request('/api/admin/label-check',{id:o.id},admin(f));
    assert.equal(f.labels.purchases,1);assert.equal(f.state.paymentCalls,1);
    assert.equal(f.labels.requests[0].label_file_type,'PDF_4x6');
    assert.equal((await row(f,o.id)).fulfilled_at,null);
    assert.equal(f.state.emails.filter(e=>e.subject.startsWith('Label ready')).length,1);
    const orders=await f.request('/api/admin/orders',undefined,admin(f));
    assert.equal(orders.data.orders[0].label.label_url,'https://example.com/label.pdf');
    const publicOrder=await f.request('/api/order/'+o.id);
    assert.equal(publicOrder.data.label,undefined);
    assert.equal((await f.request('/api/admin/label-check',{id:o.id})).status,401);
  }finally{await f.flush();f.close();}
});

test('concurrent handlers claim a pending label atomically',async()=>{
  const f=automated();f.env.SHIPPO_AUTO_LABELS='false';
  try{
    const p=await f.pay(await f.quote());await f.flush();
    await f.env.DB.prepare("UPDATE orders SET data=json_set(data,'$.auto_label',json('true')) WHERE id=?").bind(p.data.id).run();
    f.env.SHIPPO_AUTO_LABELS='true';const o=await row(f,p.data.id);
    await Promise.all([ensureLabel(f.env,o),ensureLabel(f.env,o),ensureLabel(f.env,o)]);
    assert.equal(f.labels.purchases,1);
  }finally{await f.flush();f.close();}
});

test('lost successful Shippo response is recovered without purchasing another label',async()=>{
  const f=automated();f.labels.lost=true;
  try{
    const p=await f.pay(await f.quote());await f.flush();
    assert.equal(p.data.status,'paid');assert.equal((await label(f,p.data.id)).status,'uncertain');
    await age(f);await maintainLabels(f.env);
    assert.equal((await label(f,p.data.id)).status,'ready');assert.equal(f.labels.purchases,1);
    assert.equal(f.state.emails.filter(e=>e.subject.startsWith('Shipping label needs')).length,1);
    assert.equal(f.state.emails.filter(e=>e.subject.startsWith('Label ready')).length,1);
  }finally{await f.flush();f.close();}
});

test('unknown purchase outcome is never blindly retried and keeps payment successful',async()=>{
  const f=automated();f.labels.unavailable=true;
  try{
    const p=await f.pay(await f.quote());await f.flush();
    for(let i=0;i<3;i++){await age(f);await maintainLabels(f.env);}
    assert.equal(f.labels.purchases,1);assert.equal((await label(f,p.data.id)).status,'uncertain');
    assert.equal((await row(f,p.data.id)).status,'paid');
  }finally{await f.flush();f.close();}
});

test('Shippo queued transaction is polled until its printable label is ready',async()=>{
  const f=automated();f.labels.status='QUEUED';
  try{
    const p=await f.pay(await f.quote());await f.flush();
    assert.equal((await label(f,p.data.id)).status,'waiting');
    f.labels.transactions[0].status='SUCCESS';await age(f);await maintainLabels(f.env);
    assert.equal((await label(f,p.data.id)).status,'ready');assert.equal(f.labels.purchases,1);
  }finally{await f.flush();f.close();}
});

test('definitive Shippo errors alert the owner and do not undo payment or repeat postage purchases',async()=>{
  const f=automated();f.labels.status='ERROR';
  try{
    const p=await f.pay(await f.quote());await f.flush();await maintainLabels(f.env);
    assert.equal((await label(f,p.data.id)).status,'error');assert.equal(f.labels.purchases,1);
    assert.equal((await row(f,p.data.id)).status,'paid');
    assert.equal(f.state.emails.filter(e=>e.subject.startsWith('Shipping label needs')).length,1);
  }finally{await f.flush();f.close();}
});

test('failed or uncertain payments cannot buy postage; recovered successful payment does',async()=>{
  for(const failure of ['decline','failPayment','timeoutPayment']){
    const f=automated();f.state[failure]=true;
    try{
      const p=await f.pay(await f.quote());await f.flush();
      assert.equal(f.labels.purchases,0);
      if(failure==='timeoutPayment'){
        await maintenance(f.env);assert.equal(f.labels.purchases,1);assert.equal((await row(f,p.data.id)).status,'paid');
      }
    }finally{await f.flush();f.close();}
  }
});

test('historic, fulfilled, and refunded orders are not automatically labeled',async()=>{
  for(const condition of ['historic','fulfilled','refunded']){
    const f=automated();f.env.SHIPPO_AUTO_LABELS='false';
    try{
      const p=await f.pay(await f.quote());await f.flush();
      if(condition!=='historic')await f.env.DB.prepare("UPDATE orders SET data=json_set(data,'$.auto_label',json('true')) WHERE id=?").bind(p.data.id).run();
      if(condition==='fulfilled')await f.env.DB.prepare('UPDATE orders SET fulfilled_at=? WHERE id=?').bind(now(),p.data.id).run();
      if(condition==='refunded')await f.env.DB.prepare("UPDATE orders SET status='refunded' WHERE id=?").bind(p.data.id).run();
      f.env.SHIPPO_AUTO_LABELS='true';await maintainLabels(f.env);await ensureLabel(f.env,await row(f,p.data.id));
      assert.equal(f.labels.purchases,0);
    }finally{await f.flush();f.close();}
  }
});

test('live mode refuses a test Shippo key before any postage purchase',async()=>{
  const f=automated();f.env.SHIPPO_AUTO_LABELS='false';
  try{
    const p=await f.pay(await f.quote());await f.flush();
    await f.env.DB.prepare("UPDATE orders SET data=json_set(data,'$.auto_label',json('true')) WHERE id=?").bind(p.data.id).run();
    f.env.SHIPPO_AUTO_LABELS='true';f.env.STORE_MODE='live';
    await ensureLabel(f.env,await row(f,p.data.id));
    assert.equal(f.labels.purchases,0);assert.equal((await label(f,p.data.id)).status,'error');
  }finally{await f.flush();f.close();}
});
