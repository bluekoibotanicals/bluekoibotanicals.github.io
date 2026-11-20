import {test} from 'node:test';
import assert from 'node:assert/strict';
import {epdFixture} from './epd-fixture.mjs';
import {activeProducts,digest,now} from '../server/core.mjs';
const auth=f=>({Authorization:'Bearer '+f.env.ADMIN_TOKEN});
async function seedLimit(f,scope,hits){
  const key=await digest(`${scope}:local:${Math.floor(now()/3600)}`);
  await f.env.DB.prepare('INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,?,?)').bind(key,hits,now()+7200).run();
}
test('all 20 stock entries and dashboard refreshes work even after the old admin lockout',async()=>{
  const f=epdFixture();
  try{
    await seedLimit(f,'admin',999);
    const paths=['status','reviews','orders','discount-codes','inventory','past-review-invitations'];
    for(const p of activeProducts){
      const r=await f.request('/api/admin/inventory',{slug:p.slug,quantity:12,version:0},auth(f));
      assert.equal(r.status,200);assert.equal(r.data.quantity,12);assert.equal(r.data.version,1);
      for(const path of paths)assert.equal((await f.request('/api/admin/'+path,undefined,auth(f))).status,200,path);
    }
    const items=(await f.request('/api/admin/inventory',undefined,auth(f))).data.items;
    assert.equal(items.length,20);assert.ok(items.every(p=>p.quantity===12 && p.version===1));
  }finally{f.close();}
});
test('failed login throttling does not lock out an authenticated owner or change stock',async()=>{
  const f=epdFixture();
  try{
    const body={slug:activeProducts[0].slug,quantity:0,version:0};
    for(let i=0;i<30;i++)assert.equal((await f.request('/api/admin/inventory',body)).status,401);
    assert.equal((await f.request('/api/admin/inventory',body)).status,429);
    const items=(await f.request('/api/admin/inventory',undefined,auth(f))).data.items;
    assert.ok(items.every(p=>p.quantity===20));
    assert.equal((await f.request('/api/admin/inventory',body,auth(f))).status,200);
  }finally{f.close();}
});
test('authenticated edits remain limited independently from reads and preserve stock on rejection',async()=>{
  const f=epdFixture();
  try{
    await seedLimit(f,'admin-write',299);
    const body={slug:activeProducts[0].slug,quantity:9,version:0};
    assert.equal((await f.request('/api/admin/inventory',body,auth(f))).status,200);
    assert.equal((await f.request('/api/admin/inventory',{...body,quantity:0,version:1},auth(f))).status,429);
    const r=await f.request('/api/admin/inventory',undefined,auth(f));
    assert.equal(r.status,200);assert.equal(r.data.items.find(p=>p.slug===body.slug).quantity,9);
  }finally{f.close();}
});
