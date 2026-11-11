# Owner brief (updated 2026-11-06: Shopify + Amazon first)

Read this first in every session. It is the owner's current intent, in plain words.

## The two businesses
1. **VeraClean Services**: cleaning company, Montréal/Laval. **Brand new, 0 clients.**
   Target customers: offices and commercial spaces, hotels and motels, clinics (**not hospitals**),
   residential buildings (managers and owners), and homes.
   Goal: find people and organizations that need cleaning **every day**, from job
   platforms, tenders and public listings, and turn them into recurring contracts.
2. **Shopify store, with Amazon later**: dropshipping, Canada first. Agents watch what is
   trending, choose products, build the store, and market it with daily short videos on
   YouTube Shorts, TikTok and Instagram.

Trading stays paused.

## What the owner wants from JARVIS
- A **COO**: one main agent that runs both businesses, coordinates the teams, and reports to the owner.
- JARVIS **contacts the owner** about important meetings, appointments and decisions. Start
  with Telegram messages; add a phone call for urgent items only, later and with a paid voice service.
- Agents that work **24/7**, especially lead-finding and market watching.
- Build it **step by step**. The owner has only Docker Desktop and n8n so far and is open to better tools.

## Decisions taken
- **Order (owner decision, 2026-11-06, replaces "VeraClean first"):** **Shopify + Amazon first**, VeraClean second.
  Shopify Canada launches first. Amazon.ca runs in parallel as research and account
  registration (approval takes time), and selling there starts only with products and suppliers
  that meet Amazon's dropshipping rules (seller of record, blind shipping, fast delivery).
- **Owner answers (2026-11-06):** approvals and alerts go through **Telegram**. **No electronics or
  cosmetics** in product research. **Starting budget: $200** (assumed CAD) for Shopify, domain and test orders.
  This is separate from the AI cap in `config/budget.json`.
- **JARVIS voice (owner choice 2026-11-09):** Kokoro `am_adam` (American male), free and running on the server.
- **Store name (owner choice 2026-11-11): Rangéo** (Shopify address: rangeo-ca.myshopify.com). Owner tests the whole flow with a real order to himself instead of a separate sample.
- **Backbone:** keep **n8n**, which is free, already installed, and has the integrations needed. Use separate services only
  where n8n cannot do the job alone: phone calls, video rendering, social APIs.
- **Cloud server now (owner decision 2026-11-06):** Hetzner CX23 (about €6/month), set up from `infra/server/`. The laptop is too short on RAM for OmniRoute.
- **24/7 means a cloud server.** The laptop is for building. Move to a small VPS (about CA$10/month)
  before the Shopify store goes live (store webhooks need a public address).

## Real lead sources for VeraClean (legitimate, mostly free)
| Source | What it gives | Automation |
|---|---|---|
| **SEAO** (Quebec public tenders) | Cleaning contracts from municipalities, school boards, public bodies. Free weekly JSON, CC-BY 4.0 licence (Données Québec) | Fully automatic: filter on "entretien ménager", "conciergerie", region |
| CanadaBuys / MERX | Federal and other tenders | Email alerts, then parse |
| Google Places API | Lists of hotels, motels, clinics, offices and property managers in Montréal/Laval | Automatic, within the free monthly credit |
| Kijiji, Facebook groups/Marketplace, Indeed "looking for cleaner" posts | Daily small jobs | **Semi-automatic**: their terms forbid scraping. Use saved-search email alerts, and the agent reads the alerts |
| Google Business Profile, Bark, HomeStars | Inbound requests | Free profile; Bark charges per lead |

Outreach follows CASL (the consent basis is stored per contact) and is **in French first**. The owner approves
each new contact list before the first message goes out.

Commercial and tender clients usually ask for liability insurance, CNESST registration and sometimes
security clearances. Check these early, before bidding.
