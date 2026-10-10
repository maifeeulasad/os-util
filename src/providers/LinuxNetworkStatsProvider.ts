import { readFileSync } from 'fs';
import { NetworkStats } from '../NetworkMonitor.js';
import { NetworkStatsProvider } from './NetworkStatsProvider.js';

/**
 * Reads cumulative network byte counters from the Linux kernel via
 * `/proc/net/dev`.
 *
 * This is a direct port of the parsing logic used by the original
 * `simplenetspeed` GNOME extension (https://github.com/biji/simplenetspeed):
 * virtual and loopback interfaces are filtered out so only "real" traffic is
 * counted.
 */
export class LinuxNetworkStatsProvider implements NetworkStatsProvider {
  public readonly platform = 'linux';

  private static readonly PROC_NET_DEV = '/proc/net/dev';

  /**
   * Interface-name patterns that should be excluded from the totals. These
   * mirror the filters applied by the original extension.
   */
  private static readonly EXCLUDED_INTERFACES: RegExp[] = [
    /^lo$/,        // loopback
    /^ifb[0-9]+/,  // traffictoll bandwidth manager
    /^lxdbr[0-9]+/, // lxd container manager
    /^virbr[0-9]+/, // virtual bridge
    /^br[0-9]+/,   // bridge
    /^vnet[0-9]+/, // virtual network
    /^tun[0-9]+/,  // tunnel
    /^tap[0-9]+/   // tap device
  ];

  private static isExcluded(interfaceName: string): boolean {
    return LinuxNetworkStatsProvider.EXCLUDED_INTERFACES.some((pattern) =>
      pattern.test(interfaceName)
    );
  }

  public read(): NetworkStats {
    let content: string;
    try {
      content = readFileSync(LinuxNetworkStatsProvider.PROC_NET_DEV, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read ${LinuxNetworkStatsProvider.PROC_NET_DEV}: ${message}`);
    }

    let totalBytes = 0;
    let totalUploadBytes = 0;

    for (const line of content.split('\n')) {
      const fields = line.trim().split(/\W+/);
      if (fields.length <= 2) continue;

      const interfaceName = fields[0];
      if (LinuxNetworkStatsProvider.isExcluded(interfaceName)) continue;

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
  }
}
