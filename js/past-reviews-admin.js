import {$,esc,api} from './commerce.js';
export function setupPastInvitations(headers) {
  const form=$('#past-invitation-form'),message=$('#past-invitation-message'),list=$('#past-invitation-list');
  let initialized=false,generation=0;
  const endpoint='api/admin/past-review-invitations';
  async function refresh() {
    const version=generation;
    try {
      const data=await api(endpoint,undefined,headers());if(version!==generation)return;
      if(!initialized) {
        $('#past-invitation-products').innerHTML='<legend>Purchased products</legend>'+data.products.map(p=>`<label class="checkbox"><input type="checkbox" name="products" value="${esc(p.slug)}"><span>${esc(p.name)} <small>${esc(p.size)}</small></span></label>`).join('');
        initialized=true;
      }
      list.innerHTML=data.invitations.length?data.invitations.map(i=>{
        const inactive=i.revoked_at || i.expires_at<=Date.now()/1000;
        const status=i.revoked_at?'Revoked':inactive?'Expired':i.delivery==='sent'?'Email sent':i.delivery==='pending'?'Email queued; retries automatically':'Email needs checking in Resend; automatic retries stopped';
        return `<article class="admin-card"><h3>${esc(i.customer_name)}</h3><p>${esc(i.email)}</p><p class="small muted">${esc(i.source)} · ${esc(i.purchase_reference)} · ${esc(i.purchased_on)}</p><p class="small">${i.products.map(p=>esc(p.name)).join(', ')}</p><p class="small">${status} · ${i.submitted_count}/${i.products.length} products reviewed</p>${inactive?'':`<div class="actions"><button class="button secondary" data-invite-action="link" data-invite-id="${i.id}">Copy review link</button><button class="button secondary" data-invite-action="revoke" data-invite-id="${i.id}">Revoke invitation</button></div><div data-invite-link="${i.id}"></div>`}</article>`;
      }).join(''):'<p>No past-customer invitations yet.</p>';
    } catch(e){message.textContent=e.message;}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=$('button[type="submit"]',form),d=new FormData(form),selected=d.getAll('products'),version=generation;
    if(!selected.length){message.textContent='Select at least one purchased product.';return;}
    button.disabled=true;message.textContent='Sending invitation…';
    try {
      const result=await api(endpoint,{action:'create',customer_name:d.get('customer_name'),email:d.get('email'),source:d.get('source'),purchase_reference:d.get('purchase_reference'),purchased_on:d.get('purchased_on'),products:selected,purchase_verified:d.get('purchase_verified')==='on'},headers());
      if(version!==generation)return;
      form.reset();await refresh();message.textContent=result.delivery==='sent'?'Invitation email sent.':'Invitation saved. Email delivery is pending and will retry automatically.';
    }catch(e){if(version===generation)message.textContent=e.message;}
    finally{button.disabled=false;}
  });
  list.addEventListener('click',async event=>{
    const button=event.target.closest('[data-invite-action]');if(!button)return;
    const action=button.dataset.inviteAction,id=button.dataset.inviteId,version=generation;
    if(action==='revoke' && !confirm('Revoke this private review link? Already submitted reviews remain in moderation.'))return;
    button.disabled=true;
    try {
      const result=await api(endpoint,{action,id},headers());if(version!==generation)return;
      if(action==='link') {
        try {await navigator.clipboard.writeText(result.url);message.textContent='Private review link copied. Share it only with this customer.';}
        catch {const container=$(`[data-invite-link="${id}"]`);container.innerHTML='<label class="field">Private review link<input readonly></label>';const input=$('input',container);input.value=result.url;input.select();message.textContent='Copy the selected private link and share it only with this customer.';}
      }else {await refresh();message.textContent='Invitation revoked.';}
    }catch(e){if(version===generation)message.textContent=e.message;}
    finally{button.disabled=false;}
  });
  return {refresh,clear(){generation++;form.reset();message.textContent='';list.replaceChildren();}};
}
