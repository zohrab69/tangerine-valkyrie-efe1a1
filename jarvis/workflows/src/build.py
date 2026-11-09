"""Builds jarvis-ceo-v0.json from the tested Code-node sources in this folder.
Run: python3 build.py   (then: node test.mjs to re-test the logic)"""
import json, pathlib
here = pathlib.Path(__file__).parent
code = lambda f: (here / f).read_text()

def node(id_, name, type_, ver, pos, params, **extra):
    n = {"id": id_, "name": name, "type": type_, "typeVersion": ver, "position": pos, "parameters": params}
    n.update(extra); return n

body = ("={{ JSON.stringify({ model: $json.route.model, instructions: $json.instructions, "
        "input: $json.owner_message, max_output_tokens: $json.route.max_output_tokens, "
        "reasoning: { effort: $json.route.reasoning_effort }, "
        "text: { format: { type: 'json_object' } }, store: false }) }}")

nodes = [
  node("a1", "Start (manual test)", "n8n-nodes-base.manualTrigger", 1, [0, 300], {}),
  node("a2", "Owner request", "n8n-nodes-base.code", 2, [220, 300], {"jsCode": code("1-owner-request.js")}),
  node("a3", "Router + budget guard", "n8n-nodes-base.code", 2, [440, 300], {"jsCode": code("2-router.js")}),
  node("a4", "Within budget?", "n8n-nodes-base.if", 2.2, [660, 300], {
      "conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
        "conditions": [{"id": "c1", "leftValue": "={{ $json.within_budget }}", "rightValue": "",
                        "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
        "combinator": "and"},
      "options": {}}),
  node("a5", "Call OpenAI (Responses API)", "n8n-nodes-base.httpRequest", 4.2, [900, 200], {
      "method": "POST", "url": "https://api.openai.com/v1/responses",
      "authentication": "predefinedCredentialType", "nodeCredentialType": "openAiApi",
      "sendBody": True, "specifyBody": "json", "jsonBody": body,
      "options": {"timeout": 60000}},
      retryOnFail=True, maxTries=3, waitBetweenTries=5000),
  node("a6", "Parse, cost & log", "n8n-nodes-base.code", 2, [1120, 200], {"jsCode": code("3-parse-log.js")}),
  node("a7", "Stop: ask owner (budget)", "n8n-nodes-base.code", 2, [900, 420], {"jsCode":
      "// Budget cap reached: nothing was sent to any AI provider.\n"
      "// Phase 2 replaces this with a Telegram 'send and wait for approval' message.\n"
      "const t = $input.first().json;\n"
      "return [{ json: { task_id: t.task_id, status: 'blocked_budget', reason: t.budget_reason,\n"
      "  message_to_owner: `JARVIS paused task ${t.task_id}: ${t.budget_reason}. Approve a higher cap or wait.` } }];\n"}),
  node("a8", "README", "n8n-nodes-base.stickyNote", 1, [-40, -40], {"width": 1180, "height": 220, "content":
      "## JARVIS CEO v0 - dispatcher test\n"
      "1. Open **Call OpenAI** and pick your OpenAI credential (Credentials > New > OpenAI, paste the key there, never in chat).\n"
      "2. Click **Execute workflow**. Expected: *Parse, cost & log* shows a JSON work order and a cost of a fraction of a cent.\n"
      "3. Edit `owner_message` in **Owner request** to try other requests.\n\n"
      "Routing/caps live in the Router code (mirror of jarvis/config/*.json). The spend ledger only persists for activated (production) runs."}),
]
connections = {
  "Start (manual test)": {"main": [[{"node": "Owner request", "type": "main", "index": 0}]]},
  "Owner request": {"main": [[{"node": "Router + budget guard", "type": "main", "index": 0}]]},
  "Router + budget guard": {"main": [[{"node": "Within budget?", "type": "main", "index": 0}]]},
  "Within budget?": {"main": [[{"node": "Call OpenAI (Responses API)", "type": "main", "index": 0}],
                              [{"node": "Stop: ask owner (budget)", "type": "main", "index": 0}]]},
  "Call OpenAI (Responses API)": {"main": [[{"node": "Parse, cost & log", "type": "main", "index": 0}]]},
}
wf = {"name": "JARVIS CEO v0", "nodes": nodes, "connections": connections,
      "settings": {"executionOrder": "v1", "saveManualExecutions": True}, "pinData": {}}
(here.parent / "jarvis-ceo-v0.json").write_text(json.dumps(wf, indent=2) + "\n")
print("wrote jarvis-ceo-v0.json")


# ---------------------------------------------------------------------------
# Multi-provider workflows: a chain of "Use X? -> Call X -> Got X" blocks, falling through on error.
R = "$('Router (multi-AI)').first().json"

def chain_workflow(wf_name, file_name, router_file, order, labels, auth, readme, front=None, tail=None):
    # front: (nodes, connections, last_node_name) replacing the manual Start + Owner request
    # tail:  (nodes, connections, sink_node_name) that receives both the result and the "unavailable" message
    if front is None:
        front = ([node("b1", "Start (manual test)", "n8n-nodes-base.manualTrigger", 1, [0, 400], {}),
                  node("b2", "Owner request", "n8n-nodes-base.code", 2, [200, 400], {"jsCode": code("1-owner-request.js")})],
                 {"Start (manual test)": {"main": [[{"node": "Owner request", "type": "main", "index": 0}]]}},
                 "Owner request")
    n = list(front[0]) + [
      node("b3", "Router (multi-AI)", "n8n-nodes-base.code", 2, [400, 400], {"jsCode": code(router_file)}),
      node("b9", "Parse, cost & log", "n8n-nodes-base.code", 2, [1500, 100], {"jsCode": code("gateway-parse.js")}),
      node("b10", "All AIs unavailable: ask owner", "n8n-nodes-base.code", 2, [1500, 1100], {"jsCode":
          "// No AI could answer (not set up, free limits used, budget reached, or all errored).\n"
          "// Phase 2 sends this to the owner on Telegram.\n"
          "const r = $('Router (multi-AI)').first().json;\n"
          "return [{ json: { task_id: r.task_id, status: 'blocked_no_ai', skipped: r.skipped,\n"
          "  message_to_owner: `JARVIS could not run task ${r.task_id}: no AI available (${r.skipped.join('; ')}). Check keys/limits or raise the budget.` } }];\n"}),
      node("b11", "README", "n8n-nodes-base.stickyNote", 1, [-40, -160], {"width": 1300, "height": 240, "content": readme}),
    ]
    c = dict(front[1])
    c.update({
      front[2]: {"main": [[{"node": "Router (multi-AI)", "type": "main", "index": 0}]]},
      "Router (multi-AI)": {"main": [[{"node": f"Use {labels[order[0]]}?", "type": "main", "index": 0}]]},
    })
    for i, p in enumerate(order):
        y = 100 + i * 250
        use, call, got = f"Use {labels[p]}?", f"Call {labels[p]}", f"Got {p}"
        nxt = f"Use {labels[order[i+1]]}?" if i + 1 < len(order) else "All AIs unavailable: ask owner"
        n.append(node(f"u{i}", use, "n8n-nodes-base.if", 2.2, [650, y], {
            "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                           "conditions": [{"id": f"u{i}c", "leftValue": "={{ !!" + R + ".calls." + p + " }}", "rightValue": "",
                                           "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                           "combinator": "and"}, "options": {}}))
        params = {"method": "POST", "url": "={{ " + R + ".calls." + p + ".url }}",
                  "sendBody": True, "specifyBody": "json",
                  "jsonBody": "={{ JSON.stringify(" + R + ".calls." + p + ".body) }}",
                  "options": {"timeout": 90000}}
        params.update(auth(p))
        n.append(node(f"h{i}", call, "n8n-nodes-base.httpRequest", 4.2, [900, y], params,
                      retryOnFail=True, maxTries=2, waitBetweenTries=3000, onError="continueErrorOutput"))
        n.append(node(f"g{i}", got, "n8n-nodes-base.set", 3.4, [1150, y], {
            "mode": "manual", "includeOtherFields": True, "options": {},
            "assignments": {"assignments": [{"id": f"g{i}a", "name": "_provider", "value": p, "type": "string"}]}}))
        c[use] = {"main": [[{"node": call, "type": "main", "index": 0}], [{"node": nxt, "type": "main", "index": 0}]]}
        c[call] = {"main": [[{"node": got, "type": "main", "index": 0}], [{"node": nxt, "type": "main", "index": 0}]]}
        c[got] = {"main": [[{"node": "Parse, cost & log", "type": "main", "index": 0}]]}
    if tail is not None:
        n += tail[0]
        c.update(tail[1])
        sinks = tail[2] if isinstance(tail[2], tuple) else (tail[2], tail[2])
        for src, dst in zip(("Parse, cost & log", "All AIs unavailable: ask owner"), sinks):
            c[src] = {"main": [[{"node": dst, "type": "main", "index": 0}]]}
    wf = {"name": wf_name, "nodes": n, "connections": c,
          "settings": {"executionOrder": "v1", "saveManualExecutions": True}, "pinData": {}}
    (here.parent / file_name).write_text(json.dumps(wf, indent=2) + "\n")
    print("wrote", file_name)

HEADER = {"authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth"}
OPENAI = {"authentication": "predefinedCredentialType", "nodeCredentialType": "openAiApi"}

# v1: direct providers (no extra software)
chain_workflow("JARVIS CEO v1 (multi-AI)", "jarvis-ceo-v1-multi-ai.json", "gateway-router.js",
    ["gemini", "groq", "openrouter", "openai"],
    {"gemini": "Gemini (free)", "groq": "Groq (free)", "openrouter": "OpenRouter (free)", "openai": "OpenAI (paid)"},
    lambda p: OPENAI if p == "openai" else HEADER,
    "## JARVIS CEO v1 - multi-AI (free first, paid last)\n"
    "Tries Gemini -> Groq -> OpenRouter -> OpenAI. Moves to the next only if one fails or is over its free limit / your budget.\n"
    "Setup: in each **Call** node pick a credential. Gemini/Groq/OpenRouter: *Header Auth*, Name `Authorization`, Value `Bearer <your key>`. OpenAI: your OpenAI credential.\n"
    "A provider without a key: set `enabled: false` for it in the Router code. OpenRouter starts disabled until you choose a free model.\n"
    "Tasks with `contains_personal_data: true` never go to free tiers.")

# v2: through OmniRoute (provider fallback happens inside OmniRoute combos)
chain_workflow("JARVIS CEO v2 (OmniRoute)", "jarvis-ceo-v2-omniroute.json", "omniroute-router.js",
    ["free", "paid"], {"free": "OmniRoute free combo", "paid": "OmniRoute paid combo"},
    lambda p: HEADER,
    "## JARVIS CEO v2 - through OmniRoute\n"
    "Free combo `jarvis-free` first (OmniRoute switches between Gemini/Groq/OpenRouter inside it), paid combo `jarvis-paid` only if free fails, for T3 decisions, or for personal data - and only within your budget.\n"
    "Setup: create a *Header Auth* credential \"OmniRoute\": Name `Authorization`, Value `Bearer <OmniRoute API key>` and select it in both **Call** nodes.\n"
    "Needs `07-setup-omniroute.ps1` and the two combos created in the OmniRoute dashboard.")

# v3: talk to JARVIS from Telegram (owner only), reply in the same chat
OWNER_CHAT_ID = "6203634137"
tg_front = (
  [node("t1", "Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, [-200, 400],
        {"updates": ["message"], "additionalFields": {}}, webhookId="7d4554fc-391d-40f4-93c5-b218d03c6de6"),
   node("t2", "Only the owner?", "n8n-nodes-base.if", 2.2, [0, 400], {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                       "conditions": [
                         {"id": "o1", "leftValue": "={{ String($json.message?.chat?.id ?? '') }}", "rightValue": OWNER_CHAT_ID,
                          "operator": {"type": "string", "operation": "equals"}},
                         {"id": "o2", "leftValue": "={{ $json.message?.text ?? '' }}", "rightValue": "",
                          "operator": {"type": "string", "operation": "notEmpty", "singleValue": True}}],
                       "combinator": "and"}, "options": {}}),
   node("t3", "Owner request (Telegram)", "n8n-nodes-base.code", 2, [200, 400], {"jsCode": code("telegram-request.js")})],
  {"Telegram Trigger": {"main": [[{"node": "Only the owner?", "type": "main", "index": 0}]]},
   "Only the owner?": {"main": [[{"node": "Owner request (Telegram)", "type": "main", "index": 0}], []]}},
  "Owner request (Telegram)")
tg_tail = (
  [node("t5", "Approval rule", "n8n-nodes-base.code", 2, [1700, 100], {"jsCode": code("approval-rule.js")}),
   node("t6", "Needs owner approval?", "n8n-nodes-base.if", 2.2, [1900, 100], {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                       "conditions": [{"id": "na1", "leftValue": "={{ $json.needs_approval }}", "rightValue": "",
                                       "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                       "combinator": "and"}, "options": {}}),
   node("t7", "Ask owner to approve", "n8n-nodes-base.telegram", 1.2, [2150, -50], {
        "operation": "sendAndWait",
        "chatId": "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        "message": "={{ $json.approval_text }}",
        "responseType": "approval",
        "approvalOptions": {"values": {"approvalType": "double", "approveLabel": "✅ Approve", "disapproveLabel": "❌ Decline"}},
        "options": {"limitWaitTime": {"values": {"limitType": "afterTimeInterval", "resumeAmount": 48, "resumeUnit": "hours"}},
                    "appendAttribution": False}}, webhookId="78396cf1-c6be-4926-a714-86d29a185cb6"),
   node("t10", "Record decision", "n8n-nodes-base.code", 2, [2400, -50], {"jsCode": code("record-decision.js")}),
   node("t8", "Format reply", "n8n-nodes-base.code", 2, [2650, 300], {"jsCode": code("format-reply.js")}),
   node("t9", "Reply on Telegram", "n8n-nodes-base.telegram", 1.2, [2850, 300], {
        "chatId": "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        "text": "={{ $json.reply_text }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"}})],
  {"Approval rule": {"main": [[{"node": "Needs owner approval?", "type": "main", "index": 0}]]},
   "Needs owner approval?": {"main": [[{"node": "Ask owner to approve", "type": "main", "index": 0}],
                                      [{"node": "Format reply", "type": "main", "index": 0}]]},
   "Ask owner to approve": {"main": [[{"node": "Record decision", "type": "main", "index": 0}]]},
   "Record decision": {"main": [[{"node": "Format reply", "type": "main", "index": 0}]]},
   "Format reply": {"main": [[{"node": "Reply on Telegram", "type": "main", "index": 0}]]}},
  ("Approval rule", "Format reply"))
chain_workflow("JARVIS Telegram v4 (approvals)", "jarvis-telegram-v4.json", "omniroute-router.js",
    ["free", "paid"], {"free": "OmniRoute free combo", "paid": "OmniRoute paid combo"},
    lambda p: HEADER,
    "## JARVIS Telegram v4 - talk to JARVIS + approve from your phone\n"
    "Launching, spending, ads, subscriptions, contracts, refunds, contacting new people, price or account changes: JARVIS first asks you with Approve / Decline buttons (48 h; no answer = rejected).\n"
    "Only messages from the owner's chat ID are answered; everyone else is ignored.\n"
    "Setup: select **JARVIS Telegram** in *Telegram Trigger*, *Ask owner to approve* and *Reply on Telegram*, and **OmniRoute** in both *Call* nodes. Save, then switch the workflow to **Active** (Publish).\n"
    "Only one Telegram trigger per bot can be active at a time: unpublish v3 before publishing v4.",
    front=tg_front, tail=tg_tail)

# Voice v1: the JARVIS screen (jarvis/ui) -> Caddy (password + secret header) -> this webhook.
# Answers the screen at once; approvals continue on Telegram with buttons.
voice_front = (
  [node("w1", "Webhook (JARVIS screen)", "n8n-nodes-base.webhook", 2, [-200, 400],
        {"httpMethod": "POST", "path": "jarvis-voice", "authentication": "headerAuth",
         "responseMode": "responseNode", "options": {}}, webhookId="875474be-d6a5-431e-a5fc-c941329ca912"),
   node("w2", "Voice request", "n8n-nodes-base.code", 2, [200, 400], {"jsCode": code("voice-request.js")})],
  {"Webhook (JARVIS screen)": {"main": [[{"node": "Voice request", "type": "main", "index": 0}]]}},
  "Voice request")
voice_tail = (
  [node("v5", "Approval rule", "n8n-nodes-base.code", 2, [1700, 100], {"jsCode": code("approval-rule.js")}),
   node("v6", "Voice answer", "n8n-nodes-base.code", 2, [1900, 300], {"jsCode": code("voice-answer.js")}),
   node("v7", "Answer the screen", "n8n-nodes-base.respondToWebhook", 1.1, [2100, 300],
        {"respondWith": "json", "responseBody": "={{ JSON.stringify($json.voice_response) }}", "options": {}}),
   node("v8", "Needs owner approval?", "n8n-nodes-base.if", 2.2, [2300, 300], {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                       "conditions": [{"id": "va1", "leftValue": "={{ $json.needs_approval === true }}", "rightValue": "",
                                       "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                       "combinator": "and"}, "options": {}}),
   node("v9", "Ask owner to approve", "n8n-nodes-base.telegram", 1.2, [2550, 150], {
        "operation": "sendAndWait",
        "chatId": OWNER_CHAT_ID,
        "message": "={{ $json.approval_text }}",
        "responseType": "approval",
        "approvalOptions": {"values": {"approvalType": "double", "approveLabel": "✅ Approve", "disapproveLabel": "❌ Decline"}},
        "options": {"limitWaitTime": {"values": {"limitType": "afterTimeInterval", "resumeAmount": 48, "resumeUnit": "hours"}},
                    "appendAttribution": False}}, webhookId="a72e4a90-320c-4628-b7a8-41ba16a2a733"),
   node("v10", "Record decision", "n8n-nodes-base.code", 2, [2800, 150], {"jsCode": code("record-decision.js")}),
   node("v11", "Format reply", "n8n-nodes-base.code", 2, [3000, 150], {"jsCode": code("format-reply.js")}),
   node("v12", "Reply on Telegram", "n8n-nodes-base.telegram", 1.2, [3200, 150], {
        "chatId": OWNER_CHAT_ID, "text": "={{ $json.reply_text }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"}})],
  {"Approval rule": {"main": [[{"node": "Voice answer", "type": "main", "index": 0}]]},
   "Voice answer": {"main": [[{"node": "Answer the screen", "type": "main", "index": 0}]]},
   "Answer the screen": {"main": [[{"node": "Needs owner approval?", "type": "main", "index": 0}]]},
   "Needs owner approval?": {"main": [[{"node": "Ask owner to approve", "type": "main", "index": 0}], []]},
   "Ask owner to approve": {"main": [[{"node": "Record decision", "type": "main", "index": 0}]]},
   "Record decision": {"main": [[{"node": "Format reply", "type": "main", "index": 0}]]},
   "Format reply": {"main": [[{"node": "Reply on Telegram", "type": "main", "index": 0}]]}},
  ("Approval rule", "Voice answer"))
chain_workflow("JARVIS Voice v1 (screen)", "jarvis-voice-v1.json", "omniroute-router.js",
    ["free", "paid"], {"free": "OmniRoute free combo", "paid": "OmniRoute paid combo"},
    lambda p: HEADER,
    "## JARVIS Voice v1 - the JARVIS screen\n"
    "The page at https://jarvis.<server>.sslip.io (password protected) sends your words here. JARVIS answers the screen at once; approvals go to your Telegram with buttons.\n"
    "Setup: *Webhook* -> Header Auth credential **JARVIS screen key** (Name X-Jarvis-Key, Value = VOICE_SECRET printed by voice-setup.sh). **OmniRoute** in both *Call* nodes. **JARVIS Telegram** in *Ask owner to approve* and *Reply on Telegram*. Save, then Publish.",
    front=voice_front, tail=voice_tail)

# ---------------------------------------------------------------------------
# Research v1: CJ product research -> finance math -> free-AI notes -> Telegram report.
def rcode(f): return (here / "research" / f).read_text()
CJ = "https://developers.cjdropshipping.com/api2.0/v1"
TOKEN_HDR = {"parameters": [{"name": "CJ-Access-Token", "value": "={{ $json.token }}"}]}
THROTTLE = {"batching": {"batch": {"batchSize": 1, "batchInterval": 1500}}, "timeout": 30000}
def ifnode(id_, name, pos, expr):
    return node(id_, name, "n8n-nodes-base.if", 2.2, pos, {
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                       "conditions": [{"id": id_ + "c", "leftValue": expr, "rightValue": "",
                                       "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                       "combinator": "and"}, "options": {}})
rn = [
  node("r0", "README", "n8n-nodes-base.stickyNote", 1, [-60, -260], {"width": 1500, "height": 230, "content":
      "## JARVIS Research v1 - real products from CJ Dropshipping, sent to your Telegram\n"
      "Runs every **Monday 10:00** (Toronto) and when you click Execute. Searches 3 product themes on CJ (no electronics, cosmetics, kids, food, medical), "
      "gets the supplier price and **real shipping quotes to Canada**, does the profit math (no AI), lets the free AI add one note per product, and sends you the top 5.\n"
      "Credentials: **CJ API key** (Custom Auth) in *CJ get token*; **OmniRoute** in *AI notes*; **JARVIS Telegram** in *Send product photo* and *Send report*. Check each one after import: n8n may auto-pick the wrong credential.\n"
      "All money figures are estimates. Nothing is ordered or published."}),
  node("r1", "Every Monday 10:00", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 0],
       {"rule": {"interval": [{"field": "weeks", "weeksInterval": 1, "triggerAtDay": [1], "triggerAtHour": 10}]}}),
  node("r2", "Run now (manual)", "n8n-nodes-base.manualTrigger", 1, [0, 200], {}),
  node("r3", "Research plan", "n8n-nodes-base.code", 2, [220, 100], {"jsCode": rcode("1-plan.js")}),
  ifnode("r4", "Need a new CJ token?", [440, 100], "={{ $json.need_token === true }}"),
  node("r5", "CJ get token", "n8n-nodes-base.httpRequest", 4.2, [660, -20], {
       "method": "POST", "url": CJ + "/authentication/getAccessToken",
       "authentication": "genericCredentialType", "genericAuthType": "httpCustomAuth",
       "sendBody": True, "specifyBody": "json", "jsonBody": "={}", "options": {"timeout": 30000}}),
  node("r6", "Save token", "n8n-nodes-base.code", 2, [880, -20], {"jsCode": rcode("2-save-token.js")}),
  node("r7", "Searches", "n8n-nodes-base.code", 2, [1100, 100], {"jsCode": rcode("3-searches.js")}),
  node("r8", "CJ product search", "n8n-nodes-base.httpRequest", 4.2, [1320, 100], {
       "method": "GET", "url": CJ + "/product/list",
       "sendQuery": True, "queryParameters": {"parameters": [
           {"name": "pageNum", "value": "1"}, {"name": "pageSize", "value": "={{ $json.page_size }}"},
           {"name": "productNameEn", "value": "={{ $json.keyword }}"},
           {"name": "orderBy", "value": "listedNum"}]},
       "sendHeaders": True, "headerParameters": TOKEN_HDR, "options": THROTTLE}, onError="continueRegularOutput"),
  node("r9", "Screen products", "n8n-nodes-base.code", 2, [1540, 100], {"jsCode": rcode("4-screen.js")}),
  ifnode("r10", "Nothing found?", [1760, 100], "={{ $json.empty === true }}"),
  node("r11", "CJ variants", "n8n-nodes-base.httpRequest", 4.2, [1980, 200], {
       "method": "GET", "url": CJ + "/product/variant/query",
       "sendQuery": True, "queryParameters": {"parameters": [{"name": "pid", "value": "={{ $json.pid }}"}]},
       "sendHeaders": True, "headerParameters": TOKEN_HDR, "options": THROTTLE}, onError="continueRegularOutput"),
  node("r12", "Pick variant", "n8n-nodes-base.code", 2, [2200, 200], {"jsCode": rcode("5-pick-variant.js")}),
  node("r13", "CJ shipping to Canada", "n8n-nodes-base.httpRequest", 4.2, [2420, 200], {
       "method": "POST", "url": CJ + "/logistic/freightCalculate",
       "sendHeaders": True, "headerParameters": TOKEN_HDR,
       "sendBody": True, "specifyBody": "json",
       "jsonBody": "={{ JSON.stringify({ startCountryCode: 'CN', endCountryCode: 'CA', products: [{ quantity: 1, vid: $json.vid }] }) }}",
       "options": THROTTLE}, onError="continueRegularOutput"),
  node("r14", "Finance (no AI)", "n8n-nodes-base.code", 2, [2640, 200], {"jsCode": rcode("6-finance.js")}),
  node("r15", "Shortlist", "n8n-nodes-base.code", 2, [2860, 200], {"jsCode": rcode("7-shortlist.js")}),
  node("r16", "AI notes (free)", "n8n-nodes-base.httpRequest", 4.2, [3080, 200], {
       "method": "POST", "url": "http://omniroute:20128/v1/chat/completions",
       "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
       "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.ai_body) }}",
       "options": {"timeout": 90000}}, onError="continueRegularOutput"),
  node("r17", "Report", "n8n-nodes-base.code", 2, [3300, 200], {"jsCode": rcode("8-report.js")}),
  node("r18", "Nothing-found report", "n8n-nodes-base.code", 2, [3300, 0], {"jsCode": rcode("9-empty.js")}),
  node("r20", "Send product photo", "n8n-nodes-base.telegram", 1.2, [3520, 300], {
       "operation": "sendPhoto", "chatId": OWNER_CHAT_ID, "binaryData": False, "file": "={{ $json.photo }}",
       "additionalFields": {"caption": "={{ $json.caption }}", "parse_mode": "HTML"}},
       onError="continueRegularOutput"),
  node("r22", "Summary", "n8n-nodes-base.code", 2, [3960, 300], {"jsCode": rcode("10-summary.js")}),
  node("r19", "Send report", "n8n-nodes-base.telegram", 1.2, [4180, 100], {
       "chatId": OWNER_CHAT_ID, "text": "={{ $json.report }}",
       "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"}}),
]
L = lambda a, b, out=0: (a, out, b)
links = [L("Every Monday 10:00", "Research plan"), L("Run now (manual)", "Research plan"),
         L("Research plan", "Need a new CJ token?"), L("Need a new CJ token?", "CJ get token", 0), L("Need a new CJ token?", "Searches", 1),
         L("CJ get token", "Save token"), L("Save token", "Searches"), L("Searches", "CJ product search"),
         L("CJ product search", "Screen products"), L("Screen products", "Nothing found?"),
         L("Nothing found?", "Nothing-found report", 0), L("Nothing found?", "CJ variants", 1),
         L("CJ variants", "Pick variant"), L("Pick variant", "CJ shipping to Canada"), L("CJ shipping to Canada", "Finance (no AI)"),
         L("Finance (no AI)", "Shortlist"), L("Shortlist", "AI notes (free)"), L("AI notes (free)", "Report"),
         L("Report", "Send product photo"), L("Send product photo", "Summary"), L("Summary", "Send report"), L("Nothing-found report", "Send report")]
rc = {}
for a, out, b in links:
    outs = rc.setdefault(a, {"main": []})["main"]
    while len(outs) <= out: outs.append([])
    outs[out].append({"node": b, "type": "main", "index": 0})
wfr = {"name": "JARVIS Research v1 (CJ products)", "nodes": rn, "connections": rc,
       "settings": {"executionOrder": "v1", "saveManualExecutions": True, "timezone": "America/Toronto"}, "pinData": {}}
(here.parent / "jarvis-research-v1.json").write_text(json.dumps(wfr, indent=2) + "\n")
print("wrote jarvis-research-v1.json")
