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
