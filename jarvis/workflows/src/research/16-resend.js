// Resend the saved report: one photo message per product, then the summary (no new searches).
const d = $input.first().json;
const last = d.last || { items: [], summary: '' };
const note = last.day ? `\n<i>Resent from ${last.day}: saved results, no new searches.</i>` : '';
const items = last.items.map((it, i) => ({ json: { photo: it.photo, has_photo: !!it.photo, caption: it.caption, text: it.text,
  summary: (last.summary || '') + note, index: i } }));
return items.length ? items : [{ json: { photo: '', has_photo: false, caption: '', text: '', summary: (last.summary || 'No saved report yet.') + note, index: 0 } }];
