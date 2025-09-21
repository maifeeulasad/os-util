#!/bin/bash

# os-util-remove.sh
# Remove the OS Util GNOME extension

set -e

# Configuration
EXTENSION_UUID="os-util@maifee.extension"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
SCHEMA_DIR="$HOME/.local/share/glib-2.0/schemas"
SCHEMA_FILE="$SCHEMA_DIR/org.gnome.shell.extensions.os-util.gschema.xml"
CLI_BINARY="$HOME/.local/bin/os-util"

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

print_info "Removing OS Util GNOME extension..."

# Check if extension is currently enabled and disable it
if command -v gnome-extensions &> /dev/null; then
    if gnome-extensions list --enabled | grep -q "$EXTENSION_UUID"; then
        print_info "Disabling extension..."
        if gnome-extensions disable "$EXTENSION_UUID" 2>/dev/null; then
            print_success "Extension disabled successfully!"
        else
            print_warning "Could not disable extension automatically."
        fi
    else
        print_info "Extension is not currently enabled."
    fi
else
    print_info "gnome-extensions command not found. Extension state unknown."
fi

# Remove extension directory
if [ -d "$EXTENSION_DIR" ]; then
    print_info "Removing extension directory: $EXTENSION_DIR"
    rm -rf "$EXTENSION_DIR"
    print_success "Extension directory removed."
else
    print_info "Extension directory not found: $EXTENSION_DIR"
fi

# Remove schema file
if [ -f "$SCHEMA_FILE" ]; then
    print_info "Removing schema file: $SCHEMA_FILE"
    rm -f "$SCHEMA_FILE"
    print_success "Schema file removed."
else
    print_info "Schema file not found: $SCHEMA_FILE"
fi

# Recompile schemas if glib-compile-schemas is available
if command -v glib-compile-schemas &> /dev/null; then
    if [ -d "$SCHEMA_DIR" ]; then
        print_info "Recompiling schemas..."
        glib-compile-schemas "$SCHEMA_DIR"
        print_success "Schemas recompiled."
    fi
else
    print_warning "glib-compile-schemas not found. You may need to recompile schemas manually."
fi

# Clean up any cached extension data
CACHE_DIR="$HOME/.cache/gnome-shell/extensions"
if [ -d "$CACHE_DIR" ]; then
    print_info "Clearing extension cache..."
    rm -rf "$CACHE_DIR/$EXTENSION_UUID" 2>/dev/null || true
fi

# Remove any dconf settings (user preferences)
if command -v dconf &> /dev/null; then
    DCONF_PATH="/org/gnome/shell/extensions/os-util/"
    if dconf list "$DCONF_PATH" &>/dev/null 2>&1; then
        print_info "Removing extension settings..."
        dconf reset -f "$DCONF_PATH" 2>/dev/null || true
        print_success "Extension settings removed."
    fi
else
    print_info "dconf command not found. Extension settings may remain."
fi

# Also remove CLI if it exists
if [ -f "$CLI_BINARY" ]; then
    read -p "Do you also want to remove the CLI version? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removing CLI version..."
        rm -f "$CLI_BINARY"
        
        # Remove CLI config if user wants
        if [ -d "$HOME/.config/os-util" ]; then
            read -p "Remove CLI configuration files too? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf "$HOME/.config/os-util"
                print_success "CLI configuration removed."
            fi
        fi
        
        print_success "CLI version removed."
    fi
fi

print_success "Extension removal complete!"

# Check if GNOME Shell is running
if pgrep -x "gnome-shell" > /dev/null; then
    print_info "To complete the removal, you may want to:"
    print_info "1. Restart GNOME Shell (Alt+F2, type 'r', press Enter) or"
    print_info "2. Log out and log back in"
else
    print_info "GNOME Shell is not running. Changes will take effect when it starts."
fi

# Verify removal
if [ ! -d "$EXTENSION_DIR" ] && [ ! -f "$SCHEMA_FILE" ]; then
    print_success "OS Util extension has been completely removed!"
else
    print_warning "Some extension files may still remain. Manual cleanup might be needed."
fi