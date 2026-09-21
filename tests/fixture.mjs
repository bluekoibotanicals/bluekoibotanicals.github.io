import {readFileSync,readdirSync} from 'node:fs';
import {LocalDB} from '../scripts/local-db.mjs';
import worker from '../server/worker.mjs';
import {products} from '../server/core.mjs';
export const address={name:'Test Customer',email:'customer@example.com',phone:'2025550123',street1:'100 Test Street',street2:'',city:'Charlottesville',state:'VA',zip:'22902',country:'US'};
export function fixture(){
  const DB=new LocalDB();
  for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())DB.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  // Fixture mappings never touch the source catalog.
  products.forEach(p=>p.square_variation_id=`v-${p.slug}`);
  const state={paymentCalls:0,shippingCalls:0,catalogCalls:0,orders:new Map(),payments:new Map(),stock:{},prices:{},failPayment:false,timeoutPayment:false,decline:false,emails:[],emailKeys:new Set(),failEmailTo:null,paymentRequests:[]};
  const env={DB,STORE_MODE:'sandbox',SITE_URL:'https://store.example',SQUARE_ENVIRONMENT:'sandbox',SQUARE_APPLICATION_ID:'sandbox-app',SQUARE_LOCATION_ID:'location',SQUARE_ACCESS_TOKEN:'test-only',SHIPPO_API_KEY:'shippo_test_fixture',SHIP_FROM_JSON:JSON.stringify({name:'Blue Koi',street1:'Test origin',city:'Charlottesville',state:'VA',zip:'22902',country:'US',phone:'2025550123'}),CUSTOMS_SIGNER:'Test owner',ADMIN_TOKEN:'test-admin-key-32-characters-long-only',SQUARE_WEBHOOK_SIGNATURE_KEY:'test-webhook',SQUARE_WEBHOOK_URL:'https://store.example/api/webhooks/square'};
  const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  function orderTotals(order){const subtotal=order.line_items.reduce((n,p)=>n+p.base_price_money.amount*Number(p.quantity),0),discount=order.discounts?.reduce((n,p)=>n+p.amount_money.amount,0)||0,tax=order.taxes?.length?Math.round((subtotal-discount)*0.053):0,shipping=order.service_charges?.reduce((n,p)=>n+p.amount_money.amount,0)||0;return {...order,total_money:{amount:subtotal-discount+tax+shipping,currency:'USD'},total_tax_money:{amount:tax,currency:'USD'},total_discount_money:{amount:discount,currency:'USD'}};}
  env.FETCH=async(url,options={})=>{
    const path=new URL(url).pathname,b=options.body?JSON.parse(options.body):{};
    if(path==='/v2/catalog/list')return response({objects:products.filter(p=>p.square_variation_name).map(p=>({item_data:{name:p.square_name,variations:[{id:p.square_variation_id,item_variation_data:{name:p.square_variation_name,track_inventory:true,price_money:{amount:p.price_cents,currency:'USD'}}}]}}))});
    if(path==='/v2/catalog/batch-retrieve'){state.catalogCalls++;return response({objects:products.map(p=>({id:p.square_variation_id,item_variation_data:{track_inventory:true,price_money:{amount:state.prices[p.slug] || p.price_cents,currency:'USD'}}}))});}
    if(path==='/v2/inventory/counts/batch-retrieve')return response({counts:products.map(p=>({catalog_object_id:p.square_variation_id,quantity:String(state.stock[p.slug] ?? p.stock_snapshot)}))});
    if(path==='/shipments/'){state.shippingCalls++;state.lastShipment=b;
      if(b.parcels.some(p=>!/^\d+(\.\d{1,4})?$/.test(p.weight)))return response({parcels:[{weight:['At most 4 decimal places.']}]},400);
      return response({rates:[{object_id:'shippo-ground-'+state.shippingCalls,amount:'6.25',currency:'USD',provider:'USPS',carrier_account:'usps',servicelevel:{token:'usps_ground_advantage',name:'Ground Advantage'},estimated_days:4,test:env.STORE_MODE!=='live'},{object_id:'shippo-priority-'+state.shippingCalls,amount:'9.10',currency:'USD',provider:'USPS',carrier_account:'usps',servicelevel:{token:'usps_priority',name:'Priority Mail'},estimated_days:2,test:env.STORE_MODE!=='live'}]});}
    if(path==='/v2/orders/calculate')return response({order:orderTotals(b.order)});
    if(path==='/v2/orders'){const id='square-'+b.idempotency_key,o={id,version:1,state:'OPEN',...orderTotals(b.order)};state.orders.set(id,o);return response({order:o});}
    if(path.startsWith('/v2/orders/')){const id=path.slice(11),o=state.orders.get(id);if(options.method==='PUT'){if(b.order.state==='CANCELED' && o.tenders?.length)return response({errors:[{code:'ORDER_ALREADY_PAID'}]},400);Object.assign(o,b.order);}return response({order:o});}
    if(path==='/v2/payments'){
      state.paymentCalls++;
      state.paymentRequests.push(b);
      if(state.decline)return response({errors:[{code:'CARD_DECLINED'}]},400);
      if(state.failPayment)throw new Error('Simulated connection loss before response');
      const existing=[...state.payments.values()].find(p=>p.idempotency_key===b.idempotency_key);
      if(!existing && state.orders.get(b.order_id)?.state==='CANCELED')return response({errors:[{code:'ORDER_CANCELED'}]},400);
      const payment=existing || {id:'payment-'+b.idempotency_key,idempotency_key:b.idempotency_key,order_id:b.order_id,amount_money:b.amount_money,status:'COMPLETED',receipt_url:'https://squareup.com/receipt/test'};
      state.payments.set(payment.id,payment);state.orders.get(b.order_id).tenders=[{payment_id:payment.id}];
      if(state.timeoutPayment)throw new Error('Simulated response lost after successful charge');return response({payment});
    }
    if(path.startsWith('/v2/payments/'))return response({payment:state.payments.get(path.slice(13))});
    if(url==='https://api.resend.com/emails'){
      if(b.to.includes(state.failEmailTo))return response({message:'Simulated email failure'},503);
      const key=options.headers['Idempotency-Key'];
      if(!state.emailKeys.has(key)){state.emails.push(b);state.emailKeys.add(key);}return response({id:'email'});
    }
    throw new Error('Unexpected mock endpoint '+path);
  };
  const tasks=[];let cookie='';
  async function request(path,data,headers={}){
    const r=await worker.fetch(new Request(env.SITE_URL+path,{method:data===undefined?'GET':'POST',headers:{Origin:env.SITE_URL,'Content-Type':'application/json',Cookie:cookie,...headers},body:data===undefined?undefined:JSON.stringify(data)}),env,{waitUntil:p=>tasks.push(p)});
    if(r.headers.has('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];
    return {status:r.status,data:await r.json(),headers:r.headers};
  }
  async function quote(cart=[{slug:'honey-lavender-lip-balm',quantity:1}],a=address,discount_code=''){return request('/api/quote',{cart,address:a,discount_code});}
  async function pay(q,extra={}){return request('/api/checkout',{quote_id:q.data.id,rate_id:q.data.rates[0].id,source_id:'cnon:test-only-token',...extra});}
  return {env,state,request,quote,pay,flush:()=>Promise.all(tasks),close:()=>DB.close()};
}
