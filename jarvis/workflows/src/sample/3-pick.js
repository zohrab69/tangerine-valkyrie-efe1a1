// Product details from CJ: choose the variant (first sellable one) and its price and weight.
const req = $('With token').first().json;
const r = $input.first().json || {};
const d = r.data || {};
const p = Array.isArray(d) ? d[0] || {} : (d.list ? d.list[0] || {} : d);
const vs = p.variants || p.variantList || [];
const v = vs.find(x => x && (x.vid || x.variantId)) || null;
const problem = req.token_error ? 'CJ login failed: ' + req.token_error
  : (r.result === false || (r.code && r.code !== 200)) ? 'CJ said: ' + (r.message || r.code)
  : !v ? 'CJ did not return a variant for SKU ' + req.sku : null;
// CJ variant names often repeat the whole product name: keep only the part that differs (e.g. "Pink Round shape").
const pname = String(p.productNameEn || p.nameEn || '').trim();
let vname = v ? String(v.variantNameEn || v.variantName || v.variantKey || '').trim() : '';
if (pname && vname.toLowerCase().startsWith(pname.toLowerCase())) vname = vname.slice(pname.length).replace(/^[\s,:-]+/, '');
return [{ json: { ...req, problem,
  pid: p.pid || p.id || null, cj_name: p.productNameEn || p.nameEn || req.name,
  vid: v ? (v.vid || v.variantId) : null, variant: vname || (v ? (v.variantKey || '') : ''),
  variant_sku: v ? (v.variantSku || '') : '',
  unit_usd: v ? parseFloat(v.variantSellPrice ?? v.sellPrice ?? p.sellPrice) || null : null,
  weight_g: v ? Number(v.variantWeight ?? v.weight ?? 0) || null : null } }];
