// One item per theme and warehouse country -> one CJ product search each (CA, US, then CN).
const plan = $input.first().json;
const out = [];
for (const k of plan.keywords) for (const w of plan.warehouses || ['CN']) {
  const query = { pageNum: 1, pageSize: plan.page_size, productNameEn: k, orderBy: 'listedNum' };
  if (w !== 'CN') query.countryCode = w;   // CJ: products stocked in that country's warehouse
  out.push({ json: { keyword: k, warehouse: w, query, token: plan.token, page_size: plan.page_size, run_id: plan.run_id } });
}
return out;
