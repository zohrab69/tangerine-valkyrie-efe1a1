// The owner replied to a product photo from the research report (e.g. "sample", "order 2", "échantillon").
// Everything we need is in the photo caption: name and CJ SKU. Quantity: a number 1-3 in the reply, default 1.
const msg = $input.first().json.message || {};
const cap = (msg.reply_to_message && (msg.reply_to_message.caption || msg.reply_to_message.text)) || '';
const sku = (cap.match(/CJ SKU\s+([A-Za-z0-9_-]+)/) || [])[1] || null;
const name = (cap.split('\n')[0] || '').replace(/^\d+\.\s*/, '').trim().slice(0, 120);
const qtyMatch = (msg.text || '').match(/\b([1-3])\b/);
const store = $getWorkflowStaticData('global');
const t = store.cjToken;
const tokenOk = t && t.value && t.expires && new Date(t.expires).getTime() - Date.now() > 24 * 3600 * 1000;
return [{ json: {
  sku, name, qty: qtyMatch ? Number(qtyMatch[1]) : 1, owner_text: (msg.text || '').slice(0, 200),
  chat_id: msg.chat ? msg.chat.id : null, need_token: !tokenOk, token: tokenOk ? t.value : null,
} }];
