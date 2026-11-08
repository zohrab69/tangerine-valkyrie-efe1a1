import fs from 'fs';
const run = (file, ctx) => new Function('$input', '$', '$getWorkflowStaticData', fs.readFileSync(file, 'utf8'))(ctx.input, ctx.$, ctx.sd);
const store = {}; const sd = () => store;
const one = j => ({ first: () => ({ json: j }) });
function flow(text, lang, ai) {
  const [vr] = run('voice-request.js', { input: one({ body: { text, lang } }) });
  const [r] = run('omniroute-router.js', { input: { first: () => vr }, sd });
  const nodes = { 'Router (multi-AI)': r, 'Voice request': vr };
  let p;
  if (ai) {
    const res = { _provider: 'free', model: 'openai/gpt-oss-120b', usage: { prompt_tokens: 400, completion_tokens: 200 }, choices: [{ message: { content: JSON.stringify(ai) } }] };
    [p] = run('gateway-parse.js', { input: one(res), $: () => ({ first: () => r }), sd });
    [p] = run('approval-rule.js', { input: { first: () => p }, $: n => ({ first: () => nodes[n] }) });
  } else p = { json: { task_id: r.json.task_id, status: 'blocked_no_ai', message_to_owner: 'no AI' } };
  return run('voice-answer.js', { input: { first: () => p }, $: n => ({ first: () => nodes[n] }) })[0].json;
}
let v = flow('Good morning JARVIS, what should we focus on today?', 'en', { spoken_reply: 'Good morning. I suggest we start the product research.', department: 'jarvis', steps: [], needs_owner_approval: false, data_needed: [] });
console.log(v.voice_response.spoken, '| approval', v.needs_approval, '| cost', v.voice_response.cost_cad);
v = flow('Launch the garlic press on Shopify', 'en', { spoken_reply: 'Understood, preparing the launch plan.', department: 'ecommerce', summary: 'Launch garlic press', steps: ['ecommerce_listings'], needs_owner_approval: false, data_needed: ['photos'] });
console.log(v.voice_response.spoken, '| approval', v.needs_approval, v.voice_response.approval_reasons);
v = flow('Lance la presse-ail sur Shopify', 'fr', { spoken_reply: "D'accord, je prépare le plan.", department: 'ecommerce', summary: 'Publier', steps: [], needs_owner_approval: true, approval_reason: 'lancement' });
console.log(v.voice_response.spoken);
v = flow('hello', 'en', null);
console.log(v.voice_response.ok, v.voice_response.spoken);
