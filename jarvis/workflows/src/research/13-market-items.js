// One market check per shortlisted product: a short, searchable name (CJ titles are long and noisy).
const STOP = /\b(new|hot|sale|car styling|accessories|accessory|for|with|and|the|multi ?functional|portable|creative|household|tool|tools|1pc|pcs|set)\b/gi;
const top = $('Shortlist').first().json.top || [];
return top.map((p, i) => {
  const q = String(p.name).split(/[-,|(]/)[0].replace(STOP, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ');
  return { json: { i, q: q || String(p.name).slice(0, 40) } };
});
