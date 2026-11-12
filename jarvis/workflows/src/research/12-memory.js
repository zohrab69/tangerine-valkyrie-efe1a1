// One memory row so the rest of JARVIS (screen, Telegram) knows what the research report contained.
let top = [];
try { top = $('Market verdict').first().json.top || []; } catch (e) { top = []; }
const plan = $('Research plan').first().json;
const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const list = top.map((p, i) => `${i + 1}. ${p.name.split(/[-,|]/)[0].trim().slice(0, 60)} (CJ SKU ${p.sku || p.pid}, est. profit ${p.est_profit_cad} CAD, ${p.listed_by_stores} stores, competition ${p.competition}${p.meets_target ? ', meets targets' : ''}${p.market && p.market.median_price_cad ? ', market ~' + p.market.median_price_cad + ' CAD' : ''}${p.market && p.market.trend ? ', searches ' + p.market.trend : ''}${p.market && p.market.hot ? ', HOT' : ''})`).join('; ');
const summary = `Product research report sent to the owner's Telegram on ${day} (themes: ${plan.keywords.join(', ')}), with photos and a voice message. ` +
  (top.length ? `Products: ${list}. Estimates only; nothing ordered.` : 'No product passed the filters.');
return [{ json: { kind: 'research', summary: summary.slice(0, 1500) } }];
