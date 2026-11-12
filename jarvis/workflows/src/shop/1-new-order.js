// New Rangéo order (Shopify webhook orders/create) -> Telegram alert + memory row.
// COSTS: supplier cost + shipping in USD per CJ SKU (from CJ). Add a line for each new product.
const COSTS = { 'CJQCNBQC00122-Black': 12.90 };
const USD_TO_CAD = 1.40, FEE_PCT = 0.029, FEE_FIXED = 0.30;
const o = $input.first().json || {};
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const items = (o.line_items || []).map(li => ({ title: li.title || li.name || '?', qty: Number(li.quantity) || 1, sku: li.sku || '', price: Number(li.price) || 0 }));
const total = Number(o.total_price ?? o.current_total_price ?? 0);
const tax = Number(o.total_tax ?? 0);
let cost = 0, unknown = [];
for (const it of items) {
  const key = Object.keys(COSTS).find(k => it.sku && (it.sku === k || it.sku.includes(k) || k.includes(it.sku)));
  if (key) cost += COSTS[key] * USD_TO_CAD * it.qty; else unknown.push(it.title);
}
const fees = total * FEE_PCT + FEE_FIXED;
const profit = unknown.length ? null : +(total - tax - cost - fees).toFixed(2);
const city = [o.shipping_address?.city, o.shipping_address?.province_code].filter(Boolean).join(', ');
const local = new Date(o.created_at || Date.now()).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
const text = [
  '🛒 <b>New Rangéo order ' + esc(o.name || ('#' + (o.order_number || ''))) + '</b>',
  ...items.map(it => '• ' + it.qty + ' × ' + esc(it.title)),
  'Total: ' + total.toFixed(2) + ' ' + esc(o.currency || 'CAD') + (tax ? ' (tax ' + tax.toFixed(2) + ')' : ''),
  profit !== null ? 'Est. profit: ~' + profit + ' CAD (before ads)' : 'Est. profit: unknown (add the cost of ' + esc(unknown.join(', ')) + ' to COSTS)',
  city ? 'Ship to: ' + esc(city) : '',
  'Payment: ' + esc(o.financial_status || '?') + ' · ' + esc(local),
  'CJ will pay and ship it automatically at the next time point (9:00 / 17:00).',
].filter(Boolean).join('\n');
const summary = `New Rangéo order ${o.name || ''} (${local}): ${items.map(i => i.qty + 'x ' + i.title).join(', ')}; total ${total.toFixed(2)} ${o.currency || 'CAD'}` + (profit !== null ? `; est. profit ~${profit} CAD` : '');
return [{ json: { text, kind: 'order', summary: summary.slice(0, 1500) } }];
