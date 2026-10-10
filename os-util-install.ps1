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

# --- Tray launcher (runs node without a console window) --------------------
$vbsPath = Join-Path $BinDir 'os-util-tray.vbs'
@"
' Launches the OS Util tray app hidden (no console window).
Set sh = CreateObject("WScript.Shell")
sh.Run "node ""$DistTray""", 0, False
"@ | Set-Content -Path $vbsPath -Encoding ascii
Write-Ok "Installed tray launcher: $vbsPath"

# --- Optional auto-start ---------------------------------------------------
$startup = [Environment]::GetFolderPath('Startup')
$lnkPath = Join-Path $startup 'OS Util Tray.lnk'

$enableAuto = $AutoStart
if (-not $AutoStart) {
    $answer = Read-Host 'Start the tray automatically when you log in? (y/N)'
    $enableAuto = $answer -match '^[Yy]'
}
if ($enableAuto) {
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($lnkPath)
    $lnk.TargetPath = Join-Path $env:SystemRoot 'System32\wscript.exe'
    $lnk.Arguments  = "`"$vbsPath`""
    $lnk.WorkingDirectory = $ProjectDir
    $lnk.IconLocation = Join-Path $ProjectDir 'assets\tray-icon.ico'
    $lnk.Description = 'OS Util network speed tray'
    $lnk.Save()
    Write-Ok "Auto-start enabled: $lnkPath"
} else {
    Write-Info 'Auto-start not enabled.'
}

Write-Ok 'Installation complete!'
Write-Info 'Usage:'
Write-Info "  - Tray:  start now with  ->  wscript `"$vbsPath`""
Write-Info '  - CLI:   os-util monitor        (continuous)'
Write-Info '  - CLI:   os-util monitor --once (one reading)'
Write-Info '  - CLI:   os-util modes          (list display modes)'

$launchNow = Read-Host 'Launch the tray app now? (y/N)'
if ($launchNow -match '^[Yy]') {
    Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\wscript.exe') -ArgumentList "`"$vbsPath`""
    Write-Ok 'Tray app launched - look for the up/down arrow icon in your taskbar tray.'
}
