# ============================================================================
# PostgreSQL Restore Script (PowerShell)
# Restores a .sql dump created by infra/scripts/backup.ps1.
# ============================================================================
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$ContainerName = "lockin-dev-postgres-1",
  [string]$DatabaseName = "lockin"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

Write-Host "Restoring '$BackupFile' into '$DatabaseName' on container '$ContainerName'..."
Get-Content -Raw $BackupFile | docker exec -i $ContainerName psql -U postgres -d $DatabaseName

if ($LASTEXITCODE -ne 0) {
  throw "Restore failed with exit code $LASTEXITCODE"
}

Write-Host "✔ Database restore completed."
