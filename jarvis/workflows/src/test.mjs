import fs from 'fs';
const run = (file, ctx) => new Function('$input', '$', '$getWorkflowStaticData', fs.readFileSync(file, 'utf8'))(ctx.input, ctx.$, ctx.sd);
const store = {};
const sd = () => store;
const [task] = run('1-owner-request.js', { input: null, $: null, sd });
const [routed] = run('2-router.js', { input: { first: () => task }, $: null, sd });
console.log('route', routed.json.route.tier, routed.json.route.model, 'est', routed.json.est_cost_cad, routed.json.within_budget, routed.json.budget_reason);
const fake = { model: 'gpt-5-nano', status: 'completed', usage: { input_tokens: 400, output_tokens: 300 },
  output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"department":"ecommerce","needs_owner_approval":false}' }] }] };
const [out] = run('3-parse-log.js', { input: { first: () => ({ json: fake }) }, $: () => ({ first: () => routed }), sd });
console.log(JSON.stringify(out.json, null, 1));
// budget cap test
store.ledger.day_cad = 1.9999;
const [blocked] = run('2-router.js', { input: { first: () => task }, $: null, sd });
console.log('blocked?', blocked.json.within_budget, blocked.json.budget_reason);
const t3 = { json: { ...task.json, task_type: 'strategy' } }; store.ledger.day_cad = 0;
const [r3] = run('2-router.js', { input: { first: () => t3 }, $: null, sd });
console.log('T3', r3.json.route.model, r3.json.est_cost_cad, r3.json.within_budget);
