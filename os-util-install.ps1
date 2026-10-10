<#
.SYNOPSIS
    Install OS Util on Windows: the `os-util` CLI and the system-tray app.

.DESCRIPTION
    Windows counterpart of os-util-install.sh (which installs the GNOME Shell
    extension on Linux). It builds the TypeScript project, installs a CLI shim
    on PATH, and sets up the system-tray app (the taskbar equivalent of the
    GNOME panel extension) with an optional auto-start entry.

    Shims point at this repository's compiled dist/ (the same approach the Linux
    script takes), so keep the project folder in place after installing.
#>

[CmdletBinding()]
param(
    # Install the tray auto-start entry without prompting.
    [switch]$AutoStart,
    # Install the widget auto-start entry without prompting.
    [switch]$AutoStartWidget,
    # Skip the CLI shim / PATH changes.
    [switch]$NoCli
)

$ErrorActionPreference = 'Stop'

function Write-Info    ($m) { Write-Host "[INFO] $m"    -ForegroundColor Cyan }
function Write-Ok      ($m) { Write-Host "[SUCCESS] $m" -ForegroundColor Green }
function Write-Warn    ($m) { Write-Host "[WARNING] $m" -ForegroundColor Yellow }
function Write-Err     ($m) { Write-Host "[ERROR] $m"   -ForegroundColor Red }

$ProjectDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallRoot = Join-Path $env:LOCALAPPDATA 'os-util'
$BinDir      = Join-Path $InstallRoot 'bin'
$DistCli     = Join-Path $ProjectDir 'dist\cli.js'
$DistTray    = Join-Path $ProjectDir 'dist\tray\index.js'

Write-Info "Installing OS Util from: $ProjectDir"

# --- Prerequisites ---------------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Err 'Node.js is required but was not found on PATH. Install Node 18+ from https://nodejs.org and re-run.'
    exit 1
}
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue

# --- Build -----------------------------------------------------------------
Write-Info 'Building the project...'
Push-Location $ProjectDir
try {
    if ($pnpm) {
        & pnpm install | Out-Null
        & pnpm run build | Out-Null
    } else {
        Write-Warn 'pnpm not found; falling back to npm.'
        & npm install | Out-Null
        & npm run build | Out-Null
    }
} finally {
    Pop-Location
}
if (-not (Test-Path $DistCli) -or -not (Test-Path $DistTray)) {
    Write-Err 'Build did not produce the expected dist/ output. Aborting.'
    exit 1
}
Write-Ok 'Build complete.'

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

# --- CLI shim + PATH -------------------------------------------------------
if (-not $NoCli) {
    $cmdPath = Join-Path $BinDir 'os-util.cmd'
    "@echo off`r`nnode `"$DistCli`" %*" | Set-Content -Path $cmdPath -Encoding ascii
    Write-Ok "Installed CLI shim: $cmdPath"

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -notcontains $BinDir) {
        [Environment]::SetEnvironmentVariable('Path', "$userPath;$BinDir", 'User')
        Write-Ok "Added $BinDir to your user PATH (restart terminals to pick it up)."
    } else {
        Write-Info "$BinDir is already on your user PATH."
    }
} else {
    Write-Info 'Skipping CLI shim (-NoCli).'
}

# --- Launchers (run hidden, no console window) -----------------------------
$WScript = Join-Path $env:SystemRoot 'System32\wscript.exe'

# Tray: launches node directly.
$trayVbs = Join-Path $BinDir 'os-util-tray.vbs'
@"
' Launches the OS Util tray app hidden (no console window).
Set sh = CreateObject("WScript.Shell")
sh.Run "node ""$DistTray""", 0, False
"@ | Set-Content -Path $trayVbs -Encoding ascii
Write-Ok "Installed tray launcher: $trayVbs"

# Widget: launches the PowerShell overlay hidden.
$WidgetPs1 = Join-Path $ProjectDir 'os-util-widget.ps1'
$widgetVbs = Join-Path $BinDir 'os-util-widget.vbs'
@"
' Launches the OS Util desktop widget hidden (no console window).
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$WidgetPs1""", 0, False
"@ | Set-Content -Path $widgetVbs -Encoding ascii
Write-Ok "Installed widget launcher: $widgetVbs"

# --- Optional auto-start ---------------------------------------------------
$startup = [Environment]::GetFolderPath('Startup')
$trayIcon = Join-Path $ProjectDir 'assets\tray-icon.ico'

function New-StartupShortcut {
    param([string]$Name, [string]$Vbs, [string]$Description)
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut((Join-Path $startup $Name))
    $lnk.TargetPath       = $WScript
    $lnk.Arguments        = "`"$Vbs`""
    $lnk.WorkingDirectory = $ProjectDir
    $lnk.IconLocation     = $trayIcon
    $lnk.Description       = $Description
    $lnk.Save()
    Write-Ok "Auto-start enabled: $(Join-Path $startup $Name)"
}

$autoWidget = $AutoStartWidget
if (-not $AutoStartWidget) {
    $autoWidget = (Read-Host 'Start the desktop WIDGET automatically when you log in? (y/N)') -match '^[Yy]'
}
if ($autoWidget) { New-StartupShortcut 'OS Util Widget.lnk' $widgetVbs 'OS Util network speed widget' }

$autoTray = $AutoStart
if (-not $AutoStart) {
    $autoTray = (Read-Host 'Start the TRAY app automatically when you log in? (y/N)') -match '^[Yy]'
}
if ($autoTray) { New-StartupShortcut 'OS Util Tray.lnk' $trayVbs 'OS Util network speed tray' }

if (-not $autoWidget -and -not $autoTray) { Write-Info 'Auto-start not enabled.' }

Write-Ok 'Installation complete!'
Write-Info 'Usage:'
Write-Info "  - Widget: start now with  ->  wscript `"$widgetVbs`""
Write-Info "  - Tray:   start now with  ->  wscript `"$trayVbs`""
Write-Info '  - CLI:    os-util monitor        (continuous)'
Write-Info '  - CLI:    os-util monitor --once (one reading)'
Write-Info '  - CLI:    os-util modes          (list display modes)'

$launchNow = Read-Host 'Launch now? ([w]idget / [t]ray / [n]one)'
switch -Regex ($launchNow) {
    '^[Ww]' {
        Start-Process -FilePath $WScript -ArgumentList "`"$widgetVbs`""
        Write-Ok 'Widget launched - drag it anywhere; right-click for options.'
    }
    '^[Tt]' {
        Start-Process -FilePath $WScript -ArgumentList "`"$trayVbs`""
        Write-Ok 'Tray app launched - look for the up/down arrow icon in your taskbar tray.'
    }
    default { Write-Info 'Nothing launched. Use the commands above when ready.' }
}
