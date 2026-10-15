import test from 'node:test';
import assert from 'node:assert/strict';
import {products, parcels, store} from '../server/core.mjs';
import {catalog} from '../server/providers.mjs';
import {variationCandidates} from '../server/catalog-matching.mjs';
import {fixture, address} from './fixture.mjs';

test('roll-on name matching requires the named item, not a different item and variation combined',()=>{
  const p=products.find(p=>p.slug==='cbd-roll-on');
  const options=[{item_name:'CBD Roll-On',variation_name:'Regular',variation_id:'correct'},{item_name:'CBD',variation_name:'Roll-On',variation_id:'wrong'}];
  assert.deepEqual(variationCandidates(p,options).map(x=>x.variation_id),['correct']);
});

test('roll-on uses the confirmed price, measured bottle weight and existing box weight',()=>{
  const p=products.find(p=>p.slug==='cbd-roll-on');
  assert.equal(p.price_cents,2600);
  assert.ok(Math.abs(p.weight_lb*453.59237-40)<0.00001);
  assert.equal(p.cbd,true);
  const weight=Number(parcels([{...p,quantity:1}])[0].parcel.weight);
  assert.equal(weight,Number((40/453.59237+store.packages.small.weight_lb).toFixed(4)));
});

test('roll-on resolves live Square price and stock, quotes shipping and purchases through the existing checkout',async()=>{
  const f=fixture();f.state.stock['cbd-roll-on']=8;
  try{
    const items=await catalog(f.env),p=items.find(p=>p.slug==='cbd-roll-on');
    assert.equal(p.square_variation_id,'v-cbd-roll-on');assert.equal(p.stock,8);assert.equal(p.online_enabled,true);
    const q=await f.quote([{slug:p.slug,quantity:1}]);assert.equal(q.status,200);
    assert.equal(q.data.lines[0].price_cents,2600);
    assert.equal((await f.pay(q)).status,200);
    assert.equal([...f.state.orders.values()][0].line_items[0].catalog_object_id,'v-cbd-roll-on');
    f.state.prices[p.slug]=2700;
    assert.equal((await catalog(f.env)).find(p=>p.slug==='cbd-roll-on').price_cents,2700);
  }finally{f.close();}
});

test('roll-on ships to Colorado, Idaho, and Wyoming',async()=>{
  const f=fixture();f.state.stock['cbd-roll-on']=8;
  try{
    for(const state of ['CO','ID','WY']){
      const q=await f.quote([{slug:'cbd-roll-on',quantity:1}],{...address,state});
      assert.equal(q.status,200);
    }
    assert.equal(f.state.shippingCalls,3);assert.equal(f.state.paymentCalls,0);
  }finally{f.close();}
});

for(const mode of ['missing','ambiguous'])test(`a ${mode} Square match cannot sell the roll-on`,async()=>{
  const f=fixture();f.state.stock['cbd-roll-on']=8;const original=f.env.FETCH;
  f.env.FETCH=async(url,options)=>{
    const response=await original(url,options);
    if(new URL(url).pathname!=='/v2/catalog/list')return response;
    const data=await response.json();
    if(mode==='missing')data.objects=data.objects.filter(x=>x.item_data.name!=='CBD Roll-On');
    else {
      const item=data.objects.find(x=>x.item_data.name==='CBD Roll-On');
      item.item_data.variations.push({...item.item_data.variations[0],id:'another-roll-on'});
    }
    return Response.json(data);
  };
  try{
    assert.equal((await catalog(f.env)).find(p=>p.slug==='cbd-roll-on').online_enabled,false);
    const q=await f.quote([{slug:'cbd-roll-on',quantity:1}]);assert.equal(q.status,409);
    assert.equal(f.state.paymentCalls,0);
  }finally{f.close();}
});
