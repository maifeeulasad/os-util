import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import SysTrayDefault, { MenuItem, ClickEvent } from 'systray2';

// systray2 is a CommonJS module whose class is exported as `exports.default`.
// Under Node's ESM loader the default import resolves to the module namespace,
// so unwrap the real constructor (fallback covers bundlers that pre-unwrap).
const SysTray = ((SysTrayDefault as unknown as { default?: typeof SysTrayDefault }).default
  ?? SysTrayDefault) as typeof SysTrayDefault;

/** Runtime instance type of the systray2 class. */
type SysTrayInstance = InstanceType<typeof SysTrayDefault>;
import { NetworkMonitor } from '../NetworkMonitor.js';
import { SpeedFormatter, DisplayMode } from '../SpeedFormatter.js';
import { ConfigManager } from '../ConfigManager.js';

/** A tray menu item that can carry a click handler. */
type ActionableItem = MenuItem & { click?: () => void };

/**
 * System-tray frontend for the network speed monitor — the Windows taskbar
 * equivalent of the GNOME Shell panel extension.
 *
 * It is a thin presentation layer: all monitoring, formatting and persistence
 * is delegated to the shared, platform-agnostic core ({@link NetworkMonitor},
 * {@link SpeedFormatter}, {@link ConfigManager}), exactly like the CLI and the
 * GNOME extension. The tray only owns the menu, the poll loop, and translating
 * clicks into core calls.
 */
export class TrayApp {
  private readonly monitor: NetworkMonitor;
  private readonly formatter: SpeedFormatter;
  private readonly config: ConfigManager;

  private readonly intervalChoices = [1, 2, 3, 5, 10];

  private tray: SysTrayInstance | null = null;
  private timer: NodeJS.Timeout | null = null;

  // Menu item references we mutate at runtime.
  private speedItem!: ActionableItem;
  private modeItem!: ActionableItem;
  private intervalItem!: ActionableItem;
  private resetItem!: ActionableItem;
  private quitItem!: ActionableItem;

  constructor() {
    this.monitor = new NetworkMonitor();
    this.formatter = new SpeedFormatter();
    this.config = new ConfigManager();
  }

  /** Load the committed tray icon as a base64 string (ICO on Windows). */
  private loadIcon(): string {
    const iconPath = fileURLToPath(new URL('../../assets/tray-icon.ico', import.meta.url));
    return readFileSync(iconPath).toString('base64');
  }

  private modeLabel(): string {
    return `Mode: ${this.formatter.getModeDescription(this.config.getMode())}`;
  }

  private intervalLabel(): string {
    return `Interval: ${this.config.getRefreshInterval()}s (click to change)`;
  }

  /** Read current speed and render it according to the active display mode. */
  private renderSpeed(): string {
    try {
      const mode = this.config.getMode();
      const stats = this.monitor.getSpeedStats(this.config.getRefreshInterval());
      if (mode === DisplayMode.TOTAL_DOWNLOADED) {
        return this.formatter.formatSpeed(stats, mode, this.monitor.getTotalDownloaded());
      }
      return this.formatter.formatSpeed(stats, mode);
    } catch (error) {
      return error instanceof Error ? `Error: ${error.message}` : 'Error';
    }
  }

  private buildMenu() {
    this.speedItem = { title: 'Loading…', tooltip: '', enabled: false };
    this.modeItem = {
      title: this.modeLabel(),
      tooltip: 'Cycle display mode',
      enabled: true,
      click: () => {
        this.config.cycleMode();
        this.modeItem.title = this.modeLabel();
        this.pushItem(this.modeItem);
        this.update();
      }
    };
    this.intervalItem = {
      title: this.intervalLabel(),
      tooltip: 'Cycle refresh interval',
      enabled: true,
      click: () => {
        this.cycleInterval();
        this.intervalItem.title = this.intervalLabel();
        this.pushItem(this.intervalItem);
      }
    };
    this.resetItem = {
      title: 'Reset total counter',
      tooltip: 'Reset the ∑ downloaded total',
      enabled: true,
      click: () => {
        this.monitor.resetTotalCounter();
        this.update();
      }
    };
    this.quitItem = {
      title: 'Quit',
      tooltip: 'Exit OS Util',
      enabled: true,
      click: () => this.stop()
    };

    return {
      icon: this.loadIcon(),
      title: '',
      tooltip: 'OS Util — network speed',
      items: [
        this.speedItem,
        SysTray.separator,
        this.modeItem,
        this.intervalItem,
        this.resetItem,
        SysTray.separator,
        this.quitItem
      ]
    };
  }

  private cycleInterval(): void {
    const current = this.config.getRefreshInterval();
    const idx = this.intervalChoices.indexOf(current);
    const next = this.intervalChoices[(idx + 1) % this.intervalChoices.length];
    this.config.setRefreshInterval(next);
    this.restartTimer();
  }

  /** Push a single changed item to the tray. */
  private pushItem(item: ActionableItem): void {
    this.tray?.sendAction({ type: 'update-item', item });
  }

  /** Poll the current speed and reflect it in the menu item and tooltip. */
  private update(): void {
    if (!this.tray) return;
    const text = this.renderSpeed();
    this.speedItem.title = text;
    this.tray.sendAction({
      type: 'update-menu-and-item',
      menu: {
        icon: this.loadIcon(),
        title: '',
        tooltip: `OS Util — ${text}`,
        items: [
          this.speedItem,
          SysTray.separator,
          this.modeItem,
          this.intervalItem,
          this.resetItem,
          SysTray.separator,
          this.quitItem
        ]
      },
      item: this.speedItem
    });
  }

  private restartTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.update(), this.config.getRefreshInterval() * 1000);
  }

  /** Start the tray application. Resolves once the tray is ready. */
  public async start(): Promise<void> {
    this.tray = new SysTray({ menu: this.buildMenu(), debug: false, copyDir: true });

    this.tray.onClick((action: ClickEvent) => {
      const item = action.item as ActionableItem;
      if (typeof item.click === 'function') item.click();
    });

    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    await this.tray.ready();

    // Prime the baseline, then poll on the configured interval.
    this.update();
    this.restartTimer();
  }

  /** Stop polling, remove the tray icon and exit. */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.tray && !this.tray.killed) {
      this.tray.kill(true);
    } else {
      process.exit(0);
    }
  }
}
