<#
 One-time import of SharePoint jobs into BidAxiom (projects, phases, contracts and invoices for active jobs, and each job's files).

   .\import-sharepoint.ps1            Dry run. Writes nothing. Shows what would be created and saves import-report.json next to the plan.
   .\import-sharepoint.ps1 -Apply     Does the import.

 It is safe to run again: jobs already imported are matched by job number and files already attached are skipped.
 Run it again after more SharePoint folders have synced to this computer and it adds their files.

 Needs: Docker running, the BidAxiom containers up, the plan file (plan.json) and the SharePoint library synced to this computer.
 The library folders have to be downloaded, not "online only". The script copies them to a local staging folder first, which also downloads them.
 Optional in C:\BidAxiomDeploy\config.json:  "importPlanDir": "...\migration"   "importLibrary": "...\TE Projects - Project Files"
#>
param(
  [switch]$Apply,
  [string]$PlanDir,
  [string]$Library,
  [string]$Company = "Thomson Enterprises",
  [string]$UserEmail = "ethomson@thomsonenterprises.com",
  [switch]$SkipCopy
)
$ErrorActionPreference = "Continue"
$Root = "C:\BidAxiomDeploy"
$Repo = Join-Path $Root "repo"
$Compose = "docker-compose.app.yml"
$cfg = Get-Content (Join-Path $Root "config.json") -Raw | ConvertFrom-Json

if (-not $PlanDir) { $PlanDir = $cfg.importPlanDir }
if (-not $Library) { $Library = $cfg.importLibrary }
if (-not $PlanDir) { $PlanDir = "C:\Users\erict\OneDrive - Thomson Enterprises\Documents\Claude Projects\Construction-Mgmt-Software\migration" }
if (-not $Library) {
  foreach ($c in @("C:\Users\erict\Thomson Enterprises\TE Projects - Documents\Project Files", "C:\Users\erict\Thomson Enterprises\TE Projects - Project Files")) {
    if (Test-Path $c) { $Library = $c; break }
  }
}
if (-not $PlanDir -or -not (Test-Path (Join-Path $PlanDir "plan.json"))) { Write-Host "Could not find plan.json. Run with -PlanDir <folder that contains plan.json>."; exit 1 }
if (-not $Library -or -not (Test-Path $Library)) { Write-Host "Could not find the SharePoint library folder. Run with -Library <path to 'TE Projects - Project Files'>."; exit 1 }
Write-Host "Plan:    $PlanDir"
Write-Host "Library: $Library"

docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker is not running."; exit 1 }

# Copy the library to a local staging folder. robocopy downloads online-only OneDrive files as it reads them.
$Stage = "C:\BidAxiomImport\library"
if (-not $SkipCopy) {
  Write-Host "Copying the library to $Stage (this can take a while the first time)..."
  New-Item -ItemType Directory -Force -Path $Stage | Out-Null
  $CopyLog = "C:\BidAxiomImport\copy.log"
  robocopy $Library $Stage /E /XJ /R:2 /W:2 /NP /NDL /NJH /XF "~$*" "Thumbs.db" "desktop.ini" /LOG:$CopyLog | Out-Null
  if ($LASTEXITCODE -ge 8) {
    $bad = @(Select-String -Path $CopyLog -Pattern "ERROR \d+ \(" -SimpleMatch:$false | ForEach-Object { $_.Line.Trim() })
    Write-Host ""
    Write-Host "WARNING: $($bad.Count) file(s) could not be copied (robocopy exit $LASTEXITCODE). The import will go ahead without them."
    Write-Host "They are usually OneDrive files that are not downloaded yet, files open in another program, or paths that are too long."
    $bad | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" }
    Write-Host "Full list: $CopyLog. Fix those files, then run this again; files already imported are skipped and the missing ones are added."
    Write-Host ""
  }
}

$project = $cfg.project
Set-Location $Repo
$cmd = @("compose", "-p", $project, "-f", $Compose, "run", "--rm", "-T", "--no-deps",
  "-v", "${Stage}:/sp:ro", "-v", "${PlanDir}:/mig",
  "api", "npx", "tsx", "src/scripts/import-sharepoint.ts",
  "--plan", "/mig/plan.json", "--library", "/sp", "--company", $Company, "--user", $UserEmail)
if ($Apply) { $cmd += "--apply" }
& docker @cmd
Write-Host ""
if (-not $Apply) { Write-Host "That was a dry run. Review import-report.json in the plan folder, then run again with -Apply." }
