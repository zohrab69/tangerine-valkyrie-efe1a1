import fs from 'fs';
const inc = t => t.replace(/^\/\/@include (\S+)\n/m, (_, f) => fs.readFileSync('../' + f, 'utf8'));
const run = (f, input, nodes, sd) => new Function('$input', '$', '$getWorkflowStaticData', inc(fs.readFileSync(f, 'utf8')))(
  { first: () => input[0], all: () => input }, n => ({ first: () => nodes[n][0], all: () => nodes[n] }), () => sd);
const sd = {}; const N = {};
N['Research plan'] = run('1-plan.js', [{ json: {} }], N, sd);
console.log('plan', N['Research plan'][0].json.keywords, 'need_token', N['Research plan'][0].json.need_token);
N['Save token'] = run('2-save-token.js', [{ json: { result: true, data: { accessToken: 'TOK', accessTokenExpiryDate: '2026-11-23T00:00:00+08:00' } } }], N, sd);
console.log('token cached', sd.cjToken.value, 'replan need_token', run('1-plan.js', [{ json: {} }], N, sd)[0].json.need_token);
N['Searches'] = run('3-searches.js', N['Save token'], N, sd);
console.log('searches', N['Searches'].map(x => x.json.keyword + '@' + x.json.warehouse + (x.json.query.countryCode ? '(cc)' : '')).join(', '));
const lists = [
  { result: true, code: 200, data: { list: [
    { pid: 'P1', productNameEn: 'Silicone Garlic Press Peeler', categoryName: 'Kitchen Tools', productSku: 'CJ001', sellPrice: '3.10', listedNum: 820, productImage: 'http://cbu01.cj.com/a.jpg' },
    { pid: 'P2', productNameEn: 'USB Rechargeable Milk Frother', categoryName: 'Kitchen', sellPrice: '6.5', listedNum: 2000 },
    { pid: 'P3', productNameEn: 'Baby Food Maker', categoryName: 'Kitchen', sellPrice: '9', listedNum: 500 },
    { pid: 'P4', productNameEn: 'Stainless Herb Scissors', categoryName: 'Kitchen Tools', productSku: 'CJ004', sellPrice: '2.40-3.10', listedNum: 3, productImage: '["https://x/b.jpg","https://x/c.jpg"]' } ] } },
  { result: true, code: 200, data: { content: [ { productList: [ { id: 'P5', nameEn: 'Pet Grooming Glove', sku: 'CJ005', sellPrice: '1.90', listedNum: 15130 }, { id: 'P1', nameEn: 'dup', sellPrice: '3' } ] } ] } },
  { result: false, code: 1600200, message: 'Too many requests' },
  { result: true, code: 200, data: { list: [ { pid: 'P6', productNameEn: 'Magnetic Phone Stand Holder', sellPrice: '2.2', listedNum: 300 },
    { pid: 'P7', productNameEn: 'Wireless Charger Pad', sellPrice: '4', listedNum: 900 }, { pid: 'P8', productNameEn: 'Face Serum Roller', sellPrice: '3', listedNum: 900 },
    { pid: 'P9', productNameEn: 'Silicone Food Storage Bowl', sellPrice: '3', listedNum: 600 } ] } } ];
