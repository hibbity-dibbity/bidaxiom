<#
 Restore a BidAxiom backup.
   Check a backup is usable (safe; changes nothing live):
     powershell -ExecutionPolicy Bypass -File C:\BidAxiomDeploy\repo\deploy\restore.ps1 -Backup C:\BidAxiomBackups\2026-10-17_0230 -Test
   Replace the live data with a backup (asks you to type RESTORE first):
     powershell -ExecutionPolicy Bypass -File C:\BidAxiomDeploy\repo\deploy\restore.ps1 -Backup C:\BidAxiomBackups\2026-10-17_0230
 Restoring replaces the live database and files with the backup. Everything entered since the backup is lost.
#>
param([Parameter(Mandatory = $true)][string]$Backup, [switch]$Test)
$ErrorActionPreference = "Continue"
$Root = "C:\BidAxiomDeploy"
$dump = Join-Path $Backup "database.dump"
$files = Join-Path $Backup "files.tar.gz"
if (-not (Test-Path $dump)) { throw "No database.dump in $Backup" }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running." }

docker cp $dump construction-db:/tmp/restore.dump
if ($Test) {
  docker exec construction-db psql -U construction -d postgres -c "DROP DATABASE IF EXISTS restore_test" | Out-Null
  docker exec construction-db psql -U construction -d postgres -c "CREATE DATABASE restore_test" | Out-Null
  docker exec construction-db sh -c "pg_restore -U construction -d restore_test --no-owner /tmp/restore.dump" 2>&1 | Select-Object -Last 5
  Write-Host "Companies in this backup:" -ForegroundColor Cyan
  docker exec construction-db psql -U construction -d restore_test -c "SELECT count(*) AS companies FROM organizations"
  docker exec construction-db psql -U construction -d restore_test -c "SELECT count(*) AS users FROM users"
  docker exec construction-db psql -U construction -d postgres -c "DROP DATABASE restore_test" | Out-Null
  docker exec construction-db rm -f /tmp/restore.dump | Out-Null
  Write-Host "Test finished. Nothing live was changed." -ForegroundColor Green
  exit 0
}

Write-Host "This REPLACES the live BidAxiom database and files with: $Backup" -ForegroundColor Yellow
if ((Read-Host "Type RESTORE to continue") -ne "RESTORE") { Write-Host "Cancelled."; exit 0 }
$cfg = Get-Content (Join-Path $Root "config.json") -Raw | ConvertFrom-Json
$compose = Join-Path $Root "repo\docker-compose.app.yml"
docker compose -p $cfg.project -f $compose stop api web
docker exec construction-db psql -U construction -d postgres -c "DROP DATABASE construction_mgmt WITH (FORCE)"
docker exec construction-db psql -U construction -d postgres -c "CREATE DATABASE construction_mgmt"
docker exec construction-db sh -c "pg_restore -U construction -d construction_mgmt --no-owner /tmp/restore.dump" 2>&1 | Select-Object -Last 5
docker exec construction-db rm -f /tmp/restore.dump | Out-Null
if (Test-Path $files) {
  $minio = docker ps -a --format '{{.Names}}' | Where-Object { $_ -match 'minio' } | Select-Object -First 1
  $dir = Split-Path $files
  docker run --rm --volumes-from $minio -v "${dir}:/in:ro" alpine sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /in/files.tar.gz -C /data"
  docker restart $minio | Out-Null
}
docker compose -p $cfg.project -f $compose start api web
Write-Host "Restore finished. If the keys changed since this backup, copy env.txt over C:\BidAxiomDeploy\repo\.env and restart." -ForegroundColor Green
