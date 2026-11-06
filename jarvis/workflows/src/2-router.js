// Model router + budget guard. Keep ROUTING in sync with jarvis/config/model-routing.json
// and CAPS with jarvis/config/budget.json.
const ROUTING = {
  usd_to_cad: 1.40,
  tiers: {
    T1: { provider: 'openai', model: 'gpt-5-nano', in: 0.05, out: 0.40, max_out: 600,  effort: 'minimal' },
    T2: { provider: 'openai', model: 'gpt-5-mini', in: 0.25, out: 2.00, max_out: 1500, effort: 'low' },
    T3: { provider: 'openai', model: 'gpt-5',      in: 1.25, out: 10.0, max_out: 3000, effort: 'medium' },
  },
  task_types: {
    classify: 'T1', extract: 'T1', format: 'T1', summarize_short: 'T1', customer_reply_draft: 'T1',
    research_synthesis: 'T2', marketing_copy: 'T2', video_script: 'T2', competitor_comparison: 'T2',
    lead_qualification: 'T2', daily_report: 'T2',
    product_financials: 'T3', independent_review: 'T3', strategy: 'T3',
  },
};
const CAPS = { daily_cad: 2.00, monthly_cad: 40, single_call_cad: 0.25 };

const task = $input.first().json;
const tierName = ROUTING.task_types[task.task_type] || 'T2'; // unknown -> T2, never T3
const t = ROUTING.tiers[tierName];

// Worst-case estimate: ~4 characters per token, full output budget used.
const inputTokens = Math.ceil(((task.instructions || '').length + (task.owner_message || '').length) / 4) + 50;
const estUsd = (inputTokens * t.in + t.max_out * t.out) / 1e6;
const estCad = +(estUsd * ROUTING.usd_to_cad).toFixed(5);

// Spend ledger. Persists only for production (active/triggered) executions, not manual test runs.
const store = $getWorkflowStaticData('global');
const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
store.ledger = store.ledger || { day: today, month, day_cad: 0, month_cad: 0 };
if (store.ledger.day !== today) { store.ledger.day = today; store.ledger.day_cad = 0; }
if (store.ledger.month !== month) { store.ledger.month = month; store.ledger.month_cad = 0; }

let reason = 'ok';
if (estCad > CAPS.single_call_cad) reason = `single call estimate ${estCad} CAD > cap ${CAPS.single_call_cad}`;
else if (store.ledger.day_cad + estCad > CAPS.daily_cad) reason = `daily cap ${CAPS.daily_cad} CAD reached`;
else if (store.ledger.month_cad + estCad > CAPS.monthly_cad) reason = `monthly cap ${CAPS.monthly_cad} CAD reached`;

return [{
  json: {
    ...task,
    route: { tier: tierName, provider: t.provider, model: t.model, max_output_tokens: t.max_out,
             reasoning_effort: t.effort, price_in_per_m_usd: t.in, price_out_per_m_usd: t.out,
             usd_to_cad: ROUTING.usd_to_cad },
    est_cost_cad: estCad,
    within_budget: reason === 'ok',
    budget_reason: reason,
    ledger_before: { ...store.ledger },
  },
}];
