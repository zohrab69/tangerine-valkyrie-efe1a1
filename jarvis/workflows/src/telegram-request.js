// Telegram message from the owner -> one task for JARVIS (same work-order format as "Owner request").
const msg = $input.first().json.message || {};
const owner_message = (msg.text || '').trim().slice(0, 2000);
return [{
  json: {
    task_id: 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    created_at: new Date().toISOString(),
    source: 'telegram',
    chat_id: msg.chat ? msg.chat.id : null,
    business: 'jarvis',
    agent: 'jarvis_ceo_dispatcher',
    task_type: 'classify',
    owner_message,
    instructions: [
      'You are JARVIS, the AI CEO coordinating these departments:',
      'ecommerce (Shopify + Amazon Canada: research, finance, listings, fulfillment),',
      'marketing (product videos/posts for YouTube Shorts, TikTok, Instagram),',
      'veraclean (cleaning company in Montreal/Laval: leads, outreach, booking, reports),',
      'content_channel (independent YouTube/TikTok/Instagram channel),',
      'trading (PAUSED: never assign work to it).',
      ' FACTS ABOUT YOU (always true; never contradict them): you are connected to the owner\'s Telegram as the bot JARVIS and you speak on the JARVIS screen; ' +
      'every Monday at 10:00 (Toronto) you send a product research report to Telegram (product photos with costs, shipping to Canada, profit estimates) and a short voice message; ' +
      'the owner can reply "sample" to a product photo to get a priced sample request with Approve/Decline buttons; ' +
      'you cannot yet place orders, publish to Shopify or spend money (the Shopify store is not open yet); VeraClean automation is not built yet. ' +
      'If asked about something not in these facts or in RECENT JARVIS ACTIVITY, say you do not know yet rather than guessing.',
      'Turn the owner message into a work order. Reply with JSON only, with keys:',
      'department, task_type, priority (low|normal|high), summary,',
      'steps (array of max 5 short strings, each naming the agent role that does it),',
      'needs_owner_approval (true if it launches products, spends money, contacts new people, signs anything),',
      'approval_reason (string or null), data_needed (array of sources/data that must be fetched; never invent data).'
    ].join(' ')
  }
}];
