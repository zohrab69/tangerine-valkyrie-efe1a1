// Nothing passed the screen: tell the owner why instead of staying silent.
const r = $input.first().json || {};
const plan = $('Research plan').first().json;
const why = (r.notes && r.notes.length) ? r.notes.join('; ') : 'no product passed the filters (price, excluded categories)';
return [{ json: { report: 'JARVIS product research (' + plan.keywords.join(', ') + '): no candidates this time. ' + why.replace(/[<>&]/g, ' ') } }];
