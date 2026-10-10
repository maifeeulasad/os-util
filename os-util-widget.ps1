<#
.SYNOPSIS
    Always-on-top floating desktop widget that shows the live network speed.

.DESCRIPTION
    A frameless, draggable overlay you can park anywhere on screen so the
    reading is always visible without opening the tray menu.

    This is a thin *view*: the TypeScript core remains the single source of
    truth. The widget launches `node dist/cli.js monitor --out <feed> --quiet`
    (the model), which writes the latest reading to a small file every tick,
    and the overlay polls that file and renders it. Drag to move; the position
    is remembered. Right-click for options.
#>

[CmdletBinding()]
param(
    # Refresh interval override (seconds) passed to the feed.
    [int]$Interval = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# --- Paths -----------------------------------------------------------------
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Cli        = Join-Path $ProjectDir 'dist\cli.js'
$node       = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { [System.Windows.Forms.MessageBox]::Show('Node.js was not found on PATH.', 'OS Util'); exit 1 }
if (-not (Test-Path $Cli)) { [System.Windows.Forms.MessageBox]::Show("Build missing: $Cli`nRun: pnpm run build", 'OS Util'); exit 1 }

$StateDir = Join-Path $env:LOCALAPPDATA 'os-util'
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
$Feed    = Join-Path $StateDir 'speed.txt'
$PosFile = Join-Path $StateDir 'widget-pos.json'

# --- Start the model (node feed) as a hidden child -------------------------
$feedArgs = "`"$Cli`" monitor --out `"$Feed`" --quiet"
if ($Interval -gt 0) { $feedArgs += " --interval $Interval" }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName        = $node.Source
$psi.Arguments       = $feedArgs
$psi.UseShellExecute = $false
$psi.CreateNoWindow  = $true
$psi.WindowStyle     = 'Hidden'
$script:feedProc = [System.Diagnostics.Process]::Start($psi)

# --- Build the overlay window ----------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.TopMost         = $true
$form.ShowInTaskbar   = $false
$form.StartPosition   = 'Manual'
$form.BackColor       = [System.Drawing.Color]::FromArgb(18, 18, 24)
$form.Opacity         = 0.88
$form.Padding         = New-Object System.Windows.Forms.Padding(10, 6, 10, 6)
$form.AutoSize        = $true
$form.AutoSizeMode    = 'GrowAndShrink'

$label = New-Object System.Windows.Forms.Label
$label.AutoSize   = $true
$label.ForeColor  = [System.Drawing.Color]::White
$label.Font       = New-Object System.Drawing.Font('Segoe UI Semibold', 12, [System.Drawing.FontStyle]::Bold)
$label.Text       = 'OS Util  starting...'
$form.Controls.Add($label)

# --- Restore saved position (default: top-right) ---------------------------
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$pos = $null
if (Test-Path $PosFile) {
    try { $pos = Get-Content $PosFile -Raw | ConvertFrom-Json } catch { $pos = $null }
}
if ($pos -and $null -ne $pos.x -and $null -ne $pos.y) {
    $form.Location = New-Object System.Drawing.Point([int]$pos.x, [int]$pos.y)
} else {
    $form.Location = New-Object System.Drawing.Point(($screen.Right - 220), ($screen.Top + 12))
}

function Save-Position {
    try {
        @{ x = $form.Location.X; y = $form.Location.Y } | ConvertTo-Json -Compress |
            Set-Content -Path $PosFile -Encoding ascii
    } catch { }
}

# Keep the window inside the working area after it auto-sizes.
$form.Add_Shown({
    if ($form.Right -gt $screen.Right) { $form.Left = $screen.Right - $form.Width }
    if ($form.Bottom -gt $screen.Bottom) { $form.Top = $screen.Bottom - $form.Height }
})

# --- Dragging (works from the form or the label) ---------------------------
$script:dragging = $false
$script:startCursor = New-Object System.Drawing.Point
$script:startForm   = New-Object System.Drawing.Point

$down = {
    if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $script:dragging    = $true
        $script:startCursor = [System.Windows.Forms.Cursor]::Position
        $script:startForm   = $form.Location
    }
}
$move = {
    if ($script:dragging) {
        $cur = [System.Windows.Forms.Cursor]::Position
        $form.Location = New-Object System.Drawing.Point(
            ($script:startForm.X + $cur.X - $script:startCursor.X),
            ($script:startForm.Y + $cur.Y - $script:startCursor.Y))
    }
}
$up = {
    if ($script:dragging) { $script:dragging = $false; Save-Position }
}
$form.Add_MouseDown($down);  $label.Add_MouseDown($down)
$form.Add_MouseMove($move);  $label.Add_MouseMove($move)
$form.Add_MouseUp($up);      $label.Add_MouseUp($up)

# --- Right-click menu ------------------------------------------------------
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$miReset = $menu.Items.Add('Reset position (top-right)')
$miReset.Add_Click({
    $form.Location = New-Object System.Drawing.Point(($screen.Right - 220), ($screen.Top + 12))
    Save-Position
})
$miClose = $menu.Items.Add('Close widget')
$miClose.Add_Click({ $form.Close() })
$form.ContextMenuStrip  = $menu
$label.ContextMenuStrip = $menu

# --- Poll the feed and update the label ------------------------------------
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 500
$timer.Add_Tick({
    # Stop if the model process died.
    if ($script:feedProc.HasExited) { $form.Close(); return }
    if (Test-Path $Feed) {
        try {
            $text = [System.IO.File]::ReadAllText($Feed, [System.Text.Encoding]::UTF8)
            if ($text -and $label.Text -ne $text) { $label.Text = $text }
        } catch { }
    }
})
$timer.Start()

# --- Cleanup on close ------------------------------------------------------
$form.Add_FormClosing({
    Save-Position
    $timer.Stop()
    try { if (-not $script:feedProc.HasExited) { $script:feedProc.Kill() } } catch { }
})

[System.Windows.Forms.Application]::Run($form)
