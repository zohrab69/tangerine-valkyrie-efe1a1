// Live link (or what went wrong) for the owner, and a memory row.
const inp = $('Product for Shopify').first().json;
const rep = $('Report').first().json;
const created = $('Shopify: create product').first().json || {};
const res = (created.data && created.data.productSet) || {};
const errs = (res.userErrors || []).map(e => e.message).concat(created.errors ? [].concat(created.errors).map(e => e.message || String(e)) : []).concat(created.error ? [String(created.error.message || created.error)] : []);
let pubErr = null;
try { const p = $('Publish to Online Store').first().json || {}; const ue = (p.data && p.data.publishablePublish && p.data.publishablePublish.userErrors) || []; if (ue.length || p.errors || p.error) pubErr = (ue[0] && ue[0].message) || JSON.stringify(p.errors || p.error).slice(0, 200); } catch (e) { pubErr = 'not run'; }
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ok = !!(res.product && res.product.handle) && !errs.length;
const link = ok ? (res.product.onlineStoreUrl || 'https://rangeo-ca.myshopify.com/products/' + res.product.handle) : null;
const day = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' });
const text = ok
  ? `🟢 <b>Live on Rangéo</b>: ${esc(rep.listing.title_fr)}\n${esc(link)}\nPrice ${rep.price_cad} CAD · ${inp.images} photo(s) · collection: ${esc(inp.collection || 'none matched')}` +
    (pubErr ? `\n⚠️ Online Store publishing: ${esc(pubErr)}. In Shopify > Products, open it and tick Online Store.` : '') +
    `\n\n<b>One step for you (1 min):</b> in the CJ app (Shopify > Apps > CJdropshipping > Products > Connection), connect this product to CJ SKU ${esc(inp.sku)} so orders go to CJ automatically.` +
    `\n<b>Amazon:</b> when your seller account and SP-API are connected, I'll prepare the Amazon listing and the FBA stock order (about ${rep.fba ? rep.fba.total_cad : '?'} CAD) and ask your approval separately before buying any stock.` +
    '\n🎬 The video team is making 3 short videos now.'
  : `⚠️ <b>Shopify listing failed</b> for ${esc(rep.listing.title_fr)}: ${esc(errs.join('; ') || 'no answer from Shopify')}.\nCheck the Shopify credential (custom app with write_products, read_publications and write_publications). Nothing was published.`;
return [{ json: { ok, link, text, kind: 'listing', summary: ok ? `Listed on Shopify (${day}): ${rep.listing.title_fr} at ${rep.price_cad} CAD, CJ SKU ${inp.sku}, ${link}. Owner must connect it in the CJ app.` : `Shopify listing FAILED (${day}) for ${rep.name}: ${errs.join('; ').slice(0, 300)}` } }];
