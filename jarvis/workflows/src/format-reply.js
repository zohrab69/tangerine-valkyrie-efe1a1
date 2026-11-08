// Turn JARVIS's result (or a failure) into a short Telegram message for the owner.
const j = $input.first().json;
let lines;
if (j.message_to_owner) {
  lines = [j.message_to_owner];
} else if (!j.decision) {
  lines = ['JARVIS: I could not read the AI answer for task ' + j.task_id + ' (' + (j.parse_error || 'empty answer') + '). Please try again.'];
} else {
  const d = j.decision;
  const steps = Array.isArray(d.steps) ? d.steps : [];
  const data = Array.isArray(d.data_needed) ? d.data_needed : [];
  lines = [
    'JARVIS work order ' + j.task_id,
    'Department: ' + (d.department || '?') + ' | Priority: ' + (d.priority || '?'),
    'Summary: ' + (d.summary || ''),
    'Steps:',
    ...steps.map((s, i) => (i + 1) + '. ' + (typeof s === 'string' ? s : JSON.stringify(s))),
    'Needs your approval: ' + (j.needs_approval ? 'YES - ' + (j.approval_reasons || []).join('; ') : 'no'),
    'Data needed: ' + (data.length ? data.join('; ') : 'none'),
    'Answered by: ' + j.answered_by + ' (' + j.model + '), cost: ' + j.cost_cad + ' CAD',
  ];
  const STATUS = {
    approved: 'Your decision: APPROVED. JARVIS will continue with this plan.',
    rejected: 'Your decision: REJECTED. JARVIS will not do this.',
    expired_rejected: 'No answer within 48 hours: treated as REJECTED.',
  };
  if (STATUS[j.approval_status]) lines.push(STATUS[j.approval_status]);
}
// Sent with parse_mode HTML: escape the three characters HTML treats specially.
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
return [{ json: { reply_text: esc(lines.join('\n')).slice(0, 4000) } }];
