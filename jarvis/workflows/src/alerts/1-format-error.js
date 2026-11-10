// A JARVIS workflow failed (n8n Error Trigger). Build a short Telegram alert; skip repeats of the
// same problem within 60 minutes so one broken step cannot flood the owner's phone.
const j = $input.first().json || {};
const ex = j.execution || {}, wf = j.workflow || {}, er = ex.error || {};
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wfName = wf.name || 'a workflow';
const step = ex.lastNodeExecuted || (er.node && er.node.name) || 'unknown step';
const msg = String(er.message || er.description || 'no error message').replace(/\s+/g, ' ').slice(0, 300);
const store = $getWorkflowStaticData('global');
store.recent = store.recent || {};
const key = wfName + '|' + step + '|' + msg.slice(0, 80);
const now = Date.now();
for (const k of Object.keys(store.recent)) if (now - store.recent[k] > 3600e3) delete store.recent[k];
const repeat = !!store.recent[key];
store.recent[key] = now;
const local = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
const text = [
  '⚠️ <b>JARVIS: something failed</b>',
  'Workflow: <b>' + esc(wfName) + '</b>',
  'Step: ' + esc(step),
  'Problem: ' + esc(msg),
  'When: ' + esc(local) + (ex.mode ? ' (' + esc(ex.mode) + ' run)' : ''),
  ex.url ? 'Details: ' + esc(ex.url) : '',
  'Nothing else was changed. Send me (Claude) a photo of this message and I will fix it.',
].filter(Boolean).join('\n');
return [{ json: { send: !repeat, text, kind: 'error', summary: `Error in workflow "${wfName}" at step "${step}" (${local}): ${msg}` } }];
