// Multi-AI router: builds one ready-to-send request per available provider, free tiers first.
// Keep ROUTING in sync with jarvis/config/model-routing.json and CAPS with jarvis/config/budget.json.
const ROUTING = {
  usd_to_cad: 1.40,
  providers: {
    gemini:     { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', free: true,  enabled: true },
    groq:       { url: 'https://api.groq.com/openai/v1/chat/completions',                          free: true,  enabled: true },
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions',                            free: true,  enabled: false },
    openai:     { url: 'https://api.openai.com/v1/chat/completions',                               free: false, enabled: true },
  },
  tiers: {
    T1: { max_tokens: 800, chain: [
      { provider: 'gemini', model: 'gemini-2.5-flash-lite', daily_limit: 900 },
      { provider: 'groq', model: 'openai/gpt-oss-20b', daily_limit: 900 },
      { provider: 'openrouter', model: 'CHOOSE-A-FREE-MODEL', daily_limit: 45 },
      { provider: 'openai', model: 'gpt-5-nano', in: 0.05, out: 0.40 } ] },
    T2: { max_tokens: 2000, chain: [
      { provider: 'gemini', model: 'gemini-2.5-flash', daily_limit: 200 },
      { provider: 'groq', model: 'openai/gpt-oss-120b', daily_limit: 900 },
      { provider: 'openrouter', model: 'CHOOSE-A-FREE-MODEL', daily_limit: 45 },
      { provider: 'openai', model: 'gpt-5-mini', in: 0.25, out: 2.00 } ] },
    T3: { max_tokens: 4000, chain: [
      { provider: 'openai', model: 'gpt-5', in: 1.25, out: 10.0 } ] },
  },
  task_types: {
    classify: 'T1', extract: 'T1', format: 'T1', summarize_short: 'T1', customer_reply_draft: 'T1',
    research_synthesis: 'T2', marketing_copy: 'T2', video_script: 'T2', competitor_comparison: 'T2',
    lead_qualification: 'T2', daily_report: 'T2',
    product_financials: 'T3', independent_review: 'T3', strategy: 'T3',
  },
};
const CAPS = { daily_cad: 2.00, monthly_cad: 40, single_call_cad: 0.25 };
const ORDER = ['gemini', 'groq', 'openrouter', 'openai']; // must match the node order in the workflow

const task = $input.first().json;
const tierName = ROUTING.task_types[task.task_type] || 'T2';
const tier = ROUTING.tiers[tierName];

const store = $getWorkflowStaticData('global');
const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
store.ledger = store.ledger || { day: today, month, day_cad: 0, month_cad: 0, calls: {} };
if (store.ledger.day !== today) { store.ledger.day = today; store.ledger.day_cad = 0; store.ledger.calls = {}; }
if (store.ledger.month !== month) { store.ledger.month = month; store.ledger.month_cad = 0; }

const messages = [
  { role: 'system', content: task.instructions },
  { role: 'user', content: task.owner_message },
];
const inputTokens = Math.ceil((task.instructions.length + task.owner_message.length) / 4) + 50;

const calls = {}, skipped = [];
for (const step of tier.chain) {
  const p = ROUTING.providers[step.provider];
  const why =
    !p.enabled ? 'not set up' :
    step.model.startsWith('CHOOSE') ? 'no model chosen' :
    (p.free && task.contains_personal_data) ? 'free tier not allowed for personal data' :
    (step.daily_limit && (store.ledger.calls[step.provider] || 0) >= step.daily_limit) ? 'free daily limit used' : null;
  let est_cad = 0;
  if (!why && !p.free) {
    est_cad = +(((inputTokens * step.in + tier.max_tokens * step.out) / 1e6) * ROUTING.usd_to_cad).toFixed(5);
    if (est_cad > CAPS.single_call_cad) { skipped.push(`${step.provider}: call estimate over cap`); continue; }
    if (store.ledger.day_cad + est_cad > CAPS.daily_cad) { skipped.push(`${step.provider}: daily budget reached`); continue; }
    if (store.ledger.month_cad + est_cad > CAPS.monthly_cad) { skipped.push(`${step.provider}: monthly budget reached`); continue; }
  }
  if (why) { skipped.push(`${step.provider}: ${why}`); continue; }
  const body = { model: step.model, messages, response_format: { type: 'json_object' } };
  if (step.provider === 'openai') body.max_completion_tokens = tier.max_tokens;
  else body.max_tokens = tier.max_tokens;
  calls[step.provider] = { url: p.url, body, est_cad, price: { in: step.in || 0, out: step.out || 0 } };
}

return [{ json: { ...task, tier: tierName, order: ORDER.filter(n => calls[n]), calls, skipped,
                  any_available: Object.keys(calls).length > 0 } }];
