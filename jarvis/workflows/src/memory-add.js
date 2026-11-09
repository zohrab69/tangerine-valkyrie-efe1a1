// Gives JARVIS a shared memory: the latest entries from the n8n data table "jarvis_memory"
// (written by other JARVIS workflows, e.g. the Monday research report). Works with an empty table.
const task = $('__SRC__').first().json;
const rows = $input.all().map(i => i.json || {}).filter(r => r.summary);
const mem = rows.slice(0, 3).map(r => `[${String(r.createdAt || '').slice(0, 16).replace('T', ' ')} UTC] ${r.kind || 'note'}: ${String(r.summary).slice(0, 900)}`).join('\n');
const add = mem ? ' RECENT JARVIS ACTIVITY (memory, newest first; you may use and quote it):\n' + mem
                : ' RECENT JARVIS ACTIVITY: nothing recorded yet.';
return [{ json: { ...task, instructions: task.instructions + add } }];
