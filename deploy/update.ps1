<#
 BidAxiom auto-update. Runs from a Windows scheduled task (set up by setup.ps1).
 Pulls the latest code from GitHub into a clean copy, and only if something changed:
 rebuilds the api and web images, restarts them, and runs any migrations not yet applied.
 The database, Redis and file storage containers and their data are never touched.
 Log: C:\BidAxiomDeploy\update.log
#>
param([switch]$Force)

# Native tools (docker, git) write progress to stderr; check $LASTEXITCODE instead of letting that stop the script.
$ErrorActionPreference = "Continue"
$Root = "C:\BidAxiomDeploy"
$Repo = Join-Path $Root "repo"
$Log = Join-Path $Root "update.log"
$Compose = "docker-compose.app.yml"

function Log([string]$msg) {
  "$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))  $msg" | Out-File -FilePath $Log -Append -Encoding utf8
}

# One update at a time.
$mutex = New-Object System.Threading.Mutex($false, "Global\BidAxiomUpdate")
if (-not $mutex.WaitOne(0)) { exit 0 }

try {
  # Keep the log from growing forever.
  if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 2MB)) { Move-Item $Log "$Log.old" -Force }

  $cfg = Get-Content (Join-Path $Root "config.json") -Raw | ConvertFrom-Json
  $project = $cfg.project
  $branch = $cfg.branch

  # Docker Desktop has to be up. If it is not, try again on the next run.
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { exit 0 }

  Set-Location $Repo
  git fetch origin $branch --quiet 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Log "git fetch failed (offline or sign-in needed). Will retry."; exit 0 }

  $local = (git rev-parse HEAD).Trim()
  $remote = (git rev-parse "origin/$branch").Trim()
  $stateFile = Join-Path $Root "deployed.txt"
  $failedFile = Join-Path $Root "failed.txt"
  $deployed = if (Test-Path $stateFile) { (Get-Content $stateFile -Raw).Trim() } else { "" }
  $failed = if (Test-Path $failedFile) { (Get-Content $failedFile -Raw).Trim() } else { "" }

  if (-not $Force) {
    if ($remote -eq $deployed) { exit 0 }                 # already running this version
    if ($remote -eq $failed) { exit 0 }                   # this version failed before; wait for a newer one
  }

  Log "Updating to $($remote.Substring(0,7)) (was $(if ($deployed) { $deployed.Substring(0,7) } else { 'none' }))"
  git reset --hard "origin/$branch" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "git reset failed" }

  docker compose -p $project -f $Compose build api web site 2>&1 | ForEach-Object { Log "build: $_" }
  if ($LASTEXITCODE -ne 0) {
    Set-Content $failedFile $remote
    Log "BUILD FAILED for $($remote.Substring(0,7)). The running app was left as it was."
    exit 1
  }

  docker compose -p $project -f $Compose up -d 2>&1 | ForEach-Object { Log "up: $_" }
  if ($LASTEXITCODE -ne 0) { Set-Content $failedFile $remote; Log "docker compose up failed."; exit 1 }

  # Migrations: the api needs a moment to start before we can exec into it.
  $migrated = $false
  for ($i = 0; $i -lt 12 -and -not $migrated; $i++) {
    Start-Sleep -Seconds 5
    $out = docker compose -p $project -f $Compose exec -T api npx tsx src/db/migrations/run-pending.ts 2>&1
    if ($LASTEXITCODE -eq 0) { $migrated = $true; $out | Where-Object { $_ -match "Running|Applied|No pending|First run|failed" } | ForEach-Object { Log "migrate: $_" } }
    elseif ($out -match "failed \(exit") { $out | ForEach-Object { Log "migrate: $_" }; break }
  }
  if (-not $migrated) {
    Set-Content $failedFile $remote
    Log "MIGRATIONS DID NOT COMPLETE for $($remote.Substring(0,7)). See the lines above."
    exit 1
  }

  Set-Content $stateFile $remote
  if (Test-Path $failedFile) { Remove-Item $failedFile -Force }
  # Use the newest copy of this script next time.
  Copy-Item (Join-Path $Repo "deploy\update.ps1") (Join-Path $Root "update.ps1") -Force
  Log "Deployed $($remote.Substring(0,7))."
}
catch {
  Log "ERROR: $($_.Exception.Message)"
  exit 1
}
finally {
  $mutex.ReleaseMutex() | Out-Null
}
