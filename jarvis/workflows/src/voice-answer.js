// Build what the JARVIS screen shows and says. Runs for answers and for "no AI available".
const j = $input.first().json;
const fr = ($('Voice request').first().json.lang || 'en') === 'fr';
let spoken, ok = true;
if (j.message_to_owner || !j.decision) {
  ok = false;
  spoken = fr ? "Désolé, je n'ai pas pu obtenir de réponse d'une IA pour le moment. Réessayez dans une minute."
              : "Sorry, I couldn't get an answer from any AI right now. Please try again in a minute.";
} else {
  spoken = String(j.decision.spoken_reply || j.decision.summary || (fr ? "C'est noté." : 'Noted.')).slice(0, 600);
  if (j.needs_approval) spoken += fr ? " Cela demande votre approbation : je vous ai envoyé la demande sur Telegram."
                                     : " This needs your approval, so I've sent the request to your Telegram.";
}
const d = j.decision || {};
return [{ json: { ...j, voice_response: {
  ok, spoken,
  task_id: j.task_id || null,
  department: d.department || null,
  priority: d.priority || null,
  summary: d.summary || null,
  steps: Array.isArray(d.steps) ? d.steps.slice(0, 5).map(s => (typeof s === 'string' ? s : JSON.stringify(s))) : [],
  data_needed: Array.isArray(d.data_needed) ? d.data_needed.slice(0, 6) : [],
  needs_approval: !!j.needs_approval,
  approval_reasons: j.approval_reasons || [],
  answered_by: j.answered_by || null,
  model: j.model || null,
  cost_cad: typeof j.cost_cad === 'number' ? j.cost_cad : 0,
  error: ok ? null : (j.message_to_owner || j.parse_error || 'no answer'),
} } }];
