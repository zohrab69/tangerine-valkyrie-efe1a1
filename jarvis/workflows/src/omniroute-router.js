// Router for the OmniRoute version. OmniRoute does the provider fallback inside each combo;
// this node only decides FREE combo vs PAID combo and enforces your budget on paid calls.
// Combo names must match what you create in the OmniRoute dashboard (Settings > Combos).
const OMNI = 'http://omniroute:20128/v1/chat/completions';
const COMBOS = {
  free: 'jarvis-free', // Gemini / Groq / OpenRouter free models, API keys only
  paid: 'jarvis-paid', // OpenAI (paid) - used for T3 decisions, personal data, or when free is unavailable
};
// Paid price used for the budget estimate (USD per 1M tokens) - set to the most expensive model in jarvis-paid.
const PAID_PRICE = { in: 1.25, out: 10.0 };
const USD_TO_CAD = 1.40;
const CAPS = { daily_cad: 2.00, monthly_cad: 40, single_call_cad: 0.25 };
const TIER = {
  classify: 'T1', extract: 'T1', format: 'T1', summarize_short: 'T1', customer_reply_draft: 'T1',
  research_synthesis: 'T2', marketing_copy: 'T2', video_script: 'T2', competitor_comparison: 'T2',
  lead_qualification: 'T2', daily_report: 'T2',
  product_financials: 'T3', independent_review: 'T3', strategy: 'T3',
};
const MAX_TOKENS = { T1: 800, T2: 2000, T3: 4000 };

const task = $input.first().json;
const tier = TIER[task.task_type] || 'T2';
const store = $getWorkflowStaticData('global');
const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
store.ledger = store.ledger || { day: today, month, day_cad: 0, month_cad: 0, calls: {} };
if (store.ledger.day !== today) { store.ledger.day = today; store.ledger.day_cad = 0; store.ledger.calls = {}; }
if (store.ledger.month !== month) { store.ledger.month = month; store.ledger.month_cad = 0; }

const messages = [{ role: 'system', content: task.instructions }, { role: 'user', content: task.owner_message }];
const body = model => ({ model, messages, max_tokens: MAX_TOKENS[tier], response_format: { type: 'json_object' } });
const calls = {}, skipped = [];

if (tier === 'T3') skipped.push('free: T3 decisions use the paid combo');
else if (task.contains_personal_data) skipped.push('free: personal data never goes to free tiers');
else calls.free = { url: OMNI, body: body(COMBOS.free), est_cad: 0, price: { in: 0, out: 0 } };

const inTok = Math.ceil((task.instructions.length + task.owner_message.length) / 4) + 50;
const est = +(((inTok * PAID_PRICE.in + MAX_TOKENS[tier] * PAID_PRICE.out) / 1e6) * USD_TO_CAD).toFixed(5);
if (est > CAPS.single_call_cad) skipped.push('paid: call estimate over cap');
else if (store.ledger.day_cad + est > CAPS.daily_cad) skipped.push('paid: daily budget reached');
else if (store.ledger.month_cad + est > CAPS.monthly_cad) skipped.push('paid: monthly budget reached');
else calls.paid = { url: OMNI, body: body(COMBOS.paid), est_cad: est, price: PAID_PRICE };

return [{ json: { ...task, tier, order: ['free', 'paid'].filter(k => calls[k]), calls, skipped,
                  any_available: Object.keys(calls).length > 0 } }];
