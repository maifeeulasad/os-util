# OS Util

A comprehensive collection of **system utility tools** for Linux, featuring a **GNOME Shell extension** for the system panel and **Node.js CLI applications**. Currently includes network speed monitoring with plans for additional system utilities.

## 🚀 Current Features

### Network Speed Monitor
- **GNOME Shell Extension** - Shows network speed in your top panel
- **Real-time monitoring** with 3-second refresh intervals
- **5 display modes** with easy switching:
  1. Total net speed in bits per second (bps, Kbps, Mbps, Gbps)
  2. Total net speed in Bytes per second (B/s, K/s, M/s, G/s)
  3. Up & down speed in bits per second (↓Mbps ↑Kbps)
  4. Up & down speed in Bytes per second (↓M/s ↑K/s)
  5. Total downloaded in Bytes with reset capability (∑ MB)
- **Interactive controls**:
  - Left click: Change display modes
  - Middle click: Change font size (5 sizes)
  - Right click: Reset total counter (mode 4)
- **Activity indicators** (⇅ symbol when speed increases)
- **Persistent settings** using GSettings

### CLI Application
- **Cross-platform compatibility** (Linux, macOS, Windows with WSL)
- **Same display modes** as the GNOME extension
- **Customizable refresh intervals**
- **Configuration management** using JSON files
- **TypeScript** implementation with full type safety

## 📦 Installation

### Prerequisites
- **Node.js** 18+ (for CLI application)
- **pnpm** (for package management)
- **GNOME Shell** 46+ (for GNOME extension)

### Install GNOME Extension (Recommended)

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
   ````

### Install CLI Only

If you only want the command-line version:

```bash
# Install dependencies and build
pnpm install
pnpm run build

# Create executable
mkdir -p ~/.local/bin
cat > ~/.local/bin/netspeed << 'EOF'
cat > ~/.local/bin/os-util << 'EOF'
#!/bin/bash
exec node "/path/to/os-util/dist/cli.js" "$@"
EOF
chmod +x ~/.local/bin/os-util
EOF
chmod +x ~/.local/bin/netspeed
```

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
# Monitor with specific mode (0-4)
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

### GNOME Extension (Panel Integration)

After installation, the extension will appear in your GNOME top panel between the time and system buttons. Interact with it using:

- **Left click**: Cycle through display modes (0-4)
- **Middle click**: Change font size (5 different sizes)
- **Right click**: Reset total download counter (only in mode 4)

The extension will show network speed like: `12.5Mbps`, `↓10.2Mbps ↑2.3Mbps`, or `∑ 1.2GB`

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
  "mode": 0,
  "fontMode": 0,
  "refreshInterval": 3
}
```

## 🛠️ Development

### Project Structure
```
/
├── src/                    # TypeScript source files
│   ├── NetworkMonitor.ts   # Core network statistics parsing
│   ├── SpeedFormatter.ts   # Display formatting and modes
│   ├── ConfigManager.ts    # Configuration management
│   ├── cli.ts             # Command-line interface
│   └── index.ts           # Library exports
├── dist/                  # Compiled JavaScript
├── extension.js           # GNOME Shell extension
├── metadata.json          # Extension metadata
├── stylesheet.css         # Extension styling
├── schemas/               # GSettings schemas
├── package.json           # Node.js project config
├── tsconfig.json          # TypeScript config
├── os-util-install.sh  # Installation script
├── os-util-remove.sh   # Removal script
└── README.md              # This file
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
Both the CLI and GNOME extension filter out virtual and loopback interfaces:
- `lo` - Loopback interface
- `ifb*` - Intermediate Functional Block (traffic shaping)
- `lxdbr*` - LXD bridge interfaces
- `virbr*` - Virtual bridge interfaces
- `br*` - Bridge interfaces
- `vnet*` - Virtual network interfaces
- `tun*` - Tunnel interfaces
- `tap*` - TAP interfaces

### Data Source
The application reads network statistics from `/proc/net/dev`, parsing:
- **RX bytes** (received/download)
- **TX bytes** (transmitted/upload)
- **Interface names** for filtering

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

| Feature | CLI Application | Original GNOME Extension |
|---------|----------------|--------------------------|
| Real-time monitoring | ✅ | ✅ |
| 5 display modes | ✅ | ✅ |
| Activity indicators | ✅ | ✅ |
| Font size options | ⚪ Config only | ✅ Interactive |
| Reset total counter | ✅ Command | ✅ Right-click |
| Persistent settings | ✅ JSON | ✅ GSettings |
| System integration | ⚪ Terminal | ✅ Top panel |
| Cross-platform | ✅ | ⚪ Linux only |
| Installation method | ✅ Script | ⚪ Manual or extensions.gnome.org |

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

- Original [Simple Net Speed](https://github.com/biji/simplenetspeed) GNOME extension by biji
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