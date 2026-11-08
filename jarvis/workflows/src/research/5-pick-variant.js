// First sellable variant of each product: its id (needed for shipping), price and weight.
const prods = $('Screen products').all().map(i => i.json);
return $input.all().map((item, idx) => {
  const p = prods[idx]; const r = item.json || {};
  const vs = Array.isArray(r.data) ? r.data : (r.data && (r.data.variants || r.data.list)) || [];
  const v = vs.find(x => x && (x.vid || x.variantId)) || null;
  return { json: { ...p, vid: v ? (v.vid || v.variantId) : null,
                   variant_name: v ? (v.variantNameEn || v.variantName || '') : '',
                   cost_usd: v ? parseFloat(v.variantSellPrice ?? v.sellPrice ?? p.list_price_usd) || p.list_price_usd : p.list_price_usd,
                   weight_g: v ? Number(v.variantWeight ?? v.weight ?? 0) || null : null } };
});
