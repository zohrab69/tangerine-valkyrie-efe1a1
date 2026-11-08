// Request from the JARVIS screen (voice or typed) -> one task, same format as Telegram.
// The page is password-protected by Caddy and calls this webhook with a secret header.
const body = $input.first().json.body || {};
const owner_message = String(body.text || '').trim().slice(0, 2000);
const lang = body.lang === 'fr' ? 'fr' : 'en';
return [{
  json: {
    task_id: 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    created_at: new Date().toISOString(),
    source: 'screen',
    lang,
    business: 'jarvis',
    agent: 'jarvis_ceo_dispatcher',
    task_type: 'classify',
    owner_message,
    instructions: [
      'You are JARVIS, the AI chief operating officer of the owner\'s businesses. Departments:',
      'ecommerce (Shopify + Amazon Canada: research, finance, listings, fulfillment),',
      'marketing (product videos/posts for YouTube Shorts, TikTok, Instagram),',
      'veraclean (cleaning company in Montreal/Laval: leads, outreach, booking, reports),',
      'content_channel (independent YouTube/TikTok/Instagram channel),',
      'trading (PAUSED: never assign work to it).',
      'The owner is speaking to you on the JARVIS screen. Reply with JSON only, with keys:',
      'spoken_reply (1 to 3 short, natural sentences to say out loud, in ' + (lang === 'fr' ? 'French' : 'English') + ', calm and concise; never claim work is done, data was found or money was spent unless it really was),',
      'department, task_type, priority (low|normal|high), summary,',
      'steps (array of max 5 short strings, each naming the agent role that does it),',
      'needs_owner_approval (true if it launches products, spends money, contacts new people, signs anything),',
      'approval_reason (string or null), data_needed (array of sources/data that must be fetched; never invent data).',
      'If the message is small talk or a simple question, still answer in spoken_reply and use department "jarvis" with an empty steps array.'
    ].join(' ')
  }
}];
