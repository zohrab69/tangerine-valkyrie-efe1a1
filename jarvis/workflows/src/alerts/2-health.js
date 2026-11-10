// Daily health check (and Monday 10:40 check that the weekly research report went out).
// Silent when everything is fine; one Telegram alert listing the problems otherwise.
const problems = [];
const ai = $('Check AI (free combo)').first().json || {};
const aiText = ai.choices && ai.choices[0] && ai.choices[0].message && ai.choices[0].message.content;
if (ai.error || !aiText) problems.push('Free AI (OmniRoute) did not answer' + (ai.error ? ': ' + String(ai.error.message || ai.error).slice(0, 150) : ''));
const tts = $('Check voice service').first().json || {};
if (tts.error || tts.status !== 'ok') problems.push('Voice service (Kokoro/Piper) did not answer');
const rows = $('Read memory').all().map(i => i.json || {});
const tz = 'America/Toronto';
const nowT = new Date();
const dow = nowT.toLocaleDateString('en-CA', { timeZone: tz, weekday: 'short' });
const hour = Number(nowT.toLocaleString('en-CA', { timeZone: tz, hour: '2-digit', hour12: false })) % 24;
if (dow === 'Mon' && hour >= 10) {
  const day = d => new Date(d).toLocaleDateString('en-CA', { timeZone: tz });
  const sentRecently = rows.some(r => r.kind === 'research' && r.createdAt && day(r.createdAt) === day(nowT));
  if (!sentRecently) problems.push('The Monday 10:00 product research report was not sent (is "JARVIS Research v1" published?)');
}
const local = nowT.toLocaleString('en-CA', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' });
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = '⚠️ <b>JARVIS health check</b> (' + esc(local) + ')\n' + problems.map(p => '• ' + esc(p)).join('\n') +
  '\nSend me (Claude) a photo of this message and I will fix it.';
return [{ json: { send: problems.length > 0, text, kind: 'error', summary: 'Health check problems (' + local + '): ' + problems.join('; ') } }];
