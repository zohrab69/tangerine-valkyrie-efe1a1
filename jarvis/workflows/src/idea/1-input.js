// Product idea from the owner (Telegram photo, link or name; or JARVIS's tool) -> one clean request.
const b = ($input.first().json || {}).body || {};
const kind = ['photo', 'link', 'name'].includes(b.kind) ? b.kind : (b.url ? 'link' : b.image_b64 ? 'photo' : 'name');
let url = b.url || null, text = String(b.text || '').trim().slice(0, 300);
if (!url) { const m = text.match(/https?:\/\/\S+/); if (m) { url = m[0]; text = text.replace(m[0], '').trim(); } }
const okUrl = url && /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url) && !/^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1|0\.0\.0\.0|omniroute|jarvis-|n8n|postgres|caddy)/i.test(url);
const id = 'idea_' + Date.now().toString(36);
const problem = !text && !okUrl && !b.image_b64 ? 'Send me a product name, a link or a photo.' : null;
const message = problem || ('🔎 Checking ' + (kind === 'photo' ? 'your photo' : kind === 'link' ? 'this link' : '"' + text.slice(0, 60) + '"') +
  ': suppliers on CJ, competitor prices, Google searches in Canada, costs and risks. The report will arrive here in 1-3 minutes.');
return [{ json: { id, kind: okUrl ? 'link' : kind, url: okUrl ? url : null, text, image_b64: b.image_b64 || null, mime: b.mime || 'image/jpeg',
                  problem, reply: { ok: !problem, id, message } } }];
