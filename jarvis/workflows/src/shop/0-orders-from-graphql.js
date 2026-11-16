// Shopify GraphQL orders -> the simple order format used by "Format order" and "Late orders".
// New orders = not seen before (remembered in workflow data). First run: remembers existing orders silently.
const r = $input.first().json || {};
const nodes = (((r.data || {}).orders || {}).nodes) || [];
const amt = m => Number((m && m.shopMoney && m.shopMoney.amount) || 0);
const orders = nodes.map(o => ({
  id: o.id, name: o.name, created_at: o.createdAt, cancelled_at: o.cancelledAt,
  financial_status: String(o.displayFinancialStatus || '').toLowerCase(),
  fulfillment_status: /FULFILLED/.test(o.displayFulfillmentStatus || '') && o.displayFulfillmentStatus !== 'UNFULFILLED' ? (o.displayFulfillmentStatus === 'PARTIALLY_FULFILLED' ? 'partial' : 'fulfilled') : null,
  currency: o.currencyCode || 'CAD', total_price: amt(o.totalPriceSet).toFixed(2), total_tax: amt(o.totalTaxSet).toFixed(2),
  shipping_address: o.shippingAddress ? { city: o.shippingAddress.city, province_code: o.shippingAddress.provinceCode } : null,
  line_items: ((o.lineItems || {}).nodes || []).map(li => ({ title: li.title, quantity: li.quantity, sku: li.sku || '', price: amt(li.originalUnitPriceSet) })),
}));
const mode = $('Which check?').first().json.mode;
if (mode === 'late') return orders.length ? orders.map(o => ({ json: o })) : [{ json: {} }];
const store = $getWorkflowStaticData('global');
const first = !store.seenOrders;
store.seenOrders = store.seenOrders || [];
const fresh = orders.filter(o => !store.seenOrders.includes(o.id));
store.seenOrders = [...fresh.map(o => o.id), ...store.seenOrders].slice(0, 300);
if (first || !fresh.length) return [];
return fresh.reverse().map(o => ({ json: o }));
