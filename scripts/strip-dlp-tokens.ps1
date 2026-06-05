#!/usr/bin/env pwsh
# strip-dlp-tokens.ps1 — Remove Docker Desktop DLP \restrict / \unrestrict tokens
# from a SQL dump so it can be committed to git and restored on the VPS.
#
# Usage:
#   .\scripts\strip-dlp-tokens.ps1                        # strips data\db-migration-dump.sql in place
#   .\scripts\strip-dlp-tokens.ps1 -File path\to\dump.sql

param(
    [string]$File = "data\db-migration-dump.sql"
)

$RepoRoot = Split-Path -Parent $PSScriptRoot
$FullPath = Join-Path $RepoRoot $File
if (-not (Test-Path $FullPath)) {
    Write-Error "File not found: $FullPath"
    exit 1
}

$TmpPath = $FullPath + ".tmp"
$reader  = [System.IO.StreamReader]::new($FullPath)
$writer  = [System.IO.StreamWriter]::new($TmpPath, $false, [System.Text.Encoding]::UTF8)
$stripped = 0

while ($null -ne ($line = $reader.ReadLine())) {
    if ($line -match '^\s*\\(restrict|unrestrict)\s+\S*') {
        $stripped++
    } else {
        $writer.WriteLine($line)
    }
}
$reader.Close()
$writer.Close()

Move-Item $TmpPath $FullPath -Force

$mb    = [math]::Round((Get-Item $FullPath).Length / 1MB, 2)
$lines = (Get-Content $FullPath).Count

Write-Host "Stripped $stripped DLP token(s)" -ForegroundColor Green
Write-Host "File    : $FullPath"
Write-Host "Size    : $mb MB"
Write-Host "Lines   : $lines"
Write-Host ""
Write-Host "First 5 lines:"
Get-Content $FullPath -TotalCount 5
