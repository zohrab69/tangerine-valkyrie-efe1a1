// Use the AI wording when available; otherwise a plain briefing from the same facts (never silent).
const f = $('Briefing facts').first().json.facts;
let text = '', spoken = '';
try {
  const r = $input.first().json || {};
  const raw = String(r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content || '');
  const m = raw.match(/\{[\s\S]*\}/);                  // tolerate extra words or code fences around the JSON
  if (m) { const o = JSON.parse(m[0]); text = String(o.text || ''); spoken = String(o.spoken || ''); }
  else if (raw.trim().length > 40) { text = raw.trim(); }   // plain text answer: use it as the message
} catch (e) { /* fallback below */ }
if (!text) {
  text = [`☀️ Good morning Zohrab, ${f.today}.`,
    f.latest_research ? `📦 Last product research: ${f.latest_research.when}; next one ${f.next_research}.` : `📦 No product research yet; next one ${f.next_research}.`,
    `⏳ Waiting for you: ${f.waiting_for_owner.length ? f.waiting_for_owner.length + ' item(s) on Telegram' : 'nothing'}.`,
    `✅ Decisions in the last 24 h: ${f.decisions_last_24h.length || 'none'}.`,
    ...(f.problems_last_24h.length ? [`⚠️ Problems in the last 24 h: ${f.problems_last_24h.length}.`] : []),
    '👉 Next step: pick a 🟢 product with good profit and reply "sample" to its photo.'].join('\n');
}
if (!spoken) spoken = `Good morning, Zohrab. Today is ${f.today}. ` + (f.waiting_for_owner.length ? `${f.waiting_for_owner.length} item is waiting for your approval on Telegram. ` : 'Nothing is waiting for your approval. ') + `The next product research is ${f.next_research}.`;
text = text.slice(0, 3500);
return [{ json: { text, tts_body: { text: spoken.slice(0, 1200), lang: 'en', format: 'mp3' },
  kind: 'briefing', summary: ('Morning briefing sent to Telegram: ' + text.replace(/\s+/g, ' ')).slice(0, 1500) } }];
