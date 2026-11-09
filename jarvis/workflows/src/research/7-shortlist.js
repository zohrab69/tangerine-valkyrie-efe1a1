// Rank: no blocking flags first, then proven demand first, then estimated profit x demand. Top 5.
const all = $input.all().map(i => i.json);
const blocking = f => f.some(x => /no shipping|slow|above/.test(x));
const proven = p => (p.demand_score >= 20 ? 1 : 0);
all.sort((a, b) => (blocking(a.flags) - blocking(b.flags)) || (proven(b) - proven(a)) ||
                   (b.est_profit_cad * Math.log2(2 + b.demand_score) - a.est_profit_cad * Math.log2(2 + a.demand_score)));
const top = all.slice(0, 5);
const facts = top.map((p, i) => ({ n: i + 1, pid: p.pid, name: p.name, category: p.category, cost_usd: p.cost_usd,
  shipping: p.shipping, landed_cad: p.landed_cad, price_cad: p.price_cad, est_profit_cad: p.est_profit_cad,
  listed_by_stores: p.listed_by_stores, sold_count: p.sold_count, flags: p.flags }));
const instructions = 'You are the JARVIS e-commerce research analyst for a new Shopify store selling in Canada. ' +
  'For each product below write one short note (max 25 words): who would buy it and the main risk. Use ONLY the facts given; ' +
  'do not invent sales numbers, trends, reviews or prices. Reply with JSON only: {"notes":[{"n":1,"note":"..."}]}';
return [{ json: { top, instructions, ai_body: { model: 'jarvis-free', max_tokens: 900, response_format: { type: 'json_object' },
  messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(facts) }] } } }];
