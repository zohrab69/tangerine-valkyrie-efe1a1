// Research plan: which searches to run this time, and whether we need a new CJ token.
// Rules from the owner: Canada first, no electronics, no cosmetics. Kids/baby, food,
// supplements and medical items are also skipped (extra Canadian safety/import rules).
const CONFIG = {
  keywords: [
    'kitchen gadget', 'kitchen organizer', 'pet grooming', 'pet bowl', 'home storage',
    'closet organizer', 'bathroom accessories', 'car organizer', 'camping gear',
    'yoga accessories', 'garden tools', 'cleaning brush', 'desk organizer', 'travel accessories',
  ],
  per_run: 3,              // searches per run (CJ allows about 1 request per second)
  page_size: 20,
};
const store = $getWorkflowStaticData('global');
const start = (store.kwIndex || 0) % CONFIG.keywords.length;
const picked = [0, 1, 2].slice(0, CONFIG.per_run).map(i => CONFIG.keywords[(start + i) % CONFIG.keywords.length]);
store.kwIndex = start + CONFIG.per_run;
// Owner can force keywords when calling this workflow from another one (Execute Workflow input).
const forced = ($input.first().json && $input.first().json.keywords) || null;
const keywords = Array.isArray(forced) && forced.length ? forced.slice(0, 5) : picked;
const t = store.cjToken;
const tokenOk = t && t.value && t.expires && new Date(t.expires).getTime() - Date.now() > 24 * 3600 * 1000;
return [{ json: { run_id: 'research_' + Date.now().toString(36), keywords, page_size: CONFIG.page_size,
                  need_token: !tokenOk, token: tokenOk ? t.value : null } }];
