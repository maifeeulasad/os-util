# OS Util

A **cross-platform** collection of **system utility tools**, featuring a **GNOME Shell extension** for the Linux panel, a **Windows desktop widget** and **system-tray app** for the taskbar, and **Node.js CLI applications**. Currently includes network speed monitoring with plans for additional system utilities.

## 🧱 Architecture

The monitoring core is platform-agnostic and shared by every frontend. Only the acquisition of raw OS byte counters differs per platform, isolated behind a small `NetworkStatsProvider` strategy (Dependency Inversion):

```
                    ┌────────────────────────────────────────┐
  Frontends         │ GNOME ext · Windows tray · Widget · CLI │
                    └────────────────────┬───────────────────┘
  Shared core        NetworkMonitor · SpeedFormatter · ConfigManager
                                     │
  Platform strategy        NetworkStatsProvider (interface)
                          /                         \
            LinuxNetworkStatsProvider      WindowsNetworkStatsProvider
              (/proc/net/dev)               (Get-NetAdapterStatistics)
```

Adding another OS means adding one provider and one factory case; the rest of the code is untouched.

## 🚀 Current Features

### Network Speed Monitor
- **GNOME Shell Extension** (Linux) - Shows network speed in your top panel
- **Windows System-Tray App** - The taskbar equivalent: live speed in the tray tooltip and menu
- **Real-time monitoring** with 3-second refresh intervals
- **6 display modes** with easy switching:
  1. Total net speed in bits per second (bps, Kbps, Mbps, Gbps)
  2. Total net speed in Bytes per second (B/s, K/s, M/s, G/s)
  3. Up & down speed in bits per second (↓Mbps ↑Kbps)
  4. Up & down speed in Bytes per second (↓M/s ↑K/s)
  5. Total downloaded in Bytes with reset capability (∑ MB)
  6. **Up speed, down speed, and total** (↓M/s ↑K/s ∑2.1M/s) **[DEFAULT]**
- **Interactive controls**:
  - Left click: Change display modes
  - Middle click: Change font size (5 sizes)
  - Right click: Reset total counter (mode 5)
- **Activity indicators** (⇅ symbol when speed increases)
- **Persistent settings** using GSettings

### Windows Desktop Widget (always-on-top overlay)
- **Floating, always-visible readout** - shows the full speed line without opening any menu
- **Drag it anywhere** (dock it by the taskbar, a screen edge, wherever) - position is remembered
- **Frameless and unobtrusive**, stays on top, right-click to reset position or close
- **Optional auto-start** at login, launched console-less
- A thin *view*: it runs the shared core as a `monitor --out` feed, so the TS core stays the single source of truth

### Windows System-Tray App
- **Native Windows taskbar integration** - appears in the system tray (notification area)
- **Live readout** in the tray tooltip (hover) and in the menu (click the top line to refresh)
- **Menu controls**: cycle display mode, cycle refresh interval, reset the total counter, quit
- **Optional auto-start** at login, installed as a console-less background app
- Reuses the exact same monitoring core as the CLI and GNOME extension

### CLI Application
- **Cross-platform compatibility** - runs natively on Linux and Windows (no WSL needed), plus macOS/WSL
- **Same display modes** as the GNOME extension
- **Customizable refresh intervals**
- **Configuration management** using JSON files
- **TypeScript** implementation with full type safety

## 📦 Installation

### Prerequisites
- **Node.js** 18+ (for CLI and Windows tray app)
- **pnpm** (for package management; npm also works)
- **GNOME Shell** 46+ (Linux extension only)
- **Windows 10/11** with PowerShell (Windows tray app only — uses the built-in `Get-NetAdapterStatistics` cmdlet)

### Install on Windows (Widget + Tray + CLI)

From the project folder in PowerShell:

```powershell
# Builds the project, installs the `os-util` CLI on your PATH, and sets up
# the desktop widget and system-tray app (prompts for auto-start + launch).
./os-util-install.ps1
```

Launch the **desktop widget** (the always-on-top floating readout) any time:

```powershell
wscript "$env:LOCALAPPDATA\os-util\bin\os-util-widget.vbs"
```

Or the **system-tray** app:

```powershell
wscript "$env:LOCALAPPDATA\os-util\bin\os-util-tray.vbs"
```

To uninstall:

```powershell
./os-util-remove.ps1               # keep config
./os-util-remove.ps1 -PurgeConfig  # also remove ~/.config/os-util
```

Non-interactive flags: `-AutoStartWidget` and `-AutoStart` (enable login start for the widget / tray without prompting) and `-NoCli` (skip the PATH shim).

### Install GNOME Extension (Linux, Recommended)

1. **Run the installation script:**
   ```bash
   ./os-util-install.sh
   ```

2. **The script will:**
   - Install the GNOME Shell extension to your panel
   - Compile and install GSettings schemas
   - Optionally install the CLI version as well
   - Attempt to enable the extension automatically

3. **Manual activation (if needed):**
   ```bash
   # Restart GNOME Shell first
   # Press Alt+F2, type 'r', press Enter
   
   # Then enable the extension
   gnome-extensions enable os-util@maifee.extension
   
   # Or use GNOME Extensions app
   ```

