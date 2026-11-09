// Keep the CJ access token (about 15 days; CJ limits how often a new one can be requested).
const r = $input.first().json || {};
const d = r.data || {};
const value = d.accessToken || d.access_token || null;
const req = $('Read the reply').first().json;
if (!value) return [{ json: { ...req, token: null, token_error: (r.message || 'CJ did not return an access token').slice(0, 200) } }];
const store = $getWorkflowStaticData('global');
store.cjToken = { value, expires: d.accessTokenExpiryDate || new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString() };
return [{ json: { ...req, need_token: false, token: value } }];
