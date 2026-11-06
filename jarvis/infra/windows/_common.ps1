# Shared helpers for the JARVIS setup scripts. Dot-sourced, not run directly.
# Works in Windows PowerShell 5.1 and PowerShell 7.

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Script:StackDir  = (Resolve-Path (Join-Path $PSScriptRoot '..\stack')).Path
$Script:BackupDir = Join-Path $HOME 'jarvis-backups'

function Write-Step([string]$Text) { Write-Host "`n==> $Text" -ForegroundColor Cyan }
function Write-Ok([string]$Text)   { Write-Host "  [OK]   $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text){ Write-Host "  [WARN] $Text" -ForegroundColor Yellow }
function Write-Bad([string]$Text)  { Write-Host "  [FAIL] $Text" -ForegroundColor Red }

# Runs a native command and throws if it fails (PowerShell 5.1 does not do this itself).
function Invoke-Native {
    param([Parameter(Mandatory)][string]$Exe, [string[]]$Arguments = @(), [switch]$Quiet)
    if ($Quiet) {
        $out = & $Exe @Arguments
        if ($LASTEXITCODE -ne 0) { throw "'$Exe $($Arguments -join ' ')' failed with exit code $LASTEXITCODE" }
        return $out
    }
    & $Exe @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "'$Exe $($Arguments -join ' ')' failed with exit code $LASTEXITCODE" }
}

function Assert-Docker {
    & docker version --format '{{.Server.Version}}' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Docker is not running. Start Docker Desktop, wait for "Engine running", then run this script again.' }
}

# Finds the existing n8n container: the one that mounts the n8n_data volume.
function Get-N8nContainerName {
    param([string]$Volume = 'n8n_data')
    $names = @(& docker ps -a --filter "volume=$Volume" --format '{{.Names}}' | Where-Object { $_ })
    if ($names.Count -eq 0) { return $null }
    if ($names.Count -gt 1) {
        Write-Warn2 "More than one container uses volume ${Volume}: $($names -join ', ')"
        Write-Warn2 'Two n8n containers must never use the same volume at the same time.'
    }
    return $names[0]
}

function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes); $rng.Dispose()
    return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

# Docker Compose env files must be UTF-8 WITHOUT a BOM and use LF line endings.
# (Set-Content -Encoding utf8 in PowerShell 5.1 adds a BOM, which breaks them.)
function Write-EnvFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string[]]$Lines)
    $text = ($Lines -join "`n") + "`n"
    [System.IO.File]::WriteAllText($Path, $text, (New-Object System.Text.UTF8Encoding($false)))
}

function Read-EnvValue {
    param([string]$Path, [string]$Name)
    if (-not (Test-Path $Path)) { return $null }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ($line -match "^\s*$([regex]::Escape($Name))=(.*)$") { return $Matches[1].Trim() }
    }
    return $null
}

function Set-EnvValue {
    param([string]$Path, [string]$Name, [string]$Value)
    $lines = @([System.IO.File]::ReadAllLines($Path))
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*#?\s*$([regex]::Escape($Name))=") { $lines[$i] = "$Name=$Value"; $found = $true; break }
    }
    if (-not $found) { $lines += "$Name=$Value" }
    Write-EnvFile -Path $Path -Lines $lines
}

function Invoke-Compose {
    param([string[]]$Arguments, [switch]$Quiet)
    Push-Location $Script:StackDir
    try { return Invoke-Native -Exe 'docker' -Arguments (@('compose') + $Arguments) -Quiet:$Quiet }
    finally { Pop-Location }
}

function Get-LatestBackup {
    if (-not (Test-Path $Script:BackupDir)) { return $null }
    return Get-ChildItem $Script:BackupDir -Filter 'n8n_data-*.tar.gz' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
