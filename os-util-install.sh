#!/bin/bash

# os-util-install.sh
# Install the OS Util GNOME extension

set -e

# Configuration
EXTENSION_UUID="os-util@maifee.extension"
EXTENSIOprint_success "Installation complete!"
print_info "The extension will show network speed in your top panel."
print_info "Usage:"
print_info " -  Left click: Change display modes (bps, B/s, up/down, total)"
print_info " -  Middle click: Change font size"
print_info " -  Right click: Reset total counter (mode 4)""$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
SCHEMA_DIR="$HOME/.local/share/glib-2.0/schemas"
SOURCE_DIR="$(dirname "$0")"
CLI_SOURCE_DIR="$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    print_error "Source directory not found: $SOURCE_DIR"
    print_info "Please make sure the project files exist in the same location as this script."
    exit 1
fi

# Check if GNOME Shell is running
if ! pgrep -x "gnome-shell" > /dev/null; then
    print_warning "GNOME Shell is not running. The extension will be installed but not activated."
fi

# Check for required tools
for tool in glib-compile-schemas; do
    if ! command -v $tool &> /dev/null; then
        print_error "$tool is required but not installed."
        print_info "Please install it using:"
        print_info "  Ubuntu/Debian: sudo apt install libglib2.0-dev-bin"
        print_info "  Fedora: sudo dnf install glib2-devel"
        print_info "  Arch: sudo pacman -S glib2"
        exit 1
    fi
done

print_info "Installing OS Util GNOME extension..."

# Create extension directory
print_info "Creating extension directory: $EXTENSION_DIR"
mkdir -p "$EXTENSION_DIR"

# Copy extension files
print_info "Copying extension files..."
cp "$SOURCE_DIR/extension.js" "$EXTENSION_DIR/"
cp "$SOURCE_DIR/metadata.json" "$EXTENSION_DIR/"
cp "$SOURCE_DIR/stylesheet.css" "$EXTENSION_DIR/"

# Create schemas directory if it doesn't exist
print_info "Setting up schemas..."
mkdir -p "$SCHEMA_DIR"

# Copy schema file
cp "$SOURCE_DIR/schemas/org.gnome.shell.extensions.os-util.gschema.xml" "$SCHEMA_DIR/"

# Compile schemas
print_info "Compiling schemas..."
glib-compile-schemas "$SCHEMA_DIR"

# Set proper permissions
chmod 644 "$EXTENSION_DIR"/*
chmod 644 "$SCHEMA_DIR/org.gnome.shell.extensions.os-util.gschema.xml"

print_success "GNOME extension installed successfully!"

# Check GNOME Shell version compatibility
if command -v gnome-shell &> /dev/null; then
    GNOME_VERSION=$(gnome-shell --version | grep -oE '[0-9]+' | head -1)
    print_info "Detected GNOME Shell version: $GNOME_VERSION"
    
    if [ "$GNOME_VERSION" -lt 45 ]; then
        print_warning "Your GNOME Shell version ($GNOME_VERSION) might not be compatible with this extension (requires 45+)"
    fi
fi

# Try to enable the extension automatically
if command -v gnome-extensions &> /dev/null; then
    print_info "Attempting to enable extension automatically..."
    if gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null; then
        print_success "Extension enabled successfully!"
        print_info "The network speed monitor should now appear in your top panel."
    else
        print_warning "Could not enable extension automatically. Please enable it manually."
        print_info "To enable manually:"
        print_info "1. Restart GNOME Shell (Alt+F2, type 'r', press Enter)"
        print_info "2. Use: gnome-extensions enable $EXTENSION_UUID"
        print_info "3. Or use GNOME Extensions app"
    fi
else
    print_info "gnome-extensions command not found."
    print_info "To enable the extension:"
    print_info "1. Restart GNOME Shell (Alt+F2, type 'r', press Enter)"
    print_info "2. Enable via GNOME Extensions app or Settings"
fi

# Also install CLI if requested
if [ -d "$CLI_SOURCE_DIR" ]; then
    read -p "Do you also want to install the CLI version? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Installing CLI version..."
        
        # Check for Node.js and pnpm
        if command -v node &> /dev/null && command -v pnpm &> /dev/null; then
            cd "$CLI_SOURCE_DIR"
            pnpm install >/dev/null 2>&1
            pnpm run build >/dev/null 2>&1
            
            mkdir -p "$HOME/.local/bin"
            cat > "$HOME/.local/bin/os-util" << 'EOF'
#!/bin/bash
exec node "$(dirname "$0")/../../../codes/os-util/dist/cli.js" "$@"
EOF
            chmod +x "$HOME/.local/bin/os-util"
            print_success "CLI version also installed! Use 'os-util' command."
        else
            print_warning "Node.js or pnpm not found. CLI installation skipped."
        fi
    fi
fi

print_success "Installation complete!"
print_info "The extension will show network speed in your top panel between the time and system buttons."
print_info "Usage:"
print_info " -  Left click: Change display modes (bps, B/s, up/down, total)"
print_info " -  Middle click: Change font size"
print_info " -  Right click: Reset total counter (mode 4 only)"