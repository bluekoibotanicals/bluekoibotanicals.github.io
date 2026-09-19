import {$,esc,currency,api,getCart,catalogPromise,configPromise,totalsHTML,linesHTML,pageURL} from './commerce.js';
let quote,rate,card,delivery,paying=false,requestNumber=0;
const form=$('#address-form'),errorEl=$('#checkout-error');
const countries='AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW'.split(' ');
const names=new Intl.DisplayNames(['en'],{type:'region'});
document.querySelectorAll('[data-billing-countries]').forEach(el=>{el.innerHTML=countries.map(code=>({code,name:names.of(code)})).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${p.code}"${p.code==='US'?' selected':''}>${esc(p.name)}</option>`).join('');});
function formAddress(element,prefix=''){const d=Object.fromEntries(new FormData(element));return Object.fromEntries(['name','email','phone','street1','street2','city','state','zip','country'].map(k=>[k,(d[prefix+k] || '').trim()]));}
function error(message){errorEl.hidden=false;errorEl.textContent=message;errorEl.scrollIntoView({behavior:'smooth',block:'nearest'});}
function clearQuote(){if(paying)return;requestNumber++;quote=null;rate=null;$('#shipping-step').hidden=true;$('#payment-step').hidden=true;$('#pay-button').disabled=true;}
form.addEventListener('input',clearQuote);form.addEventListener('change',clearQuote);
window.addEventListener('storage',event=>{if(event.key==='bk_cart')clearQuote();});
$('#billing-form').addEventListener('submit',event=>event.preventDefault());
$('#billing-same').addEventListener('change',()=>$('#billing-form').hidden=$('#billing-same').checked);
async function setupCard(config){
  if(card)return;
  if(!window.Square){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=config.square_environment==='production'?'https://web.squarecdn.com/v1/square.js':'https://sandbox.web.squarecdn.com/v1/square.js';script.onload=resolve;script.onerror=()=>reject(new Error('The secure card form could not load. Check your connection and try again.'));document.head.append(script);});}
  const payments=window.Square.payments(config.application_id,config.location_id);card=await payments.card();await card.attach('#card-container');
}
function selectedRate(){rate=quote.rates.find(r=>r.id===$('input[name="shipping-rate"]:checked')?.value);if(!rate)return;const t={...quote.item_totals,shipping:rate.amount,total:quote.item_totals.subtotal+quote.item_totals.tax+rate.amount};$('#checkout-totals').innerHTML=totalsHTML(t);$('#pay-button').textContent=`Pay ${currency(t.total)} USD`;$('#parcel-note').textContent=rate.parcel_count>1?`This quote covers ${rate.parcel_count} parcels.`:'Items ship together in one parcel.';$('#pay-button').disabled=!card;}
const config=await configPromise;
const promotion=$('#shipping-promotion');
if(promotion){promotion.hidden=!config.free_shipping?.enabled;if(config.free_shipping?.enabled){promotion.querySelector('strong').textContent=config.free_shipping.banner;promotion.querySelector('small').textContent=config.free_shipping.terms;}}
$('#checkout-mode').textContent=config.mode==='sandbox'?'Test checkout — use Square sandbox card details. No real payments will be collected.':!config.checkout_ready?'Online checkout is being prepared. Please email Gwyn for help placing an order.':'';
$('#checkout-mode').hidden=config.mode==='live' && config.checkout_ready;
const data=await catalogPromise,cart=getCart(),items=cart.map(l=>({...data.products.find(p=>p.slug===l.slug),...l})).filter(p=>p.name);
$('#checkout-items').innerHTML=items.length?linesHTML(items):`<p>Your bag is empty. <a href="${pageURL('products.html')}">Browse products</a>.</p>`;
$('#checkout-totals').innerHTML=totalsHTML({subtotal:items.reduce((n,p)=>n+p.price_cents*p.quantity,0)},false);
$('#get-rates').disabled=!config.checkout_ready || !items.length;
form.addEventListener('submit',async event=>{
  event.preventDefault();errorEl.hidden=true;clearQuote();const version=++requestNumber;$('#get-rates').disabled=true;$('#get-rates').textContent='Finding shipping options…';
  try{
    delivery=formAddress(form);const current=await api('api/quote',{cart:getCart(),address:delivery});if(version!==requestNumber)return;
    quote=current;$('#checkout-items').innerHTML=linesHTML(quote.lines);$('#shipping-step').hidden=false;
    $('#shipping-rates').innerHTML='<legend class="sr-only">Choose your shipping service</legend>'+quote.rates.map((r,i)=>`<label class="rate-option"><input type="radio" name="shipping-rate" value="${r.id}"${i===0?' checked':''}><span><strong>${esc(r.carrier)} · ${esc(r.service)}</strong><small>${r.days!==null?`Estimated ${r.days} business day${r.days===1?'':'s'} in transit`:'Delivery estimate provided by carrier'}</small></span><strong>${r.free_shipping?'Free':currency(r.amount)}</strong></label>`).join('');
    $('#payment-step').hidden=false;selectedRate();
    document.querySelectorAll('[name="shipping-rate"]').forEach(el=>el.addEventListener('change',selectedRate));
    await setupCard(config);if(version!==requestNumber)return;selectedRate();$('#shipping-step').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){error(e.message);}finally{$('#get-rates').disabled=!config.checkout_ready;$('#get-rates').textContent='Get shipping options';}
});
$('#pay-button').addEventListener('click',async()=>{
  if(paying || !quote || !rate || !card)return;
  if(Date.now()/1000>=quote.expires_at){clearQuote();return error('Your quote has expired. Get fresh shipping rates before paying.');}
  if(!$('#billing-same').checked && !$('#billing-form').reportValidity())return;
  const billing=$('#billing-same').checked?delivery:formAddress($('#billing-form'),'billing_');
  const snapshot={quote,rate},total=quote.item_totals.subtotal+quote.item_totals.tax+rate.amount;
  paying=true;errorEl.hidden=true;
  document.querySelectorAll('#address-form input,#address-form select,#get-rates,#shipping-rates input,#billing-same,#billing-form input,#billing-form select,#pay-button').forEach(el=>el.disabled=true);
  $('#pay-button').textContent='Processing securely…';
  try{
    const name=billing.name.split(' '),token=await card.tokenize({amount:(total/100).toFixed(2),currencyCode:'USD',intent:'CHARGE',customerInitiated:true,sellerKeyedIn:false,billingContact:{givenName:name.shift(),familyName:name.join(' '),email:billing.email,...(billing.phone?{phone:billing.phone}:{}),addressLines:[billing.street1,billing.street2].filter(Boolean),city:billing.city,state:billing.state,postalCode:billing.zip,countryCode:billing.country}});
    if(token.status!=='OK')throw new Error(token.errors?.map(e=>e.message).join(' ') || 'Please check your card details.');
    // Save only the quote ID, never card tokens, so a dropped network response can be recovered.
    sessionStorage.setItem('bk_pending_quote',snapshot.quote.id);
    let result;
    try{result=await api('api/checkout',{quote_id:snapshot.quote.id,rate_id:snapshot.rate.id,source_id:token.token,billing});}
    catch(e){
      if(e.code) {sessionStorage.removeItem('bk_pending_quote');throw e;}
      // The server may have received payment. Query the same quote without a new token.
      result=await api('api/checkout',{quote_id:snapshot.quote.id});
    }
    sessionStorage.removeItem('bk_pending_quote');window.location.href=pageURL(`order.html?id=${encodeURIComponent(result.id)}`);
  }catch(e){error(e.message);if(e.code==='QUOTE_EXPIRED' || e.code==='STOCK_CHANGED'){quote=null;$('#shipping-step').hidden=true;$('#payment-step').hidden=true;}}
  finally{paying=false;const unresolved=Boolean(sessionStorage.getItem('bk_pending_quote'));document.querySelectorAll('#address-form input,#address-form select,#get-rates,#shipping-rates input,#billing-same,#billing-form input,#billing-form select').forEach(el=>el.disabled=unresolved);$('#pay-button').disabled=!quote || unresolved;$('#pay-button').textContent=unresolved?'Payment confirmation needed':`Pay ${currency(total)} USD`;if(unresolved)error('We could not confirm your payment connection. Reload this page to check the same order, or contact Gwyn before trying again.');}
});
const pending=sessionStorage.getItem('bk_pending_quote');
if(pending){$('#get-rates').disabled=true;error('Checking your previous payment attempt. Please do not place a new order.');try{const o=await api('api/checkout',{quote_id:pending});sessionStorage.removeItem('bk_pending_quote');window.location.href=pageURL(`order.html?id=${encodeURIComponent(o.id)}`);}catch(e){if(e.code==='QUOTE_EXPIRED' || e.code==='INVALID_REQUEST'){sessionStorage.removeItem('bk_pending_quote');$('#get-rates').disabled=!config.checkout_ready;}else error(e.message+' Contact Gwyn before placing another order.');}}
