# Roadmap

**Current order (owner decision 2026-11-06):** Phase 1 → 2 → 3 (product research) → 4 (Shopify)
→ 6 (videos) → 5 (Amazon, in parallel from Phase 3 as registration + policy research) → 9 (cloud,
before the store goes live) → 7 (VeraClean) → 8 → 10. The numbers are kept so earlier references still work.

Legend: `[x]` done and verified · `[~]` built in this repo, not yet run on your laptop · `[ ]` planned

## Phase 1: Infrastructure (current)
- [x] Docker Desktop, WSL 2, Compose, n8n on :5678, volume `n8n_data`, owner account *(as you reported it)*
- [x] OpenAI API key, US$10 credit, auto-recharge off *(as you reported it)*
- [x] Inspect container: `01-inspect.ps1` ran 2026-11-06. Container `n8n`, n8n 2.45.7, restart unless-stopped (no `--rm`), encryption key inside the volume, Docker limit 3.7 GB, Windows RAM at 90%
- [x] Verified backup with restore test: `02-backup.ps1`. Ran 2026-11-06: n8n_data-20261106-150713.tar.gz, integrity ok, 0 workflows, 1 credential, 1 user
- [~] Sandbox stack: `03-setup-sandbox.ps1` + `infra/stack/compose.yml`
- [~] Connect n8n to the sandbox: `04-connect-n8n.ps1` and the Service URL/API key in the n8n UI
- [~] First agent: `workflows/jarvis-ceo-v0.json` (dispatcher, router, budget guard)
- [~] Multi-AI version: `workflows/jarvis-ceo-v1-multi-ai.json` (Gemini/Groq free first, OpenAI last; logic tested offline)
- [ ] Free API keys: Gemini (AI Studio), Groq; optional OpenRouter
- [~] OmniRoute AI gateway: `07-setup-omniroute.ps1`, combos `jarvis-free` / `jarvis-paid`, workflow `jarvis-ceo-v2-omniroute.json` (owner chose this 2026-11-06). **Blocked on the laptop:** only 0.7 GB RAM free with Docker + n8n running (2026-11-06). Use the direct multi-AI workflow (v1) on the laptop now; run OmniRoute on the cloud server
- [~] Health check: `05-verify.ps1`
- [ ] OpenAI dashboard: monthly budget, alerts, separate "jarvis" project key
- [ ] Optional Path B: `06-migrate-n8n-to-compose.ps1` (not needed now: the container already restarts by itself)
- [ ] Optional: `.wslconfig` memory limit (after Path B)

**Phase 1 status:** done on the cloud server (the laptop sandbox is optional and was skipped for RAM).

**Done when (original laptop plan):** `05-verify.ps1` passes, the Assistant runs code, and JARVIS CEO v0 returns a work order costing under 1¢.

## Phase 2: JARVIS core and research departments
- [ ] Data Tables: tasks, approvals, actions, ledger, decisions, products
- [ ] `llm.call` sub-workflow (router from v0, with fallback chain, persistent ledger, JSON validation)
- [x] Telegram bot created (owner chat ID 6203634137), `JARVIS Telegram` credential saved in server n8n (2026-11-08)
- [x] **JARVIS on Telegram live (2026-11-08):** `jarvis-telegram-v3.json` published on the server; owner message -> work order reply in Telegram, free AI, $0. Fix applied: Telegram parse mode HTML (underscores broke Markdown)
- [x] (live 2026-11-08, Decline tested: reply showed REJECTED; v3 unpublished) `jarvis-telegram-v4.json`: fixed approval rule in code (AI can only make it stricter) + Telegram Approve/Decline buttons (48 h, no answer = rejected); logic tested offline
- [ ] Error alerts on Telegram (Error Trigger workflow)
- [x] **JARVIS screen live (2026-11-08)** at https://jarvis.2-29-114-208.sslip.io: answered on screen via free AI, $0 (fix: n8n auto-picked the screen key in the Call nodes; both Header Auth credentials share a type, so check credentials after import). Voice input still to confirm. Files: `infra/server/ui/index.html` (hold-to-talk, spoken replies, panels), `voice-setup.sh` + `caddy-config.sh` (password-protected jarvis.<ip>.sslip.io, secret header to n8n), workflow `jarvis-voice-v1.json` (answers the screen at once, approvals to Telegram). UI tested in a browser against a mock server; not yet deployed
- [ ] Voice, owner chose **later** (2026-11-08): level 1 Telegram voice messages (Groq speech-to-text, free); level 2 urgent-only phone calls via Twilio (~CA$2-3/month); level 3 live voice agent (Vapi/Retell/ElevenLabs, ~US$0.07-0.15/min)
- [ ] `jarvis.ceo`: dispatch to managers and a daily report
- [ ] `ecom.manager` plus the research/finance roles as the funnel in ARCHITECTURE.md §2
- [ ] Finance 1 unit-economics calculator (code, no AI) with unit tests
- [ ] Second provider key (Anthropic or OpenRouter) for fallback and independent review, when budget allows

