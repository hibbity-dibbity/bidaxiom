<#
 One-time: installs the nightly BidAxiom backup (2:30 AM, or the next time the PC is on), then takes one now.
   powershell -ExecutionPolicy Bypass -File C:\BidAxiomDeploy\repo\deploy\backup-setup.ps1
 To also keep a second copy somewhere safe (a OneDrive folder or another drive), add this line to
 C:\BidAxiomDeploy\config.json:   "backupCopyTo": "C:\\Users\\YOU\\OneDrive\\BidAxiomBackups"
 To undo: Unregister-ScheduledTask -TaskName BidAxiomBackup -Confirm:$false
#>
$ErrorActionPreference = "Continue"
$Root = "C:\BidAxiomDeploy"
$script = Join-Path $Root "repo\deploy\backup.ps1"
if (-not (Test-Path $script)) { throw "Run the BidAxiom setup first ($script not found)." }
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2:30AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "BidAxiomBackup" -Action $action -Trigger $trigger -Settings $settings -Description "Nightly BidAxiom database and file backup." -Force | Out-Null
Write-Host "Nightly backup installed. Taking the first backup now..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script
$dest = "C:\BidAxiomBackups"
try { $c = Get-Content (Join-Path $Root "config.json") -Raw | ConvertFrom-Json; if ($c.backupDir) { $dest = $c.backupDir } } catch {}
Get-Content (Join-Path $dest "backup.log") -Tail 8
Write-Host ""
Write-Host "Backups are in $dest" -ForegroundColor Green
