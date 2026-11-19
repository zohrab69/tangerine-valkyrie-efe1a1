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
// link that cannot be read and no text -> ask for the name
N['Identify request'] = [{ json: { id: 'i', kind: 'link', url: 'https://a.co/d/x', text: '', had_image: false, page: { title: null, site: 'a.co' } } }];
ok(/couldn't read that link/.test(run('4-identity.js', [{ json: { error: 'x' } }], N)[0].json.problem), 'unreadable Amazon link = ask for the name');
// market too low -> NO, honest price
N['Product identity'] = [{ json: { id: 'i', name: 'Garlic press', q: 'garlic press', excluded: null, certification: [] } }];
N['Supplier costs'] = [{ json: { suppliers: [{ name: 'Press', warehouse: 'CN', cost_usd: 0.9, landed_cad: 8.02, days: 15, shipping: { usd: 4.83, days: '7-15' }, listed_by_stores: 5996, competition: 'crowded', certification: [] },
  { name: 'Grinder', warehouse: 'US', cost_usd: 0.25, landed_cad: 0.35, days: null, shipping: null, listed_by_stores: 1344, competition: 'healthy', certification: [] }] } }];
N['Market plan'] = [{ json: { q: 'garlic press', source: 'cache' } }];
const sdm = { serpCache: { 'garlic press': { at: Date.now(), median_price_cad: 10.84, offers: 40, amazon_median_cad: 13.66, amazon_offers: 20, others: [], trend: 'flat', trend_pct: 0 } } };
const v = run('10-verdict.js', [{ json: {} }], N, sdm)[0].json;
ok(v.verdict === 'NO' && v.market_too_low && v.price_cad === 10.99 && v.price_needed === 20.99, 'market too low: NO, price 10.99, would need ' + v.price_needed + ', profit ' + v.profit_cad);
N['Verdict'] = [{ json: v }];
const rep = run('11-report.js', [{ json: { error: 'x' } }], N)[0].json.report;
ok(/Not profitable/.test(rep) && /no shipping quote/.test(rep), 'report says not profitable + no shipping quote');
console.log(rep.split('\n').filter(l => /Price:|no shipping|Not profitable/.test(l)).join('\n'));
// strict match: "dog bandana" must not match a poop bag holder
N['Product identity'] = [{ json: { q: 'dog bandana', name: 'Dog bandana' } }];
N['CJ searches'] = [{ json: { warehouse: 'US', token: 'T' } }];
const sup = run('6-suppliers.js', [{ json: { data: { list: [
  { pid: 'A', productNameEn: 'Dog Poop Bag Holder Dispenser', sellPrice: '1.2', listedNum: 900 },
  { pid: 'B', productNameEn: 'Pet Dog Bandanas Triangle Scarf', sellPrice: '1.5', listedNum: 300 } ] } } }], N);
ok(sup.length === 1 && sup[0].json.pid === 'B', 'dog bandana matches the scarf only, not the poop bag holder');
