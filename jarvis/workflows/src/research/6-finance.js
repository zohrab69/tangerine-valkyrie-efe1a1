// Finance 1 (pure arithmetic, no AI). Every number is an ESTIMATE from CJ's quoted prices.
const F = {
  usd_to_cad: 1.40,          // check the current rate before relying on results
  markup: 2.5,               // suggested retail = landed cost x markup, then rounded to .99
  min_profit_cad: 12,        // or at least this much above landed cost
  max_retail_cad: 60,        // owner's price ceiling
  payment_pct: 0.029, payment_fixed_cad: 0.30,   // card processing (verify on your Shopify plan)
  returns_pct: 0.05,         // allowance for refunds/returns
  marketing_pct: 0.20,       // allowance for ads/promotion per sale
  max_days: 20,              // longest acceptable delivery estimate to Canada
};
const prods = $('Pick variant').all().map(i => i.json);
const out = [];
$input.all().forEach((item, idx) => {
  const p = prods[idx]; const r = item.json || {};
  const opts = (Array.isArray(r.data) ? r.data : []).map(o => ({
    name: o.logisticName || o.name || '?', usd: parseFloat(o.logisticPrice ?? o.price), days: String(o.logisticAging || o.aging || '')
  })).filter(o => o.usd >= 0);
  const maxDays = o => { const n = (o.days.match(/\d+/g) || []).map(Number); return n.length ? Math.max(...n) : 99; };
  const ok = opts.filter(o => maxDays(o) <= F.max_days).sort((a, b) => a.usd - b.usd);
  const ship = ok[0] || opts.sort((a, b) => a.usd - b.usd)[0] || null;
  const landed_usd = p.cost_usd + (ship ? ship.usd : 0);
  const landed = +(landed_usd * F.usd_to_cad).toFixed(2);
  let price = Math.max(landed * F.markup, landed + F.min_profit_cad);
  price = Math.ceil(price) - 0.01;
  const fees = price * F.payment_pct + F.payment_fixed_cad;
  const profit = +(price - landed - fees - price * F.returns_pct - price * F.marketing_pct).toFixed(2);
  const flags = [];
  if (!p.vid) flags.push('no variant data');
  if (!ship) flags.push('no shipping quote to Canada');
  else if (maxDays(ship) > F.max_days) flags.push('slow delivery (' + ship.days + ' days)');
  if (price > F.max_retail_cad) flags.push('price above ' + F.max_retail_cad + ' CAD');
  if (profit < 8) flags.push('thin profit');
  out.push({ json: { ...p, shipping: ship, landed_cad: landed, price_cad: +price.toFixed(2),
                     est_profit_cad: profit, margin_pct: Math.round(profit / price * 100), flags,
                     estimate_note: 'Estimates from CJ quotes; excludes sales tax, duties and samples.' } });
});
return out;
