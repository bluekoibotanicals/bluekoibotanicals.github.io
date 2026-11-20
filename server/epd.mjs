// EPD's provisioned NMI Classic gateway: Collect.js + Payment/Query APIs.
// Never retry a sale. orderid is a lookup reference, NOT an idempotency key.
import {activeProducts, fail, money, StoreError} from './core.mjs';
export const isEPD = env => env.PAYMENT_PROVIDER !== 'square';
export function gatewayOrigin(env) {
  const origin = env.EPD_GATEWAY_ORIGIN || 'https://secure.easypaydirectgateway.com';
  const allowed = env.STORE_MODE === 'sandbox' ? ['https://sandbox.nmi.com'] : ['https://secure.easypaydirectgateway.com'];
  if (!allowed.includes(origin)) fail('Payment environment needs to be configured.',503,'EPD_SETUP');
  return origin;
}
export function epdReady(env) {
  try { gatewayOrigin(env); } catch { return false; }
  const basic = !!env.DB && ['EPD_PRIVATE_API_KEY','EPD_PUBLIC_TOKENIZATION_KEY','SHIPPO_API_KEY','SHIP_FROM_JSON'].every(k=>!!env[k]);
  if (env.STORE_MODE==='sandbox') return basic && env.EPD_TEST_ACCOUNT_CONFIRMED==='true';
  return env.STORE_MODE==='live' && basic && env.LIVE_LAUNCH_CONFIRMED==='true' && env.EPD_LIVE_ACCOUNT_CONFIRMED==='true' && !!env.RESEND_API_KEY && !!env.EMAIL_FROM && (env.ADMIN_TOKEN?.length || 0)>=32 && env.INVENTORY_CONFIRMED==='true';
}
export async function epdCatalog(env) {
  const rows=env.DB?(await env.DB.prepare('SELECT * FROM website_inventory').all()).results:[];
  return activeProducts.map(p=>({...p,stock:rows.find(r=>r.slug===p.slug)?.quantity || 0,inventory_tracked:true,online_enabled:p.online_enabled && !!p.epd_sku}));
}
async function post(env,path,fields) {
  let response,text;
  try {
    // Workers supports manual/follow only. Never follow gateway redirects with keys.
    response=await (env.FETCH || fetch)(gatewayOrigin(env)+path,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...fields,security_key:env.EPD_PRIVATE_API_KEY}).toString(),signal:AbortSignal.timeout(20000)});
    text=await response.text();
  } catch { throw new StoreError('Payment confirmation is pending. Do not place another order.',503,'EPD_UNCERTAIN'); }
  if(!response.ok || text.length>1000000)throw new StoreError('The payment service could not confirm this request.',503,'EPD_UNCERTAIN');
  return text;
}
export function saleFields(order,token,billing) {
  const d=JSON.parse(order.data),name=billing.name.split(' '),shippingName=d.address.name.split(' ');
  return {type:'sale',payment:'creditcard',payment_token:token,amount:money(d.totals.total),currency:'USD',orderid:order.id,
    order_description:d.lines.map(p=>`${p.quantity}x ${p.epd_sku} ${p.name} (${p.size})`).join('; ').slice(0,250),
    tax:money(d.totals.tax),shipping:money(d.totals.shipping),first_name:name.shift(),last_name:name.join(' '),
    address1:billing.street1,address2:billing.street2,city:billing.city,state:billing.state,zip:billing.zip,country:billing.country,email:d.address.email,phone:billing.phone,
    shipping_firstname:shippingName.shift(),shipping_lastname:shippingName.join(' '),shipping_address1:d.address.street1,shipping_address2:d.address.street2,shipping_city:d.address.city,shipping_state:d.address.state,shipping_zip:d.address.zip,shipping_country:d.address.country};
}
export async function epdSale(env,order,token,billing) {
  const result=new URLSearchParams(await post(env,'/api/transact.php',saleFields(order,token,billing)));
  const response=result.get('response'),id=result.get('transactionid');
  if(response==='1' && id && /^[a-zA-Z0-9-]+$/.test(id)) return {id,order_id:order.id,amount_money:{amount:JSON.parse(order.data).totals.total,currency:'USD'},status:'COMPLETED'};
  if(response==='2')throw new StoreError('Your card was declined. Please check your details or use another card.',400,'CARD_DECLINED');
  // Gateway errors, duplicate responses, and malformed approvals require lookup;
  // none prove that an earlier request did not reach the processor.
  throw new StoreError('Payment confirmation is pending. Do not place another order.',503,'EPD_UNCERTAIN');
}
const tag=(xml,name)=>xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim() || '';
const cents=value=>/^\d+(\.\d{1,4})?$/.test(value)?Math.round(Number(value)*100):NaN;
export function parseQuery(xml,order) {
  // Read only the documented fixed scalar fields. Never evaluate entities/DTDs.
  if(!/<nm_response(?:\s[^>]*)?>[\s\S]*<\/nm_response>/.test(xml) || /<!DOCTYPE|<!ENTITY|<error/i.test(xml))fail('Payment lookup is unavailable.',503,'EPD_UNCERTAIN');
  const matches=[...xml.matchAll(/<transaction>([\s\S]*?)<\/transaction>/g)].map(m=>m[1]).filter(t=>tag(t,'order_id')===order.id);
  if(matches.length!==1) {
    if(matches.length>1)fail('Multiple gateway transactions need an owner review.',503,'PAYMENT_MISMATCH');
    return null; // Absence is not evidence that a timed-out payment failed.
  }
  const t=matches[0],id=tag(t,'transaction_id'),condition=tag(t,'condition');
  const actions=[...t.matchAll(/<action>([\s\S]*?)<\/action>/g)].map(m=>m[1]);
  const sales=actions.filter(a=>tag(a,'action_type')==='sale' && tag(a,'success')==='1');
  if(!id || (order.payment_id && id!==order.payment_id))fail('Payment reference needs an owner review.',503,'PAYMENT_MISMATCH');
  if(sales.length!==1) {
    if(condition==='failed' && !sales.length && actions.some(a=>tag(a,'action_type')==='sale' && tag(a,'success')==='0'))return {id,order_id:order.id,amount_money:{amount:JSON.parse(order.data).totals.total,currency:'USD'},status:'FAILED'};
    return null;
  }
  const amount=cents(tag(sales[0],'amount')),currency=tag(t,'currency');
  if(currency!=='USD' || amount!==JSON.parse(order.data).totals.total)fail('Payment amount needs an owner review.',503,'PAYMENT_MISMATCH');
  const refunds=actions.filter(a=>tag(a,'action_type')==='refund' && tag(a,'success')==='1').reduce((n,a)=>n+cents(tag(a,'amount')),0);
  if(!Number.isSafeInteger(refunds) || refunds>amount)fail('Refund amount needs an owner review.',503,'PAYMENT_MISMATCH');
  const voided=condition==='canceled' && actions.some(a=>tag(a,'action_type')==='void' && tag(a,'success')==='1');
  if(!voided && !['complete','pendingsettlement','pending_settlement'].includes(condition))return null;
  return {id,order_id:order.id,amount_money:{amount,currency},refunded_money:{amount:voided?amount:refunds},status:'COMPLETED'};
}
export async function epdLookup(env,order) {
  // Never query a test order using live credentials (or the reverse).
  if(order.payment_environment!==env.STORE_MODE)return null;
  return parseQuery(await post(env,'/api/query.php',{order_id:order.id,...(order.payment_id?{transaction_id:order.payment_id}:{})}),order);
}
