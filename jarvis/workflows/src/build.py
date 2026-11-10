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

def chain_workflow(wf_name, file_name, router_file, order, labels, auth, readme, front=None, tail=None, extra=None):
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
    if extra is not None:
        n += extra[0]
        for src, v in extra[1].items():          # merge outputs (do not overwrite existing links)
            outs = c.setdefault(src, {"main": []})["main"]
            for i, targets in enumerate(v["main"]):
                while len(outs) <= i: outs.append([])
                outs[i] += [t for t in targets if t not in outs[i]]
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
      "Credentials: **CJ API key** (Custom Auth) in *CJ get token*; **OmniRoute** in *AI notes*; **JARVIS Telegram** in *Send product photo*, *Send report* and *Send voice message*. The voice comes from the free Piper service on the server (no credential). Check each one after import: n8n may auto-pick the wrong credential.\n"
      "All money figures are estimates. Nothing is ordered or published. At the end JARVIS sends a short spoken summary (voice message)."}),
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
  node("r23", "What JARVIS says", "n8n-nodes-base.code", 2, [4400, 100], {"jsCode": rcode("11-voice-text.js")}),
  node("r24", "JARVIS voice (Piper, free)", "n8n-nodes-base.httpRequest", 4.2, [4620, 100], {
       "method": "POST", "url": "http://jarvis-tts:5000/speak",
       "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.tts_body) }}",
       "options": {"timeout": 60000, "response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}}}},
       onError="continueErrorOutput"),
  node("r25", "Send voice message", "n8n-nodes-base.telegram", 1.2, [4840, 0], {
       "operation": "sendAudio", "chatId": OWNER_CHAT_ID, "binaryData": True, "binaryPropertyName": "data",
       "additionalFields": {"fileName": "JARVIS.mp3", "title": "JARVIS", "performer": "JARVIS"}}, onError="continueRegularOutput"),
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
         L("Report", "Send product photo"), L("Send product photo", "Summary"), L("Summary", "Send report"), L("Nothing-found report", "Send report"),
         L("Send report", "What JARVIS says"), L("What JARVIS says", "JARVIS voice (Piper, free)"), L("JARVIS voice (Piper, free)", "Send voice message", 0)]
rc = {}
for a, out, b in links:
    outs = rc.setdefault(a, {"main": []})["main"]
    while len(outs) <= out: outs.append([])
    outs[out].append({"node": b, "type": "main", "index": 0})
wfr = {"name": "JARVIS Research v1 (CJ products)", "nodes": rn, "connections": rc,
       "settings": {"executionOrder": "v1", "saveManualExecutions": True, "timezone": "America/Toronto"}, "pinData": {}}
(here.parent / "jarvis-research-v1.json").write_text(json.dumps(wfr, indent=2) + "\n")
print("wrote jarvis-research-v1.json")


# Shared memory (n8n data table "jarvis_memory", columns: kind, summary)
MEMORY_TABLE = {"__rl": True, "mode": "name", "value": "jarvis_memory"}
def memory_nodes(prefix, src, pos):
    x, y = pos
    return [
      node(prefix + "m1", "Read memory", "n8n-nodes-base.dataTable", 1.1, [x, y], {
           "resource": "row", "operation": "get", "dataTableId": MEMORY_TABLE,
           "limit": 6, "orderBy": True, "orderByColumn": "createdAt", "orderByDirection": "DESC"},
           alwaysOutputData=True, onError="continueRegularOutput"),
      node(prefix + "m2", "Add memory", "n8n-nodes-base.code", 2, [x + 200, y], {"jsCode": code("memory-add.js").replace("__SRC__", src)}),
    ]
# ---------------------------------------------------------------------------
# Telegram v5 = v4 + "sample" action: reply to a product photo from the research report.
def scode(f): return (here / "sample" / f).read_text()
def lnk(c, a, b, out=0):
    outs = c.setdefault(a, {"main": []})["main"]
    while len(outs) <= out: outs.append([])
    outs[out].append({"node": b, "type": "main", "index": 0})
v5_front_nodes = [
  node("t1", "Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, [-400, 400],
       {"updates": ["message"], "additionalFields": {}}, webhookId="1fd950cf-288c-4312-a020-1d3c27a80a42"),
  node("t2", "Only the owner?", "n8n-nodes-base.if", 2.2, [-150, 400], {
       "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                      "conditions": [
                        {"id": "o1", "leftValue": "={{ String($json.message?.chat?.id ?? '') }}", "rightValue": OWNER_CHAT_ID,
                         "operator": {"type": "string", "operation": "equals"}},
                        {"id": "o2", "leftValue": "={{ ($json.message?.text ?? '') + ($json.message?.caption ?? '') }}", "rightValue": "",
                         "operator": {"type": "string", "operation": "notEmpty", "singleValue": True}}],
                      "combinator": "and"}, "options": {}}),
  ifnode("t4", "Sample request?", [100, 620],
         "={{ /CJ SKU\\s+\\S+/.test(($json.message?.reply_to_message?.caption ?? '') + ' ' + ($json.message?.caption ?? '')) || /^\\s*(sample|échantillon|echantillon)\\b/i.test($json.message?.text ?? '') }}"),
  tg_front[0][2],   # Owner request (Telegram)
]
v5_front_conns = {}
lnk(v5_front_conns, "Telegram Trigger", "Only the owner?")
lnk(v5_front_conns, "Only the owner?", "Sample request?")
lnk(v5_front_conns, "Sample request?", "Read the reply", 0)
lnk(v5_front_conns, "Sample request?", "Owner request (Telegram)", 1)
Y = 1500
sn = [
  node("s1", "Read the reply", "n8n-nodes-base.code", 2, [100, Y], {"jsCode": scode("1-read-reply.js")}),
  ifnode("s1b", "Know the product?", [210, Y + 160], "={{ !$json.problem }}"),
  ifnode("s2", "Need a CJ token?", [320, Y], "={{ $json.need_token === true }}"),
  node("s3", "CJ get token", "n8n-nodes-base.httpRequest", 4.2, [540, Y - 120], {
       "method": "POST", "url": CJ + "/authentication/getAccessToken",
       "authentication": "genericCredentialType", "genericAuthType": "httpCustomAuth",
       "sendBody": True, "specifyBody": "json", "jsonBody": "={}", "options": {"timeout": 30000}},
       onError="continueRegularOutput"),
  node("s4", "Save token", "n8n-nodes-base.code", 2, [760, Y - 120], {"jsCode": scode("2-save-token.js")}),
  node("s5", "With token", "n8n-nodes-base.code", 2, [980, Y], {"jsCode": "return $input.all();"}),
  node("s6", "CJ product details", "n8n-nodes-base.httpRequest", 4.2, [1200, Y], {
       "method": "GET", "url": CJ + "/product/query",
       "sendQuery": True, "queryParameters": {"parameters": [{"name": "productSku", "value": "={{ $json.sku }}"}]},
       "sendHeaders": True, "headerParameters": TOKEN_HDR, "options": {"timeout": 30000}}, onError="continueRegularOutput"),
  node("s7", "Pick variant", "n8n-nodes-base.code", 2, [1420, Y], {"jsCode": scode("3-pick.js")}),
  ifnode("s8", "Product OK?", [1640, Y], "={{ !$json.problem }}"),
  node("s9", "CJ shipping to Canada", "n8n-nodes-base.httpRequest", 4.2, [1860, Y - 120], {
       "method": "POST", "url": CJ + "/logistic/freightCalculate",
       "sendHeaders": True, "headerParameters": TOKEN_HDR,
       "sendBody": True, "specifyBody": "json",
       "jsonBody": "={{ JSON.stringify({ startCountryCode: 'CN', endCountryCode: 'CA', products: [{ quantity: $json.qty, vid: $json.vid }] }) }}",
       "options": {"timeout": 30000}}, onError="continueRegularOutput"),
  node("s10", "Sample plan", "n8n-nodes-base.code", 2, [2080, Y - 120], {"jsCode": scode("4-plan.js")}),
  ifnode("s11", "Plan OK?", [2300, Y - 120], "={{ !$json.problem }}"),
  node("s12", "Ask owner: approve sample?", "n8n-nodes-base.telegram", 1.2, [2520, Y - 240], {
       "operation": "sendAndWait", "chatId": OWNER_CHAT_ID, "message": "={{ $json.approval_text }}",
       "responseType": "approval",
       "approvalOptions": {"values": {"approvalType": "double", "approveLabel": "✅ Approve sample", "disapproveLabel": "❌ Decline"}},
       "options": {"limitWaitTime": {"values": {"limitType": "afterTimeInterval", "resumeAmount": 48, "resumeUnit": "hours"}},
                   "appendAttribution": False}}, webhookId="2d3a63f6-f92d-4ea0-8b56-25a162d21459"),
  node("s13", "Sample result", "n8n-nodes-base.code", 2, [2760, Y], {"jsCode": scode("5-after.js")}),
  node("s14", "Reply: sample", "n8n-nodes-base.telegram", 1.2, [2980, Y], {
       "chatId": OWNER_CHAT_ID, "text": "={{ $json.reply_text }}",
       "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"}}),
  node("s0", "Sample README", "n8n-nodes-base.stickyNote", 1, [80, Y - 420], {"width": 1100, "height": 180, "content":
       "## Sample order (reply to a product photo)\n"
       "Reply **sample** (optionally a quantity 1-3) to a product photo from the research report. JARVIS looks up the product and the real shipping cost to Canada on CJ, "
       "then asks you to approve. Approving does not buy anything: JARVIS then sends you the exact steps to order at CJ.\n"
       "Credentials: **CJ API key** in *CJ get token*; **JARVIS Telegram** in *Ask owner: approve sample?* and *Reply: sample*."}),
]
sc = {}
lnk(sc, "Read the reply", "Know the product?")
lnk(sc, "Know the product?", "Need a CJ token?", 0); lnk(sc, "Know the product?", "Sample result", 1)
lnk(sc, "Need a CJ token?", "CJ get token", 0); lnk(sc, "Need a CJ token?", "With token", 1)
lnk(sc, "CJ get token", "Save token"); lnk(sc, "Save token", "With token")
lnk(sc, "With token", "CJ product details"); lnk(sc, "CJ product details", "Pick variant")
lnk(sc, "Pick variant", "Product OK?")
lnk(sc, "Product OK?", "CJ shipping to Canada", 0); lnk(sc, "Product OK?", "Sample result", 1)
lnk(sc, "CJ shipping to Canada", "Sample plan"); lnk(sc, "Sample plan", "Plan OK?")
lnk(sc, "Plan OK?", "Ask owner: approve sample?", 0); lnk(sc, "Plan OK?", "Sample result", 1)
lnk(sc, "Ask owner: approve sample?", "Sample result"); lnk(sc, "Sample result", "Reply: sample")
sn += [
  node("s15", "Memory: sample", "n8n-nodes-base.code", 2, [2980, Y + 200], {"jsCode": code("memory-from-reply.js").replace("__KIND__", "sample")}),
  node("s16", "Save sample to memory", "n8n-nodes-base.dataTable", 1.1, [3200, Y + 200], {
       "resource": "row", "operation": "insert", "dataTableId": {"__rl": True, "mode": "name", "value": "jarvis_memory"},
       "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
       onError="continueRegularOutput"),
]
lnk(sc, "Sample result", "Memory: sample"); lnk(sc, "Memory: sample", "Save sample to memory")
v5_front_conns.pop("Owner request (Telegram)", None)
sn += [
  node("a15", "Memory: approval", "n8n-nodes-base.code", 2, [2650, -250], {"jsCode": code("memory-from-reply.js").replace("__KIND__", "approval")}),
  node("a16", "Save approval to memory", "n8n-nodes-base.dataTable", 1.1, [2870, -250], {
       "resource": "row", "operation": "insert", "dataTableId": {"__rl": True, "mode": "name", "value": "jarvis_memory"},
       "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
       onError="continueRegularOutput"),
]
lnk(sc, "Record decision", "Memory: approval"); lnk(sc, "Memory: approval", "Save approval to memory")
def mem_save(id_, name, pos):
    return node(id_, name, "n8n-nodes-base.dataTable", 1.1, pos, {
       "resource": "row", "operation": "insert", "dataTableId": {"__rl": True, "mode": "name", "value": "jarvis_memory"},
       "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
       onError="continueRegularOutput")
sn += [
  node("a17", "Memory: approval pending", "n8n-nodes-base.code", 2, [2150, -450], {"jsCode": code("memory-from-reply.js").replace("__KIND__", "approval_pending")}),
  mem_save("a18", "Save pending approval", [2370, -450]),
  node("s17", "Memory: sample pending", "n8n-nodes-base.code", 2, [2520, Y - 440], {"jsCode": code("memory-from-reply.js").replace("__KIND__", "sample_pending")}),
  mem_save("s18", "Save pending sample", [2740, Y - 440]),
]
lnk(sc, "Needs owner approval?", "Memory: approval pending", 0); lnk(sc, "Memory: approval pending", "Save pending approval")
lnk(sc, "Plan OK?", "Memory: sample pending", 0); lnk(sc, "Memory: sample pending", "Save pending sample")
v5_front_nodes += memory_nodes("v5", "Owner request (Telegram)", [200, 250])
lnk(v5_front_conns, "Owner request (Telegram)", "Read memory"); lnk(v5_front_conns, "Read memory", "Add memory")
chain_workflow("JARVIS Telegram v5 (approvals + samples)", "jarvis-telegram-v5.json", "omniroute-router.js",
    ["free", "paid"], {"free": "OmniRoute free combo", "paid": "OmniRoute paid combo"},
    lambda p: HEADER,
    "## JARVIS Telegram v5 - talk, approve, and request samples from your phone\n"
    "Normal messages: JARVIS turns them into work orders; risky ones need your Approve / Decline (48 h).\n"
    "**Reply \"sample\" to a product photo** from the research report: JARVIS prices a sample with real shipping to Canada and asks your approval (see the lower part).\n"
    "Setup: **JARVIS Telegram** in every Telegram node, **OmniRoute** in both *Call* nodes, **CJ API key** in *CJ get token*. Check each one after import. "
    "Unpublish v4 first (one Telegram trigger per bot), then Publish v5.",
    front=(v5_front_nodes, v5_front_conns, "Add memory"), tail=tg_tail, extra=(sn, sc))

# Voice v1 rebuilt with shared memory (overwrites the file written above)
voice_front_mem = (voice_front[0] + memory_nodes("vo", "Voice request", [200, 250]),
                   dict(voice_front[1]), "Add memory")
lnk(voice_front_mem[1], "Voice request", "Read memory"); lnk(voice_front_mem[1], "Read memory", "Add memory")
chain_workflow("JARVIS Voice v1 (screen)", "jarvis-voice-v1.json", "omniroute-router.js",
    ["free", "paid"], {"free": "OmniRoute free combo", "paid": "OmniRoute paid combo"},
    lambda p: HEADER,
    "## JARVIS Voice v1 - the JARVIS screen\n"
    "The page at https://jarvis.<server>.sslip.io (password protected) sends your words here. JARVIS answers the screen at once; approvals go to your Telegram with buttons.\n"
    "JARVIS reads its recent activity from the data table **jarvis_memory** (columns kind, summary) before answering.\n"
    "Setup: *Webhook* -> Header Auth credential **JARVIS screen key**. **OmniRoute** in both *Call* nodes. **JARVIS Telegram** in *Ask owner to approve* and *Reply on Telegram*. Save, then Publish.",
    front=voice_front_mem, tail=voice_tail)

# Research: save a memory row after the report
wfr_path = here.parent / "jarvis-research-v1.json"
wfr = json.loads(wfr_path.read_text())
wfr["nodes"] += [
  node("r26", "Memory text", "n8n-nodes-base.code", 2, [4180, 320], {"jsCode": rcode("12-memory.js")}),
  node("r27", "Save to memory", "n8n-nodes-base.dataTable", 1.1, [4400, 320], {
       "resource": "row", "operation": "insert", "dataTableId": MEMORY_TABLE,
       "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
       onError="continueRegularOutput"),
]
lnk(wfr["connections"], "Summary", "Memory text"); lnk(wfr["connections"], "Nothing-found report", "Memory text")
lnk(wfr["connections"], "Memory text", "Save to memory")
for n in wfr["nodes"]:
    if n["type"].endswith("stickyNote") and "Research v1" in n["parameters"]["content"]:
        n["parameters"]["content"] += "\nAfter the report it writes a summary to the data table **jarvis_memory** so the JARVIS screen and Telegram know what was sent."
wfr_path.write_text(json.dumps(wfr, indent=2) + "\n")
print("wrote jarvis-voice-v1.json + research memory")

# ---------------------------------------------------------------------------
# Events v1: the screen polls /api/events (Caddy adds the screen key) for live notifications.
ev = [
  node("e0", "README", "n8n-nodes-base.stickyNote", 1, [-40, -220], {"width": 900, "height": 160, "content":
       "## JARVIS Events v1 - live notifications for the JARVIS screen\n"
       "The screen asks every ~20 s what JARVIS did recently (data table **jarvis_memory**) and announces new items: reports sent, samples, approvals waiting.\n"
       "Setup: *Webhook* -> Header Auth credential **JARVIS screen key**. Save, then Publish."}),
  node("e1", "Webhook (screen events)", "n8n-nodes-base.webhook", 2, [0, 0],
       {"httpMethod": "GET", "path": "jarvis-events", "authentication": "headerAuth", "responseMode": "responseNode", "options": {}},
       webhookId="703d7b1d-c46d-4fdd-b847-cc958501301e"),
  node("e2", "Read memory", "n8n-nodes-base.dataTable", 1.1, [220, 0], {
       "resource": "row", "operation": "get", "dataTableId": {"__rl": True, "mode": "name", "value": "jarvis_memory"},
       "limit": 8, "orderBy": True, "orderByColumn": "createdAt", "orderByDirection": "DESC"},
       alwaysOutputData=True, onError="continueRegularOutput"),
  node("e3", "Format events", "n8n-nodes-base.code", 2, [440, 0], {"jsCode": code("events.js")}),
  node("e4", "Answer the screen", "n8n-nodes-base.respondToWebhook", 1.1, [660, 0],
       {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}", "options": {}}),
]
ec = {}
lnk(ec, "Webhook (screen events)", "Read memory"); lnk(ec, "Read memory", "Format events"); lnk(ec, "Format events", "Answer the screen")
(here.parent / "jarvis-events-v1.json").write_text(json.dumps({"name": "JARVIS Events v1 (screen notifications)", "nodes": ev, "connections": ec,
  "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "none", "saveManualExecutions": True}, "pinData": {}}, indent=2) + "\n")
print("wrote jarvis-events-v1.json")

# ---------------------------------------------------------------------------
# Alerts v1: error alerts (n8n Error Trigger) + daily health check + Monday report check.
def acode(f): return (here / "alerts" / f).read_text()
def send_alert(id_, name, pos):
    return node(id_, name, "n8n-nodes-base.telegram", 1.2, pos, {
        "chatId": OWNER_CHAT_ID, "text": "={{ $json.text }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML", "disable_web_page_preview": True}},
        onError="continueRegularOutput")
al = [
  node("x0", "README", "n8n-nodes-base.stickyNote", 1, [-60, -300], {"width": 1300, "height": 210, "content":
      "## JARVIS Alerts v1 - tells you on Telegram when something breaks\n"
      "**Top:** any JARVIS workflow that fails sends its error here (each workflow: *Settings -> Error workflow -> JARVIS Alerts v1*). Same problem repeated within 60 min = one alert.\n"
      "**Bottom:** every day 9:07 and Monday 10:40 (Toronto): checks the free AI, the voice service and that the Monday report went out. Silent when all is fine.\n"
      "Credentials: **JARVIS Telegram** in both *Send* nodes, **OmniRoute** in *Check AI*. Save, then Publish. Alerts also go to the memory, so the JARVIS screen announces them."}),
  node("x1", "When a workflow fails", "n8n-nodes-base.errorTrigger", 1, [0, 0], {}),
  node("x2", "Format error alert", "n8n-nodes-base.code", 2, [220, 0], {"jsCode": acode("1-format-error.js")}),
  ifnode("x3", "New problem?", [440, 0], "={{ $json.send === true }}"),
  send_alert("x4", "Send error alert", [680, -80]),
  node("x5", "Error memory row", "n8n-nodes-base.code", 2, [680, 100], {"jsCode": acode("3-memory-row.js")}),
  node("x6", "Save error to memory", "n8n-nodes-base.dataTable", 1.1, [900, 100], {
       "resource": "row", "operation": "insert", "dataTableId": MEMORY_TABLE,
       "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
       onError="continueRegularOutput"),
  node("h1", "Every day 9:07 + Monday 10:40", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 400], {"rule": {"interval": [
       {"field": "cronExpression", "expression": "7 9 * * *"}, {"field": "cronExpression", "expression": "40 10 * * 1"}]}}),
  node("h0", "Run health check now", "n8n-nodes-base.manualTrigger", 1, [0, 580], {}),
  node("h2", "Check AI (free combo)", "n8n-nodes-base.httpRequest", 4.2, [240, 480], {
       "method": "POST", "url": "http://omniroute:20128/v1/chat/completions",
       "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
       "sendBody": True, "specifyBody": "json",
       "jsonBody": "={{ JSON.stringify({ model: 'jarvis-free', max_tokens: 60, messages: [{ role: 'user', content: 'Reply with OK' }] }) }}",
       "options": {"timeout": 60000}}, onError="continueRegularOutput", alwaysOutputData=True),
  node("h3", "Check voice service", "n8n-nodes-base.httpRequest", 4.2, [460, 480], {
       "method": "GET", "url": "http://jarvis-tts:5000/health", "options": {"timeout": 15000}},
       onError="continueRegularOutput", alwaysOutputData=True),
  node("h4", "Read memory", "n8n-nodes-base.dataTable", 1.1, [680, 480], {
       "resource": "row", "operation": "get", "dataTableId": MEMORY_TABLE,
       "limit": 20, "orderBy": True, "orderByColumn": "createdAt", "orderByDirection": "DESC"},
       alwaysOutputData=True, onError="continueRegularOutput"),
  node("h5", "Evaluate", "n8n-nodes-base.code", 2, [900, 480], {"jsCode": acode("2-health.js"), "mode": "runOnceForAllItems"}),
  ifnode("h6", "Any problem?", [1120, 480], "={{ $json.send === true }}"),
  send_alert("h7", "Send health alert", [1340, 400]),
  node("h8", "Health memory row", "n8n-nodes-base.code", 2, [1340, 580], {"jsCode": acode("3-memory-row.js")}),
  node("h9", "Save health to memory", "n8n-nodes-base.dataTable", 1.1, [1560, 580], {
       "resource": "row", "operation": "insert", "dataTableId": MEMORY_TABLE,
       "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
       onError="continueRegularOutput"),
]
ac = {}
lnk(ac, "When a workflow fails", "Format error alert"); lnk(ac, "Format error alert", "New problem?")
lnk(ac, "New problem?", "Send error alert", 0); lnk(ac, "New problem?", "Error memory row", 0)
lnk(ac, "Error memory row", "Save error to memory")
for t in ("Every day 9:07 + Monday 10:40", "Run health check now"): lnk(ac, t, "Check AI (free combo)")
lnk(ac, "Check AI (free combo)", "Check voice service"); lnk(ac, "Check voice service", "Read memory"); lnk(ac, "Read memory", "Evaluate")
lnk(ac, "Evaluate", "Any problem?"); lnk(ac, "Any problem?", "Send health alert", 0); lnk(ac, "Any problem?", "Health memory row", 0)
lnk(ac, "Health memory row", "Save health to memory")
(here.parent / "jarvis-alerts-v1.json").write_text(json.dumps({"name": "JARVIS Alerts v1 (errors + health)", "nodes": al, "connections": ac,
  "settings": {"executionOrder": "v1", "saveManualExecutions": True, "timezone": "America/Toronto"}, "pinData": {}}, indent=2) + "\n")
print("wrote jarvis-alerts-v1.json")

# ---------------------------------------------------------------------------
# Briefing v1: daily 8:00 morning briefing on Telegram (text + voice), from memory facts only.
def bcode(f): return (here / "briefing" / f).read_text()
bn = [
  node("b0", "README", "n8n-nodes-base.stickyNote", 1, [-60, -260], {"width": 1250, "height": 190, "content":
      "## JARVIS Briefing v1 - every morning at 6:00 (Toronto) on Telegram\n"
      "Reads JARVIS memory (reports, approvals waiting, decisions, problems), the free AI phrases it (facts only), then sends a short text and a voice message. "
      "To change the time: open *Every day 6:00* and edit the hour.\n"
      "Credentials: **OmniRoute** in *AI wording*; **JARVIS Telegram** in *Send briefing* and *Send voice*. Save, then Publish. Settings -> Error workflow -> JARVIS Alerts v1."}),
  node("b1", "Every day 6:00", "n8n-nodes-base.scheduleTrigger", 1.2, [0, 0], {"rule": {"interval": [{"field": "cronExpression", "expression": "0 6 * * *"}]}}),
  node("b2", "Send briefing now", "n8n-nodes-base.manualTrigger", 1, [0, 180], {}),
  node("b3", "Read memory", "n8n-nodes-base.dataTable", 1.1, [220, 90], {
       "resource": "row", "operation": "get", "dataTableId": MEMORY_TABLE,
       "limit": 30, "orderBy": True, "orderByColumn": "createdAt", "orderByDirection": "DESC"},
       alwaysOutputData=True, onError="continueRegularOutput"),
  node("b4", "Briefing facts", "n8n-nodes-base.code", 2, [440, 90], {"jsCode": bcode("1-facts.js")}),
  node("b5", "AI wording (free)", "n8n-nodes-base.httpRequest", 4.2, [660, 90], {
       "method": "POST", "url": "http://omniroute:20128/v1/chat/completions",
       "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
       "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.ai_body) }}",
       "options": {"timeout": 90000}}, onError="continueRegularOutput", alwaysOutputData=True),
  node("b6", "Briefing text", "n8n-nodes-base.code", 2, [880, 90], {"jsCode": bcode("2-text.js")}),
  node("b7", "Send briefing", "n8n-nodes-base.telegram", 1.2, [1100, 0], {
       "chatId": OWNER_CHAT_ID, "text": "={{ $json.text }}", "additionalFields": {"appendAttribution": False}}),
  node("b8", "JARVIS voice", "n8n-nodes-base.httpRequest", 4.2, [1320, 0], {
       "method": "POST", "url": "http://jarvis-tts:5000/speak", "sendBody": True, "specifyBody": "json",
       "jsonBody": "={{ JSON.stringify($('Briefing text').first().json.tts_body) }}",
       "options": {"timeout": 90000, "response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}}}},
       onError="continueErrorOutput"),
  node("b9", "Send voice", "n8n-nodes-base.telegram", 1.2, [1540, -60], {
       "operation": "sendAudio", "chatId": OWNER_CHAT_ID, "binaryData": True, "binaryPropertyName": "data",
       "additionalFields": {"fileName": "JARVIS-briefing.mp3", "title": "Morning briefing", "performer": "JARVIS"}}, onError="continueRegularOutput"),
  node("b10", "Memory row", "n8n-nodes-base.code", 2, [1100, 200], {"jsCode": "const j = $input.first().json;\nreturn [{ json: { kind: j.kind, summary: j.summary } }];"}),
  node("b11", "Save to memory", "n8n-nodes-base.dataTable", 1.1, [1320, 200], {
       "resource": "row", "operation": "insert", "dataTableId": MEMORY_TABLE,
       "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
       onError="continueRegularOutput"),
]
bc = {}
for t in ("Every day 6:00", "Send briefing now"): lnk(bc, t, "Read memory")
lnk(bc, "Read memory", "Briefing facts"); lnk(bc, "Briefing facts", "AI wording (free)"); lnk(bc, "AI wording (free)", "Briefing text")
lnk(bc, "Briefing text", "Send briefing"); lnk(bc, "Briefing text", "Memory row"); lnk(bc, "Memory row", "Save to memory")
lnk(bc, "Send briefing", "JARVIS voice"); lnk(bc, "JARVIS voice", "Send voice", 0)
(here.parent / "jarvis-briefing-v1.json").write_text(json.dumps({"name": "JARVIS Briefing v1 (morning)", "nodes": bn, "connections": bc,
  "settings": {"executionOrder": "v1", "saveManualExecutions": True, "timezone": "America/Toronto"}, "pinData": {}}, indent=2) + "\n")
print("wrote jarvis-briefing-v1.json")
