// Research plan: which searches to run this time, and whether we need a new CJ token.
// Daily at 10:00 (Toronto) + on demand. Owner rules: see the product rules in "Screen products".
// Holiday season (Black Friday, Christmas): prefer CJ products already in a US or Canada warehouse
// (fast delivery), so every theme is searched in the CA and US warehouses, then in China.
const CONFIG = {
  keywords: [
    'kitchen gadget', 'kitchen organizer', 'pet grooming', 'pet bowl', 'home storage',
    'closet organizer', 'bathroom accessories', 'car organizer', 'winter car accessories',
    'phone stand', 'cable organizer', 'desk organizer', 'christmas decoration', 'gift for him',
    'travel accessories', 'cleaning brush', 'yoga accessories', 'camping gear',
  ],
  per_run: 3,              // themes per run (each theme = 3 CJ searches: CA, US, CN warehouses)
  page_size: 40,           // CJ sorts by how many stores list each product (orderBy=listedNum)
  warehouses: ['CA', 'US', 'CN'],
};
const store = $getWorkflowStaticData('global');
const start = (store.kwIndex || 0) % CONFIG.keywords.length;
const picked = [0, 1, 2].slice(0, CONFIG.per_run).map(i => CONFIG.keywords[(start + i) % CONFIG.keywords.length]);
store.kwIndex = start + CONFIG.per_run;
// Owner can force themes ("research phone stands") through the webhook or another workflow.
const inp = $input.first().json || {};
const forced = inp.keywords || (inp.body && inp.body.keywords) || null;
const keywords = Array.isArray(forced) && forced.length ? forced.slice(0, 3).map(k => String(k).slice(0, 40)) : picked;
const t = store.cjToken;
const tokenOk = t && t.value && t.expires && new Date(t.expires).getTime() - Date.now() > 24 * 3600 * 1000;
return [{ json: { run_id: 'research_' + Date.now().toString(36), keywords, page_size: CONFIG.page_size, warehouses: CONFIG.warehouses,
                  need_token: !tokenOk, token: tokenOk ? t.value : null } }];
