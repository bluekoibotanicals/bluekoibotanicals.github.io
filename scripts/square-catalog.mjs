import {flattenVariations,variationCandidates} from '../server/catalog-matching.mjs';
// Read Square item variations and propose explicit catalog mappings. No payments or inventory writes.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
const root=resolve(import.meta.dirname,'..');
let vars={};try{vars=parseEnv(await readFile(resolve(root,'.dev.vars'),'utf8'));}catch{}
const config={...vars,...process.env};
if(!config.SQUARE_ACCESS_TOKEN)throw new Error('Set SQUARE_ACCESS_TOKEN in .dev.vars or the environment first.');
const production=config.SQUARE_ENVIRONMENT==='production';
const base=production?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
const all=[];let cursor;
do{
  const u=new URL(base+'/v2/catalog/list');u.searchParams.set('types','ITEM');if(cursor)u.searchParams.set('cursor',cursor);
  const r=await fetch(u,{headers:{Authorization:'Bearer '+config.SQUARE_ACCESS_TOKEN,'Square-Version':config.SQUARE_API_VERSION || '2026-09-16'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('Square catalog could not be read. Check account permissions and environment.');const d=await r.json();all.push(...(d.objects || []));cursor=d.cursor;
}while(cursor);
const variations=flattenVariations(all);
const products=JSON.parse(await readFile(resolve(root,'content/products.json'),'utf8'));
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const matches=products.map(p=>{
  const list=variationCandidates(p,variations);
  return {slug:p.slug,expected_name:p.square_name,expected_variation_name:p.square_variation_name,expected_price_cents:p.price_cents,environment:production?'production':'sandbox',candidates:list,selected_variation_id:list.length===1 && list[0].currency==='USD' && list[0].price_cents===p.price_cents?list[0].variation_id:null};
});
await writeFile(resolve(root,'square-catalog-candidates.json'),JSON.stringify({environment:production?'production':'sandbox',matches,all_variations:variations},null,2)+'\n');
if(process.argv.includes('--apply')){
  for(const p of products)p.square_variation_id=matches.find(m=>m.slug===p.slug).selected_variation_id;
  await writeFile(resolve(root,'content/products.json'),JSON.stringify(products,null,2)+'\n');
  console.log('Applied unambiguous name-and-price matches. Review content/products.json before deployment.');
}
console.log(`${matches.filter(m=>m.selected_variation_id).length}/${products.length} exact matches (${production?'production':'sandbox'}). Review square-catalog-candidates.json; manually resolve missing or ambiguous variations in content/products.json.`);
