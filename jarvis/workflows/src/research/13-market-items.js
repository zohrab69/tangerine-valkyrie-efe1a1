// Market check plan, within the FREE SerpApi plan (250 searches a month).
// Each fresh check = 2 searches (Google Shopping + Google Trends). Results are cached 10 days per
// product name and reused. A daily allowance spreads the month's searches; 40 are kept in reserve
// for the owner's own product-idea checks. Never goes over: when the budget is used up, products
// are sent as "market not checked" and the owner is warned.
const CFG = { monthly: 250, reserve_for_ideas: 40, max_per_day: 10, cache_days: 10, per_check: 2, warn_below: 60 };
const STOP = /\b(new|hot|sale|car styling|accessories|accessory|for|with|and|the|multi ?functional|portable|creative|household|tool|tools|1pc|pcs|set)\b/gi;
const store = $getWorkflowStaticData('global');
const TZ = 'America/Toronto';
const now = new Date();
const month = now.toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
const today = now.toLocaleDateString('en-CA', { timeZone: TZ });
const s = store.serp && store.serp.month === month ? store.serp : (store.serp = { month, used: 0, days: {} });
store.serpCache = store.serpCache || {};
// Real numbers from the SerpApi account page (free, does not use a search). Fallback: own counter.
const acc = $input.first().json || {};
const hasKey = !acc.error && (acc.plan_searches_left !== undefined || acc.total_searches_left !== undefined);
const left = hasKey ? Number(acc.total_searches_left ?? acc.plan_searches_left) : Math.max(0, CFG.monthly - s.used);
const [y, m] = month.split('-').map(Number);
const daysInMonth = new Date(y, m, 0).getDate();
const daysLeft = daysInMonth - Number(today.slice(8, 10)) + 1;
const usedToday = s.days[today] || 0;
let allowance = Math.max(0, Math.min(CFG.max_per_day - usedToday, Math.floor((left - CFG.reserve_for_ideas) / daysLeft)));
const top = $('Shortlist').first().json.top || [];
const fresh = [], plan = [];
top.forEach((p, i) => {
  const q = String(p.name).split(/[-,|(]/)[0].replace(STOP, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ') || String(p.name).slice(0, 40);
  const key = q.toLowerCase();
  const c = store.serpCache[key];
  if (c && Date.now() - c.at < CFG.cache_days * 864e5) { plan.push({ i, q, source: 'cache' }); return; }
  if (fresh.some(f => f.q.toLowerCase() === key)) { plan.push({ i, q, source: 'same' }); return; }   // same name: one check
  if (hasKey && allowance >= CFG.per_check) { allowance -= CFG.per_check; fresh.push({ i, q }); plan.push({ i, q, source: 'fresh' }); return; }
  plan.push({ i, q, source: hasKey ? 'budget' : 'no_key' });
});
// Remove cache entries older than 30 days so the workflow data stays small.
for (const [k, v] of Object.entries(store.serpCache)) if (Date.now() - v.at > 30 * 864e5) delete store.serpCache[k];
const planned = fresh.length * CFG.per_check;
const leftAfter = left - planned;
let warning = null;
if (!hasKey) warning = null;   // reported separately as "SerpApi key missing"
else if (leftAfter <= CFG.reserve_for_ideas) warning = `⚠️ SerpApi: only ${leftAfter} free searches left this month. I'm keeping them for your own product checks, so daily market checks use saved results until the 1st. I never go over the free plan without your OK.`;
else if (leftAfter < CFG.warn_below) warning = `⚠️ SerpApi: ${leftAfter} free searches left this month (plan 250). I'm using saved results more to stay free.`;
const meta = { month, today, has_key: hasKey, key_error: acc.error ? String(acc.error.message || acc.error).slice(0, 120) : null,
               left_before: left, planned, left_after: leftAfter, plan, warning };
store.serpLastPlan = meta;
if (!fresh.length) return [{ json: { none: true, meta } }];
return fresh.map(f => ({ json: { ...f, meta } }));
