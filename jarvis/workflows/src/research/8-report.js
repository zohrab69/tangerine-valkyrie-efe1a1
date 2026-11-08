// Telegram report (HTML). Works with or without the AI notes.
const s = $('Shortlist').first().json;
const plan = $('Research plan').first().json;
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let notes = {};
try {
  const r = $input.first().json || {};
  const txt = (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content || '').replace(/^\s*```(?:json)?|```\s*$/g, '');
  for (const x of (JSON.parse(txt).notes || [])) notes[x.n] = x.note;
} catch (e) { /* AI notes are optional */ }
const lines = ['<b>JARVIS product research</b> (' + esc(plan.keywords.join(', ')) + ')', ''];
s.top.forEach((p, i) => {
  lines.push(`<b>${i + 1}. ${esc(p.name)}</b>`);
  lines.push(`Supplier: CJ, SKU ${esc(p.sku || p.pid)}, ${p.listed_by_stores} stores list it`);
  lines.push(`Cost ${p.cost_usd.toFixed(2)} USD + shipping ${p.shipping ? p.shipping.usd.toFixed(2) + ' USD (' + esc(p.shipping.name) + ', ' + esc(p.shipping.days) + ' days)' : 'unknown'}`);
  lines.push(`Landed ~${p.landed_cad} CAD | suggested price ${p.price_cad} CAD | est. profit ${p.est_profit_cad} CAD (${p.margin_pct}%)`);
  if (p.flags.length) lines.push('Watch: ' + esc(p.flags.join('; ')));
  if (notes[i + 1]) lines.push('<i>' + esc(notes[i + 1]) + '</i>');
  lines.push('');
});
lines.push('All money figures are estimates from CJ quotes (USD to CAD at 1.40), before sales tax and duties. Nothing was ordered or published.');
lines.push('Next step (not automatic yet): tell JARVIS which numbers interest you. Ordering samples will always ask for your approval first.');
return [{ json: { report: lines.join('\n').slice(0, 4000), count: s.top.length } }];
