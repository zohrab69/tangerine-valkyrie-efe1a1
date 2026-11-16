// Ask the free AI what the product is (it can see the photo) and how to search for it.
const r = $input.first().json;
const page = r.page || {};
const sys = 'IDEA_IDENTIFY. You identify a consumer product for a Canadian dropshipping store. Reply with JSON only: ' +
  '{"name": "short generic product name in English (no brand)", "search_query": "2-4 English words to search suppliers", ' +
  '"category": "one word", "has_battery_or_charger": true|false, "is_beauty": true|false, "for_kids": true|false, "confidence": "high|medium|low"}';
const parts = [];
const hint = [r.text && 'Owner says: ' + r.text, page.title && 'Page title: ' + page.title, page.site && 'Site: ' + page.site, page.price && 'Page price: ' + page.price].filter(Boolean).join('\n');
parts.push({ type: 'text', text: hint || 'What product is in this photo?' });
if (r.image_b64) parts.push({ type: 'image_url', image_url: { url: 'data:' + (r.mime || 'image/jpeg') + ';base64,' + r.image_b64 } });
return [{ json: { ...r, image_b64: null, had_image: !!r.image_b64,
  ai_body: { model: 'jarvis-free', max_tokens: 300, temperature: 0.1, response_format: { type: 'json_object' },
             messages: [{ role: 'system', content: sys }, { role: 'user', content: r.image_b64 ? parts : parts[0].text }] } } }];
