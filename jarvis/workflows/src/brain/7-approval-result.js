// Owner answered the approval buttons (or 48 h passed): memory row + a short confirmation.
const a = $('Approval text').first().json;
const r = $input.first().json || {};
const approved = r.data ? r.data.approved === true : r.approved === true;
const day = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
const status = approved ? 'APPROVED by the owner' : 'DECLINED by the owner (or no answer in 48 h)';
return [{ json: { kind: 'approval', summary: `Approval request (${day}): "${a.title}"${a.amount ? ' (' + a.amount + ')' : ''}. Result: ${status}. JARVIS must still carry it out step by step; nothing was done automatically.`,
  reply_text: approved ? `✅ Approved: ${a.title}. I've noted it; I'll tell you each step before anything is bought or published.` : `❌ Declined: ${a.title}. Nothing was done.` } }];
