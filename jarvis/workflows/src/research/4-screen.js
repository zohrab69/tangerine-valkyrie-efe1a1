// Screen CJ search results (no AI): excluded categories, price band, de-duplicate, then rank by demand.
// Demand = how many stores already list the product on CJ (CJ returns results sorted by it), plus
// CJ's sales/order count when the API provides one. Keeps the best 8.
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
    let image = p.productImage || p.bigImage || p.image || '';
    if (typeof image === 'string' && image.trim().startsWith('[')) { try { image = JSON.parse(image)[0] || ''; } catch { image = ''; } }
    if (Array.isArray(image)) image = image[0] || '';
    image = String(image || '').replace(/^http:/, 'https:');
    const sold = Number(p.saleNum ?? p.salesVolume ?? p.soldNum ?? p.orderNum ?? 0) || 0;
    out.push({ pid, name: name.slice(0, 120), category: cat, sku: p.productSku || p.sku || '',
               image: /^https:\/\//.test(image) ? image : '', list_price_usd: price,
               listed_by_stores: Number(p.listedNum ?? p.listedShopNum ?? 0) || 0, sold_count: sold,
               keyword: searches[idx]?.keyword || '', token: searches[0]?.token });
  }
});
const demand = x => x.listed_by_stores + 2 * x.sold_count;
out.forEach(x => { x.demand_score = demand(x); });
out.sort((a, b) => b.demand_score - a.demand_score);
const keep = out.slice(0, 8);
if (!keep.length) return [{ json: { empty: true, notes, token: searches[0]?.token } }];
return keep.map(p => ({ json: { ...p, screen_notes: notes } }));
