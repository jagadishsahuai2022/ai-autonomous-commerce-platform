#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────────
# db-import-vps.ps1 — Transfer a SQL dump to the VPS and restore it
#
# Automatically strips \restrict / \unrestrict DLP tokens before importing.
#
# Prerequisites:
#   1. SSH_KEY file at repo root (or pass -SshKeyPath)
#   2. VPS running with dc-latest-postgres container up
#
# Usage:
#   .\scripts\db-import-vps.ps1 -ServerIp 1.2.3.4
#   .\scripts\db-import-vps.ps1 -ServerIp 1.2.3.4 -DumpFile data\db-migration-dump.sql
#   .\scripts\db-import-vps.ps1 -ServerIp 1.2.3.4 -SkipBackup
#
# Defaults:
#   DumpFile   : data\db-migration-dump.sql  (32MB cluster dump in repo)
#   ServerUser : root
#   SshKeyPath : SSH_KEY  (repo root)
#   DbName     : delegatecart
#   DbUser     : admin
# ─────────────────────────────────────────────────────────────────────────────
param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIp,

    [string]$ServerUser  = "root",
    [string]$SshKeyPath  = "",
    [string]$DumpFile    = "",
    [string]$DbName      = "delegatecart",
    [string]$DbUser      = "admin",
    [string]$SshPort     = "22",
    [switch]$SkipBackup,
    [switch]$Force       # skip the 10-second countdown
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Resolve paths ─────────────────────────────────────────────────────────────
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir

if (-not $SshKeyPath)  { $SshKeyPath  = Join-Path $RepoRoot "SSH_KEY" }
if (-not $DumpFile)    { $DumpFile    = Join-Path $RepoRoot "data\db-migration-dump.sql" }

$SshKeyPath = Resolve-Path $SshKeyPath -ErrorAction Stop
$DumpFile   = Resolve-Path $DumpFile   -ErrorAction Stop

# ── Validation ────────────────────────────────────────────────────────────────
if (-not (Test-Path $SshKeyPath)) {
    Write-Error "SSH key not found: $SshKeyPath"
    exit 1
}
if (-not (Test-Path $DumpFile)) {
    Write-Error "Dump file not found: $DumpFile"
    Write-Host "  Run: scripts\db-export-local.bat  to create a local dump first" -ForegroundColor Yellow
    exit 1
}

$DumpSizeMB = [math]::Round((Get-Item $DumpFile).Length / 1MB, 1)
$CONTAINER  = "dc-latest-postgres"
$REMOTE_TMP = "/tmp/delegatecart-import.sql"
$BACKUP_FILE = "/tmp/vps-backup-$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

$SSHOpts = @("-i", $SshKeyPath, "-p", $SshPort, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes")
$SCP_TARGET = "${ServerUser}@${ServerIp}:${REMOTE_TMP}"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host " DB Import: local → VPS" -ForegroundColor Cyan
Write-Host " VPS       : $ServerUser@$ServerIp (port $SshPort)" -ForegroundColor White
Write-Host " Dump file : $DumpFile ($DumpSizeMB MB)" -ForegroundColor White
Write-Host " Target DB : $DbName (inside $CONTAINER)" -ForegroundColor White
Write-Host " Skip backup: $SkipBackup" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  WARNING: This will OVERWRITE '$DbName' on the VPS." -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
    Write-Host "   Press Ctrl+C to cancel. Continuing in 10 seconds..." -ForegroundColor Yellow
    for ($i = 10; $i -ge 1; $i--) {
        Write-Host "`r   $i...  " -NoNewline
        Start-Sleep -Seconds 1
    }
    Write-Host ""
    Write-Host ""
}

# ── Helper: SSH command ───────────────────────────────────────────────────────
function Invoke-SSH {
    param([string]$Command)
    & ssh @SSHOpts "${ServerUser}@${ServerIp}" $Command
    if ($LASTEXITCODE -ne 0) { throw "SSH command failed (exit $LASTEXITCODE): $Command" }
}

# ── Step 1: Verify VPS container is running ───────────────────────────────────
Write-Host "🔍 [1/5] Checking VPS container status..." -ForegroundColor Cyan
$containerCheck = & ssh @SSHOpts "${ServerUser}@${ServerIp}" "docker ps --format '{{.Names}}' | grep -c '^${CONTAINER}$' || true"
if ($containerCheck -eq "0" -or $containerCheck -eq "") {
    Write-Error "Container '$CONTAINER' is not running on VPS. Start the stack first:`n  cd /root/delegatecart && docker compose -f docker-compose.latest.yml -f docker-compose.prod.yml up -d"
    exit 1
}
Write-Host "   ✅ Container '$CONTAINER' is running" -ForegroundColor Green

