// ---- Product rules (owner decisions 2026-11-16) - shared by research and idea checks ----
// Electronics are allowed only WITHOUT batteries or chargers. Beauty stays out. Kids, food,
// supplements, medical and weapons stay out (extra Canadian rules). Anything that may need a
// certification is flagged, not hidden.
const RULES = {
  exclude: [
    [/batter|rechargeable|lithium|li-?ion|power ?bank|charg(er|ing)|cordless|wireless|bluetooth|solar|\bvape\b|e-?cig/i, 'has a battery or charger'],
    [/cosmetic|make ?up|lipstick|mascara|eyelash|eyeliner|skin ?care|serum|face cream|lotion|perfume|fragrance|nail (polish|art|gel)|hair (dye|color|colour)|beauty|facial|wig\b/i, 'beauty (kept out for now)'],
    [/\btoys?\b|\bkids?\b|child|children|baby|infant|toddler|nursery/i, "kids' product (Health Canada toy rules)"],
    [/\bfood\b|snack|supplement|vitamin|protein powder|\btea\b|coffee beans|candy/i, 'food or supplement'],
    [/medical|medicine|therapy|massager|blood pressure|thermometer|hearing aid|pain relief|posture corrector|orthopedic/i, 'medical claims (Health Canada)'],
    [/knife set|weapon|pepper spray|taser|stun|crossbow|airsoft|\bgun\b|cbd|nicotine/i, 'restricted item'],
  ],
  certification: [
    [/electr|\busb\b|\bled\b|lamp|\blights?\b|plug|\bac\b|adapter|110v|120v|220v|heater|heat(ed|ing)|motor|fan\b|humidifier|diffuser|kettle|blender|grinder|sensor|remote control/i,
     'electrical: plug-in or powered items need CSA, cUL or ETL marking to be sold in Canada; ask CJ for the certificate'],
    [/\bradio\b|\bwifi\b|wi-fi|\brf\b|transmitter|walkie|gps tracker|smart\b/i, 'radio device: needs ISED Canada certification'],
    [/cup|mug|bottle|bowl|plate|lunch ?box|cutting board|utensil|spatula|straw|food storage|container|baking|silicone mold/i,
     'touches food: ask CJ for a food-contact test report (FDA or LFGB)'],
    [/helmet|life ?jacket|car seat|seat ?belt|reflective vest/i, 'safety gear: may need certification (CSA or DOT)'],
    [/magnet/i, 'small magnets: Health Canada warns about swallowing; keep packaging adult-only'],
  ],
};
function checkRules(text) {
  const t = String(text || '');
  const excluded = RULES.exclude.filter(([re]) => re.test(t)).map(([, why]) => why);
  const certification = RULES.certification.filter(([re]) => re.test(t)).map(([, why]) => why);
  return { excluded: excluded.length ? excluded[0] : null, certification };
}
// ---- end of product rules ----
