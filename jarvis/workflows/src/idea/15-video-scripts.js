// Video team: 3 short vertical videos (different hooks) from the product photos + JARVIS's voice.
// The server's voice service renders each one (POST /video); captions and hashtags go with each video.
const rep = $('Report').first().json;
const imgs = ($('Product for Shopify').first().json.gql.variables.input.files || []).map(f => f.originalSource).slice(0, 5);
let vids = rep.listing.videos || [];
const name = rep.name;
const fallback = [
  { hook: `Still struggling with this?`, lines: [`Meet the ${name}.`, 'Simple, useful, and ready for every day.', 'Link in bio.'], caption: name, hashtags: ['#rangeo', '#canada', '#homefinds', '#musthave', '#giftideas'] },
  { hook: `You need to see this`, lines: [`The ${name} does the job in seconds.`, 'No mess, no fuss.', 'Shop it at Rangéo.'], caption: name, hashtags: ['#rangeo', '#canada', '#tiktokmademebuyit', '#gadget', '#shopsmall'] },
  { hook: `Gift idea under ${Math.ceil(rep.price_cad)} dollars`, lines: [`The ${name}.`, 'Fast delivery in Canada.', 'Order before Christmas.'], caption: name, hashtags: ['#rangeo', '#christmasgift', '#giftideas', '#canada', '#blackfriday'] },
];
while (vids.length < 3) vids.push(fallback[vids.length]);
vids = vids.slice(0, 3).map((v, i) => ({ hook: String(v.hook || fallback[i].hook).slice(0, 60),
  lines: (Array.isArray(v.lines) && v.lines.length ? v.lines : fallback[i].lines).slice(0, 3).map(l => String(l).slice(0, 90)),
  caption: String(v.caption || fallback[i].caption).slice(0, 150),
  hashtags: (Array.isArray(v.hashtags) && v.hashtags.length ? v.hashtags : fallback[i].hashtags).slice(0, 6).map(h => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')) }));
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const scripts = '<b>🎬 Video team: 3 scripts for ' + esc(rep.listing.title_fr) + '</b>\n' + vids.map((v, i) => `\n<b>${i + 1}. Hook:</b> ${esc(v.hook)}\nVoice: ${esc(v.lines.join(' '))}\nCaption: ${esc(v.caption)} ${esc(v.hashtags.join(' '))}`).join('\n') +
  '\n\nThe videos follow. Post them yourself on TikTok, Reels and Shorts (auto-posting needs each platform\'s API approval).';
return vids.map((v, i) => ({ json: { n: i + 1, scripts, caption: `${v.caption}\n${v.hashtags.join(' ')}`.slice(0, 1000),
  video_body: { images: imgs.length ? imgs : [rep.photo].filter(Boolean), hook: v.hook, lines: v.lines, voice: 'am_adam', price: `${rep.price_cad} CAD`, brand: 'Rangéo' } } }));
