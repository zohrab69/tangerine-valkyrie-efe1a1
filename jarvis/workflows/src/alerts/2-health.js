// Daily health check 9:07 + 10:40 (Toronto): AI, voice, SerpApi key, Shopify key, and that the daily 10:00 research went out.
// Silent when everything is fine; one Telegram alert listing the problems otherwise.
const problems = [];
const ai = $('Check AI (free combo)').first().json || {};
// A reply with at least one choice counts as working (reasoning models can return empty text for tiny limits).
const aiOk = !ai.error && Array.isArray(ai.choices) && ai.choices.length > 0;
if (!aiOk) problems.push('Free AI (OmniRoute) did not answer' + (ai.error ? ': ' + String(ai.error.message || ai.error).slice(0, 150) : ''));
const tts = $('Check voice service').first().json || {};
if (tts.error || tts.status !== 'ok') problems.push('Voice service (Kokoro/Piper) did not answer');
// Keys: alert when a key that worked before stops working (a key never added yet is not an alarm).
const seen = $getWorkflowStaticData('global');
const serp = $('Check SerpApi key').first().json || {};
const serpOk = !serp.error && (serp.total_searches_left !== undefined || serp.plan_searches_left !== undefined);
if (serpOk) { seen.serpOk = true; const left = Number(serp.total_searches_left ?? serp.plan_searches_left); if (left < 25) problems.push(`SerpApi: only ${left} free searches left this month (resets on the 1st). Market checks use saved results until then.`); }
else if (seen.serpOk) problems.push('SerpApi key stopped working' + (serp.error ? ': ' + String(serp.error.message || serp.error).slice(0, 120) : ''));
const shop = $('Check Shopify key').first().json || {};
const shopOk = !!(shop.data && shop.data.shop && shop.data.shop.name);
if (shopOk) seen.shopOk = true;
else if (seen.shopOk) problems.push('Shopify key stopped working' + (shop.errors || shop.error ? ': ' + JSON.stringify(shop.errors || shop.error.message || shop.error).slice(0, 120) : ''));
const rows = $('Read memory').all().map(i => i.json || {});
const tz = 'America/Toronto';
const nowT = new Date();
const dow = nowT.toLocaleDateString('en-CA', { timeZone: tz, weekday: 'short' });
const hour = Number(nowT.toLocaleString('en-CA', { timeZone: tz, hour: '2-digit', hour12: false })) % 24;
if (hour >= 10 && hour < 12) {
  const day = d => new Date(d).toLocaleDateString('en-CA', { timeZone: tz });
  const sentRecently = rows.some(r => r.kind === 'research' && r.createdAt && day(r.createdAt) === day(nowT));
  if (!sentRecently) problems.push('Today\'s 10:00 product research was not sent (is "JARVIS Research v2" published?)');
}
const local = nowT.toLocaleString('en-CA', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' });
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = '⚠️ <b>JARVIS health check</b> (' + esc(local) + ')\n' + problems.map(p => '• ' + esc(p)).join('\n') +
  '\nSend me (Claude) a photo of this message and I will fix it.';
return [{ json: { send: problems.length > 0, text, kind: 'error', summary: 'Health check problems (' + local + '): ' + problems.join('; ') } }];