# ── Step 2: Strip DLP tokens and prepare cleaned dump ────────────────────────
Write-Host ""
Write-Host "🧹 [2/5] Stripping DLP tokens (\restrict/\unrestrict) from dump..." -ForegroundColor Cyan
$CleanedDump = [System.IO.Path]::GetTempFileName() + ".sql"

$reader  = [System.IO.StreamReader]::new($DumpFile.Path)
$writer  = [System.IO.StreamWriter]::new($CleanedDump, $false, [System.Text.Encoding]::UTF8)
$stripped = 0
while ($null -ne ($line = $reader.ReadLine())) {
    if ($line -match '^\s*\\(restrict|unrestrict)\s+\S+') {
        $stripped++
    } else {
        $writer.WriteLine($line)
    }
}
$reader.Close()
$writer.Close()

$CleanedSizeMB = [math]::Round((Get-Item $CleanedDump).Length / 1MB, 1)
Write-Host "   ✅ Stripped $stripped DLP token line(s). Clean dump: $CleanedSizeMB MB" -ForegroundColor Green

# ── Step 3: Backup current VPS DB ────────────────────────────────────────────
if (-not $SkipBackup) {
    Write-Host ""
    Write-Host "📦 [3/5] Creating VPS backup → $BACKUP_FILE ..." -ForegroundColor Cyan
    Invoke-SSH "docker exec -t $CONTAINER pg_dump -U $DbUser --clean --if-exists $DbName > $BACKUP_FILE 2>&1"
    $backupSize = & ssh @SSHOpts "${ServerUser}@${ServerIp}" "du -sh $BACKUP_FILE 2>/dev/null | cut -f1"
    Write-Host "   ✅ VPS backup created: $BACKUP_FILE ($backupSize)" -ForegroundColor Green
    Write-Host "      (stored on VPS — delete manually when no longer needed)" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "⏭  [3/5] Skipping backup (--SkipBackup specified)" -ForegroundColor Yellow
}

# ── Step 4: Upload dump to VPS ────────────────────────────────────────────────
Write-Host ""
Write-Host "📤 [4/5] Uploading dump to VPS ($CleanedSizeMB MB)..." -ForegroundColor Cyan
& scp "-i" $SshKeyPath "-P" $SshPort "-o" "StrictHostKeyChecking=accept-new" $CleanedDump $SCP_TARGET
if ($LASTEXITCODE -ne 0) { throw "SCP upload failed" }
Write-Host "   ✅ Uploaded to $REMOTE_TMP" -ForegroundColor Green

# Clean up local temp file
Remove-Item $CleanedDump -ErrorAction SilentlyContinue

# ── Step 5: Restore dump on VPS ───────────────────────────────────────────────
Write-Host ""
Write-Host "♻️  [5/5] Restoring dump inside VPS container..." -ForegroundColor Cyan
Write-Host "   (this may take a few minutes for large datasets)" -ForegroundColor Gray

Invoke-SSH @"
set -euo pipefail
echo '  Copying dump into container...'
docker cp $REMOTE_TMP ${CONTAINER}:/tmp/import.sql

echo '  Running psql restore...'
docker exec -e PGPASSWORD=password $CONTAINER psql -U $DbUser -f /tmp/import.sql 2>&1 | tail -20

echo '  Cleaning up...'
docker exec $CONTAINER rm -f /tmp/import.sql
rm -f $REMOTE_TMP

echo '  Checking row counts...'
docker exec $CONTAINER psql -U $DbUser -d $DbName -c "SELECT schemaname, tablename, n_live_tup AS rows FROM pg_stat_user_tables WHERE n_live_tup > 0 ORDER BY n_live_tup DESC LIMIT 15;" 2>/dev/null || true
"@

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host " ✅ Import complete!" -ForegroundColor Green
Write-Host "    Database '$DbName' restored on $ServerUser@$ServerIp" -ForegroundColor Green
if (-not $SkipBackup) {
    Write-Host "    VPS backup saved at: $BACKUP_FILE" -ForegroundColor Gray
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
