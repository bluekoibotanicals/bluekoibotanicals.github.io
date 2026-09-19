"""One-time import of the owner's September 18 Square/packaging screenshots."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'content/products.json'
products = json.loads(path.read_text(encoding='utf-8'))
by = {p['slug']: p for p in products}
if 'jasmine-whipped-body-butter-4oz' not in by:
    p = dict(by['jasmine-whipped-body-butter'])
    p.update(slug='jasmine-whipped-body-butter-4oz', name='Jasmine Whipped Body Butter 4 oz', photo_slug='jasmine-whipped-body-butter')
    products.append(p)
if 'eucalyptus-whipped-body-butter' not in by:
    products.append(dict(slug='eucalyptus-whipped-body-butter', name='Eucalyptus Whipped Body Butter', category='body-butters', photo_slug='category-body-butters', meta='Whipped body butter', ingredients=[], use='', storage='Store in a cool, dry place.', warning='For external use only.', description='Eucalyptus whipped body butter. Currently sold out.', body='An individual product photo and full ingredient list will be added before this item returns to online sale.'))
# price cents, snapshot stock, actual item weight lb, package key, exact Square item name
rows = {
 'cbd-salve': (3200,83,.296875,'small','CBD Salve - 2.0oz 1000 mg CBD'),
 'cbd-salve-4oz': (5800,11,.4375,'small','Large CBD Salve - 4.0oz 2000 mg CBD'),
 'cedarwood-vanilla-body-oil': (2200,4,.49375,'large','Cedarwood Vanilla Body Oil'),
 'eucalyptus-body-oil': (2200,8,.49375,'large','Eucalyptus Body Oil'),
 'jasmine-body-oil': (2200,20,.49375,'large','Jasmine Body Oil'),
 'lavender-body-oil': (2200,8,.49375,'large','Lavender Body Oil'),
 'lavender-magnesium-spray': (1900,90,.56625,'large','Lavender Magnesium Body Mist'),
 'rose-magnesium-spray': (1900,47,.56625,'large','Rose Magnesium Body Mist'),
 'honey-lavender-lip-balm': (500,90,.0228125,'small','Honey Lavender Lip Balm'),
 'lavender-spearmint-lip-balm': (500,113,.0228125,'small','Lavender Spearmint Lip Balm'),
 'jasmine-whipped-body-butter-4oz': (1800,18,.3725,'large','4oz Jasmine Whipped Body Butter'),
 'jasmine-whipped-body-butter': (2800,11,.6825,'large','8oz Jasmine Whipped Body Butter'),
 'cedarwood-vanilla-whipped-body-butter': (2800,4,.6825,'large','Cedarwood Vanilla Whipped Body Butter'),
 'lavender-whipped-body-butter': (2800,6,.6825,'large','Lavender Whipped Body Butter'),
 'unscented-whipped-body-butter': (2800,2,.6825,'large','Unscented Whipped Body Butter'),
 'eucalyptus-whipped-body-butter': (2800,0,.6825,'large','Eucalyptus Whipped Body Butter'),
}
for p in products:
    price, stock, weight, package, square_name = rows[p['slug']]
    p.update(price=f'${price/100:g}', price_cents=price, stock_snapshot=stock, weight_lb=weight,
             package=package, cbd=p['category']=='cbd-salves', square_name=square_name,
             square_variation_id=None, customs_tariff_number='', origin_country='US',
             online_enabled=p['slug']!='eucalyptus-whipped-body-butter')
    if p['category']=='body-butters':
        oz=4 if p['slug'].endswith('-4oz') else 8
        p['display_size']=f'{oz} oz · Whipped body butter'
        p['size']=f'Net Wt. {oz} oz ({113 if oz==4 else 227} g)'
path.write_text(json.dumps(products, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
