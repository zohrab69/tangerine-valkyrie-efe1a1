// SerpApi for one idea: 2 searches (Google Shopping Canada + Google Trends Canada), cached 10 days.
// Idea checks may use the 40 searches the daily research keeps in reserve, but never go over the free plan.
const p = $('Product identity').first().json;
const acc = $input.first().json || {};
const store = $getWorkflowStaticData('global');
store.serpCache = store.serpCache || {};
const key = p.q.toLowerCase();
const c = store.serpCache[key];
const hasKey = !acc.error && (acc.total_searches_left !== undefined || acc.plan_searches_left !== undefined);
const left = hasKey ? Number(acc.total_searches_left ?? acc.plan_searches_left) : 0;
let source = 'none';
if (p.excluded) source = 'skip';             // not allowed by the owner's rules: don't spend searches
else if (c && Date.now() - c.at < 10 * 864e5) source = 'cache';
else if (hasKey && left >= 2) source = 'fresh';
const warning = source === 'skip' ? null : !hasKey ? 'Market check off: SerpApi key missing or not working.' : left - (source === 'fresh' ? 2 : 0) < 20 ? `⚠️ SerpApi: ${left - (source === 'fresh' ? 2 : 0)} free searches left this month.` : null;
return [{ json: { q: p.q, source, fresh: source === 'fresh', left, has_key: hasKey, warning } }];