// order of searches is kw1@CA, kw1@US, kw1@CN, kw2@CA...; map our lists onto the first four
while (lists.length < N['Searches'].length) lists.push({ result: true, code: 200, data: { list: [] } });
N['Screen products'] = run('4-screen.js', lists.map(json => ({ json })), N, sd);
console.log('screened', N['Screen products'].map(x => x.json.pid + ':' + x.json.listed_by_stores), N['Screen products'][0].json.screen_notes);
const variants = { P6: [{ vid: 'V6', variantSellPrice: 2.2 }], P9: [{ vid: 'V9', variantSellPrice: 3 }], P5: [{ vid: 'V5', variantNameEn: 'Blue', variantSellPrice: 1.95, variantWeight: 60 }], P1: [{ vid: 'V1', variantSellPrice: 3.2, variantWeight: 80 }], P4: [] };
N['Pick variant'] = run('5-pick-variant.js', N['Screen products'].map(p => ({ json: { result: true, data: variants[p.json.pid] } })), N, sd);
const freight = { V6: [{ logisticName: 'USPS', logisticPrice: 6, logisticAging: '4-7' }], V9: [{ logisticName: 'CJPacket', logisticPrice: 4, logisticAging: '7-10' }], V5: [{ logisticName: 'CJPacket Ordinary', logisticPrice: 4.1, logisticAging: '8-15' }, { logisticName: 'YunExpress', logisticPrice: 3.0, logisticAging: '15-30' }], V1: [{ logisticName: 'CJPacket', logisticPrice: 5.2, logisticAging: '7-12' }] };
// local warehouse quotes (P6 from US: CJ gives none to Canada) + backup quotes from China
N['CJ shipping to Canada'] = N['Pick variant'].map(p => ({ json: { result: true, data: p.json.vid === 'V6' ? [] : (freight[p.json.vid] || []) } }));
const cnBackup = N['Pick variant'].map(p => ({ json: { result: true, data: p.json.vid === 'V6' ? [{ logisticName: 'CJPacket', logisticPrice: 5.5, logisticAging: '8-12' }] : [] } }));
N['Finance'] = run('6-finance.js', cnBackup, N, sd);
const p6 = N['Finance'].find(x => x.json.pid === 'P6').json;
console.log('P6 fallback:', p6.warehouse, p6.shipping && p6.shipping.name, p6.flags.filter(f => /China/.test(f)));
N['Finance'].forEach(x => console.log(x.json.pid, x.json.shipping && x.json.shipping.name, 'landed', x.json.landed_cad, 'price', x.json.price_cad, 'profit', x.json.est_profit_cad, x.json.flags));
N['Shortlist'] = run('7-shortlist.js', N['Finance'], N, sd);
console.log('order', N['Shortlist'][0].json.top.map(p => p.pid));
N['SerpApi account (free)'] = [{ json: { total_searches_left: 200, plan_searches_left: 200, this_month_usage: 50 } }];
N['Market check items'] = run('13-market-items.js', N['SerpApi account (free)'], N, sd);
const mi = N['Market check items'];
console.log('market plan:', mi[0].json.meta.plan.map(p => p.q + '=' + p.source).join(' | '), 'warning:', mi[0].json.meta.warning);
const shopping = { shopping_results: [29.99, 34.99, 39.99, 27.5].map((p, k) => ({ extracted_price: p, source: k ? 'Walmart' : 'Amazon.ca' })) };
const tl = v => ({ interest_over_time: { timeline_data: v.map(x => ({ values: [{ extracted_value: x }] })) } });
const fakeShop = [{ json: shopping }, { json: { shopping_results: [{ extracted_price: 9 }, { extracted_price: 10 }, { extracted_price: 11 }] } }, { json: { error: 'Invalid API key' } }];
const fakeTr = [{ json: tl([20,22,25,24,30,35,40,45,50,55,60,70,72]) }, { json: tl([50,50,50,50,40,30,30,30,30,25,20,20,20]) }, { json: {} }];
N['Google Shopping (Canada)'] = mi.map((x, k) => fakeShop[k % 3]);
N['Google Trends (Canada)'] = mi.map((x, k) => fakeTr[k % 3]);
N['Market verdict'] = run('14-market-verdict.js', [{ json: {} }], N, sd);
const mv = N['Market verdict'][0].json;
console.log('market_ok', mv.market_ok, 'dropped', mv.dropped, 'unchecked', mv.unchecked, 'serp', JSON.stringify(mv.serp), 'kept', mv.top.map(p => p.pid + '@' + p.warehouse + (p.market.hot ? ' HOT' : '') + ' ' + (p.market.checked ? 'ratio ' + p.market.ratio + ' ' + p.market.trend : 'unchecked:' + p.market.why)));
console.log('cache size', Object.keys(sd.serpCache).length, 'used', JSON.stringify(sd.serp));
// second run the same day: everything comes from cache or budget, no fresh calls
const mi2 = run('13-market-items.js', N['SerpApi account (free)'], N, sd);
console.log('2nd run fresh calls:', mi2[0].json.none ? 0 : mi2.length, mi2[0].json.meta.plan.map(p => p.source).join(','));
// low budget: warning and no fresh calls
const sd2 = JSON.parse(JSON.stringify(sd)); sd2.serpCache = {};
const low = run('13-market-items.js', [{ json: { total_searches_left: 45 } }], N, sd2);
console.log('low budget:', low[0].json.none, low[0].json.meta.warning);
const nokey = run('13-market-items.js', [{ json: { error: { message: 'Invalid API key' } } }], N, {});
console.log('no key:', nokey[0].json.none, nokey[0].json.meta.has_key);
const ai = { choices: [{ message: { content: '{"notes":[{"n":1,"note":"Home cooks; quality varies."}]}' } }] };
N['Report'] = run('8-report.js', [{ json: ai }], N, sd);
N['Report'].forEach(r => console.log('photo:', r.json.photo || '(none)', '|', r.json.caption.split('\n').slice(0, 2).join(' / ')));
const sent = N['Report'].map((r, i) => ({ json: i === 1 ? { error: { message: 'Bad Request: wrong file identifier' } } : { ok: true } }));
const sum = run('10-summary.js', sent, N, sd)[0].json.report;
console.log('--- summary message:\n' + sum);
console.log('--- no AI ok:', run('8-report.js', [{ json: { error: 'x' } }], N, sd).length === N['Report'].length);
console.log(run('9-empty.js', [{ json: { empty: true, notes: ['search "x": CJ said bad token'] } }], N, sd)[0].json.report);
