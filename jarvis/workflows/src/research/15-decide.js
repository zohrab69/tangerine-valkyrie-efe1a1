// On-demand entry (webhook from JARVIS's brain, Telegram or the screen): run research now, or resend
// the latest saved report. mode: "run" | "resend" | "auto" (auto = resend today's report if there is
// one, otherwise run now). Input: the latest research_report row from jarvis_memory.
const TZ = 'America/Toronto';
const body = ($('Webhook (run or resend)').first().json || {}).body || {};
const mode = ['run', 'resend', 'auto'].includes(body.mode) ? body.mode : 'auto';
const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
let last = null;
const row = $input.first().json || {};
if (row.kind === 'research_report' && row.summary) { try { last = JSON.parse(row.summary); } catch (e) { last = null; } }
let action = mode;
if (mode === 'auto') action = last && last.day === today ? 'resend' : 'run';
if (action === 'resend' && !last) action = 'run';
// Do not start a second run within 15 minutes (a run takes a few minutes and uses CJ/SerpApi).
const store = $getWorkflowStaticData('global');
if (action === 'run' && store.lastRunAt && Date.now() - store.lastRunAt < 15 * 60 * 1000) action = last ? 'resend' : 'busy';
if (action === 'run') store.lastRunAt = Date.now();
const said = { run: "I'm running product research now. The top 5 will arrive on Telegram in a few minutes.",
               resend: `Sending ${last && last.day === today ? "today's" : 'the latest'} products${last ? ' (' + last.day + ')' : ''} to your Telegram now.`,
               busy: 'Product research is already running. The results will arrive on Telegram in a few minutes.' }[action];
const reply = { ok: true, action, day: last ? last.day : null, message: said,
  products: last ? last.items.map(i => String(i.text || '').split('\n')[0].replace(/<[^>]+>/g, '')) : [] };
return [{ json: { action, reply, last, keywords: Array.isArray(body.keywords) ? body.keywords : null } }];
