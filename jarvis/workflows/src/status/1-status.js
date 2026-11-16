// Command center data for the JARVIS screen. REAL data only: n8n workflows + executions (n8n API) and jarvis_memory.
// Anything not connected or not built is reported as such, never filled with sample numbers.
const TZ = 'America/Toronto';
const TEAMS = [
  { id: 'jarvis', name: 'JARVIS (CEO)', workflows: ['JARVIS Telegram v5', 'JARVIS Voice v1', 'JARVIS Events v1', 'JARVIS Briefing v1', 'JARVIS Alerts v1', 'JARVIS Status v1'] },
  { id: 'research', name: 'Product research', workflows: ['JARVIS Research v1'] },
  { id: 'analysis', name: 'Analysis / store', workflows: ['JARVIS Shop v1'] },
  { id: 'content', name: 'Content & video', workflows: [] },
  { id: 'marketing', name: 'Marketing', workflows: [] },
  { id: 'amazon', name: 'Amazon FBA', workflows: [] },
  { id: 'care', name: 'Customer service', workflows: [] },
  { id: 'finance', name: 'Finance', workflows: [] },
];
const wfRes = $('n8n workflows').first().json || {};
const exRes = $('n8n executions').first().json || {};
const apiOk = Array.isArray(wfRes.data);
const wfs = apiOk ? wfRes.data : [];
const exs = Array.isArray(exRes.data) ? exRes.data : [];
const mem = $('Read memory').all().map(i => i.json || {}).filter(r => r.summary && r.createdAt)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
const now = Date.now(), day = d => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }), today = day(now);
const local = d => new Date(d).toLocaleString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const agentOf = (prefix) => {
  const w = wfs.find(x => String(x.name).startsWith(prefix));
  if (!w) return { name: prefix.replace(/^JARVIS /, ''), status: apiOk ? 'not installed' : 'unknown' };
  const runs = exs.filter(e => String(e.workflowId) === String(w.id));
  const last = runs[0];
  let status = w.active ? 'idle' : 'off';
  if (runs.some(e => e.status === 'running' || e.status === 'new')) status = 'running';
  else if (runs.some(e => e.status === 'waiting')) status = 'waiting on you';
  else if (last && (last.status === 'error' || last.status === 'crashed') && now - new Date(last.startedAt) < 24 * 3600e3) status = 'error';
  return { name: w.name.replace(/^JARVIS /, ''), status, active: !!w.active, last_run: last ? local(last.startedAt) : null, last_status: last ? last.status : null };
};
const teams = TEAMS.map(t => {
  const agents = t.workflows.map(agentOf);
  const st = !agents.length ? 'not built' : !apiOk ? 'unknown' : agents.some(a => a.status === 'error') ? 'error'
    : agents.some(a => a.status === 'running') ? 'running' : agents.some(a => a.status === 'waiting on you') ? 'waiting on you'
    : agents.every(a => a.status === 'off' || a.status === 'not installed') ? 'off' : 'idle';
  return { id: t.id, name: t.name, agents, status: st };
});

// Scoreboard (real numbers only; null = not available yet)
const ordersToday = mem.filter(r => r.kind === 'order' && day(r.createdAt) === today);
const num = (s, re) => { const m = String(s).match(re); return m ? Number(m[1]) : null; };
const sales = ordersToday.reduce((a, r) => a + (num(r.summary, /total ([\d.]+)/) || 0), 0);
const profits = ordersToday.map(r => num(r.summary, /est\. profit ~(-?[\d.]+)/));
const shopConnected = teams[2].agents.some(a => a.active);
const scoreboard = {
  orders_today: shopConnected ? ordersToday.length : null,
  sales_today_cad: shopConnected ? +sales.toFixed(2) : null,
  est_profit_today_cad: shopConnected && profits.every(p => p !== null) ? +profits.reduce((a, b) => a + b, 0).toFixed(2) : null,
  products_live: null,            // needs the Shopify product count (comes with the Analysis team)
  videos_ready: null,             // Content & video team not built yet
  agent_runs_today: apiOk ? exs.filter(e => e.startedAt && day(e.startedAt) === today).length : null,
};

// Needs your yes: pending items with no later decision of the same type (decided on Telegram)
const later = (r, k) => mem.some(x => x.kind === k && new Date(x.createdAt) > new Date(r.createdAt));
const pending = mem.filter(r => ((r.kind === 'approval_pending' && !later(r, 'approval')) || (r.kind === 'sample_pending' && !later(r, 'sample')))
  && now - new Date(r.createdAt) < 48 * 3600e3).map(r => ({ kind: r.kind, text: r.summary.replace(/^[^:]*\):\s*/, '').slice(0, 220), at: local(r.createdAt) }));

// Agent log: memory events + recent runs
const nameOf = id => { const w = wfs.find(x => String(x.id) === String(id)); return w ? w.name.replace(/^JARVIS /, '') : 'workflow ' + id; };
const log = [
  ...mem.slice(0, 15).map(r => ({ at: r.createdAt, who: ({ research: 'Research', order: 'Store', sample: 'Samples', sample_pending: 'Samples', approval: 'Approvals',
      approval_pending: 'Approvals', briefing: 'Briefing', error: 'Alerts' })[r.kind] || r.kind, text: r.summary.slice(0, 200) })),
  ...exs.filter(e => e.mode !== 'webhook' || e.status !== 'success').slice(0, 15)
    .map(e => ({ at: e.startedAt, who: nameOf(e.workflowId), text: e.status === 'success' ? 'finished' : e.status === 'waiting' ? 'waiting on you' : e.status })),
].filter(x => x.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20).map(x => ({ ...x, at: local(x.at) }));

// Connections (inferred from real activity)
const lastResearch = mem.find(r => r.kind === 'research');
const agent = n => teams.flatMap(t => t.agents).find(a => a.name.startsWith(n)) || {};
const connections = [
  { name: 'Telegram', ok: !!agent('Telegram').active, note: agent('Telegram').active ? 'connected' : 'workflow off' },
  { name: 'Free AI (OmniRoute)', ok: agent('Voice').last_status !== 'error', note: 'Groq + Gemini' },
  { name: 'CJ Dropshipping', ok: agent('Research').last_status === 'success', note: agent('Research').last_run ? 'last research ' + agent('Research').last_run : 'no run yet' },
  { name: 'SerpApi (market check)', ok: !!(lastResearch && /market ~/.test(lastResearch.summary)), note: lastResearch && /market ~/.test(lastResearch.summary) ? 'connected' : 'needs key' },
  { name: 'Shopify', ok: shopConnected, note: shopConnected ? 'orders connected' : 'needs token' },
  { name: 'n8n API', ok: apiOk, note: apiOk ? 'connected' : 'needs key' },
  { name: 'Amazon', ok: false, note: 'later' },
];
return [{ json: { generated: local(now), teams, scoreboard, pending, log, connections } }];
