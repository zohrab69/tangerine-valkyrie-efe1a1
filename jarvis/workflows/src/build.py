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
        for src in ("Parse, cost & log", "All AIs unavailable: ask owner"):
            c[src] = {"main": [[{"node": tail[2], "type": "main", "index": 0}]]}
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
  [node("t8", "Format reply", "n8n-nodes-base.code", 2, [1750, 400], {"jsCode": code("format-reply.js")}),
   node("t9", "Reply on Telegram", "n8n-nodes-base.telegram", 1.2, [1950, 400], {
        "chatId": "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        "text": "={{ $json.reply_text }}",
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"}})],
  {"Format reply": {"main": [[{"node": "Reply on Telegram", "type": "main", "index": 0}]]}},
  "Format reply")
chain_workflow("JARVIS Telegram v3", "jarvis-telegram-v3.json", "omniroute-router.js",
    ["free", "paid"], {"free": "OmniRoute free combo", "paid": "OmniRoute paid combo"},
    lambda p: HEADER,
    "## JARVIS Telegram v3 - talk to JARVIS from your phone\n"
    "Only messages from the owner's chat ID are answered; everyone else is ignored.\n"
    "Setup: select **JARVIS Telegram** in *Telegram Trigger* and *Reply on Telegram*, and **OmniRoute** in both *Call* nodes. Save, then switch the workflow to **Active** (Publish).\n"
    "Only one Telegram trigger per bot can be active at a time.",
    front=tg_front, tail=tg_tail)
