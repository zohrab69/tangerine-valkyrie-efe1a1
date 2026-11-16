// Which check runs: "new" (every 10 min: new orders) or "late" (daily 8:45: paid orders not shipped). Reuses the token if still valid.
const mode = $input.first().json.mode || 'new';
const t = $getWorkflowStaticData('global').shopToken;
const since = new Date(Date.now() - (mode === 'late' ? 30 : 3) * 864e5).toISOString().slice(0, 10);
const q = mode === 'late' ? `created_at:>=${since} financial_status:paid fulfillment_status:unshipped status:open` : `created_at:>=${since}`;
return [{ json: { mode, need_token: !(t && t.until > Date.now()), gql: { query:
  'query($q: String!) { orders(first: 50, sortKey: CREATED_AT, reverse: true, query: $q) { nodes { id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus currencyCode ' +
  'totalPriceSet { shopMoney { amount } } totalTaxSet { shopMoney { amount } } shippingAddress { city provinceCode } ' +
  'lineItems(first: 20) { nodes { title quantity sku originalUnitPriceSet { shopMoney { amount } } } } } } }', variables: { q } } } }];
