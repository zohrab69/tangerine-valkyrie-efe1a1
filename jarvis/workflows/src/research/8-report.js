// One photo message per product (caption = the facts), then a short summary message.
// Works with or without the AI notes and with or without images.
const s = $('Market verdict').first().json;
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
    p.market && p.market.checked ? `${p.market.hot ? '🔥 ' : ''}Market${p.market.cached ? ' (saved check)' : ''}: ` +
      (p.market.median_price_cad ? `others sell at ~${p.market.median_price_cad} CAD (${p.market.ratio}× your cost)` : 'price n/a') +
      (p.market.amazon_median_cad ? `, Amazon.ca ~${p.market.amazon_median_cad} CAD` : '') +
      (p.market.trend ? `, Google searches ${p.market.trend} (${p.market.trend_pct > 0 ? '+' : ''}${p.market.trend_pct}% in 3 months)` : '')
      : 'Market: not checked yet' + (p.market && p.market.why ? ' (' + esc(p.market.why) + ')' : ''),
    `${p.local_warehouse ? '🚚 ' + esc(p.warehouse) + ' warehouse' : '📦 ships from China'} · CJ SKU ${esc(p.sku || p.pid)}`,
    p.meets_target ? '🎯 Meets your targets (10+ CAD profit, 10 days or less)' : '✖️ Misses target: ' + esc((p.target_misses || []).join(', ')),
  ];
  if (p.flags.length) lines.push('Watch: ' + esc(p.flags.join('; ')));
  if (notes[i + 1]) lines.push('<i>' + esc(notes[i + 1]) + '</i>');
  return { json: { photo: p.image || '', has_photo: !!p.image, caption: lines.join('\n').slice(0, 1000), text: lines.join('\n') } };
});
const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto', weekday: 'long', month: 'long', day: 'numeric' });
const sp = s.serp || {};
const summary = `<b>JARVIS daily products</b> · ${esc(day)} (${esc(plan.keywords.join(', '))})\n` +
  (s.top.length ? s.top.length + ' products above, best first. ' : 'No product passed today.\n') +
  (sp.has_key ? (s.dropped ? s.dropped + ' removed by the market check (market price too low or searches falling). ' : '') +
      (s.unchecked ? s.unchecked + ' not market-checked yet (saving free searches, or no market data). ' : '') + `SerpApi: ${sp.left} free searches left this month.\n`
    : 'Market check off: SerpApi key missing or not working' + (sp.key_error ? ' (' + esc(sp.key_error) + ')' : '') + '.\n') +
  (sp.warning ? esc(sp.warning) + '\n' : '') +
  '🔥 searches rising + others sell at 2.5x+ your cost · 🎯 10+ CAD profit and 10 days or less · 🚚 US/Canada warehouse (fast for Black Friday and Christmas)\n' +
  '🟢 healthy · 🟠 crowded · 🔴 saturated · ⚪ unproven · ⚠️ may need a certification\n' +
  'Estimates from CJ quotes (USD to CAD at 1.40), before sales tax and duties. Nothing was ordered or published.\n' +
  'To check your own idea, send me a link, a photo or a name. Say "resend the products" any time.';
if (!items.length) return [{ json: { photo: '', has_photo: false, caption: '', text: '', summary, index: 0 } }];   // nothing passed: summary only
return items.map((it, i) => ({ json: { ...it.json, summary, index: i } }));
