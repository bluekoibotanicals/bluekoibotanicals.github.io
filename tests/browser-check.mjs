import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fixture} from './fixture.mjs';
import worker from '../server/worker.mjs';
const base=process.env.TEST_URL || 'http://127.0.0.1:18878';
const server=process.env.TEST_URL?null:spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:'18878',BK_TEST_PREVIEW:'1'},stdio:'ignore'});
if(server)await new Promise((resolve,reject)=>{let attempts=0;const poll=async()=>{try{await fetch(base);resolve();}catch{if(++attempts>50){server.kill();reject(new Error('Test preview did not start.'));}else setTimeout(poll,100);}};poll();});
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/products/jasmine-whipped-body-butter-4oz.html');
  assert.doesNotMatch(await page.locator('body').innerText(),/�|â€|Â©|Â·/);
  assert.match(await page.locator('footer').innerText(),/©/);
  await page.getByRole('button',{name:'Add to bag'}).waitFor();await page.getByRole('button',{name:'Add to bag'}).click();
  await page.goto(base+'/cart.html');await page.getByRole('heading',{name:'Jasmine Whipped Body Butter'}).waitFor();
  assert.match(await page.locator('#cart-summary').innerText(),/18\.00/);
  await page.screenshot({path:'test-results/cart-desktop.png',fullPage:true});
  await page.goto(base+'/checkout.html');await page.locator('#checkout-mode').waitFor();assert.match(await page.locator('#checkout-mode').innerText(),/being prepared/);assert.equal(await page.locator('#get-rates').isDisabled(),true);
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/products/jasmine-whipped-body-butter-4oz.html');await page.getByRole('button',{name:'Add to bag'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/product-mobile.png',fullPage:true});
  await page.goto(base+'/products/eucalyptus-whipped-body-butter.html');await page.getByRole('button',{name:'Sold out'}).waitFor();assert.equal(await page.getByRole('button',{name:'Sold out'}).isDisabled(),true);
  assert.deepEqual(errors,[]);await page.close();

  // Exercise the real Worker and browser flow with isolated SQLite and simulated Square/Shippo.
  const f=fixture();f.env.SITE_URL=base;
  const context=await browser.newContext({viewport:{width:1440,height:1100}});const checkout=await context.newPage(),failures=[];checkout.on('pageerror',e=>failures.push(e.message));
  await context.route('**/api/**',async route=>{
    const req=route.request();const request=new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),body:req.postData() || undefined});
    const response=await worker.fetch(request,f.env,{waitUntil:p=>p.catch(()=>{})});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  await context.route('https://sandbox.web.squarecdn.com/v1/square.js',route=>route.fulfill({contentType:'application/javascript',body:`window.Square={payments(){return {async card(){return {async attach(s){document.querySelector(s).innerHTML='<label class="field">Test card<input aria-label="Test card" placeholder="Simulated Square card form"></label>';},async tokenize(){return {status:'OK',token:'cnon:browser-test-token'};}}}}}};`}));
  await checkout.goto(base+'/products/honey-lavender-lip-balm.html');await checkout.getByRole('button',{name:'Add to bag'}).click();await checkout.goto(base+'/checkout.html');
  assert.match(await checkout.locator('#shipping-promotion').innerText(),/first 50 orders over \$25/);
  assert.equal(await checkout.locator('#address-form select[name="country"]').count(),0);
  assert.equal(await checkout.locator('#address-form input[name="country"]').inputValue(),'US');
  for(const [name,value] of Object.entries({name:'Test Customer',email:'test@example.com',street1:'100 Test Street',city:'Charlottesville',state:'VA',zip:'22902'}))await checkout.locator(`#address-form [name="${name}"]`).fill(value);
  await checkout.getByRole('button',{name:'Get shipping options'}).click();await checkout.getByRole('button',{name:'Pay $11.52 USD',exact:true}).waitFor();
  assert.equal(await checkout.locator('.rate-option').count(),2);assert.match(await checkout.locator('#checkout-totals').innerText(),/0\.27/);
  await checkout.screenshot({path:'test-results/checkout-desktop.png',fullPage:true});
  await checkout.setViewportSize({width:390,height:844});assert.equal(await checkout.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await checkout.screenshot({path:'test-results/checkout-mobile.png',fullPage:true});
  await checkout.getByRole('button',{name:'Pay $11.52 USD',exact:true}).click();await checkout.getByRole('heading',{name:'Thank you for your order.'}).waitFor();assert.equal(f.state.paymentCalls,1);assert.match(await checkout.locator('#order-details').innerText(),/11\.52/);assert.deepEqual(failures,[]);
  await checkout.goto(base+'/products/honey-lavender-lip-balm.html');
  await checkout.locator('#product-quantity').fill('6');await checkout.getByRole('button',{name:'Add to bag'}).click();await checkout.goto(base+'/checkout.html');
  for(const [name,value] of Object.entries({name:'Test Customer',email:'test@example.com',street1:'100 Test Street',city:'Los Angeles',state:'CA',zip:'90001'}))await checkout.locator(`#address-form [name="${name}"]`).fill(value);
  await checkout.getByRole('button',{name:'Get shipping options'}).click();await checkout.getByRole('button',{name:'Pay $31.59 USD',exact:true}).waitFor();
  assert.match(await checkout.locator('.rate-option').first().innerText(),/Free/);
  assert.match(await checkout.locator('#parcel-note').innerText(),/one parcel/);
  assert.equal(f.state.lastShipment.parcels[0].length,'8');
  assert.doesNotMatch(await checkout.locator('body').innerText(),/�|â€|Â©|Â·/);
  await checkout.screenshot({path:'test-results/promotion-mobile.png',fullPage:true});
  assert.equal(await checkout.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(failures,[]);
  await f.flush();await context.close();f.close();
  console.log('Browser checks passed: desktop/mobile layouts, UTF-8 characters, U.S. delivery form, promotion, combined package, tax in VA and CA, simulated card purchase, order confirmation; no page errors.');
}finally{await browser.close();server?.kill();}
