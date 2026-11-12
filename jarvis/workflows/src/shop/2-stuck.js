// Daily check: paid Rangéo orders still not shipped after 4 days -> one Telegram alert (silent otherwise).
const DAYS = 4;
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const orders = $input.all().map(i => i.json || {}).filter(o => o.id && o.created_at && !o.cancelled_at);
const late = orders.filter(o => (Date.now() - new Date(o.created_at)) / 86400e3 > DAYS && (o.fulfillment_status === null || o.fulfillment_status === undefined || o.fulfillment_status === 'partial'));
const text = '⚠️ <b>Rangéo: ' + late.length + ' order(s) not shipped after ' + DAYS + ' days</b>\n' +
  late.slice(0, 10).map(o => '• ' + esc(o.name) + ' from ' + new Date(o.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }) + ', ' + esc(o.total_price) + ' ' + esc(o.currency)).join('\n') +
  '\nCheck CJ → Orders: unpaid, out of stock, or address problem? Customers may ask for refunds if it waits too long.';
return [{ json: { send: late.length > 0, text, kind: 'error', summary: `Rangéo: ${late.length} order(s) not shipped after ${DAYS} days: ${late.map(o => o.name).join(', ')}` } }];
