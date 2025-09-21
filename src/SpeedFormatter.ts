import { SpeedStats } from './NetworkMonitor.js';

export enum DisplayMode {
  /** Total net speed in bits per second */
  TOTAL_BPS = 0,
  /** Total net speed in Bytes per second */
  TOTAL_BYTES = 1,
  /** Up & down speed in bits per second */
  SPLIT_BPS = 2,
  /** Up & down speed in Bytes per second */
  SPLIT_BYTES = 3,
  /** Total downloaded in Bytes */
  TOTAL_DOWNLOADED = 4
}

export class SpeedFormatter {
  private lastSpeed: number = 0;

  /**
   * Format speed value to human-readable string with appropriate units
   * @param amount Speed in bytes per second
   * @param mode Display mode to determine units and formatting
   */
  public speedToString(amount: number, mode: DisplayMode): string {
    let speedMap: string[];

    switch (mode) {
      case DisplayMode.TOTAL_BPS:
      case DisplayMode.SPLIT_BPS:
        speedMap = ["bps", "Kbps", "Mbps", "Gbps"];
        break;
      case DisplayMode.TOTAL_BYTES:
      case DisplayMode.SPLIT_BYTES:
        speedMap = ["B/s", "K/s", "M/s", "G/s"];
        break;
      case DisplayMode.TOTAL_DOWNLOADED:
        speedMap = ["B", "KB", "MB", "GB"];
        break;
      default:
        speedMap = ["B/s", "K/s", "M/s", "G/s"];
    }

    if (amount === 0) {
      return "0" + speedMap[0];
    }

    // Convert to bits if mode requires it
    if (mode === DisplayMode.TOTAL_BPS || mode === DisplayMode.SPLIT_BPS) {
      amount = amount * 8;
    }

    let unit = 0;
    while (amount >= 1000 && unit < speedMap.length - 1) { // 1M=1000K
      amount /= 1000;
      ++unit;
    }

    let digits: number;
    if (amount >= 100) {
      digits = 0; // 100MB, 100KB, 200KB
    } else if (amount >= 10) {
      digits = 1; // 10MB, 10.2KB
    } else {
      digits = 2; // 1.23MB
    }

    return amount.toFixed(digits) + speedMap[unit];
  }

  /**
   * Format speed statistics according to the specified display mode
   * @param stats Current speed statistics
   * @param mode Display mode
   * @param totalDownloaded Total downloaded bytes (for TOTAL_DOWNLOADED mode)
   */
  public formatSpeed(stats: SpeedStats, mode: DisplayMode, totalDownloaded?: number): string {
    const { totalSpeed, uploadSpeed, downloadSpeed } = stats;

    // Activity indicator: show ⇅ if speed increased
    const activityIndicator = totalSpeed > this.lastSpeed ? "⇅" : "";
    this.lastSpeed = totalSpeed;

    switch (mode) {
      case DisplayMode.TOTAL_BPS:
      case DisplayMode.TOTAL_BYTES:
        return activityIndicator + this.speedToString(totalSpeed, mode);

      case DisplayMode.SPLIT_BPS:
      case DisplayMode.SPLIT_BYTES:
        return "↓" + this.speedToString(downloadSpeed, mode) + " ↑" + this.speedToString(uploadSpeed, mode);

      case DisplayMode.TOTAL_DOWNLOADED:
        const total = totalDownloaded !== undefined ? totalDownloaded : 0;
        return "∑ " + this.speedToString(total, mode);

      default:
        return this.speedToString(totalSpeed, DisplayMode.TOTAL_BYTES);
    }
  }

  /**
   * Get display mode description
   * @param mode Display mode
   */
  public getModeDescription(mode: DisplayMode): string {
    switch (mode) {
      case DisplayMode.TOTAL_BPS:
        return "Total net speed in bits per second";
      case DisplayMode.TOTAL_BYTES:
        return "Total net speed in Bytes per second";
      case DisplayMode.SPLIT_BPS:
        return "Up & down speed in bits per second";
      case DisplayMode.SPLIT_BYTES:
        return "Up & down speed in Bytes per second";
      case DisplayMode.TOTAL_DOWNLOADED:
        return "Total downloaded in Bytes";
      default:
        return "Unknown mode";
    }
  }

  /**
   * Get all available display modes
   */
  public static getAllModes(): DisplayMode[] {
    return Object.values(DisplayMode).filter(value => typeof value === 'number') as DisplayMode[];
  }

  /**
   * Get next display mode in sequence
   * @param currentMode Current display mode
   */
  public static getNextMode(currentMode: DisplayMode): DisplayMode {
    const modes = SpeedFormatter.getAllModes();
    const currentIndex = modes.indexOf(currentMode);
    return modes[(currentIndex + 1) % modes.length];
  }

  /**
   * Reset internal state
   */
  public reset(): void {
    this.lastSpeed = 0;
  }
}