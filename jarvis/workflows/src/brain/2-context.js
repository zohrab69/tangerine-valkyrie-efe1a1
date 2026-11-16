// JARVIS's system prompt: what he knows (docs/JARVIS-CONTEXT.md, built in), recent memory, and how to answer here.
const CONTEXT = __CONTEXT__;
const r = $('Request').first().json;
const TZ = 'America/Toronto';
const now = new Date();
const local = d => new Date(d).toLocaleString('en-CA', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
const ago = d => { const m = Math.round((now - new Date(d)) / 60000); return m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
const rows = $input.all().map(i => i.json || {}).filter(x => x.summary && x.kind !== 'research_report');
const memory = rows.slice(0, 12).map(x => `[${x.createdAt ? local(x.createdAt) + ', ' + ago(x.createdAt) : '?'}] ${x.kind || 'note'}: ${String(x.summary).slice(0, 700)}`).join('\n');
const howToAnswer = r.channel === 'voice'
  ? 'The owner is SPEAKING to you on the JARVIS screen; your answer is read aloud. Answer in at most 3 short, natural sentences (max 60 words), no lists, no markdown, no emojis. Speech recognition sometimes mishears words: use the conversation to understand what was meant.'
  : 'The owner is writing to you on Telegram. Answer clearly and briefly (max 150 words). Plain text, short lines, no markdown tables, no ** or #.';
const lang = r.lang === 'fr' ? 'Answer in French.' : 'Answer in English unless the owner writes in French.';
const system = [
  'You are JARVIS, the AI chief operating officer of the owner\'s businesses. Calm, concise, practical, a little warm. Call the owner Zohrab now and then.',
  'Current date and time (Toronto): ' + local(now) + ', ' + now.toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'long' }) + '.',
  howToAnswer, lang,
  'Use your tools when the owner asks for something they cover: products_today (today\'s products, what is selling or viral today: it also sends them to Telegram), run_product_research (new research on themes), ' +
  'check_product_idea (one product the owner names), memory_search (what happened: orders, samples, approvals, research, errors), profit_calculator (price and profit math), ' +
  'morning_briefing (send a briefing to Telegram now), ask_owner_approval (anything that spends money, publishes, changes prices, orders, posts or contacts people). ' +
  'Call at most 2 tools per answer. Only state numbers that come from a tool result, the memory below or the knowledge below. Never say something was done, sent or bought unless a tool result says so.',
  'If you cannot do something yet, say so in one sentence and suggest what to build next.',
  '=== WHAT YOU KNOW ===\n' + CONTEXT,
  '=== RECENT JARVIS ACTIVITY (newest first, from memory) ===\n' + (memory || '(nothing recorded yet)'),
].join('\n\n');
const hist = (r.history || []).map(h => `Owner: ${String(h && h.you || '').slice(0, 300)} | JARVIS: ${String(h && h.jarvis || '').slice(0, 300)}`).join('\n');
return [{ json: { system, prompt: r.text + (r.channel === 'voice' && hist ? '' : ''), session: r.session, channel: r.channel } }];
