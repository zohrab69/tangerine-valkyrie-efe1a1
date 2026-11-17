// One request format for both doors: Telegram (owner's chat) and the JARVIS screen (voice or typed).
// Also decides the route: idea (a product to check), products (send/resend today's products) or chat (the agent).
const j = $input.first().json || {};
const OWNER = '__OWNER__';
let channel, text, lang = 'en', chat_id = OWNER, photo = null, history = [];
if (j.message) {                                   // Telegram
  channel = 'telegram';
  const m = j.message;
  text = String(m.text || m.caption || '').trim();
  chat_id = String(m.chat && m.chat.id || OWNER);
  if (Array.isArray(m.photo) && m.photo.length) {
    const sorted = [...m.photo].sort((a, b) => (a.file_size || a.width || 0) - (b.file_size || b.width || 0));
    const mid = sorted.find(p => (p.width || 0) >= 480) || sorted[sorted.length - 1];
    photo = mid.file_id;
  }
  if (/[àâçéèêëîïôûùüÿœ]|\b(bonjour|merci|produits?|vérifie|est-ce|combien|quoi)\b/i.test(text)) lang = 'fr';
} else {                                           // JARVIS screen (Caddy adds the secret header)
  channel = 'voice';
  const b = j.body || {};
  text = String(b.text || '').trim();
  lang = b.lang === 'fr' ? 'fr' : 'en';
  history = Array.isArray(b.history) ? b.history.slice(-4) : [];
}
text = text.slice(0, 2000);
const url = (text.match(/https?:\/\/\S+/) || [null])[0];
const CHECK = /^\s*(check|vérifie|verifie|analyse|analyze|research|is this (a )?good|what about|idée|idea)\b[:\s-]*/i;
// "what's selling / viral / trending today" also goes straight to the products (fast, no AI: the free AI can take 40-90 s).
const PRODUCTS = /\bwhat'?s (selling|viral|trending|hot|popular)\b|\bwhat is (selling|viral|trending|hot|popular)\b|\b(qu'?est-ce qui|quoi) (se vend|est viral|est tendance)\b|\b(send|resend|show|give)( me)?( the| today'?s| todays| the latest)? (top )?products\b|\b(today'?s|todays|daily) products\b|\b(envoie|renvoie|montre)(-moi)? (les )?produits\b|\bproduits du jour\b/i;
let route = 'chat', idea = null;
if (channel === 'telegram' && photo) { route = 'idea'; idea = { kind: 'photo', file_id: photo, text: text || null }; }
else if (channel === 'telegram' && url) { route = 'idea'; idea = { kind: 'link', url, text: text.replace(url, '').trim() || null }; }
else if (channel === 'telegram' && CHECK.test(text) && text.replace(CHECK, '').trim().length >= 3) { route = 'idea'; idea = { kind: 'name', text: text.replace(CHECK, '').trim() }; }
else if (PRODUCTS.test(text)) route = 'products';
const resend = /\b(resend|again|renvoie)\b/i.test(text);
return [{ json: { channel, text, lang, chat_id, route, idea, history, session: 'owner',
                  products_mode: resend ? 'resend' : 'auto', received_at: new Date().toISOString() } }];
