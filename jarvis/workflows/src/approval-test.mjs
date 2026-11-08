import fs from 'fs';
const run = (file, ctx) => new Function('$input', '$', '$getWorkflowStaticData', fs.readFileSync(file, 'utf8'))(ctx.input, ctx.$, ctx.sd);
const store = {}; const sd = () => store;
const one = j => ({ first: () => ({ json: j }) });
function flow(text, ai, decision) {
  const [task] = run('telegram-request.js', { input: one({ message: { text, chat: { id: 6203634137 } } }) });
  const [r] = run('omniroute-router.js', { input: { first: () => task }, sd });
  const res = { _provider: 'free', model: 'm', usage: {}, choices: [{ message: { content: JSON.stringify(ai) } }] };
  const [p] = run('gateway-parse.js', { input: one(res), $: () => ({ first: () => r }), sd });
  const nodes = { 'Router (multi-AI)': r };
  const [a] = run('approval-rule.js', { input: { first: () => p }, $: n => ({ first: () => nodes[n] }) });
  nodes['Approval rule'] = a;
  let out = a;
  if (a.json.needs_approval) [out] = run('record-decision.js', { input: one(decision), $: n => ({ first: () => nodes[n] }) });
  const [f] = run('format-reply.js', { input: { first: () => out } });
  return { needs: a.json.needs_approval, why: a.json.approval_reasons, status: out.json.approval_status, approval_text: a.json.approval_text, reply: f.json.reply_text };
}
const base = { department: 'ecommerce', priority: 'normal', summary: 'Research products', steps: ['market_researcher: trends'], needs_owner_approval: false, approval_reason: null, data_needed: ['x'] };
let t = flow('Find 3 kitchen products we could sell in Canada under 50 CAD', base, {});
console.log('research ->', t.needs, t.status);
t = flow('Launch the garlic press on Shopify', { ...base, summary: 'Publish listing for garlic_press' }, { data: { approved: true, respondedAt: 'now' } });
console.log('launch ->', t.needs, t.why, t.status); console.log(t.approval_text); console.log('---'); console.log(t.reply);
t = flow('Spend 100 CAD on TikTok ads', base, { data: { approved: false } });
console.log('ads ->', t.needs, t.why, t.status);
t = flow('Email the property managers in Laval about VeraClean', { ...base, department: 'veraclean' }, {});
console.log('outreach ->', t.needs, t.why, t.status);
t = flow('What is our plan this week?', { ...base, needs_owner_approval: true, approval_reason: 'strategy change' }, { data: { approved: true } });
console.log('ai-flag ->', t.needs, t.why, t.status);
const bad = flow('hi', base, {}); console.log('plain ->', bad.needs);
