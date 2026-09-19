import {products,store,clean,fail,uuid,now,hmac,digest} from './core.mjs';
import {sendEmail} from './providers.mjs';
const statement=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
const RETRY_WINDOW=23*3600;

export async function createPastInvitation(env,b) {
  if(!env.RESEND_API_KEY || !env.EMAIL_FROM)fail('Configure the order email service before sending invitations.',503);
  const email=clean(b.email,254).toLowerCase(),name=clean(b.customer_name,80),source=clean(b.source,20),reference=clean(b.purchase_reference,120),date=clean(b.purchased_on,10);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name)fail('Enter the customer name and a valid email address.');
  if(!['square','market','etsy','other'].includes(source) || !reference)fail('Select where the purchase was made and enter its receipt or sale reference.');
  const parsed=new Date(date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date || date>new Date().toISOString().slice(0,10))fail('Enter a valid purchase date that is not in the future.');
  if(b.purchase_verified!==true)fail('Confirm that you checked the purchase and the selected products before inviting this customer.');
  if(!Array.isArray(b.products) || !b.products.length || b.products.length>products.length || b.products.some(slug=>!products.some(p=>p.slug===slug)))fail('Select the products this customer actually purchased.');
  const lines=[...new Set(b.products)].sort().map(slug=>{const p=products.find(p=>p.slug===slug);return {slug,name:p.name,size:p.display_size};});
  const existing=await statement(env,'SELECT id FROM past_review_invitations WHERE source=? AND purchase_reference=?',source,reference).first();
  if(existing)fail('This purchase already has an invitation. Find it in the invitation list; use its existing link.',409,'INVITATION_EXISTS');
  const id=uuid(),token=await hmac(env.ADMIN_TOKEN,`past-review:${id}`),link=`${env.SITE_URL}/review.html#${encodeURIComponent(token)}`;
  // Persist the exact email for retries, even if the sender settings change later.
  const payload={from:env.EMAIL_FROM,to:email,subject:'How are you enjoying your Blue Koi products?',key:`past-review-${id}`,text:`Hi ${name},\n\nThank you for your earlier Blue Koi purchase. We would love your honest feedback on the products you purchased:\n${lines.map(p=>`${p.name} (${p.size})`).join('\n')}\n\nLeave a verified purchase review here:\n${link}\n\nPositive and negative feedback are equally welcome. Reviewing is optional, and your email and purchase reference will not be public. This private link expires in ${store.review_expiry_days} days.\n\nThank you,\nGwyn\nBlue Koi Botanicals\n${store.email}`};
  const result=await statement(env,'INSERT OR IGNORE INTO past_review_invitations(id,email,customer_name,source,purchase_reference,purchased_on,products_json,token_hash,created_at,expires_at,email_payload) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,email,name,source,reference,date,JSON.stringify(lines),await digest(token),now(),now()+store.review_expiry_days*86400,JSON.stringify(payload)).run();
  if(!result.meta.changes)fail('This purchase already has an invitation. Find it in the invitation list.',409,'INVITATION_EXISTS');
  await deliverPastInvitation(env,id);
  return {id,...await invitationState(env,id)};
}

async function invitationState(env,id) {
  const row=await statement(env,'SELECT email_sent,first_attempt_at,revoked_at,expires_at FROM past_review_invitations WHERE id=?',id).first();
  return {delivery:row.email_sent?'sent':row.first_attempt_at && row.first_attempt_at<=now()-RETRY_WINDOW?'check_email_service':'pending'};
}
export async function deliverPastInvitation(env,id) {
  if(!env.RESEND_API_KEY)return;
  // One sender at a time. Retry only within the provider's 24-hour deduplication window.
  const claimed=await statement(env,'UPDATE past_review_invitations SET first_attempt_at=COALESCE(first_attempt_at,?),last_attempt_at=? WHERE id=? AND email_sent=0 AND revoked_at IS NULL AND expires_at>? AND (first_attempt_at IS NULL OR first_attempt_at>?) AND (last_attempt_at IS NULL OR last_attempt_at<?)',now(),now(),id,now(),now()-RETRY_WINDOW,now()-300).run();
  if(!claimed.meta.changes)return;
  const row=await statement(env,'SELECT email_payload FROM past_review_invitations WHERE id=?',id).first();
  const {from,...payload}=JSON.parse(row.email_payload);
  try { if(await sendEmail({...env,EMAIL_FROM:from},payload))await statement(env,'UPDATE past_review_invitations SET email_sent=1 WHERE id=?',id).run(); }
  catch { /* The scheduled job retries the same email and key; no customer data is logged. */ }
}
export async function retryPastInvitations(env) {
  const rows=(await statement(env,'SELECT id FROM past_review_invitations WHERE email_sent=0 AND revoked_at IS NULL AND expires_at>? AND (first_attempt_at IS NULL OR first_attempt_at>?) AND (last_attempt_at IS NULL OR last_attempt_at<?) ORDER BY COALESCE(last_attempt_at,0) LIMIT 20',now(),now()-RETRY_WINDOW,now()-300).all()).results;
  for(const row of rows)await deliverPastInvitation(env,row.id);
}
export async function listPastInvitations(env) {
  const rows=(await statement(env,'SELECT id,email,customer_name,source,purchase_reference,purchased_on,products_json,created_at,expires_at,revoked_at,email_sent,first_attempt_at,(SELECT COUNT(*) FROM past_reviews r WHERE r.invitation_id=i.id) AS submitted_count FROM past_review_invitations i ORDER BY created_at DESC LIMIT 100').all()).results;
  return rows.map(({products_json,first_attempt_at,...r})=>({...r,products:JSON.parse(products_json),delivery:r.email_sent?'sent':first_attempt_at && first_attempt_at<=now()-RETRY_WINDOW?'check_email_service':'pending'}));
}
export async function pastInvitationAction(env,b) {
  const id=clean(b.id,50),row=await statement(env,'SELECT * FROM past_review_invitations WHERE id=?',id).first();
  if(!row)fail('Invitation not found.',404);
  if(b.action==='revoke') {await statement(env,'UPDATE past_review_invitations SET revoked_at=COALESCE(revoked_at,?) WHERE id=?',now(),id).run();return {ok:true};}
  if(b.action==='link') {
    if(row.revoked_at || row.expires_at<=now())fail('This invitation is expired or revoked.',409);
    const payload=JSON.parse(row.email_payload),match=payload.text.match(/https?:\/\/[^\s]+\/review\.html#[^\s]+/);
    if(!match)fail('Invitation link unavailable.',503);
    return {url:match[0]};
  }
  fail('Invalid invitation action.');
}
