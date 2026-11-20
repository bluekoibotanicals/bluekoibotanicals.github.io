import {fixture} from './fixture.mjs';
export function epdFixture({stock=20,live=false}={}) {
  const f=fixture(),original=f.env.FETCH;
  Object.assign(f.env,{PAYMENT_PROVIDER:'epd',STORE_MODE:live?'live':'sandbox',EPD_GATEWAY_ORIGIN:live?'https://secure.easypaydirectgateway.com':'https://sandbox.nmi.com',EPD_TEST_ACCOUNT_CONFIRMED:'true',EPD_LIVE_ACCOUNT_CONFIRMED:'true',INVENTORY_CONFIRMED:'true',LIVE_LAUNCH_CONFIRMED:'true',EPD_PRIVATE_API_KEY:'fixture-private-never-expose',EPD_PUBLIC_TOKENIZATION_KEY:'fixture-public',RESEND_API_KEY:'fixture',EMAIL_FROM:'orders@example.com',SHIPPO_AUTO_LABELS:'false'});
  f.env.DB.exec(`UPDATE website_inventory SET quantity=${Number(stock)}`);
  const epd={sales:[],queries:[],records:[],decline:false,timeout:false,fail:false,malformed:false,duplicate:false,queryFailure:false};
  epd.xml=()=>'<nm_response>'+epd.records.map(r=>`<transaction><transaction_id>${r.id}</transaction_id><order_id>${r.orderid}</order_id><currency>${r.currency || 'USD'}</currency><condition>${r.condition || 'pendingsettlement'}</condition><action><action_type>sale</action_type><success>1</success><amount>${r.amount}</amount></action>${r.refund?`<action><action_type>refund</action_type><success>1</success><amount>${r.refund}</amount></action>`:''}</transaction>`).join('')+'</nm_response>';
  f.env.FETCH=async(url,options={})=>{
    const path=new URL(url).pathname;
    if(path==='/api/transact.php') {
      const b=Object.fromEntries(new URLSearchParams(options.body));epd.sales.push(b);
      if(epd.fail)throw Error('Before provider receipt');
      if(epd.decline)return new Response('response=2&responsetext=DECLINE');
      if(epd.duplicate)return new Response('response=3&responsetext=Duplicate');
      const r={...b,id:'123456'+epd.sales.length};epd.records.push(r);
      if(epd.timeout)throw Error('Lost approval response');
      if(epd.malformed)return new Response('<html>proxy error</html>');
      return new Response('response=1&transactionid='+r.id);
    }
    if(path==='/api/query.php') {
      epd.queries.push(Object.fromEntries(new URLSearchParams(options.body)));
      if(epd.queryFailure)throw Error('Query unavailable');
      return new Response(epd.xml());
    }
    if(url.includes('squareup') || url.includes('squareupsandbox'))throw Error('EPD flow must not call Square');
    return original(url,options);
  };
  return {...f,epd};
}
