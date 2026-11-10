import fs from 'fs';
const run = (f, input, N = {}) => new Function('$input', '$', fs.readFileSync(f, 'utf8'))({ first: () => input[0], all: () => input }, n => ({ first: () => N[n][0] }));
const ago = h => new Date(Date.now() - h * 3600e3).toISOString();
const rows = [
  { kind: 'research', summary: 'Product research report sent ... Products: 1. Rice sieve basin (est. profit 9.16 CAD, 675 stores, competition healthy)', createdAt: ago(13) },
  { kind: 'sample_pending', summary: 'Sample request waiting: Rice sieve, quantity 1, 8.17 USD', createdAt: ago(5) },
  { kind: 'sample', summary: 'Sample request: declined dog brush', createdAt: ago(30) },
  { kind: 'error', summary: 'Error in workflow X', createdAt: ago(2) },
].map(json => ({ json }));
const N = { 'Briefing facts': run('1-facts.js', rows) };
const f = N['Briefing facts'][0].json.facts;
console.log('waiting', f.waiting_for_owner.length, 'decided', f.decisions_last_24h.length, 'errors', f.problems_last_24h.length, 'next', f.next_research);
const ai = { choices: [{ message: { content: JSON.stringify({ text: '☀️ Good morning Zohrab\n📦 ...', spoken: 'Good morning, Zohrab. All good.' }) } }] };
console.log(run('2-text.js', [{ json: ai }], N)[0].json.tts_body);
console.log(run('2-text.js', [{ json: { error: 'down' } }], N)[0].json.text);
console.log(run('1-facts.js', [{ json: {} }])[0].json.facts.latest_research);
