// Tool for the agent: price and profit math (same rules as research "Finance").
const q = typeof query === 'string' ? JSON.parse(query || '{}') : (query || {});
const usdToCad = 1.40;
const cost = Number(q.cost_usd || 0), ship = Number(q.shipping_usd || 0);
const landed = (cost + ship) * usdToCad;
let price = Number(q.price_cad || 0);
if (!(price > 0)) price = Math.ceil(Math.max(landed * 2.5, landed + 12)) - 0.01;
const fees = price * 0.029 + 0.30, returns = price * 0.05;
const ads = q.include_ads === false ? 0 : price * 0.20;
const profit = price - landed - fees - returns - ads;
return JSON.stringify({ landed_cad: +landed.toFixed(2), price_cad: +price.toFixed(2), payment_fees_cad: +fees.toFixed(2), returns_allowance_cad: +returns.toFixed(2),
  marketing_allowance_cad: +ads.toFixed(2), profit_cad: +profit.toFixed(2), margin_pct: Math.round(profit / price * 100),
  note: 'Estimate. USD to CAD 1.40; Shopify Payments ~2.9% + 0.30; 5% returns; 20% marketing allowance unless include_ads=false.' });
