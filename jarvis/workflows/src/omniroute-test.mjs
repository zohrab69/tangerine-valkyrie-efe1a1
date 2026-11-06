import fs from 'fs';
const run = (file, ctx) => new Function('$input', '$', '$getWorkflowStaticData', fs.readFileSync(file, 'utf8'))(ctx.input, ctx.$, ctx.sd);
const store = {}; const sd = () => store;
const [task] = run('1-owner-request.js', { sd });
const route = t => run('omniroute-router.js', { input: { first: () => t }, sd })[0];
const r = route(task);
console.log('T1', r.json.order, r.json.calls.free.body.model);
const fake = { _provider: 'free', model: 'gemini-2.5-flash', usage: { prompt_tokens: 300, completion_tokens: 100 },
  choices: [{ message: { content: '{"department":"ecommerce"}' } }] };
const [p] = run('gateway-parse.js', { input: { first: () => ({ json: fake }) }, $: () => ({ first: () => r }), sd });
console.log('parsed', p.json.answered_by, p.json.decision, p.json.cost_cad);
console.log('T3', route({ json: { ...task.json, task_type: 'strategy' } }).json.order);
console.log('PII', route({ json: { ...task.json, contains_personal_data: true } }).json.order);
store.ledger.day_cad = 1.99; const b = route(task).json; console.log('budget hit', b.order, b.skipped);
