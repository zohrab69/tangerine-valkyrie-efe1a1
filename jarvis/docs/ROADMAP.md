# Roadmap

**Order updated 2026-11-06** (see BUSINESS-BRIEF.md): after Phase 1-2, VeraClean (Phase 7)
moves up to come next, then the cloud server (Phase 9), then Shopify (Phases 3-6).
The numbers are kept so earlier references still work.

Legend: `[x]` done and verified · `[~]` built in this repo, not yet run on your laptop · `[ ]` planned

## Phase 1: Infrastructure (current)
- [x] Docker Desktop, WSL 2, Compose, n8n on :5678, volume `n8n_data`, owner account *(as you reported it)*
- [x] OpenAI API key, US$10 credit, auto-recharge off *(as you reported it)*
- [~] Inspect container: `01-inspect.ps1`
- [~] Verified backup with restore test: `02-backup.ps1`
- [~] Sandbox stack: `03-setup-sandbox.ps1` + `infra/stack/compose.yml`
- [~] Connect n8n to the sandbox: `04-connect-n8n.ps1` and the Service URL/API key in the n8n UI
- [~] First agent: `workflows/jarvis-ceo-v0.json` (dispatcher, router, budget guard)
- [~] Health check: `05-verify.ps1`
- [ ] OpenAI dashboard: monthly budget, alerts, separate "jarvis" project key
- [ ] Optional Path B: `06-migrate-n8n-to-compose.ps1` (recommended if the container uses `--rm`)
- [ ] Optional: `.wslconfig` memory limit (after Path B)

**Done when:** `05-verify.ps1` passes, the Assistant runs code, and JARVIS CEO v0 returns a work order costing under 1¢.

## Phase 2: JARVIS core and research departments
- [ ] Data Tables: tasks, approvals, actions, ledger, decisions, products
- [ ] `llm.call` sub-workflow (router from v0, with fallback chain, persistent ledger, JSON validation)
- [ ] Telegram bot: approval buttons and alerts; Error Trigger workflow
- [ ] `jarvis.ceo`: dispatch to managers and a daily report
- [ ] `ecom.manager` plus the research/finance roles as the funnel in ARCHITECTURE.md §2
- [ ] Finance 1 unit-economics calculator (code, no AI) with unit tests
- [ ] Second provider key (Anthropic or OpenRouter) for fallback and independent review, when budget allows

## Phase 3: First real product research
- [ ] Choose data sources: supplier APIs (CJ / AliExpress dropshipping), TikTok Creative Center and Google Trends exports (manual weekly CSV)
- [ ] Shortlist of 3-5 Canadian products with sources, landed cost, fees, tax and shipping time, all marked as estimates
- [ ] Owner review: approve or reject, logged

## Phase 4: Shopify launch
- [ ] Store, French and English, legal pages (privacy per Law 25, returns, shipping), Shopify Payments
- [ ] Dropship app (DSers/CJ) and test orders to yourself
- [ ] Listing publisher (draft → approval → publish, with idempotency key)
- [ ] Order and tracking workflows, support templates
- [ ] Move n8n to a VPS (webhooks need a public URL), see Phase 9

## Phase 5: Amazon.ca
- [ ] Policy check per product (seller of record, blind shipping, delivery speed)
- [ ] Professional plan and SP-API developer registration, only when a product qualifies

## Phase 6: Promotional content
- [ ] One pipeline: script → voice (compare ElevenLabs with free options) → FFmpeg template → 3 platform adapters
- [ ] Apply early for YouTube API audit, TikTok Content Posting API and Instagram Graph API
- [ ] Until approved: JARVIS prepares, you tap post. Metrics are imported back

## Phase 7: VeraClean (now next after Phase 2)
- [ ] SEAO tender watcher: weekly JSON, filter cleaning keywords and Montréal/Laval, Telegram digest
- [ ] Prospect list builder (Google Places): hotels, motels, clinics (not hospitals), offices, property managers
- [ ] Read saved-search alert emails (Kijiji/Indeed/Facebook) into the leads table
- [ ] Price sheet and rules (your approval), French-first templates
- [ ] Lead research with CASL consent basis per contact; outreach after approval of each list
- [ ] Inquiry intake → quote draft → Google Calendar booking → confirmations and reminders
- [ ] Daily and weekly report

## Phase 8: Independent content channel
- [ ] Niche research (3 candidates), 2-week test of 10 videos each, then pick by retention and subscribers
- [ ] Original research and scripts, AI disclosure where required

## Phase 9: Cloud
- [ ] VPS (~CA$10/month) with n8n + Postgres, Caddy HTTPS, daily off-site backups
- [ ] Daytona for the Assistant sandbox, or keep it on the laptop

## Phase 10: Optimization
- [ ] Monthly routing review from ledger data; automate proven routine decisions
- [ ] US expansion study (customs, taxes, returns, suppliers)

## Trading
Paused. No work and no budget until you restart it.
