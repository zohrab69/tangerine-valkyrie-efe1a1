// Rank: no blocking flags first, then competition band (healthy > crowded > unproven > saturated), then profit x demand. Top 5.
const all = $input.all().map(i => i.json);
const blocking = f => f.some(x => /no shipping|slow|above/.test(x));
const BAND = { healthy: 0, crowded: 1, unproven: 2, saturated: 3 };
all.sort((a, b) => (blocking(a.flags) - blocking(b.flags)) || (BAND[a.competition] - BAND[b.competition]) ||
                   (b.est_profit_cad * Math.log2(2 + b.demand_score) - a.est_profit_cad * Math.log2(2 + a.demand_score)));
const top = all.slice(0, 5);
const facts = top.map((p, i) => ({ n: i + 1, pid: p.pid, name: p.name, category: p.category, cost_usd: p.cost_usd,
  shipping: p.shipping, landed_cad: p.landed_cad, price_cad: p.price_cad, est_profit_cad: p.est_profit_cad,
  listed_by_stores: p.listed_by_stores, competition: p.competition, similar_count: p.similar_count, sold_count: p.sold_count, flags: p.flags }));
const instructions = 'You are the JARVIS e-commerce research analyst for a new Shopify store selling in Canada. ' +
  'For each product below write one short note (max 25 words): who would buy it and the main risk. Use ONLY the facts given; ' +
  'do not invent sales numbers, trends, reviews or prices. Reply with JSON only: {"notes":[{"n":1,"note":"..."}]}';
return [{ json: { top, instructions, ai_body: { model: 'jarvis-free', max_tokens: 900, response_format: { type: 'json_object' },
  messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(facts) }] } } }];
