import { NetworkStatsProvider } from './providers/NetworkStatsProvider.js';
import { createNetworkStatsProvider } from './providers/index.js';

export interface NetworkStats {
  totalBytes: number;
  totalUploadBytes: number;
  totalDownloadBytes: number;
}

export interface SpeedStats {
  totalSpeed: number;
  uploadSpeed: number;
  downloadSpeed: number;
  timestamp: number;
}

export class NetworkMonitor {
  private lastStats: NetworkStats | null = null;
  private lastTimestamp: number = 0;
  private resetTotalCount: number = 0;
  private readonly provider: NetworkStatsProvider;

  /**
   * @param provider Strategy used to read raw byte counters from the host OS.
   *   Defaults to the provider selected for the current platform, so existing
   *   callers (`new NetworkMonitor()`) keep working while becoming
   *   cross-platform. A specific provider can be injected for testing or to
   *   force a particular platform's behaviour.
   */
  constructor(provider: NetworkStatsProvider = createNetworkStatsProvider()) {
    this.provider = provider;
  }

  /**
   * Read current cumulative network statistics from the active provider.
   */
  private parseNetworkStats(): NetworkStats {
    return this.provider.read();
  }

  /**
   * Get current network speed statistics
   * @param refreshTimeSeconds Time interval for speed calculation
   */
  public getSpeedStats(refreshTimeSeconds: number = 3): SpeedStats {
    const currentStats = this.parseNetworkStats();
    const currentTime = Date.now();

    if (this.lastStats === null) {
      this.lastStats = currentStats;
      this.lastTimestamp = currentTime;
      return {
        totalSpeed: 0,
        uploadSpeed: 0,
        downloadSpeed: 0,
        timestamp: currentTime
      };
    }

    const timeDiff = (currentTime - this.lastTimestamp) / 1000; // Convert to seconds
    const actualRefreshTime = timeDiff > 0 ? timeDiff : refreshTimeSeconds;

    const totalSpeed = (currentStats.totalBytes - this.lastStats.totalBytes) / actualRefreshTime;
    const uploadSpeed = (currentStats.totalUploadBytes - this.lastStats.totalUploadBytes) / actualRefreshTime;
    const downloadSpeed = totalSpeed - uploadSpeed;

    this.lastStats = currentStats;
    this.lastTimestamp = currentTime;

    return {
      totalSpeed: Math.max(0, totalSpeed),
      uploadSpeed: Math.max(0, uploadSpeed),
      downloadSpeed: Math.max(0, downloadSpeed),
      timestamp: currentTime
    };
  }

  /**
   * Get total downloaded bytes since last reset
   */
  public getTotalDownloaded(): number {
    const currentStats = this.parseNetworkStats();
    return currentStats.totalBytes - this.resetTotalCount;
  }

  /**
   * Reset the total download counter
   */
  public resetTotalCounter(): void {
    const currentStats = this.parseNetworkStats();
    this.resetTotalCount = currentStats.totalBytes;
  }

  /**
   * Reset all internal counters
   */
  public reset(): void {
    this.lastStats = null;
    this.lastTimestamp = 0;
    this.resetTotalCount = 0;
  }
}