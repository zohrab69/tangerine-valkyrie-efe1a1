// Latest JARVIS activity for the screen (polled every ~20 s). Newest first, local time.
const TZ = 'America/Toronto';
const rows = $input.all().map(i => i.json || {}).filter(r => r.summary);
const events = rows.slice(0, 8).map(r => ({
  id: r.id, kind: r.kind || 'note', summary: String(r.summary).slice(0, 600), at: r.createdAt,
  local: r.createdAt ? new Date(r.createdAt).toLocaleString('en-CA', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '',
}));
return [{ json: { events } }];
