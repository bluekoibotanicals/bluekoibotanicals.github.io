import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fixture} from './fixture.mjs';
import worker from '../server/worker.mjs';

const base='http://127.0.0.1:18879';
const server=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:'18879',BK_TEST_PREVIEW:'1'},stdio:'ignore'});
let browser;
const f=fixture();f.env.SITE_URL=base;f.state.stock['cbd-roll-on']=7;
try{
  for(let n=0;;n++){
    try{await fetch(base);break;}catch(error){if(n>60)throw error;await new Promise(r=>setTimeout(r,100));}
  }
  await mkdir('test-results',{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/**',async route=>{
    const req=route.request();
    const response=await worker.fetch(new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),body:req.postData() || undefined}),f.env,{waitUntil:p=>p.catch(()=>{})});
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function capture(path){
    await page.evaluate(async()=>{
      document.activeElement?.blur();
      document.querySelectorAll('img').forEach(i=>i.loading='eager');
      await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
      await document.fonts.ready;
      window.scrollTo({top:0,behavior:'instant'});
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    });
    await page.screenshot({path,fullPage:true});
  }
  await page.goto(base+'/index.html');
  assert.equal(await page.locator('.collection-grid .category-card').count(),6);
  await page.getByRole('link',{name:'Meet the CBD Roll-On',exact:true}).click();
  await page.getByRole('button',{name:'Add to bag',exact:true}).waitFor();
  assert.match(await page.locator('h1').innerText(),/^CBD Roll-On$/);
  assert.equal(await page.locator('.product-spec .price').innerText(),'$26.00');
  assert.equal(await page.locator('.product-highlights li').count(),3);
  assert.equal(await page.locator('.variants').count(),0);
  await page.waitForFunction(()=>{const i=document.querySelector('.detail-image img');return i.complete && i.naturalWidth>0;});
  await page.locator('summary').filter({hasText:'Ingredients'}).click();
  assert.equal(await page.locator('.ingredients li').count(),8);
  assert.match(await page.locator('.detail-copy').innerText(),/Bisabolol/);
  assert.match(await page.locator('.detail-copy').innerText(),/Colorado, Idaho, or Wyoming/);
  await capture('test-results/roll-on-desktop.png');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await capture('test-results/roll-on-mobile.png');
  await page.getByRole('button',{name:'Add to bag',exact:true}).click();
  await page.goto(base+'/cart.html');
  await page.locator('.cart-line').waitFor();
  assert.match(await page.locator('#cart-summary').innerText(),/26\.00/);
  assert.match(await page.locator('.cart-line').innerText(),/10 mL/);
  await page.goto(base+'/products.html');
  assert.equal(await page.locator('.product-card').count(),16);
  assert.equal(await page.locator('.product-card p').count(),16);
  assert.equal(await page.locator('#cbd-roll-ons .product-card').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(base+'/products/jasmine-body-oil.html');
  await capture('test-results/refreshed-description-mobile.png');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(base+'/index.html');
  await capture('test-results/home-with-roll-on-mobile.png');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  console.log('Roll-on browser checks passed: homepage, catalog, product image, ingredients, $26 live price, cart, expanded descriptions, and mobile layouts.');
}finally{await browser?.close();server.kill();f.close();}
