// Shopify product (GraphQL productSet): original title and description, CJ photos, price, collection, CJ SKU.
// Active on the Online Store right after the owner's approval.
const rep = $('Report').first().json;
const g = ($input.first().json || {}).data || {};
let cj = {};
try { cj = ($('CJ product details').first().json || {}).data || {}; } catch (e) { cj = {}; }
let imgs = cj.productImageSet || cj.productImage || [];
if (typeof imgs === 'string') { try { imgs = imgs.trim().startsWith('[') ? JSON.parse(imgs) : [imgs]; } catch (e) { imgs = [imgs]; } }
imgs = [...new Set([rep.best && rep.best.image, ...(Array.isArray(imgs) ? imgs : [])].filter(u => typeof u === 'string' && /^https?:\/\//.test(u)).map(u => u.replace(/^http:/, 'https:')))].slice(0, 6);
const words = t => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
const want = words([rep.listing.product_type, rep.listing.tags.join(' '), rep.name, rep.listing.title_en].join(' '));
const cols = ((g.collections || {}).nodes || []).map(c => ({ ...c, score: [...words(c.title)].filter(w => want.has(w)).length }));
cols.sort((a, b) => b.score - a.score);
const collection = cols[0] && cols[0].score > 0 ? cols[0] : null;
const pub = ((g.publications || {}).nodes || []).find(p => /online store|boutique en ligne/i.test(p.name)) || null;
const sku = (rep.best && (rep.best.variant_sku || rep.best.sku)) || '';
const input = {
  title: rep.listing.title_fr, descriptionHtml: rep.listing.description_html, vendor: 'Rangéo', productType: rep.listing.product_type || 'Accessoires',
  tags: [...rep.listing.tags, 'jarvis', 'cj-' + (rep.best ? rep.best.warehouse.toLowerCase() : 'cn')].slice(0, 10), status: 'ACTIVE',
  productOptions: [{ name: 'Title', position: 1, values: [{ name: 'Default Title' }] }],
  variants: [{ optionValues: [{ optionName: 'Title', name: 'Default Title' }], price: String(rep.price_cad), inventoryPolicy: 'CONTINUE',
               inventoryItem: { sku, tracked: false, requiresShipping: true } }],
  files: imgs.map((u, i) => ({ originalSource: u, contentType: 'IMAGE', alt: rep.listing.title_fr + (i ? ' ' + (i + 1) : '') })),
};
if (collection) input.collections = [collection.id];
const query = 'mutation productSet($input: ProductSetInput!, $synchronous: Boolean!) { productSet(synchronous: $synchronous, input: $input) { product { id handle onlineStoreUrl } userErrors { field message } } }';
return [{ json: { gql: { query, variables: { input, synchronous: true } }, publication_id: pub ? pub.id : null, collection: collection ? collection.title : null,
                  images: imgs.length, sku, shop_error: g.errors || ($input.first().json || {}).errors || null } }];
