// Screen CJ search results (no AI): excluded categories, price band, de-duplicate, rank by how many
// stores already list the product on CJ (a real demand signal, not a guess). Keeps the best 8.
const EXCLUDE = /(electr|usb|batter|charg|bluetooth|earphone|headphone|speaker|camera|phone|smart ?watch|\bled\b|lamp|cosmetic|make ?up|lipstick|mascara|skin ?care|serum|cream|perfume|nail polish|hair dye|toy|\bkid|child|baby|infant|toddler|food|snack|supplement|vitamin|medical|medicine|knife set|weapon|vape|e-cig|cbd|lithium)/i;
const MAX_COST_USD = 20;   // supplier price ceiling, before shipping
const searches = $('Searches').all().map(i => i.json);
const out = [], seen = new Set(), notes = [];
$input.all().forEach((item, idx) => {
  const r = item.json || {};
  if (r.error) { notes.push(`search "${searches[idx]?.keyword}": request failed (${(r.error.message || JSON.stringify(r.error)).slice(0, 120)})`); return; }
  if (r.result === false || (r.code && r.code !== 200)) { notes.push(`search "${searches[idx]?.keyword}": CJ said ${r.message || r.code}`); return; }
  const d = r.data || {};
  let list = d.list || d.content || [];
  if (list.length && list[0] && Array.isArray(list[0].productList)) list = list.flatMap(x => x.productList);
  for (const p of list) {
    const pid = p.pid || p.id; if (!pid || seen.has(pid)) continue;
    const name = p.productNameEn || p.nameEn || p.productName || '';
    const cat = p.categoryName || p.threeCategoryName || '';
    const price = parseFloat(String(p.sellPrice ?? p.nowPrice ?? '').split('-')[0]);
    if (!name || EXCLUDE.test(name + ' ' + cat) || !(price > 0) || price > MAX_COST_USD) continue;
    seen.add(pid);
    out.push({ pid, name: name.slice(0, 120), category: cat, sku: p.productSku || p.sku || '',
               image: p.productImage || p.bigImage || '', list_price_usd: price,
               listed_by_stores: Number(p.listedNum ?? p.listedShopNum ?? 0) || 0,
               keyword: searches[idx]?.keyword || '', token: searches[0]?.token });
  }
});
out.sort((a, b) => b.listed_by_stores - a.listed_by_stores);
const keep = out.slice(0, 8);
if (!keep.length) return [{ json: { empty: true, notes, token: searches[0]?.token } }];
return keep.map(p => ({ json: { ...p, screen_notes: notes } }));
