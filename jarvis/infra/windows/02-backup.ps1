# STEP 2 - Back up n8n_data and PROVE the backup can be restored.
#
# 1. Pauses n8n for a few seconds (pause, not stop: a --rm container would be
#    deleted by stop). This freezes the SQLite database so the copy is consistent.
# 2. Writes %USERPROFILE%\jarvis-backups\n8n_data-<date>.tar.gz
# 3. Unpauses n8n (always, even if the backup fails).
# 4. Verifies: archive lists cleanly, contains database.sqlite and config
#    (encryption key), SHA-256 recorded.
# 5. Restore test: unpacks into a THROWAWAY volume, runs SQLite's
#    integrity_check and counts your workflows/credentials/users, then deletes
#    the throwaway volume. n8n_data itself is only ever read.
#
# Run from the jarvis folder:
#   powershell -ExecutionPolicy Bypass -File .\infra\windows\02-backup.ps1

param([string]$Volume = 'n8n_data')

. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Docker
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = "$Volume-$stamp.tar.gz"
$fullPath = Join-Path $BackupDir $file

Write-Step "Backing up volume $Volume"
& docker volume inspect $Volume | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Volume $Volume not found - nothing was changed." }
Invoke-Native docker @('pull', '-q', 'alpine:3.20') -Quiet | Out-Null

$name = Get-N8nContainerName -Volume $Volume
$paused = $false
if ($name -and ((& docker inspect -f '{{.State.Running}}' $name) -eq 'true')) {
    Invoke-Native docker @('pause', $name) -Quiet | Out-Null
    $paused = $true
    Write-Ok "Paused $name (the editor will freeze for a few seconds)"
}
try {
    Invoke-Native docker @('run', '--rm',
        '-v', "${Volume}:/data:ro",
        '-v', "${BackupDir}:/backup",
        'alpine:3.20', 'tar', '-czf', "/backup/$file", '-C', '/data', '.') -Quiet | Out-Null
} finally {
    if ($paused) { & docker unpause $name | Out-Null; Write-Ok "Unpaused $name" }
}
if (-not (Test-Path $fullPath)) { throw "Backup file was not created: $fullPath" }
$sizeMb = [math]::Round((Get-Item $fullPath).Length / 1MB, 2)
Write-Ok "Created $fullPath ($sizeMb MB)"

Write-Step 'Checking archive contents'
$list = Invoke-Native docker @('run', '--rm', '-v', "${BackupDir}:/backup:ro", 'alpine:3.20',
    'tar', '-tzf', "/backup/$file") -Quiet
$required = @('./database.sqlite', './config')
$missing = @($required | Where-Object { $list -notcontains $_ })
if ($missing.Count -gt 0) {
    Write-Bad "Missing from archive: $($missing -join ', ')"
    Write-Bad 'Do NOT continue. Your n8n may keep its data somewhere else (e.g. Postgres). Report this output.'
    exit 1
}
Write-Ok "$($list.Count) entries, including database.sqlite and config (encryption key)"
$hash = (Get-FileHash $fullPath -Algorithm SHA256).Hash
"$hash  $file" | Out-File -FilePath "$fullPath.sha256" -Encoding ascii
Write-Ok "SHA-256 $hash (saved next to the backup)"

Write-Step 'Restore test into a throwaway volume'
$testVol = "n8n_restore_test_$stamp"
Invoke-Native docker @('volume', 'create', $testVol) -Quiet | Out-Null
try {
    Invoke-Native docker @('run', '--rm', '-v', "${testVol}:/restore", '-v', "${BackupDir}:/backup:ro",
        'alpine:3.20', 'tar', '-xzf', "/backup/$file", '-C', '/restore') -Quiet | Out-Null
    $sql = "PRAGMA integrity_check; SELECT 'workflows=' || COUNT(*) FROM workflow_entity; " +
           "SELECT 'credentials=' || COUNT(*) FROM credentials_entity; SELECT 'users=' || COUNT(*) FROM user;"
    # SQL goes in via an env var and stdin: no nested quotes (PowerShell 5.1 mangles them).
    $check = & docker run --rm -e "Q=$sql" -v "${testVol}:/restore" alpine:3.20 sh -c 'set -f; apk add -q --no-cache sqlite >/dev/null && echo $Q | sqlite3 /restore/database.sqlite'
    if ($LASTEXITCODE -ne 0) {
        Write-Warn2 'Could not run sqlite3 (no internet for the alpine package?). Archive is valid but the database was not opened.'
    } elseif (($check | Select-Object -First 1) -eq 'ok') {
        Write-Ok 'SQLite integrity_check: ok'
        $check | Select-Object -Skip 1 | ForEach-Object { Write-Ok "Restored copy contains $_" }
    } else {
        Write-Bad "SQLite integrity_check failed: $($check -join ' ')"
        Write-Bad 'Do NOT continue. Run this script again; if it fails twice, report the output.'
        exit 1
    }
} finally {
    & docker volume rm $testVol | Out-Null
    Write-Ok "Removed throwaway volume $testVol (n8n_data untouched)"
}

Write-Step 'Backup verified'
Write-Host "  $fullPath" -ForegroundColor Green
Write-Host '  Copy this file to a USB drive or cloud folder too: a backup on the same laptop does not survive a dead SSD.'
Write-Host '  It contains your encryption key and credentials. Treat it like a password.'
Write-Host "`n  To RESTORE it later (only if ever needed), stop n8n first, then:" -ForegroundColor DarkGray
Write-Host "    docker run --rm -v ${Volume}:/data -v `"${BackupDir}:/backup`" alpine:3.20 sh -c `"cd /data && tar -xzf /backup/$file`"" -ForegroundColor DarkGray
Write-Host "`nNext: .\infra\windows\03-setup-sandbox.ps1" -ForegroundColor Cyan
