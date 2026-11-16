// Final answer for Telegram (plain text) and for the screen (spoken + shown). Works for the agent's
// answer, for "send me the products" (research webhook reply) and for errors.
const r = $('Request').first().json;
const j = $input.first().json || {};
const fr = r.lang === 'fr';
let answer = '', ok = true, products = [];
if (j.output !== undefined) answer = String(j.output || '');
else if (j.message && j.action) { answer = j.message; products = Array.isArray(j.products) ? j.products : []; }
else if (j.error) { ok = false; }
answer = answer.replace(/\*\*|__|^#+\s*/gm, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
if (!answer) { ok = false; answer = fr ? "Désolé, je n'ai pas pu répondre pour le moment. Réessayez dans une minute." : "Sorry, I couldn't get an answer right now. Please try again in a minute."; }
const telegram_text = (products.length ? answer + '\n' + products.slice(0, 5).join('\n') : answer).slice(0, 4000);
const spoken = answer.replace(/https?:\/\/\S+/g, 'the link on Telegram').replace(/[•*_`#>]/g, '').replace(/\s+/g, ' ').slice(0, 700);
return [{ json: { channel: r.channel, chat_id: r.chat_id, telegram_text,
  voice_response: { ok, spoken, summary: products.length ? products.slice(0, 5).join(' · ') : null, steps: products.slice(0, 5),
                    needs_approval: false, answered_by: 'JARVIS agent', model: 'jarvis-free', cost_cad: 0, error: ok ? null : 'no answer' } } }];
