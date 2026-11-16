// Product photo from Telegram -> base64 for the idea checker (it asks a free vision AI what the product is).
const item = $input.first();
const r = $('Request').first().json;
let b64 = null;
try { b64 = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('base64'); } catch (e) { b64 = null; }
const mime = (item.binary && item.binary.data && item.binary.data.mimeType) || 'image/jpeg';
return [{ json: { kind: 'photo', text: r.idea.text, image_b64: b64 ? b64.slice(0, 1500000) : null, mime } }];
