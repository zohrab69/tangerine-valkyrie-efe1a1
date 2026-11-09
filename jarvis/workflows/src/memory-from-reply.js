// Remember what happened (sample decisions, approvals) so JARVIS can answer "did I accept anything?".
const KIND = '__KIND__';
const j = $input.first().json || {};
const day = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
let text = '';
if (KIND === 'approval') {
  const d = j.decision || {};
  const status = { approved: 'APPROVED by the owner', rejected: 'DECLINED by the owner', expired_rejected: 'no answer in 48 h, treated as declined' }[j.approval_status] || j.approval_status;
  text = `Approval request (${day}): "${String(d.summary || '').slice(0, 200)}" because ${(j.approval_reasons || []).join('; ')}. Result: ${status}. Nothing was carried out automatically.`;
} else {
  text = `Sample request (${day}): ` + String(j.reply_text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 600);
}
return [{ json: { kind: KIND, summary: text.slice(0, 1500) } }];
