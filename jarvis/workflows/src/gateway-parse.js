// Parse whichever provider answered (OpenAI-compatible chat format), record cost and usage.
const routed = $('Router (multi-AI)').first().json;
const res = $input.first().json;
const provider = res._provider;
const call = routed.calls[provider];

let text = (res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || '';
text = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
let decision = null, parse_error = null;
try { decision = JSON.parse(text); } catch (e) { parse_error = 'Answer was not valid JSON: ' + e.message; }

const u = res.usage || {};
const inTok = u.prompt_tokens || 0, outTok = u.completion_tokens || 0;
const cost_cad = +(((inTok * call.price.in + outTok * call.price.out) / 1e6) * 1.40).toFixed(6);

const store = $getWorkflowStaticData('global');
if (store.ledger) {
  store.ledger.calls[provider] = (store.ledger.calls[provider] || 0) + 1;
  store.ledger.day_cad += cost_cad; store.ledger.month_cad += cost_cad;
}
return [{ json: {
  task_id: routed.task_id, answered_by: provider, model: res.model || call.body.model, tier: routed.tier,
  decision, parse_error, usage: { input_tokens: inTok, output_tokens: outTok },
  cost_cad, cost_note: provider === 'openai' ? 'Estimate from list prices.' : 'Free tier: no charge.',
  skipped_before: routed.skipped, ledger_after: store.ledger || null, logged_at: new Date().toISOString(),
} }];
