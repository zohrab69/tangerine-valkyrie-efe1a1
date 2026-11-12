// After the product photos (runs once): the summary, plus the full text of any product whose photo
// could not be sent (no image, or Telegram rejected it), so nothing is lost.
const reports = $('Report').all().map(i => i.json);
const results = $input.all().map(i => i.json || {});
const failed = reports.filter((r, i) => r.text && (!results[i] || results[i].error || !r.has_photo));
let msg = reports.length ? reports[0].summary : '';
if (failed.length) msg = failed.map(r => r.text).join('\n\n') + '\n\n' + msg;
return [{ json: { report: msg.slice(0, 4000) } }];
