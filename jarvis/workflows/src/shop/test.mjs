import fs from 'fs';
const run = (f, input) => new Function('$input', fs.readFileSync(f, 'utf8'))({ first: () => input[0], all: () => input });
const order = { name: '#1001', order_number: 1001, total_price: '45.98', total_tax: '5.99', currency: 'CAD', financial_status: 'paid', created_at: new Date().toISOString(),
  line_items: [{ title: 'Organisateur de pare-soleil pour voiture', quantity: 1, sku: 'CJQCNBQC00122-Black', price: '39.99' }], shipping_address: { city: 'Laval', province_code: 'QC' } };
let r = run('1-new-order.js', [{ json: order }])[0].json; console.log(r.text); console.log(r.summary);
r = run('1-new-order.js', [{ json: { ...order, line_items: [{ title: 'Other', quantity: 2, sku: 'X' }] } }])[0].json; console.log(r.text.split('\n')[3]);
const old = new Date(Date.now() - 6 * 86400e3).toISOString();
const s = run('2-stuck.js', [{ json: { id: 1, name: '#1001', created_at: old, fulfillment_status: null, total_price: '45.98', currency: 'CAD' } }, { json: { id: 2, name: '#1002', created_at: new Date().toISOString(), fulfillment_status: null } }, { json: { id: 3, name: '#1003', created_at: old, fulfillment_status: 'fulfilled' } }])[0].json;
console.log(s.send, '\n' + s.text);
console.log('none ->', run('2-stuck.js', [{ json: {} }])[0].json.send);
