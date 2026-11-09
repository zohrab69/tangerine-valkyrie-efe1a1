// Sample order plan + approval text. Nothing is bought here: approval only unlocks the next step.
const q = $('Pick variant').first().json;
const r = $input.first().json || {};
const opts = (Array.isArray(r.data) ? r.data : []).map(o => ({ name: o.logisticName || '?', usd: parseFloat(o.logisticPrice), days: String(o.logisticAging || '') }))
  .filter(o => o.usd >= 0);
const maxDays = o => { const n = (o.days.match(/\d+/g) || []).map(Number); return n.length ? Math.max(...n) : 99; };
const ship = opts.filter(o => maxDays(o) <= 20).sort((a, b) => a.usd - b.usd)[0] || opts.sort((a, b) => a.usd - b.usd)[0] || null;
const USD_TO_CAD = 1.40;
const problem = q.problem || (!ship ? 'CJ gave no shipping option to Canada for this variant' : null);
const goods = q.unit_usd ? q.unit_usd * q.qty : 0;
const total_usd = +(goods + (ship ? ship.usd : 0)).toFixed(2);
const total_cad = +(total_usd * USD_TO_CAD).toFixed(2);
const md = t => String(t ?? '').replace(/([_*`\[])/g, '\\$1');   // Telegram legacy Markdown (approval message)
const approval_text = problem ? '' : [
  '*JARVIS: sample order needs your approval*',
  'Product: ' + md(q.cj_name),
  'Variant: ' + md(q.variant || 'default') + ' (SKU ' + md(q.variant_sku || q.sku) + ')',
  'Quantity: ' + q.qty,
  'Price: ' + md(q.unit_usd.toFixed(2)) + ' USD each',
  'Shipping to Canada: ' + md(ship.usd.toFixed(2)) + ' USD, ' + md(ship.name) + ', ' + md(ship.days) + ' days',
  '*Estimated total: ' + total_usd + ' USD (about ' + total_cad + ' CAD)*, before tax and duties',
  'Approving does not charge anything by itself: you pay at CJ checkout.',
].join('\n');
return [{ json: { ...q, ship, total_usd, total_cad, problem, approval_text } }];