## Phase 3: First real product research (NEXT after Phase 2)
- [x] **First real research report 2026-11-09** (CJ live: token, search, variants, shipping CN->CA quotes, finance, Telegram). Observations: CJ `listedNum` was 0-1 for most results, so the demand signal is weak; shipping (8-11 USD) dominates landed cost; 4-8 day quotes need confirming with a sample. Credential gotcha: n8n auto-selects the newest Header Auth credential on import, so check every HTTP node. Workflow: `workflows/jarvis-research-v1.json` (2026-11-08): CJ Dropshipping API (product list, variants, real shipping quotes to Canada) -> exclusions (electronics, cosmetics, kids, food, medical) -> finance math without AI -> free-AI notes -> Telegram top 5. Weekly Monday 10:00 + manual. Built from CJ API names found by search (CJ docs host blocked from the build session); code tolerates field-name variants; offline-tested with mock data; first live run will confirm
- [x] Owner: CJ account + API key (Apps > Install App > Others > API), n8n Custom Auth credential `CJ API key` with JSON {"body":{"apiKey":"..."}}
- [x] Research v1.1 live (2026-11-09; CJ accepted orderBy=listedNum, e.g. 15,130 stores; photos delivered). Note: very high store counts also mean heavy competition, which a saturation check should weigh later. Details: CJ search sorted by listedNum, 50 results per theme, demand score (stores + sales when provided), proven-demand first, 'unproven demand' flag; one Telegram photo per product with facts in the caption, text fallback if a photo fails. Offline-tested
- [ ] Choose data sources: supplier APIs (CJ / AliExpress dropshipping), TikTok Creative Center and Google Trends exports (manual weekly CSV)
- [ ] Shortlist of 3-5 Canadian products with sources, landed cost, fees, tax and shipping time, all marked as estimates
- [ ] Owner review: approve or reject, logged

## Phase 4: Shopify launch
- [ ] Store, French and English, legal pages (privacy per Law 25, returns, shipping), Shopify Payments
- [ ] Dropship app (DSers/CJ) and test orders to yourself
- [ ] Listing publisher (draft → approval → publish, with idempotency key)
- [ ] Order and tracking workflows, support templates
- [ ] Move n8n to a VPS (webhooks need a public URL), see Phase 9

## Phase 5: Amazon.ca (research and registration start in parallel with Phase 3)
- [ ] Amazon.ca seller registration (identity checks can take weeks: start early)
- [ ] Policy check per product (seller of record, blind shipping, delivery speed)
- [ ] Professional plan and SP-API developer registration, only when a product qualifies

## Phase 6: Promotional content
- [ ] One pipeline: script → voice (compare ElevenLabs with free options) → FFmpeg template → 3 platform adapters
- [ ] Apply early for YouTube API audit, TikTok Content Posting API and Instagram Graph API
- [ ] Until approved: JARVIS prepares, you tap post. Metrics are imported back

## Phase 7: VeraClean (after Shopify is live)
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

## Phase 9: Cloud (started 2026-11-06: owner chose to move now)
- [x] n8n owner account on the server; server secrets saved by owner; OmniRoute dashboard password set (2026-11-07)
- [x] OmniRoute provider: Gemini (Google AI Studio) API key connected and tested (gemini flash answered, ~28 s first call)
- [x] OmniRoute provider: Groq API key connected and tested (openai/gpt-oss-120b, 0.5 s; default groq/compound not available on the account)
- [x] OmniRoute combo `jarvis-free` (Priority: Groq gpt-oss-120b, then Gemini 3.8 Flash) and API key `n8n-jarvis` (no management access) created 2026-11-07
- [ ] OmniRoute: add backups to combo (Groq gpt-oss-20b, Gemini 2.5 Flash Lite); `jarvis-paid` combo after adding OpenAI key
- [x] **First JARVIS agent live on the server (2026-11-07):** `JARVIS CEO v2 (OmniRoute)` ran end to end. The free combo answered (Groq openai/gpt-oss-120b, 306 in / 388 out tokens, $0) with a valid work order: department ecommerce, task_type research, needs_owner_approval false, data_needed listed (no invented data)
- [x] Server restarted for kernel update (2026-11-08); all 5 containers came back on their own (n8n, Postgres, OmniRoute, Redis, Caddy)
- [x] Server live 2026-11-07: Hetzner CX23 Helsinki, 2.29.114.208, https://n8n.2-29-114-208.sslip.io (n8n 2.45.7 + Postgres, OmniRoute 3.8.53, Caddy HTTPS, 1.2 of 3.7 GB RAM used). Setup from `infra/server/` (Hetzner CX23, Caddy HTTPS via sslip.io, n8n + Postgres, OmniRoute private, firewall, swap, daily backups)
- [ ] VPS (~CA$10/month) with n8n + Postgres, Caddy HTTPS, daily off-site backups
- [ ] Daytona for the Assistant sandbox, or keep it on the laptop

## Phase 10: Optimization
- [ ] Monthly routing review from ledger data; automate proven routine decisions
- [ ] US expansion study (customs, taxes, returns, suppliers)

## Trading
Paused. No work and no budget until you restart it.
