"""Workflows from the owner's update of 2026-11-16 (run by build.py at the end; can also run alone).
  jarvis-brain-v1.json  JARVIS as a real agent (Telegram + screen), tools = the teams, approvals, product ideas, samples
  jarvis-idea-v1.json   Check the owner's own product idea -> report -> Approve -> Shopify listing + 3 videos
  jarvis-alerts-v2.json Error alerts + daily health check (AI, voice, SerpApi, Shopify, daily research)
"""
import json, pathlib, re
here = pathlib.Path(__file__).parent
out_dir = here.parent
OWNER_CHAT_ID = "6203634137"
CJ = "https://developers.cjdropshipping.com/api2.0/v1"
SHOP = "https://rangeo-ca.myshopify.com"
SHOPIFY_API = SHOP + "/admin/api/2026-07/graphql.json"   # Shopify supports each API version about 12 months: bump yearly
MEMORY = {"__rl": True, "mode": "name", "value": "jarvis_memory"}
HOOK = "http://localhost:5678/webhook/"          # n8n calling its own webhooks (inside the n8n container)

def code(path):
    t = (here / path).read_text()
    return re.sub(r"^//@include (\S+)\n", lambda m: (here / m.group(1)).read_text(), t, flags=re.M)
def node(id_, name, type_, ver, pos, params, **extra):
    n = {"id": id_, "name": name, "type": type_, "typeVersion": ver, "position": pos, "parameters": params}
    n.update(extra); return n
