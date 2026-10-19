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
if (-not $Library) { $Library = "C:\Users\erict\Thomson Enterprises\TE Projects - Project Files" }
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
  robocopy $Library $Stage /E /XJ /R:1 /W:1 /NFL /NDL /NJH /NP /XF "~$*" "Thumbs.db" "desktop.ini" | Out-Null
  if ($LASTEXITCODE -ge 8) { Write-Host "The copy had errors (robocopy exit $LASTEXITCODE). Check that the folders are set to 'Always keep on this device'."; exit 1 }
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
