# STEP 7 - Start OmniRoute, the multi-AI gateway JARVIS uses so it does not run out of credit.
#
# * Generates secrets into infra\stack\omniroute.env (only if missing).
# * Stops the n8n Assistant sandbox to free RAM (8 GB laptop: both together is too much).
#   Start it again later with: docker compose up -d   (from infra\stack)
# * Starts OmniRoute + its small Redis, reachable only from this computer:
#     dashboard  http://localhost:20128      from n8n  http://omniroute:20128/v1
# * Connects your n8n container to jarvis-net and tests the connection.
#
# Does NOT touch n8n_data or restart n8n.
#   powershell -ExecutionPolicy Bypass -File .\infra\windows\07-setup-omniroute.ps1
#   (add -KeepSandbox to leave the sandbox running if you have enough free RAM)
#   (add -MinFreeGb 1.0 to start with less free RAM, accepting a slower laptop)

param([switch]$KeepSandbox, [double]$MinFreeGb = 1.5)

. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Docker

Write-Step 'Secrets'
$orEnv = Join-Path $StackDir 'omniroute.env'
if (-not (Test-Path $orEnv)) { Copy-Item (Join-Path $StackDir 'omniroute.env.example') $orEnv }
$made = 0
foreach ($k in 'JWT_SECRET', 'API_KEY_SECRET', 'STORAGE_ENCRYPTION_KEY') {
    $v = Read-EnvValue $orEnv $k
    if (-not $v -or $v -eq 'generated') { Set-EnvValue $orEnv $k (New-Secret); $made++ }
}
if ($made -gt 0) { Write-Ok "Generated $made secret(s) in omniroute.env (back up infra\stack with your backups: without STORAGE_ENCRYPTION_KEY saved provider keys cannot be read)" }
else { Write-Ok 'omniroute.env already has its secrets - keeping them' }
# Compose needs these files to exist even for services that are not started.
$envPath = Join-Path $StackDir '.env'
if (-not (Test-Path $envPath)) { Copy-Item (Join-Path $StackDir '.env.example') $envPath }
$sx = Read-EnvValue $envPath 'SEARXNG_SECRET'
if (-not $sx -or $sx -eq 'generated-by-setup-script') { Set-EnvValue $envPath 'SEARXNG_SECRET' (New-Secret) }
foreach ($f in 'sandbox-api.env', 'sandbox-runner.env', 'n8n.env') {
    $p = Join-Path $StackDir $f
    if (-not (Test-Path $p)) { Write-EnvFile $p @('# placeholder; 03-setup-sandbox.ps1 fills this in') }
}

Write-Step 'Memory'
if (-not $KeepSandbox) {
    $running = & docker ps --filter 'name=jarvis-sandbox' --format '{{.Names}}'
    if ($running) { Invoke-Compose @('stop', 'sandbox-runner-1', 'sandbox-api'); Write-Ok 'Sandbox stopped to free RAM' }
    else { Write-Ok 'Sandbox not running' }
}
$os = Get-CimInstance Win32_OperatingSystem
$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
Write-Ok "Free Windows RAM: $freeGb GB"
if ($freeGb -lt $MinFreeGb) { throw "Less than $MinFreeGb GB free. Close browser tabs/apps and run again (or accept a slower laptop with: -MinFreeGb 1.0)." }
if ($freeGb -lt 1.5) { Write-Warn2 'Low memory: the laptop may be slow while OmniRoute runs. Windows will use the page file; your data is not at risk.' }

Write-Step 'Starting OmniRoute (first time downloads ~250-550 MB)'
Invoke-Compose @('--profile', 'omniroute', 'up', '-d', 'omniroute-redis', 'omniroute')

Write-Step 'Waiting for OmniRoute to be ready (can take a few minutes the first time)'
$ok = $false
for ($i = 0; $i -lt 100; $i++) {
    try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 http://127.0.0.1:20128/healthz).StatusCode -eq 200) { $ok = $true; break } } catch { }
    Start-Sleep -Seconds 3
}
if (-not $ok) { Write-Bad 'OmniRoute did not answer within 5 minutes. Last log lines:'; & docker logs --tail 40 omniroute; exit 1 }
Write-Ok 'OmniRoute is up: http://localhost:20128'

Write-Step 'Connecting n8n'
$n8n = Get-N8nContainerName
if ($n8n) {
    $nets = & docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' $n8n
    if ($nets -notmatch '\bjarvis-net\b') { Invoke-Native docker @('network', 'connect', 'jarvis-net', $n8n) -Quiet | Out-Null }
    $ErrorActionPreference = 'Continue'
    $h = & docker exec $n8n wget -qO- http://omniroute:20128/healthz 2>&1 | Out-String
    $ErrorActionPreference = 'Stop'
    if ($h -match 'ok') { Write-Ok "n8n can reach OmniRoute at http://omniroute:20128/v1" }
    else { Write-Warn2 "n8n could not reach OmniRoute yet: $h" }
} else { Write-Warn2 'n8n container not found; start n8n and run this script again.' }

Write-Step 'Your turn, in the browser (exact steps in jarvis\README.md, step 8)'
Write-Host '  1. Open http://localhost:20128 and create the dashboard password.'
Write-Host '     If it asks for a bootstrap token, run:  docker logs omniroute 2>&1 | findstr BOOTSTRAP'
Write-Host '  2. Providers: add ONLY official API keys (Gemini, Groq, OpenRouter, OpenAI).'
Write-Host '     Do NOT use logins for Claude Code, Codex, Copilot, Cursor, Kiro, Antigravity or "web" providers.' -ForegroundColor Yellow
Write-Host '  3. Create an OmniRoute API key for n8n, and paste it only into n8n (Header Auth credential).'
& docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}'
