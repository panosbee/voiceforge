# ═══════════════════════════════════════════════════════════════════
# VoiceForge AI — Development Startup Script (Windows PowerShell)
# Prerequisites: Docker Desktop must be running
# Usage: .\start-dev.ps1
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       VoiceForge AI — Development Startup        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check prerequisites ─────────────────────────────────
Write-Host "[1/7] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: Node.js is not installed. Please install Node.js 20+." -ForegroundColor Red
    exit 1
}
$nodeVersion = (node -v) -replace 'v', ''
Write-Host "  Node.js: v$nodeVersion" -ForegroundColor Green

# Check pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "  pnpm not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm@latest
}
$pnpmVersion = pnpm -v
Write-Host "  pnpm: v$pnpmVersion" -ForegroundColor Green

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: Docker is not installed. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Docker Desktop is not running. Please start it first." -ForegroundColor Red
    exit 1
}
Write-Host "  Docker: Running" -ForegroundColor Green

# ── Step 2: Check .env file ─────────────────────────────────────
Write-Host ""
Write-Host "[2/7] Checking environment configuration..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "  .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "  IMPORTANT: Edit .env and fill in your API keys before proceeding!" -ForegroundColor Red
    Write-Host "  At minimum, set ENCRYPTION_KEY (see README.md for instructions)." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Run this command to generate an encryption key:" -ForegroundColor Cyan
    Write-Host '  node -e "console.log(require(''crypto'').randomBytes(32).toString(''hex''))"' -ForegroundColor White
    Write-Host ""
    Read-Host "  Press Enter after editing .env to continue, or Ctrl+C to abort"
}
Write-Host "  .env file: OK" -ForegroundColor Green

# ── Step 3: Install dependencies ────────────────────────────────
Write-Host ""
Write-Host "[3/7] Installing dependencies..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pnpm install failed." -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies: Installed" -ForegroundColor Green

# ── Step 4: Start PostgreSQL via Docker ─────────────────────────
Write-Host ""
Write-Host "[4/7] Starting PostgreSQL (Docker)..." -ForegroundColor Yellow

docker compose up -d postgres
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to start PostgreSQL container." -ForegroundColor Red
    exit 1
}

# Wait for PostgreSQL to be healthy
Write-Host "  Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
do {
    Start-Sleep -Seconds 1
    $retryCount++
    $pgReady = docker exec voiceforge-postgres pg_isready -U voiceforge -d voiceforge 2>&1
} while ($LASTEXITCODE -ne 0 -and $retryCount -lt $maxRetries)

if ($retryCount -ge $maxRetries) {
    Write-Host "  ERROR: PostgreSQL did not become ready in time." -ForegroundColor Red
    exit 1
}
Write-Host "  PostgreSQL: Running (port 5432)" -ForegroundColor Green

# ── Step 5: Run database migrations ─────────────────────────────
Write-Host ""
Write-Host "[5/7] Pushing database schema..." -ForegroundColor Yellow
pnpm db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "  WARNING: db:push failed. Schema may already be up to date." -ForegroundColor Yellow
} else {
    Write-Host "  Database schema: Up to date" -ForegroundColor Green
}

# Run SQL migrations (if any new ones)
$migrationsDir = "docker/migrations"
if (Test-Path $migrationsDir) {
    $migrations = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name
    if ($migrations.Count -gt 0) {
        Write-Host "  Running SQL migrations..." -ForegroundColor Yellow
        foreach ($migration in $migrations) {
            Write-Host "    -> $($migration.Name)" -ForegroundColor Gray
            $sql = Get-Content $migration.FullName -Raw
            docker exec -i voiceforge-postgres psql -U voiceforge -d voiceforge -c "$sql" 2>&1 | Out-Null
        }
        Write-Host "  Migrations: Applied" -ForegroundColor Green
    }
}

# ── Step 6: Start API server (background) ───────────────────────
Write-Host ""
Write-Host "[6/7] Starting API server (port 3001)..." -ForegroundColor Yellow
$apiJob = Start-Process -FilePath "pnpm" -ArgumentList "dev" -WorkingDirectory $PWD -PassThru -WindowStyle Normal
Write-Host "  API server: Starting (PID: $($apiJob.Id))" -ForegroundColor Green

# Give API a moment to start
Start-Sleep -Seconds 3

# ── Step 7: Start Web frontend (background) ─────────────────────
Write-Host ""
Write-Host "[7/7] Starting Web frontend (port 3000)..." -ForegroundColor Yellow
$webJob = Start-Process -FilePath "pnpm" -ArgumentList "dev:web" -WorkingDirectory $PWD -PassThru -WindowStyle Normal
Write-Host "  Web frontend: Starting (PID: $($webJob.Id))" -ForegroundColor Green

# ── Done! ────────────────────────────────────────────────────────
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         VoiceForge AI is running!                ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "║  Frontend:  http://localhost:3000                ║" -ForegroundColor Green
Write-Host "║  API:       http://localhost:3001                ║" -ForegroundColor Green
Write-Host "║  Health:    http://localhost:3001/health         ║" -ForegroundColor Green
Write-Host "║  pgAdmin:   http://localhost:5050 (optional)     ║" -ForegroundColor Green
Write-Host "║  DB Studio: pnpm db:studio                      ║" -ForegroundColor Green
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "║  Admin:     http://localhost:3000/admin          ║" -ForegroundColor Green
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "To stop: Close the terminal windows, or run:" -ForegroundColor Yellow
Write-Host "  docker compose down" -ForegroundColor White
Write-Host ""

# Open browser
Start-Process "http://localhost:3000"
