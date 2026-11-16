// The owner's answer to "List on Rangéo?" (Approve / Decline / no answer in 72 h).
const r = $input.first().json || {};
const approved = (r.data ? r.data.approved : r.approved) === true;
const rep = $('Report').first().json;
const day = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
return [{ json: { approved, kind: 'approval', summary: `Listing approval (${day}): ${rep.name} at ${rep.price_cad} CAD - ${approved ? 'APPROVED by the owner: JARVIS lists it on Shopify and makes 3 videos' : 'DECLINED by the owner (or no answer in 72 h): nothing listed'}.`,
  reply_text: approved ? `✅ Approved. Creating "${rep.listing.title_fr}" on Rangéo now...` : `❌ Declined: ${rep.name}. Nothing was listed.` } }];
