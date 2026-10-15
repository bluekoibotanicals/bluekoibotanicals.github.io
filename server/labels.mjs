import {now, clean, store} from './core.mjs';
import {sendEmail} from './providers.mjs';

const statement=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
const first=(env,sql,...values)=>statement(env,sql,...values).first();
const run=(env,sql,...values)=>statement(env,sql,...values).run();
const metadata=id=>`blue-koi-order:${id}`;
const httpsURL=value=>typeof value==='string' && /^https:\/\//i.test(value)?value:null;

async function shippo(env,path,body) {
  // Never follow a provider pagination URL off the authenticated API host.
  const url=new URL(path,'https://api.goshippo.com');
  if(url.origin!=='https://api.goshippo.com')throw Error('Invalid Shippo URL');
  const response=await (env.FETCH || fetch)(url.href,{
    method:body?'POST':'GET',
    headers:{Authorization:'ShippoToken '+env.SHIPPO_API_KEY,'Content-Type':'application/json','SHIPPO-API-VERSION':'2018-02-08'},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw Error('Shippo request needs review');
  return response.json();
}

async function recordTransaction(env,o,t) {
  const expected=JSON.parse(o.data).rate.shippo_rate_ids[0];
  const rate=typeof t.rate==='string'?t.rate:t.rate?.object_id;
  if(!t.object_id || t.metadata!==metadata(o.id) || rate!==expected)throw Error('Shippo transaction did not match this order');
  const wrongMode=env.STORE_MODE==='live' && t.test!==false;
  const status=wrongMode?'error':t.status==='SUCCESS' && httpsURL(t.label_url)?'ready':['ERROR','REFUNDED','REFUNDPENDING'].includes(t.status)?'error':'waiting';
  const note=wrongMode?'Shippo returned a test label for a live order. Check the API key before shipping.':status==='error'?'Shippo could not provide a usable label. Review this transaction in Shippo; do not purchase a duplicate.':status==='waiting'?'Shippo is processing the label. The store will check again automatically.':null;
  await run(env,'UPDATE shipping_labels SET status=?,transaction_id=?,label_url=?,tracking_number=?,note=?,updated_at=? WHERE order_id=?',status,t.object_id,status==='ready'?httpsURL(t.label_url):null,clean(t.tracking_number,100) || null,note,now(),o.id);
}

async function findTransaction(env,o,label) {
  if(label.transaction_id)return shippo(env,`/transactions/${encodeURIComponent(label.transaction_id)}/`);
  let path='/transactions/?results=100&object_created_gte='+encodeURIComponent(new Date((label.created_at-60)*1000).toISOString());
  // A lost response is reconciled by a stable order reference, never by re-buying.
  for(let page=0;path && page<20;page++) {
    const data=await shippo(env,path);
    if(!Array.isArray(data.results))throw Error('Invalid Shippo transaction list');
    const matches=data.results.filter(t=>t.metadata===metadata(o.id));
    if(matches.length>1)throw Error('Multiple Shippo transactions need review');
    if(matches.length===1)return matches[0];
    path=data.next;
  }
  return null;
}

async function notifyOwner(env,o,label) {
  const ready=label.status==='ready',issue=['error','uncertain'].includes(label.status);
  if(!ready && !issue || ready && label.ready_email_sent || issue && label.issue_email_sent)return;
  const text=ready?`The paid order ${o.id} has a print-ready 4 × 6 inch PDF shipping label in Shippo.\n\nPrint label: ${label.label_url}\nTracking: ${label.tracking_number || 'See Shippo'}\nShippo transaction: ${label.transaction_id}\n\nCheck the packed weight and dimensions against the order before using the label. Mark the order fulfilled in Square when you hand it to the carrier; creating a label does not mark it shipped.`:`The paid order ${o.id} needs a shipping-label check.\n\n${label.note}\n\nFind it in Shippo using reference ${metadata(o.id)}${label.transaction_id?' or transaction '+label.transaction_id:''}. The customer payment remains successful. Check Shippo before purchasing any replacement label.`;
  const sent=await sendEmail(env,{to:env.OWNER_EMAIL || store.email,subject:ready?`Label ready — Blue Koi ${o.id.slice(0,8)}`:`Shipping label needs attention — Blue Koi ${o.id.slice(0,8)}`,key:`label-${ready?'ready':'issue'}-${o.id}`,text:text+`\n\nManage order: ${env.SITE_URL}/admin.html`});
  if(sent)await run(env,`UPDATE shipping_labels SET ${ready?'ready_email_sent':'issue_email_sent'}=1 WHERE order_id=?`,o.id);
}

export async function ensureLabel(env,order,force=false) {
  if(env.SHIPPO_AUTO_LABELS!=='true' || !env.DB)return;
  // Read current payment state, rather than trusting a stale webhook or poll.
  const o=await first(env,'SELECT * FROM orders WHERE id=?',order.id);
  if(!o || o.status!=='paid' || !o.payment_id || o.fulfilled_at)return;
  const d=JSON.parse(o.data);
  // Existing paid orders are not backfilled or charged for historical postage.
  if(!d.auto_label || d.refunded_cents>0)return;
  await run(env,'INSERT OR IGNORE INTO shipping_labels(order_id,created_at,updated_at) VALUES(?,?,?)',o.id,now(),now());
  let label=await first(env,'SELECT * FROM shipping_labels WHERE order_id=?',o.id);
  if(label.status==='pending') {
    if(!env.SHIPPO_API_KEY || !env.SHIPPO_API_KEY.startsWith(env.STORE_MODE==='live'?'shippo_live_':'shippo_test_') || d.rate.shippo_rate_ids?.length!==1) {
      await run(env,"UPDATE shipping_labels SET status='error',note=?,updated_at=? WHERE order_id=? AND status='pending'",'Check the Shippo API key mode and single-parcel rate configuration.',now(),o.id);
    } else {
      // Atomic claim survives overlapping checkout/webhook/cron handlers.
      const claim=await run(env,"UPDATE shipping_labels SET status='purchasing',updated_at=?,checked_at=? WHERE order_id=? AND status='pending'",now(),now(),o.id);
      if(!claim.meta.changes)return;
      try {
        const transaction=await shippo(env,'/transactions/',{rate:d.rate.shippo_rate_ids[0],label_file_type:'PDF_4x6',async:false,metadata:metadata(o.id)});
        await recordTransaction(env,o,transaction);
      } catch {
        // Shippo does not promise idempotency for this purchase endpoint. Even a
        // timeout/5xx may follow a successful purchase, so never automatically POST again.
        await run(env,"UPDATE shipping_labels SET status='uncertain',note=?,updated_at=? WHERE order_id=? AND status='purchasing'",'The label purchase result is uncertain. Automatic checks will look for the existing label; no second purchase will be attempted.',now(),o.id);
      }
    }
  } else if((['purchasing','waiting','uncertain'].includes(label.status) && (label.checked_at<now()-120 || force && label.status!=='purchasing')) || (force && label.status==='ready' && label.transaction_id)) {
    const claim=await run(env,'UPDATE shipping_labels SET checked_at=? WHERE order_id=? AND checked_at=?',now(),o.id,label.checked_at);
    if(!claim.meta.changes)return;
    try {
      const transaction=await findTransaction(env,o,label);
      if(transaction)await recordTransaction(env,o,transaction);
      else await run(env,"UPDATE shipping_labels SET status='uncertain',note=?,updated_at=? WHERE order_id=? AND status!='ready'",'No matching label was found yet. Check Shippo before buying postage manually; automatic purchase is paused to prevent duplicates.',now(),o.id);
    } catch { /* Keep the durable claim and reconcile on a later run. */ }
  }
  label=await first(env,'SELECT * FROM shipping_labels WHERE order_id=?',o.id);
  await notifyOwner(env,o,label);
}

export async function maintainLabels(env) {
  if(env.SHIPPO_AUTO_LABELS!=='true')return;
  const rows=(await statement(env,`SELECT o.* FROM orders o LEFT JOIN shipping_labels l ON l.order_id=o.id
    WHERE o.status='paid' AND o.fulfilled_at IS NULL AND json_extract(o.data,'$.auto_label')=1
    AND (l.order_id IS NULL OR l.status IN ('pending','purchasing','waiting','uncertain')
      OR (l.status='ready' AND l.ready_email_sent=0) OR (l.status='error' AND l.issue_email_sent=0))
    ORDER BY COALESCE(l.checked_at,0),o.created_at LIMIT 40`).all()).results;
  for(const o of rows)try{await ensureLabel(env,o);}catch{ /* Retry durable work on the next schedule. */ }
}
