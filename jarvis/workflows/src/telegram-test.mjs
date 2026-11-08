import fs from 'fs';
const run = (file, ctx) => new Function('$input', '$', '$getWorkflowStaticData', fs.readFileSync(file, 'utf8'))(ctx.input, ctx.$, ctx.sd);
const store = {}; const sd = () => store;
const tg = { json: { message: { text: 'Find 3 kitchen products under 50 CAD', chat: { id: 6203634137 } } } };
const [task] = run('telegram-request.js', { input: { first: () => tg } });
console.log(task.json.owner_message, task.json.chat_id);
const [r] = run('omniroute-router.js', { input: { first: () => task }, sd });
const res = { _provider: 'free', model: 'openai/gpt-oss-120b', usage: { prompt_tokens: 300, completion_tokens: 380 },
  choices: [{ message: { content: JSON.stringify({ department: 'ecommerce', priority: 'normal', summary: 'Research kitchen products',
    steps: ['research agent: trends', 'finance agent: margins'], needs_owner_approval: false, approval_reason: null, data_needed: ['supplier prices'] }) } }] };
const [p] = run('gateway-parse.js', { input: { first: () => ({ json: res }) }, $: () => ({ first: () => r }), sd });
console.log(run('format-reply.js', { input: { first: () => p } })[0].json.reply_text);
console.log('---');
console.log(run('format-reply.js', { input: { first: () => ({ json: { message_to_owner: 'JARVIS could not run task x: no AI available' } }) } })[0].json.reply_text);
console.log(run('format-reply.js', { input: { first: () => ({ json: { task_id: 't1', decision: null, parse_error: 'bad JSON' } }) } })[0].json.reply_text);
