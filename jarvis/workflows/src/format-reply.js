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
    'Needs your approval: ' + (d.needs_owner_approval ? 'YES - ' + (d.approval_reason || '') : 'no'),
    'Data needed: ' + (data.length ? data.join('; ') : 'none'),
    'Answered by: ' + j.answered_by + ' (' + j.model + '), cost: ' + j.cost_cad + ' CAD',
  ];
}
return [{ json: { reply_text: lines.join('\n').slice(0, 4000) } }];
