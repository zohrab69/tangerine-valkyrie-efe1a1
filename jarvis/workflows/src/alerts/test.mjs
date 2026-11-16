import fs from 'fs';
const run = (f, input, N = {}, sd = {}) => new Function('$input', '$', '$getWorkflowStaticData', fs.readFileSync(f, 'utf8'))(
  { first: () => input[0], all: () => input }, n => ({ first: () => N[n][0], all: () => N[n] }), () => sd);
const sd = {};
const err = { execution: { id: '42', url: 'https://n8n.x/execution/42', mode: 'trigger', lastNodeExecuted: 'CJ product search', error: { message: 'Request failed with status code 429' } }, workflow: { id: 'w', name: 'JARVIS Research v1 (CJ products)' } };
const a = run('1-format-error.js', [{ json: err }], {}, sd)[0].json; console.log(a.send, '\n' + a.text);
console.log('repeat within 60 min sent?', run('1-format-error.js', [{ json: err }], {}, sd)[0].json.send);
const ok = { 'Check AI (free combo)': [{ json: { choices: [{ message: { content: 'OK' } }] } }], 'Check voice service': [{ json: { status: 'ok' } }], 'Check SerpApi key': [{ json: { total_searches_left: 120 } }], 'Check Shopify key': [{ json: { data: { shop: { name: 'R' } } } }], 'Read memory': [{ json: { kind: 'research', summary: 'x', createdAt: new Date().toISOString() } }] };
const hsd = {};
console.log('healthy ->', run('2-health.js', [{ json: {} }], ok, hsd)[0].json.send);
const bad = { 'Check AI (free combo)': [{ json: { error: { message: '401 Unauthorized' } } }], 'Check voice service': [{ json: { error: 'ECONNREFUSED' } }], 'Check SerpApi key': [{ json: { error: { message: 'Invalid API key' } } }], 'Check Shopify key': [{ json: { error: { message: '401' } } }], 'Read memory': [{ json: {} }] };
console.log(run('2-health.js', [{ json: {} }], bad, hsd)[0].json.text);
console.log('keys never added -> no key alarm:', !/key stopped/.test(run('2-health.js', [{ json: {} }], bad, {})[0].json.text));
console.log(run('3-memory-row.js', [{ json: a }])[0].json);
