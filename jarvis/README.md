# JARVIS: AI-operated business system

You are the owner. JARVIS (the AI CEO) runs on **n8n** on your Windows laptop.
Department managers and specialist agents work under it. This folder holds the
setup scripts, configuration and workflows. It continues from your existing n8n
install and does not start over.

| Document | What's in it |
|---|---|
| **This file** | Status and the exact next steps (Phase 1) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Org chart, how agents talk, model routing, approvals, data, security |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases 1-10 with done/next checklists |
| [docs/REALITY-CHECK.md](docs/REALITY-CHECK.md) | What can and cannot be automated, platform rules, Canadian/Quebec law, real costs |

---

## Status

**Done, as you reported it (not re-verified):**
- Docker Desktop 4.97.0, WSL, Compose v5.6.1, n8n running at http://localhost:5678
- Data in the Docker volume `n8n_data`, owner account created
- OpenAI API key created, US$10 credit (OpenAI bills in **USD**), auto-recharge off

**Built in this repository, not yet run on your laptop:**
- Scripts `infra/windows/01`…`06`: inspect, verified backup + restore test, sandbox, connect, verify, optional migration
- `infra/stack/compose.yml`: the n8n sandbox stack, adapted from n8n's official compose file
- `config/*.json`: model routing tiers, budget caps, approval rules
- `workflows/jarvis-ceo-v0.json`: the first JARVIS agent (dispatcher), with routing and a budget guard. The logic was tested offline; the workflow has not run against OpenAI yet.

**Not verified yet:** your earlier backup command. If it worked, there is an
`n8n-backup.tar.gz` in the folder PowerShell was open in (usually
`C:\Users\<you>`). Leave it there. Step 2 below makes a new backup and proves it can be restored.

---

## Phase 1: exact steps

Do the steps in order and stop at the first `[FAIL]`. Send me the text of the output, never keys.
Each script checks its own preconditions. Nothing touches `n8n_data` except
reading it, and nothing starts a second n8n.

### 0. Get these files onto your laptop (PowerShell)

```powershell
winget install --id Git.Git -e            # skip if "git --version" already works; reopen PowerShell after
cd $HOME
git clone -b claude/jarvis-multi-agent-business-zx06y9 https://github.com/zohrab69/tangerine-valkyrie-efe1a1.git jarvis-repo
cd $HOME\jarvis-repo\jarvis
```
Later, to get updates: `cd $HOME\jarvis-repo; git pull`.

### 1. Inspect (read-only)

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\windows\01-inspect.ps1
```
This finds your n8n container and its version. It shows whether the container was started
with `--rm` (if so, it vanishes when Docker restarts), saves the container
definition to `%USERPROFILE%\jarvis-backups\`, and checks memory.

### 2. Back up and prove the restore works

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\windows\02-backup.ps1
```
The script pauses n8n for a few seconds so the database is copied consistently, then writes
`jarvis-backups\n8n_data-<date>.tar.gz`. It then restores that file into a **throwaway** volume, runs
SQLite `integrity_check`, prints how many workflows, credentials and users it holds, and deletes the
throwaway volume. Copy the `.tar.gz` to a USB drive or cloud folder as well.

### 3. Start the sandbox next to n8n

Close browser tabs first. The sandbox needs about 1-2 GB of RAM when active.
```powershell
powershell -ExecutionPolicy Bypass -File .\infra\windows\03-setup-sandbox.ps1
```
The script generates unique secrets into `infra\stack\*.env`. Git ignores these files and they stay on your laptop.
It then starts `sandbox-api` and `sandbox-runner-1` on a private network `jarvis-net`
and publishes **no** ports. The first run downloads about 1 GB. Add `-WithSearch` if you
also want SearXNG web search for the Assistant.

### 4. Connect your existing n8n (Path A: no restart)

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\windows\04-connect-n8n.ps1
```
The script attaches your running n8n to `jarvis-net`, checks `http://sandbox-api:8080/healthz`
from inside n8n, and copies the sandbox API key to your clipboard. Then fill in the screen you stopped at in n8n
(**Settings > Agents > Shared sandbox**, or the Assistant setup):
- **Service URL:** `http://sandbox-api:8080`
- **API key:** Ctrl+V

### 5. Test the AI connection and the first JARVIS agent

1. In n8n, go to **Credentials > Add credential > OpenAI** and paste your API key **there** (never in chat). Click **Test**.
2. Go to **Workflows > Import from file** and choose `workflows\jarvis-ceo-v0.json`.
3. Open the node **Call OpenAI (Responses API)** and select that credential.
4. Click **Execute workflow**. The node **Parse, cost & log** should show a JSON work order (department,
   steps, needs_owner_approval) and a `cost_cad` of a fraction of a cent.
5. In n8n Assistant, ask: *"Run a code snippet that prints 2+2"* to show the sandbox runs code.

### 6. Verify everything

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\windows\05-verify.ps1
```

### 7. Protect your $10 (5 minutes, in the browser)

- platform.openai.com > **Settings > Limits**: set a monthly budget (for example US$10) and email alerts.
- Create a separate **Project** "jarvis" with its own key, so JARVIS spending is separate and the key can be revoked alone.
- **n8n Assistant uses your OpenAI key too.** Building with it costs tokens. Pick a mid-tier model for
  the Assistant, not the most expensive one, and keep an eye on usage for the first week.

### Optional, recommended if step 1 said `--rm`: Path B

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\windows\06-migrate-n8n-to-compose.ps1
```
Compose then manages n8n, so it restarts by itself and stays on the sandbox network.
It uses the **same** `n8n_data` volume, refuses version downgrades, needs a backup from
the last 2 hours, asks you to type `MIGRATE`, and rolls back automatically if
the new container does not answer. Do this **before** applying
`infra\windows\wslconfig.example`, because applying it needs `wsl --shutdown`.

### Everyday commands (from `jarvis\infra\stack`)

| To do this | Run |
|---|---|
| Free RAM when not building with the Assistant | `docker compose stop` |
| Start the sandbox again | `docker compose up -d` (then `04-connect-n8n.ps1` if you're on Path A and n8n was recreated) |
| See status | `docker compose ps` |
| Weekly backup | `..\windows\02-backup.ps1` |

Your JARVIS workflows do **not** need the sandbox to run. Only n8n Assistant (AI-assisted
building) needs it, so you can stop it most of the time.

## Sources for the sandbox setup

- n8n docs: *Set up n8n Assistant* (setup 2: self-host the sandbox) and *Install using Docker Compose*, from the `n8n-io/n8n-docs` repository
- n8n's official stack file `docker/get-n8n-compose.yml` and installer `docker/get-n8n.sh` (sandbox version pin 1.8.1 and env variable names), from `n8n-io/n8n`
- n8n recommends **Daytona** instead of the bundled sandbox for production. Revisit this in Phase 9 (cloud).
