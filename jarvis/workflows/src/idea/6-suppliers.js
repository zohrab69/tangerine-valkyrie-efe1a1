// Best 3 CJ listings ("suppliers") for the product: relevant name, allowed by the owner's rules,
// CA/US warehouse first, a healthy number of stores already selling it, then lower price.
//@include shared/rules.js
const p = $('Product identity').first().json;
const searches = $('CJ searches').all().map(i => i.json);
const sing = w => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
const words = t => new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['for', 'and', 'the', 'with', 'new'].includes(w)).map(sing));
const qw = words(p.q + ' ' + p.name);
// The product itself (last word of the search, e.g. "bandana" in "dog bandana") must be in the supplier's title,
// and at least 2 words must match: "dog bandana" must not match a "dog poop bag holder".
const qList = [...words(p.q)];
const noun = qList[qList.length - 1] || '';
const need = Math.min(2, qList.length || 1);
const seen = new Set(), all = [];
$input.all().forEach((item, idx) => {
  const r = item.json || {};
  let list = (r.data && (r.data.list || r.data.content)) || [];
  if (list.length && Array.isArray(list[0].productList)) list = list.flatMap(x => x.productList);
  for (const x of list) {
    const pid = x.pid || x.id; if (!pid || seen.has(pid)) continue;
    const name = x.productNameEn || x.nameEn || x.productName || '';
    const price = parseFloat(String(x.sellPrice ?? x.nowPrice ?? '').split('-')[0]);
    if (!name || !(price > 0)) continue;
    const overlap = [...words(name)].filter(w => qw.has(w)).length;
    const nameWords = words(name);
    if (overlap < need || (noun && !nameWords.has(noun))) continue;
    const rule = checkRules(name + ' ' + (x.categoryName || ''));
    if (rule.excluded) continue;
    seen.add(pid);
    let image = x.productImage || x.bigImage || '';
    if (typeof image === 'string' && image.trim().startsWith('[')) { try { image = JSON.parse(image)[0] || ''; } catch { image = ''; } }
    image = String(Array.isArray(image) ? image[0] : image || '').replace(/^http:/, 'https:');
    const n = Number(x.listedNum ?? 0) || 0;
    all.push({ pid, name: name.slice(0, 120), sku: x.productSku || '', price_usd: price, image: /^https:/.test(image) ? image : '',
               warehouse: searches[idx] ? searches[idx].warehouse : 'CN', listed_by_stores: n, overlap,
               competition: n < 20 ? 'unproven' : n < 2000 ? 'healthy' : n < 8000 ? 'crowded' : 'saturated',
               certification: rule.certification, token: searches[0] && searches[0].token });
  }
});
const BAND = { healthy: 0, crowded: 1, unproven: 2, saturated: 3 };
all.sort((a, b) => b.overlap - a.overlap || ((b.warehouse !== 'CN') - (a.warehouse !== 'CN')) || BAND[a.competition] - BAND[b.competition] || a.price_usd - b.price_usd);
const best = all.slice(0, 3);
if (!best.length) return [{ json: { none: true } }];
return best.map((s, i) => ({ json: { rank: i + 1, ...s } }));
