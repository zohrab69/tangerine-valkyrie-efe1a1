# Reality check: limits, rules and costs

This file covers what can and cannot be automated, which rules apply, and what each part really costs.
Rules and prices change. Every item marked **verify** must be checked against the official source
before it is relied on, and each department's first task in its phase is to recheck its items.
This is not legal or tax advice. Use an accountant for the GST/QST registration decision.

## 1. What can be automated, and what cannot

| Area | Can be automated | Needs you or a human, or is limited |
|---|---|---|
| Product research | Collecting allowed data, scoring, cost math, reports | There is no free, reliable API for "what is trending". Google Trends has no official public API (unofficial scrapers break). TikTok Creative Center is web-only. Amazon best-seller pages must not be scraped (Amazon terms). Realistic v1: supplier APIs (e.g. CJdropshipping and AliExpress dropshipping/affiliate APIs), Shopify and Amazon APIs once you have accounts, and CSV exports you download weekly. A paid data tool (Jungle Scout, Helium 10 and similar, about US$30-100/month) only after the first products sell. |
| Shopify | Listing drafts, publishing after approval, prices, inventory sync, order routing through a dropship app (DSers/CJ), tracking emails | Store setup, payments (Shopify Payments KYC), legal pages, and the first test orders are done by you. |
| Amazon.ca | Catalog/pricing/order data through SP-API after approval | Seller registration and identity checks; SP-API developer registration. **Dropshipping policy:** you must be seller of record, identified as the seller on all packing slips and invoices, with supplier branding removed, and you handle returns. Buying from another retailer and having it ship to your customer is **prohibited**. Most AliExpress-style dropshipping fails these rules (and Amazon delivery-time metrics). Plan for Amazon only with suppliers who can do blind shipping fast, or with FBA inventory. |
| Video content | Scripts, voice-over (ElevenLabs), captions, assembling templated videos, scheduling | **YouTube API:** uploads cost quota (default 10,000 units/day; one upload ≈ 1,600 units, so about 6/day), and uploads from **unaudited** API projects are locked to *private* until Google audits the app. **TikTok Content Posting API:** requires app review; unaudited apps can only post privately. **Instagram:** publishing via Graph API requires a Business/Creator account linked to a Facebook Page, and is rate-limited (**verify** the current limit). Until audits pass: JARVIS prepares everything, and you tap "post" in the app or use the platform's own scheduler. |
| Monetization (content channel) | Publishing, analytics, A/B titles | YouTube Partner Program excludes **inauthentic / mass-produced, repetitive** content (policy tightened July 2025). Realistic synthetic content must be **disclosed** (YouTube, TikTok and Instagram AI labels). A faceless "facts" channel is possible only with real research, original scripts and editing that adds value, and with fewer, better videos instead of mass uploads. |
| VeraClean | Lead research from public business sources, drafts, follow-ups, booking with Google Calendar, reminders, quotes from your price sheet, reports | Signing contracts, unusual prices, and the first message to each new list (approval). Phone calls and site visits. |
| Customer support | Answering order-status, shipping and return-policy questions from templates | Disputes, chargebacks, complaints involving safety or legal issues. |

## 2. Canada and Quebec rules that shape the design

- **CASL (anti-spam):** every commercial email or SMS needs consent (express, or implied, for example
  an existing business relationship, or a *conspicuously published* business address with no
  "no solicitation" notice when the message is relevant to the person's role), plus sender
  identification and a working unsubscribe link that is honoured within 10 business days. Penalties can reach
  $10M per violation for businesses. The VeraClean outreach agent stores the **consent basis
  and source URL** for every contact and refuses to send without one.
- **Quebec Law 25 (privacy):** you need a person responsible for personal information (you, by default), a
  published privacy policy, a confidentiality-incident register, and an assessment before storing
  personal information outside Quebec. Cloud AI providers count, so send customers' names, emails and phone numbers
  to AI models only when needed, and send IDs instead where possible.
- **Charter of the French language (Bill 96):** commercial communications, websites, product
  descriptions, contracts and invoices directed at Quebec customers must be available in French,
  and French must be at least as prominent. VeraClean (Montréal/Laval) works French-first. The Shopify store
  needs French translations (Shopify's free *Translate & Adapt* app). Marketing agents produce FR and EN.
- **Sales tax:** registration for GST/HST (and QST in Quebec) is mandatory once taxable sales exceed
  **$30,000 over four consecutive quarters**. Registering earlier lets you recover tax paid on
  expenses. **Verify with an accountant.** The finance agents model prices with tax included and show it separately.
- **Imports and duties:** dropshipped parcels from outside Canada can carry GST/duties that
  customers dislike. Low-value thresholds (CUSMA: US/Mexico courier shipments C$40 tax / C$150 duty) are
  **verify** items. Finance 1 always estimates the landed cost and marks it as an estimate.
- **Consumer protection:** delivery times shown must be realistic. Quebec's Consumer Protection Act
  applies to distance contracts (clear total price, cancellation rights when delivery is late).

## 3. Realistic monthly costs

| Item | Phase | Approx. monthly | Notes |
|---|---|---|---|
| n8n self-hosted (Community) | now | $0 | Use for your own business is permitted under n8n's license |
| OpenAI API (all agents) | now | target CA$15-40 | The router's caps enforce it. Phases 2-3 should cost a few dollars |
| n8n Assistant usage | now | part of the above | Most expensive during building; use a mid-tier model |
| Telegram bot (approvals) | 2 | $0 | |
| Shopify | 4 | Basic ≈ US$39 monthly / ≈ $29 on annual billing (**verify** CAD price); Starter ≈ US$5 (social/links only) | Starting with a trial is possible |
| Domain | 4 | ~$20/year | |
| Amazon.ca Professional plan | 5 | ≈ CA$29.99 (**verify**) | Only after the Shopify products are proven |
| ElevenLabs | 6 | Starter ≈ US$5-6; free tier has no commercial licence (**verify**) | Compare free/OSS TTS first |
| Video tools | 6 | $0 (FFmpeg/templated) → paid only if measured as better | |
| Cloud VPS | 9 | ~CA$7-10 | Postgres on the same server |
| Ads (TikTok/Meta) | 4+ | Your decision per campaign | Never automatic |

Your **CA$30-50 target is realistic for AI plus infrastructure** through Phase 3. Store,
marketplace, ad and sample costs are separate business budgets, as you said.

## 4. Things I recommend changing from the original plan

1. **Shopify Canada first, Amazon later or never for dropshipping.** Amazon's seller-of-record and
   delivery-speed rules make classic dropshipping risky. Treat Amazon as an option for proven products with
   a Canadian or US warehouse supplier.
2. **Human tap-to-post until platform API audits are approved.** Automatic posting is possible, but the
   audits take weeks and require a privacy policy and a working app. Start the applications early (Phase 6).
3. **French by default** for VeraClean and the Quebec-facing parts of the store (legal requirement).
4. **The laptop is for building.** 24/7 agents, webhooks and posting schedules belong on a ~CA$10 VPS
   once Phase 4 starts. Before then, the laptop only needs to be on while you test.
5. **No viral-content factory** on the independent channel. YouTube's inauthentic-content rules make
   mass AI uploads unmonetizable. Fewer, researched videos are the plan.
