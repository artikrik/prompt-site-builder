# dev-start.ps1 — Local dev environment startup (PowerShell)
# Usage: .\scripts\dev-start.ps1 [-CreateUser]
#   -CreateUser    Create test user (test@example.com / test123456)
param(
    [switch]$CreateUser
)

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$BACKEND_DIR = "$ROOT_DIR\apps\backend"
$FRONTEND_DIR = "$ROOT_DIR\apps\frontend"
$PG_CONTAINER = "prompt-site-postgres"
$REDIS_CONTAINER = "prompt-site-redis"
$BACKEND_PORT = 3000
$FRONTEND_PORT = 5173
$PG_PORT = 5543
$REDIS_PORT = 6379

# Track jobs for cleanup
$backendJob = $null
$frontendJob = $null

# ── Helpers ────────────────────────────────────────────────
function Write-Step { param($n, $msg) Write-Host "[$n] $msg..." -ForegroundColor Cyan }
function Write-OK { Write-Host "  OK" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  FAIL: $msg" -ForegroundColor Red; exit 1 }

function Kill-Port($port) {
    $pid = (netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
    if ($pid -and $pid -ne "0") {
        taskkill /F /PID $pid 2>$null | Out-Null
        Write-Host "    (killed PID $pid on port $port)"
    }
}

function Test-Http($port, $path = "") {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$port$path" -TimeoutSec 3 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Wait-Http($port, $path = "", $timeoutSec = 30) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    Write-Host -NoNewline "  Waiting for localhost:$port$path"
    while ((Get-Date) -lt $deadline) {
        if (Test-Http $port $path) { Write-Host ""; return $true }
        Write-Host -NoNewline "."
        Start-Sleep 1
    }
    Write-Host ""
    return $false
}

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor White
Write-Host "  prompt-site-builder — Dev Startup" -ForegroundColor White
Write-Host "══════════════════════════════════════════" -ForegroundColor White

# ── 1. Docker check ───────────────────────────────────────
Write-Step 1 "Checking Docker"
$dockerOk = docker ps 2>$null
if (-not $dockerOk) {
    Write-Warn "Docker not running. Starting Docker Desktop..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host -NoNewline "  Waiting for Docker"
    for ($i = 0; $i -lt 30; $i++) {
        docker ps 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        Write-Host -NoNewline "."
        Start-Sleep 2
    }
    Write-Host ""
    docker ps 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "Docker failed to start" }
}
Write-OK

# ── 2. PostgreSQL ─────────────────────────────────────────
Write-Step 2 "Starting PostgreSQL ($PG_CONTAINER)"
$pgExists = docker ps --format '{{.Names}}' | Select-String $PG_CONTAINER
if ($pgExists) {
    Write-Warn "Already running — skipped"
} else {
    docker rm -f $PG_CONTAINER 2>$null | Out-Null
    docker run -d `
        --name $PG_CONTAINER `
        -e POSTGRES_USER=postgres `
        -e POSTGRES_PASSWORD=postgres `
        -e POSTGRES_DB=prompt_builder `
        -p ${PG_PORT}:5432 `
        postgres:16-alpine 2>$null | Out-Null
    Write-Host -NoNewline "  Waiting for PostgreSQL"
    for ($i = 0; $i -lt 20; $i++) {
        $ready = docker exec $PG_CONTAINER pg_isready -U postgres 2>$null
        if ($ready -match "accepting") { break }
        Write-Host -NoNewline "."
        Start-Sleep 1
    }
    Write-Host ""
    $ready = docker exec $PG_CONTAINER pg_isready -U postgres 2>$null
    if ($ready -notmatch "accepting") { Write-Fail "PostgreSQL not ready" }
    Write-OK
}

# ── 3. Redis ──────────────────────────────────────────────
Write-Step 3 "Starting Redis ($REDIS_CONTAINER)"
$redisExists = docker ps --format '{{.Names}}' | Select-String $REDIS_CONTAINER
$needsStart = $false
if ($redisExists) {
    $versionRaw = docker exec $REDIS_CONTAINER redis-cli INFO server 2>$null | Select-String "redis_version"
    $major = 0
    if ($versionRaw -match "redis_version:(\d+)\.") { $major = [int]$matches[1] }
    if ($major -lt 5) {
        Write-Warn "Redis v$major too old (need >=5). Recreating..."
        docker rm -f $REDIS_CONTAINER 2>$null | Out-Null
        $needsStart = $true
    } else {
        Write-Warn "Already running (v$major) — skipped"
    }
} else {
    $needsStart = $true
}
if ($needsStart) {
    docker rm -f $REDIS_CONTAINER 2>$null | Out-Null
    docker run -d `
        --name $REDIS_CONTAINER `
        -p ${REDIS_PORT}:6379 `
        redis:7-alpine 2>$null | Out-Null
    Write-OK
}

# ── 4. Clear dev ports ───────────────────────────────────
Write-Step 4 "Clearing dev ports ($BACKEND_PORT, $FRONTEND_PORT)"
Kill-Port $BACKEND_PORT
Kill-Port $FRONTEND_PORT
Kill-Port ($FRONTEND_PORT + 1)
Kill-Port ($FRONTEND_PORT + 2)
Write-OK

# ── 5. Environment check ──────────────────────────────────
Write-Step 5 "Checking environment"
$envFile = "$BACKEND_DIR\.env"
if (-not (Test-Path $envFile)) {
    Write-Fail "$envFile not found. Copy from .env.example and edit."
}
$envContent = Get-Content $envFile -Raw
if ($envContent -notmatch "JWT_REFRESH_SECRET") {
    Write-Warn "JWT_REFRESH_SECRET missing — adding"
    Add-Content -Path $envFile -Value "JWT_REFRESH_SECRET=dev-refresh-secret-minimum-32-chars-long"
}
if ($envContent -notmatch "JWT_SECRET") {
    Write-Warn "JWT_SECRET missing — adding"
    Add-Content -Path $envFile -Value "JWT_SECRET=dev-secret-key-for-local-development-min-32"
}
Write-OK

# ── 6. Prisma Migrations ──────────────────────────────────
Write-Step 6 "Running database migrations"
Push-Location $BACKEND_DIR
$migrateOutput = npx prisma migrate deploy 2>&1 | Select-Object -Last 1
Write-Host "  $migrateOutput"
Pop-Location
Write-OK

# ── 7. Backend ─────────────────────────────────────────────
Write-Step 7 "Starting backend (port $BACKEND_PORT)"
Push-Location $BACKEND_DIR
$proc = Start-Process -FilePath "npx" -ArgumentList "nest","start","--watch" -PassThru -NoNewWindow
$backendJob = $proc
Pop-Location
if (-not (Wait-Http $BACKEND_PORT "/docs" 30)) {
    Write-Fail "Backend not responding on port $BACKEND_PORT"
}
Write-OK

# ── 8. Frontend ────────────────────────────────────────────
Write-Step 8 "Starting frontend (port $FRONTEND_PORT)"
Push-Location $FRONTEND_DIR
$proc = Start-Process -FilePath "npx" -ArgumentList "vite","--host" -PassThru -NoNewWindow
$frontendJob = $proc
Pop-Location
if (Wait-Http $FRONTEND_PORT "" 20) {
    Write-OK
} else {
    Write-Warn "Frontend may take longer. Check http://localhost:$FRONTEND_PORT"
}

# ── 9. Test User ───────────────────────────────────────────
if ($CreateUser) {
    Write-Step 9 "Creating test user"
    $body = '{"email":"test@example.com","password":"test123456","name":"Test User"}'
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$BACKEND_PORT/auth/register" `
            -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
        if ($response.accessToken) {
            Write-OK
            Write-Host "  Login: test@example.com / test123456" -ForegroundColor Green
        }
    } catch {
        if ($_.Exception.Message -match "409|already exists") {
            Write-Warn "Already exists — skipped"
            Write-Host "  Login: test@example.com / test123456" -ForegroundColor Green
        } else {
            Write-Warn "Unexpected: $($_.Exception.Message)"
        }
    }
}

# ── Summary ────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Dev environment ready" -ForegroundColor Green
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend:   " -NoNewline; Write-Host "http://localhost:$BACKEND_PORT" -ForegroundColor White
Write-Host "  Frontend:  " -NoNewline; Write-Host "http://localhost:$FRONTEND_PORT" -ForegroundColor White
Write-Host "  Swagger:   " -NoNewline; Write-Host "http://localhost:$BACKEND_PORT/docs" -ForegroundColor White
Write-Host "  Database:  localhost:$PG_PORT (postgres:postgres@prompt_builder)"
Write-Host "  Redis:     localhost:$REDIS_PORT"
Write-Host ""
Write-Host "  Press Ctrl+C to stop all servers" -ForegroundColor Cyan
Write-Host ""

# Wait for user to Ctrl+C
try {
    while ($true) { Start-Sleep 1 }
} finally {
    Write-Host ""
    Write-Host "Shutting down..." -ForegroundColor Yellow
    if ($backendJob) { Stop-Process -Id $backendJob.Id -Force 2>$null }
    if ($frontendJob) { Stop-Process -Id $frontendJob.Id -Force 2>$null }
    Write-Host "Stopped." -ForegroundColor Green
}
