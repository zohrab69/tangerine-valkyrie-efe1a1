// Market check (SerpApi: Google Shopping Canada prices + Google Trends Canada, last 3 months).
// Keeps only products people already pay well for (market price >= 2x our landed cost) and whose
// search interest is not falling. 🔥 = rising + price gap >= 2.5x + owner targets met.
const s = $('Shortlist').first().json;
const items = $('Market check items').all().map(i => i.json);
const shop = $('Google Shopping (Canada)').all().map(i => i.json || {});
const trends = $('Google Trends (Canada)').all().map(i => i.json || {});
const USD_TO_CAD = 1.40;
const median = a => { const b = [...a].sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
let checked = 0;
const enriched = s.top.map((p, i) => {
  const sh = shop[i] || {}, tr = trends[i] || {};
  const prices = (sh.shopping_results || []).map(r => Number(r.extracted_price)).filter(x => x > 0 && x < 1000);
  const mp = prices.length >= 3 ? +median(prices).toFixed(2) : null;
  const tl = ((tr.interest_over_time || {}).timeline_data || []).map(t => Number(((t.values || [])[0] || {}).extracted_value) || 0);
  let trend = null, trend_pct = null;
  if (tl.length >= 8) {
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const first = avg(tl.slice(0, 4)), last = avg(tl.slice(-4));
    trend_pct = first > 0 ? Math.round((last - first) / first * 100) : (last > 0 ? 100 : 0);
    trend = trend_pct >= 20 ? 'rising' : trend_pct <= -20 ? 'falling' : 'flat';
  }
  if (mp !== null || trend !== null) checked++;
  const ratio = mp ? +(mp / p.landed_cad).toFixed(1) : null;
  const hot = ratio !== null && ratio >= 2.5 && trend === 'rising' && p.meets_target;
  const pass = ratio !== null && ratio >= 2 && trend !== 'falling';   // no market data = not proven, not sent
  return { ...p, market: { query: items[i] ? items[i].q : '', median_price_cad: mp, offers: prices.length, ratio, trend, trend_pct, hot, pass,
    note: sh.error || tr.error ? 'market data error: ' + String(sh.error || tr.error).slice(0, 100) : null } };
});
const marketOk = checked > 0;
let kept = marketOk ? enriched.filter(p => p.market.pass) : enriched;
kept.sort((a, b) => Number(b.market.hot) - Number(a.market.hot));
const facts = kept.map((p, n) => ({ n: n + 1, name: p.name, landed_cad: p.landed_cad, price_cad: p.price_cad, est_profit_cad: p.est_profit_cad,
  market_median_price_cad: p.market.median_price_cad, price_gap: p.market.ratio, search_trend: p.market.trend, competition: p.competition, flags: p.flags }));
const instructions = 'You are the JARVIS e-commerce research analyst for a new Shopify store selling in Canada. ' +
  'For each product write one short note (max 25 words): who would buy it, whether the market price leaves room, and the main risk. Use ONLY the facts given; ' +
  'do not invent sales numbers, trends, reviews or prices. Reply with JSON only: {"notes":[{"n":1,"note":"..."}]}';
return [{ json: { ...s, top: kept, all_checked: enriched, market_ok: marketOk, dropped: enriched.length - kept.length,
  ai_body: { model: 'jarvis-free', max_tokens: 900, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(facts) }] } } }];
