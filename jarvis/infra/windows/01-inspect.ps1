# STEP 1 - Read-only inspection. Changes nothing.
#
# Finds your existing n8n container, records exactly how it was started (so it
# can always be recreated), and checks memory before we add the sandbox.
#
# Run from the jarvis folder:
#   powershell -ExecutionPolicy Bypass -File .\infra\windows\01-inspect.ps1

. (Join-Path $PSScriptRoot '_common.ps1')

Assert-Docker
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

Write-Step 'Docker'
Write-Ok ("Docker Engine " + (& docker version --format '{{.Server.Version}}'))
Write-Ok ((& docker compose version) -join ' ')
$memBytes = [int64](& docker info --format '{{.MemTotal}}')
$memGb = [math]::Round($memBytes / 1GB, 1)
$cpus = & docker info --format '{{.NCPU}}'
Write-Ok "Docker/WSL can use $memGb GB RAM and $cpus CPUs"
if ($memGb -lt 3.5) { Write-Warn2 'Less than 4 GB for Docker. The sandbox needs about 4 GB in total. See infra/windows/wslconfig.example.' }

Write-Step 'Volume n8n_data'
& docker volume inspect n8n_data --format '{{.Name}} (driver {{.Driver}}, created {{.CreatedAt}})'
if ($LASTEXITCODE -ne 0) { throw 'Volume n8n_data not found. STOP: do not continue. Run "docker volume ls" and report the names you see.' }

Write-Step 'Existing n8n container'
$name = Get-N8nContainerName
if (-not $name) {
    Write-Warn2 'No container is using n8n_data right now (it may have been started with --rm and then stopped).'
    Write-Warn2 'Your data is still safe in the volume. Start n8n the way you normally do, then run this script again.'
    exit 1
}
$info = (& docker inspect $name | Out-String | ConvertFrom-Json)[0]
$autoRemove = [bool]$info.HostConfig.AutoRemove
$restart = $info.HostConfig.RestartPolicy.Name
$envNames = @($info.Config.Env | ForEach-Object { ($_ -split '=', 2)[0] })
$ports = ($info.NetworkSettings.Ports.PSObject.Properties | ForEach-Object {
    $hp = if ($_.Value) { ($_.Value | ForEach-Object { "$($_.HostIp):$($_.HostPort)" }) -join ',' } else { '-' }
    "$($_.Name) -> $hp" }) -join '; '
$networks = ($info.NetworkSettings.Networks.PSObject.Properties.Name) -join ', '

Write-Ok "Name:           $name"
Write-Ok "State:          $($info.State.Status)"
Write-Ok "Image:          $($info.Config.Image)"
Write-Ok "Ports:          $ports"
Write-Ok "Networks:       $networks"
Write-Ok "Restart policy: $restart"
Write-Ok "Env var NAMES:  $($envNames -join ', ')"

$version = $null
if ($info.State.Running) {
    $version = (& docker exec $name n8n --version | Select-Object -Last 1)
    Write-Ok "n8n version:    $version"
}

# Full record of how the container was created. Contains env VALUES:
# keep it on this computer, never paste it into a chat.
$recordPath = Join-Path $BackupDir "n8n-container-$stamp.json"
& docker inspect $name | Out-File -FilePath $recordPath -Encoding utf8
Write-Ok "Container definition saved to $recordPath (private file - do not share)"

Write-Step 'What this means'
if ($autoRemove) {
    Write-Warn2 'This container was started with --rm. If it stops (Docker restart, Windows reboot, "wsl --shutdown"),'
    Write-Warn2 'Docker deletes the CONTAINER. Your data in n8n_data is NOT deleted, but n8n will not come back by itself.'
    Write-Warn2 'Recommended: after the sandbox works, do Path B (06-migrate-n8n-to-compose.ps1) so n8n restarts automatically.'
} elseif ($restart -in @('always', 'unless-stopped')) {
    Write-Ok 'Container restarts automatically after reboots.'
} else {
    Write-Warn2 "Restart policy is '$restart': n8n will not start by itself after a reboot. Path B fixes this."
}
if ($envNames -contains 'N8N_ENCRYPTION_KEY') {
    Write-Warn2 'N8N_ENCRYPTION_KEY is set as an environment variable on this container.'
    Write-Warn2 'If you ever recreate n8n (Path B) you MUST copy that same value into infra/stack/n8n.env,'
    Write-Warn2 "or saved credentials cannot be decrypted. The value is in $recordPath."
} else {
    Write-Ok 'Encryption key is not an env var, so it lives inside n8n_data (/home/node/.n8n/config). It is included in the backup.'
}
if ($networks -match 'jarvis-net') { Write-Ok 'Already connected to jarvis-net.' }

Write-Step 'Memory right now'
& docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
$os = Get-CimInstance Win32_OperatingSystem
$usedPct = [math]::Round((1 - $os.FreePhysicalMemory / $os.TotalVisibleMemorySize) * 100)
Write-Ok "Windows memory in use: $usedPct%"
if ($usedPct -gt 80) { Write-Warn2 'Above 80%. Close browser tabs and apps before starting the sandbox.' }

Write-Host "`nNext: .\infra\windows\02-backup.ps1" -ForegroundColor Cyan
