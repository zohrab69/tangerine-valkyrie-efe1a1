// Owner request -> one task for JARVIS. Edit "owner_message" to test.
// Later this node is replaced by a Telegram/email/chat trigger.
const owner_message = 'Find 3 product ideas we could sell in Canada for under 60 CAD, with reliable shipping.';
return [{
  json: {
    task_id: 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    created_at: new Date().toISOString(),
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
      'Turn the owner message into a work order. Reply with JSON only, with keys:',
      'department, task_type, priority (low|normal|high), summary,',
      'steps (array of max 5 short strings, each naming the agent role that does it),',
      'needs_owner_approval (true if it launches products, spends money, contacts new people, signs anything),',
      'approval_reason (string or null), data_needed (array of sources/data that must be fetched; never invent data).'
    ].join(' ')
  }
}];
