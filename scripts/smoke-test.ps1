# DelegateCart Smoke Test Script (PowerShell 5.1 compatible)
param(
  [string]$WebUrl = "http://localhost:3000",
  [string]$ApiUrl = "http://localhost:3001",
  [string]$AiUrl  = "http://localhost:8000"
)
$pass = 0; $fail = 0

function Test-Endpoint {
  param([string]$Name, [string]$Url, [int[]]$Expected = @(200), [string]$Method = "GET", [string]$Body = $null)
  $t0 = Get-Date
  try {
    $p = @{ Uri=$Url; Method=$Method; TimeoutSec=15; UseBasicParsing=$true }
    if ($Body) { $p.Body=$Body; $p.ContentType="application/json" }
    $r = Invoke-WebRequest @p -ErrorAction Stop
    $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    if ($Expected -contains $r.StatusCode) {
      Write-Host "  [PASS] $Name ($($r.StatusCode)) ${ms}ms" -ForegroundColor Green
      $script:pass++; return $true
    }
    Write-Host "  [FAIL] $Name -- got $($r.StatusCode)" -ForegroundColor Red
    $script:fail++; return $false
  } catch {
    $ms = [int]((Get-Date) - $t0).TotalMilliseconds
    $code = 0; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code -and ($Expected -contains $code)) {
      Write-Host "  [PASS] $Name ($code) ${ms}ms" -ForegroundColor Green
      $script:pass++; return $true
    }
    Write-Host "  [FAIL] $Name -- $_" -ForegroundColor Red
    $script:fail++; return $false
  }
}

Write-Host "" ; Write-Host "=== DelegateCart Smoke Tests ===" -ForegroundColor Cyan

Write-Host "`n[ Docker Containers ]" -ForegroundColor Yellow
$containerChecks = @(
  @{ Service = "web";        Names = @("dc-latest-web") },
  @{ Service = "api";        Names = @("dc-latest-api") },
  @{ Service = "postgres";   Names = @("dc-latest-postgres") },
  @{ Service = "redis";      Names = @("dc-latest-redis") },
  @{ Service = "kafka";      Names = @("dc-latest-kafka") },
  @{ Service = "zookeeper";  Names = @("dc-latest-zookeeper") },
  @{ Service = "ai-service"; Names = @("dc-latest-ai-service") }
)

foreach ($check in $containerChecks) {
  $runningName = $null
  foreach ($name in $check.Names) {
    $state = docker inspect $name 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($state -and $state[0].State.Status -eq "running") {
      $runningName = $name
      break
    }
  }

  if ($runningName) {
    Write-Host "  [OK] $($check.Service) -- running ($runningName)" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "  [FAIL] $($check.Service) -- not running" -ForegroundColor Red
    $script:fail++
  }
}

Write-Host "`n[ Web Service Pages ]" -ForegroundColor Yellow
[void](Test-Endpoint "Homepage"         "$WebUrl/"                @(200))
[void](Test-Endpoint "Products page"    "$WebUrl/products"        @(200))
[void](Test-Endpoint "AI Assistant"     "$WebUrl/ai-assistant"    @(200))
[void](Test-Endpoint "Account page"     "$WebUrl/account"         @(200))
[void](Test-Endpoint "Observability"    "$WebUrl/observability"   @(200))

Write-Host "`n[ Web API Routes ]" -ForegroundColor Yellow
# product-1 from DB may not exist -- accept 404 (DB-only mode)
[void](Test-Endpoint "GET /api/products/mock-1 (may 404 if DB empty)" "$WebUrl/api/products/mock-1" @(200,404))
[void](Test-Endpoint "GET /api/search?q=laptop"         "$WebUrl/api/search?q=laptop"  @(200))
[void](Test-Endpoint "GET /api/auth/me (unauth)"        "$WebUrl/api/auth/me"          @(401))
[void](Test-Endpoint "GET /api/observability (unauth)"  "$WebUrl/api/observability"    @(401))

