// One photo message per product (caption = the facts), then a short summary message.
// Works with or without the AI notes and with or without images.
const s = $('Shortlist').first().json;
const plan = $('Research plan').first().json;
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let notes = {};
try {
  const r = $input.first().json || {};
  const txt = (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content || '').replace(/^\s*```(?:json)?|```\s*$/g, '');
  for (const x of (JSON.parse(txt).notes || [])) notes[x.n] = x.note;
} catch (e) { /* AI notes are optional */ }
const items = s.top.map((p, i) => {
  const lines = [
    `<b>${i + 1}. ${esc(p.name)}</b>`,
    `${{ healthy: '🟢', crowded: '🟠', saturated: '🔴', unproven: '⚪' }[p.competition] || ''} Competition: ${p.competition} (${p.listed_by_stores} stores on CJ` +
      (p.similar_count ? `, ${p.similar_count} similar` : '') + ')' + (p.sold_count ? ` · ${p.sold_count} sold` : ''),
    `Cost ${p.cost_usd.toFixed(2)} USD + shipping ${p.shipping ? p.shipping.usd.toFixed(2) + ' USD (' + esc(p.shipping.name) + ', ' + esc(p.shipping.days) + ' days)' : 'unknown'}`,
    `Landed ~${p.landed_cad} CAD | price ${p.price_cad} CAD | est. profit ${p.est_profit_cad} CAD (${p.margin_pct}%)`,
    `CJ SKU ${esc(p.sku || p.pid)}`,
  ];
  if (p.flags.length) lines.push('Watch: ' + esc(p.flags.join('; ')));
  if (notes[i + 1]) lines.push('<i>' + esc(notes[i + 1]) + '</i>');
  return { json: { photo: p.image || '', has_photo: !!p.image, caption: lines.join('\n').slice(0, 1000), text: lines.join('\n') } };
});
const summary = '<b>JARVIS product research</b> (' + esc(plan.keywords.join(', ')) + ')\n' +
  s.top.length + ' products above. Sorted by competition (🟢 healthy first), then estimated profit.\n' +
  '🟢 healthy = proven but not overcrowded · 🟠 crowded · 🔴 saturated · ⚪ unproven\n' +
  'All money figures are estimates from CJ quotes (USD to CAD at 1.40), before sales tax and duties. Nothing was ordered or published.\n' +
  'Next step (not automatic yet): tell JARVIS which numbers interest you. Ordering samples will always ask for your approval first.';
return items.map((it, i) => ({ json: { ...it.json, summary, index: i } }));
