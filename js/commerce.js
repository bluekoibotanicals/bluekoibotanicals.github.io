export const $ = (selector,root=document) => root.querySelector(selector);
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const currency = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const root = new URL('../',import.meta.url);
export const pageURL = path => new URL(path,root).href;
export async function api(path, data, headers={}) {
  const response=await fetch(new URL(path,root),{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
  let result;try{result=await response.json();}catch{throw new Error('The store connection is unavailable. Please try again or email Gwyn.');}
  if (!response.ok) {const error=new Error(result.error || 'Please try again.');error.code=result.code;throw error;}
  return result;
}
export function getCart() {try {const c=JSON.parse(localStorage.getItem('bk_cart') || '[]');return Array.isArray(c)?c.filter(p=>p && typeof p.slug==='string' && Number.isInteger(p.quantity) && p.quantity>0 && p.quantity<=12):[];}catch{return [];} }
export function saveCart(cart) {try{localStorage.setItem('bk_cart',JSON.stringify(cart));}catch{throw new Error('Enable browser storage to keep your shopping bag.');}countBag();}
function countBag(){document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=`(${getCart().reduce((n,p)=>n+p.quantity,0)})`);}
export function totalsHTML(t,complete=true) {const discount=t.discount?`<div class="summary-line discount"><span>${t.discount_code?`Discount (${esc(t.discount_code)})`:'Discount'}</span><span>−${currency(t.discount)}</span></div>`:'';return `<div class="summary-line"><span>Items</span><span>${currency(t.subtotal)}</span></div>${discount}<div class="summary-line"><span>Shipping</span><span>${complete?currency(t.shipping):'At checkout'}</span></div><div class="summary-line"><span>Sales tax (5.3%)</span><span>${complete?currency(t.tax):'At checkout'}</span></div><div class="summary-line total"><span>${complete?'Total':'Subtotal'}</span><span>${currency(complete?t.total:t.subtotal)} USD</span></div>`;}
export function linesHTML(lines){return lines.map(p=>`<div class="order-item">${p.quantity} × ${esc(p.name)}<small>${esc(p.size || p.display_size)}</small><span>${currency(p.price_cents*p.quantity)}</span></div>`).join('');}
export function toast(message) {
  $('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.innerHTML=`${esc(message)} <a href="${pageURL('cart.html')}">View bag</a>`;document.body.append(el);setTimeout(()=>el.remove(),5000);
}
export const catalogPromise=(async()=>{
  try{return await api('api/catalog');}catch{
    const response=await fetch(pageURL('catalog.json'));if(!response.ok)throw new Error('Products could not be loaded.');
    return {products:(await response.json()).map(p=>({...p,stock:p.stock_snapshot})),preview:true,offline:true};
  }
})();
export const configPromise=api('api/config').catch(()=>({mode:'preview',checkout_ready:false}));
async function productsUI(){
  const data=await catalogPromise;
  for(const p of data.products){
    document.querySelectorAll(`[data-product-price="${p.slug}"]`).forEach(el=>el.textContent=currency(p.price_cents));
    document.querySelectorAll(`[data-stock="${p.slug}"]`).forEach(el=>{el.textContent=!p.stock?'Sold out':!p.online_enabled?'Currently unavailable':data.offline?'Availability confirmed at checkout':data.preview?'':p.stock<6?`Only ${p.stock} available`:'In stock';el.classList.toggle('sold-out',!p.stock || !p.online_enabled);});
    document.querySelectorAll(`[data-add-product="${p.slug}"]`).forEach(button=>{
      button.disabled=!p.stock || !p.online_enabled;button.textContent=!p.stock?'Sold out':!p.online_enabled?'Unavailable':'Add to bag';
      button.addEventListener('click',()=>{
        const quantity=Number($('#product-quantity')?.value || 1),cart=getCart();
        if(!Number.isInteger(quantity) || quantity<1 || quantity>12)return toast('Choose a quantity between 1 and 12.');
        const existing=cart.find(x=>x.slug===p.slug);
        if((existing?.quantity || 0)+quantity>p.stock)return toast(`Only ${p.stock} available.`);
        if(cart.reduce((n,p)=>n+p.quantity,0)+quantity>12)return toast('Please contact Gwyn for orders larger than 12 items.');
        if(existing)existing.quantity+=quantity;else cart.push({slug:p.slug,quantity});
        try{saveCart(cart);toast('Added to your bag.');}catch(error){toast(error.message);}
      });
    });
  }
  if($('#cart-items'))renderCart(data);
}
function renderCart(data){
  const cart=getCart(),items=cart.map(l=>({...data.products.find(p=>p.slug===l.slug),...l})).filter(p=>p.name),valid=items.length===cart.length && items.every(p=>p.online_enabled && p.stock>=p.quantity);
  $('#cart-items').innerHTML=items.length ? items.map(p=>`<article class="cart-line"><div><h3><a href="${pageURL(`products/${p.slug}.html`)}">${esc(p.name)}</a></h3><p class="small muted">${esc(p.display_size)}</p>${p.stock<p.quantity || !p.online_enabled?'<p class="stock-note sold-out">Update or remove this unavailable quantity.</p>':''}</div><span class="cart-price">${currency(p.price_cents*p.quantity)}</span><label class="field">Quantity<input type="number" data-cart-quantity="${p.slug}" value="${p.quantity}" min="1" max="${Math.min(12,p.stock)||1}" step="1"></label><button class="remove" type="button" data-cart-remove="${p.slug}">Remove</button></article>`).join('') : `<div class="empty-bag"><h2>A little something for you?</h2><p>Your bag is empty. Explore our small-batch body care.</p><a class="button" href="${pageURL('products.html')}">Browse the collection</a></div>`;
  const subtotal=items.reduce((n,p)=>n+p.price_cents*p.quantity,0);$('#cart-summary').innerHTML=totalsHTML({subtotal},false);
  $('#checkout-link').hidden=!items.length || !valid;
  document.querySelectorAll('[data-cart-quantity]').forEach(el=>el.addEventListener('change',()=>{const c=getCart();const p=c.find(p=>p.slug===el.dataset.cartQuantity);const qty=Number(el.value);if(Number.isInteger(qty)&&qty>=1&&qty<=12 && c.reduce((n,x)=>n+(x===p?qty:x.quantity),0)<=12){p.quantity=qty;saveCart(c);}renderCart(data);}));
  document.querySelectorAll('[data-cart-remove]').forEach(el=>el.addEventListener('click',()=>{saveCart(getCart().filter(p=>p.slug!==el.dataset.cartRemove));renderCart(data);}));
}
async function reviewsUI(){
  for(const el of document.querySelectorAll('[data-reviews]')){
    try{const data=await api('api/reviews?product='+encodeURIComponent(el.dataset.reviews));
      el.innerHTML=data.count ? `<p class="rating-label">${Number(data.average).toFixed(1)} out of 5 · ${data.count} verified purchase review${data.count===1?'':'s'}</p>`+data.reviews.map(r=>`<article class="review-card"><div class="review-meta"><span class="stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span><strong>${esc(r.author)}</strong><span class="verified">Verified purchase</span><time class="small muted">${new Date(r.created_at*1000).toLocaleDateString()}</time></div><p>${esc(r.body)}</p></article>`).join('') : '<p class="muted">No reviews yet. Purchased this product? Watch your inbox for your review invitation.</p>';
    }catch{el.innerHTML='<p class="muted">Customer reviews are temporarily unavailable.</p>';}
  }
}
countBag();window.addEventListener('storage',countBag);
productsUI().catch(error=>{if($('#cart-items'))$('#cart-items').textContent=error.message;document.querySelectorAll('[data-add-product]').forEach(el=>{el.disabled=true;el.textContent='Please contact Gwyn';});});
reviewsUI();
if($('#address-form'))import('./checkout.js');
if($('#order-details') || $('#review-form') || $('#admin-login'))import('./account-pages.js');
