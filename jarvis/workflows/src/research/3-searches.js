// One item per keyword -> one CJ product search each.
const plan = $input.first().json;
return plan.keywords.map(k => ({ json: { keyword: k, token: plan.token, page_size: plan.page_size, run_id: plan.run_id } }));
