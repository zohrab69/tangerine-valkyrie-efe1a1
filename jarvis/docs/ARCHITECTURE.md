# JARVIS architecture

## 1. Principles

1. **Agents are roles, not running processes.** An "agent" is an n8n sub-workflow with a
   prompt, a set of tools and a model tier. It runs only when a schedule, an event or
   its manager calls it. While nothing is happening, nothing runs and nothing costs money.
2. **One gateway to all AI models.** Every agent calls the same `llm.call`
   sub-workflow. That is the only place where the model is chosen, budgets are checked,
   fallback happens and cost is logged.
3. **Facts come from tools, not from models.** Prices, fees, demand signals and supplier
   data are fetched from APIs, exports or pages that are allowed to be read. Each one is stored with its
   source and date. A model may summarize data but never supply it. A report line
   without a source is marked `UNVERIFIED`.
4. **Draft, then approve, then act.** Anything consequential is first saved as a draft.
   Publishing, spending or contacting new people happens only after a logged approval
   (see `config/approval-policy.json`).
5. **Idempotent actions.** Every outside action (publish a listing, send an email, place
   an order) carries an `action_key`. If that key was already executed, the action is skipped.
   This prevents duplicates after retries or a model fallback.

## 2. Organization in n8n

```
Owner (you)  ── Telegram/email approvals, daily + weekly report
   │
JARVIS CEO  (workflow: jarvis.ceo)       dispatch · prioritise · compare · report · cost control
   │
   ├── E-commerce Manager      (ecom.manager)
   │     ├── Research: trends & demand · competition & saturation · suppliers & feasibility
   │     ├── Finance: unit economics · pricing & forecast · risk & independent check
   │     └── Ops: listings · fulfillment · customer support
   ├── Marketing Manager       (mkt.manager)    one content pipeline → YouTube Shorts / TikTok / Reels adapters
   ├── VeraClean Manager       (vc.manager)     leads · outreach · inquiries · quotes · booking · reports
   ├── Content-Channel Manager (cc.manager)     ideas · scripts · production · publishing · analytics
   └── Trading                 PAUSED (no workflows, no budget)
```

### How your 9 e-commerce specialists map to cost-efficient work

Running nine models in parallel on every product would cost about nine times as much and mostly repeat the same work.
The roles stay, but they run as a **funnel**:

| Stage | Who | Model tier | Runs on |
|---|---|---|---|
| 1. Collect signals | Research 1 (trends/demand) | none: data tools only | every product candidate |
| 2. Screen | Research 1 + 2 (one combined T1 call) | T1 | every candidate (cheap filter) |
| 3. Deep check | Research 2 (competition), Research 3 (suppliers) | T2 | top ~10 per week |
| 4. Unit economics | Finance 1 (pure **code**, no AI: cost + fees + shipping + tax + ads + returns) | none | top ~10 |
| 5. Pricing/forecast | Finance 2 | T2 | top ~5 |
| 6. Independent review | Finance 3, on a **different provider** from stage 3 when one is available | T3 | top 1-3 |
| 7. Recommendation | E-commerce Manager → JARVIS → you | T2 | weekly shortlist |

The three social media agents become **one** creative pipeline: one script and one master
video per product, plus three cheap adapters for the platform-specific format, caption, hashtags
and posting time. A separate creative process per platform would triple the cost without
improving the content.

## 3. Communication between agents

- **Task table** (n8n *Data Tables*, built in and free): `tasks(task_id, parent_id, department,
  agent, type, status, input, output, sources, cost_cad, created_at, updated_at)`.
  A manager creates rows, and each agent reads its row and writes its result back. Context
  survives model changes and restarts because it lives in the table, not inside a model.
- **Calls**: managers call agents with *Execute Workflow* (synchronous). Long jobs
  use a status row plus a schedule that picks up pending rows.
- **Other tables**: `approvals`, `actions` (idempotency keys), `ledger` (every AI call:
  model, tokens, cost), `products`, `leads`, `content`, `decisions` (what was decided, by
  whom, on what evidence).
- If n8n Data Tables become too small, move to Postgres (n8n's documented upgrade path).
  It is not needed in Phase 2.

## 4. Model routing (`config/model-routing.json`)

| Tier | Use | Start with (OpenAI) | Later options |
|---|---|---|---|
| T1 | classify, extract, format, short replies | gpt-5-nano | cheap models through OpenRouter |
| T2 | research synthesis, copy, scripts, comparisons | gpt-5-mini | Claude Haiku, Gemini Flash |
| T3 | financial evaluation, strategy, independent review | gpt-5 | Claude Sonnet, as the second opinion |

Rules: unknown tasks go to T2 and never to T3. A task escalates at most once, and only when the cheaper output fails
validation. The router moves to the next provider only on 429, 5xx or timeout, reusing the same `task_id` and
prompt, and never after a successful answer. Before each call it checks the single-call, daily and monthly
caps. If a cap would be exceeded, it stops and asks you.
**Local models:** 8 GB of RAM cannot run a useful local LLM alongside n8n and the sandbox.
Re-evaluate on a cloud server or a newer PC.

Pick models by measured results, not brand. The `ledger` table records cost per task type. A
monthly T3 review compares quality and cost and proposes routing changes for your approval.

## 5. Approvals and reports

- Approvals go to **Telegram** (free bot API, works on your phone) using n8n's
  *send and wait for response* with Approve/Reject buttons. Email is the fallback. A request with no answer after
  48 hours counts as rejected and you get one reminder.
- **Daily report** (07:30, T2): exceptions needing you, spend vs. caps, failures, and what
  each department did. **Weekly report** (Sunday): product shortlist, KPIs, and recommendations.

## 6. Reliability and security

- **Error workflow** (n8n *Error Trigger*): every failed workflow sends a Telegram alert with
  the task_id. Retries are limited to 3 with backoff on HTTP nodes.
- **Credentials** live only in n8n's encrypted credential store. The encryption key is inside `n8n_data`
  and is included in the backups. Use one API key per provider project, and give platform tokens the minimum scopes they need.
- **Backups**: `02-backup.ps1` weekly, plus a copy off the laptop. Export workflows to this repo
  (without credentials) after significant changes.
- **Network**: only port 5678 is published, and only on localhost after Path B. The sandbox is never exposed.
- **Webhooks from Shopify, Stripe and others** need a public URL. A laptop does not have one. Use a free
  Cloudflare Tunnel for testing, but run production webhooks on the cloud server (Phase 9).

## 7. Hosting path

| Stage | Where | Approx. cost |
|---|---|---|
| Now (Phases 1-3) | Laptop, Docker Desktop | $0 |
| When agents must run 24/7 or webhooks are needed | Small VPS (e.g. Hetzner CX22/CX23 class, 2 vCPU / 4 GB) running n8n + Postgres | ~CA$7-10/month (check the current price) |
| Assistant sandbox in the cloud | Daytona (n8n's production recommendation) or keep building on the laptop | per-use / $0 |
