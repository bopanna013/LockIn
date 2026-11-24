# ============================================================================
# LOCKIN — One-Command Quick Start (Windows PowerShell)
# Run: .\start-lockin.ps1
#
# Automatically creates .env (and apps/web/.env.local) if missing, installs
# dependencies, boots Docker (Postgres + MinIO + Mailpit), bootstraps roles,
# runs migrations, seeds the 10 B.E./B.Tech branches, and starts the web app.
# ============================================================================
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Ensure fnm Node and Docker Desktop are on PATH if installed in default user locations
$fnmNode = "$env:APPDATA\fnm\node-versions\v26.13.1\installation"
if (Test-Path $fnmNode) { $env:Path = "$fnmNode;$env:Path" }
$dockerBin = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
if (Test-Path $dockerBin) { $env:Path = "$dockerBin;$env:Path" }

Write-Host "=== LOCKIN One-Command Launcher ===" -ForegroundColor Cyan

# 1. Create .env and apps/web/.env.local with ready-to-run local passwords if missing
if (-not (Test-Path ".env")) {
  Write-Host "-> Creating local .env with ready-to-use dev credentials..." -ForegroundColor Yellow
  @"
NODE_ENV=development
APP_URL=http://localhost:3000
LOG_LEVEL=info

DB_HOST=localhost
DB_PORT=5432
DB_NAME=lockin
POSTGRES_PASSWORD=dev_superuser_pwd_lockin_2026_x
DB_OWNER_PASSWORD=dev_owner_pwd_lockin_2026_xxxx
DB_APP_PASSWORD=dev_app_pwd_lockin_2026_xxxxxx
DB_CMS_PASSWORD=dev_cms_pwd_lockin_2026_xxxxxx

DATABASE_ADMIN_URL=postgres://postgres:dev_superuser_pwd_lockin_2026_x@localhost:5432/lockin
DATABASE_MIGRATION_URL=postgres://lockin_owner:dev_owner_pwd_lockin_2026_xxxx@localhost:5432/lockin
DATABASE_URL=postgres://lockin_app:dev_app_pwd_lockin_2026_xxxxxx@localhost:5432/lockin
DATABASE_CMS_URL=postgres://lockin_cms:dev_cms_pwd_lockin_2026_xxxxxx@localhost:5432/lockin

MINIO_ROOT_USER=lockin-minio
MINIO_ROOT_PASSWORD=dev_minio_pwd_lockin_2026_xxxx

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM="LOCKIN <no-reply@lockin.home.arpa>"
"@ | Set-Content -Path ".env" -Encoding UTF8
}

Copy-Item -Path ".env" -Destination "apps/web/.env.local" -Force

# 2. Install dependencies if node_modules is missing
if (-not (Test-Path "node_modules")) {
  Write-Host "-> Installing dependencies with pnpm..." -ForegroundColor Yellow
  pnpm install
}

# 3. Start Docker services (Postgres 17, MinIO, Mailpit)
Write-Host "-> Starting Docker services (Postgres, MinIO, Mailpit)..." -ForegroundColor Yellow
docker compose -f infra/compose/docker-compose.dev.yml --env-file .env up -d --wait

# 4. Bootstrap roles, apply migrations, and seed Indian B.E./B.Tech catalog (all idempotent)
Write-Host "-> Bootstrapping roles, applying migrations, and seeding catalog..." -ForegroundColor Yellow
pnpm db:bootstrap
pnpm db:migrate
pnpm db:seed

# 5. Launch the Next.js web server
Write-Host ""
Write-Host "✔ LOCKIN is ready!" -ForegroundColor Green
Write-Host "  • Web App:       http://localhost:3000" -ForegroundColor Green
Write-Host "  • Mailpit Inbox: http://localhost:8025 (for verification & guardian OTP emails)" -ForegroundColor Green
Write-Host ""
pnpm dev
