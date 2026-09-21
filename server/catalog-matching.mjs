// Both names are required for a size match: never fall back to the first variation.
export const normalizeName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
export function variationCandidates(product, variations) {
  return variations.filter(v => product.square_variation_name
    ? normalizeName(v.item_name) === normalizeName(product.square_name) && normalizeName(v.variation_name) === normalizeName(product.square_variation_name)
    : normalizeName(v.item_name) === normalizeName(product.square_name) || normalizeName(v.item_name+' '+v.variation_name) === normalizeName(product.square_name));
}
export function flattenVariations(items) {
  return items.filter(i=>!i.is_deleted).flatMap(i=>(i.item_data?.variations || []).filter(v=>!v.is_deleted).map(v=>({item_name:i.item_data.name,variation_name:v.item_variation_data.name,variation_id:v.id,price_cents:v.item_variation_data.price_money?.amount,currency:v.item_variation_data.price_money?.currency,track_inventory:v.item_variation_data.track_inventory})));
}
