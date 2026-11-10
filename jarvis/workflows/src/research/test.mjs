import fs from 'fs';
const run = (f, input, nodes, sd) => new Function('$input', '$', '$getWorkflowStaticData', fs.readFileSync(f, 'utf8'))(
  { first: () => input[0], all: () => input }, n => ({ first: () => nodes[n][0], all: () => nodes[n] }), () => sd);
const sd = {}; const N = {};
N['Research plan'] = run('1-plan.js', [{ json: {} }], N, sd);
console.log('plan', N['Research plan'][0].json.keywords, 'need_token', N['Research plan'][0].json.need_token);
N['Save token'] = run('2-save-token.js', [{ json: { result: true, data: { accessToken: 'TOK', accessTokenExpiryDate: '2026-11-23T00:00:00+08:00' } } }], N, sd);
console.log('token cached', sd.cjToken.value, 'replan need_token', run('1-plan.js', [{ json: {} }], N, sd)[0].json.need_token);
N['Searches'] = run('3-searches.js', N['Save token'], N, sd);
const lists = [
  { result: true, code: 200, data: { list: [
    { pid: 'P1', productNameEn: 'Silicone Garlic Press Peeler', categoryName: 'Kitchen Tools', productSku: 'CJ001', sellPrice: '3.10', listedNum: 820, productImage: 'http://cbu01.cj.com/a.jpg' },
    { pid: 'P2', productNameEn: 'USB Rechargeable Milk Frother', categoryName: 'Kitchen', sellPrice: '6.5', listedNum: 2000 },
    { pid: 'P3', productNameEn: 'Baby Food Maker', categoryName: 'Kitchen', sellPrice: '9', listedNum: 500 },
    { pid: 'P4', productNameEn: 'Stainless Herb Scissors', categoryName: 'Kitchen Tools', productSku: 'CJ004', sellPrice: '2.40-3.10', listedNum: 3, productImage: '["https://x/b.jpg","https://x/c.jpg"]' } ] } },
  { result: true, code: 200, data: { content: [ { productList: [ { id: 'P5', nameEn: 'Pet Grooming Glove', sku: 'CJ005', sellPrice: '1.90', listedNum: 15130 }, { id: 'P1', nameEn: 'dup', sellPrice: '3' } ] } ] } },
  { result: false, code: 1600200, message: 'Too many requests' } ];
N['Screen products'] = run('4-screen.js', lists.map(json => ({ json })), N, sd);
console.log('screened', N['Screen products'].map(x => x.json.pid + ':' + x.json.listed_by_stores), N['Screen products'][0].json.screen_notes);
const variants = { P5: [{ vid: 'V5', variantNameEn: 'Blue', variantSellPrice: 1.95, variantWeight: 60 }], P1: [{ vid: 'V1', variantSellPrice: 3.2, variantWeight: 80 }], P4: [] };
N['Pick variant'] = run('5-pick-variant.js', N['Screen products'].map(p => ({ json: { result: true, data: variants[p.json.pid] } })), N, sd);
const freight = { V5: [{ logisticName: 'CJPacket Ordinary', logisticPrice: 4.1, logisticAging: '8-15' }, { logisticName: 'YunExpress', logisticPrice: 3.0, logisticAging: '15-30' }], V1: [{ logisticName: 'CJPacket', logisticPrice: 5.2, logisticAging: '7-12' }] };
N['Finance'] = run('6-finance.js', N['Pick variant'].map(p => ({ json: { result: true, data: freight[p.json.vid] || [] } })), N, sd);
N['Finance'].forEach(x => console.log(x.json.pid, x.json.shipping && x.json.shipping.name, 'landed', x.json.landed_cad, 'price', x.json.price_cad, 'profit', x.json.est_profit_cad, x.json.flags));
N['Shortlist'] = run('7-shortlist.js', N['Finance'], N, sd);
console.log('order', N['Shortlist'][0].json.top.map(p => p.pid));
const ai = { choices: [{ message: { content: '{"notes":[{"n":1,"note":"Home cooks; quality varies."}]}' } }] };
N['Report'] = run('8-report.js', [{ json: ai }], N, sd);
N['Report'].forEach(r => console.log('photo:', r.json.photo || '(none)', '|', r.json.caption.split('\n').slice(0, 2).join(' / ')));
const sent = N['Report'].map((r, i) => ({ json: i === 1 ? { error: { message: 'Bad Request: wrong file identifier' } } : { ok: true } }));
const sum = run('10-summary.js', sent, N, sd)[0].json.report;
console.log('--- summary message:\n' + sum);
console.log('--- no AI ok:', run('8-report.js', [{ json: { error: 'x' } }], N, sd).length === N['Report'].length);
console.log(run('9-empty.js', [{ json: { empty: true, notes: ['search "x": CJ said bad token'] } }], N, sd)[0].json.report);
