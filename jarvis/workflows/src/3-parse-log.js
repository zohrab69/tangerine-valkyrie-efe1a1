// Parse the OpenAI Responses API result, compute ACTUAL cost from usage, update ledger.
const task = $('Router + budget guard').first().json;
const res = $input.first().json;

let text = res.output_text || '';
if (!text && Array.isArray(res.output)) {
  for (const item of res.output) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) if (c.type === 'output_text') text += c.text;
    }
  }
}
let decision = null, parse_error = null;
try { decision = JSON.parse(text); } catch (e) { parse_error = 'Model did not return valid JSON: ' + e.message; }

const u = res.usage || {};
const inTok = u.input_tokens || 0, outTok = u.output_tokens || 0;
const r = task.route;
const costCad = +(((inTok * r.price_in_per_m_usd + outTok * r.price_out_per_m_usd) / 1e6) * r.usd_to_cad).toFixed(6);

const store = $getWorkflowStaticData('global');
if (store.ledger) { store.ledger.day_cad += costCad; store.ledger.month_cad += costCad; }

return [{
  json: {
    task_id: task.task_id,
    agent: task.agent,
    model: res.model || r.model,
    tier: r.tier,
    status: res.status || 'unknown',
    decision,
    parse_error,
    usage: { input_tokens: inTok, output_tokens: outTok },
    cost_cad: costCad,
    cost_note: 'Estimate from list prices in the router; the provider invoice is authoritative.',
    ledger_after: store.ledger || null,
    logged_at: new Date().toISOString(),
  },
}];
