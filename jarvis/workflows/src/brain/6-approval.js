// Approval request from the agent (tool ask_owner_approval) -> Telegram text with buttons + a memory row.
const b = ($input.first().json || {}).body || {};
const esc = t => String(t ?? '').replace(/([_*`\[])/g, '\\$1');   // Telegram legacy Markdown
const title = String(b.title || 'Approval needed').slice(0, 120);
const details = String(b.details || '').slice(0, 700);
const amount = Number(b.amount_cad) > 0 ? Number(b.amount_cad).toFixed(2) + ' CAD' : null;
const day = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
const approval_text = `*JARVIS asks your approval*\n${esc(title)}` + (amount ? `\nAmount: ${esc(amount)}` : '') + (details ? `\n\n${esc(details)}` : '') +
  '\n\nNothing happens until you approve. No answer in 48 h = declined.';
return [{ json: { title, details, amount, approval_text, kind: 'approval_pending',
  summary: `Waiting for the owner's approval on Telegram (${day}): "${title}"` + (amount ? ` (${amount})` : '') + (details ? `: ${details.slice(0, 300)}` : '') } }];
