# STEP 4 (Path A) - Let your EXISTING n8n reach the sandbox. No restart, no recreate.
#
# Attaches the running n8n container to the "jarvis-net" network (an extra
# network; its current network and port 5678 stay as they are), tests the
# connection from inside n8n, then copies the sandbox API key to your
# clipboard so you can paste it into the n8n screen that asks for it.
#
# Run from the jarvis folder:
#   powershell -ExecutionPolicy Bypass -File .\infra\windows\04-connect-n8n.ps1

. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Docker

$name = Get-N8nContainerName
if (-not $name) { throw 'No n8n container found using n8n_data. Start n8n first.' }
if ((& docker inspect -f '{{.State.Running}}' $name) -ne 'true') { throw "$name is not running. Start it first." }

Write-Step "Connecting $name to jarvis-net"
$nets = & docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' $name
if ($nets -match '\bjarvis-net\b') { Write-Ok 'Already connected' }
else { Invoke-Native docker @('network', 'connect', 'jarvis-net', $name) -Quiet | Out-Null; Write-Ok 'Connected (no restart needed)' }

Write-Step 'Testing sandbox from inside n8n'
$ErrorActionPreference = 'Continue'
$health = & docker exec $name wget -qO- http://sandbox-api:8080/healthz 2>&1 | Out-String
$ErrorActionPreference = 'Stop'
if ($health -match '"status"\s*:\s*"ok"') { Write-Ok "n8n -> sandbox-api: $($health.Trim())" }
else { Write-Bad "Unexpected answer: $health"; Write-Bad 'Is the sandbox running? Run: docker compose -f infra\stack\compose.yml ps'; exit 1 }

$key = Read-EnvValue (Join-Path $StackDir 'sandbox-api.env') 'SANDBOX_API_KEYS'
if (-not $key) { throw 'sandbox-api.env missing. Run 03-setup-sandbox.ps1 first.' }
Set-Clipboard -Value $key

Write-Step 'Now in the n8n browser tab (http://localhost:5678)'
Write-Host '  Settings > Agents > Shared sandbox (or the Assistant setup screen that asked for it):'
Write-Host '    Provider     : n8n sandbox (self-hosted)'
Write-Host '    Service URL  : http://sandbox-api:8080' -ForegroundColor Green
Write-Host '    API key      : press Ctrl+V  (already copied to your clipboard)' -ForegroundColor Green
Write-Host '  Save, then open n8n Assistant and ask: "Run a code snippet that prints 2+2".'
Write-Host '  Never paste this key into a chat. It is stored in infra\stack\sandbox-api.env.'

if ((& docker inspect -f '{{.HostConfig.AutoRemove}}' $name) -eq 'true') {
    Write-Warn2 "$name was started with --rm: after a Docker restart you must re-run this script (or do Path B)."
}
Write-Host "`nNext: .\infra\windows\05-verify.ps1" -ForegroundColor Cyan
