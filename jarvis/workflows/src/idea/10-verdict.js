// Verdict and numbers for the owner's product idea (no AI): market, best supplier, price, fees, profit,
// marketing estimate, Amazon FBA stock estimate, risks. Then asks the free AI for an original listing and 3 video scripts.
const p = $('Product identity').first().json;
const costs = $('Supplier costs').first().json;
const plan = $('Market plan').first().json;
const store = $getWorkflowStaticData('global');
store.serpCache = store.serpCache || {};
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
let m = null;
if (plan.source === 'cache') m = store.serpCache[plan.q.toLowerCase()];
if (plan.source === 'fresh') {
  let sh = {}, tr = {};
  try { sh = $('Google Shopping (Canada)').first().json || {}; } catch (e) {}
  try { tr = $('Google Trends (Canada)').first().json || {}; } catch (e) {}
  const res = sh.shopping_results || [];
  const prices = res.map(r => Number(r.extracted_price)).filter(x => x > 0 && x < 2000);
  const amazon = res.filter(r => /amazon/i.test(r.source || '')).map(r => Number(r.extracted_price)).filter(x => x > 0);
  const others = res.filter(r => r.source && !/amazon|walmart|ebay|aliexpress|temu/i.test(r.source)).slice(0, 4).map(r => ({ source: r.source, price: Number(r.extracted_price) }));
  const tl = ((tr.interest_over_time || {}).timeline_data || []).map(t => Number(((t.values || [])[0] || {}).extracted_value) || 0);
  let trend = null, trend_pct = null;
  if (tl.length >= 8) { const avg = a => a.reduce((x, y) => x + y, 0) / a.length; const f = avg(tl.slice(0, 4)), l = avg(tl.slice(-4));
    trend_pct = f > 0 ? Math.round((l - f) / f * 100) : (l > 0 ? 100 : 0); trend = trend_pct >= 20 ? 'rising' : trend_pct <= -20 ? 'falling' : 'flat'; }
  m = { at: Date.now(), median_price_cad: prices.length >= 3 ? +median(prices).toFixed(2) : null, offers: prices.length,
        amazon_median_cad: amazon.length ? +median(amazon).toFixed(2) : null, amazon_offers: amazon.length, others, trend, trend_pct,
        error: sh.error || tr.error ? String(sh.error || tr.error).slice(0, 100) : null };
  if (!m.error && (m.median_price_cad !== null || m.trend !== null)) store.serpCache[plan.q.toLowerCase()] = m;
}
const sup = costs.suppliers || [];
const best = sup[0] || null;
const R = x => Math.round(x * 100) / 100;
let price = null, fees = 0, profit = null, profit_ads = null, market_too_low = false, price_needed = null;
if (best) {
  const L = best.landed_cad;
  const floor = Math.max(L * 2, L + 12);
  if (m && m.median_price_cad && floor > m.median_price_cad * 1.05) {
    // Market too low: we would have to charge more than others do. Show the honest profit at the market price.
    market_too_low = true;
    price_needed = Math.ceil(floor) - 0.01;
    price = Math.max(0.99, Math.ceil(m.median_price_cad) - 0.01);
  } else {
    price = m && m.median_price_cad ? Math.max(floor, Math.min(m.median_price_cad * 0.95, L * 3.5)) : Math.max(L * 2.5, L + 12);
    price = Math.ceil(price) - 0.01;
  }
  fees = price * 0.029 + 0.30;
  profit = R(price - L - fees - price * 0.05);
  profit_ads = R(profit - price * 0.20);
}
const ratio = best && m && m.median_price_cad ? +(m.median_price_cad / best.landed_cad).toFixed(1) : null;
// Marketing: our video team is free (Kokoro voice + product photos); a small paid ad test only with approval.
const ad_test_cad = 50;
const breakeven_sales = profit > 0 ? Math.ceil(ad_test_cad / profit) : null;
// Amazon FBA (rough, verify with Amazon's FBA revenue calculator): 50 units, air freight to an Amazon warehouse ~ 9 USD/kg,
// referral fee 15%, FBA fee ~ 5.50 CAD for a small standard item.
let fba = null;
if (best) {
  const units = 50, kg = (best.weight_g || 300) / 1000;
  const stock = units * best.cost_usd * 1.40, freight = units * Math.max(1.5, kg * 9) * 1.40;
  const amzPrice = m && m.amazon_median_cad ? m.amazon_median_cad : price;
  const perUnitFees = amzPrice * 0.15 + 5.50;
  fba = { units, stock_cad: R(stock), freight_cad: R(freight), total_cad: R(stock + freight), amazon_price_cad: R(amzPrice),
          fees_per_unit_cad: R(perUnitFees), profit_per_unit_cad: R(amzPrice - perUnitFees - (stock + freight) / units) };
}
const risks = [];
if (p.excluded) risks.push('Not allowed by your rules: ' + p.excluded);
(p.certification || []).concat(best ? best.certification || [] : []).filter((x, i, a) => a.indexOf(x) === i).forEach(c => risks.push('Certification: ' + c));
if (!best) risks.push('No matching product found on CJ');
if (best && best.competition === 'saturated') risks.push(best.listed_by_stores + ' stores already sell it on CJ (saturated)');
if (best && best.competition === 'unproven') risks.push('Few stores sell it yet (unproven)');
if (best && (best.days || 99) > 10) risks.push('Delivery over 10 days (' + (best.shipping ? best.shipping.days : '?') + ')');
if (m && m.trend === 'falling') risks.push('Google searches in Canada are falling');
if (!m || (m.median_price_cad === null && m.trend === null)) risks.push('No market data (SerpApi)');
if (ratio !== null && ratio < 2) risks.push('Market price is only ' + ratio + 'x our cost: thin room');
if (market_too_low) risks.push(`Not profitable at the market price: others sell at ~${m.median_price_cad} CAD; we would need ${price_needed} CAD to earn 10+ CAD`);
let verdict = 'MAYBE';
if (p.excluded || !best || market_too_low || (ratio !== null && ratio < 1.6) || (profit !== null && profit < 5)) verdict = 'NO';
else if (ratio !== null && ratio >= 2 && m.trend !== 'falling' && profit >= 10 && (best.days || 99) <= 10 && !risks.some(r => r.startsWith('Certification'))) verdict = 'GOOD';   // certification to check first = MAYBE
const sys = 'IDEA_LISTING. You write for Rangéo, a Canadian online store (Quebec): French first, then English. Original wording only (never copy the supplier text), ' +
  'no health or safety claims, no brand names, no fake reviews or fake scarcity. Describe exactly the item in supplier_title (that is what the customer receives), not a different product. Reply with JSON only: {"title_fr": "max 70 chars", "title_en": "max 70 chars", ' +
  '"description_html": "<p>French paragraph</p><ul><li>3 French benefit bullets</li></ul><p>English paragraph</p><ul><li>3 English bullets</li></ul>", ' +
  '"tags": ["5 lowercase tags"], "product_type": "one or two words", ' +
  '"videos": [{"hook": "first 2 seconds, max 8 words", "lines": ["3 short voice-over lines, max 12 words each"], "caption": "post caption, max 150 chars", "hashtags": ["5 hashtags"]}] ' +
  '(exactly 3 videos with DIFFERENT hooks: a problem hook, a surprise/demo hook, a gift hook for Christmas). English for the videos.}';
const facts = { product: p.name, supplier_title: best ? best.name : null, price_cad: price, warehouse: best ? best.warehouse : null, delivery_days: best ? best.shipping && best.shipping.days : null };
return [{ json: { id: p.id, name: p.name, q: p.q, kind: p.kind, url: p.url, page: p.page, verdict, risks, suppliers: sup, best, market: m, market_source: plan.source,
  serp_warning: plan.warning, ratio, price_cad: price, market_too_low, price_needed, fees_cad: R(fees), profit_cad: profit, profit_with_ads_cad: profit_ads,
  marketing: { videos_cad: 0, ad_test_cad, breakeven_sales }, fba, can_list: !!best && !p.excluded,   // the owner decides even on a weak verdict
  ai_body: { model: 'jarvis-free', max_tokens: 1400, temperature: 0.6, response_format: { type: 'json_object' },
             messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(facts) }] } } }];
