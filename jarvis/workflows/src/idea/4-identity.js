// The product, the owner's rules (batteries/chargers, beauty, kids...) and certification flags.
//@include shared/rules.js
const r = $('Identify request').first().json;
const ai = $input.first().json || {};
let id = {};
try { id = JSON.parse(String(ai.choices[0].message.content || '').replace(/^\s*```(?:json)?|```\s*$/g, '')); } catch (e) { id = {}; }
const fallback = (r.text || (r.page && r.page.title) || '').replace(/[^\p{L}\p{N} -]/gu, ' ').trim();
const name = String(id.name || fallback || '').slice(0, 80);
const q = String(id.search_query || name).split(/\s+/).slice(0, 4).join(' ');
const rules = checkRules([name, q, r.text, r.page && r.page.title].filter(Boolean).join(' '));
let excluded = rules.excluded;
if (!excluded && id.has_battery_or_charger === true) excluded = 'has a battery or charger';
if (!excluded && id.is_beauty === true) excluded = 'beauty (kept out for now)';
if (!excluded && id.for_kids === true) excluded = "kids' product (Health Canada toy rules)";
const pageUnread = r.url && !(r.page && r.page.title && !/robot check|captcha|access denied|^amazon\.(ca|com)$/i.test(r.page.title));
const problem = (pageUnread && !r.text) ? "I couldn't read that link (Amazon and some sites block automatic reading). Send me the product name instead, for example: check vibration plate." : (r.had_image && !id.name) ? "I couldn't recognise the product in the photo (the free AI may not read images right now). Send me its name or a link." : !q ? (r.had_image ? "I couldn't tell what the product is from the photo. Send its name or a link." : 'Send me the product name or a link.') : null;
const store = $getWorkflowStaticData('global');
const t = store.cjToken;
const tokenOk = t && t.value && t.expires && new Date(t.expires).getTime() - Date.now() > 24 * 3600 * 1000;
return [{ json: { id: r.id, kind: r.kind, url: r.url, owner_text: r.text, page: r.page || {}, name, q, category: id.category || '',
  confidence: id.confidence || (id.name ? 'medium' : 'low'), excluded, certification: rules.certification, problem,
  need_token: !tokenOk, token: tokenOk ? t.value : null } }];
