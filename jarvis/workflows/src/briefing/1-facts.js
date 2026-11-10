// Morning briefing: collect true facts from JARVIS memory (no guessing), then ask the free AI to phrase them.
const TZ = 'America/Toronto';
const rows = $input.all().map(i => i.json || {}).filter(r => r.summary && r.createdAt)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
const now = new Date();
const local = d => new Date(d).toLocaleString('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const hoursAgo = d => (now - new Date(d)) / 3600e3;
const later = (r, kind) => rows.some(x => x.kind === kind && new Date(x.createdAt) > new Date(r.createdAt));
const lastResearch = rows.find(r => r.kind === 'research');
const waiting = rows.filter(r => (r.kind === 'approval_pending' && !later(r, 'approval')) || (r.kind === 'sample_pending' && !later(r, 'sample')))
  .filter(r => hoursAgo(r.createdAt) < 48);
const decided = rows.filter(r => (r.kind === 'approval' || r.kind === 'sample') && hoursAgo(r.createdAt) < 24);
const errors = rows.filter(r => r.kind === 'error' && hoursAgo(r.createdAt) < 24);
const dow = now.toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'long' });
const today = now.toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
const facts = {
  today,
  latest_research: lastResearch ? { when: local(lastResearch.createdAt), summary: lastResearch.summary.slice(0, 900) } : null,
  next_research: (dow === 'Monday' && Number(now.toLocaleString('en-CA', { timeZone: TZ, hour: '2-digit', hour12: false })) % 24 < 10) ? 'today at 10:00' : 'next Monday at 10:00',
  waiting_for_owner: waiting.map(r => r.summary.slice(0, 300)),
  decisions_last_24h: decided.map(r => r.summary.slice(0, 300)),
  problems_last_24h: errors.map(r => r.summary.slice(0, 300)),
  stage: 'Shopify store not open yet; product research and sample testing. Next step: pick a healthy (green) product with good profit and fast delivery, reply "sample" to its photo, then set up Shopify.',
};
const instructions = 'You are JARVIS, the AI chief operating officer of Zohrab\'s businesses. Write his MORNING BRIEFING from the FACTS only. ' +
  'Never invent numbers, products, meetings, sales or events; if something is empty, say there is nothing to report on it. ' +
  'Reply with JSON only: {"text": "...", "spoken": "..."}. ' +
  'text: for Telegram, max 120 words, plain text, short lines starting with an emoji (☀️ greeting with the date, 📦 research, ⏳ waiting for you, ✅ decisions, ⚠️ problems only if any, 👉 one suggested next step). ' +
  'spoken: the same in 2-4 natural spoken sentences, max 70 words, starting "Good morning, Zohrab."';
return [{ json: { facts, ai_body: { model: 'jarvis-free', max_tokens: 900, response_format: { type: 'json_object' },
  messages: [{ role: 'system', content: instructions }, { role: 'user', content: 'FACTS: ' + JSON.stringify(facts) }] } } }];
