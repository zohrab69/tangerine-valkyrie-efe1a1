# JARVIS E-commerce Agency (Rangéo)

This is the AI team that finds products, checks them against the market, runs the Shopify store
and handles marketing, with JARVIS on top reporting to the owner.
Last updated 2026-11-12.

## The team

| Agent | Job | Status |
|---|---|---|
| **JARVIS (COO)** | Briefing at 6:00, Telegram, screen with voice, approvals, memory, alerts | ✅ live |
| **Product scout** | Every Monday: CJ products in rotating themes, competition bands, shipping quotes to Canada, profit math | ✅ live |
| **Market analyst** | Checks each candidate against the market: Google Shopping prices in Canada and Google searches in Canada over 3 months. Sends only products people already pay 2× our cost for, with searches not falling. 🔥 = rising, 2.5× gap, owner targets met | 🔧 built 2026-11-12, needs a SerpApi key |
| **Store manager** | New order → Telegram, screen and briefing; daily check for paid orders not shipped after 4 days | 🔧 built 2026-11-12, needs a Shopify custom app token |
| **Fulfilment** | CJ app: order sync, auto-pay (Stripe card), tracking back to Shopify | ✅ set up by the owner |
| **Listing writer** | Product title and description in French and English, price suggestion → Shopify **draft** → owner approves → published | ⏳ next |
| **Marketing studio** | Per product: 3 short-video scripts (hooks), Kokoro voice-over, captions, posting plan for TikTok, Reels and Shorts. Owner posts until API access is approved | ⏳ planned |
| **Customer care** | Drafts replies to "where is my order" from tracking; refunds and disputes always go to the owner | ⏳ planned |
| **Finance** | Weekly sales, costs (CJ), fees, profit per product, cash needed for CJ auto-pay | ⏳ planned |

## What "going viral" can and cannot mean (honest limits)

- **Amazon:** sales-rank data needs a paid data API (Keepa API is about €49/month per third-party reviews; confirm on keepa.com).
  Scraping Amazon pages breaks Amazon's terms, so JARVIS doesn't do it. Option: add Keepa when the store makes money.
- **TikTok and Instagram:** there is no official public API for trending products. The only tools are unofficial scrapers,
  which break those platforms' terms, so JARVIS doesn't use them. The owner can browse TikTok Creative Center manually.
- **What JARVIS uses:** Google search interest in Canada (a strong, legal signal that people are looking for something),
  real prices people pay in Canadian shops (Google Shopping), and how many stores already sell the item on CJ.
  All through SerpApi, whose free plan is listed at 250 searches/month. The research uses about 10 per week.

## Owner approvals (never automatic)

Publishing a product or changing its price · any ad spend · refunds and disputes · first post on a new channel ·
new paid tools (Keepa, SerpApi paid plans, video tools).

## Order of work

1. Owner: SerpApi free account + key → n8n *Query Auth* credential (name `api_key`).
2. Owner: Shopify custom app (read orders) → n8n *Shopify Access Token* credential.
3. Import `jarvis-research-v1.json` (market check) and `jarvis-shop-v1.json` (store manager).
4. Next builds: listing writer (drafts and approval), then marketing studio, then customer care and finance.
