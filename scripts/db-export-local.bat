@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: db-export-local.bat — Dump the local delegatecart database to a SQL file
::
:: Connects to the running dc-latest-postgres container and creates a portable
:: SQL dump that can be restored to the VPS with db-import-vps.sh.
::
:: Usage:
::   scripts\db-export-local.bat
::   scripts\db-export-local.bat --schema-only
::
:: Output: scripts\data\dump-YYYY-MM-DD_HHMMSS.sql
:: ─────────────────────────────────────────────────────────────────────────────
setlocal EnableDelayedExpansion

set CONTAINER=dc-latest-postgres
set DB_USER=admin
set DB_NAME=delegatecart
set SCHEMA_ONLY=%1

:: Build timestamp (safe for filenames)
for /f "tokens=1-3 delims=/ " %%a in ("%DATE%") do (
  set DD=%%a& set MM=%%b& set YYYY=%%c
)
for /f "tokens=1-3 delims=:." %%a in ("%TIME: =0%") do (
  set HH=%%a& set MIN=%%b& set SS=%%c
)
set TIMESTAMP=%YYYY%-%MM%-%DD%_%HH%%MIN%%SS%

set SCRIPT_DIR=%~dp0
set OUT_DIR=%SCRIPT_DIR%data

if /I "%SCHEMA_ONLY%"=="--schema-only" (
  set DUMP_FILE=%OUT_DIR%\schema-%TIMESTAMP%.sql
  set PG_FLAGS=--schema-only
  set LABEL=schema-only
) else (
  set DUMP_FILE=%OUT_DIR%\dump-%TIMESTAMP%.sql
  set PG_FLAGS=--clean --if-exists
  set LABEL=full (schema + data)
)

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  DB Export — local to file
echo  Container : %CONTAINER%
echo  Database  : %DB_NAME%
echo  Type      : %LABEL%
echo  Output    : %DUMP_FILE%
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

:: Verify container is running
docker ps --format "{{.Names}}" | findstr /x "%CONTAINER%" >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERROR: Container '%CONTAINER%' is not running.
  echo Start the stack first: docker compose -f docker-compose.latest.yml up -d
  exit /b 1
)

echo Dumping '%DB_NAME%'...
docker exec %CONTAINER% pg_dump -U %DB_USER% --no-owner --no-acl %PG_FLAGS% %DB_NAME% > "%DUMP_FILE%"

if errorlevel 1 (
  echo ERROR: pg_dump failed.
  exit /b 1
)

:: Also update the pipeline deploy file (data\db-migration-dump.sql)
if /I NOT "%SCHEMA_ONLY%"=="--schema-only" (
  set PIPELINE_DUMP=%SCRIPT_DIR%..\data\db-migration-dump.sql
  copy /Y "%DUMP_FILE%" "%PIPELINE_DUMP%" >nul
  echo Also updated: %PIPELINE_DUMP% ^(pipeline deploy file^)
)

echo.
echo Dump saved: %DUMP_FILE%
echo.
echo To import to VPS manually, run from Git Bash or WSL:
echo   bash scripts/db-import-vps.sh "%DUMP_FILE%"
echo.
echo To deploy via pipeline:
echo   Push to main, then: Actions ^> DB -- Full Restore from Repo Dump
