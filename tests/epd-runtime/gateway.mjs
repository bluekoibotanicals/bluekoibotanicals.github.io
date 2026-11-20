// No external network. workerd routes every outbound request to this service.
export default {async fetch(req){
 const u=new URL(req.url),b=Object.fromEntries(await req.formData());
 if(b.security_key!=='runtime-test-key')return new Response('bad test credentials',{status:401});
 if(u.pathname==='/api/transact.php'){
  if(b.orderid==='redirect-order')return new Response(null,{status:307,headers:{Location:'https://untrusted.example/steal'}});
  if(b.payment_token!=='runtime-test-token' || b.amount!=='5.54')throw Error('Unexpected payment request');
  return new Response('response=1&transactionid=123456');
 }
 if(u.pathname==='/api/query.php')return new Response('<nm_response><transaction><transaction_id>123456</transaction_id><order_id>runtime-order</order_id><currency>USD</currency><condition>complete</condition><action><action_type>sale</action_type><success>1</success><amount>5.54</amount></action></transaction></nm_response>');
 throw Error('Unexpected outbound URL; no request may follow a redirect');
}};