def ifnode(id_, name, pos, expr):
    return node(id_, name, "n8n-nodes-base.if", 2.2, pos, {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                       "conditions": [{"id": id_ + "c", "leftValue": expr, "rightValue": "",
                                       "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                       "combinator": "and"}, "options": {}})
def link(c, a, b, out=0, kind="main", idx=0):
    outs = c.setdefault(a, {}).setdefault(kind, [])
    while len(outs) <= out: outs.append([])
    outs[out].append({"node": b, "type": kind, "index": idx})
def cnode(id_, name, pos, path, **extra):
    return node(id_, name, "n8n-nodes-base.code", 2, pos, {"jsCode": code(path)}, **extra)
def mem_insert(id_, name, pos):
    return node(id_, name, "n8n-nodes-base.dataTable", 1.1, pos, {
        "resource": "row", "operation": "insert", "dataTableId": MEMORY,
        "columns": {"mappingMode": "defineBelow", "value": {"kind": "={{ $json.kind }}", "summary": "={{ $json.summary }}"}, "matchingColumns": [],
                    "schema": [{"id": c, "displayName": c, "required": False, "defaultMatch": False, "display": True, "type": "string",
                                "canBeUsedToMatch": True, "removed": False} for c in ("kind", "summary")]}, "options": {}},
        onError="continueRegularOutput")
def tg_send(id_, name, pos, text, chat=OWNER_CHAT_ID, html=False, **extra):
    add = {"appendAttribution": False, "disable_web_page_preview": True}
    if html: add["parse_mode"] = "HTML"
    return node(id_, name, "n8n-nodes-base.telegram", 1.2, pos, {"chatId": chat, "text": text, "additionalFields": add},
                onError="continueRegularOutput", **extra)
def call_hook(id_, name, pos, path, body_expr, timeout=30000, **extra):
    """HTTP call to another JARVIS workflow's webhook (Header Auth credential: JARVIS screen key)."""
    return node(id_, name, "n8n-nodes-base.httpRequest", 4.2, pos, {
        "method": "POST", "url": HOOK + path, "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "sendBody": True, "specifyBody": "json", "jsonBody": body_expr, "options": {"timeout": timeout}},
        onError="continueRegularOutput", alwaysOutputData=True, **extra)
SHOP_TOKEN_URL = SHOP + "/admin/oauth/access_token"
def shop_token(id_, name, pos, **extra):
    """Shopify token from the Dev Dashboard app (client credentials grant; Custom Auth credential 'Rangéo Shopify app':
    {"body": {"grant_type": "client_credentials", "client_id": "...", "client_secret": "..."}})."""
    return node(id_, name, "n8n-nodes-base.httpRequest", 4.2, pos, {
        "method": "POST", "url": SHOP_TOKEN_URL, "authentication": "genericCredentialType", "genericAuthType": "httpCustomAuth",
        "sendBody": True, "specifyBody": "json", "jsonBody": "={}", "options": {"timeout": 30000}},
        onError="continueRegularOutput", alwaysOutputData=True, **extra)
def save(name, wf_name, nodes, conns, extra_settings=None):
    settings = {"executionOrder": "v1", "saveManualExecutions": True, "timezone": "America/Toronto"}
    settings.update(extra_settings or {})
    names = [n["name"] for n in nodes]
    assert len(names) == len(set(names)), "duplicate node names in " + name
    for a, kinds in conns.items():
        assert a in names, (name, "missing source", a)
        for outs in kinds.values():
            for o in outs:
                for t in o: assert t["node"] in names, (name, "missing target", t["node"])
    (out_dir / name).write_text(json.dumps({"name": wf_name, "nodes": nodes, "connections": conns, "settings": settings, "pinData": {}}, indent=2, ensure_ascii=False) + "\n")
    print("wrote", name)

# ===========================================================================
# BRAIN v1: one AI agent for Telegram and the screen. Replaces Telegram v5 and Voice v1.
CONTEXT = (here.parent.parent / "docs" / "JARVIS-CONTEXT.md").read_text()
CONTEXT = CONTEXT.split("\n## ", 1)[1] if "\n## " in CONTEXT else CONTEXT     # drop the file's own title/intro
CONTEXT = "## " + CONTEXT
bn, bc = [], {}
bn += [
  node("k0", "README", "n8n-nodes-base.stickyNote", 1, [-700, -700], {"width": 1900, "height": 330, "content":
    "## JARVIS Brain v1 - JARVIS as a real agent (Telegram + JARVIS screen)\n"
    "Replaces **Telegram v5** and **Voice v1**: unpublish both, then publish this one (one Telegram trigger per bot, one /jarvis-voice webhook).\n"
    "**Brain:** AI Agent + OmniRoute free models (model `jarvis-free`) + conversation memory (last 12 messages, voice and Telegram share it; it resets when n8n restarts) "
    "+ knowledge (docs/JARVIS-CONTEXT.md, built in) + the last 12 rows of **jarvis_memory**.\n"
    "**Tools (the teams):** products today, run research, check a product idea, memory search, profit calculator, morning briefing, ask the owner's approval.\n"
    "**Shortcuts without AI:** a photo, a link or \"check <product>\" on Telegram goes to the idea checker; \"send/resend the products\" goes straight to research; a reply \"sample\" to a product photo prices a sample (lower part).\n"
    "**Credentials:** *OmniRoute chat model*: an **OpenAI** credential named **OmniRoute (OpenAI format)** (API key = your OmniRoute key; Base URL `http://omniroute:20128/v1`). "
    "All Telegram nodes: **JARVIS Telegram**. *Webhook (JARVIS screen)*, *Webhook (approval request)* and every tool / HTTP node that calls `localhost:5678/webhook`: **JARVIS screen key** (Header Auth). *CJ get token*: **CJ API key**.\n"
    "Money, publishing, prices, posting and contacting people always go through Approve/Decline buttons."}),
  # Telegram door
  node("k1", "Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, [-700, 0], {"updates": ["message"], "additionalFields": {}},
       webhookId="9b2f4c1e-7d3a-4e8b-a6f0-3c5d1e2b7a90"),
  node("k2", "Only the owner?", "n8n-nodes-base.if", 2.2, [-480, 0], {
       "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                      "conditions": [
                        {"id": "o1", "leftValue": "={{ String($json.message?.chat?.id ?? '') }}", "rightValue": OWNER_CHAT_ID,
                         "operator": {"type": "string", "operation": "equals"}},
                        {"id": "o2", "leftValue": "={{ !!(($json.message?.text ?? '') + ($json.message?.caption ?? '')) || !!($json.message?.photo?.length) }}", "rightValue": "",
                         "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                      "combinator": "and"}, "options": {}}),
  ifnode("k3", "Sample request?", [-260, 0],
         "={{ /CJ SKU\\s+\\S+/.test(($json.message?.reply_to_message?.caption ?? '') + ' ' + ($json.message?.caption ?? '')) && !/^\\s*(check|vérifie|verifie)\\b/i.test($json.message?.text ?? '') || /^\\s*(sample|échantillon|echantillon)\\b/i.test($json.message?.text ?? '') }}"),
  # Screen door
  node("k4", "Webhook (JARVIS screen)", "n8n-nodes-base.webhook", 2, [-700, 300],
       {"httpMethod": "POST", "path": "jarvis-voice", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}},
       webhookId="3e7a9c2b-1f4d-4b6e-9a8c-5d2e0f1b3c47"),
  # Shared
  node("k5", "Request", "n8n-nodes-base.code", 2, [0, 150], {"jsCode": code("brain/1-request.js").replace("__OWNER__", OWNER_CHAT_ID)}),
  ifnode("k6", "Product idea?", [220, 150], "={{ $json.route === 'idea' }}"),
  ifnode("k7", "Products request?", [440, 300], "={{ $json.route === 'products' }}"),
  call_hook("k8", "Research: send products", [660, 200], "jarvis-research",
            "={{ JSON.stringify({ mode: $json.products_mode }) }}"),
  node("k9", "Read memory", "n8n-nodes-base.dataTable", 1.1, [660, 420], {
       "resource": "row", "operation": "get", "dataTableId": MEMORY,
       "limit": 14, "orderBy": True, "orderByColumn": "createdAt", "orderByDirection": "DESC"},
       alwaysOutputData=True, onError="continueRegularOutput"),
  node("k10", "Context", "n8n-nodes-base.code", 2, [880, 420], {"jsCode": code("brain/2-context.js").replace("__CONTEXT__", json.dumps(CONTEXT))}),
  node("k11", "JARVIS agent", "@n8n/n8n-nodes-langchain.agent", 3.1, [1120, 420], {
       "promptType": "define", "text": "={{ $json.prompt }}",
       "options": {"systemMessage": "={{ $json.system }}", "maxIterations": 6, "enableStreaming": False}},
       onError="continueRegularOutput", alwaysOutputData=True),
  node("k12", "OmniRoute chat model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, [920, 680], {
       "model": {"__rl": True, "mode": "id", "value": "jarvis-free"}, "responsesApiEnabled": False,
       "options": {"baseURL": "http://omniroute:20128/v1", "temperature": 0.3, "maxTokens": 700, "timeout": 90000, "maxRetries": 1}}),
  node("k13", "Conversation memory", "@n8n/n8n-nodes-langchain.memoryBufferWindow", 1.3, [1060, 680], {
       "sessionIdType": "customKey", "sessionKey": "={{ $('Context').first().json.session }}", "contextWindowLength": 12}),
  # Tools
  node("k14", "products_today", "n8n-nodes-base.httpRequestTool", 4.2, [1200, 680], {
       "toolDescription": "Today's top 5 products (what is selling or viral today). Resends today's saved report to the owner's Telegram, or runs product research now if there is none today. Returns the product list. No input needed.",
       "method": "POST", "url": HOOK + "jarvis-research", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
       "sendBody": True, "specifyBody": "json", "jsonBody": "={\"mode\": \"auto\"}", "options": {"timeout": 30000}}),
  node("k15", "run_product_research", "n8n-nodes-base.httpRequestTool", 4.2, [1340, 680], {
       "toolDescription": "Run new product research now on CJ (US/Canada warehouses first) with a market check; the top 5 arrive on Telegram in a few minutes. Optional themes, e.g. 'phone stand, christmas decoration'.",
       "method": "POST", "url": HOOK + "jarvis-research", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
       "sendBody": True, "specifyBody": "json",
       "jsonBody": "={{ JSON.stringify({ mode: 'run', keywords: String($fromAI('themes', 'Up to 3 product themes separated by commas, or an empty string for the daily rotation', 'string') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3) }) }}",
       "options": {"timeout": 30000}}),
  node("k16", "check_product_idea", "n8n-nodes-base.httpRequestTool", 4.2, [1480, 680], {
       "toolDescription": "Check one product the owner names (name or link): virality (Google searches in Canada), competitor prices (Google Shopping Canada incl. Amazon.ca), the best 3 CJ suppliers, costs, profit, risks. The full report with Approve/Decline buttons arrives on Telegram in 1-3 minutes.",
       "method": "POST", "url": HOOK + "jarvis-idea", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
       "sendBody": True, "specifyBody": "json",
       "jsonBody": "={{ JSON.stringify({ kind: 'name', text: $fromAI('product', 'The product name or link to check, as the owner said it', 'string') }) }}",
       "options": {"timeout": 30000}}),
  node("k17", "memory_search", "n8n-nodes-base.dataTableTool", 1.1, [1620, 680], {
       "descriptionType": "manual",
       "toolDescription": "Search JARVIS's memory by kind. Kinds: research (daily products), order (Shopify orders), sample, sample_pending, approval, approval_pending, idea (product idea checks), listing (products put on Shopify), briefing, error. Returns the 8 newest rows of that kind.",
       "resource": "row", "operation": "get", "dataTableId": MEMORY,
       "filters": {"conditions": [{"keyName": "kind", "condition": "eq", "keyValue": "={{ $fromAI('kind', 'One kind: research, order, sample, approval, approval_pending, idea, listing, briefing or error', 'string') }}"}]},
       "limit": 8, "orderBy": True, "orderByColumn": "createdAt", "orderByDirection": "DESC"}),
  node("k18", "profit_calculator", "@n8n/n8n-nodes-langchain.toolCode", 1.3, [1760, 680], {
       "description": "Price and profit math for one product: supplier cost and shipping in USD, optional selling price in CAD. Returns landed cost, suggested price, fees, profit and margin.",
       "language": "javaScript", "jsCode": code("brain/5-profit-tool.js"),
       "specifyInputSchema": True, "schemaType": "manual",
       "inputSchema": json.dumps({"type": "object", "properties": {
           "cost_usd": {"type": "number", "description": "Supplier price in USD"},
           "shipping_usd": {"type": "number", "description": "Shipping to Canada in USD"},
           "price_cad": {"type": "number", "description": "Selling price in CAD (0 = suggest one)"},
           "include_ads": {"type": "boolean", "description": "Keep a 20% marketing allowance (default true)"}},
           "required": ["cost_usd", "shipping_usd"]}, indent=1)}),
  node("k19", "morning_briefing", "n8n-nodes-base.httpRequestTool", 4.2, [1900, 680], {
       "toolDescription": "Send the owner a briefing on Telegram now (text and voice): latest research, approvals waiting, decisions, orders and problems. No input needed.",
       "method": "POST", "url": HOOK + "jarvis-briefing", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
       "sendBody": True, "specifyBody": "json", "jsonBody": "={\"from\": \"agent\"}", "options": {"timeout": 30000}}),
  node("k20", "ask_owner_approval", "n8n-nodes-base.httpRequestTool", 4.2, [2040, 680], {
       "toolDescription": "Ask the owner to approve something that spends money, publishes, changes a price, orders stock or samples, posts on social media or contacts people. Sends Approve/Decline buttons on Telegram; the answer is saved in memory (kind approval). Nothing is done automatically.",
       "method": "POST", "url": HOOK + "jarvis-approval", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
       "sendBody": True, "specifyBody": "json",
       "jsonBody": "={{ JSON.stringify({ title: $fromAI('title', 'Short title of what needs approval', 'string'), details: $fromAI('details', 'What exactly would be done, why, and the risks', 'string'), amount_cad: $fromAI('amount_cad', 'Money involved in CAD, 0 if none', 'number') }) }}",
       "options": {"timeout": 30000}}),
  node("k21", "Final reply", "n8n-nodes-base.code", 2, [1500, 300], {"jsCode": code("brain/3-reply.js")}),
  ifnode("k22", "From Telegram?", [1720, 300], "={{ $json.channel === 'telegram' }}"),
  tg_send("k23", "Reply on Telegram", [1940, 200], "={{ $json.telegram_text }}", chat="={{ $json.chat_id }}"),
  node("k24", "Answer the screen", "n8n-nodes-base.respondToWebhook", 1.1, [1940, 400],
       {"respondWith": "json", "responseBody": "={{ JSON.stringify($json.voice_response) }}", "options": {}}),
  # Idea shortcut (Telegram): photo -> download -> base64; link or name -> straight to the idea checker
  ifnode("k25", "Photo?", [440, 0], "={{ $json.idea && $json.idea.kind === 'photo' }}"),
  node("k26", "Get the photo", "n8n-nodes-base.telegram", 1.2, [660, -120], {
       "resource": "file", "fileId": "={{ $json.idea.file_id }}", "download": True, "additionalFields": {}}, onError="continueRegularOutput"),
  cnode("k27", "Photo for the checker", [880, -120], "brain/4-photo.js"),
  call_hook("k28", "Idea checker (photo)", [1100, -120], "jarvis-idea",
            "={{ JSON.stringify({ kind: 'photo', text: $json.text, image_b64: $json.image_b64, mime: $json.mime }) }}", timeout=60000),
  call_hook("k29", "Idea checker (link or name)", [1100, 20], "jarvis-idea",
            "={{ JSON.stringify($('Request').first().json.idea) }}"),
  tg_send("k30", "Tell owner: checking", [1320, -50], "={{ ($json.message || '🔎 Checking this product: suppliers, competitor prices and searches. The report will arrive here in 1-3 minutes.') }}"),
  # Approval requests from the agent (tool ask_owner_approval) -> buttons on Telegram
  node("k31", "Webhook (approval request)", "n8n-nodes-base.webhook", 2, [-700, 1000],
       {"httpMethod": "POST", "path": "jarvis-approval", "authentication": "headerAuth", "responseMode": "onReceived",
        "options": {"responseData": "Approval request sent to the owner's Telegram with Approve/Decline buttons. Wait for the answer; it will be saved in memory (kind approval)."}},
       webhookId="e1c5a7b3-9d2f-4a6e-8b0c-7f3d5e1a2b64"),
  cnode("k32", "Approval text", [-480, 1000], "brain/6-approval.js"),
  mem_insert("k33", "Save pending approval", [-260, 1120]),
  node("k34", "Ask owner: approve?", "n8n-nodes-base.telegram", 1.2, [-260, 960], {
       "operation": "sendAndWait", "chatId": OWNER_CHAT_ID, "message": "={{ $json.approval_text }}", "responseType": "approval",
       "approvalOptions": {"values": {"approvalType": "double", "approveLabel": "✅ Approve", "disapproveLabel": "❌ Decline"}},
       "options": {"limitWaitTime": {"values": {"limitType": "afterTimeInterval", "resumeAmount": 48, "resumeUnit": "hours"}}, "appendAttribution": False}},
       webhookId="f2d6b8c4-0e3a-4b7f-9c1d-8a4e6f2b3c75"),
  cnode("k35", "Approval result", [-40, 960], "brain/7-approval-result.js"),
  mem_insert("k36", "Save approval to memory", [180, 1060]),
  tg_send("k37", "Confirm decision", [180, 900], "={{ $json.reply_text }}"),
]
for a, b, o in [("Telegram Trigger", "Only the owner?", 0), ("Only the owner?", "Sample request?", 0), ("Sample request?", "Request", 1),
                ("Webhook (JARVIS screen)", "Request", 0), ("Request", "Product idea?", 0),
                ("Product idea?", "Photo?", 0), ("Product idea?", "Products request?", 1),
                ("Photo?", "Get the photo", 0), ("Photo?", "Idea checker (link or name)", 1),
                ("Get the photo", "Photo for the checker", 0), ("Photo for the checker", "Idea checker (photo)", 0),
                ("Idea checker (photo)", "Tell owner: checking", 0), ("Idea checker (link or name)", "Tell owner: checking", 0),
                ("Products request?", "Research: send products", 0), ("Products request?", "Read memory", 1),
                ("Research: send products", "Final reply", 0), ("Read memory", "Context", 0), ("Context", "JARVIS agent", 0),
                ("JARVIS agent", "Final reply", 0), ("Final reply", "From Telegram?", 0),
                ("From Telegram?", "Reply on Telegram", 0), ("From Telegram?", "Answer the screen", 1),
                ("Webhook (approval request)", "Approval text", 0), ("Approval text", "Ask owner: approve?", 0), ("Approval text", "Save pending approval", 0),
                ("Ask owner: approve?", "Approval result", 0), ("Approval result", "Confirm decision", 0), ("Approval result", "Save approval to memory", 0)]:
    link(bc, a, b, o)
link(bc, "OmniRoute chat model", "JARVIS agent", kind="ai_languageModel")
link(bc, "Conversation memory", "JARVIS agent", kind="ai_memory")
for t in ("products_today", "run_product_research", "check_product_idea", "memory_search", "profit_calculator", "morning_briefing", "ask_owner_approval"):
    link(bc, t, "JARVIS agent", kind="ai_tool")

# Sample flow: copied unchanged from Telegram v5 (reply "sample" to a product photo).
v5 = json.loads((out_dir / "jarvis-telegram-v5.json").read_text())
sample_names = {n["name"] for n in v5["nodes"] if n["id"].startswith("s")}
for n in v5["nodes"]:
    if n["name"] in sample_names:
        n = json.loads(json.dumps(n)); n["position"] = [n["position"][0] - 300, n["position"][1] + 300]; bn.append(n)
for a, kinds in v5["connections"].items():
    if a in sample_names:
        for o, targets in enumerate(kinds["main"]):
            for t in targets:
                if t["node"] in sample_names: link(bc, a, t["node"], o)
link(bc, "Sample request?", "Read the reply", 0)
save("jarvis-brain-v1.json", "JARVIS Brain v1 (agent: Telegram + screen)", bn, bc)

# ===========================================================================
# IDEA v1: the owner's own product idea (Telegram photo/link/name, or JARVIS's tool) -> full report ->
# Approve -> Shopify listing (GraphQL) -> live link -> 3 videos. Amazon waits for the seller account.
TOKEN_HDR = {"parameters": [{"name": "CJ-Access-Token", "value": "={{ $json.token }}"}]}
THROTTLE = {"batching": {"batch": {"batchSize": 1, "batchInterval": 1500}}, "timeout": 30000}
def omni(id_, name, pos, body="={{ JSON.stringify($json.ai_body) }}"):
    return node(id_, name, "n8n-nodes-base.httpRequest", 4.2, pos, {
        "method": "POST", "url": "http://omniroute:20128/v1/chat/completions",
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "sendBody": True, "specifyBody": "json", "jsonBody": body, "options": {"timeout": 90000}},
        onError="continueRegularOutput", alwaysOutputData=True)
def shopify_gql(id_, name, pos, body, token="={{ $('Shopify token').first().json.access_token }}"):
    return node(id_, name, "n8n-nodes-base.httpRequest", 4.2, pos, {
        "method": "POST", "url": SHOPIFY_API, "sendHeaders": True,
        "headerParameters": {"parameters": [{"name": "X-Shopify-Access-Token", "value": token}]},
        "sendBody": True, "specifyBody": "json", "jsonBody": body, "options": {"timeout": 60000}},
        onError="continueRegularOutput", alwaysOutputData=True)
def serp(id_, name, pos, params):
    return node(id_, name, "n8n-nodes-base.httpRequest", 4.2, pos, {
        "method": "GET", "url": "https://serpapi.com/search.json", "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth",
        "sendQuery": True, "queryParameters": {"parameters": [{"name": k, "value": v} for k, v in params]}, "options": {"timeout": 30000}},
        onError="continueRegularOutput", alwaysOutputData=True)
Y2 = 700
idn = [
  node("i0", "README", "n8n-nodes-base.stickyNote", 1, [-60, -420], {"width": 2200, "height": 300, "content":
    "## JARVIS Idea v1 - check the owner's own product idea, then list it on Shopify after approval\n"
    "Called by **JARVIS Brain** (a photo, link or \"check <product>\" on Telegram, or the agent's check_product_idea tool) at `/webhook/jarvis-idea`.\n"
    "Steps: what is it (free AI, sees photos) → your rules (no batteries/chargers, no beauty, kids, food, medical; certification flags) → best 3 CJ suppliers (Canada/US warehouses first) with shipping to Canada → "
    "market: Google Shopping Canada (incl. Amazon.ca prices when listed) and Google Trends Canada (2 SerpApi searches, cached 10 days) → verdict, price, fees, profit, marketing and Amazon FBA estimates, risks → "
    "report on Telegram with **Approve / Decline** (72 h).\n"
    "**On Approve:** product created on Shopify (title FR, description FR+EN, CJ photos, price, matching collection, CJ SKU), published to the Online Store, live link sent; then the video team renders 3 short videos (server voice service) and sends them with captions and hashtags. "
    "You connect the product in the CJ app (1 min). Amazon: prepared only once your seller account + SP-API are connected, with a separate approval before buying stock. TikTok Shop has no official data: not checked.\n"
    "**Credentials:** *Webhook*: **JARVIS screen key**; *CJ get token*: **CJ API key**; SerpApi nodes: **SerpApi**; OmniRoute nodes: **OmniRoute**; *Shopify token*: Custom Auth **Rangéo Shopify app** (Dev Dashboard app: client ID + secret, scopes read_orders, read_products, write_products, read_publications, write_publications); Telegram nodes: **JARVIS Telegram**."}),
  node("i1", "Webhook (product idea)", "n8n-nodes-base.webhook", 2, [0, 0],
       {"httpMethod": "POST", "path": "jarvis-idea", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}},
       webhookId="b7e3d1a9-4c2f-4e6b-8a0d-1f5c9e3b7d26"),
  cnode("i2", "Idea input", [220, 0], "idea/1-input.js"),
  node("i3", "Answer the caller", "n8n-nodes-base.respondToWebhook", 1.1, [440, 0], {"respondWith": "json", "responseBody": "={{ JSON.stringify($json.reply) }}", "options": {}}),
  ifnode("i4", "Usable request?", [660, 0], "={{ !$json.problem }}"),
  ifnode("i5", "Link?", [880, 0], "={{ !!$json.url }}"),
  node("i6", "Fetch the page", "n8n-nodes-base.httpRequest", 4.2, [1100, -120], {
       "method": "GET", "url": "={{ $json.url }}", "sendHeaders": True,
       "headerParameters": {"parameters": [{"name": "User-Agent", "value": "Mozilla/5.0 (compatible; JARVIS product check)"}, {"name": "Accept-Language", "value": "en-CA,en;q=0.9"}]},
       "options": {"timeout": 15000, "response": {"response": {"responseFormat": "text", "outputPropertyName": "data"}}, "redirect": {"redirect": {"maxRedirects": 5}}}},
       onError="continueRegularOutput", alwaysOutputData=True),
  cnode("i7", "Read the page", [1320, -120], "idea/2-page.js"),
  cnode("i8", "Identify request", [1540, 0], "idea/3-identify-request.js"),
  omni("i9", "What is it? (free AI)", [1760, 0]),
  cnode("i10", "Product identity", [1980, 0], "idea/4-identity.js"),
  ifnode("i11", "Need a CJ token?", [2200, 0], "={{ $json.need_token === true }}"),
  node("i12", "CJ get token", "n8n-nodes-base.httpRequest", 4.2, [2420, -120], {
       "method": "POST", "url": CJ + "/authentication/getAccessToken", "authentication": "genericCredentialType", "genericAuthType": "httpCustomAuth",
       "sendBody": True, "specifyBody": "json", "jsonBody": "={}", "options": {"timeout": 30000}}),
  cnode("i13", "Save token", [2640, -120], "idea/2b-save-token.js"),
  cnode("i14", "CJ searches", [2860, 0], "idea/5-cj-searches.js"),
  node("i15", "CJ product search", "n8n-nodes-base.httpRequest", 4.2, [3080, 0], {
       "method": "GET", "url": CJ + "/product/list", "sendQuery": True, "specifyQuery": "json", "jsonQuery": "={{ JSON.stringify($json.query) }}",
       "sendHeaders": True, "headerParameters": TOKEN_HDR, "options": THROTTLE}, onError="continueRegularOutput"),
  cnode("i16", "Best 3 suppliers", [3300, 0], "idea/6-suppliers.js"),
  ifnode("i17", "Found suppliers?", [3520, 0], "={{ $json.none !== true }}"),
  node("i18", "CJ variants", "n8n-nodes-base.httpRequest", 4.2, [3740, -100], {
       "method": "GET", "url": CJ + "/product/variant/query", "sendQuery": True,
       "queryParameters": {"parameters": [{"name": "pid", "value": "={{ $json.pid }}"}]},
       "sendHeaders": True, "headerParameters": TOKEN_HDR, "options": THROTTLE}, onError="continueRegularOutput"),
  cnode("i19", "Supplier variant", [3960, -100], "idea/7-variant.js"),
  node("i20", "CJ shipping to Canada", "n8n-nodes-base.httpRequest", 4.2, [4180, -100], {
       "method": "POST", "url": CJ + "/logistic/freightCalculate", "sendHeaders": True,
       "headerParameters": {"parameters": [{"name": "CJ-Access-Token", "value": "={{ $('Best 3 suppliers').first().json.token }}"}]},
       "sendBody": True, "specifyBody": "json",
       "jsonBody": "={{ JSON.stringify({ startCountryCode: $json.warehouse || 'CN', endCountryCode: 'CA', products: [{ quantity: 1, vid: $json.vid }] }) }}",
       "options": THROTTLE}, onError="continueRegularOutput"),
  cnode("i21", "Supplier costs", [4400, 0], "idea/8-costs.js"),
  node("i22", "No suppliers", "n8n-nodes-base.code", 2, [3740, 120], {"jsCode": "return [{ json: { suppliers: [] } }];"}),
  node("i23", "SerpApi account (free)", "n8n-nodes-base.httpRequest", 4.2, [4620, 0], {
       "method": "GET", "url": "https://serpapi.com/account.json", "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "options": {"timeout": 20000}},
       onError="continueRegularOutput", alwaysOutputData=True),
  cnode("i24", "Market plan", [4840, 0], "idea/9-market-plan.js"),
  ifnode("i25", "Fresh market check?", [5060, 0], "={{ $json.fresh === true }}"),
  serp("i26", "Google Shopping (Canada)", [5280, -120], [("engine", "google_shopping"), ("q", "={{ $json.q }}"), ("gl", "ca"), ("hl", "en"), ("location", "Canada")]),
  serp("i27", "Google Trends (Canada)", [5500, -120], [("engine", "google_trends"), ("q", "={{ $('Market plan').first().json.q }}"), ("geo", "CA"), ("date", "today 3-m"), ("data_type", "TIMESERIES")]),
  cnode("i28", "Verdict", [5720, 0], "idea/10-verdict.js"),
  omni("i29", "Listing + video scripts (free AI)", [5940, 0]),
  cnode("i30", "Report", [6160, 0], "idea/11-report.js"),
  node("i31", "Send photo", "n8n-nodes-base.telegram", 1.2, [6380, -120], {
       "operation": "sendPhoto", "chatId": OWNER_CHAT_ID, "binaryData": False, "file": "={{ $('Report').first().json.photo }}",
       "additionalFields": {"caption": "={{ $('Report').first().json.caption }}", "parse_mode": "HTML"}}, onError="continueRegularOutput"),
  tg_send("i32", "Send report", [6600, 0], "={{ $('Report').first().json.report }}", html=True),
  node("i33", "Memory row", "n8n-nodes-base.code", 2, [6600, 160], {"jsCode": "const r = $('Report').first().json;\nreturn [{ json: { kind: r.kind, summary: r.summary } }];"}),
  mem_insert("i34", "Save idea to memory", [6820, 160]),
  ifnode("i35", "Offer to list?", [6820, 0], "={{ $('Report').first().json.can_list === true }}"),
  node("i36", "Ask owner: list on Shopify?", "n8n-nodes-base.telegram", 1.2, [7040, -60], {
       "operation": "sendAndWait", "chatId": OWNER_CHAT_ID, "message": "={{ $('Report').first().json.approval_text }}", "responseType": "approval",
       "approvalOptions": {"values": {"approvalType": "double", "approveLabel": "✅ Approve: list it", "disapproveLabel": "❌ Decline"}},
       "options": {"limitWaitTime": {"values": {"limitType": "afterTimeInterval", "resumeAmount": 72, "resumeUnit": "hours"}}, "appendAttribution": False}},
       webhookId="c8f4e2b0-5d3a-4f7c-9b1e-2a6d0f4c8e37"),
  cnode("i37", "Decision", [7260, -60], "idea/12-decision.js"),
  mem_insert("i38", "Save decision", [7480, 80]),
  tg_send("i39", "Tell owner: decision", [7480, -200], "={{ $json.reply_text }}"),
  ifnode("i40", "Approved?", [7480, -60], "={{ $json.approved === true }}"),
  node("i41", "CJ product photos", "n8n-nodes-base.httpRequest", 4.2, [7700, -60], {
       "method": "GET", "url": CJ + "/product/query", "sendQuery": True,
       "queryParameters": {"parameters": [{"name": "pid", "value": "={{ $('Report').first().json.best.pid }}"}]},
       "sendHeaders": True, "headerParameters": {"parameters": [{"name": "CJ-Access-Token", "value": "={{ $getWorkflowStaticData('global').cjToken ? $getWorkflowStaticData('global').cjToken.value : '' }}"}]},
       "options": {"timeout": 30000}}, onError="continueRegularOutput", alwaysOutputData=True),
  shop_token("i60", "Shopify token", [7810, -200]),
  shopify_gql("i42", "Shopify: collections + channels", [7920, -60],
       "={{ JSON.stringify({ query: '{ collections(first: 50) { nodes { id title } } publications(first: 20) { nodes { id name } } }' }) }}"),
  cnode("i43", "Product for Shopify", [8140, -60], "idea/13-shopify-input.js"),
  shopify_gql("i44", "Shopify: create product", [8360, -60], "={{ JSON.stringify($json.gql) }}"),
  ifnode("i45", "Created + channel known?", [8580, -60], "={{ !!($json.data && $json.data.productSet && $json.data.productSet.product) && !!$('Product for Shopify').first().json.publication_id }}"),
  shopify_gql("i46", "Publish to Online Store", [8800, -160],
       "={{ JSON.stringify({ query: 'mutation p($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }', variables: { id: $('Shopify: create product').first().json.data.productSet.product.id, input: [{ publicationId: $('Product for Shopify').first().json.publication_id }] } }) }}"),
  cnode("i47", "Listing result", [9020, -60], "idea/14-listing-result.js"),
  tg_send("i48", "Send live link", [9240, -160], "={{ $('Listing result').first().json.text }}", html=True),
  mem_insert("i49", "Save listing to memory", [9240, 40]),
  ifnode("i50", "Listed?", [9460, -160], "={{ $('Listing result').first().json.ok === true }}"),
  cnode("i51", "Video scripts", [9680, -160], "idea/15-video-scripts.js"),
  tg_send("i52", "Send scripts", [9900, -280], "={{ $('Video scripts').first().json.scripts }}", html=True, executeOnce=True),
  node("i53", "Make video (server)", "n8n-nodes-base.httpRequest", 4.2, [9900, -100], {
       "method": "POST", "url": "http://jarvis-tts:5000/video", "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.video_body) }}",
       "options": {"timeout": 300000, "batching": {"batch": {"batchSize": 1, "batchInterval": 500}},
                   "response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}}}},
       onError="continueRegularOutput"),
  node("i54", "Send video", "n8n-nodes-base.telegram", 1.2, [10120, -100], {
       "operation": "sendVideo", "chatId": OWNER_CHAT_ID, "binaryData": True, "binaryPropertyName": "data",
       "additionalFields": {"caption": "={{ $('Video scripts').item.json.caption }}", "fileName": "={{ 'rangeo-video-' + $('Video scripts').item.json.n + '.mp4' }}"}},
       onError="continueRegularOutput"),
  # problems and "no supplier" paths
  node("i55", "Problem reply", "n8n-nodes-base.code", 2, [880, 160], {"jsCode": "return [{ json: { text: '⚠️ ' + $json.problem } }];"}),
  tg_send("i56", "Send problem", [1100, 160], "={{ $json.text }}"),
  ifnode("i57", "Can check?", [2090, 140], "={{ !$json.problem }}"),
  node("i58", "Identity problem", "n8n-nodes-base.code", 2, [2300, 260], {"jsCode": "return [{ json: { text: '⚠️ ' + $json.problem } }];"}),
  tg_send("i59", "Send identity problem", [2520, 260], "={{ $json.text }}"),
]
idc = {}
for a, b, o in [("Webhook (product idea)", "Idea input", 0), ("Idea input", "Answer the caller", 0), ("Answer the caller", "Usable request?", 0),
                ("Usable request?", "Link?", 0), ("Usable request?", "Problem reply", 1), ("Problem reply", "Send problem", 0),
                ("Link?", "Fetch the page", 0), ("Link?", "Identify request", 1), ("Fetch the page", "Read the page", 0), ("Read the page", "Identify request", 0),
                ("Identify request", "What is it? (free AI)", 0), ("What is it? (free AI)", "Product identity", 0), ("Product identity", "Can check?", 0),
                ("Can check?", "Need a CJ token?", 0), ("Can check?", "Identity problem", 1), ("Identity problem", "Send identity problem", 0),
                ("Need a CJ token?", "CJ get token", 0), ("Need a CJ token?", "CJ searches", 1), ("CJ get token", "Save token", 0), ("Save token", "CJ searches", 0),
                ("CJ searches", "CJ product search", 0), ("CJ product search", "Best 3 suppliers", 0), ("Best 3 suppliers", "Found suppliers?", 0),
                ("Found suppliers?", "CJ variants", 0), ("Found suppliers?", "No suppliers", 1), ("CJ variants", "Supplier variant", 0),
                ("Supplier variant", "CJ shipping to Canada", 0), ("CJ shipping to Canada", "Supplier costs", 0), ("No suppliers", "Supplier costs", 0),
                ("Supplier costs", "SerpApi account (free)", 0), ("SerpApi account (free)", "Market plan", 0), ("Market plan", "Fresh market check?", 0),
                ("Fresh market check?", "Google Shopping (Canada)", 0), ("Fresh market check?", "Verdict", 1), ("Google Shopping (Canada)", "Google Trends (Canada)", 0),
                ("Google Trends (Canada)", "Verdict", 0), ("Verdict", "Listing + video scripts (free AI)", 0), ("Listing + video scripts (free AI)", "Report", 0),
                ("Report", "Memory row", 0), ("Memory row", "Save idea to memory", 0), ("Save idea to memory", "Send photo", 0), ("Send photo", "Send report", 0),
                ("Send report", "Offer to list?", 0), ("Offer to list?", "Ask owner: list on Shopify?", 0), ("Ask owner: list on Shopify?", "Decision", 0),
                ("Decision", "Save decision", 0), ("Decision", "Tell owner: decision", 0), ("Decision", "Approved?", 0),
                ("Approved?", "CJ product photos", 0), ("CJ product photos", "Shopify token", 0), ("Shopify token", "Shopify: collections + channels", 0), ("Shopify: collections + channels", "Product for Shopify", 0),
                ("Product for Shopify", "Shopify: create product", 0), ("Shopify: create product", "Created + channel known?", 0),
                ("Created + channel known?", "Publish to Online Store", 0), ("Created + channel known?", "Listing result", 1), ("Publish to Online Store", "Listing result", 0),
                ("Listing result", "Send live link", 0), ("Listing result", "Save listing to memory", 0), ("Send live link", "Listed?", 0),
                ("Listed?", "Video scripts", 0), ("Video scripts", "Send scripts", 0), ("Video scripts", "Make video (server)", 0), ("Make video (server)", "Send video", 0)]:
    link(idc, a, b, o)
save("jarvis-idea-v1.json", "JARVIS Idea v1 (check my product idea)", idn, idc)


# ===========================================================================
# SHOP v2: Rangéo store manager without a permanent Shopify key (Shopify's Dev Dashboard apps since 2026):
# token by client credentials, new orders every 10 minutes (GraphQL), daily late-order check.
def shc(f): return code("shop/" + f)
spn = [
  node("q0", "README", "n8n-nodes-base.stickyNote", 1, [-60, -300], {"width": 1500, "height": 220, "content":
    "## JARVIS Shop v2 - Rangéo store manager\n"
    "**Every 10 minutes:** new Shopify orders -> Telegram alert (items, total, estimated profit, city) + memory (screen and briefing see it).\n"
    "**Every day 8:45:** paid orders not shipped after 4 days -> one alert. Silent when all is fine.\n"
    "Shopify key: Custom Auth credential **Rangéo Shopify app** in *Shopify token* (Dev Dashboard app client ID + secret; JARVIS gets a fresh 24 h token itself). "
    "**JARVIS Telegram** in both Send nodes. New product? Add its CJ SKU and cost (USD, product + shipping) to COSTS in *Format order*. Replaces Shop v1."}),
  node("q1", "Every 10 minutes", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 0], {"rule": {"interval": [{"field": "minutes", "minutesInterval": 10}]}}),
  node("q2", "New orders mode", "n8n-nodes-base.code", 2, [200, 0], {"jsCode": "return [{ json: { mode: 'new' } }];"}),
  node("q3", "Every day 8:45", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 300], {"rule": {"interval": [{"field": "cronExpression", "expression": "45 8 * * *"}]}}),
  node("q4", "Check now", "n8n-nodes-base.manualTrigger", 1, [0, 460], {}),
  node("q5", "Late orders mode", "n8n-nodes-base.code", 2, [200, 380], {"jsCode": "return [{ json: { mode: 'late' } }];"}),
  cnode("q6", "Which check?", [420, 150], "shop/0-which.js"),
  ifnode("q7", "Need a token?", [640, 150], "={{ $json.need_token === true }}"),
  shop_token("q8", "Shopify token", [860, 40]),
  cnode("q9", "Token", [1080, 150], "shop/0-token.js"),
  shopify_gql("q10", "Shopify orders", [1300, 150], "={{ JSON.stringify($json.gql) }}", token="={{ $json.shop_token }}"),
  cnode("q11", "Orders", [1520, 150], "shop/0-orders-from-graphql.js"),
  ifnode("q12", "New-order check?", [1740, 150], "={{ $('Which check?').first().json.mode === 'new' }}"),
  node("q13", "Format order", "n8n-nodes-base.code", 2, [1960, 40], {"jsCode": code("shop/1-new-order.js")}),
  tg_send("q14", "Send order alert", [2180, -40], "={{ $json.text }}", html=True),
  mem_insert("q15", "Save order to memory", [2180, 120]),
  node("q16", "Late orders", "n8n-nodes-base.code", 2, [1960, 300], {"jsCode": code("shop/2-stuck.js")}),
  ifnode("q17", "Any late?", [2180, 300], "={{ $json.send === true }}"),
  tg_send("q18", "Send late alert", [2400, 220], "={{ $json.text }}", html=True),
  mem_insert("q19", "Save late to memory", [2400, 380]),
]
spc = {}
for a, b, o in [("Every 10 minutes", "New orders mode", 0), ("Every day 8:45", "Late orders mode", 0), ("Check now", "Late orders mode", 0),
                ("New orders mode", "Which check?", 0), ("Late orders mode", "Which check?", 0), ("Which check?", "Need a token?", 0),
                ("Need a token?", "Shopify token", 0), ("Need a token?", "Token", 1), ("Shopify token", "Token", 0), ("Token", "Shopify orders", 0),
                ("Shopify orders", "Orders", 0), ("Orders", "New-order check?", 0), ("New-order check?", "Format order", 0), ("New-order check?", "Late orders", 1),
                ("Format order", "Send order alert", 0), ("Format order", "Save order to memory", 0),
                ("Late orders", "Any late?", 0), ("Any late?", "Send late alert", 0), ("Any late?", "Save late to memory", 0)]:
    link(spc, a, b, o)
save("jarvis-shop-v2.json", "JARVIS Shop v2 (Rangéo orders)", spn, spc)
