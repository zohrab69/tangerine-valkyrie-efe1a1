import fs from 'fs';
const N = {};
const run = () => new Function('$input', '$', fs.readFileSync('1-status.js', 'utf8'))({}, n => ({ first: () => N[n][0], all: () => N[n] }))[0].json;
const ago = h => new Date(Date.now() - h * 3600e3).toISOString();
N['n8n workflows'] = [{ json: { data: [
  { id: '1', name: 'JARVIS Brain v1 (agent: Telegram + screen)', active: true }, { id: '2', name: 'JARVIS Research v1 (CJ products)', active: false }, { id: '6', name: 'JARVIS Research v2 (daily products)', active: true },
  { id: '3', name: 'JARVIS Voice v1 (screen)', active: true }, { id: '4', name: 'JARVIS Shop v1 (Rangéo orders)', active: true }, { id: '5', name: 'JARVIS Alerts v1 (errors + health)', active: true } ] } }];
N['n8n executions'] = [{ json: { data: [
  { id: 9, workflowId: '2', status: 'error', startedAt: ago(1), mode: 'trigger' }, { id: 8, workflowId: '1', status: 'waiting', startedAt: ago(2), mode: 'webhook' },
  { id: 7, workflowId: '3', status: 'success', startedAt: ago(3), mode: 'webhook' } ] } }];
N['Read memory'] = [
  { json: { kind: 'order', summary: 'New Rangéo order #1001 (x): 1x visor; total 45.98 CAD; est. profit ~20.3 CAD', createdAt: ago(0.5) } },
  { json: { kind: 'sample_pending', summary: 'Sample request waiting for the owner\'s approval on Telegram (Nov 16): Rice sieve, quantity 1', createdAt: ago(2) } },
  { json: { kind: 'research', summary: 'Product research report sent ... (CJ SKU x, market ~29.5 CAD, searches rising)', createdAt: ago(5) } } ];
const s = run();
console.log(s.teams.map(t => t.name + ': ' + t.status + ' (' + t.agents.length + ')').join(' | '));
console.log(s.scoreboard); console.log(s.pending); console.log(s.connections.map(c => c.name + (c.ok ? ' ✓ ' : ' ✗ ') + c.note).join(' | '));
console.log(s.log.slice(0, 4));
N['n8n workflows'] = [{ json: { error: '401' } }]; N['n8n executions'] = [{ json: {} }]; N['Read memory'] = [{ json: {} }];
const e = run(); console.log('no api ->', e.teams[0].status, e.scoreboard, e.connections.find(c => c.name === 'n8n API'));
