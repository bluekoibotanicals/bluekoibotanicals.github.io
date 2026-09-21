import test from 'node:test';
import assert from 'node:assert/strict';
import {products,parcels} from '../server/core.mjs';
import {variationCandidates} from '../server/catalog-matching.mjs';
import {catalog} from '../server/providers.mjs';
import {fixture} from './fixture.mjs';
const butters=products.filter(p=>p.category==='body-butters');

test('every scent has two capacities and the small jars ship at 0.5925 lb with one box',()=>{
  assert.equal(butters.length,10);
  for(const p of butters.filter(p=>p.jar_capacity_oz===8)){
    const small=butters.find(x=>x.slug===p.slug+'-4oz');assert.ok(small);
    assert.equal(small.parent_slug,p.slug);assert.equal(p.price_cents,2800);assert.equal(small.price_cents,2000);
    assert.equal(parcels([{...small,quantity:1}])[0].parcel.weight,'0.5925');
    assert.notEqual(p.photo_slug,small.photo_slug);
    assert.doesNotMatch(p.size,/Net Wt/);assert.doesNotMatch(small.size,/Net Wt/);
  }
});
test('same-name parents resolve only the requested size and never the removed standalone item',()=>{
  const p=butters.find(p=>p.slug==='jasmine-whipped-body-butter-4oz');
  const variants=[{item_name:p.square_name,variation_name:'8oz Jasmine Whipped Body Butter',variation_id:'large'}, {item_name:p.square_name,variation_name:p.square_variation_name,variation_id:'small'}, {item_name:'4oz Jasmine Whipped Body Butter',variation_name:'Regular',variation_id:'deleted-item'}];
  assert.deepEqual(variationCandidates(p,variants).map(v=>v.variation_id),['small']);
});
test('both Jasmine sizes retain separate Square order lines and combined shipping weight',async()=>{
  const f=fixture();try{
    const q=await f.quote([{slug:'jasmine-whipped-body-butter',quantity:1},{slug:'jasmine-whipped-body-butter-4oz',quantity:1}]);assert.equal(q.status,200);
    assert.equal(f.state.lastShipment.parcels[0].weight,'1.275');
    const paid=await f.pay(q);assert.equal(paid.status,200);
    const order=[...f.state.orders.values()][0];
    assert.deepEqual(order.line_items.map(p=>p.catalog_object_id),['v-jasmine-whipped-body-butter','v-jasmine-whipped-body-butter-4oz']);
    assert.deepEqual(order.line_items.map(p=>p.base_price_money.amount),[2800,2000]);
  }finally{f.close();}
});
test('manual availability and sold-out overrides are independent of the other size',async()=>{
  const f=fixture();const original=f.env.FETCH;
  f.env.FETCH=async(url,options)=>{
    const response=await original(url,options);
    if(new URL(url).pathname!=='/v2/catalog/batch-retrieve')return response;
    const data=await response.json();
    for(const item of data.objects){
      if(item.id==='v-lavender-whipped-body-butter') item.item_variation_data.track_inventory=false;
      if(item.id==='v-jasmine-whipped-body-butter-4oz') item.item_variation_data.location_overrides=[{location_id:'location',sold_out:true}];
    }
    return Response.json(data);
  };
  try{
    const items=await catalog(f.env);
    assert.equal(items.find(p=>p.slug==='lavender-whipped-body-butter').stock,12);
    assert.equal(items.find(p=>p.slug==='lavender-whipped-body-butter').online_enabled,true);
    assert.equal(items.find(p=>p.slug==='jasmine-whipped-body-butter-4oz').stock,0);
    assert.equal(items.find(p=>p.slug==='jasmine-whipped-body-butter').stock,11);
  }finally{f.close();}
});
test('missing or ambiguous named sizes cannot be substituted at checkout',async()=>{
  const f=fixture(),original=f.env.FETCH;
  f.env.FETCH=async(url,options)=>{
    const response=await original(url,options);
    if(new URL(url).pathname!=='/v2/catalog/list')return response;
    const data=await response.json();
    data.objects=data.objects.filter(o=>o.item_data.name!=='Jasmine Whipped Body Butter');
    return Response.json(data);
  };
  try{const q=await f.quote([{slug:'jasmine-whipped-body-butter-4oz',quantity:1}]);assert.notEqual(q.status,200);assert.equal(f.state.paymentCalls,0);}
  finally{f.close();}
});
