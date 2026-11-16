# JARVIS E-commerce Agency (Rangéo)

This is the AI team that finds products, checks them against the market, runs the Shopify store
and handles marketing, with JARVIS on top reporting to the owner.
Last updated 2026-11-16.

## The team

| Agent | Job | Status |
|---|---|---|
| **JARVIS (COO)** | Real agent (n8n AI Agent, free models) on Telegram and the screen; remembers the chat; uses the teams below as tools; briefing at 6:00; approvals; alerts | 🔧 built 2026-11-16 (`jarvis-brain-v1.json`), needs the OpenAI-format OmniRoute credential |
| **Product scout** | Every day 10:00 + on request: CJ products, Canada/US warehouses first, your rules, competition bands, shipping to Canada, profit math | 🔧 v2 built 2026-11-16 (v1 live since 2026-11-09) |
| **Market analyst** | Google Shopping Canada prices (incl. Amazon.ca when listed) + Google searches in Canada; free SerpApi plan with cache and budget | 🔧 built, needs a SerpApi key |
| **Idea checker** | Your own idea (photo, link or name on Telegram): best 3 suppliers, market, price, profit, marketing, FBA estimate, risks → Approve → Shopify listing | 🔧 built 2026-11-16 (`jarvis-idea-v1.json`) |
| **Listing writer** | Original FR title, FR+EN description, CJ photos, price, collection → Shopify, after your approval | 🔧 inside the idea checker, needs a Shopify token with write_products |
| **Video team** | 3 short vertical videos per approved product (different hooks, JARVIS voice, captions, hashtags) → Telegram; you post them | 🔧 built 2026-11-16 (voice service `/video`) |
| **Store manager** | New order → Telegram, screen and briefing; daily check for paid orders not shipped after 4 days | 🔧 built 2026-11-12, needs a Shopify custom app token |
| **Fulfilment** | CJ app: order sync, auto-pay (Stripe card), tracking back to Shopify | ✅ set up by the owner |
| **Customer care** | Drafts replies to "where is my order" from tracking; refunds and disputes always go to the owner | ⏳ planned |
| **Finance** | Profit calculator (agent tool) ✅ built; weekly sales, costs, fees, profit per product, cash for CJ auto-pay | ⏳ weekly report planned |
| **Amazon** | Listing + FBA stock order once the seller account and SP-API are connected; separate approval before buying stock | ⏳ waits for the seller account |

## What "going viral" can and cannot mean (honest limits)

- **Amazon:** sales-rank data needs a paid data API (Keepa API is about €49/month per third-party reviews; confirm on keepa.com).
  Scraping Amazon pages breaks Amazon's terms, so JARVIS doesn't do it. Option: add Keepa when the store makes money.
- **TikTok and Instagram:** there is no official public API for trending products. The only tools are unofficial scrapers,
  which break those platforms' terms, so JARVIS doesn't use them. The owner can browse TikTok Creative Center manually.
- **What JARVIS uses:** Google search interest in Canada (a strong, legal signal that people are looking for something),
  real prices people pay in Canadian shops (Google Shopping), and how many stores already sell the item on CJ.
  All through SerpApi, whose free plan is listed at 250 searches/month. Daily research uses a daily allowance (about 6-8 searches),
  results are cached 10 days, 40 searches stay in reserve for your own idea checks (2 each), and JARVIS warns you before it runs low. It never goes over.
- **Keepa:** not until the Amazon store starts (owner decision 2026-11-16).

## Owner approvals (never automatic)

Publishing a product or changing its price · any ad spend · refunds and disputes · first post on a new channel ·
new paid tools (Keepa, SerpApi paid plans, video tools).

## Order of work
1. Owner: SerpApi free account + key → n8n *Query Auth* credential **SerpApi** (name `api_key`).
2. Owner: Shopify custom app (read_orders, write_products, read_publications, write_publications) → n8n *Shopify Access Token* credential.
3. Owner: OpenAI-type credential **OmniRoute (OpenAI format)** for the agent.
4. Import Research v2, Brain v1, Idea v1, Briefing v2, Alerts v2 (steps in jarvis/README.md, "Update 2026-11-16").
5. Next builds: customer care, weekly finance report, Amazon SP-API when the seller account is ready.
