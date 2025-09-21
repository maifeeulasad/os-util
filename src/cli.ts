#!/usr/bin/env node

import { Command } from 'commander';
import { NetworkMonitor } from './NetworkMonitor.js';
import { SpeedFormatter, DisplayMode } from './SpeedFormatter.js';
import { ConfigManager } from './ConfigManager.js';

class NetSpeedCLI {
  private monitor: NetworkMonitor;
  private formatter: SpeedFormatter;
  private config: ConfigManager;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.monitor = new NetworkMonitor();
    this.formatter = new SpeedFormatter();
    this.config = new ConfigManager();
  }

  /**
   * Start continuous monitoring
   */
  public startMonitoring(options: { mode?: DisplayMode; interval?: number; once?: boolean }): void {
    if (this.isRunning) {
      console.log('Monitoring is already running. Use --stop to stop it first.');
      return;
    }

    const mode = options.mode !== undefined ? options.mode : this.config.getMode();
    const interval = options.interval || this.config.getRefreshInterval();

    if (options.once) {
      this.displayCurrentSpeed(mode);
      return;
    }

    console.log(`Starting network speed monitoring...`);
    console.log(`Mode: ${this.formatter.getModeDescription(mode)}`);
    console.log(`Refresh interval: ${interval} seconds`);
    console.log(`Press Ctrl+C to stop\n`);

    this.isRunning = true;

    // Setup signal handlers
    process.on('SIGINT', () => this.stopMonitoring());
    process.on('SIGTERM', () => this.stopMonitoring());

    // Initial display
    this.displayCurrentSpeed(mode);

    // Start interval
    this.intervalId = setInterval(() => {
      this.displayCurrentSpeed(mode);
    }, interval * 1000);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (!this.isRunning) {
      console.log('Monitoring is not running.');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('\nMonitoring stopped.');
    process.exit(0);
  }

  /**
   * Display current speed
   */
  private displayCurrentSpeed(mode: DisplayMode): void {
    try {
      const stats = this.monitor.getSpeedStats(this.config.getRefreshInterval());
      let displayText: string;

      if (mode === DisplayMode.TOTAL_DOWNLOADED) {
        const totalDownloaded = this.monitor.getTotalDownloaded();
        displayText = this.formatter.formatSpeed(stats, mode, totalDownloaded);
      } else {
        displayText = this.formatter.formatSpeed(stats, mode);
      }

      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] ${displayText}`);
    } catch (error) {
      console.error('Error reading network stats:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * List all available modes
   */
  public listModes(): void {
    console.log('Available display modes:');
    SpeedFormatter.getAllModes().forEach(mode => {
      const current = mode === this.config.getMode() ? ' (current)' : '';
      console.log(`  ${mode}: ${this.formatter.getModeDescription(mode)}${current}`);
    });
  }

  /**
   * Show current configuration
   */
  public showConfig(): void {
    const config = this.config.getConfig();
    console.log('Current configuration:');
    console.log(`  Mode: ${config.mode} (${this.formatter.getModeDescription(config.mode)})`);
    console.log(`  Font Mode: ${config.fontMode}`);
    console.log(`  Refresh Interval: ${config.refreshInterval} seconds`);
    console.log(`  Config File: ${this.config.getConfigPath()}`);
  }

  /**
   * Set configuration
   */
  public setConfig(options: { mode?: number; fontMode?: number; interval?: number }): void {
    if (options.mode !== undefined) {
      if (options.mode >= 0 && options.mode <= 4) {
        this.config.setMode(options.mode as DisplayMode);
        console.log(`Mode set to: ${options.mode} (${this.formatter.getModeDescription(options.mode as DisplayMode)})`);
      } else {
        console.error('Invalid mode. Must be 0-4.');
      }
    }

    if (options.fontMode !== undefined) {
      if (options.fontMode >= 0 && options.fontMode <= 4) {
        this.config.setFontMode(options.fontMode);
        console.log(`Font mode set to: ${options.fontMode}`);
      } else {
        console.error('Invalid font mode. Must be 0-4.');
      }
    }

    if (options.interval !== undefined) {
      if (options.interval > 0 && options.interval <= 60) {
        this.config.setRefreshInterval(options.interval);
        console.log(`Refresh interval set to: ${options.interval} seconds`);
      } else {
        console.error('Invalid interval. Must be between 1-60 seconds.');
      }
    }
  }

  /**
   * Reset total download counter
   */
  public resetTotal(): void {
    this.monitor.resetTotalCounter();
    console.log('Total download counter reset.');
  }
}

// Main CLI setup
const program = new Command();
const cli = new NetSpeedCLI();

program
  .name('netspeed')
  .description('Network speed monitor - TypeScript port of simplenetspeed GNOME extension')
  .version('0.0.0');

program
  .command('monitor')
  .description('Start continuous network speed monitoring')
  .option('-m, --mode <mode>', 'Display mode (0-4)', parseInt)
  .option('-i, --interval <seconds>', 'Refresh interval in seconds', parseInt)
  .option('-o, --once', 'Show speed once and exit')
  .action((options) => {
    cli.startMonitoring(options);
  });

program
  .command('stop')
  .description('Stop monitoring (if running)')
  .action(() => {
    cli.stopMonitoring();
  });

program
  .command('modes')
  .description('List all available display modes')
  .action(() => {
    cli.listModes();
  });

program
  .command('config')
  .description('Show or set configuration')
  .option('-s, --show', 'Show current configuration')
  .option('-m, --mode <mode>', 'Set display mode (0-4)', parseInt)
  .option('-f, --font-mode <fontMode>', 'Set font mode (0-4)', parseInt)
  .option('-i, --interval <seconds>', 'Set refresh interval (1-60)', parseInt)
  .action((options) => {
    if (options.show || (!options.mode && !options.fontMode && !options.interval)) {
      cli.showConfig();
    } else {
      cli.setConfig(options);
    }
  });

program
  .command('reset')
  .description('Reset total download counter')
  .action(() => {
    cli.resetTotal();
  });

// Default command - start monitoring
program
  .action(() => {
    cli.startMonitoring({});
  });

program.parse();