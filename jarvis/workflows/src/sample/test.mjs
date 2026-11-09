import fs from 'fs';
const run = (f, input, N, sd = {}) => new Function('$input', '$', '$getWorkflowStaticData', fs.readFileSync(f, 'utf8'))(
  { first: () => input[0], all: () => input }, n => ({ first: () => N[n][0] }), () => sd);
const sd = {}, N = {};
const caption = '5. Silicone Dog Bath Massage Gloves Brush Pet Cat Bathroom Cleaning Tool\nDemand: 15130 stores list it on CJ\nCost 0.77 USD + shipping 4.71 USD (CJPacket JYSP Sensitive, 7-15 days)\nLanded ~7.67 CAD | price 19.99 CAD | est. profit 6.44 CAD (32%)\nCJ SKU CJGY1281703\nWatch: thin profit';
N['Read the reply'] = run('1-read-reply.js', [{ json: { message: { text: 'sample 2 please', chat: { id: 6203634137 }, reply_to_message: { caption } } } }], N, sd);
console.log('read:', N['Read the reply'][0].json);
N['With token'] = run('2-save-token.js', [{ json: { result: true, data: { accessToken: 'TOK' } } }], N, sd);
console.log('token cached:', sd.cjToken.value, '| next read needs token:', run('1-read-reply.js', [{ json: { message: { text: 'sample', reply_to_message: { caption } } } }], N, sd)[0].json.need_token);
N['Pick variant'] = run('3-pick.js', [{ json: { result: true, code: 200, data: { pid: 'UUID-1', productNameEn: 'Silicone Dog Bath Brush', variants: [{ vid: 'V1', variantNameEn: 'Green', variantSku: 'CJGY1281703-Green', variantSellPrice: 0.77 }] } } }], N, sd);
N['Sample plan'] = run('4-plan.js', [{ json: { data: [{ logisticName: 'CJPacket JYSP Sensitive', logisticPrice: 4.71, logisticAging: '7-15' }] } }], N, sd);
console.log('--- approval:\n' + N['Sample plan'][0].json.approval_text);
for (const ans of [{ data: { approved: true } }, { data: { approved: false } }, {}]) console.log('---\n' + run('5-after.js', [{ json: ans }], N, sd)[0].json.reply_text);
N['Pick variant'] = run('3-pick.js', [{ json: { result: false, code: 1600100, message: 'Product not found' } }], N, sd);
N['Sample plan'] = run('4-plan.js', [{ json: {} }], N, sd);
console.log('--- problem:\n' + run('5-after.js', [{ json: {} }], N, sd)[0].json.reply_text);
