# STEP 5 - Health check of the whole local JARVIS stack. Read-only. Run any time.
#
#   powershell -ExecutionPolicy Bypass -File .\infra\windows\05-verify.ps1

. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Docker
$fail = 0

Write-Step 'n8n'
try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 http://localhost:5678/healthz
    Write-Ok "http://localhost:5678/healthz -> $($r.StatusCode) $($r.Content)"
} catch { Write-Bad "n8n not reachable on localhost:5678 ($($_.Exception.Message))"; $fail++ }

$names = @(& docker ps -a --filter 'volume=n8n_data' --format '{{.Names}} ({{.Status}})')
if ($names.Count -eq 1) { Write-Ok "Exactly one container uses n8n_data: $($names[0])" }
else { Write-Bad "Containers using n8n_data: $($names -join '; ') (there must be exactly one)"; $fail++ }

Write-Step 'Sandbox'
foreach ($c in @('jarvis-sandbox-api-1', 'jarvis-sandbox-runner-1')) {
    $s = & docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' $c
    if ($LASTEXITCODE -eq 0 -and $s -match '^running') { Write-Ok "$c $s" } else { Write-Bad "$c not running"; $fail++ }
}
$n8n = Get-N8nContainerName
if ($n8n) {
    $ErrorActionPreference = 'Continue'
    $h = & docker exec $n8n wget -qO- http://sandbox-api:8080/healthz 2>&1 | Out-String
    $ErrorActionPreference = 'Stop'
    if ($h -match '"ok"') { Write-Ok "n8n can reach the sandbox: $($h.Trim())" } else { Write-Bad 'n8n cannot reach sandbox-api (run 04-connect-n8n.ps1)'; $fail++ }
}

Write-Step 'Published ports (only 5678 should appear)'
& docker ps --format '{{.Names}}: {{.Ports}}' | Where-Object { $_ -match '->' } | ForEach-Object {
    if ($_ -match '5678') { Write-Ok $_ } else { Write-Warn2 "Unexpected published port: $_" }
}

Write-Step 'Backup age'
$b = Get-LatestBackup
if ($b) {
    $age = [math]::Round(((Get-Date) - $b.LastWriteTime).TotalDays, 1)
    if ($age -le 7) { Write-Ok "Latest backup $($b.Name) ($age days old)" } else { Write-Warn2 "Latest backup is $age days old. Run 02-backup.ps1." }
} else { Write-Bad 'No backup found'; $fail++ }

Write-Step 'Memory'
& docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'

Write-Step 'Manual checks in the n8n UI (this script cannot do these)'
Write-Host '  [ ] n8n Assistant answers and can run code (sandbox)'
Write-Host '  [ ] Credentials > OpenAI: "Test" succeeds'
Write-Host '  [ ] Workflow "JARVIS CEO v0" executes and logs a cost estimate'

if ($fail -eq 0) { Write-Host "`nAll automatic checks passed." -ForegroundColor Green } else { Write-Host "`n$fail check(s) failed." -ForegroundColor Red; exit 1 }
