// Market check (SerpApi: Google Shopping Canada prices + Google Trends Canada, last 3 months).
// Fresh results come from the two SerpApi nodes; others from the 10-day cache (see Market check items).
// Pass = market price >= 2x our landed cost and searches not falling. 🔥 = rising + 2.5x gap + owner targets.
// Final list (max 5): passed first (🔥 first, then CA/US warehouse), then "market not checked yet"
// (saving free searches) - products that failed the market check are dropped.
const store = $getWorkflowStaticData('global');
const s = $('Shortlist').first().json;
const metaItem = $('Market check items').first().json;
const meta = metaItem.meta;
let freshItems = [], shop = [], trends = [];
if (!metaItem.none) {
  freshItems = $('Market check items').all().map(i => i.json);
  try { shop = $('Google Shopping (Canada)').all().map(i => i.json || {}); } catch (e) { shop = []; }
  try { trends = $('Google Trends (Canada)').all().map(i => i.json || {}); } catch (e) { trends = []; }
}
const USD_TO_CAD = 1.40;
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
const errText = e => String((e && (e.message || e.description)) || (typeof e === 'string' ? e : JSON.stringify(e))).slice(0, 100);
function analyse(sh, tr) {
  const results = sh.shopping_results || [];
  const prices = results.map(r => Number(r.extracted_price)).filter(x => x > 0 && x < 1000);
  const amazon = results.filter(r => /amazon/i.test(r.source || '')).map(r => Number(r.extracted_price)).filter(x => x > 0);
  const tl = ((tr.interest_over_time || {}).timeline_data || []).map(t => Number(((t.values || [])[0] || {}).extracted_value) || 0);
  let trend = null, trend_pct = null;
  if (tl.length >= 8) {
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const first = avg(tl.slice(0, 4)), last = avg(tl.slice(-4));
    trend_pct = first > 0 ? Math.round((last - first) / first * 100) : (last > 0 ? 100 : 0);
    trend = trend_pct >= 20 ? 'rising' : trend_pct <= -20 ? 'falling' : 'flat';
  }
  return { median_price_cad: prices.length >= 3 ? +median(prices).toFixed(2) : null, offers: prices.length,
           amazon_median_cad: amazon.length ? +median(amazon).toFixed(2) : null, amazon_offers: amazon.length,
           top_sources: [...new Set(results.map(r => r.source).filter(Boolean))].slice(0, 5), trend, trend_pct,
           error: sh.error || tr.error ? errText(sh.error || tr.error) : null };
}
// Store fresh results in the cache and count the searches used.
let usedNow = 0;
freshItems.forEach((f, k) => {
  const sh = shop[k] || {}, tr = trends[k] || {};
  if (shop[k]) usedNow++;
  if (trends[k]) usedNow++;
  const a = analyse(sh, tr);
  if (!a.error && (a.median_price_cad !== null || a.trend !== null)) store.serpCache[f.q.toLowerCase()] = { at: Date.now(), ...a };
  f.result = a;
});
if (store.serp && store.serp.month === meta.month) {
  store.serp.used += usedNow;
  store.serp.days[meta.today] = (store.serp.days[meta.today] || 0) + usedNow;
}
let checked = 0;
const enriched = s.top.map((p, i) => {
  const pl = meta.plan.find(x => x.i === i) || { q: '', source: 'no_key' };
  let a = null;
  if (pl.source === 'fresh') a = (freshItems.find(f => f.i === i) || {}).result || null;
  if (pl.source === 'same') a = (freshItems.find(f => f.q.toLowerCase() === pl.q.toLowerCase()) || {}).result || null;
  if (pl.source === 'cache') a = store.serpCache[pl.q.toLowerCase()] || null;
  if (!a || (a.median_price_cad === null && a.trend === null)) {
    return { ...p, market: { query: pl.q, checked: false, why: pl.source === 'budget' ? 'saving free searches' : pl.source === 'no_key' ? 'no SerpApi key' : (a && a.error) || 'no market data',
                             median_price_cad: null, ratio: null, trend: null, hot: false, pass: false } };
  }
  checked++;
  const ratio = a.median_price_cad ? +(a.median_price_cad / p.landed_cad).toFixed(1) : null;
  const hot = ratio !== null && ratio >= 2.5 && a.trend === 'rising' && p.meets_target;
  const pass = ratio !== null && ratio >= 2 && a.trend !== 'falling';
  return { ...p, market: { query: pl.q, checked: true, cached: pl.source === 'cache', ...a, ratio, hot, pass } };
});
const passed = enriched.filter(p => p.market.checked && p.market.pass)
  .sort((a, b) => Number(b.market.hot) - Number(a.market.hot));   // otherwise keep the shortlist ranking
const unchecked = enriched.filter(p => !p.market.checked);
const failed = enriched.filter(p => p.market.checked && !p.market.pass);
const kept = [...passed, ...unchecked].slice(0, 5);
const marketOk = meta.has_key && checked > 0;
const facts = kept.map((p, n) => ({ n: n + 1, name: p.name, landed_cad: p.landed_cad, price_cad: p.price_cad, est_profit_cad: p.est_profit_cad,
  warehouse: p.warehouse, market_median_price_cad: p.market.median_price_cad, price_gap: p.market.ratio, search_trend: p.market.trend, competition: p.competition, flags: p.flags }));
const instructions = 'You are the JARVIS e-commerce research analyst for a new Shopify store selling in Canada. ' +
  'For each product write one short note (max 25 words): who would buy it, whether the market price leaves room, and the main risk. Use ONLY the facts given; ' +
  'do not invent sales numbers, trends, reviews or prices. Reply with JSON only: {"notes":[{"n":1,"note":"..."}]}';
return [{ json: { ...s, top: kept, all_checked: enriched, market_ok: marketOk, dropped: failed.length, unchecked: kept.filter(p => !p.market.checked).length,
  serp: { has_key: meta.has_key, used_now: usedNow, left: meta.left_before - usedNow, warning: meta.warning, key_error: meta.key_error },
  ai_body: { model: 'jarvis-free', max_tokens: 900, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(facts) }] } } }];