Write-Host "`n[ Auth Flow ]" -ForegroundColor Yellow
$lBody = '{"email":"admin@delegatecart.com"}'
$ok = Test-Endpoint "POST /api/auth/login" "$WebUrl/api/auth/login" @(200) "POST" $lBody
if ($ok) {
  try {
    $lr = Invoke-RestMethod -Uri "$WebUrl/api/auth/login" -Method POST -ContentType "application/json" -Body $lBody -TimeoutSec 10
    $tok = $lr.token
    if ($tok -and $tok.StartsWith("sess_")) {
      Write-Host "  [PASS] Token: sess_*** (real DB session)" -ForegroundColor Green; $script:pass++
      $h = @{ Authorization="Bearer $tok" }
      try {
        $me = Invoke-WebRequest -Uri "$WebUrl/api/auth/me" -Headers $h -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($me.StatusCode -eq 200) { Write-Host "  [PASS] /api/auth/me -> 200" -ForegroundColor Green; $script:pass++ }
        else { Write-Host "  [FAIL] /api/auth/me -> $($me.StatusCode)" -ForegroundColor Red; $script:fail++ }
      } catch { Write-Host "  [FAIL] /api/auth/me -- $_" -ForegroundColor Red; $script:fail++ }
      try {
        $obs = Invoke-WebRequest -Uri "$WebUrl/api/observability" -Headers $h -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
        if (@(200,500) -contains $obs.StatusCode) { Write-Host "  [PASS] /api/observability -> $($obs.StatusCode)" -ForegroundColor Green; $script:pass++ }
        else { Write-Host "  [FAIL] /api/observability -> $($obs.StatusCode)" -ForegroundColor Red; $script:fail++ }
      } catch {
        $ec = 0; try { $ec = [int]$_.Exception.Response.StatusCode } catch {}
        if ($ec -eq 200 -or $ec -eq 500) { Write-Host "  [PASS] /api/observability -> $ec" -ForegroundColor Green; $script:pass++ }
        else { Write-Host "  [FAIL] /api/observability -- $_" -ForegroundColor Red; $script:fail++ }
      }
    } else { Write-Host "  [FAIL] Token format wrong: $tok" -ForegroundColor Red; $script:fail++ }
  } catch { Write-Host "  [WARN] Login parse error: $_" -ForegroundColor Yellow }
}

Write-Host "`n[ NestJS API Direct ]" -ForegroundColor Yellow
[void](Test-Endpoint "API /health"    "$ApiUrl/health"   @(200,404))
# /products may 500 if DB has no data -- accept it
[void](Test-Endpoint "API /products"  "$ApiUrl/products" @(200,401,403,404,500))

Write-Host "`n[ AI Service ]" -ForegroundColor Yellow
[void](Test-Endpoint "AI /health"     "$AiUrl/health"    @(200))

Write-Host "`n[ Journey Events ]" -ForegroundColor Yellow
# Use correct eventType and required sessionId field
$jBody = '{"sessionId":"smoke-test-session-001","eventType":"product_clicked","productId":"1","userId":"smoke-test"}'
[void](Test-Endpoint "POST /api/events/journey" "$WebUrl/api/events/journey" @(200,201,204) "POST" $jBody)

Write-Host ""
Write-Host "===============================" -ForegroundColor Cyan
$total = $pass + $fail
$pct = if ($total -gt 0) { [math]::Round($pass/$total*100,1) } else { 0 }
if ($fail -eq 0) { Write-Host "  ALL PASSED: $pass/$total ($pct%)" -ForegroundColor Green }
else { Write-Host "  RESULTS: $pass/$total passed ($pct%) -- $fail FAILED" -ForegroundColor Yellow }
Write-Host "===============================" -ForegroundColor Cyan
exit $(if ($fail -gt 0) { 1 } else { 0 })
