// After the resent photos: the summary, plus the text of any product whose photo could not be sent.
const reports = $('Resend saved report').all().map(i => i.json);
const results = $input.all().map(i => i.json || {});
const failed = reports.filter((r, i) => r.text && (!results[i] || results[i].error || !r.has_photo));
let msg = reports.length ? reports[0].summary : '';
if (failed.length) msg = failed.map(r => r.text).join('\n\n') + '\n\n' + msg;
return [{ json: { report: msg.slice(0, 4000) } }];
