// What JARVIS says out loud after the report (spoken by the free Piper voice on the server). Short, factual, and only about what really happened.
let top = [];
try { top = $('Shortlist').first().json.top || []; } catch (e) { top = []; }
const hNum = Number(new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', hour12: false })) % 24;
const hour = ((hNum % 12) || 12) + (hNum < 12 ? ' AM' : ' PM');
const NAME = 'Zohrab';
const greet = hNum < 12 ? 'Good morning' : hNum < 18 ? 'Good afternoon' : 'Good evening';
let text;
if (top.length) {
  const hits = top.filter(p => p.meets_target).length;
  const best = [...top].sort((a, b) => b.est_profit_cad - a.est_profit_cad)[0];
  const shortName = best.name.split(/[-,|]/)[0].trim().split(/\s+/).slice(0, 6).join(' ');
  text = `${greet}, ${NAME}. It's ${hour}. I've just sent this week's product research to your Telegram: ${top.length} product${top.length === 1 ? '' : 's'}, with photos, shipping times to Canada and profit estimates. ` +
         `The highest estimated profit is about ${Math.round(best.est_profit_cad)} dollars per sale, on the ${shortName}. ` +
         (hits ? `${hits} of them meet${hits === 1 ? 's' : ''} your targets. ` : 'None met both of your targets this week. ') + `These are estimates only; nothing has been ordered. Have a look when you have a moment.`;
} else {
  text = `${greet}, ${NAME}. I ran this week's product research, but no product passed the filters this time. The details are in your Telegram.`;
}
return [{ json: { tts_body: { text: text.slice(0, 1200), lang: 'en', format: 'mp3' }, spoken_text: text } }];
