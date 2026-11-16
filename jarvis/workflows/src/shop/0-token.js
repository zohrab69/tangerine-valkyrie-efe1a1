// Shopify access token (Dev Dashboard app, client credentials): valid about 24 h, kept in workflow data.
const store = $getWorkflowStaticData('global');
const r = $input.first().json || {};
if (r.access_token) store.shopToken = { value: r.access_token, until: Date.now() + (Number(r.expires_in) || 86399) * 1000 - 600000 };
const t = store.shopToken;
return [{ json: { ...$('Which check?').first().json, shop_token: t && t.until > Date.now() ? t.value : null,
                  token_error: r.access_token ? null : (r.error ? String(r.error.message || r.error_description || r.error).slice(0, 200) : null) } }];
