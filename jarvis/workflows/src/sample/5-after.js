// Final message (HTML). Approved -> exact steps to place the order at CJ. Declined/expired -> nothing done.
let q;
try { q = $('Sample plan').first().json; } catch (e) { q = $('Pick variant').first().json; }
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let text;
if (q.problem) {
  text = 'JARVIS could not prepare the sample order for <b>' + esc(q.name || q.sku || 'this product') + '</b>: ' + esc(q.problem) +
         '.\nNothing was ordered. Reply "sample" to a product photo from the research report to try again.';
} else {
  const r = ($input.first().json || {}).data || {};
  if (r.approved === true) {
    text = [
      '✅ <b>Sample approved</b>: ' + esc(q.cj_name),
      'Order it at CJ (about 2 minutes):',
      '1. cjdropshipping.com, search <code>' + esc(q.sku) + '</code>',
      '2. Choose variant: ' + esc(q.variant || 'default') + ', quantity ' + q.qty,
      '3. Shipping method: ' + esc(q.ship.name) + ' (' + esc(q.ship.days) + ' days), to your Canadian address',
      '4. Pay at checkout. Expected total about ' + q.total_usd + ' USD (~' + q.total_cad + ' CAD) before tax and duties.',
      'When it arrives, tell JARVIS the real delivery days and quality.',
      '(JARVIS will place orders by itself only after CJ ordering is connected and tested.)',
    ].join('\n');
  } else if (r.approved === false) {
    text = '❌ Sample declined: ' + esc(q.cj_name) + '. Nothing was ordered.';
  } else {
    text = 'No answer within 48 hours: the sample for ' + esc(q.cj_name) + ' was treated as declined. Nothing was ordered.';
  }
}
return [{ json: { reply_text: text.slice(0, 4000) } }];
