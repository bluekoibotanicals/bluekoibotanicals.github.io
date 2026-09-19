import {$,esc,currency,api,saveCart,totalsHTML,linesHTML,pageURL} from './commerce.js';
if($('#order-details')){
  const id=new URL(location.href).searchParams.get('id');let polls=0;
  async function refresh(){
    try{const o=await api('api/order/'+encodeURIComponent(id || ''));
      $('#order-title').textContent=o.status==='paid'?'Thank you for your order.':o.status==='refunded'?'Your order was refunded.':o.status==='failed'?'Payment was not completed.':'Checking your payment.';
      $('#order-message').textContent=o.status==='paid'?'Gwyn will prepare your order in 1–3 days. Your order confirmation will be sent by email.':o.status==='refunded'?'Contact Gwyn if you have any questions about your refund.':o.status==='failed'?'You can return to your bag and get a fresh shipping quote.':'Please do not place another order while we confirm this payment.';
      $('#order-details').innerHTML=`<p class="small">Order ${esc(o.id)}</p>${linesHTML(o.lines)}${totalsHTML(o.totals)}${o.refunded_cents?`<p>Refunded: ${currency(o.refunded_cents)}</p>`:""}<p class="small">${esc(o.carrier)} · ${esc(o.service)}</p>${o.tracking?`<p>Tracking number: ${esc(o.tracking)}</p>`:''}${o.receipt_url?`<p><a href="${esc(o.receipt_url)}" target="_blank" rel="noopener noreferrer">View your Square receipt</a></p>`:''}`;
      if(o.status==='paid'){saveCart([]);sessionStorage.removeItem('bk_pending_quote');}
      if(o.status==='processing' && ++polls<12)setTimeout(refresh,5000);
      if(o.status==='processing' && polls>=12)$('#order-message').textContent='Your payment still needs confirmation. Keep your order number and contact Gwyn before placing another order.';
    }catch(e){$('#order-title').textContent='Order details unavailable.';$('#order-message').textContent=e.message;}
  }
  refresh();
}
if($('#review-form')){
  const token=decodeURIComponent(location.hash.slice(1));history.replaceState(null,'',location.pathname);
  async function load(){
    if(!token)return;
    try{const data=await api('api/review-invitation',{token}),items=data.products.filter(p=>!p.submitted);
      $('#review-invitation').textContent=items.length?'Choose a product from your order to review.':'Thank you — you have reviewed all products in this order.';
      $('#review-form').hidden=!items.length;$('[name="slug"]',$('#review-form')).innerHTML=items.map(p=>`<option value="${esc(p.slug)}">${esc(p.name)} · ${esc(p.size)}</option>`).join('');
    }catch(e){$('#review-invitation').textContent=e.message;}
  }
  load();$('#review-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=$('button',$('#review-form'));button.disabled=true;
    try{const d=Object.fromEntries(new FormData(event.target));d.rating=Number(d.rating);const r=await api('api/reviews',{...d,token});$('#review-result').textContent=r.message;event.target.reset();await load();if(event.target.hidden)$('#review-invitation').textContent=r.message;}
    catch(e){$('#review-result').textContent=e.message;}finally{button.disabled=false;}
  });
}
if($('#admin-login')){
  let token='';const headers=()=>({Authorization:'Bearer '+token});
  async function refresh(){
    $('#admin-message').textContent='Loading…';
    try{
      const [status,reviews,orders]=await Promise.all([api('api/admin/status',undefined,headers()),api('api/admin/reviews',undefined,headers()),api('api/admin/orders',undefined,headers())]);
      $('#admin-login').hidden=true;$('#admin-content').hidden=false;$('#admin-message').textContent='';
      $('#admin-status').textContent=`Mode: ${status.mode}. Checkout ${status.checkout_ready?'connected':'needs setup'}. ${status.mapped}/${status.total} products linked to Square.${status.missing.length?' Missing settings: '+status.missing.join(', '):''} Owner notifications: ${status.owner_email}.`;
      $('#admin-reviews').innerHTML=reviews.reviews.length?reviews.reviews.map(r=>`<article class="admin-card"><p class="small muted">${esc(r.slug)} · ${esc(r.status)}</p><h3>${esc(r.author)} · ${r.rating}/5</h3><p>${esc(r.body)}</p><label class="field">Moderation reason (required to reject)<input data-reason="${r.id}" maxlength="300" placeholder="For example: contains private contact details"></label><div class="actions"><button class="button" data-review="${r.id}" data-status="published">Publish</button><button class="button secondary" data-review="${r.id}" data-status="pending">Hold</button><button class="button secondary" data-review="${r.id}" data-status="rejected">Reject</button></div></article>`).join(''):'<p>No reviews submitted yet.</p>';
      $('#admin-orders').innerHTML=orders.orders.length?orders.orders.map(o=>`<article class="admin-card"><h3>${esc(o.status)} · ${currency(o.totals.total)}</h3><p class="small">${esc(o.id)} · ${new Date(o.created_at*1000).toLocaleString()}</p>${linesHTML(o.lines)}<p class="small">Customer email: ${o.email_sent?'sent':'pending'} · Gwyn notification: ${o.owner_email_sent?'sent':'pending'}</p>${o.recovery_note?`<p class="notice error">${esc(o.recovery_note)}</p>`:''}<details><summary>Delivery and parcel details</summary><div class="details-body"><pre>${esc([o.address.name,o.address.email,o.address.phone,o.address.street1,o.address.street2,`${o.address.city}, ${o.address.state} ${o.address.zip}`,o.address.country].filter(Boolean).join('\n'))}</pre><p>Selected service: ${esc(o.carrier)} · ${esc(o.service)}</p><pre>${esc(o.parcels.map((p,i)=>`Parcel ${i+1}: ${p.description}\n${p.parcel.length} × ${p.parcel.width} × ${p.parcel.height} in; ${p.parcel.weight} lb`).join('\n\n'))}</pre><p>Square order: ${esc(o.square_order_id || 'Not created')}<br>Payment: ${esc(o.payment_id || 'Not confirmed')}<br>Fulfilled: ${o.fulfilled_at?new Date(o.fulfilled_at*1000).toLocaleDateString():'Not yet'}</p></div></details><div class="actions"><button class="button secondary" data-reconcile="${o.id}">Check Square status</button>${o.status==='processing'?`<button class="button secondary" data-cancel-unpaid="${o.id}">Cancel unpaid order</button>`:''}</div></article>`).join(''):'<p>No website orders yet.</p>';
      document.querySelectorAll('[data-review]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api('api/admin/reviews',{id:button.dataset.review,status:button.dataset.status,reason:$(`[data-reason="${button.dataset.review}"]`).value},headers());await refresh();}catch(e){$('#admin-message').textContent=e.message;button.disabled=false;}}));
      document.querySelectorAll('[data-reconcile]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api('api/admin/reconcile',{id:button.dataset.reconcile},headers());await refresh();}catch(e){$('#admin-message').textContent=e.message;button.disabled=false;}}));
      document.querySelectorAll('[data-cancel-unpaid]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('Check Square first. This only cancels an unpaid order if Square confirms cancellation. It cannot refund or cancel a paid order. Continue?'))return;button.disabled=true;try{await api('api/admin/cancel-unpaid',{id:button.dataset.cancelUnpaid},headers());await refresh();}catch(e){$('#admin-message').textContent=e.message;button.disabled=false;}}));
    }catch(e){$('#admin-message').textContent=e.message;}
  }
  $('#admin-login').addEventListener('submit',event=>{event.preventDefault();token=$('[name="token"]').value;$('[name="token"]').value='';refresh();});
  $('#admin-refresh').addEventListener('click',refresh);
  $('#admin-logout').addEventListener('click',()=>{token='';$('#admin-content').hidden=true;$('#admin-reviews').replaceChildren();$('#admin-orders').replaceChildren();$('#admin-login').hidden=false;$('#admin-message').textContent='Signed out.';});
}
