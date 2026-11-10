// Only the two memory columns (the data table has kind + summary).
const j = $input.first().json;
return [{ json: { kind: j.kind, summary: String(j.summary).slice(0, 1500) } }];
