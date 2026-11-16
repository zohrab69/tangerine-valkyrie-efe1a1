// First sellable variant of each supplier listing (id for shipping, price, weight, SKU).
const sup = $('Best 3 suppliers').all().map(i => i.json);
return $input.all().map((item, idx) => {
  const s = sup[idx]; const r = item.json || {};
  const vs = Array.isArray(r.data) ? r.data : (r.data && (r.data.variants || r.data.list)) || [];
  const v = vs.find(x => x && (x.vid || x.variantId)) || null;
  return { json: { ...s, vid: v ? (v.vid || v.variantId) : null, variant_sku: v ? (v.variantSku || '') : '',
    cost_usd: v ? parseFloat(v.variantSellPrice ?? v.sellPrice ?? s.price_usd) || s.price_usd : s.price_usd,
    weight_g: v ? Number(v.variantWeight ?? 0) || null : null } };
});
