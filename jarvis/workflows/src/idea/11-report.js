// The full report for Telegram (HTML) + the approval text + the listing draft kept for after the approval.
const v = $('Verdict').first().json;
const ai = $input.first().json || {};
let L = {};
try { L = JSON.parse(String(ai.choices[0].message.content || '').replace(/^\s*```(?:json)?|```\s*$/g, '')); } catch (e) { L = {}; }
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b = v.best, m = v.market || {};
const icon = { GOOD: '✅ GOOD', MAYBE: '🟡 MAYBE', NO: '⛔ NOT RECOMMENDED' }[v.verdict];
const lines = [`<b>Product check: ${esc(v.name)}</b>`, `Verdict: <b>${icon}</b>`];
if (m && (m.median_price_cad || m.trend)) {
  lines.push('', '<b>Market (Canada)</b>' + (v.market_source === 'cache' ? ' · saved check' : ''));
  if (m.trend) lines.push(`Google searches: ${m.trend} (${m.trend_pct > 0 ? '+' : ''}${m.trend_pct}% in 3 months)`);
  if (m.median_price_cad) lines.push(`Others sell at ~${m.median_price_cad} CAD (${m.offers} offers)` + (v.ratio ? `, ${v.ratio}× our cost` : ''));
  lines.push('Amazon.ca: ' + (m.amazon_median_cad ? `~${m.amazon_median_cad} CAD (${m.amazon_offers} offer${m.amazon_offers > 1 ? 's' : ''} in Google Shopping)` : 'not seen in Google Shopping'));
  if (m.others && m.others.length) lines.push('Other stores: ' + m.others.map(o => `${esc(o.source)} ${o.price} CAD`).join(', '));
} else lines.push('', 'Market: no data' + (v.serp_warning ? ' (' + esc(v.serp_warning) + ')' : ''));
lines.push('TikTok Shop: no official data available (JARVIS does not scrape TikTok).');
if (v.suppliers.length) {
  lines.push('', '<b>Best suppliers (CJ)</b>');
  v.suppliers.forEach((s, i) => lines.push(`${i + 1}. ${esc(s.name.slice(0, 70))} · ${s.warehouse === 'CN' ? '📦 China' : '🚚 ' + s.warehouse} · ${s.cost_usd.toFixed(2)} USD + ship ` +
    (s.shipping ? `${s.shipping.usd.toFixed(2)} USD (${esc(s.shipping.days)} days)` : 'unknown') + ` = ${s.landed_cad} CAD · ${s.listed_by_stores} stores · SKU ${esc(s.sku)}`));
}
if (b) {
  lines.push('', '<b>Money (best supplier, estimates)</b>',
    `Supplier ${b.cost_usd.toFixed(2)} USD + shipping ${b.shipping ? b.shipping.usd.toFixed(2) : '?'} USD = landed ${b.landed_cad} CAD`,
    `Suggested price: <b>${v.price_cad} CAD</b> (shipping included)`,
    `Fees: payment ${v.fees_cad} CAD + 5% returns allowance`,
    `Profit per sale: <b>${v.profit_cad} CAD</b> (${v.profit_with_ads_cad} CAD if 20% goes to ads)`,
    `Marketing: 3 videos by JARVIS = 0 CAD · small ad test ${v.marketing.ad_test_cad} CAD (5 days × 10 CAD, only if you approve)` + (v.marketing.breakeven_sales ? ` · pays back after ${v.marketing.breakeven_sales} sales` : ''));
  if (v.fba) lines.push(`Amazon FBA (rough): ${v.fba.units} units = ${v.fba.stock_cad} CAD stock + ~${v.fba.freight_cad} CAD freight = <b>${v.fba.total_cad} CAD up front</b>; at ${v.fba.amazon_price_cad} CAD Amazon fees ~${v.fba.fees_per_unit_cad} CAD/unit, profit ~${v.fba.profit_per_unit_cad} CAD/unit. Waits for your seller account.`);
}
lines.push('', '<b>Risks</b>', v.risks.length ? v.risks.map(r => '• ' + esc(r)).join('\n') : '• none found');
if (L.title_fr || L.title_en) lines.push('', `<b>Listing draft</b>: ${esc(L.title_fr || '')}${L.title_en ? ' / ' + esc(L.title_en) : ''}`);
lines.push('', v.can_list ? 'Tap Approve below to list it on Rangéo (Shopify) at ' + v.price_cad + ' CAD. The video team then makes 3 short videos.' : 'Not offered for listing (see risks).');
const report = lines.join('\n').slice(0, 4000);
const mdEsc = t => String(t ?? '').replace(/([_*`\[])/g, '\\$1');
const approval_text = `*List on Rangéo?* ${mdEsc(L.title_fr || v.name)}\nPrice ${mdEsc(v.price_cad)} CAD, profit ~${mdEsc(v.profit_cad)} CAD per sale, verdict ${v.verdict}.\nApprove = I create the product on Shopify (active, with photos) and send you the live link. Decline = nothing happens.`;
const day = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
const summary = `Product idea check (${day}): ${v.name} - verdict ${v.verdict}` + (b ? `, best supplier CJ SKU ${b.sku} (${b.warehouse} warehouse), landed ${b.landed_cad} CAD, suggested price ${v.price_cad} CAD, profit ~${v.profit_cad} CAD` : ', no supplier found') +
  (m && m.median_price_cad ? `, market ~${m.median_price_cad} CAD` : '') + (m && m.trend ? `, searches ${m.trend}` : '') + '. Report sent on Telegram' + (v.can_list ? ' with Approve/Decline.' : '.');
const photo = (b && b.image) || (v.page && v.page.image) || '';
return [{ json: { ...v, listing: { title_fr: String(L.title_fr || v.name).slice(0, 120), title_en: String(L.title_en || '').slice(0, 120),
  description_html: String(L.description_html || '<p>' + esc(v.name) + '</p>').slice(0, 6000), tags: Array.isArray(L.tags) ? L.tags.slice(0, 8).map(String) : [],
  product_type: String(L.product_type || '').slice(0, 60), videos: Array.isArray(L.videos) ? L.videos.slice(0, 3) : [] },
  report, approval_text, photo, has_photo: !!photo, caption: `<b>${esc(v.name)}</b> · ${icon}`, kind: 'idea', summary: summary.slice(0, 1500) } }];
