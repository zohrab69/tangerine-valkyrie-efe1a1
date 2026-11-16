// Offline tests for the idea checker code (node test.mjs).
import fs from 'fs';
const inc = t => t.replace(/^\/\/@include (\S+)\n/m, (_, f) => fs.readFileSync('../' + f, 'utf8'));
const run = (f, input, nodes, sd = {}) => new Function('$input', '$', '$getWorkflowStaticData', inc(fs.readFileSync(f, 'utf8')))(
  { first: () => input[0], all: () => input }, n => ({ first: () => nodes[n][0], all: () => nodes[n] }), () => sd);
const ok = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('ok', m); };
const N = {};
N['Idea input'] = run('1-input.js', [{ json: { body: { kind: 'link', text: 'check https://www.amazon.ca/dp/B0TEST this' } } }], N);
ok(N['Idea input'][0].json.url === 'https://www.amazon.ca/dp/B0TEST', 'link extracted');
ok(run('1-input.js', [{ json: { body: { text: 'http://localhost:5678/x' } } }], N)[0].json.url === null, 'internal link refused');
ok(run('1-input.js', [{ json: { body: {} } }], N)[0].json.problem, 'empty request = problem');
const html = '<html><head><title>Amazon.ca: Desk Pad</title><meta property="og:title" content="Heated Desk Pad &amp; Mouse Mat"><meta content="https://m.media/x.jpg" property="og:image"></head></html>';
const page = run('2-page.js', [{ json: { data: html } }], N)[0].json.page;
ok(page.title === 'Heated Desk Pad & Mouse Mat' && page.image === 'https://m.media/x.jpg' && page.site === 'amazon.ca', 'page title/image/site');
N['Identify request'] = [{ json: { id: 'i', kind: 'photo', text: '', had_image: true, page: {} } }];
ok(/recognise/.test(run('4-identity.js', [{ json: { error: 'x' } }], N)[0].json.problem), 'photo not recognised = ask for name');
N['Identify request'] = [{ json: { id: 'i', kind: 'name', text: 'kids night light', had_image: false, page: {} } }];
const idt = run('4-identity.js', [{ json: { choices: [{ message: { content: '{"name":"Night light","search_query":"night light","has_battery_or_charger":false}' } }] } }], N)[0].json;
ok(idt.excluded && /kids/.test(idt.excluded) && idt.certification.length, 'kids excluded + electrical flagged: ' + idt.excluded);
