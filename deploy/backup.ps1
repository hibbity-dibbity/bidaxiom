<#
 BidAxiom backup. Runs from a Windows scheduled task (installed by backup-setup.ps1), nightly.
 Each run makes a folder under C:\BidAxiomBackups named by date and time with:
   database.dump   the whole Postgres database (every company), checked after it is written
   files.tar.gz    everything in file storage (uploaded documents, signed PDFs, logos)
   env.txt         your .env (the keys that decrypt saved SSO secrets). Keep these backups private.
 Old backups are removed: every night for 14 days, one per week (Sundays) for 12 weeks.
 Optional in C:\BidAxiomDeploy\config.json:
   "backupDir": "D:\\Backups\\BidAxiom"        where backups go (default C:\BidAxiomBackups)
   "backupCopyTo": "C:\\Users\\you\\OneDrive\\BidAxiomBackups"   a second copy (a cloud-synced folder or another drive)
 Log: backup.log in the backup folder.
#>
$ErrorActionPreference = "Continue"
$Root = "C:\BidAxiomDeploy"
$cfg = Get-Content (Join-Path $Root "config.json") -Raw | ConvertFrom-Json
$Dest = if ($cfg.backupDir) { $cfg.backupDir } else { "C:\BidAxiomBackups" }
$CopyTo = $cfg.backupCopyTo
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$Log = Join-Path $Dest "backup.log"
function Log([string]$m) { "$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))  $m" | Out-File -FilePath $Log -Append -Encoding ascii }
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 1MB)) { Move-Item $Log "$Log.old" -Force }

$mutex = New-Object System.Threading.Mutex($false, "Global\BidAxiomBackup")
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { Log "Docker is not running. Backup skipped."; exit 1 }

  $stamp = (Get-Date).ToString("yyyy-MM-dd_HHmm")
  $dir = Join-Path $Dest $stamp
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Log "Backup $stamp starting"
  $ok = $true

  # 1. Database. Dumped inside the container so nothing passes through the PowerShell pipeline and gets altered.
  docker exec construction-db sh -c "pg_dump -U construction -Fc construction_mgmt > /tmp/bk.dump" 2>&1 | ForEach-Object { Log "pg_dump: $_" }
  if ($LASTEXITCODE -ne 0) { $ok = $false; Log "FAILED: pg_dump" }
  else {
    $entries = docker exec construction-db sh -c "pg_restore --list /tmp/bk.dump | wc -l"
    docker cp construction-db:/tmp/bk.dump (Join-Path $dir "database.dump") 2>&1 | Out-Null
    docker exec construction-db rm -f /tmp/bk.dump | Out-Null
    $size = if (Test-Path (Join-Path $dir "database.dump")) { (Get-Item (Join-Path $dir "database.dump")).Length } else { 0 }
    if ($size -lt 1024 -or [int]$entries -lt 10) { $ok = $false; Log "FAILED: database.dump looks empty ($size bytes, $entries entries)" }
    else { Log "database.dump ok: $([math]::Round($size/1MB,1)) MB, $entries objects" }
  }

  # 2. Files (MinIO). Borrow whatever storage the MinIO container uses, so the volume's name does not matter.
  $minio = docker ps -a --format '{{.Names}}' | Where-Object { $_ -match 'minio' } | Select-Object -First 1
  if (-not $minio) { $ok = $false; Log "FAILED: no MinIO (file storage) container found. Containers: $((docker ps -a --format '{{.Names}}') -join ', ')" }
  else {
    docker run --rm --volumes-from "${minio}:ro" -v "${dir}:/out" alpine tar czf /out/files.tar.gz -C /data . 2>&1 | ForEach-Object { Log "files: $_" }
    $fp = Join-Path $dir "files.tar.gz"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $fp)) { $ok = $false; Log "FAILED: file storage backup (container $minio)" }
    else { Log "files.tar.gz ok: $([math]::Round((Get-Item $fp).Length/1MB,1)) MB (from $minio)" }
  }

  # 3. Keys.
  $envFile = Join-Path $Root "repo\.env"
  if (Test-Path $envFile) { Copy-Item $envFile (Join-Path $dir "env.txt") -Force } else { Log "note: no .env found to copy" }

  if (-not $ok) { Set-Content (Join-Path $dir "FAILED.txt") "This backup did not complete. See backup.log."; Log "Backup $stamp FAILED"; exit 1 }
  Set-Content (Join-Path $dir "OK.txt") $stamp
  Log "Backup $stamp complete"

  # 4. Second copy.
  if ($CopyTo) {
    try {
      New-Item -ItemType Directory -Force -Path $CopyTo | Out-Null
      Copy-Item $dir (Join-Path $CopyTo $stamp) -Recurse -Force
      Log "Copied to $CopyTo"
    } catch { Log "WARNING: second copy failed: $($_.Exception.Message)" }
  }

  # 5. Retention: 14 days of everything, Sundays for 12 weeks.
  foreach ($root in @($Dest, $CopyTo) | Where-Object { $_ }) {
    Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{4}$' } | ForEach-Object {
      $d = [datetime]::ParseExact($_.Name.Substring(0,10), "yyyy-MM-dd", $null)
      $age = ((Get-Date) - $d).TotalDays
      $keep = ($age -le 14) -or ($d.DayOfWeek -eq "Sunday" -and $age -le 84)
      if (-not $keep) { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue; Log "Removed old backup $($_.Name)" }
    }
  }
}
catch { Log "ERROR: $($_.Exception.Message)"; exit 1 }
finally { $mutex.ReleaseMutex() | Out-Null }
