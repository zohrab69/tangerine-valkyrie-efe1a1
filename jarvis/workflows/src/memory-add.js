// Gives JARVIS a shared memory: the latest entries from the n8n data table "jarvis_memory"
// (written by other JARVIS workflows, e.g. the Monday research report). Works with an empty table.
const task = $('__SRC__').first().json;
const rows = $input.all().map(i => i.json || {}).filter(r => r.summary);
// Times in the owner's time zone (Toronto/Montreal), with "x minutes ago", so JARVIS can answer "just now?" correctly.
const TZ = 'America/Toronto';
const local = d => new Date(d).toLocaleString('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ago = d => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
const mem = rows.slice(0, 6).map(r => `[${r.createdAt ? local(r.createdAt) + ', ' + ago(r.createdAt) : 'time unknown'}] ${r.kind || 'note'}: ${String(r.summary).slice(0, 900)}`).join('\n');
const now = 'CURRENT TIME for the owner (Montreal/Toronto): ' + local(Date.now()) + '. Always speak in this local time, never UTC.';
const add = mem ? ' RECENT JARVIS ACTIVITY (memory, newest first; you may use and quote it):\n' + mem
                : ' RECENT JARVIS ACTIVITY: nothing recorded yet.';
return [{ json: { ...task, instructions: task.instructions + ' ' + now + add } }];
