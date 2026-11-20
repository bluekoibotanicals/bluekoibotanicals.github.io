import {epdSale,epdLookup} from './epd.mjs';
const assert=(condition,message)=>{if(!condition)throw Error(message)};
export default {async test(){
 const env={STORE_MODE:'live',EPD_GATEWAY_ORIGIN:'https://secure.easypaydirectgateway.com',EPD_PRIVATE_API_KEY:'runtime-test-key'};
 const address={name:'Runtime Test',street1:'100 Test St',street2:'',city:'Test',state:'VA',zip:'22902',country:'US',email:'test@example.com',phone:''};
 const order={id:'runtime-order',payment_environment:'live',data:JSON.stringify({address,lines:[{quantity:1,epd_sku:'TEST',name:'Test item',size:'1 unit'}],totals:{total:554,tax:0,shipping:549}})};
 const payment=await epdSale(env,order,'runtime-test-token',address);
 assert(payment.id==='123456' && payment.status==='COMPLETED','Workerd must accept and send the sale request');
 const found=await epdLookup(env,order);
 assert(found?.id==='123456' && found.amount_money.amount===554,'Workerd must accept and parse the query request');
 let rejected=false;
 try{await epdSale(env,{...order,id:'redirect-order'},'runtime-test-token',address);}catch(e){rejected=e.code==='EPD_UNCERTAIN';}
 assert(rejected,'Gateway redirects must fail closed without sending keys to another host');
 console.log('EPD sale, lookup and redirect protection passed in workerd (mock gateway; no external requests).');
}};
