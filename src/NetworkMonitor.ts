import { readFileSync } from 'fs';

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

  /**
   * Parse /proc/net/dev to get network statistics
   * Filters out loopback and virtual interfaces like the original extension
   */
  private parseNetworkStats(): NetworkStats {
    try {
      const content = readFileSync('/proc/net/dev', 'utf8');
      const lines = content.split('\n');

      let totalBytes = 0;
      let totalUploadBytes = 0;

      for (const line of lines) {
        const fields = line.trim().split(/\W+/);
        if (fields.length <= 2) continue;

        const interfaceName = fields[0];

        // Filter out interfaces like the original extension
        if (interfaceName === 'lo' ||
          interfaceName.match(/^ifb[0-9]+/) ||    // traffictoll bandwidth manager
          interfaceName.match(/^lxdbr[0-9]+/) ||  // lxd container manager
          interfaceName.match(/^virbr[0-9]+/) ||  // virtual bridge
          interfaceName.match(/^br[0-9]+/) ||     // bridge
          interfaceName.match(/^vnet[0-9]+/) ||   // virtual network
          interfaceName.match(/^tun[0-9]+/) ||    // tunnel
          interfaceName.match(/^tap[0-9]+/)) {    // tap device
          continue;
        }

        const rxBytes = parseInt(fields[1], 10);
        const txBytes = parseInt(fields[9], 10);

        if (!isNaN(rxBytes) && !isNaN(txBytes)) {
          totalBytes += rxBytes + txBytes;
          totalUploadBytes += txBytes;
        }
      }

      return {
        totalBytes,
        totalUploadBytes,
        totalDownloadBytes: totalBytes - totalUploadBytes
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read network statistics: ${errorMessage}`);
    }
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