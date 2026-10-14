<#
 One-time setup for BidAxiom auto-update. Run once, in PowerShell, on the PC that runs the app:

   powershell -ExecutionPolicy Bypass -File "<this file>"

 It makes a clean copy of the code in C:\BidAxiomDeploy\repo, finds the Docker project your app
 already runs under (so your database is reused, not replaced), installs a scheduled task that
 checks GitHub every 5 minutes and at sign-in, and runs the first update right away.
 To undo: Unregister-ScheduledTask -TaskName BidAxiomAutoUpdate -Confirm:$false
#>
param(
  [string]$Repo = "https://github.com/hibbity-dibbity/bidaxiom.git",
  [string]$Branch = "design-consistency-pass"
)

$ErrorActionPreference = "Stop"
$Root = "C:\BidAxiomDeploy"

foreach ($tool in "git", "docker") {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed or not on PATH." }
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running. Start it and run this again." }

# The Docker project the running app belongs to. Reusing it keeps the same containers and data volumes.
$project = (docker inspect construction-db --format '{{ index .Config.Labels "com.docker.compose.project" }}' 2>$null)
if (-not $project) {
  Write-Host "The database container 'construction-db' was not found, so this looks like a first install." -ForegroundColor Yellow
  $project = "construction-mgmt-software"
}
$project = $project.Trim()
Write-Host "Docker project: $project"

New-Item -ItemType Directory -Force -Path $Root | Out-Null
$repoDir = Join-Path $Root "repo"
if (-not (Test-Path (Join-Path $repoDir ".git"))) {
  git clone --branch $Branch $Repo $repoDir
  if ($LASTEXITCODE -ne 0) { throw "git clone failed. If GitHub asks you to sign in, do so and run this again." }
}

@{ project = $project; branch = $Branch } | ConvertTo-Json | Set-Content (Join-Path $Root "config.json")
Copy-Item (Join-Path $repoDir "deploy\update.ps1") (Join-Path $Root "update.ps1") -Force

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Root\update.ps1`""
$every5 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$atLogon = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "BidAxiomAutoUpdate" -Action $action -Trigger @($every5, $atLogon) -Settings $settings -Description "Pulls BidAxiom from GitHub and redeploys when there is a new version." -Force | Out-Null
Write-Host "Scheduled task installed (every 5 minutes and at sign-in)."

Write-Host "Running the first update now. This rebuilds the app and can take several minutes..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "update.ps1") -Force
Write-Host ""
Write-Host "Done. Log: $Root\update.log" -ForegroundColor Green
Get-Content (Join-Path $Root "update.log") -Tail 12
