import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const REFRESH_TIME = 3;

let lastCount = 0, lastSpeed = 0, lastCountUp = 0;
let resetNextCount = false, resetCount = 0;

export default class NetSpeedExtension extends Extension {
    enable() {
        const PREFS_SCHEMA = 'org.gnome.shell.extensions.os-util';
        this._settings = this.getSettings(PREFS_SCHEMA);

        // 0: kbps 1: K/s 2: U:kbps D:kbps 3: U:K/s D:K/s 4: Total KB
        this.mode = this._settings.get_int('mode');
        this.fontmode = this._settings.get_int('fontmode');
        
        console.log(`NetSpeed Monitor enabled: mode ${this.mode}, fontmode ${this.fontmode}`);

        this.button = new St.Bin({
            style_class: 'panel-button',
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: false,
            track_hover: true
        });

        this.ioSpeed = new St.Label({
            text: 'Loading...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'netspeed-label'
        });

        this.button.set_child(this.chooseLabel());
        this.button.connect('button-press-event', this.changeMode.bind(this));

        // Add to panel
        Main.panel._rightBox.insert_child_at_index(this.button, 0);
        
        // Start monitoring
        this.timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, REFRESH_TIME, () => {
            return this.parseStat();
        });
    }

    disable() {
        if (this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = null;
        }
        
        if (this.button) {
            Main.panel._rightBox.remove_child(this.button);
            this.button.destroy();
            this.button = null;
        }
        
        this.ioSpeed = null;
        this._settings = null;
        
        console.log('NetSpeed Monitor disabled');
    }

    changeMode(_widget, event) {
        const button = event.get_button();
        console.log(`NetSpeed Monitor mode change: button ${button}`);
        
        if (button === 3 && this.mode === 4) { // Right click: reset downloaded sum
            resetNextCount = true;
            this.parseStat();
        }
        else if (button === 2) { // Middle click: change font
            this.fontmode++;
            if (this.fontmode > 4) {
                this.fontmode = 0;
            }
            this._settings.set_int('fontmode', this.fontmode);
            this.chooseLabel();
            this.parseStat();
        }
        else if (button === 1) { // Left click: change mode
            this.mode++;
            if (this.mode > 4) {
                this.mode = 0;
            }
            this._settings.set_int('mode', this.mode);
            this.chooseLabel();
            this.parseStat();
        }
        
        console.log(`NetSpeed Monitor: mode ${this.mode}, font ${this.fontmode}`);
    }

    chooseLabel() {
        let styleName;
        if (this.mode === 0 || this.mode === 1 || this.mode === 4) {
            styleName = 'netspeed-label';
        }
        else { // 2, 3
            styleName = 'netspeed-label-wide';
        }

        if (this.fontmode > 0) {
            styleName = styleName + '-' + this.fontmode;
        }

        this.ioSpeed.set_style_class_name(styleName);
        return this.ioSpeed;
    }

    parseStat() {
        try {
            const input_file = Gio.file_new_for_path('/proc/net/dev');
            const [, contents] = input_file.load_contents(null);
            const lines = new TextDecoder().decode(contents).split('\n');

            let count = 0;
            let countUp = 0;
            
            for (const line of lines) {
                const fields = line.trim().split(/\W+/);
                if (fields.length <= 2) break;

                // Filter out virtual and loopback interfaces
                if (fields[0] !== "lo" &&
                    !fields[0].match(/^ifb[0-9]+/) &&   // traffictoll bandwidth manager
                    !fields[0].match(/^lxdbr[0-9]+/) && // lxd container manager
                    !fields[0].match(/^virbr[0-9]+/) && // virtual bridge
                    !fields[0].match(/^br[0-9]+/) &&    // bridge
                    !fields[0].match(/^vnet[0-9]+/) &&  // virtual network
                    !fields[0].match(/^tun[0-9]+/) &&   // tunnel
                    !fields[0].match(/^tap[0-9]+/) &&   // tap device
                    !isNaN(parseInt(fields[1], 10))) {
                    
                    count = count + parseInt(fields[1], 10) + parseInt(fields[9], 10);
                    countUp = countUp + parseInt(fields[9], 10);
                }
            }

            if (lastCount === 0) lastCount = count;
            if (lastCountUp === 0) lastCountUp = countUp;

            let speed = (count - lastCount) / REFRESH_TIME;
            let speedUp = (countUp - lastCountUp) / REFRESH_TIME;

            // Activity indicator
            const dot = speed > lastSpeed ? "⇅" : "";

            if (this.mode >= 0 && this.mode <= 1) {
                this.ioSpeed.set_text(dot + this.speedToString(speed));
            }
            else if (this.mode >= 2 && this.mode <= 3) {
                this.ioSpeed.set_text("↓" + this.speedToString(speed - speedUp) + " ↑" + this.speedToString(speedUp));
            }
            else if (this.mode === 4) {
                if (resetNextCount === true) {
                    resetNextCount = false;
                    resetCount = count;
                }
                this.ioSpeed.set_text("∑ " + this.speedToString(count - resetCount));
            }

            lastCount = count;
            lastCountUp = countUp;
            lastSpeed = speed;
        } catch (e) {
            console.error('NetSpeed Monitor error:', e);
            this.ioSpeed.set_text('Error');
        }

        return GLib.SOURCE_CONTINUE;
    }

    speedToString(amount) {
        let digits;
        let speed_map = [];
        
        if (this.mode === 0 || this.mode === 2) {
            speed_map = ["bps", "Kbps", "Mbps", "Gbps"];
        }
        else if (this.mode === 1 || this.mode === 3) {
            speed_map = ["B/s", "K/s", "M/s", "G/s"];
        }
        else if (this.mode === 4) {
            speed_map = ["B", "KB", "MB", "GB"];
        }

        if (amount === 0) {
            return "0" + speed_map[0];
        }

        if (this.mode === 0 || this.mode === 2) {
            amount = amount * 8; // Convert to bits
        }

        let unit = 0;
        while (amount >= 1000 && unit < speed_map.length - 1) {
            amount /= 1000;
            ++unit;
        }

        if (amount >= 100) {
            digits = 0; // 100MB, 100KB, 200KB
        } else if (amount >= 10) {
            digits = 1; // 10MB, 10.2KB
        } else {
            digits = 2; // 1.23MB
        }

        return String(amount.toFixed(digits)) + speed_map[unit];
    }
}