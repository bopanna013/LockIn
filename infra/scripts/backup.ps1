# ============================================================================
# Automated PostgreSQL Backup Script (PowerShell)
# Creates a compressed custom-format dump (.dump) and rotates backups older
# than $RetentionDays.
# ============================================================================
param(
  [string]$ContainerName = "lockin-dev-postgres-1",
  [string]$DatabaseName = "lockin",
  [string]$BackupDir = "$PSScriptRoot\..\..\backups",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = Join-Path $BackupDir "lockin-$timestamp.sql"

Write-Host "Creating PostgreSQL backup from container '$ContainerName'..."
docker exec $ContainerName pg_dump -U postgres --clean --if-exists $DatabaseName > $outFile

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "lockin-*.sql" |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  Remove-Item -Force

Write-Host "✔ Backup saved to: $outFile"
