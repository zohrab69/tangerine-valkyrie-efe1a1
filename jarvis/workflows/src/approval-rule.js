// Approval rule: the AI's needs_owner_approval can only be made STRICTER here, never relaxed.
// Mirrors jarvis/config/approval-policy.json ("owner_approval_required").
const j = $input.first().json;
const d = j.decision || {};
const task = $('Router (multi-AI)').first().json;
const text = [task.owner_message, d.summary, ...(Array.isArray(d.steps) ? d.steps : [])]
  .map(x => (typeof x === 'string' ? x : JSON.stringify(x || ''))).join(' ').toLowerCase();

const RULES = [
  [/\b(launch|publish|go live|list (it|them|on)|put (it|them) on)\b/, 'launches or publishes a product/listing'],
  [/\b(buy|purchase|pay|spend|order samples?|place an order|invoice)\b/, 'spends money'],
  [/\b(ads?|advertis\w*|campaign budget|boost)\b/, 'advertising'],
  [/\b(subscri\w+|upgrade (plan|to)|paid plan)\b/, 'new subscription / recurring charge'],
  [/\b(contract|sign|agreement|quote outside|discount)\b/, 'contract, signature or unusual price'],
  [/\b(refund|chargeback|dispute)\b/, 'refund or dispute'],
  [/\b(email|contact|message|call|reach out|outreach)\b.{0,40}\b(prospects?|leads?|clients?|customers?|managers?|owners?|companies)\b/, 'contacts new people (CASL)'],
  [/\b(change (the )?price|price change|raise prices?|lower prices?)\b/, 'price change'],
  [/\b(api key|password|permission|account settings?)\b/, 'account / security change'],
];
const reasons = RULES.filter(([re]) => re.test(text)).map(([, why]) => why);
const money = text.match(/\$?\s?(\d{2,})\s?(cad|\$|dollars?)/);
if (money && Number(money[1]) > 25 && /\b(spend|pay|buy|budget|cost us)\b/.test(text)) reasons.push('expense above 25 CAD');

const aiSaysYes = d.needs_owner_approval === true;
const needs = !j.message_to_owner && !!j.decision && (aiSaysYes || reasons.length > 0);
const why = [...new Set([...(aiSaysYes && d.approval_reason ? [d.approval_reason] : []), ...reasons])];

// Telegram "send and wait" always uses legacy Markdown: escape its special characters.
const md = t => String(t).replace(/([_*`\[])/g, '\\$1');
const steps = Array.isArray(d.steps) ? d.steps : [];
const approval_text = [
  '*JARVIS needs your approval*',
  'Task: ' + md(j.task_id || ''),
  'Request: ' + md(task.owner_message || ''),
  'Plan: ' + md(d.summary || ''),
  ...steps.slice(0, 5).map((s, i) => md((i + 1) + '. ' + (typeof s === 'string' ? s : JSON.stringify(s)))),
  'Why approval: ' + md(why.join('; ') || 'policy'),
  'No answer within 48 hours = rejected.',
].join('\n').slice(0, 3500);

return [{ json: { ...j, needs_approval: needs, approval_reasons: why, approval_text, approval_status: needs ? 'pending' : 'not_needed' } }];
