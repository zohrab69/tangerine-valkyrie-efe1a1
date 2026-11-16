// Keep the CJ access token (valid about 15 days).
const r = $input.first().json || {};
const d = r.data || {};
if (!d.accessToken) throw new Error('CJ did not return an access token: ' + JSON.stringify(r).slice(0, 300));
$getWorkflowStaticData('global').cjToken = { value: d.accessToken, expires: d.accessTokenExpiryDate || new Date(Date.now() + 14 * 864e5).toISOString() };
return [{ json: { ...$('Product identity').first().json, need_token: false, token: d.accessToken } }];
