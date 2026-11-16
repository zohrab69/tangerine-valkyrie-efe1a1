// Landed cost per supplier (cheapest shipping option within 20 days; fastest first in the holiday season).
const sup = $('Supplier variant').all().map(i => i.json);
const maxDays = o => { const n = (String(o.days).match(/\d+/g) || []).map(Number); return n.length ? Math.max(...n) : 99; };
const out = $input.all().map((item, idx) => {
  const s = sup[idx]; const r = item.json || {};
  const opts = (Array.isArray(r.data) ? r.data : []).map(o => ({ name: o.logisticName || '?', usd: parseFloat(o.logisticPrice), days: String(o.logisticAging || '') })).filter(o => o.usd >= 0);
  const ok = opts.filter(o => maxDays(o) <= 20).sort((a, b) => a.usd - b.usd);
  const ship = ok[0] || opts.sort((a, b) => a.usd - b.usd)[0] || null;
  const landed_cad = +((s.cost_usd + (ship ? ship.usd : 0)) * 1.40).toFixed(2);
  return { ...s, shipping: ship, days: ship ? maxDays(ship) : null, landed_cad };
});
out.sort((a, b) => (a.shipping ? 0 : 1) - (b.shipping ? 0 : 1) || ((a.days || 99) <= 10 ? 0 : 1) - ((b.days || 99) <= 10 ? 0 : 1) || a.landed_cad - b.landed_cad);   // fast (10 days or less) first, then cheapest
return [{ json: { suppliers: out } }];
