// The same product in CJ's Canada and US warehouses first (fast delivery), then all of CJ.
const p = $input.first().json;
const store = $getWorkflowStaticData('global');
if (!p.token && store.cjToken) p.token = store.cjToken.value;
return ['CA', 'US', 'CN'].map(w => {
  const query = { pageNum: 1, pageSize: 20, productNameEn: p.q, orderBy: 'listedNum' };
  if (w !== 'CN') query.countryCode = w;
  return { json: { warehouse: w, query, token: p.token } };
});
