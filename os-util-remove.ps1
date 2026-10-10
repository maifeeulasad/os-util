<#
.SYNOPSIS
    Remove the Windows OS Util install (CLI shim, tray launcher, auto-start).

.DESCRIPTION
    Windows counterpart of os-util-remove.sh. Stops any running tray process,
    removes the Startup shortcut, the CLI shim and tray launcher, and takes the
    install bin directory off the user PATH. Optionally removes the user config.
    The project repository itself is left untouched.
#>

[CmdletBinding()]
param(
    # Also delete the user config (~/.config/os-util).
    [switch]$PurgeConfig
)

$ErrorActionPreference = 'Stop'

function Write-Info ($m) { Write-Host "[INFO] $m"    -ForegroundColor Cyan }
function Write-Ok   ($m) { Write-Host "[SUCCESS] $m" -ForegroundColor Green }
function Write-Warn ($m) { Write-Host "[WARNING] $m" -ForegroundColor Yellow }

$InstallRoot = Join-Path $env:LOCALAPPDATA 'os-util'
$BinDir      = Join-Path $InstallRoot 'bin'
$startup     = [Environment]::GetFolderPath('Startup')
$shortcuts   = @(
    (Join-Path $startup 'OS Util Tray.lnk'),
    (Join-Path $startup 'OS Util Widget.lnk')
)

# --- Stop running tray / widget processes ----------------------------------
$stopped = 0
# Tray + widget feed (node), and the widget's PowerShell host.
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'tray[\\/]index\.js' -or $_.CommandLine -match 'os-util[\\/]speed\.txt') } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $stopped++
    }
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'os-util-widget\.ps1' } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $stopped++
    }
if ($stopped -gt 0) { Write-Ok "Stopped $stopped running process(es)." }

# --- Remove auto-start + install files -------------------------------------
$removedLnk = $false
foreach ($lnk in $shortcuts) {
    if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Ok "Removed auto-start shortcut: $(Split-Path -Leaf $lnk)"; $removedLnk = $true }
}
if (-not $removedLnk) { Write-Info 'No auto-start shortcuts found.' }

if (Test-Path $InstallRoot) {
    Remove-Item $InstallRoot -Recurse -Force
    Write-Ok "Removed install directory: $InstallRoot"
} else {
    Write-Info 'No install directory found.'
}

# --- Remove from user PATH -------------------------------------------------
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath) {
    $kept = ($userPath -split ';') | Where-Object { $_ -and $_ -ne $BinDir }
    $newPath = ($kept -join ';')
    if ($newPath -ne $userPath) {
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Ok "Removed $BinDir from your user PATH (restart terminals to apply)."
    }
}

# --- Optional config purge -------------------------------------------------
$configDir = Join-Path $HOME '.config\os-util'
if ($PurgeConfig) {
    if (Test-Path $configDir) {
        Remove-Item $configDir -Recurse -Force
        Write-Ok "Removed config: $configDir"
    }
} elseif (Test-Path $configDir) {
    Write-Info "Config kept at $configDir (re-run with -PurgeConfig to remove)."
}

Write-Ok 'Uninstall complete.'
