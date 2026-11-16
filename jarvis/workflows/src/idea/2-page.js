// What the linked page says about the product (title, image, price) - no scraping beyond this one page.
const req = $('Idea input').first().json;
const r = $input.first().json || {};
const html = String(r.data || r.body || (typeof r === 'string' ? r : '') || '').slice(0, 400000);
const meta = p => { const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\\\']' + p + '["\\\'][^>]*content=["\\\']([^"\\\']+)', 'i')) || html.match(new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]*(?:property|name)=["\\\']' + p, 'i')); return m ? m[1] : null; };
const title = meta('og:title') || meta('twitter:title') || ((html.match(/<title[^>]*>([^<]{3,200})<\/title>/i) || [])[1] || null);
const image = meta('og:image') || null;
const price = meta('product:price:amount') || meta('og:price:amount') || null;
const site = (req.url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
const decode = s => s ? s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 200) : s;
return [{ json: { ...req, page: { title: decode(title), image: image && /^https:\/\//.test(image) ? image : null, price, site, fetched: !!html } } }];
