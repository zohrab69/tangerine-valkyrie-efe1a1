// Keep the CJ access token (valid about 15 days; CJ limits how often a new one can be requested).
const r = $input.first().json || {};
const d = r.data || {};
const value = d.accessToken || d.access_token || null;
if (!value) throw new Error('CJ did not return an access token: ' + JSON.stringify(r).slice(0, 300));
const expires = d.accessTokenExpiryDate || new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
const store = $getWorkflowStaticData('global');
store.cjToken = { value, expires };
const plan = $('Research plan').first().json;
return [{ json: { ...plan, need_token: false, token: value } }];
