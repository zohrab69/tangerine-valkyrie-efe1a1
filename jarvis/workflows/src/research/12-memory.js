// Two memory rows: a short summary (screen, briefing, JARVIS's answers) and the full report
// (kind research_report) so "resend the products" works without searching again.
let top = [];
try { top = $('Market verdict').first().json.top || []; } catch (e) { top = []; }
const plan = $('Research plan').first().json;
const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
const list = top.map((p, i) => `${i + 1}. ${p.name.split(/[-,|]/)[0].trim().slice(0, 60)} (CJ SKU ${p.sku || p.pid}, ${p.warehouse || 'CN'} warehouse, landed ${p.landed_cad} CAD, price ${p.price_cad} CAD, est. profit ${p.est_profit_cad} CAD, competition ${p.competition}${p.meets_target ? ', meets targets' : ''}${p.market && p.market.median_price_cad ? ', market ~' + p.market.median_price_cad + ' CAD' : ''}${p.market && p.market.trend ? ', searches ' + p.market.trend : ''}${p.market && p.market.hot ? ', HOT' : ''})`).join('; ');
const summary = `Daily product research sent to the owner's Telegram on ${day} at 10:00 or on request (themes: ${plan.keywords.join(', ')}), with photos and a voice message. ` +
  (top.length ? `Top products: ${list}. Estimates only; nothing ordered.` : 'No product passed the filters.');
let reports = [];
try { reports = $('Report').all().map(i => i.json); } catch (e) { reports = []; }
let fallback = '';
try { fallback = $('Nothing-found report').first().json.report || ''; } catch (e) { fallback = ''; }
const full = { day, keywords: plan.keywords,
  items: reports.filter(r => r.text).map(r => ({ photo: r.photo || '', caption: r.caption, text: r.text })),
  summary: reports.length ? reports[0].summary : fallback };
return [{ json: { kind: 'research', summary: summary.slice(0, 1800) } },
        { json: { kind: 'research_report', summary: JSON.stringify(full).slice(0, 20000) } }];