### Install CLI Only

If you only want the command-line version:

```bash
# Install dependencies and build
pnpm install
pnpm run build

# Create an executable launcher (adjust the path to this project)
mkdir -p ~/.local/bin
cat > ~/.local/bin/os-util << 'EOF'
#!/bin/bash
exec node "/path/to/os-util/dist/cli.js" "$@"
EOF
chmod +x ~/.local/bin/os-util
```

On Windows, use `./os-util-install.ps1` instead (see [Install on Windows](#install-on-windows-tray-app--cli)).

## 🖥️ Usage

### CLI Application

#### Basic Usage
```bash
# Start monitoring with default settings
os-util

# Or explicitly use the monitor command
os-util monitor
```

#### Advanced Usage
```bash
# Monitor with specific mode (0-5)
os-util monitor --mode 2 --interval 5

# Show speed once and exit
os-util monitor --once

# List all available modes
os-util modes

# Configure settings
os-util config --mode 1 --interval 3
os-util config --show

# Reset total download counter
os-util reset
```

#### Display Modes
- **Mode 0**: `12.5Mbps` - Total speed in bits per second
- **Mode 1**: `1.56M/s` - Total speed in Bytes per second  
- **Mode 2**: `↓10.2Mbps ↑2.3Mbps` - Up/down in bits per second
- **Mode 3**: `↓1.28M/s ↑288K/s` - Up/down in Bytes per second
- **Mode 4**: `∑ 1.2GB` - Total downloaded (right-click to reset in GNOME)
- **Mode 5**: `↓1.28M/s ↑288K/s ∑1.57M/s` - Up speed, down speed, and total **[DEFAULT]**

### Windows Desktop Widget

The widget is a small frameless overlay that floats on top of your other windows and shows the full reading continuously:

- **Drag** it with the left mouse button to position it (e.g. just above the taskbar clock); the spot is remembered across restarts
- **Right-click** for a menu: **Reset position** (back to top-right) or **Close widget**
- It shows the current display mode's text (e.g. `↓1.28M/s ↑288K/s ∑1.57M/s`) and updates on the configured interval
- Change the display mode / interval from the tray app or the CLI (`os-util config --mode 3`); the widget reflects it

Run it directly during development with `pnpm run build` then `powershell -File os-util-widget.ps1`.

### Windows System-Tray App

After installation the app lives in the taskbar tray (notification area), shown as an up/down arrow icon:

- **Hover** the icon: the tooltip shows the current speed (e.g. `OS Util — ↓1.28M/s ↑288K/s ∑1.57M/s`)
- **Click** the icon to open the menu:
  - The top line shows the live speed
  - **Mode: …** - cycle through the 6 display modes
  - **Interval: Ns** - cycle the refresh interval (1 / 2 / 3 / 5 / 10 s)
  - **Reset total counter** - reset the `∑` downloaded total (mode 4)
  - **Quit** - exit the app

Run it directly during development with `pnpm run tray` (after `pnpm run build`).

### GNOME Extension (Panel Integration)

After installation, the extension will appear in your GNOME top panel between the time and system buttons. Interact with it using:

- **Left click**: Cycle through display modes (0-5)
- **Middle click**: Change font size (5 different sizes)
- **Right click**: Reset total download counter (only in mode 4)

The extension will show network speed like: `↓1.28M/s ↑288K/s ∑1.57M/s`, `12.5Mbps`, `↓10.2Mbps ↑2.3Mbps`, or `∑ 1.2GB`

### CLI Application

For command-line usage:

```bash
# Start continuous monitoring
os-util

# Check speed once
os-util monitor --once

# Change modes 
os-util config --mode 2

# View all modes
os-util modes
```

### Configuration

The CLI application stores configuration in `~/.config/os-util/config.json`:

```json
{
  "mode": 5,
  "fontMode": 0,
  "refreshInterval": 3
}
```

## 🛠️ Development

### Project Structure
```
/
├── src/                        # TypeScript source files
│   ├── NetworkMonitor.ts       # Speed calculation (delegates reads to a provider)
│   ├── SpeedFormatter.ts       # Display formatting and modes
│   ├── ConfigManager.ts        # Configuration management
│   ├── providers/              # Platform strategy for reading raw byte counters
│   │   ├── NetworkStatsProvider.ts        # Interface
│   │   ├── LinuxNetworkStatsProvider.ts   # /proc/net/dev
│   │   ├── WindowsNetworkStatsProvider.ts # Get-NetAdapterStatistics (PowerShell)
│   │   └── index.ts                       # createNetworkStatsProvider() factory
│   ├── tray/                   # Windows system-tray frontend
│   │   ├── TrayApp.ts          # Tray app (reuses the shared core)
│   │   └── index.ts            # Tray entry point
│   ├── cli.ts                  # Command-line interface (incl. --out widget feed)
│   └── index.ts                # Library exports
├── assets/tray-icon.ico        # Generated tray icon
├── scripts/generate-tray-icon.mjs  # Tray icon generator
├── dist/                       # Compiled JavaScript
├── extension.js                # GNOME Shell extension (Linux)
├── metadata.json               # Extension metadata
├── stylesheet.css              # Extension styling
├── schemas/                    # GSettings schemas
├── package.json                # Node.js project config
├── tsconfig.json               # TypeScript config
├── os-util-widget.ps1          # Windows desktop widget (overlay view)
├── os-util-install.sh / .ps1   # Installation scripts (Linux / Windows)
├── os-util-remove.sh / .ps1    # Removal scripts (Linux / Windows)
└── README.md                   # This file
```

### Build Commands
```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Development mode (watch)
pnpm run dev

# Clean build directory
pnpm run clean

# Run from source
node dist/cli.js
```

### Testing the CLI
```bash
# Build and test
pnpm run build
node dist/cli.js monitor --once

# Test different modes
node dist/cli.js monitor --mode 2 --once
node dist/cli.js modes
node dist/cli.js config --show
```

## 🔧 Technical Details

### Network Interface Filtering
Virtual and loopback interfaces are excluded so only real traffic is counted.

**Linux** (`LinuxNetworkStatsProvider`) filters by name, matching the original extension:
- `lo` - Loopback interface
- `ifb*` - Intermediate Functional Block (traffic shaping)
- `lxdbr*` - LXD bridge interfaces
- `virbr*` - Virtual bridge interfaces
- `br*` - Bridge interfaces
- `vnet*` - Virtual network interfaces
- `tun*` - Tunnel interfaces
- `tap*` - TAP interfaces

**Windows** (`WindowsNetworkStatsProvider`) restricts to adapters that are **physical** and **up**, which naturally excludes loopback, disconnected, VPN, Hyper-V, WSL and bridge adapters.

### Data Source
Each platform provides raw cumulative **RX bytes** (download) and **TX bytes** (upload), summed across the relevant interfaces:
- **Linux**: reads `/proc/net/dev`
- **Windows**: queries PowerShell's `Get-NetAdapterStatistics` (filtered by `Get-NetAdapter -Physical`)

The shared `NetworkMonitor` then computes speed from the deltas, so the calculation and formatting are identical on every platform.

### Speed Calculation
Speed is calculated as: `(current_bytes - previous_bytes) / time_interval`

### Unit Conversion
- **Bits mode**: Multiplies by 8 for bit-based units
- **Scaling**: Uses 1000-based scaling (1MB = 1000KB)
- **Precision**: Adaptive decimal places based on magnitude

## 🗑️ Uninstallation

### Remove CLI Application
```bash
./os-util-remove.sh
```

The removal script will:
- Remove the installed executable and symlinks
- Optionally remove configuration files
- Provide cleanup verification

## 🆚 Feature Comparison

| Feature | CLI | GNOME Extension | Windows Tray | Windows Widget |
|---------|-----|-----------------|--------------|----------------|
| Real-time monitoring | ✅ | ✅ | ✅ | ✅ |
| 6 display modes | ✅ | ✅ | ✅ | ✅ |
| Always-visible readout | ⚪ Terminal | ✅ Panel | ⚪ Hover/menu | ✅ Floating overlay |
| Reset total counter | ✅ Command | ✅ Right-click | ✅ Menu | ⚪ |
| Change mode / interval | ✅ Command | ✅ Click | ✅ Menu | ⚪ Via tray/CLI |
| Draggable positioning | ⚪ | ⚪ | ⚪ | ✅ |
| Persistent settings | ✅ JSON | ✅ GSettings | ✅ JSON | ✅ JSON |
| Auto-start at login | ⚪ | ✅ | ✅ | ✅ |
| Platform | Linux / Windows / macOS | Linux | Windows | Windows |

## 🐛 Troubleshooting

### CLI Application Issues

**Permission denied reading /proc/net/dev**
```bash
# Check file permissions
ls -la /proc/net/dev
# Should be readable by all users
```

**Command not found after installation**
```bash
# Check if ~/.local/bin is in PATH
echo $PATH | grep -q "$HOME/.local/bin" || echo "~/.local/bin not in PATH"

# Add to PATH if needed
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Module not found errors**
```bash
# Ensure TypeScript compilation completed
pnpm run build
# Check for dist/ directory and .js files
```

**Configuration not persisting**
```bash
# Check config directory permissions
ls -la ~/.config/os-util/
# Ensure user has write access
```

**Installation fails with pnpm errors**
```bash
# Update pnpm
npm install -g pnpm@latest

# Clear pnpm cache
pnpm store prune

# Try installation again
./install-netspeed-monitor.sh
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original [Simple Net Speed](https://github.com/biji/simplenetspeed) GNOME extension by biji — the Linux `/proc/net/dev` parsing and interface filtering are ported from it
- [`systray2`](https://github.com/felixhao28/node-systray) by felixhao28 et al. — powers the Windows system-tray app
- Microsoft's [`Get-NetAdapterStatistics`](https://learn.microsoft.com/powershell/module/netadapter/get-netadapterstatistics) cmdlet — the Windows byte-counter data source
- GNOME Shell Extensions documentation and community
- Node.js and TypeScript communities

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature X"`
5. Push and create a Pull Request

---

**Enjoy monitoring your network speed! 🚀**