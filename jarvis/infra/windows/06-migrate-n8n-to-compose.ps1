# OPTIONAL STEP 6 (Path B) - Let Docker Compose manage n8n, using the SAME n8n_data volume.
#
# Why: if your n8n was started with "docker run --rm", it disappears whenever
# Docker restarts. Under Compose it restarts by itself and is always on the
# sandbox network. Your account, workflows and credentials stay where they
# are (in n8n_data); only the container around them is replaced.
#
# Safety rules built in:
#   * needs a verified backup made within the last 2 hours
#   * never runs an n8n version LOWER than the one you run now
#   * keeps your old container (renamed, stopped) for rollback when possible
#   * never starts two n8n containers on n8n_data at the same time
#   * asks you to type MIGRATE before changing anything
#
#   powershell -ExecutionPolicy Bypass -File .\infra\windows\06-migrate-n8n-to-compose.ps1

. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Docker
$envPath = Join-Path $StackDir '.env'
$n8nEnv  = Join-Path $StackDir 'n8n.env'
if (-not (Test-Path $envPath) -or -not (Test-Path $n8nEnv)) { throw 'Run 03-setup-sandbox.ps1 first.' }

Write-Step 'Pre-flight'
$b = Get-LatestBackup
if (-not $b -or $b.LastWriteTime -lt (Get-Date).AddHours(-2)) { throw 'Make a fresh backup first: .\infra\windows\02-backup.ps1' }
Write-Ok "Backup: $($b.Name)"

$old = Get-N8nContainerName
if (-not $old) { throw 'No n8n container found. Start your current n8n first so its version can be checked.' }
if ($old -eq 'jarvis-n8n') { Write-Ok 'n8n is already managed by Compose. Nothing to do.'; exit 0 }
if ((& docker inspect -f '{{.State.Running}}' $old) -ne 'true') { throw "Start $old first so its version can be read." }
$current = [version]((& docker exec $old n8n --version | Select-Object -Last 1).Trim())
Write-Ok "Current container: $old, n8n $current"

$target = Read-EnvValue $envPath 'N8N_VERSION'
if (-not $target -or $target -eq 'CHANGE-ME') { $target = $current.ToString(); Set-EnvValue $envPath 'N8N_VERSION' $target }
if ([version]$target -lt $current) { throw "N8N_VERSION=$target is lower than $current. Downgrades can corrupt the database. Fix infra\stack\.env." }
Write-Ok "Compose will run n8n $target"

$info = (& docker inspect $old | Out-String | ConvertFrom-Json)[0]
$autoRemove = [bool]$info.HostConfig.AutoRemove
$ignore = @('PATH', 'NODE_VERSION', 'YARN_VERSION', 'NODE_ICU_DATA', 'N8N_RELEASE_TYPE', 'N8N_VERSION', 'HOME', 'SHELL', 'NODE_ENV')
$custom = @($info.Config.Env | ForEach-Object { ($_ -split '=', 2)[0] } | Where-Object { $ignore -notcontains $_ })
if ($custom -contains 'N8N_ENCRYPTION_KEY' -and -not (Read-EnvValue $n8nEnv 'N8N_ENCRYPTION_KEY')) {
    throw 'Old container sets N8N_ENCRYPTION_KEY. Copy the same value into infra\stack\n8n.env first (see 01-inspect output).'
}
if ($custom.Count -gt 0) {
    Write-Warn2 "Your old container sets: $($custom -join ', ')"
    Write-Warn2 'Copy any you still need into infra\stack\n8n.env before continuing (values are in the jarvis-backups JSON).'
}

Write-Host "`nThis will: stop '$old', start 'jarvis-n8n' on http://localhost:5678 with the same data." -ForegroundColor Yellow
if ($autoRemove) { Write-Host "'$old' was started with --rm, so Docker deletes it on stop (data is safe in n8n_data)." -ForegroundColor Yellow }
if ((Read-Host 'Type MIGRATE to continue') -cne 'MIGRATE') { Write-Host 'Cancelled. Nothing changed.'; exit 0 }

Write-Step 'Stopping the old container'
$rollback = $null
Invoke-Native docker @('stop', $old) -Quiet | Out-Null
if (-not $autoRemove) {
    $rollback = "$old-pre-jarvis"
    Invoke-Native docker @('update', '--restart=no', $old) -Quiet | Out-Null
    Invoke-Native docker @('rename', $old, $rollback) -Quiet | Out-Null
    Write-Ok "Old container kept (stopped) as $rollback"
} else { Write-Ok 'Old container stopped (and removed by Docker because of --rm)' }

Write-Step 'Starting n8n under Compose'
try {
    Invoke-Compose @('--profile', 'n8n', 'up', '-d', 'n8n')
    $up = $false
    for ($i = 0; $i -lt 60; $i++) {
        try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 http://localhost:5678/healthz).StatusCode -eq 200) { $up = $true; break } } catch { }
        Start-Sleep -Seconds 3
    }
    if (-not $up) { throw 'jarvis-n8n did not answer on :5678 within 3 minutes' }
} catch {
    Write-Bad $_.Exception.Message
    Write-Bad 'Rolling back...'
    & docker compose -f (Join-Path $StackDir 'compose.yml') --profile n8n logs --tail 40 n8n
    & docker compose -f (Join-Path $StackDir 'compose.yml') --profile n8n stop n8n
    if ($rollback) { & docker rename $rollback $old; & docker start $old; Write-Ok "Restarted your original $old" }
    else { Write-Warn2 'Recreate your original container with the command you used before (see the JSON in jarvis-backups).' }
    exit 1
}
Write-Ok 'jarvis-n8n is up at http://localhost:5678 - log in with your existing owner account.'
Write-Host '  Check your workflows and credentials are all there. Then run 05-verify.ps1.'
if ($rollback) { Write-Host "  After a week without problems you can delete the old container: docker rm $rollback" }
